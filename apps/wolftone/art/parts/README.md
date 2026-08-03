# Runtime part art

These transparent 512×512 WebP plates are optimized runtime copies of the
approved concepts in `design/part-concepts/openai-codex-gpt-5/images/`.
Junction's retained plate is design provenance only; the playable Junction is
live SVG track infrastructure and is intentionally absent from the runtime
selection manifest.

Rebuild a runtime plate with the established conversion pipeline:

```sh
magick source.png -resize 512x512 resized.png
cwebp -quiet -q 88 resized.png -o web/game/art/parts/kind-concept.webp
```

`web/game/part-art.mjs` is the canonical selection manifest. Keep the concept
letter in each filename so the choice remains traceable to the gallery.

The full canvas maps to the part's declared footprint: 2×2 cells for ordinary
parts and 1×1 for Crossing. Interactive sockets and configuration text remain
live SVG overlays owned by the game. Junction keeps its 2×2 routing topology
but renders entirely from the shared copper track language.
