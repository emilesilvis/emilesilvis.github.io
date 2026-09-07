"""Prepare responsive copies of local images; preserve the original download URLs."""

from hashlib import sha256
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

from PIL import Image, ImageOps


class Images:
    def __init__(self, root: Path, out: Path):
        self.root = root
        self.out = out
        self.prepared = {}

    def attributes(self, url: str) -> dict:
        path = urlsplit(url)
        if path.netloc or not path.path.startswith("/static/images/"):
            return {}
        source = self.root / path.path.lstrip("/")
        if not source.is_file():
            raise ValueError(f"Image does not exist: {url}")
        if url in self.prepared:
            return self.prepared[url]
        if source.suffix.lower() == ".svg":
            svg = ET.fromstring(source.read_text())
            viewbox = svg.get("viewBox", "").split()
            width, height = svg.get("width"), svg.get("height")
            if not width or not height or not re.fullmatch(r"\d+(\.\d+)?", width) or not re.fullmatch(r"\d+(\.\d+)?", height):
                if len(viewbox) != 4:
                    raise ValueError(f"{source}: SVG needs dimensions or a viewBox")
                width, height = viewbox[2:4]
            result = {"width": str(round(float(width))), "height": str(round(float(height)))}
        else:
            with Image.open(source) as original:
                image = ImageOps.exif_transpose(original)
                width, height = image.size
                if getattr(original, "is_animated", False):
                    return {"width": str(width), "height": str(height)}
                fingerprint = sha256(b"responsive-webp-v1\0" + source.read_bytes()).hexdigest()[:16]
                variants = []
                for size in sorted({min(width, size) for size in (480, 800, 1200, 1600)}):
                    filename = f"{fingerprint}-{size}.webp"
                    cached = self.root / ".cache" / "images" / filename
                    if not cached.exists():
                        cached.parent.mkdir(parents=True, exist_ok=True)
                        variant = image.resize((size, round(height * size / width)), Image.Resampling.LANCZOS)
                        variant.save(cached, "WEBP", lossless=True, method=6)
                    destination = self.out / "static" / "generated" / filename
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(cached, destination)
                    variants.append((size, f"/static/generated/{filename}"))
                default = next((url for size, url in variants if size >= 800), variants[-1][1])
                result = {
                    "src": default, "width": str(width), "height": str(height),
                    "srcset": ", ".join(f"{url} {size}w" for size, url in variants),
                    "sizes": "(max-width: 800px) calc(100vw - 40px), 760px",
                }
        self.prepared[url] = result
        return result
