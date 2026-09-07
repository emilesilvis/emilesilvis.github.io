These are checked-in static applications copied into the site by `build.py`.

| App | Version retained here | Upstream provenance |
| --- | --- | --- |
| Geomake | Edition `7472b5f5c599085e`, fourteen puzzles | [emilesilvis/geomake](https://github.com/emilesilvis/geomake), commit `08028c1e09c04013b3f39a4431d21e5818a02de9`, seed 7; see [release PR #40](https://github.com/emilesilvis/emilesilvis.github.io/pull/40). Older help files remain for cached pages. |
| How to design a Zachlike | 1.1.0, dated 2026-08-08 | Authored HTML is maintained here; no upstream repository or export command was recorded. |
| Lily | English/Dutch static release, thirty gardens | Private Lily source, commit `1d3d394652b194c02841bfb703eff95343a17641`; archive checksum and repeatable build instructions are in [README.md](../README.md#lily). |

When importing an update:

1. Record the source repository, exact commit, version, build command, and upstream validation command here when available.
2. Replace only that app's files. Keep shared styles/theme references and project navigation on adapted pages. Lily is preserved byte for byte; update it in its source repository and import a new release.
3. Update `public_pages.json` for added or removed HTML and `pages/projects.md` for changes to the public portfolio.
4. Run the README's generator, generated-site, and browser checks. Geomake checks exercise all fourteen bundled answer/hint/solution flows; the guide checks cover navigation and table access.
5. Review the generated pages on desktop and mobile before publishing.

`how-to-design-a-zachlike/index.html` is the canonical guide. `guide.html` is a
compatibility redirect. Keep its hash-preserving redirect when replacing exports.
Wolf Tone and all three archived exports were removed at the owner's request;
they can be recovered from git history.
