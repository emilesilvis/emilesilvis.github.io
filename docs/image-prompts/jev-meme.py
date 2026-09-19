"""Rebuild static/images/19-07-2026-jev/my-name-is-jev.png.

Two edits to the source still (docs/image-prompts/jev-meme-source.png):

1. The subtitle is repainted to read "My name is Jev." The background behind it
   is a smooth gradient, so the band is erased by interpolating between the
   clean rows above and below, then re-grained.
2. The TypeSafe AI logo sits on the left chest of the shirt, tinted and tilted
   with the body so it reads as embroidery rather than an overlay.

Run from the repo root: python3 docs/image-prompts/jev-meme.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
SOURCE = HERE / "jev-meme-source.png"
LOGO = HERE / "typesafe-logo.png"   # https://docs.typesafe.ai header logo (light-on-dark)
TARGET = ROOT / "static/images/19-07-2026-jev/my-name-is-jev.png"

# Tahoma Bold at 19.5px is the closest local match to the subtitle face; it beat
# Arial, Verdana, Trebuchet, Helvetica Neue and Avenir on mask overlap with the
# original lettering.
FONT = "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf"
SIZE, SS = 19.5, 4
ANCHOR = (129, 444)             # top-left of the original caption
BAND = (118, 443, 300, 474)     # the strip to repaint

# Wider than this and the logo climbs over the button placket.
LOGO_BOX = (178, 674, 205)      # x, y, width
LOGO_TINT = (232, 223, 216)     # warm off-white, matching the light on the plate


def repaint_background(image):
    """Erase the subtitle by interpolating the smooth background across the band."""
    a = np.array(image).astype(float)
    x0, y0, x1, y1 = BAND
    top = a[y0 - 3:y0, x0:x1].mean(axis=0)
    bottom = a[y1:y1 + 3, x0:x1].mean(axis=0)
    height = y1 - y0
    for i in range(height):
        t = (i + 1) / (height + 1)
        a[y0 + i, x0:x1] = top * (1 - t) + bottom * t

    # Match the grain of the surrounding plate, then soften the seam.
    grain = np.array(image).astype(float)[y0 - 14:y0 - 2, x0:x1]
    sigma = float((grain - grain.mean(axis=0)).std())
    a[y0:y1, x0:x1] += np.random.default_rng(7).normal(0, sigma, (height, x1 - x0, 3))

    out = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    patch = out.crop((x0, y0 - 2, x1, y1 + 2)).filter(ImageFilter.GaussianBlur(0.6))
    out.paste(patch, (x0, y0 - 2))
    return out


def draw_caption(image, text):
    """Redraw the subtitle on the original baseline, keeping its optical centre."""
    font = ImageFont.truetype(FONT, round(SIZE * SS))
    layer = Image.new("RGBA", (image.width * SS, image.height * SS), (0, 0, 0, 0))
    centre = ANCHOR[0] + font.getlength("My name is Jeff.") / SS / 2
    x = (centre - font.getlength(text) / SS / 2) * SS
    ImageDraw.Draw(layer).text(
        (x, ANCHOR[1] * SS), text, font=font, fill=(255, 255, 255, 255),
        stroke_width=round(1.15 * SS), stroke_fill=(0, 0, 0, 215),
    )
    out = image.convert("RGBA")
    out.alpha_composite(layer.resize(image.size, Image.LANCZOS))
    return out.convert("RGB")


def add_logo(image):
    """Sit the logo on the shirt: tinted to embroidery, tilted with the body."""
    logo = Image.open(LOGO).convert("RGBA")
    x, y, width = LOGO_BOX
    height = round(width * logo.height / logo.width)

    a = np.array(logo).astype(float)
    a[:, :, 0], a[:, :, 1], a[:, :, 2] = LOGO_TINT
    a[:, :, 3] *= 0.90
    logo = Image.fromarray(a.astype("uint8")).resize((width * SS, height * SS), Image.LANCZOS)
    logo = logo.rotate(-6, resample=Image.BICUBIC, expand=True)
    logo = logo.resize((logo.width // SS, logo.height // SS), Image.LANCZOS)
    logo = logo.filter(ImageFilter.GaussianBlur(0.35))

    out = image.convert("RGBA")
    out.alpha_composite(logo, (x, y))
    return out.convert("RGB")


source = Image.open(SOURCE).convert("RGB")
add_logo(draw_caption(repaint_background(source), "My name is Jev.")).save(TARGET)
print(f"wrote {TARGET.relative_to(ROOT)}")
