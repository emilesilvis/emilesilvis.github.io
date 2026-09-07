Minimalist static site generator.

To build:
`python build.py`

Posts are checked by Pangram at build time. When Pangram classifies a post as
`Human`, the generated page includes a "Verified human writing" badge linking
to Pangram's public analysis. Set the API key in the environment; it is never
included in the generated site:

`export PANGRAM_API_KEY=<your API key>`

Results are cached in `.cache/pangram`, keyed by the post content, so unchanged
posts are not charged or submitted again. The GitHub Pages workflow expects the
same key in the `PANGRAM_API_KEY` Actions secret.

To serve:
`npx serve out`

Check meta tags:
`ngrok http 3000`
`https://www.opengraph.xyz/`

## Lily

The full game is served at <https://emilesilvis.com/lily/> without sign-in.
`apps/lily/` contains the unmodified static release from the private Lily source
repository; `build.py` copies it directly to `out/lily/`.

- Source commit: `e68cc1b83cc84fb39775fd88fa06819e17f07e03`.
- Release archive: `lily.tar.gz`, SHA-256
  `6aa3e24e29044c8a6eb79508edaa523c16cdf2f918f0f3a7a4a2c160acbe4506`.
- Payload: nine files, including the game, local artwork/fonts, and font licenses.

To reproduce this release, use a clean checkout of the private Lily repository
at the source commit above, with Node 22.13 or later:

```sh
npm ci
npm run build:static
```

Then, from this website checkout, replace the app with that build output and
build the website:

```sh
rsync -a --delete /path/to/lily/dist/static/ apps/lily/
python build.py
```

For a new release, verify its manifest/checksums and update the provenance above.
Keep source, manifests, build reports, credentials, and hosting configuration
outside `apps/lily/`; its contents are published verbatim. Do not edit generated
bundles: make changes in the private source repository and rebuild instead.
