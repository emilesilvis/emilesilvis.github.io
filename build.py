#!/usr/bin/env python3
"""Build the site offline from authored content and saved analysis results."""

from collections import defaultdict
from datetime import datetime, timezone
from html import escape, unescape
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re
import shutil
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
import xml.etree.ElementTree as ET

import markdown

from assets import Images
from config import SITE_NAME, BIO, HOSTNAME, UMAMI, NAVIGATION
from content import Document, read_document
from pangram_badge import PangramBadgeService, prose_from_html, verified_human_badge

ROOT = Path(__file__).parent
POSTS = ROOT / 'posts'
PAGES = ROOT / 'pages'
OUT = ROOT / 'out'
VOID_TAGS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


def asset_url(path):
    digest = hashlib.sha256((ROOT / path.lstrip('/')).read_bytes()).hexdigest()[:12]
    return f'{path}?v={digest}'


def version_local_assets(html, page_path, sources):
    """Update app asset versions too, so imported cache keys cannot go stale."""
    def replace(match):
        original = unescape(match[2])
        url = urlsplit(urljoin(HOSTNAME + '/' + page_path, original))
        source = sources.get(url.path.lstrip('/'))
        if url.netloc != urlsplit(HOSTNAME).netloc or not source or source.suffix not in ('.css', '.js', '.mjs'):
            return match[0]
        digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
        parts = urlsplit(original)
        query = [(key, value) for key, value in parse_qsl(parts.query) if key != 'v'] + [('v', digest)]
        versioned = urlunsplit(parts._replace(query=urlencode(query)))
        return f'{match[1]}="{escape(versioned, quote=True)}"'
    return re.sub(r'\b(src|href)="([^"]+)"', replace, html)


def build_values():
    occupations = json.loads((ROOT / 'static/data/job_market_data.json').read_text())
    total = sum(row['eu'] for row in occupations)
    average = sum(row['eu'] * row['exposure'] for row in occupations) / total
    return {'eu_average_exposure': f'{average:.1f}'}


class ContentHTML(HTMLParser):
    """Enhance Markdown output without rewriting its text or code samples."""

    def __init__(self, images=None):
        super().__init__(convert_charrefs=False)
        self.images = images
        self.parts = []
        self.image_count = 0
        self.table_count = 0
        self.code_count = 0
        self.anchor_depth = 0

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        original_image = None
        if tag == 'a':
            self.anchor_depth += 1
            url = urlsplit(attrs.get('href', ''))
            if url.scheme in ('http', 'https') and url.netloc != urlsplit(HOSTNAME).netloc:
                attrs.setdefault('target', '_blank')
                attrs['rel'] = ' '.join(sorted(set(attrs.get('rel', '').split()) | {'noopener', 'noreferrer'}))
        if tag == 'img':
            self.image_count += 1
            original_source = attrs.get('src', '')
            if self.images:
                attrs.update(self.images.attributes(original_source))
                if 'srcset' in attrs and not self.anchor_depth:
                    original_image = original_source
            attrs.setdefault('loading', 'eager' if self.image_count == 1 else 'lazy')
            attrs.setdefault('decoding', 'async')
        if tag == 'video':
            attrs.setdefault('preload', 'metadata')
        if tag == 'pre':
            self.code_count += 1
            attrs.update({'tabindex': '0', 'role': 'region', 'aria-label': f'Code sample {self.code_count}'})
        if tag == 'table':
            self.table_count += 1
            self.parts.append(f'<div class="table-scroll" tabindex="0" role="region" aria-label="Table {self.table_count}">')
        if tag == 'th':
            attrs.setdefault('scope', 'col')
        rendered = ''.join(f' {key}' if value is None else f' {key}="{escape(value, quote=True)}"' for key, value in attrs.items())
        if original_image:
            label = escape('View full-size image: ' + attrs.get('alt', 'Image'), quote=True)
            self.parts.append(f'<a class="image-original" href="{escape(original_image, quote=True)}" aria-label="{label}" title="View full-size image">')
        self.parts.append(f'<{tag}{rendered}>')
        if original_image:
            self.parts.append('</a>')

    def handle_endtag(self, tag):
        if tag == 'a':
            self.anchor_depth = max(0, self.anchor_depth - 1)
        if tag not in VOID_TAGS:
            self.parts.append(f'</{tag}>')
        if tag == 'table':
            self.parts.append('</div>')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data):
        self.parts.append(data)

    def handle_entityref(self, name):
        self.parts.append(f'&{name};')

    def handle_charref(self, name):
        self.parts.append(f'&#{name};')

    def handle_comment(self, data):
        self.parts.append(f'<!--{data}-->')


