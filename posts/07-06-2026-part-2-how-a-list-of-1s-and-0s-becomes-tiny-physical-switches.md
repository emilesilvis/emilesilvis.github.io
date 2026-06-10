---
title: "How a list of 1s and 0s becomes tiny, physical switches (part 2/5)"
seo_description: "Following the 1s and 0s into hardware: adders built from logic gates, every gate built from NANDs, and the transistor at the bottom."
---

# How a list of 1s and 0s becomes tiny, physical switches (part 2/5)

In the [first part of this series](/part-1-how-1-plus-1-becomes-a-list-of-1s-and-0s.html), we ended with a long list of 1s and 0s.

Now something has to read these 1s and 0s and _do_ something with them. This something is the central processing unit. We're out of software land now and we're talking about physical wires and electric currents!

The central processing unit (CPU) is a chip, itself built from smaller chips, that acts a bit like a robot butler. It has a simple menu of instructions it can execute, without understanding any of them. For example, one instruction is "add" - the butler doesn't even do that itself, it hands the two numbers to a separate circuit whose only job is doing arithmetic, aptly named the arithmetic logic unit (ALU).

The ALU is a box with two number inputs, a handful of control wires, and one number output. If you activate the "sum" control wire, then the output is the sum of the two numbers. There's nothing that decides inside the ALU. The control wires _select_ what happens (my ALU does 18 different operations, controlled by 6 control bits).

And where do those control wires get set? From the very 1s and 0s we ended part 1 with. Six of the bits in each compute instruction are wired directly to the ALU's control inputs. How the CPU reads the list and steers those wires is part 4's story. In this part, we keep going *down* into the ALU itself.

## Adding in binary, column by column

How does the ALU actually add two binary numbers? Let's try and add two 4-bit numbers by hand.

```
  0001
+ 0001
------
  0010
```

We start with the rightmost column: 1 plus 1. Binary has no "2" digit, so we write the 0, and carry the 1 (exactly like carrying in decimal). The result is 10.

Each column is a physical device, called a HalfAdder:

```hdl
Xor(a=a, b=b, out=sum);
And(a=a, b=b, out=carry);
```

