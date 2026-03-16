---
title: "AI exposure for EU jobs 🇪🇺"
seo_image: "/static/images/16-03-2026-job-market-treemap/screenshot.png"
seo_description: "Interactive treemaps showing AI exposure for every occupation in the Netherlands and Europe, inspired by Karpathy's US job market visualizer"
---

# AI exposure for EU jobs 🇪🇺

Andrej Karpathy recetly [built this for the US](https://karpathy.ai/jobs/). I wanted to see what it looks like for Europe, so I built [**an interactive treemap for the Netherlands and Europe**](/job-market-treemap-interactive.html). Every rectangle is an occupation. Size = employment. Colour = AI exposure (green → red).

[![Job market treemap](/static/images/16-03-2026-job-market-treemap/screenshot.png)](/job-market-treemap-interactive.html)

I see the same pattern as the US: if your whole job happens on a screen, it's not looking great.

ICT professionals: **9/10**.
Business & admin professionals: **8/10**.
Building trades workers: **1/10**.
Cleaners: **1/10**.
Average across all European jobs: **4.9/10**.

Some surprises though. Science and engineering professionals: **8/10** — is it because they write lots of reports? Health professionals: only **5/10** — someone still has to examine the patient, I guess. Teaching professionals: **6/10** — high for a job that's about being in a room with humans.

## How I built this

A [Python script](https://github.com/emilesilvis/eu-jobs) pulls employment numbers from the [Eurostat Labour Force Survey](https://ec.europa.eu/eurostat/databrowser/view/LFSA_EGAI2D) (every [ISCO-08](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Glossary:International_standard_classification_of_occupations_(ISCO)) 2-digit occupation, EU-27 + Netherlands) and feeds them to GPT-4o to estimate each occupation's LLM exposure on a 0-10 scale (meta: using an LLM to rate LLM exposure). The treemap is a single D3.js HTML file ([source](https://github.com/emilesilvis/emilesilvis.github.io/blob/main/html/job-market-treemap-interactive.html)) that reads the resulting JSON.
