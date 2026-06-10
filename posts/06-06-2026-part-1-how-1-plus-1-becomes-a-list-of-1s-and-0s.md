---
title: "How 1+1 becomes a list of 1s and 0s (part 1/5)"
seo_description: "How 1+1 in a high-level language is ground down into binary machine code: compiler, VM translator, and assembler."
---

# How 1+1 becomes a list of 1s and 0s (part 1/5)

Last year [I built a computer from scratch](https://emilesilvis.com/i-built-a-computer.html), and I still can't get over how mind-blowing it is. Take a simple example. You type `1+1` and the computer gives back `2`. It seems obvious, until you realise that, at the bottom, it's just 1s and 0s represented by tiny electrical switches. 

What magic needs to happen between you typing `1+1` and seeing `2` on your screen? In this five-part series, I'll endeavour to take you through every step of the journey: all the way down to the smallest physical part, and then back up to the exact memory cell where the answer lands. (The last hop, actually drawing the character `2` on a screen, turns out to be one more move of the same kind. You'll see why at the very end.)

Let's start by expressing our `1+1` as a program (in a language called [Jack](https://www.cs.huji.ac.il/course/2002/nand2tet/docs/ch_9_jack.pdf)).

```
class Main {
    function void main() {
        var int x;
        let x = 1 + 1;
        return;
    }
}
```

## From Jack to virtual machine code

The first thing to realise here is that this nice readable language is a lie. This isn't what's being run. The [compiler I wrote](https://github.com/emilesilvis/nand2tetris_compiler) takes this and turns it into simpler moves. All seven of them:

```
function Main.main 1
push constant 1
push constant 1
add
pop local 0
push constant 0
return
```

What we're looking at here is virtual machine code. This particular virtual machine uses a pattern called the [stack](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)). Think of it as a stack of plates. The three lines in the middle are our `1+1`: `push constant 1` puts a plate down, the second `push constant 1` puts another plate down, and `add` lifts the top two plates, adds them, and puts one plate back with the value `2`.

The other four lines are the ceremony around it. `function Main.main 1` enters the function and sets aside one slot for our variable `x`. `pop local 0` is the `let x =`: it takes the result plate off the stack and stores it in that slot. And because `main` returns nothing, `push constant 0` and `return` put down a placeholder plate and hand control back.

Here's the part I find strange and wonderful: this "machine" doesn't physically exist. There's no stack chip anywhere. The stack is just a convention for using ordinary memory, and yet you can write programs for it, and they run. Hold on to that thought; it comes back at the very end of the series.

## From VM code to assembly

But even these moves are too fancy. So we translate it again to something even simpler with the [VM translator I built](https://github.com/emilesilvis/nand2tetris_vm_translator).

`push constant 1` becomes these 7 lines of assembly:

```
@1
D=A
@SP
A=M
M=D
@SP
M=M+1
```

One human-readable line becomes 7 somewhat obscure ones. In words, this assembly says the following: put the number 1 into a scratch slot called D, write D into the memory cell the stack pointer (the `SP` in the code) points at, bump the stack pointer. 

And `add` becomes these 13 lines:

```
@SP
M=M-1
A=M
D=M
@SP
M=M-1
A=M
D=D+M
@SP
A=M
M=D
@SP
M=M+1
```

I won't walk you through this one, but the point is the ratio. One friendly word like `add` turns into 13 primitive lines of assembly.

## From assembly to 1s and 0s

We need to go one level deeper. Assembly is still text, written for humans; the machine needs numbers. The [assembler I built](https://github.com/emilesilvis/nand2tetris_assembler) takes each line and packs it into 16 bits.

`@1` becomes `0000000000000001`. Sixteen on/off slots: fifteen off, one on. That 1 at the end is your `1`.

The little seven-line program you typed above results in 97 lines of 1s and 0s! Here they are, all of them:

<details>
<summary>All 97 lines</summary>

```
0000000000000000
1111110000100000
1110101010001000
0000000000000000
1111110111001000
0000000000000001
1110110000010000
0000000000000000
1111110000100000
1110001100001000
0000000000000000
1111110111001000
0000000000000001
1110110000010000
0000000000000000
1111110000100000
1110001100001000
0000000000000000
1111110111001000
0000000000000000
1111110010001000
1111110000100000
1111110000010000
0000000000000000
1111110010001000
1111110000100000
1111000010010000
0000000000000000
1111110000100000
1110001100001000
0000000000000000
1111110111001000
0000000000000001
1111110000010000
0000000000000000
1110000010010000
0000000000001101
1110001100001000
0000000000000000
1111110010001000
1111110000100000
1111110000010000
0000000000001101
1111110000100000
1110001100001000
0000000000000000
1110110000010000
0000000000000000
1111110000100000
1110001100001000
0000000000000000
1111110111001000
0000000000000001
1111110000010000
0000000000001101
1110001100001000
0000000000001101
1111110000010000
0000000000000101
1110010011010000
1110001100100000
1111110000010000
0000000000001110
1110001100001000
0000000000000000
1111110010101000
1111110000010000
0000000000000010
1111110000100000
1110001100001000
0000000000000010
1111110111010000
0000000000000000
1110001100001000
0000000000001101
1111110010101000
1111110000010000
0000000000000100
1110001100001000
0000000000001101
1111110010101000
1111110000010000
0000000000000011
1110001100001000
0000000000001101
1111110010101000
1111110000010000
0000000000000010
1110001100001000
0000000000001101
1111110010101000
1111110000010000
0000000000000001
1110001100001000
0000000000001110
1111110000100000
1110101010000111
```

</details>

You can even spot your two 1s in there (lines 6 and 13). Only about a quarter of the 97 do the actual adding. The rest is bookkeeping (even the `return`, which does no visible work, takes 50 lines).

Before we go any deeper, here's the whole journey so far in one picture. Each layer says exactly what the layer above it says, in a dumber language:

```
Jack        let x = 1 + 1;

VM          push constant 1
            push constant 1
            add

assembly    @1
            D=A
            ...

binary      0000000000000001
            1110110000010000
            ...
```

One thing, four faces.

And we're not at the bottom yet. In [the next part](/part-2-how-a-list-of-1s-and-0s-becomes-tiny-physical-switches.html), we'll look at how these 1s and 0s descend through the physical hardware, all the way down to a tiny, physical on/off switch. Because in the end, it all comes down to one switch.
