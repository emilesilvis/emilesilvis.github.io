These are checked-in static applications copied into the site by `build.py`.

| App | Version retained here | Upstream provenance |
| --- | --- | --- |
| Geomake | Edition `618a980d4497d066`, twenty-one puzzles with a public progress leaderboard and private recovery codes | [emilesilvis/geomake](https://github.com/emilesilvis/geomake), commit `73a1d70ed3fad2106cf0ffcc88351892a0639777`, seed 7. Answers are checked by its Cloudflare Worker; static answer and solution files have been removed. |
| How to design a Zachlike | 1.1.0, dated 2026-08-08 | Authored HTML is maintained here; no upstream repository or export command was recorded. |
| Lily | English/Dutch static release, thirty gardens | Private Lily source, commit `1d3d394652b194c02841bfb703eff95343a17641`; archive checksum and repeatable build instructions are in [README.md](../README.md#lily). |

When importing an update:

1. Record the source repository, exact commit, version, build command, and upstream validation command here when available.
2. Replace only that app's files. Keep shared styles/theme references and project navigation on adapted pages. Lily is preserved byte for byte; update it in its source repository and import a new release.
3. Update `public_pages.json` for added or removed HTML and `pages/projects.md` for changes to the public portfolio.
4. Run the README's generator, generated-site, and browser checks. Geomake checks exercise all twenty-one puzzles with a synthetic API fixture, including registration, gates, hints, leaderboard updates and persistence; no test contacts its live backend. The guide checks cover navigation and table access.
5. Review the generated pages on desktop and mobile before publishing.

Rebuild Geomake from its source repository with
`.venv/bin/python -m geomake pilot --seed 7 --out out/daily-pilot-v3` (an empty output
folder), then `python3 reader/build.py --edition out/daily-pilot-v3/editor.json --api-url https://geomake-leaderboard.crayfish.workers.dev`.
Use the same manifest for its backend; build and deployment instructions are in
the upstream `backend/README.md`. Validate upstream with
`node --test reader/tests/*.test.js backend/tests/*.test.js` and
`.venv/bin/python -m pytest tests/test_reader.py`.
Replace the generated reader completely so old `check.json` and `solution.json`
files are removed. Preserve this site's adaptation: use `/static/js/theme.js`
instead of the generated `theme.js`, retain the Projects/theme navigation before
`main`, and append the existing `.app-nav` styles. Do not import `.geomake-build`
or the unused `theme.js`. The normal site build adds metadata and versions assets.

The first fourteen questions are unchanged. Their published browser progress can
be recovered after saved answers pass the server checks. Names and solved counts
are public; a private recovery code restores access to each player's saved progress across browsers.
Login controls are below the puzzle lists and hidden while logged in; recovery codes
and logout remain available at the bottom.
The leaderboard uses solved count, with equal ranks for ties, and no speed score.

`how-to-design-a-zachlike/index.html` is the canonical guide. `guide.html` is a
compatibility redirect. Keep its hash-preserving redirect when replacing exports.
Wolf Tone and all three archived exports were removed at the owner's request;
they can be recovered from git history.
