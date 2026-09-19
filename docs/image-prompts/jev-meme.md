# "My name is Jev" meme

`static/images/19-07-2026-jev/my-name-is-jev.png`

A still from *22 Jump Street*, originally subtitled "My name is Jeff." Two edits:

1. The subtitle is repainted to read "My name is Jev." The background behind it
   is a smooth gradient, so the band is erased by interpolating between the
   clean rows above and below, then re-grained. The lettering is redrawn in
   Tahoma Bold at 19.5px, which matched the original face better than Arial,
   Verdana, Trebuchet, Helvetica Neue or Avenir.
2. The TypeSafe AI logo sits on the left chest of the shirt, tinted to a warm
   off-white and tilted with the body so it reads as embroidery rather than an
   overlay. It is sized to stop short of the button placket.

Source still: `jev-meme-source.png`.
Logo: `typesafe-logo.png`, the header logo from <https://docs.typesafe.ai>.

Rebuild with:

```sh
python3 docs/image-prompts/jev-meme.py
```
