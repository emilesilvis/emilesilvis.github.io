#!/usr/bin/env python3
from config import SITE_NAME, BIO, HOSTNAME, UMAMI, NAVIGATION
from pathlib import Path
from datetime import datetime
import shutil, re, html, math
import markdown  # only external dependency


ROOT = Path(__file__).parent
POSTS = ROOT / "posts"
PAGES = ROOT / "pages"
OUT = ROOT / "out"
TEMPL = (ROOT / "static" / "templates" / "template.html").read_text(encoding="utf-8")


def _nav_href(path):
    path = path.strip("/")
    return "/" if not path else f"/{path}.html"


NAV_HTML = "".join(
    f'<a href="{_nav_href(n["path"])}">{n["title"]}</a>'
    for n in NAVIGATION
) if NAVIGATION else ""


def _iso_date(dd_mm_yyyy):
    parts = dd_mm_yyyy.split("-")
    return f"{parts[2]}-{parts[1]}-{parts[0]}"


def _read_time(text):
    words = len(text.split())
    minutes = max(1, math.ceil(words / 250))
    return f"{minutes} min read"


def process_external_links(html_content):
    link_pattern = r'<a\s+href="([^"]+)"([^>]*)>'

    def replace_link(match):
        href = match.group(1)
        other_attrs = match.group(2)
        if href.startswith(('http://', 'https://')):
            if 'target="_blank"' not in other_attrs:
                other_attrs += ' target="_blank"'
            if 'rel="noopener noreferrer"' not in other_attrs:
                other_attrs += ' rel="noopener noreferrer"'
        return f'<a href="{href}"{other_attrs}>'

    return re.sub(link_pattern, replace_link, html_content)


def render(markdown_text):
    html_content = markdown.markdown(
        markdown_text,
        extensions=[
            "fenced_code",
            "codehilite",
        ],
        extension_configs={
            "codehilite": {
                "css_class": "codehilite",
                "use_pygments": True,
                "noclasses": False,
            }
        }
    )
    return process_external_links(html_content)


def apply_template(title, body_html, seo_image="", seo_description=""):
    return (TEMPL.replace("{{title}}", html.escape(title))
            .replace("{{content}}", body_html)
            .replace("{{year}}", str(datetime.now().year))
            .replace("{{site_name}}", SITE_NAME)
            .replace("{{nav}}", NAV_HTML)
            .replace("{{seo_image}}", seo_image)
            .replace("{{seo_description}}", seo_description)
            .replace("{{umami_website_id}}", UMAMI["website_id"]))


def build_post(md_path, is_page=False):
    raw = md_path.read_text(encoding="utf-8")

    frontmatter = {}
    if raw.startswith("---"):
        _, frontmatter_text, content = raw.split("---", 2)
        for line in frontmatter_text.strip().split("\n"):
            if ":" in line:
                key, value = line.split(":", 1)
                frontmatter[key.strip()] = value.strip().strip('"')
        raw = content.strip()

    h1, _, body = raw.partition("\n")
    title = h1.lstrip("# ").strip() or md_path.stem
    html_body = render(body)

    seo_image = frontmatter.get("seo_image", "/static/images/profile.png")
    seo_description = frontmatter.get("seo_description", "")

    if seo_image and not seo_image.startswith(('http://', 'https://')):
        seo_image = HOSTNAME + seo_image

    if is_page:
        content_html = f'<h1>{html.escape(title)}</h1>\n{html_body}'
    else:
        date_str = frontmatter.get("date", "-".join(md_path.stem.split("-", 3)[:3]))
        iso_date = _iso_date(date_str)
        read_time = _read_time(body)

        parts = []
        parts.append('<article>')
        parts.append(f'<div class="post-meta"><span>{iso_date}</span><span>{read_time}</span></div>')
        parts.append(f'<h1 class="post-title">{html.escape(title)}</h1>')
        if seo_description:
            parts.append(f'<p class="dek">{html.escape(seo_description)}</p>')
        parts.append(html_body)
        parts.append('</article>')
        content_html = "\n".join(parts)

    return title, apply_template(title, content_html, seo_image=seo_image, seo_description=seo_description)


def _bio_html():
    social_links = ""
    for key, s in BIO["social"].items():
        url = s["url"]
        if url.startswith(('http://', 'https://')):
            social_links += (
                f'<a href="{url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{s["icon"]}" alt="{key.capitalize()}"></a>'
            )
        else:
            social_links += (
                f'<a href="{url}">'
                f'<img src="{s["icon"]}" alt="{key.capitalize()}"></a>'
            )
    return (
        f'<div class="bio-inline">'
        f'<img src="{BIO["image"]}" alt="{BIO["name"]}">'
        f'<div class="body">'
        f'<p>{BIO["bio"]}</p>'
        f'<div class="social">{social_links}</div>'
        f'</div></div>'
    )


