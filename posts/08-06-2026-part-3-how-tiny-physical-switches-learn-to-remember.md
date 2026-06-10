---
title: "How tiny, physical switches learn to remember (part 3/5)"
seo_description: "How a clock and the data flip flop give a pile of logic gates time and memory: registers, RAM, and the heartbeat of the machine."
---

# How tiny, physical switches learn to remember (part 3/5)

In [part 2](/part-2-how-a-list-of-1s-and-0s-becomes-tiny-physical-switches.html), we stood at the bottom and looked up at a big tower made of only NANDs. But notice something: a circuit of gates is frozen. Its outputs follow its inputs, instantly and forever. Nothing happens *first*, and nothing *waits*. Yet running part 1's list of instructions needs exactly those two things: order (do this first, then that) and holding (a place to keep the first 1 somewhere while it fetches the second). Both are facts about time, and the NANDs have no time.

## The clock and its listener

We could fix this with a simple clock circuit: a signal that ticks on/off, forever. But none of our NANDs from part 2 has a clock input; the NANDs react instantaneously. So just having a clock alone isn't the full answer. We also need the machine to *listen* to it. 

The way to get the machine to listen is almost just as simple: a circuit with a funky name, the data flip flop (DFF). It has an input, an output, and a connection to the clock. It follows this rule: *at each tick*, it copies whatever value is currently on its input to its output; *between ticks*, its output wire keeps that value, no matter what happens to its input (the input can flip a hundred times, the output will not move until the next tick). (Full honesty, again: just like the NAND, the course hands you the flip flop as a given atom. Below it is physics, transistors wired into a loop, not my own work.)

![The data flip flop: one input, one output, and a clock connection underneath; at each tick the output becomes what the input was](/static/images/1-plus-1-series/dff.svg)

And that gets us both *holding* (between ticks, the flip flop's output is the value its input had at the last tick - it's storing one bit) and *order* (the flip flop's output only ever changes at tick moments, so anything built from flip flops changes in discrete steps, one step per tick; "do this first, then that" becomes possible because now there is a "then"). So this is where the clock gets its listener. NAND gates have no clock connection, so the flip flops are the *only* kind of part whose behaviour the clock affects. Every piece of the machine that changes over time will contain flip flops, which is the boring reason why the whole machine moves in step with the clock.

## Memory in two lines

I need to introduce one more component before we get to create memory: the Mux. The Mux is a chooser: it has two inputs, one selector wire, and the output is whatever input the selector points at. So with that, here's a single-bit register — a chip called Bit:

```hdl
Mux(a=dffOut, b=in, sel=load, out=muxOut);
DFF(in=muxOut, out=dffOut, out=out);
```

![The Bit chip: a Mux and a flip flop wired in a circle, with the flip flop's output looping back into the Mux's a input](/static/images/1-plus-1-series/bit.svg)

The chip we're building has three pins of its own: `in` (the value you might want to store), `load` (whether to store it), and `out` (the stored bit). The flip flop's clock connection is built in; we never wire it ourselves.

Now walk the loop. The flip flop's output drives two wires at once: `out`, the chip's output, and `dffOut`, which runs back into the Mux's `a` input. (That's why the DFF line says `out=` twice.) The Mux's other input, `b`, is the chip's `in`, and its selector is `load`. So the Mux is choosing what the flip flop stores next: the value it already holds, or the candidate new value. If `load` is 0, the output never changes: at each tick the flip flop re-stores what it already holds. If `load` is 1, the flip flop takes the new value at the *next tick* (at the tick, not the instant `load` flips, because the tick is the only moment a flip flop acts).

So who drives `load`? For now, nobody. It's an input pin sticking out of the chip, waiting to be wired. In the next part, when we open up the CPU, bits of the instruction itself will drive it: the instruction decides *which* registers store, the clock decides *when*.

We've stored one bit. The rest of memory is the same move, repeated. A 16-bit register is sixteen of these Bit chips side by side, sharing one `load` wire. It's the same trick as part 2, where the 16-bit adder was one-bit adders in a row. 

And bigger memory is smaller memory repeated. RAM8 is eight registers, RAM64 is eight RAM8s, RAM512 is eight RAM64s, RAM4K is eight RAM512s. Scaling is just repetition.

Step back and notice how little this part needed: one clock, plus one new atom that listens to it. Everything else was part 2's NANDs, rearranged. A heartbeat and the ability to remember. Our `1+1` also gains something it has been missing: the first 1 finally has somewhere to wait while the machine fetches the second. Complexity, it's starting to look like, is an illusion built from simple things.

But a memory just holds. The clock ticks, every register re-stores its value, and nothing else happens. Nobody decides what gets stored, or where, or what happens next. The 97 lines from part 1 are still just sitting there. In [the next part](/part-4-how-tiny-physical-switches-learn-to-follow-instructions.html), they take charge.
