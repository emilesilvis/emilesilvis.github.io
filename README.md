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

Pangram analysis is an explicit, separate action. The normal build only reads
`data/pangram/results.json`, whose entries are keyed by prose and model. It shows a
badge only when the matching saved result is classified `Human`. Changed or new
prose has no badge until analyzed; old results cannot certify changed text. Series
navigation and other generated UI are excluded from the submitted prose.

Inspect missing results without calling the API:

```sh
python analyze_posts.py
```

To submit missing prose, set `PANGRAM_API_KEY` in your shell, then explicitly run:

```sh
python analyze_posts.py --submit
# Or select particular post files:
python analyze_posts.py --submit posts/DD-MM-YYYY-slug.md
```

Submission uses Pangram API credits and creates a public analysis report. Review
and commit the resulting metadata file so successful results survive fresh
checkouts and CI cache eviction. The saved file contains result metadata and
content hashes, not the API key or post text. No analysis request runs in CI.

The footer's TownSquare widget loads when it approaches the viewport. A failed
load exposes a retry button and leaves the page readable. Analytics remains a
deferred script. Compatible pages share `static/js/theme.js`, which follows system
appearance until the visitor explicitly chooses a theme and works without storage.