def main():
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir()

    static_dir = ROOT / "static"
    if static_dir.exists():
        shutil.copytree(static_dir, OUT / "static")

    html_dir = ROOT / "html"
    if html_dir.exists():
        for f in html_dir.glob("*.html"):
            shutil.copy(f, OUT / f.name)

    pages = sorted(PAGES.glob("*.md"))
    for md in pages:
        title, full_html = build_post(md, is_page=True)
        slug = md.stem
        (OUT / f"{slug}.html").write_text(full_html, encoding="utf-8")

    def post_date(md_path):
        parts = md_path.stem.split("-", 3)[:3]
        return datetime.strptime("-".join(parts), "%d-%m-%Y")

    posts = sorted(POSTS.glob("*.md"), key=post_date, reverse=True)
    posts_by_year = {}

    for md in posts:
        title, full_html = build_post(md)
        slug = md.stem.split("-", 3)[-1]
        fname = f"{slug}.html"
        (OUT / fname).write_text(full_html, encoding="utf-8")
        date_str = "-".join(md.stem.split("-", 3)[:3])
        iso_date = _iso_date(date_str)
        year = md.stem.split("-")[2]
        posts_by_year.setdefault(year, []).append(
            f'<li><a href="{fname}">{title}</a>'
            f'<time datetime="{iso_date}">{iso_date}</time></li>'
        )

    total_posts = sum(len(v) for v in posts_by_year.values())
    index_parts = []
    index_parts.append(_bio_html())
    index_parts.append(
        f'<h1 class="page-title">Writing <span class="count">{total_posts} posts</span></h1>'
    )
    for year in sorted(posts_by_year, reverse=True):
        index_parts.append(f'<section class="year-block"><h2>{year}</h2><ul class="posts">')
        index_parts.extend(posts_by_year[year])
        index_parts.append('</ul></section>')

    default_seo_image = HOSTNAME + "/static/images/profile.png"
    index_html = apply_template(SITE_NAME, "\n".join(index_parts), seo_image=default_seo_image)
    (OUT / "index.html").write_text(index_html, encoding="utf-8")

    # sitemap
    sitemap_urls = [{"loc": HOSTNAME + "/", "priority": "1.0"}]
    for md in pages:
        sitemap_urls.append({"loc": f"{HOSTNAME}/{md.stem}.html", "priority": "0.8"})
    for md in posts:
        slug = md.stem.split("-", 3)[-1]
        parts = md.stem.split("-", 3)[:3]
        lastmod = f"{parts[2]}-{parts[1]}-{parts[0]}"
        sitemap_urls.append({"loc": f"{HOSTNAME}/{slug}.html", "lastmod": lastmod, "priority": "0.6"})

    sitemap_xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap_xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for entry in sitemap_urls:
        sitemap_xml += "  <url>\n"
        sitemap_xml += f"    <loc>{entry['loc']}</loc>\n"
        if "lastmod" in entry:
            sitemap_xml += f"    <lastmod>{entry['lastmod']}</lastmod>\n"
        sitemap_xml += f"    <priority>{entry['priority']}</priority>\n"
        sitemap_xml += "  </url>\n"
    sitemap_xml += "</urlset>\n"
    (OUT / "sitemap.xml").write_text(sitemap_xml, encoding="utf-8")

    # atom feed
    feed_xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    feed_xml += '<feed xmlns="http://www.w3.org/2005/Atom">\n'
    feed_xml += f"  <title>{html.escape(SITE_NAME)}</title>\n"
    feed_xml += f'  <link href="{HOSTNAME}/" />\n'
    feed_xml += f'  <link href="{HOSTNAME}/feed.xml" rel="self" />\n'
    feed_xml += f"  <id>{HOSTNAME}/</id>\n"
    if posts:
        newest_parts = posts[0].stem.split("-", 3)[:3]
        feed_xml += f"  <updated>{newest_parts[2]}-{newest_parts[1]}-{newest_parts[0]}T00:00:00Z</updated>\n"
    feed_xml += f"  <author><name>{html.escape(BIO['name'])}</name></author>\n"
    for md in posts:
        raw = md.read_text(encoding="utf-8")
        frontmatter = {}
        if raw.startswith("---"):
            _, fm_text, content = raw.split("---", 2)
            for line in fm_text.strip().split("\n"):
                if ":" in line:
                    key, value = line.split(":", 1)
                    frontmatter[key.strip()] = value.strip().strip('"')
            raw = content.strip()
        h1, _, body = raw.partition("\n")
        title = h1.lstrip("# ").strip() or md.stem
        slug = md.stem.split("-", 3)[-1]
        parts = md.stem.split("-", 3)[:3]
        date_iso = f"{parts[2]}-{parts[1]}-{parts[0]}T00:00:00Z"
        url = f"{HOSTNAME}/{slug}.html"
        summary = frontmatter.get("seo_description", "")
        feed_xml += "  <entry>\n"
        feed_xml += f"    <title>{html.escape(title)}</title>\n"
        feed_xml += f'    <link href="{url}" />\n'
        feed_xml += f"    <id>{url}</id>\n"
        feed_xml += f"    <updated>{date_iso}</updated>\n"
        if summary:
            feed_xml += f"    <summary>{html.escape(summary)}</summary>\n"
        feed_xml += "  </entry>\n"
    feed_xml += "</feed>\n"
    (OUT / "feed.xml").write_text(feed_xml, encoding="utf-8")

    # robots.txt
    (OUT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {HOSTNAME}/sitemap.xml\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
