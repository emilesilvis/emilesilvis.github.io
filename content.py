"""Parse authored content once for pages, archives, feeds, and analysis."""

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
import re
from textwrap import shorten

import markdown
import yaml

from pangram_badge import prose_from_html


@dataclass(frozen=True)
class Document:
    source: Path
    title: str
    heading: str
    body: str
    description: str
    image: str
    url: str
    published: date | None = None
    updated: date | None = None
    series: str = ""
    series_order: int = 0


def parse_date(value, source: Path) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    for format in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(value), format).date()
        except ValueError:
            pass
    raise ValueError(f"{source}: invalid date {value!r}; use YYYY-MM-DD")


def read_document(path: Path, *, is_page=False, values=None) -> Document:
    raw = path.read_text(encoding="utf-8")
    metadata = {}
    if raw.startswith("---"):
        match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", raw, re.S)
        if not match:
            raise ValueError(f"{path}: frontmatter needs a closing --- line")
        try:
            metadata = yaml.safe_load(match[1]) or {}
        except yaml.YAMLError as error:
            raise ValueError(f"{path}: invalid YAML frontmatter: {error}") from error
        if not isinstance(metadata, dict):
            raise ValueError(f"{path}: frontmatter must be a mapping")
        raw = raw[match.end():]
    heading, _, body = raw.strip().partition("\n")
    if not heading.startswith("# ") or not heading[2:].strip():
        raise ValueError(f"{path}: start the content with a # heading")
    heading = heading[2:].strip()
    for key, value in (values or {}).items():
        body = body.replace("{{" + key + "}}", str(value))

    def text(key, default=""):
        value = metadata.get(key, default)
        if not isinstance(value, str) or (key == "title" and not value.strip()):
            raise ValueError(f"{path}: {key} must be text")
        return value.strip()

    published = None
    slug = path.stem
    if not is_page:
        match = re.fullmatch(r"(\d{2}-\d{2}-\d{4})-(.+)", path.stem)
        if not match:
            raise ValueError(f"{path}: post filenames must be DD-MM-YYYY-slug.md")
        published = parse_date(metadata.get("date", match[1]), path)
        slug = match[2]
    updated = parse_date(metadata["updated"], path) if "updated" in metadata else published
    if published and updated < published:
        raise ValueError(f"{path}: updated cannot precede publication")
    series_order = metadata.get("series_order", 0)
    if type(series_order) is not int or series_order < 0:
        raise ValueError(f"{path}: series_order must be a non-negative integer")
    series = text("series")
    if bool(series) != bool(series_order):
        raise ValueError(f"{path}: series and series_order must be set together")
    description = text("seo_description") or shorten(
        prose_from_html(markdown.markdown(body)), width=160, placeholder="…"
    ) or heading
    return Document(
        source=path, title=text("title", heading), heading=heading, body=body,
        description=description, image=text("seo_image"), url=f"/{slug}.html",
        published=published, updated=updated, series=series, series_order=series_order,
    )
