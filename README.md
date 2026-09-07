A small Python static site generator for [emilesilvis.com](https://emilesilvis.com).

Use Python 3.12 (also declared in `.python-version`). Build dependencies are pinned:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python build.py
python -m http.server 8000 --directory out
```

Open http://localhost:8000. Once dependencies are installed, building needs no
network access or secrets. `out/` is disposable generated output. Original images
stay in `static/images/`; the build prepares lossless responsive WebP copies and
caches them in `.cache/images/`. Unlinked images open the original at full resolution when clicked; existing image links keep their destinations. The cache can be removed and rebuilt.

Author posts as `posts/DD-MM-YYYY-slug.md` and pages as `pages/slug.md`. Begin with
optional YAML frontmatter, then one `# Visible heading`. Supported metadata:

```yaml
---
title: 'Optional search/feed title'
seo_description: 'A concise description of this page.'
seo_image: '/static/images/example.png'
date: 2026-09-07
updated: 2026-09-07
series: 'Optional series name'
series_order: 1
---
```

The heading supplies the default title. The filename supplies a post's default
publication date; `date` overrides it. `updated` defaults to publication and must
not precede it. Set both series fields together. Descriptions fall back to an
excerpt. HTML attributes and feed XML are escaped by the generator. Duplicate
output paths and invalid content fail before the previous output is deleted.

`public_pages.json` declares descriptions and canonical paths for every standalone
HTML page in `html/` and `apps/`. Add an entry when importing a new page; the build
rejects undeclared HTML. Non-alias pages join the sitemap. Link public projects from
`pages/projects.md`. The Zachlike guide's old `guide.html` URL redirects to the
canonical directory URL, preserving section links. Wolf Tone and its archived
builds have been removed; previous versions remain in git history.

Lily uses `preserve_export: true` in the manifest: its imported static release
is copied byte for byte, including its JavaScript-rendered HTML shell. Its canonical
URL joins the sitemap without injecting metadata or changing release asset URLs.
Generated-site checks verify its complete payload and local assets; browser smoke
checks cover the imported game separately from the site accessibility checks.

The EU jobs article's `{{eu_average_exposure}}` value is calculated from the same
bundled data as the chart. Dataset provenance and its known gaps are recorded in
`static/data/job_market_metadata.json`. App import notes are in `apps/README.md`.

To run all checks (Node 22 supplies the accessibility test dependency):

```sh
python -m pip install -r requirements-dev.txt
npm ci --ignore-scripts
python -m playwright install chromium
python -m unittest discover -s tests -v
python build.py
python check_site.py
python tests/browser_check.py
```

The browser check starts its own local server. It checks reflow, keyboard flows,
theme preferences, charts and puzzles, error recovery, and axe accessibility rules.
External requests are blocked or replaced with test fixtures; tests never report
presence or analytics to live services. Evidence is written to `artifacts/browser/`.
Set `CHROMIUM_EXECUTABLE` to use an existing Chromium installation if needed.
These automated Chromium checks complement visual review and assistive-technology
checks; they do not establish complete WCAG conformance.

Pull requests run the same checks without secrets. Only successful main-branch
builds can deploy to GitHub Pages. To require these checks before merging, select
`Site checks` in the repository's branch protection or ruleset settings.

Builds read Pangram results from the version-controlled
`data/pangram/results.json`; they never call the API, even when an API key is
present. A matching `Human` result adds a "Pangram result: Human" badge linking
to the public report. The link's tooltip includes the model version and scan
date. This reports a model classification, not proof of authorship.

Only posts with at least 50 words of extracted prose are eligible. Code and
embedded media are excluded. Short posts, unscanned posts, and posts whose prose
has changed are published without a badge, with a reason in the build log.
Pages are not scanned. Series navigation and other generated UI are excluded from the submitted prose. Use complete-sentence prose suitable for Pangram.

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

The footer's TownSquare widget loads when it approaches the viewport. A failed
load exposes a retry button and leaves the page readable. Analytics remains a
deferred script. Compatible pages share `static/js/theme.js`, which follows system
appearance until the visitor explicitly chooses a theme and works without storage.

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
