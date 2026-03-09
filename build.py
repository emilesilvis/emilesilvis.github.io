#!/usr/bin/env python3
from config import SITE_NAME, BIO, HOSTNAME, UMAMI, NAVIGATION
from pathlib import Path
from datetime import datetime
import shutil, re, html
import markdown  # only external dependency


ROOT = Path(__file__).parent
POSTS = ROOT / "posts"
PAGES = ROOT / "pages"
OUT = ROOT / "out"
TEMPL = (ROOT / "static" / "templates" / "template.html").read_text(encoding="utf-8")
def _nav_href(path):
    path = path.strip("/")
    return "/" if not path else f"/{path}.html"

NAV_HTML = "<ul>" + "".join(
    f'<li><a href="{_nav_href(n["path"])}">{n["title"]}</a></li>'
    for n in NAVIGATION
) + "</ul>" if NAVIGATION else ""


def process_external_links(html_content):
    """Add target="_blank" and rel="noopener noreferrer" to external links"""
    # Pattern to match <a href="..."> tags
    link_pattern = r'<a\s+href="([^"]+)"([^>]*)>'
    
    def replace_link(match):
        href = match.group(1)
        other_attrs = match.group(2)
        
        # Check if it's an external link (starts with http:// or https://)
        if href.startswith(('http://', 'https://')):
            # Add target="_blank" and rel="noopener noreferrer" if not already present
            if 'target="_blank"' not in other_attrs:
                other_attrs += ' target="_blank"'
            if 'rel="noopener noreferrer"' not in other_attrs:
                other_attrs += ' rel="noopener noreferrer"'
        
        return f'<a href="{href}"{other_attrs}>'
    
    return re.sub(link_pattern, replace_link, html_content)


def render(markdown_text):
    """convert md → html using python-markdown"""
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
    
    # Process external links to add target="_blank"
    return process_external_links(html_content)


def apply_template(title, body_html, seo_image="", seo_description="", date="", main_heading=""):
    return (TEMPL.replace("{{title}}", html.escape(title))
            .replace("{{content}}", body_html)
            .replace("{{year}}", str(datetime.now().year))
            .replace("{{site_name}}", SITE_NAME)
            .replace("{{bio.name}}", BIO["name"])
            .replace("{{bio.bio}}", BIO["bio"])
            .replace("{{bio.image}}", BIO["image"])
            .replace("{{bio.social.x.url}}", BIO["social"]["x"]["url"])
            .replace("{{bio.social.x.icon}}", BIO["social"]["x"]["icon"])
            .replace("{{bio.social.linkedin.url}}", BIO["social"]["linkedin"]["url"])
            .replace("{{bio.social.linkedin.icon}}", BIO["social"]["linkedin"]["icon"])
            .replace("{{bio.social.github.url}}", BIO["social"]["github"]["url"])
            .replace("{{bio.social.github.icon}}", BIO["social"]["github"]["icon"])
            .replace("{{nav}}", NAV_HTML)
            .replace("{{seo_image}}", seo_image)
            .replace("{{seo_description}}", seo_description)
            .replace("{{date}}", date)
            .replace("{{main_heading}}", main_heading)
            .replace("{{umami_website_id}}", UMAMI["website_id"]))


def build_post(md_path, is_page=False):
    raw = md_path.read_text(encoding="utf-8")
    
    # Parse frontmatter if it exists
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
    
    # Get SEO data from frontmatter or use defaults
    seo_image = frontmatter.get("seo_image", "/static/images/profile.png")
    seo_description = frontmatter.get("seo_description", "")
    
    # Make SEO image URL absolute
    if seo_image and not seo_image.startswith(('http://', 'https://')):
        seo_image = HOSTNAME + seo_image
    
    if is_page:
        main_heading = f'<h1>{html.escape(title)}</h1>'
        date = ""
    else:
        date = frontmatter.get("date", "-".join(md_path.stem.split("-", 3)[:3]))
        main_heading = f'<h1>{html.escape(title)}</h1>\n<time datetime="{date}" class="post-date">{date}</time>'
    
    return title, apply_template(title, html_body, seo_image=seo_image, seo_description=seo_description, date=date, main_heading=main_heading)


def main():
    # clean & recreate output dir
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir()

    # copy static directory
    static_dir = ROOT / "static"
    if static_dir.exists():
        shutil.copytree(static_dir, OUT / "static")

    # copy standalone HTML pages to output root
    html_dir = ROOT / "html"
    if html_dir.exists():
        for f in html_dir.glob("*.html"):
            shutil.copy(f, OUT / f.name)

    # Process pages
    pages = sorted(PAGES.glob("*.md"))
    for md in pages:
        title, full_html = build_post(md, is_page=True)
        slug = md.stem
        fname = f"{slug}.html"
        (OUT / fname).write_text(full_html, encoding="utf-8")

    # collect posts, sorted by date (newest first)
    def post_date(md_path):
        parts = md_path.stem.split("-", 3)[:3]
        return datetime.strptime("-".join(parts), "%d-%m-%Y")

    posts = sorted(POSTS.glob("*.md"), key=post_date, reverse=True)
    index_items = []

    for md in posts:
        title, full_html = build_post(md)
        slug = md.stem.split("-", 3)[-1]  # after the date
        fname = f"{slug}.html"
        (OUT / fname).write_text(full_html, encoding="utf-8")
        date = "-".join(md.stem.split("-", 3)[:3])
        index_items.append(
            f"<li><a href='{fname}'>{title}</a> <small>{date}</small></li>")

    # Create index with posts
    index_content = []
    
    # Add posts section
    index_content.append('<div class="main-content">')
    index_content.append('<h1>Posts</h1>')
    index_content.append("<ul>")
    index_content.extend(index_items)
    index_content.append("</ul>")
    index_content.append('</div>')

    # Default SEO image for index page
    default_seo_image = HOSTNAME + "/static/images/profile.png"
    
    index_html = apply_template(SITE_NAME, "\n".join(index_content), main_heading="", seo_image=default_seo_image)
    (OUT / "index.html").write_text(index_html, encoding="utf-8")


if __name__ == "__main__":
    main()