def render(markdown_text, images=None):
    body = markdown.markdown(markdown_text, extensions=['fenced_code', 'codehilite', 'tables'])
    parser = ContentHTML(images)
    parser.feed(body)
    parser.close()
    return ''.join(parser.parts)


def page_metadata(title, description, url, image='', page_type='website', noindex=False):
    canonical = urljoin(HOSTNAME, url)
    metadata = [
        f'<meta name="description" content="{escape(description, quote=True)}">',
        f'<link rel="canonical" href="{escape(canonical, quote=True)}">',
        f'<meta property="og:type" content="{page_type}">',
        f'<meta property="og:url" content="{escape(canonical, quote=True)}">',
        f'<meta property="og:title" content="{escape(title, quote=True)}">',
        f'<meta property="og:description" content="{escape(description, quote=True)}">',
        f'<meta name="twitter:card" content="{"summary_large_image" if image else "summary"}">',
        f'<meta name="twitter:title" content="{escape(title, quote=True)}">',
        f'<meta name="twitter:description" content="{escape(description, quote=True)}">',
    ]
    if image:
        image = escape(urljoin(HOSTNAME, image), quote=True)
        metadata += [f'<meta property="og:image" content="{image}">', f'<meta name="twitter:image" content="{image}">']
    if noindex:
        metadata.append('<meta name="robots" content="noindex">')
    return '\n'.join(metadata)


def navigation(url):
    links = []
    for item in NAVIGATION:
        path = item['path'].strip('/')
        href = f'/{path}.html' if path else '/'
        current = ' aria-current="page"' if href == url else ''
        links.append(f'<li><a href="{href}"{current}>{escape(item["title"])}</a></li>')
    return '<ul>' + ''.join(links) + '</ul>'


def apply_template(title, body_html, seo_image='', seo_description='', date='', main_heading='', *, url='/', page_type='website', noindex=False):
    template = (ROOT / 'static/templates/template.html').read_text(encoding='utf-8')
    values = {
        'title': escape(title), 'content': body_html, 'main_heading': main_heading,
        'year': str(datetime.now(timezone.utc).year), 'site_name': escape(SITE_NAME),
        'hostname': escape(HOSTNAME), 'bio.name': escape(BIO['name']), 'bio.bio': escape(BIO['bio']),
        'nav': navigation(url), 'umami_website_id': escape(UMAMI['website_id']),
        'metadata': page_metadata(title, seo_description, url, seo_image, page_type, noindex),
        'stylesheet': asset_url('/static/css/style.css'), 'theme_script': asset_url('/static/js/theme.js'),
        'presence_script': asset_url('/static/js/presence.js'),
    }
    for name, social in BIO['social'].items():
        for field, value in social.items():
            values[f'bio.social.{name}.{field}'] = escape(value, quote=True)
    # Replace only template tokens, never tokens inside authored code/content.
    return re.sub(r'{{([\w.]+)}}', lambda match: values[match[1]], template)


def series_navigation(document, documents):
    if not document.series:
        return ''
    parts = sorted((doc for doc in documents if doc.series == document.series), key=lambda doc: doc.series_order)
    links = ''.join(
        f'<li><a href="{doc.url}"{" aria-current=\"page\"" if doc.url == document.url else ""}>{escape(doc.heading)}</a></li>'
        for doc in parts
    )
    return f'<nav class="series-nav" aria-label="Series"><details><summary>{escape(document.series)} · Part {document.series_order} of {len(parts)}</summary><ol>{links}</ol></details></nav>'


