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

The full game is served at <https://emilesilvis.com/lily/> in English and Dutch
without sign-in. It initially follows the browser's supported language preference;
the visible English / Nederlands picker preserves progress and saves the choice.
`apps/lily/` contains the unmodified static release from the private Lily source
repository; `build.py` copies it directly to `out/lily/`.

- Source commit: `1d3d394652b194c02841bfb703eff95343a17641`.
- Release archive: `lily.tar.gz`, SHA-256
  `ef3d1621e0ac0d29093e2c142770c79c3e79c1a5b008e5266eaffa3328c3bc38`.
- Payload: nine files, 1,985,132 bytes, including both languages, local artwork/fonts,
  and font licenses.

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
Confirm `apps/lily/` and `out/lily/` match every manifest file and digest, then smoke
test `/lily` and `/lily/` in fresh English and Dutch browser contexts, including
language switching during play, reload persistence, asset loading, and phone controls.
Keep source, manifests, build reports, credentials, and hosting configuration
outside `apps/lily/`; its contents are published verbatim. Do not edit generated
bundles: make changes in the private source repository and rebuild instead.
