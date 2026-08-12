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