def render_document(document, *, pangram_badges=None, images=None, documents=()):
    body = render(document.body, images)
    heading = f'<h1>{escape(document.heading)}</h1>'
    if document.published:
        display_date = f'{document.published.day} {document.published:%b %Y}'
        heading += f'<time datetime="{document.published.isoformat()}" class="post-date">{display_date}</time>'
        if pangram_badges is not None:
            result = pangram_badges.analyze(prose_from_html(body))
            if result is not None:
                badge = verified_human_badge(result)
                if badge:
                    body += '\n' + badge
                print(f'Pangram report: {document.source.name} {result.dashboard_link}')
        heading += series_navigation(document, documents)
    return apply_template(
        document.title, body, seo_image=document.image, seo_description=document.description,
        main_heading=heading, url=document.url, page_type='article' if document.published else 'website',
    )


def build_post(md_path, is_page=False, pangram_badges=None):
    document = read_document(md_path, is_page=is_page, values=build_values())
    return document.title, render_document(document, pangram_badges=pangram_badges)


def reserve_output(registry, path, source):
    if path in registry:
        raise ValueError(f'Output collision at {path}: {registry[path]} and {source}')
    registry[path] = source


def xml_file(path, root):
    ET.indent(root, space='  ')
    ET.ElementTree(root).write(path, encoding='utf-8', xml_declaration=True)


