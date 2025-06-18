#!/usr/bin/env python3
from config import SITE_NAME, BIO, NAVIGATION, HOSTNAME
from pathlib import Path
from datetime import datetime
import shutil, re, html
import markdown  # only external dependency


ROOT = Path(__file__).parent
POSTS = ROOT / "posts"
PAGES = ROOT / "pages"
OUT = ROOT / "out"
TEMPL = (ROOT / "static" / "templates" / "template.html").read_text(encoding="utf-8")


def render(markdown_text):
    """convert md → html using python-markdown"""
    return markdown.markdown(
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


def apply_template(title, body_html, nav="", seo_image="", seo_description="", date="", main_heading=""):
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
            .replace("{{nav}}", nav)
            .replace("{{seo_image}}", seo_image)
            .replace("{{seo_description}}", seo_description)
            .replace("{{date}}", date)
            .replace("{{main_heading}}", main_heading))


def build_post(md_path):
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
    
    # Get date from frontmatter or filename
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

    # collect posts
    posts = sorted(POSTS.glob("*.md"), reverse=True)
    index_items = []

    # Process pages
    pages = sorted(PAGES.glob("*.md"))
    nav_items = []
    for md in pages:
        title, full_html = build_post(md)
        slug = md.stem
        fname = f"{slug}.html"
        (OUT / fname).write_text(full_html, encoding="utf-8")
        # Only add to navigation if it's in the NAVIGATION config
        for nav_item in NAVIGATION:
            if nav_item["path"].lstrip("/") == fname.replace(".html", ""):
                nav_items.append(f'<li><a href="{fname}">{nav_item["title"]}</a></li>')

    # Process posts
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
    index_content.append('<h2 id="posts">Posts</h2>')
    index_content.append("<ul>")
    index_content.extend(index_items)
    index_content.append("</ul>")
    index_content.append('</div>')

    # Create navigation HTML
    nav_html = f"<ul>{''.join(nav_items)}</ul>"

    # Default SEO image for index page
    default_seo_image = HOSTNAME + "/static/images/profile.png"
    
    index_html = apply_template(SITE_NAME, "\n".join(index_content), nav=nav_html, main_heading="", seo_image=default_seo_image)
    (OUT / "index.html").write_text(index_html, encoding="utf-8")


if __name__ == "__main__":
    main()
