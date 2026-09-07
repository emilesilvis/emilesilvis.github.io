#!/usr/bin/env python3
"""Check generated HTML, local destinations, metadata, feeds, and discovery."""

from collections import Counter
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET

from config import HOSTNAME


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.links = []
        self.dates = []
        self.meta = {}
        self.canonical = []
        self.headings = 0
        self.title = ''
        self.in_title = False
        self.lang = ''
        self.feed(html)

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'html':
            self.lang = attrs.get('lang', '')
        if tag == 'title':
            self.in_title = True
        if tag == 'h1':
            self.headings += 1
        if tag == 'meta':
            self.meta[attrs.get('name') or attrs.get('property')] = attrs.get('content', '')
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            self.canonical.append(attrs.get('href', ''))
        if tag == 'time':
            self.dates.append(attrs.get('datetime', ''))
        for attr in ('href', 'src', 'poster'):
            if attr in attrs:
                self.links.append(attrs[attr])
        if 'srcset' in attrs:
            self.links.extend(item.strip().split()[0] for item in attrs['srcset'].split(',') if item.strip())

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def check_site(out: Path) -> list[str]:
    pages = {path.relative_to(out).as_posix(): Page(path.read_text(encoding='utf-8')) for path in out.rglob('*.html')}
    errors = []
    host = urlsplit(HOSTNAME).netloc

    def destination(url, source):
        parsed = urlsplit(urljoin(HOSTNAME + '/' + source, url))
        if parsed.scheme not in ('http', 'https') or parsed.netloc != host:
            return None, None
        target = unquote(parsed.path).lstrip('/')
        if not target or target.endswith('/'):
            target += 'index.html'
        if not (out / target).is_file():
            errors.append(f'{source}: missing local destination {url}')
            return None, None
        return target, unquote(parsed.fragment)

    if not pages:
        return ['No generated HTML found; run python build.py first.']
    for path, page in pages.items():
        if not page.title.strip() or not page.lang or page.headings != 1:
            errors.append(f'{path}: needs a title, language, and exactly one h1')
        for field in ('description', 'viewport', 'og:title', 'og:description', 'og:url', 'og:type', 'twitter:card'):
            if not page.meta.get(field):
                errors.append(f'{path}: missing {field} metadata')
        if len(page.canonical) != 1 or page.canonical[0] != page.meta.get('og:url'):
            errors.append(f'{path}: canonical URL and og:url must agree')
        elif not page.canonical[0].startswith(HOSTNAME + '/'):
            errors.append(f'{path}: canonical URL must use {HOSTNAME}')
        duplicate_ids = [value for value, count in Counter(page.ids).items() if count > 1]
        if duplicate_ids:
            errors.append(f'{path}: duplicate IDs {duplicate_ids}')
        for value in page.dates:
            try:
                date.fromisoformat(value)
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
                    raise ValueError()
            except ValueError:
                errors.append(f'{path}: invalid date {value!r}')
        for url in page.links:
            target, fragment = destination(url, path)
            if target in pages and fragment and not fragment.startswith(':~:text='):
                linked = pages[target]
                # Redirect aliases preserve hashes; check the canonical document.
                if fragment not in linked.ids and linked.canonical:
                    canonical_target, _ = destination(linked.canonical[0], target)
                    linked = pages.get(canonical_target, linked)
                if fragment not in linked.ids:
                    errors.append(f'{path}: missing fragment {url}')

    # Check local CSS assets and static JavaScript imports too.
    for path in out.rglob('*'):
        if path.suffix not in ('.css', '.js', '.mjs') or 'vendor' in path.parts:
            continue
        text = path.read_text(encoding='utf-8')
        urls = re.findall(r'url\(\s*[\"\']?([^\s)\"\']+)', text) if path.suffix == '.css' else re.findall(r'(?:from\s*|import\s*(?:\(\s*)?)[\"\']([^\"\']+)[\"\']', text)
        for url in urls:
            if url.startswith(('/', './', '../')):
                destination(url, path.relative_to(out).as_posix())

    try:
        sitemap = ET.parse(out / 'sitemap.xml')
        urls = [element.text for element in sitemap.findall('.//{*}loc')]
        expected = {page.canonical[0] for page in pages.values() if len(page.canonical) == 1 and page.meta.get('robots') != 'noindex'}
        if set(urls) != expected or len(urls) != len(set(urls)):
            errors.append(f'sitemap.xml: canonical coverage differs: {set(urls) ^ expected}')
        for url in urls:
            destination(url, 'sitemap.xml')
        feed = ET.parse(out / 'feed.xml')
        entries = feed.findall('{*}entry')
        expected_posts = {page.canonical[0] for page in pages.values() if page.meta.get('og:type') == 'article'}
        entry_urls = {entry.findtext('{*}id') for entry in entries}
        if entry_urls != expected_posts or len(entries) != len(entry_urls):
            errors.append('feed.xml: must include every post exactly once')
        for entry in entries:
            destination(entry.findtext('{*}id'), 'feed.xml')
            if not entry.findtext('{*}summary'):
                errors.append('feed.xml: empty summary')
            for field in ('published', 'updated'):
                datetime.fromisoformat(entry.findtext('{*}' + field))
        datetime.fromisoformat(feed.findtext('{*}updated'))
        if f'Sitemap: {HOSTNAME}/sitemap.xml' not in (out / 'robots.txt').read_text():
            errors.append('robots.txt: missing sitemap')
    except (ET.ParseError, OSError, ValueError, TypeError) as error:
        errors.append(f'Discovery file error: {error}')
    return errors


if __name__ == '__main__':
    errors = check_site(Path(__file__).parent / 'out')
    if errors:
        raise SystemExit('\n'.join(errors))
    print('Generated-site checks passed: HTML, local links/assets, metadata, dates, sitemap, and feed.')
