Minimalist static site generator.

To build:
`python build.py`

Builds read Pangram results from the version-controlled
`data/pangram/results.json`; they never call the API, even when an API key is
present. A matching `Human` result adds a "Pangram result: Human" badge linking
to the public report. The link's tooltip includes the model version and scan
date. This reports a model classification, not proof of authorship.

Only posts with at least 50 words of extracted prose are eligible. Code and
embedded media are excluded. Short posts, unscanned posts, and posts whose prose
has changed are published without a badge, with a reason in the build log.
Pages are not scanned. Use complete-sentence prose suitable for Pangram.

Preview scans without an API key or any charges:

`python scan_pangram.py --dry-run`

To scan, set `PANGRAM_API_KEY` in your environment and run
`python scan_pangram.py`. Pass individual post paths to limit the scan, for
example `python scan_pangram.py posts/03-04-2026-sycophantic-llms-and-delusional-spiralling.md`.
New scans explicitly use `pangram-4`. Existing matching results for that model
are reused; `--refresh` deliberately requests new results and uses credits.
Commit the updated results JSON alongside your post changes. It contains compact
metadata, content hashes, and any pending task IDs, never the API key or post text.

The existing 22 reports from September 3, 2026 were recovered from their public
reports and retain their actual Pangram 3.3.2 version and timestamps. Builds use
the newest recorded result matching the prose, so these reports remain useful
until an explicit Pangram 4 scan succeeds. Short-input reports are retained as
history but never render badges. Selecting another model for scans does not
relabel historical results.

Transient polling failures retry within a five-minute deadline. An interrupted
scan saves its task ID before polling; rerunning the command with the same
results file resumes that task. Completed results are saved after each post.
Task creation is not automatically retried after an ambiguous failure because
that could create duplicate charges. Malformed results files raise an error
instead of silently replacing paid results.

Alternatively, run the **Scan posts with Pangram 4** workflow manually using the
repository's `PANGRAM_API_KEY` Actions secret. Download its `pangram-results`
artifact, replace `data/pangram/results.json`, and commit it before another scan
run. This also applies after a failed run: the artifact preserves completed
results and pending tasks. Artifacts are temporary transport; the committed JSON
is the durable record. The Pages deployment workflow only reads that record.

`--results` selects another file for scans; `PANGRAM_RESULTS_PATH` selects another
file for builds. The old `PANGRAM_CACHE_PATH` and `PANGRAM_REQUIRED` settings are
no longer used.

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
