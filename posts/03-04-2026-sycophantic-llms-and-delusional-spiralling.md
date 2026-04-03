---
title: "Sycophantic LLMs cause delusional spiralling"
seo_image: "/static/images/03-04-2026-sycophantic-llms/sycophantic-chatbot.png"
seo_description: "A new paper proves that sycophantic LLMs cause users to spiral into false beliefs — even perfectly rational ones."
---

# LLMs' tendency to just agree with everything we say causes us to believe false things about the world

I think we all intuitively know this, but [this paper](https://arxiv.org/pdf/2602.19141v1) proves it empirically.

[![Sycophantic chatbot entertaining the idea that the user might be better than the gods](/static/images/03-04-2026-sycophantic-llms/sycophantic-chatbot.png)](https://x.com/___frye/status/1916348471642362213)

The paper explores claims that LLM sycophancy (the annoying tendency of LLMs to just agree with whatever you say) *causes* users to spiral into false (and sometimes dangerous) beliefs about the world. [Eugene Torres was convinced by ChatGPT](https://theconversation.com/ai-induced-psychosis-the-danger-of-humans-and-machines-hallucinating-together-269850) that we're living in a simulation, that he was "one of the Breakers - souls seeded into false systems to wake them from within." ChatGPT also advised him to stop taking his anti-anxiety medicine, up his ketamine usage and to break contact with other humans. If that's not a delusional spiral, I don't know what is.

The thing that blew my mind is that delusional spiralling is _not because humans are irrational or lazy_. The paper uses a Bayesian approach to model a perfectly rational human that updates their beliefs based on new evidence. This rational version of humanity was just as prone to being lured into delusional spirals by sycophantic LLMs.

(side note: using a Bayesian approach for modelling human behaviour is in itself fascinating to me - to build their model, the paper used the [memo programming language](https://github.com/kach/memo/tree/main), a "probabilistic programming language for expressing computational cognitive models" 🤯).

The paper also asked an interesting question: "can we stop delusional spiralling if we force LLMs to only tell the truth (no hallucination) and if we educate users so that they know that the LLMs are sycophants?". The answer is: it helps, but it doesn't actually *stop* sycophancy. This is because these LLMs are essentially [built from the ground up with a bias towards agreeing with the user's expressed opinions](https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback).

Where does this leave us? Echo chambers are of course nothing new. We've all had that feeling of scrolling X just to get this eerie feeling that we're simply seeing echoes of some zeitgeist. But what makes LLMs scary is how much decision power we're already delegating to them. Previously we've had to sit with all the emotions that came with a big decision. And we ultimately had to take accountability for the decisions. Now, we're relying on swarms of sycophantic agents to make these decisions for us, without having that crucial moments of reflection with ourselves. 

LLMs are becoming justification machines, en masse. 

## Source

Chandra, K., Kleiman-Weiner, M., Ragan-Kelley, J., & Tenenbaum, J. B. (2025). _Sycophantic chatbots cause delusional spiraling, even in ideal Bayesians_. arXiv:2602.19141. https://arxiv.org/pdf/2602.19141v1