def write_discovery(posts, pages, extras):
    sitemap = ET.Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    urls = {'/': None}
    for document in [*pages, *posts]:
        urls[document.url] = document.updated
    for path, metadata in extras.items():
        if not metadata.get('alias'):
            urls[metadata['url']] = None
    for path, updated in urls.items():
        entry = ET.SubElement(sitemap, 'url')
        ET.SubElement(entry, 'loc').text = HOSTNAME + path
        if updated:
            ET.SubElement(entry, 'lastmod').text = updated.isoformat()
    xml_file(OUT / 'sitemap.xml', sitemap)

    feed = ET.Element('feed', xmlns='http://www.w3.org/2005/Atom')
    ET.SubElement(feed, 'title').text = SITE_NAME
    ET.SubElement(feed, 'link', href=HOSTNAME + '/')
    ET.SubElement(feed, 'link', href=HOSTNAME + '/feed.xml', rel='self')
    ET.SubElement(feed, 'id').text = HOSTNAME + '/'
    updated = max((post.updated for post in posts), default=datetime.now(timezone.utc).date())
    ET.SubElement(feed, 'updated').text = f'{updated.isoformat()}T00:00:00Z'
    ET.SubElement(ET.SubElement(feed, 'author'), 'name').text = BIO['name']
    for post in posts:
        entry = ET.SubElement(feed, 'entry')
        ET.SubElement(entry, 'title').text = post.title
        ET.SubElement(entry, 'link', href=HOSTNAME + post.url)
        ET.SubElement(entry, 'id').text = HOSTNAME + post.url
        ET.SubElement(entry, 'published').text = f'{post.published.isoformat()}T00:00:00Z'
        ET.SubElement(entry, 'updated').text = f'{post.updated.isoformat()}T00:00:00Z'
        ET.SubElement(entry, 'summary').text = post.description
    xml_file(OUT / 'feed.xml', feed)
    (OUT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {HOSTNAME}/sitemap.xml\n')


def main():
    values = build_values()
    pages = [read_document(path, is_page=True, values=values) for path in sorted(PAGES.glob('*.md'))]
    posts = sorted((read_document(path, values=values) for path in POSTS.glob('*.md')), key=lambda doc: (doc.published, doc.url), reverse=True)
    extras = json.loads((ROOT / 'public_pages.json').read_text())
    registry = {}
    for generated in ('index.html', '404.html', 'sitemap.xml', 'feed.xml', 'robots.txt'):
        reserve_output(registry, generated, 'generator')
    for document in [*pages, *posts]:
        reserve_output(registry, document.url.lstrip('/'), document.source)
    copies = {}
    for filename in ('CNAME', '.nojekyll'):
        source = ROOT / filename
        if source.is_file():
            reserve_output(registry, filename, source)
            copies[filename] = source
    for folder in ('static', 'apps', 'html'):
        for source in sorted((ROOT / folder).rglob('*')):
            parts = source.relative_to(ROOT / folder).parts
            if not source.is_file() or any(part.startswith('.') for part in parts) or 'templates' in parts:
                continue
            if source.name == 'README.md':
                continue
            target = source.relative_to(ROOT if folder == 'static' else ROOT / folder).as_posix()
            reserve_output(registry, target, source)
            copies[target] = source
    html_copies = {target for target in copies if target.endswith('.html')}
    if html_copies != set(extras):
        raise ValueError(f'Update public_pages.json for HTML exports: {html_copies ^ set(extras)}')
    for target, metadata in extras.items():
        if metadata.get('source') != copies[target].relative_to(ROOT).as_posix():
            raise ValueError(f'{target}: public_pages.json source does not match the copied file')
        for field in ('title', 'description', 'url'):
            if not isinstance(metadata.get(field), str) or not metadata[field].strip():
                raise ValueError(f'{target}: public_pages.json needs {field}')
        expected_url = '/' + (target[:-10] if target.endswith('/index.html') else target)
        if not metadata.get('alias') and metadata['url'] != expected_url:
            raise ValueError(f'{target}: canonical path must be {expected_url}')
    series_positions = set()
    for post in posts:
        if post.series:
            position = (post.series, post.series_order)
            if position in series_positions:
                raise ValueError(f'Duplicate series position: {position}')
            series_positions.add(position)

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for target, source in copies.items():
        destination = OUT / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        if target in extras:
            metadata = extras[target]
            raw = source.read_text(encoding='utf-8')
            head = page_metadata(metadata['title'], metadata['description'], metadata['url'])
            raw = raw.replace('</head>', head + '\n</head>', 1)
            raw = version_local_assets(raw, target, copies)
            destination.write_text(raw, encoding='utf-8')
        else:
            shutil.copyfile(source, destination)

    images = Images(ROOT, OUT)
    # Rendering never constructs a client or reads an API key. Refresh analysis
    # explicitly with analyze_posts.py and keep the resulting metadata in git.
    badges = PangramBadgeService(ROOT / 'data/pangram/results.json')
    for document in [*pages, *posts]:
        (OUT / document.url.lstrip('/')).write_text(render_document(document, pangram_badges=badges, images=images, documents=posts), encoding='utf-8')

    by_year = defaultdict(list)
    for post in posts:
        date = f'{post.published.day} {post.published:%b %Y}'
        by_year[post.published.year].append(
            f'<li><a href="{post.url}">{escape(post.title)}</a><time datetime="{post.published.isoformat()}">{date}</time></li>'
        )
    index = ['<p class="reading-paths">Follow <a href="/how-1-plus-1-becomes-2.html">how a computer adds 1+1</a>, or explore the <a href="/projects.html">interactive projects</a>.</p>']
    for year in sorted(by_year, reverse=True):
        index.append(f'<h2>{year}</h2><ul class="post-list">{"".join(by_year[year])}</ul>')
    (OUT / 'index.html').write_text(apply_template(SITE_NAME, '\n'.join(index), seo_description='Essays and interactive projects by Emile Silvis on mathematics, computing, AI, and systems thinking.', main_heading='<h1>Posts</h1>'), encoding='utf-8')
    (OUT / '404.html').write_text(apply_template('Page not found', '<p>This page has moved or is no longer available.</p><p>Browse the <a href="/">posts</a> or explore the <a href="/projects.html">projects</a>.</p>', seo_description='Find your way back to Emile Silvis’s posts and projects.', main_heading='<h1>Page not found</h1>', url='/404.html', noindex=True), encoding='utf-8')
    write_discovery(posts, pages, extras)
    print(f'Built {len(posts)} posts, {len(pages)} pages, and {len(extras)} HTML exports.')


if __name__ == '__main__':
    main()
