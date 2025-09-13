---
title: "I built a computer from scratch"
seo_image: "/static/images/04-06-2025-i-built-a-computer/nand2tetris-big-picture.png"
seo_description: "Building a computer from NAND gates to a working OS"
---

# I built a computer from scratch

Yes, really. From scratch, using only the modest [NAND gate](https://en.wikipedia.org/wiki/NAND_gate) as a fundamental building block. 

From there, I built a set of ever-more-complex components: first, Boolean logic gates (like AND, OR, and XOR), then the multiplexer and demultiplexer. Subsequently, I expanded these one-bit gates into 16-bit buses. With these, I constructed adders, an [arithmetic logic unit](https://en.wikipedia.org/wiki/Arithmetic_logic_unit) and memory chips ([RAM](https://en.wikipedia.org/wiki/Random-access_memory)). Finally I built the [central processing unit](https://en.wikipedia.org/wiki/Central_processing_unit) and integrated it with the memory chips (using a [Von Neumann architecture](https://en.wikipedia.org/wiki/Von_Neumann_architecture)) to form a fully-working hardware layer capable of executing instructions in binary machine code.

This binary machine code, in turn, was assembled from assembly language by [an assembler](https://github.com/emilesilvis/nand2tetris_assembler). The [VM translator](https://github.com/emilesilvis/nand2tetris_vm_translator) turns virtual machine code into assembly language, and the [compiler](https://github.com/emilesilvis/nand2tetris_compiler) turns Jack (a pedagogical programming language) into virtual machine code. 

This was all topped off by implementing [a set of operating system functions](https://github.com/emilesilvis/nand2tetris_os) (which was a good foray into algorithm design).

Perhaps now is a good moment to pause and mention [www.nand2tetris.org](https://www.nand2tetris.org/). It's an online university-level course that takes you on a journey to build a computer from first principles—from NAND gates all the way to Tetris. It can be taken as two Coursera courses ([1](https://www.coursera.org/learn/build-a-computer), [2](https://www.coursera.org/learn/nand2tetris2)), the first focusing on the hardware layer and the second on the software hierarchy. Each module comes with a hands-on project to complete.

![NAND2Tetris homepage](/static/images/04-06-2025-i-built-a-computer/nand2tetris-big-picture.png)

I've learnt tonnes. And I've found this journey quite beautiful. It's remarkable to think that most of our technological world is axiomatically _implied_ by the humble NAND gate. You have to appreciate that kind of elegance 😊
