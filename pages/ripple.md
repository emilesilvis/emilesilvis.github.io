---
title: "Ripple — a world you can hear"
seo_description: "Explore eight living soundscapes in your terminal. Ripple turns simulated water, wind, ringing matter, and creatures into sound."
---
# Ripple

A tiny Rust simulation that turns moving water, wind, matter, and creatures into gentle soundscapes you can explore from your terminal.

Water finds a channel. A gust swings a clapper into a chime. An animal's call reaches its neighbours a moment later. Ripple makes sound from those interactions: ringing materials, turbulent flow, bubbles, and creatures responding to what they can hear. There are no recorded sound loops.

**[Get Ripple on GitHub](https://github.com/emilesilvis/ripple)**

## Choose a world

The live terminal player lets you choose between eight worlds, pause the simulation, and adjust the volume while listening.

| World | What you'll hear |
| --- | --- |
| Glade | A brook through a clearing, birds, leaves, and wind chimes |
| Brook | Water finding its way down a rocky channel |
| Cozy rain | Rain on a metal roof, a swelling brook, and chimes |
| Night meadow | Crickets and frogs responding to nearby calls, with a far owl |
| Shore | Ocean swell over a shoal, gulls, and sea wind |
| Hearth | A crackling campfire, crickets, and a breeze |
| Mountain | Wind over a high ridge, leaves, and the odd bird |
| Storm | Heavy rain, gusting wind, and a brook fed by runoff |

Each world starts with its own terrain, weather, materials, and inhabitants. A seed lets you return to the same beginning; a new seed grows a different version.

## A world with a history

The simulation keeps changing as you listen. Rain lingers in the soil and drains gradually. Flowing water carries sediment, erodes the bed, and deposits it elsewhere. Earlier weather leaves consequences for the water that follows.

Chimes ring when moving bodies actually collide. Bubbles interact through the water around them, creating collective resonances. Creatures respond to calls only after sound has travelled far enough to reach them, and only when it is loud enough to hear over the background.

These are deliberately small physical models. The terrain and interactions can develop their own patterns, while individual animal songs are authored and the acoustics use simplified models. The [README](https://github.com/emilesilvis/ripple#readme) explains the mechanics and their limits.

## Run it locally

You'll need Rust and Cargo, an interactive terminal, and an audio output device. Clone the repository and start the player:

```sh
git clone https://github.com/emilesilvis/ripple.git
cd ripple
cargo run --release
```

Use the arrow keys and **Enter** to choose a world, **Space** to pause, **+ / −** to change the volume, and **q** to quit. Press **r** to restart with the same seed or **n** for a new one. Preparing terrain takes a moment; the current audio continues while another world loads.

You can also start in a particular world with a repeatable seed:

```sh
cargo run --release -- brook --seed 42
```

The same seed and audio sample rate reproduce a world's evolution. Restarting begins its history again.

[Back to projects](/projects.html)
