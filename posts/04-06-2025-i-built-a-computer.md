---
title: "I built a computer from scratch"
seo_image: "/static/images/04-06-2025-i-built-a-computer/nand2tetris-big-picture.png"
seo_description: "Building a computer from NAND gates to a working CPU"
---

# I built a computer from scratch

Yes, really. From scratch, using only the modest [NAND gate](https://en.wikipedia.org/wiki/NAND_gate) as a fundamental building block. From there, I built a set of ever-more-complex components: first, Boolean logic gates (like AND, OR, and XOR), then the multiplexer and demultiplexer. Subsequently, I expanded these one-bit gates into 16-bit buses. With these, I constructed adders, an [arithmetic logic unit](https://en.wikipedia.org/wiki/Arithmetic_logic_unit) and memory chips ([RAM](https://en.wikipedia.org/wiki/Random-access_memory)). Finally I built the [central processing unit](https://en.wikipedia.org/wiki/Central_processing_unit) and integrated it with the memory chips to form a fully-working computer architecture capabale of executing instructions in binary machine code. (This binary machine code, in turn, was assembled from assembly language by [an assembler I wrote in Python](https://github.com/emilesilvis/nand2tetris_project6_assembler)).

Now, I didn't actually mess around with _physical_ NAND gates, circuit boards and soldering irons — I used a variant of a [hardware description language](https://en.wikipedia.org/wiki/Hardware_description_language) to specify the chips in a software format, and then I used a hardware simulator to simulate the chips.

![NAND2Tetris homepage](/static/images/04-06-2025-i-built-a-computer/nand2tetris-hardware-simulator.png)

And techincally I've only built _half_ the computer so far — the hardware layer. (I still plan to build the other half: the software hierarchy).

Perhaps now is a good moment to pause and mention [www.nand2tetris.org](https://www.nand2tetris.org/). It's an online university-level course that takes you on a journey to build a computer from first principles—from NAND gates all the way to Tetris. It can be taken as two Coursera courses ([1](https://www.coursera.org/learn/build-a-computer), [2](https://www.coursera.org/learn/nand2tetris2)), the first focusing on the hardware layer and the second on the software hierarchy. Each module comes with a hands-on project to complete.

![NAND2Tetris homepage](/static/images/04-06-2025-i-built-a-computer/nand2tetris-big-picture.png)

To say I learnt a lot is an understatement (I can't wait to tackle the second course). But I've also found it quite beautiful. It's remarkable to think that most of our technological world is axiomatically _implied_ by the humble NAND gate. You have to appreciate that kind of elegance 😊