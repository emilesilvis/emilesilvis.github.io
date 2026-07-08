---
title: "Are you controlling your LLM or limiting it?"
seo_description: "Being in control of your coding LLM is crucial, but control has a price. A Plants vs Zombies experiment, the control–autonomy spectrum, and Reverse Engineer Driven Development (REDD)."
seo_image: "/static/images/08-07-2026-are-you-controlling-your-llm-or-limiting-it/agentic-control-spectrum.png"
---

# Are you controlling your LLM or limiting it?

I had a realisation: being in control of your coding LLM is crucial, but you need to be clear headed about how much to control it, because you _are_ limiting it in ways that you wouldn't expect.

This weekend, I wanted to learn more about [Matt Pocock's /grill-me-with-docs skill](https://www.aihero.dev/grill-with-docs). Before any code exists, the agent interviews you relentlessly about your plan, one question at a time, and writes the answers down as it goes. You end up with a glossary, and hard-to-reverse decisions land as architecture decision records. Any future agent runs can reference these artifacts.

To test it out, I chose a semi-ambitious project (not a straightforward web-based CRUD): making a clone of Plants vs Zombies.

~4 hours later, I ended up with this:

![The /grill-me-with-docs version: a sparse grid with a single frog and a wall](/static/images/08-07-2026-are-you-controlling-your-llm-or-limiting-it/grill-me-with-docs-result.png)

At this point I got curious: what could a powerful model do if I gave it _no_ constraints? So I gave Claude Code Fable a single `/goal`.

```
/goal a cute-as-heck pixel-based Plants vs Zombies game where frogs protect their homes (mushrooms) from monsters. Fireflies are the currency (sun in PvZ). Ambient soundcape with crickets and other nature sounds, generative. Cute as heck. Sounds are cute as heck too. Game should be super duper cozy and beautiful. Runs in a browser.
```

In ~25 minutes, it came up with this (it's a video — press play!):

<video src="/static/images/08-07-2026-are-you-controlling-your-llm-or-limiting-it/goal-fable-result.mp4" controls playsinline style="max-width: 100%;"></video>

The `/goal` version was better in almost every conceivable way. Smoother, more polished, cuter. It even had a cool soundtrack!

My expectation was that the `/grill-me-with-docs` version would _eventually get there_, but once I saw the `/goal` version, it became clear that it never would: the `/grill-me-with-docs` version focussed so hard on not straying from the spec, that it developed a tunnel vision and stifled its own ability to produce code that can even potentially be iterated into what the `/goal` version came up with.

So what's the lesson? There's a spectrum, and you need to be clear headed about where you want to be, and why.

![The agentic control spectrum: /grill-me-with-docs on the high-control, methodical end; /goal + Fable on the high-autonomy, faster and more emergent end](/static/images/08-07-2026-are-you-controlling-your-llm-or-limiting-it/agentic-control-spectrum.png)

When you have this spectrum in mind, you can choose the appropriate strategy:

- If it's mission-critical software, err on the side of control.
- Creative green fields, go for autonomy.

But what's most interesting to me is doing both: describe your dot on the horizon and let a high-autonomy mode agent build out an all-bells-and-whistles prototype. Then ask a high-control mode agent to lock that prototype in as its target, reverse engineer it, and start carefully from scratch. You first generate the vision, then build carefully towards it. Call it **Reverse Engineer Driven Development (REDD)**. I'll definitely be exploring this approach more in the future.
