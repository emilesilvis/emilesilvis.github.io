// Wolf Tone: the words, audible. The note alphabet is literal: A, B, C, D
// are the pitches A4, B4, C5, D5, and a word plays as a strum of its letters
// in order. Like report.mjs and the rest of the shell, this file renders and
// decides nothing: engine.mjs never imports it, so the search harness and
// the ladder test stay silent.
//
// The empty word plays what it is.

const FREQ = { A: 440, B: 493.88, C: 523.25, D: 587.33 };

let ctx = null;
let master = null;
let muted = false;
let music = null;
let musicOn = true;
let musicFile = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Browsers gate audio behind a user gesture; the first press unlocks it.
for (const evt of ['pointerdown', 'keydown']) {
  document.addEventListener(evt, () => {
    ensure();
    startMusic();
  }, { once: true, capture: true });
}

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

// The Godot OST lives on its own bus. HTMLAudioElement is the browser's
// streaming path, so the 44 MB soundtrack is loaded one selected track at a
// time rather than decoded into WebAudio up front. The first user gesture
// unlocks playback alongside the synthesized string sounds above.
function musicPlayer() {
  if (!music) {
    music = new Audio();
    music.loop = true;
    music.preload = 'auto';
    music.volume = 0.13; // Godot's Music bus sat about 18 dB below master.
  }
  return music;
}

function startMusic() {
  if (!musicOn || !musicFile || document.hidden) return;
  musicPlayer().play().catch(() => {}); // a later gesture retries if gated
}

export function setSoundtrack(file) {
  if (!file || file === musicFile) {
    startMusic();
    return;
  }
  musicFile = file;
  const player = musicPlayer();
  player.pause();
  player.src = new URL(`./music/${file}`, import.meta.url).href;
  player.currentTime = 0;
  player.load();
  startMusic();
}

export function setMusicOn(on) {
  musicOn = on;
  if (on) startMusic();
  else music?.pause();
}

export function isMusicOn() { return musicOn; }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) music?.pause();
  else startMusic();
});

// One plucked string: sharp attack, exponential decay, a lowpass that closes
// as it rings down. `at` is seconds from now.
function pluck(freq, at, { gain = 0.2, decay = 0.3, bright = false } = {}) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * (bright ? 6 : 3.5), t);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + decay);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(filter).connect(env).connect(master);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

// A word is a strum of its letters, capped where the pill caps (six notes).
// `at` and `spacing` are milliseconds, to match the shell's tick arithmetic.
export function playWord(word, { at = 0, spacing = 100, gain = 0.2, bright = false } = {}) {
  if (muted || !word || !ensure()) return;
  [...word].slice(0, 6).forEach((note, i) => {
    const f = FREQ[note];
    if (f) pluck(f, (at + i * spacing) / 1000, { gain, decay: bright ? 0.5 : 0.28, bright });
  });
}

// A machine that went silent gets one low damped thump.
export function playThud() {
  if (muted || !ensure()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.25);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + 0.35);
}

// The commission filled: an open chord on the alphabet's own outer letters -
// A4, D5, A5, a fourth and then a fifth, left to ring.
export function playResolve() {
  if (muted || !ensure()) return;
  [440, 587.33, 880].forEach((f, i) => pluck(f, i * 0.07, { gain: 0.25, decay: 0.9, bright: true }));
}
