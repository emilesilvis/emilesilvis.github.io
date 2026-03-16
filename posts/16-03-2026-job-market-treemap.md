---
title: "AI exposure of every job in the Netherlands and Europe"
seo_description: "Interactive treemaps showing AI exposure for every occupation in the Netherlands and Europe, inspired by Karpathy's US job market visualizer"
---

# AI exposure of every job in the Netherlands and Europe

Yesterday Andrej Karpathy [published a treemap](https://karpathy.ai/jobs/) visualising every occupation in the US economy, sized by employment and colored by AI exposure. He scored 342 BLS occupations on a 0-10 scale using an LLM and called it "a saturday morning 2 hour vibe coded project."

I immediately wondered: what does this look like for the Netherlands and for Europe?

So I built it: [**interactive treemap for the Netherlands and Europe**](/job-market-treemap-interactive.html).

[![Job market treemap](/static/images/16-03-2026-job-market-treemap/preview.svg)](/job-market-treemap-interactive.html)

The treemap uses [ISCO-08](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Glossary:International_standard_classification_of_occupations_(ISCO)) occupation categories from the [Eurostat Labour Force Survey](https://ec.europa.eu/eurostat/databrowser/view/LFSA_EGAI2D). Each rectangle's **size** represents employment volume and its **color** represents AI exposure (green = low, red = high). You can toggle between Europe and the Netherlands.

The patterns are similar to Karpathy's US findings: clerical and administrative roles are the most exposed, while physical trades, care work, and elementary occupations are the least. The Netherlands has a notably large share of employment in business services and ICT compared to the EU average, which means a larger share of its workforce sits in the high-exposure zone.

## How to reproduce this

The approach follows Karpathy's:

**1. Get occupation data from Eurostat**

Employment figures by ISCO-08 2-digit occupation come from Eurostat table [`LFSA_EGAI2D`](https://ec.europa.eu/eurostat/databrowser/view/LFSA_EGAI2D). You can download it via their API:

```python
import eurostat  # pip install eurostat

df = eurostat.get_data_df("lfsa_egai2d")

# Filter for total (both sexes), ages 15-74, year 2023
df = df[(df["sex"] == "T") & (df["age"] == "Y15-74")]

# Get Netherlands and EU27
nl = df[df["geo\\TIME_PERIOD"] == "NL"]
eu = df[df["geo\\TIME_PERIOD"] == "EU27_2020"]
```

**2. Score each occupation with an LLM**

For each ISCO-08 occupation, send its description to an LLM and ask it to rate AI exposure on a 0-10 scale. Karpathy used Gemini Flash via OpenRouter. You could use any model:

```python
prompt = f"""Rate the AI/LLM exposure of the occupation "{title}" on a 0-10 scale.
0 = no exposure (purely physical, no text/data processing)
10 = fully automatable by current LLMs
Return only the integer score and a one-sentence rationale."""
```

**3. Build the treemap**

The [visualisation](/job-market-treemap-interactive.html) is a single HTML file using the Canvas API with a [squarified treemap](https://www.win.tue.nl/~vanwijk/stm.pdf) layout algorithm. No dependencies. The data is embedded directly in the HTML as a JavaScript array.

The full source is in the [repo](https://github.com/emilesilvis/emilesilvis.github.io/blob/main/html/job-market-treemap-interactive.html).
