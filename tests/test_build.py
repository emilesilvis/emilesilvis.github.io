from contextlib import redirect_stdout
from datetime import date
import io
from html import unescape
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

from PIL import Image

import build
from assets import Images
from check_site import Page, check_site
from content import read_document


class ContentTests(unittest.TestCase):
    def read(self, text, name='18-07-2026-example.md', **kwargs):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / name
            path.write_text(text)
            return read_document(path, **kwargs)

    def test_quoted_metadata_survives_html_and_xml_rendering(self):
        document = self.read('''---
title: 'Search title & "quotation"'
seo_description: "A \\"quoted\\" summary & <more>"
updated: 2026-09-07
---
# Visible heading

Body text.
''')
        page = Page(build.render_document(document))
        self.assertEqual(document.title, 'Search title & "quotation"')
        self.assertEqual(document.heading, 'Visible heading')
        self.assertEqual(page.title, document.title)
        self.assertEqual(page.meta['description'], 'A "quoted" summary & <more>')
        self.assertEqual(page.dates, ['2026-07-18'])
        self.assertEqual(document.updated, date(2026, 9, 7))
        with tempfile.TemporaryDirectory() as directory, patch.object(build, 'OUT', Path(directory)):
            build.write_discovery([document], [], {})
            feed = ET.parse(Path(directory) / 'feed.xml')
            self.assertEqual(feed.findtext('{*}entry/{*}title'), document.title)
            self.assertEqual(feed.findtext('{*}entry/{*}summary'), document.description)
            self.assertEqual(feed.findtext('{*}entry/{*}updated'), '2026-09-07T00:00:00Z')

    def test_rejects_malformed_content_with_source_context(self):
        cases = [
            ('---\ntitle: broken\n# Missing closing delimiter', 'closing'),
            ('---\n- a list\n---\n# Heading', 'mapping'),
            ('---\ntitle: 12\n---\n# Heading', 'title must be text'),
            ('---\nupdated: 2020-01-01\n---\n# Heading', 'precede publication'),
            ('---\nseries: Test\n---\n# Heading', 'set together'),
            ('Body without heading', '# heading'),
        ]
        for text, message in cases:
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, 'example.md:.*' + message):
                self.read(text)
        with self.assertRaisesRegex(ValueError, 'invalid date'):
            self.read('# Heading', name='31-02-2026-example.md')

    def test_fallback_description_is_plain_text(self):
        document = self.read('# Heading\n\nA **short** paragraph with a [link](https://example.com).')
        self.assertEqual(document.description, 'A short paragraph with a link.')

    def test_page_and_post_metadata_have_distinct_types_and_urls(self):
        post = Page(build.render_document(self.read('# Post\n\nWords.')))
        page = Page(build.render_document(self.read('# Page\n\nWords.', name='page.md', is_page=True)))
        self.assertEqual(post.meta['og:type'], 'article')
        self.assertEqual(page.meta['og:type'], 'website')
        self.assertEqual(page.canonical, ['https://emilesilvis.com/page.html'])

    def test_content_tokens_cannot_be_reinterpreted_as_template_tokens(self):
        document = self.read('# Heading\n\n```\n  {{title}}\n    <sample>\n```')
        rendered = build.render_document(document)
        text = unescape(re.sub(r'<[^>]+>', '', rendered))
        self.assertIn('  {{title}}\n    <sample>', text)

    def test_table_and_code_scrolling_is_contained_and_keyboard_accessible(self):
        html = build.render('| A | B |\n|---|---|\n| 1 | 2 |\n\n```\n  indented\n```')
        self.assertIn('<div class="table-scroll" tabindex="0" role="region"', html)
        self.assertIn('<th scope="col">A</th>', html)
        self.assertIn('<pre tabindex="0" role="region" aria-label="Code sample 1">', html)
        self.assertIn('  indented', html)

    def test_eu_headline_uses_bundled_employment_weights(self):
        self.assertEqual(build.build_values()['eu_average_exposure'], '4.4')
        document = read_document(build.POSTS / '16-03-2026-llm-exposure-eu-jobs.md', values=build.build_values())
        self.assertIn('**4.4/10**', document.body)
        self.assertNotIn('{{eu_average_exposure}}', document.body)


class BuildTests(unittest.TestCase):
    def test_build_works_without_analysis_or_network_even_with_api_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            posts, pages, out = (root / name for name in ('posts', 'pages', 'out'))
            posts.mkdir()
            pages.mkdir()
            for name in ('projects', 'books-read', 'how-1-plus-1-becomes-2'):
                (pages / f'{name}.md').write_text(f'# {name}\n\nA fixture page.')
            (posts / '01-01-2026-uncached.md').write_text('# Uncached\n\nNew prose that has never been submitted for analysis.')
            with patch.multiple(build, POSTS=posts, PAGES=pages, OUT=out), \
                    patch.dict('os.environ', {'PANGRAM_API_KEY': 'unused-test-key', 'PANGRAM_REQUIRED': 'true'}), \
                    patch('pangram_badge.PangramClient', side_effect=AssertionError('Build must not construct an API client')), \
                    patch('socket.create_connection', side_effect=AssertionError('Build must stay offline')), \
                    redirect_stdout(io.StringIO()):
                build.main()
            self.assertTrue((out / 'uncached.html').exists())
            self.assertEqual((out / 'CNAME').read_text().strip(), 'emilesilvis.com')
            self.assertTrue((out / '.nojekyll').exists())
            self.assertNotIn('Verified human writing', (out / 'uncached.html').read_text())
            self.assertEqual(check_site(out), [])
            # Prove the checker catches actual broken output.
            page = out / 'uncached.html'
            page.write_text(page.read_text().replace('</main>', '<a href="/absent.html">Broken</a></main>'))
            self.assertTrue(any('missing local destination /absent.html' in error for error in check_site(out)))

    def test_collision_is_rejected_before_deleting_existing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pages, out = root / 'pages', root / 'out'
            pages.mkdir()
            out.mkdir()
            (pages / 'index.md').write_text('# Colliding home page')
            sentinel = out / 'keep.txt'
            sentinel.write_text('previous successful build')
            with patch.multiple(build, PAGES=pages, OUT=out), self.assertRaisesRegex(ValueError, 'Output collision at index.html'):
                build.main()
            self.assertEqual(sentinel.read_text(), 'previous successful build')

    def test_image_variants_reserve_space_preserve_original_and_invalidate_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'static/images/example.png'
            source.parent.mkdir(parents=True)
            Image.new('RGB', (100, 50), '#224466').save(source)
            original = source.read_bytes()
            attrs = Images(root, root / 'out').attributes('/static/images/example.png')
            self.assertEqual((attrs['width'], attrs['height']), ('100', '50'))
            self.assertEqual(source.read_bytes(), original)
            rendered = build.render('![Diagram](/static/images/example.png)', Images(root, root / 'out'))
            self.assertIn('class="image-original" href="/static/images/example.png"', rendered)
            linked = build.render('[![Diagram](/static/images/example.png)](/projects.html)', Images(root, root / 'out'))
            self.assertEqual(linked.count('<a '), 1)
            self.assertIn('href="/projects.html"', linked)
            with Image.open(root / 'out' / attrs['src'].lstrip('/')) as variant:
                self.assertEqual(variant.size, (100, 50))
                self.assertEqual(variant.getpixel((0, 0)), (34, 68, 102))
            Image.new('RGB', (100, 50), '#ffffff').save(source)
            changed = Images(root, root / 'out').attributes('/static/images/example.png')
            self.assertNotEqual(attrs['src'], changed['src'])


if __name__ == '__main__':
    unittest.main()
