---
title: "AI exposure for EU jobs 🇪🇺"
seo_description: "Interactive treemaps showing AI exposure for every occupation in the Netherlands and Europe, inspired by Karpathy's US job market visualizer"
---

# AI exposure for EU jobs 🇪🇺

Andrej Karpathy [built this for the US](https://karpathy.ai/jobs/) and it [blew up](https://x.com/_kaitodev/status/2032927164883153402). I wanted to see what it looks like on this side of the Atlantic. So I built an [**interactive treemap for the Netherlands and Europe**](/job-market-treemap-interactive.html). Every rectangle is an occupation. Size = employment. Colour = AI exposure (green → red). Toggle between Europe and the Netherlands to see the difference.

[![Job market treemap](/static/images/16-03-2026-job-market-treemap/screenshot.png)](/job-market-treemap-interactive.html)

Same pattern as the US: if your whole job happens on a screen, it's not looking great.

General & keyboard clerks: **9/10**.
ICT professionals: **8/10**.
Bricklayers: **1/10**.
Cleaners: **1/10**.
Average across all European jobs: **4.9/10**.

Now toggle to the Netherlands. It's noticeably redder — heavy on business services and ICT, exactly the jobs that score highest.

## How I built this

A [Python script](https://github.com/emilesilvis/eu-jobs) pulls employment numbers from the [Eurostat Labour Force Survey](https://ec.europa.eu/eurostat/databrowser/view/LFSA_EGAI2D) (every [ISCO-08](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Glossary:International_standard_classification_of_occupations_(ISCO)) 2-digit occupation, EU-27 + Netherlands) and feeds them to GPT-4o to estimate each occupation's LLM exposure on a 0-10 scale. The treemap is a single D3.js HTML file ([source](https://github.com/emilesilvis/emilesilvis.github.io/blob/main/html/job-market-treemap-interactive.html)) that reads the resulting JSON.
