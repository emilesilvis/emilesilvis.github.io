These are checked-in static applications copied into the site by `build.py`.

| App | Version retained here | Upstream provenance |
| --- | --- | --- |
| Geomake | Edition `baca39e909561c5a`, seven puzzles | The original export did not record its source repository, commit, or build command. |
| How to design a Zachlike | 1.1.0, dated 2026-08-08 | Authored HTML is maintained here; no upstream repository or export command was recorded. |

When importing an update:

1. Record the source repository, exact commit, version, build command, and upstream validation command here when available.
2. Replace only that app's files. Keep shared styles/theme references and project navigation.
3. Update `public_pages.json` for added or removed HTML and `pages/projects.md` for changes to the public portfolio.
4. Run the README's generator, generated-site, and browser checks. Geomake checks exercise all seven bundled answer/hint/solution flows; the guide checks cover navigation and table access.
5. Review the generated pages on desktop and mobile before publishing.

`how-to-design-a-zachlike/index.html` is the canonical guide. `guide.html` is a
compatibility redirect. Keep its hash-preserving redirect when replacing exports.
Wolf Tone and all three archived exports were removed at the owner's request;
they can be recovered from git history.
