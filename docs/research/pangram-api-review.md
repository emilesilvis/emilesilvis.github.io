# Pangram integration review

Research date: 2026-09-07. Reviewed `pangram_badge.py` and `README.md` against first-party documentation and the official SDK. No existing research-note convention was found, so this note lives in `docs/research/`. No detection requests were submitted and no account settings were changed.

Implementation follow-up: the assessment below describes checkout `ed88348`
before the changes. The [README](../../README.md) now documents offline builds,
durable results, explicit Pangram 4 scans, eligibility, revised wording, and
resumable polling. The 22 initial records in `data/pangram/results.json` were
recovered by reading the public reports linked in the September 6 build log.
The dashboard's public history response supplied the actual fractions, version,
and timestamp. Report text matched the extracted post prose after accounting for
Pangram removing the emoji presentation selector U+FE0F in one short post.
Fingerprints use the original extracted prose and original `default` selector;
timestamps were converted to UTC. No scores or versions were inferred and no
new analyses were submitted. Historical records remain Pangram 3.3.2 until an
explicit Pangram 4 scan completes.

The current async API integration is compatible with Pangram's documented contract. Changes are warranted: preserve paid results durably, select Pangram 4 deliberately before the September 30 transition ends, apply input eligibility, and make the badge describe the classification. Add bounded polling retries as a reliability improvement. The existing endpoint, compact result representation, and prose extraction remain useful.

## Local evidence and recommended scope

