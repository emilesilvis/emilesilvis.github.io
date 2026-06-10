---
title: "How 1+1 becomes 2 (part 5/5)"
seo_description: "Pressing go: watching 1+1 run on the machine, tick by tick, until the ALU produces the 2 and it lands in the memory cell that is x."
seo_image: "/static/images/1-plus-1-series/trace.png"
---

# How 1+1 becomes 2 (part 5/5)

This time, we're not going to build anything. Every part this post touches was built in parts [1](/part-1-how-1-plus-1-becomes-a-list-of-1s-and-0s.html), [2](/part-2-how-a-list-of-1s-and-0s-becomes-tiny-physical-switches.html), [3](/part-3-how-tiny-physical-switches-learn-to-remember.html) and [4](/part-4-how-tiny-physical-switches-learn-to-follow-instructions.html). The machine is assembled, the clock is ticking, and the 97 lines from part 1 are loaded into ROM. All that's left is to press go and watch.

(One note before we start: the trace below is real, not imagined. It's the actual `Main.hack` from part 1, run on a small simulator of the machine I wrote for this post. The whole simulator is about 80 lines of Python, and the CPU itself about 40, which is its own kind of wow.)

## The whole run

A quick recap of the thread, because it's been four parts. You typed `let x = 1 + 1;` in Jack. The compiler turned that into three VM moves: `push constant 1`, `push constant 1`, `add`, wrapped in a little function ceremony (enter `Main.main`, and return at the end). The VM translator and the assembler then ground those down into the 97 lines of 1s and 0s that are now sitting in ROM.

Those VM moves are the natural zoom level for watching the run. So here it is, one row per VM operation, with what it does to the stack and to our variable `x`:

| Op | What happens | Stack | `x` |
|---|---|---|---:|
| `function Main.main 1` | enter the function; `x` initialised to 0 | [0] | 0 |
| `push constant 1` | first 1 on the stack | [0, 1] | 0 |
| `push constant 1` | second 1 on the stack | [0, 1, 1] | 0 |
| `add` | **the ALU produces the 2** | [0, 2] | 0 |
| `pop local 0` | **the 2 lands at `x`** | [0] | **2** |
| `push constant 0` | return value for a void function | [0, 0] | 2 |
| `return` | the function unwinds | | 2 |

(A note on zoom: each row above is really 5 to 13 clock ticks of register-and-memory motion — in the real run, the ALU produces the 2 at tick 27 and it lands at `x` at tick 45. And the final `return` has nowhere to go — there's no operating system to return to — so it wanders off into empty ROM. The 2 stays put regardless.)

![The raw simulator output, one row per tick: the instruction being executed, the A and D registers, the stack, and RAM[256], where the 2 eventually lands](/static/images/1-plus-1-series/trace.png)

Almost everything in that table is logistics, plates shuffling on and off the stack. Two rows are interesting. Let's slow down for each.

## The ALU produces the 2

The instruction behind the `add` row is `1111000010010000`. You can read this now (we dissected this exact instruction in part 4): a C-instruction, second operand from memory, compute bits `000010`, destination D. In assembly, `D=D+M`. At this moment, D holds the first 1 and the memory cell at the top of the stack holds the second.

The six compute bits arrive at the ALU's control inputs as voltages, and the Add16 from part 2 does its only trick. The rightmost column's HalfAdder receives 1 and 1. Stop here for a second. This is the bottom row of the truth table from part 2, the row I said was our `1+1`. It is happening now, physically. Sum 0, carry 1. The carry wakes the FullAdder one column to the left, which is the entire reason FullAdders exist, firing on cue. The other fourteen columns add zeros and stay quiet.

Out the other side comes `0000000000000010`: the number 2, existing physically for the first time. Back onto the stack it goes.

## The 2 lands at `x`

Eighteen ticks later, one instruction does the landing: `M=D`. The compute bits ask the ALU to pass D through untouched, and the destination bits say "store it in memory". The cell it lands in is RAM[256], and that cell *is* the variable `x`. Part 1's `let x =` finally finds its home. The cell flips from 0 to 2.

After four parts of machinery, the arrival of the answer is a single write, to a single cell, on a single tick. 

## The climb back up

Now climb back up, in one breath. That 2 in a memory cell *is* the value on the VM's stack, *is* what the variable `x` holds. Not "becomes". *Is*. The same sixteen bits, seen from different floors of the tower. The answer has surfaced through every layer it descended in part 1.

To be fully honest, one step remains: our little program stops there, with the 2 sitting in memory. Nothing in those 97 lines draws anything. Putting the 2 on your screen would take a few more instructions, copying those same sixteen bits to an address above `0x4000`, where, as we saw in part 4, writes become pixels.

## The same instruction does both

One more thing, and it's my favourite idea in the whole series. Remember the `M=D` instruction that landed the 2 at `x`? If the destination address had been `0x4000` or higher, the exact same instruction would have drawn on the screen. Nothing about the instruction changes. Only the address. The CPU has no idea whether it's writing to storage or to pixels; the Memory chip from part 4 decides what an address means, and the CPU just writes.

Same dumb instruction, different consequence. If this series has been building toward one proof that complexity is an illusion built from simple things, here it is: the same instruction does both.

## So what did we actually see?

Every layer was built from the one below, and you watched it happen: gates from switches, arithmetic from gates, instructions from arithmetic, a language from instructions. Go looking for the step where something magic got added. There isn't one.

My favourite part is the stacking of abstractions. The VM from part 1 is the cleanest case: a "machine" that exists only as a convention for using memory, and yet you can write programs for it, and they run.

The big one: everything a computer does bottoms out in an on/off switch. You now hold that whole chain, with no gaps in it (hopefully!).

If I had to choose a single theme for this series: complexity is an illusion built from simple things. 