The above description is written in something called a [hardware description language](https://en.wikipedia.org/wiki/Hardware_description_language) (HDL), a cool way to describe the structure and behaviour of circuits. This way you can simulate your circuits on a computer instead of having to deal with real chips and soldering irons!

One warning before you read any more of it. Part 1 trained you to read code as instructions that run, top to bottom. These lines are not instructions, and nothing here "runs". Each line places a physical part and wires it to its neighbours. HDL is a parts list, not a recipe, and that goes for every block of HDL from here on.

The Xor gate sums ("are these two different?") and the And carries ("are these both 1?"). And note that every column's device physically exists at the same time. The hardware isn't working through the columns one by one like we did by hand.

These are all the possible inputs and outputs of the HalfAdder:

| a | b | sum | carry |
|---|---|-----|-------|
| 0 | 0 | 0   | 0     |
| 0 | 1 | 1   | 0     |
| 1 | 0 | 1   | 0     |
| **1** | **1** | **0** | **1** |

The bottom row *is* our `1+1`. Both input `a` and `b` being 1 is the question "what's 1+1?" posed in hardware. The circuit answers with `sum` and `carry`. If `carry` is 1 and `sum` is 0, it means we end up with 10, which is binary for 2 (just like in the naive example above, we *write* the 0 and we *carry* the 1).

At this stage, pause and think about this a bit. Nothing in the machine gets *calculated*. It's just gates wired together.

## Adding bigger numbers: the FullAdder

Ok, but what if we want to add bigger numbers? Let's say we have:

```
  0011
+ 0001
------
  0100
```

Let's do it by hand again. The rightmost column is 1+1. We write 0, carry 1. Now look at the second column from the right. We need to add 1 and 0 *and* the carry from the rightmost column (1+0+1). We need to add three things, but the HalfAdder only has two inputs!

The fix is what we'd do by hand with three numbers: add two first, then add the third to the result. This is literally the FullAdder:

```hdl
HalfAdder(a=a, b=b, sum=absum, carry=abcarry);
HalfAdder(a=absum, b=c, sum=sum, carry=abccarry);
Or(a=abcarry, b=abccarry, out=carry);
```

Let's walk through the three lines above using the column we just got stuck on (digits 1 and 0, with a carry coming in from the rightmost column). Line 1: the first HalfAdder adds the column's own two digits, 1 + 0 → partial sum 1, no carry. Line 2: the second HalfAdder adds that partial sum to the incoming carry, 1 + 1 → final digit 0, carry 1. Line 3: the Or passes a carry left if *either* stage produced one (here the second stage did, so out it goes). The circuit writes 0 and carries 1, exactly what we just did by hand.

It should be starting to dawn on you: composition. We needed a circuit that can add three bits. We didn't invent anything new. We just wired two HalfAdders and an Or gate together.

## The real adder: Add16

If we want to add two 16-bit numbers, we need a HalfAdder on the rightmost column and 15 FullAdders to the left. Here's the full Add16:

```hdl
HalfAdder(a=a[0], b=b[0], sum=out[0], carry=carry0);
FullAdder(a=a[1], b=b[1], c=carry0, sum=out[1], carry=carry1);
FullAdder(a=a[2], b=b[2], c=carry1, sum=out[2], carry=carry2);
FullAdder(a=a[3], b=b[3], c=carry2, sum=out[3], carry=carry3);
FullAdder(a=a[4], b=b[4], c=carry3, sum=out[4], carry=carry4);
FullAdder(a=a[5], b=b[5], c=carry4, sum=out[5], carry=carry5);
FullAdder(a=a[6], b=b[6], c=carry5, sum=out[6], carry=carry6);
FullAdder(a=a[7], b=b[7], c=carry6, sum=out[7], carry=carry7);
FullAdder(a=a[8], b=b[8], c=carry7, sum=out[8], carry=carry8);
FullAdder(a=a[9], b=b[9], c=carry8, sum=out[9], carry=carry9);
FullAdder(a=a[10], b=b[10], c=carry9, sum=out[10], carry=carry10);
FullAdder(a=a[11], b=b[11], c=carry10, sum=out[11], carry=carry11);
FullAdder(a=a[12], b=b[12], c=carry11, sum=out[12], carry=carry12);
FullAdder(a=a[13], b=b[13], c=carry12, sum=out[13], carry=carry13);
FullAdder(a=a[14], b=b[14], c=carry13, sum=out[14], carry=carry14);
FullAdder(a=a[15], b=b[15], c=carry14, sum=out[15], carry=carry);
```

You can see the carry being handed up the chain, column by column (`carry0` → `carry1` → … → `carry14`). 

Again, going from 1 bit to 16 didn't invent anything new. We just wired smaller parts together to get to Add16. Hold on to this thought.

If you've followed along with me up to this point, well done and thank you! 

## Everything is NAND

Before we go further, I need to explain the NAND gate. The NAND gate has two inputs and one output. Its output is *off* when both of its inputs are *on*, and *on* otherwise ("not and").

Here's the amazing thing: *every* gate we've seen so far *is composed of NAND gates wired together*.

Here's NOT:

```hdl
Nand(a=in, b=in, out=out);
```

The single input is wired into *both* of the NAND's inputs. Since the two inputs always agree, "not both on" becomes plain "not on".

AND:

```hdl
Nand(a=a, b=b, out=nandOut);
Not(in=nandOut, out=out);
```

A NAND whose output wire runs into a NOT. The chip is its own name spelled out: "NAND" means "not-AND", so AND is "not-NAND".

OR: 

```hdl
Not(in=a, out=notAOut);
Not(in=b, out=notBOut);
Nand(a=notAOut, b=notBOut, out=out);
```

Each input first passes through its own NOT, and the two inverted signals feed one NAND: "not both off", which is exactly "at least one on".

And so on. In fact, here's everything we've built in this part, drawn as one family tree:

```
Add16
├── HalfAdder            (the rightmost column)
│   ├── Xor
│   └── And
└── FullAdder × 15       (all the other columns)
    ├── HalfAdder × 2
    │   ├── Xor
    │   └── And
    └── Or
```

Every branch ends in gates, and every gate is NANDs. Here are the counts:

| Chip | NANDs |
|---|---:|
| Nand | 1 (atom) |
| Not | 1 |
| And | 2 |
| Or | 3 |
| Xor | 9 |
| HalfAdder | 11 |
| FullAdder | 25 |
| Add16 | 386 |

## The bottom of the tower

So the `1+1=2` we started with, the language, the instructions, the maths - all boils down to a NAND gate, at the very bottom. And what *is* a NAND gate, physically? A couple of tiny electric on/off switches called transistors. They're not flipped by a finger but by an electrical signal. So it's switches controlling switches, which is what makes the entire tower above possible. (Full honesty: this is where my own building stopped — the [nand2tetris course](https://www.nand2tetris.org/) hands you the NAND gate as the given atom. Below that is physics.)

It all comes down to one switch.

![The NAND gate: two inputs, one output, the little circle marking the "not"](/static/images/1-plus-1-series/nand.svg)

But a bunch of tiny electric on/off switches just sit there. Over the next three parts, we'll climb all the way back up the tower, back to the point where you see `2` in response to your `1+1`. First: [how do you make a pile of switches *move*?](/part-3-how-tiny-physical-switches-learn-to-remember.html)
