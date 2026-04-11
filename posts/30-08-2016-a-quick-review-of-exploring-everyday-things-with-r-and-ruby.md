---
title: "A quick review of Exploring Everyday Things with R and Ruby"
seo_image: "/static/images/profile.png"
seo_description: "A review of the book Exploring Everyday Things with R and Ruby — a fun whirlwind tour of using Ruby and R to prod at a variety of problems."
---

# A quick review of Exploring Everyday Things with R and Ruby

I've recently learned a lot about Ruby, and I'm also quite interested in [R](http://www.r-project.org/), a programming language for statistical computing. The book [Exploring Everyday Things with R and Ruby](http://shop.oreilly.com/product/0636920022626.do) naturally piqued my interest.

## Overview of the book

The first two chapters does a quick primer on Ruby and R respectively, and does a sufficient job to get you up and running with both Ruby and R.

The remaining six chapters each tries to "explore" a question. The main approach to "exploring" is a two-step process: 1) Use Ruby to extract data (typically stored as a CSV file) and 2) analyse this data with R.

The first chapter explores the amount of toilets required for a certain number of people. Ruby is used to simulate this population of people, the toilets and the queues forming outside the restroom.

The second chapter builds a basic model of a laissez-faire economy, and analyses the effects of price and demand.

The third chapter tries to glean insights from your email usage patterns, and uses a public collection of Enron emails to illustrate the points.

The fourth chapter lets you record your heartbeat and your pulse, and then extracts the information from the raw media files to visualise your heartbeat and heart rate.

The fifth chapter looks at the way birds and fish tend to flock together, and builds a [Boids simulation](http://en.wikipedia.org/wiki/Boids) to explore [emergent behaviour](http://en.wikipedia.org/wiki/Emergent_behaviour).

The final chapter extends the previous model, but introduces several more elements into the simulation, including food, reproduction and evolution.

## The good

- I think this is an excellent book for those who are curious, and wants to get a taste of doing some hands-on "exploration" of "everyday things".
- It gives you a collection of easy-to-understand and fun toy problems which you can explore on your own.
- It's a short and easy read.

## The bad

- Unfortunately the book is quite sparse on the *why* behind the analysis (the emphasis is really on exploring rather than analysing). Don't expect to learn anything about statistical inference or probability theory. This is to be expected to some degree, however, since the book aims to be a layman's introduction to using regular tools (Ruby and R) to explore regular stuff (building planning, the economy, flocking behaviour), and this it does really well. It's the perfect appetiser, but it won't satisfy you.
- The code provided in the book is full of errors. To get any value out of these, you'll have to clone the [GitHub](https://github.com/sausheong/everyday) repository and work with that code.

**I would give this book 4 out of 5. It's a quick, fun whirlwind tour of using Ruby and R to prod at a variety of problems. Just don't expect to scratch more than the tip of the iceberg.**