The inspected checkout is `ed88348` and contains 22 posts. All nine existing tests passed with `python3 -m unittest discover -s tests -v`. A complete offline build using a temporary output directory and a service without an API client also passed, producing 33 root HTML pages plus the index, sitemap, Atom feed, and robots file. These checks establish current local behavior; they do not exercise a live Pangram 4 scan. The latest inspected [Pages deployment, September 7](https://github.com/emilesilvis/emilesilvis.github.io/actions/runs/34090789711), succeeded. The [September 6 run at the checkout commit](https://github.com/emilesilvis/emilesilvis.github.io/actions/runs/34058674327) restored an exact cache hit and reported 17 Human and 5 Mixed results. Those labels are observations, not an independent authorship assessment.

**Paid results have already been regenerated for unchanged posts.** The [August 12 build](https://github.com/emilesilvis/emilesilvis.github.io/actions/runs/31568918452) and [September 3 profile-picture build](https://github.com/emilesilvis/emilesilvis.github.io/actions/runs/33792540996) both missed the identical key `pangram-default-v1-Linux-dc3f6e502927f82d1a577cb0a54f18612f86d6b3b64e16628c968c0caecea41b`. Every one of the 22 report URLs changed. A diff between those commits showed no changes in `posts/`, `pangram_badge.py`, `build.py`, or the deployment workflow. This confirms repeat analysis; account billing was not inspected. GitHub removes caches unused for more than seven days, which is consistent with the intervening inactivity, though the deletion cause was not directly audited. Its combined cache action saves new entries only when the job succeeds, so partial scan progress can also disappear after a later build failure. [GitHub cache rules](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).

Recommendation: make the compact results a durable record, such as a version-controlled JSON file updated by an explicit scan command. Normal deployment can then render matching recorded results. Preserve content fingerprints so edited prose cannot inherit an old badge. For this small static site, that is a simpler starting point than adding a storage service. Merely changing the Actions cache key or retention strategy does not establish the [README's promise](../../README.md) that unchanged posts will not be submitted again. See the [workflow](../../.github/workflows/deploy.yml) and [cache service](../../pangram_badge.py).

**The model transition needs an intentional refresh.** An offline reproduction cached a synthetic `default` result with version `3.3.2`, then supplied a replacement client that would return `4.0`. The service returned the old Human result with zero calls to the replacement client. Set the workflow and local default to `pangram-4` together and update the Actions cache namespace if it remains. This changes the content fingerprints and will request fresh results for eligible posts; do that after durable storage is in place. Preserve returned versions and analysis dates. There is no need to implement the new window-label or humanizer fields just to keep the existing badge behavior.

**Three current scan inputs are below the documented minimum.** Counts below come from the exact prose passed by `build_post`, using whitespace-delimited words, rather than raw Markdown:

| Post | Words |
| --- | ---: |
| A curated list of systems thinking resources | 45 |
| How I made this website | 35 |
| I did a workshop on systems thinking | 35 |

The resource list also consists mostly of titles and URLs. Apply eligibility before accepting either cached or new results, so old short-input badges do not bypass the policy. Log an ineligible reason and omit the badge without treating it as an API outage. Historical runs successfully returned Human for these texts; the recommendation concerns supported use, not a claim that the API currently rejects them.

**A transient polling error aborts the build.** A mocked HTTP exchange returned a task ID from POST, then `429` from the first GET. The client immediately raised `PangramError` after two HTTP attempts; it made no retry and retained no task ID for a later run. With the current [build integration](../../build.py), that exception prevents deployment. Retry recoverable GET failures within a total deadline and consider saving in-progress task IDs. Changing `PANGRAM_REQUIRED` to false alone would not solve this: it only permits a missing client/cache, and API errors still propagate.

Suggested follow-up checks for implementation work: a durable result survives a fresh checkout without a paid call; changed prose requires a matching new result; unsupported input omits a badge even when cached; model selection changes cause an intentional refresh; and transient polling failures recover without another task submission.

## Confirmed API contract

- **Endpoint and authentication:** use `https://text.external-api.pangram.com`, `POST /task`, then authenticated `GET /task/{task_id}` with `x-api-key`. Terminal stages are `STAGE_SUCCESS` and `STAGE_FAILED`. This matches the implementation. The synchronous `https://text.api.pangram.com/v3` endpoint is now legacy. [API overview](https://docs.pangram.com/api-reference/introduction), [deprecated endpoints](https://docs.pangram.com/api-reference/deprecated-endpoints).
- **Request and result:** explicit `model` and `public_dashboard_link: true` are supported. Completion returns the existing `version`, `headline`, `prediction_short`, three fraction fields, and a `dashboard_link` when requested. Pangram 4 retains the top-level `AI`, `Human`, and `Mixed` classifications. Its new humanizer fields and changed AI-assisted labels are inside `windows`, which this integration does not inspect. [AI detection reference](https://docs.pangram.com/api-reference/ai-detection).
- **Models:** `GET /models` returns the selectors available to the authenticated account. `default` follows Pangram's current default; it does not pin a generation. The official SDK announces that callers must select a model explicitly after September 30, 2026. This implementation already does so. [Models](https://docs.pangram.com/api-reference/models), [SDK README](https://github.com/pangramlabs/pangram-sdk/tree/e8d737abf513c20808d3665025b76caa6ccfbdb9#discover-available-models).
- **Transition:** the August 6 migration guide says Pangram 4 launched through the API on July 29, while Pangram 3.3.2 remains the default through September 30, 2026. Selecting `pangram-4` opts in during the transition. This is a model and billing decision; the current task flow remains valid. [Pangram 4 migration guide](https://www.pangram.com/blog/pangram-4-migration-guide).
- **Price:** the current developer pricing lists Pangram 4 at $0.05 per 100 words and Pangram 3 at $0.05 per 1,000 words, with a 20% bulk discount. Account-specific terms and rounding were not checked. [Developer pricing](https://www.pangram.com/pricing?category=developers).

## Semantics and recommendations

**Use wording that reports a classification.** Pangram 4 defines `prediction_short == "Human"` as at least 90% of analyzed characters classified human. Its fractions are character-weighted class proportions, not confidence that the author is human. Thus a `Human` result can include a small AI-assisted or AI-generated portion. Pangram acknowledges detection errors. [Pangram 4 model card](https://www.pangram.com/research/model-card/pangram-4).

Recommendation: replace “Verified human writing” with wording such as “Pangram result: Human,” retaining the report link. If the intended promise is that no AI involvement was detected, make that an explicit, stricter badge policy using the fraction fields; even a 100% human classification is a model result, not proof of authorship. This recommendation follows from the model semantics rather than an API requirement.

**Handle short and unsuitable input explicitly.** The current Knowledge Hub specifies a 50-word minimum for reliable analysis. Pangram 3.3 retains Pangram 3.2's 50-word input minimum. This is documented supported use; this review did not verify whether every API request below that length is rejected. The Knowledge Hub's 18,725-word maximum is explicitly a dashboard limit, so it should not be copied into this REST client as an API limit. [Input sizes](https://www.pangram.com/knowledge-hub/minimum-and-maximum-input-sizes), [3.3 model card](https://www.pangram.com/research/model-card/pangram-3-3), [3.2 model card](https://www.pangram.com/research/model-card/pangram-3-2).

Pangram 4 is intended for complete-sentence natural-language prose; source code, references, templated text, and material dominated by mathematical notation are outside its primary scope or more error-prone. [Pangram 4 model card](https://www.pangram.com/research/model-card/pangram-4). Recommendation: assess eligibility after prose extraction, skip unsupported samples with a clear reason, and distinguish ineligible input from an operational failure. Retain the existing exclusion of code and embedded media.

**Choose when results should be refreshed.** `default` can change without the request selector changing. [Models](https://docs.pangram.com/api-reference/models). Local code keys the cache by selector and content, stores the returned version, and accepts cached results indefinitely. Consequently, a cached 3.3.2 result can survive the default transition. Recommendation: define a deliberate refresh/version policy and preserve the actual result version plus analysis date. Selecting `pangram-4` already creates a different local cache namespace, but neither a selector nor a cache entry should be described as an immutable model snapshot without a provider guarantee.

**Keep polling through transient failures.** The official SDK uses the same 300-second task timeout and 0.5-second polling defaults. It begins the deadline before submission, bounds requests and sleeps against remaining time, and retries transport exceptions while polling. It does not automatically retry non-success HTTP responses. Its `/task` submission has no retry loop. [Official SDK source](https://github.com/pangramlabs/pangram-sdk/blob/e8d737abf513c20808d3665025b76caa6ccfbdb9/pangram/text_classifier.py#L416).

The API documents `429` for configured rate limits, `500` for server errors, and `503` for temporary model unavailability. [API overview](https://docs.pangram.com/api-reference/introduction). Recommendation: retry transient polling failures with bounded backoff, honor `Retry-After` if present, enforce an overall deadline, and retain the task ID so a later attempt can resume. These HTTP retry choices are engineering recommendations, not a published Pangram retry policy. Do not blindly repeat `POST /task` after an ambiguous timeout: safe deduplication for that endpoint was not established. The SDK's `Idempotency-Key` support is specifically for `/bulk`. [Official SDK bulk submission](https://github.com/pangramlabs/pangram-sdk/blob/e8d737abf513c20808d3665025b76caa6ccfbdb9/pangram/text_classifier.py#L140).

## Public reports and unresolved details

Pangram's sharing guide says recipients can view a shared result's overview and segment details without an account or another scan. The existing public-link option fits that purpose. [Sharing guide](https://www.pangram.com/knowledge-hub/how-to-share-an-ai-detection-result).

No public-link permanence guarantee was found. The privacy FAQ says submitted content remains while an account is active and can be deleted from history. The storage article gives additional post-license retention details but contains an unresolved editorial verification marker; neither page establishes a lifetime guarantee for API-created public report URLs. Treat the report as an external dependency, with cached metadata available if the report disappears. [Privacy FAQ](https://www.pangram.com/data-privacy), [storage article](https://www.pangram.com/knowledge-hub/how-does-pangram-store-my-data).

Other unknowns: this account's current model entitlements, numeric rate limits, single-task retention, maximum REST text length, `/task` idempotency guarantees, and exact behavior of existing links after account closure or scan deletion. The documented 48-hour retention is for **bulk** metadata/results; it does not establish a 48-hour expiry for public dashboard reports. [API overview](https://docs.pangram.com/api-reference/introduction).

## Resolving documentation drift

Live `docs.pangram.com` pages and the official SDK agree on the async endpoint. Search snippets still expose earlier synchronous `/v3` instructions; they are stale relative to the directly fetched pages. Read the Docs agrees on `/task` but omits the newer model selector from its request description. Prefer the current Models and AI Detection narrative plus SDK source. Some generated examples on the new site are also inconsistent, such as `models: {}` versus the documented string array and a full-result POST example versus the explicit task-ID flow. These presentation defects do not justify changing the working async integration. [Current AI detection](https://docs.pangram.com/api-reference/ai-detection), [current Models](https://docs.pangram.com/api-reference/models), [Read the Docs inference reference](https://pangram.readthedocs.io/en/latest/api/rest.html).
