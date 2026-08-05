// Wolf Tone: the whole physics in one DOM-free file, so the ladder test can
// run every reference build headlessly. A string is a word over the note
// alphabet; every part is a partial function on words; where the function is
// undefined the word waits, and the run says which part is waiting and why.
//
// PROTOTYPE: throwaway. It answers "does strings-are-tapes play?", not
// "how should this be built".

import { machineArea, wireTravelTime } from './wire-routing.mjs?v=0.9.2-1';

export const NOTES = ['A', 'B', 'C', 'D'];

const CROSSING_INPUT_PORTS = ['inA', 'outA', 'inB', 'outB'];
const CROSSING_OUTPUT_PORTS = ['outA', 'inA', 'outB', 'inB'];

export const PORTS = {
  quill:     { ins: [],               outs: ['out'] },
  mould:     { ins: ['in'],           outs: ['out'] },
  damper:    { ins: ['in'],           outs: ['out'] },
  valve:     { ins: ['in'],           outs: ['out'] },
  unison:    { ins: ['lead', 'tail'], outs: ['out'] },
  splitter:  { ins: ['in'],           outs: ['head', 'rest'] },
  fork:      { ins: ['in'],           outs: ['left', 'right'] },
  coupling:  { ins: ['inA', 'inB'],   outs: ['outAL', 'outAR', 'outBL', 'outBR'] },
  crossing:  { ins: CROSSING_INPUT_PORTS, outs: CROSSING_OUTPUT_PORTS },
  junction:  { ins: ['inA', 'inB'],   outs: ['out'] },
  resonator: { ins: ['in'],           outs: [] },
};

export const KIND_NAMES = {
  quill: 'Quill', mould: 'Mould', damper: 'Damper', valve: 'Valve',
  unison: 'Unison', splitter: 'Splitter', fork: 'Tuning fork',
  coupling: 'Coupling', crossing: 'Crossing', junction: 'Junction', resonator: 'Resonator',
};

export function defaultConfig(kind) {
  switch (kind) {
    case 'mould': return { note: 'A' };
    case 'splitter': return { k: 1 };
    case 'fork': return { note: 'A', mode: 'peek' };
    case 'coupling': return { noteA: 'A', noteB: 'A' };
    case 'valve': return { delay: 1 };
    default: return {};
  }
}

export function prettyWord(w) {
  return w ? [...w].join('·') : '∅';
}

export function byId(machine, id) {
  return machine.parts.find((p) => p.id === id);
}

function label(machine, id) {
  const p = byId(machine, id);
  return p.label ? `${KIND_NAMES[p.kind]} “${p.label}”` : `${KIND_NAMES[p.kind]} ${p.id}`;
}

// Travel time follows the player's explicit orthogonal route, min 1. Legacy
// endpoint-only fixtures retain their old Manhattan time until redrawn.
export function wireTicks(machine, wire) {
  return wireTravelTime(machine, wire);
}

// Player construction and fixed commission scaffolding share one complete
// machine at runtime, so the caller supplies the player-only count explicitly.
export function measureScore(machine, { componentCost, playerPartCount, runs = null }) {
  const allResonant = runs?.length && runs.every((run) => run.verdict === 'resonant');
  const score = {
    cost: componentCost ?? playerPartCount ?? 0,
    time: allResonant ? Math.max(...runs.map((run) => run.tick)) : null,
    area: machineArea(machine),
  };
  // Design-time mining scripts still read the retired names. Keep them as
  // non-enumerable compatibility views so player-facing score snapshots only
  // contain the spatial experiment's three axes.
  Object.defineProperties(score, {
    parts: { value: score.cost },
    wire: { value: machine.wires.reduce((total, wire) => total + wireTicks(machine, wire), 0) },
  });
  return score;
}

export function mergeBestScore(previous, candidate) {
  if (!previous) return { ...candidate };
  return {
    cost: Math.min(previous.cost, candidate.cost),
    time: previous.time === null ? candidate.time
      : candidate.time === null ? previous.time
        : Math.min(previous.time, candidate.time),
    area: Math.min(previous.area, candidate.area),
  };
}

function outWireIndex(machine, partId, port) {
  return machine.wires.findIndex((w) => w.from.part === partId && w.from.port === port);
}

export function makeRun() {
  return {
    tick: 0,
    transit: [],      // { wireIndex, word, depart, arrive }
    holds: [],        // { part, word, release } : valves
    queues: {},       // partId -> port -> [word, ...] FIFO
    emitted: {},      // quillId -> true
    satisfied: {},    // resonatorId -> word it accepted
    stalls: [],       // { part, reason }: recomputed every tick
    usedWires: new Set(), // wire indexes that delivered at least one word
    events: [],
    verdict: null,    // 'resonant' | 'sour' | 'silent'
    detail: null,
  };
}

function queueOf(state, partId, port) {
  const byPart = (state.queues[partId] ??= {});
  return (byPart[port] ??= []);
}

function hasQueuedWords(state) {
  return Object.values(state.queues).some((ports) =>
    Object.values(ports).some((queue) => queue.length));
}

function simultaneousInputCollision(machine, arrivals) {
  const byInput = new Map();
  for (const arrival of arrivals) {
    const { part, port } = machine.wires[arrival.wireIndex].to;
    const junction = byId(machine, part)?.kind === 'junction';
    const collisionPort = junction ? 'junction inputs' : port;
    const key = `${arrival.arrive}\u0000${part}\u0000${collisionPort}`;
    const group = byInput.get(key) ?? {
      arrive: arrival.arrive, part, port: collisionPort, arrivals: [],
    };
    group.arrivals.push(arrival);
    byInput.set(key, group);
  }
  return [...byInput.values()]
    .filter((group) => group.arrivals.length > 1)
    .sort((a, b) => a.arrive - b.arrive || a.part.localeCompare(b.part) || a.port.localeCompare(b.port))[0];
}

function send(machine, state, partId, port, word, t) {
  const wi = outWireIndex(machine, partId, port);
  state.transit.push({ wireIndex: wi, word, depart: t, arrive: t + wireTicks(machine, machine.wires[wi]) });
}

function sour(state, resId, text) {
  state.verdict = 'sour';
  state.detail = text;
  state.souredAt = resId;
}

// Fire one part once, if it can. Returns true when something happened.
// A part that has input but cannot act records why in state.stalls.
function firePart(machine, kase, state, part, t, ev) {
  const { id, kind, config = {} } = part;
  const stall = (reason) => { state.stalls.push({ part: id, reason }); return false; };
  const wired = (port) => outWireIndex(machine, id, port) >= 0;
  // state.mute skips narration only: the search harness runs this engine
  // hundreds of thousands of times, and formatting event strings nobody reads
  // would dominate the cost. Verdicts, details and stalls are never muted.
  const say = (line) => { if (!state.mute) ev.push(line); };

  if (kind === 'quill') {
    if (state.emitted[id]) return false;
    const seed = kase.seeds[id];
    if (seed === undefined) { state.emitted[id] = true; return false; }
    if (!wired('out')) return stall('its out port has no track: it cannot release the word marble');
    state.emitted[id] = true;
    send(machine, state, id, 'out', seed, t);
    say(`${label(machine, id)} transcribed sound ${prettyWord(seed)} into a word marble`);
    return true;
  }

  if (kind === 'resonator') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    const w = q.shift();
    const want = kase.targets[id];
    if (want === undefined) { sour(state, id, `${label(machine, id)} sounded when it should have stayed silent: word marble ${prettyWord(w)} arrived`); return true; }
    if (state.satisfied[id] !== undefined) { sour(state, id, `${label(machine, id)} had already sounded, then a second word marble arrived: ${prettyWord(w)}`); return true; }
    if (w === want) {
      state.satisfied[id] = w;
      say(`${label(machine, id)} turned word marble ${prettyWord(w)} into sound waves`);
    } else {
      sour(state, id, `${label(machine, id)} expected target word ${prettyWord(want)} but received ${prettyWord(w)}`);
    }
    return true;
  }

  if (kind === 'mould') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    if (!wired('out')) return stall('its out port has no track');
    const w = q.shift();
    send(machine, state, id, 'out', w + config.note, t);
    say(`${label(machine, id)} added note ${config.note}: ${prettyWord(w)} → ${prettyWord(w + config.note)}`);
    return true;
  }

  if (kind === 'damper') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    if (!wired('out')) return stall('its out port has no track');
    if (q[0] === '') return stall('its word marble is empty: there is no lead note to remove');
    const w = q.shift();
    send(machine, state, id, 'out', w.slice(1), t);
    say(`${label(machine, id)} removed lead note ${w[0]}: ${prettyWord(w)} → ${prettyWord(w.slice(1))}`);
    return true;
  }

  if (kind === 'valve') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    if (!wired('out')) return stall('its out port has no track');
    const w = q.shift();
    state.holds.push({ part: id, word: w, release: t + config.delay });
    say(`${label(machine, id)} holds word marble ${prettyWord(w)} for ${config.delay} tick${config.delay === 1 ? '' : 's'}`);
    return true;
  }

  if (kind === 'unison') {
    const lead = queueOf(state, id, 'lead');
    const tail = queueOf(state, id, 'tail');
    if (!lead.length && !tail.length) return false;
    if (!lead.length) return stall('its tail seat is taken but the lead seat is empty');
    if (!tail.length) return stall('its lead seat is taken but the tail seat is empty');
    if (!wired('out')) return stall('its out port has no track');
    const w = lead.shift(), v = tail.shift();
    send(machine, state, id, 'out', w + v, t);
    say(`${label(machine, id)} joined word marbles ${prettyWord(w)} + ${prettyWord(v)} → ${prettyWord(w + v)}`);
    return true;
  }

  if (kind === 'splitter') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    const k = config.k;
    if (q[0].length < k) return stall(`its word marble ${prettyWord(q[0])} is shorter than the cut after note ${k}`);
    if (!wired('head')) return stall('its head exit has no track');
    if (!wired('rest')) return stall('its rest exit has no track');
    const w = q.shift();
    send(machine, state, id, 'head', w.slice(0, k), t);
    send(machine, state, id, 'rest', w.slice(k), t);
    say(`${label(machine, id)} split after note ${k}: ${prettyWord(w)} → ${prettyWord(w.slice(0, k))} | ${prettyWord(w.slice(k))}`);
    return true;
  }

  if (kind === 'fork') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    // The internal left/right IDs back the player-facing match/other branches.
    // An empty word does not match and therefore exits through other.
    const match = q[0].length > 0 && q[0][0] === config.note;
    const dir = match ? 'left' : 'right';
    const branch = match ? 'match' : 'other';
    if (!wired(dir)) return stall(`its ${branch} exit has no track and that is where ${prettyWord(q[0])} must go`);
    let w = q.shift();
    if (match && config.mode === 'consume') {
      say(`${label(machine, id)} bit off lead note ${config.note}: ${prettyWord(w)} → ${prettyWord(w.slice(1))}, exits through match`);
      w = w.slice(1);
    } else {
      say(`${label(machine, id)} read the lead note of ${prettyWord(w)}: ${match ? config.note + ': exits through match' : 'not ' + config.note + ': exits through other'}`);
    }
    send(machine, state, id, dir, w, t);
    return true;
  }

  if (kind === 'coupling') {
    const qa = queueOf(state, id, 'inA');
    const qb = queueOf(state, id, 'inB');
    if (!qa.length && !qb.length) return false;
    if (!qa.length) return stall('side B has a word marble but side A has not arrived: a coupling waits for both');
    if (!qb.length) return stall('side A has a word marble but side B has not arrived: a coupling waits for both');
    const wa = qa[0], wb = qb[0];
    const dirA = wb.length > 0 && wb[0] === config.noteA ? 'outAL' : 'outAR';
    const dirB = wa.length > 0 && wa[0] === config.noteB ? 'outBL' : 'outBR';
    if (!wired(dirA)) return stall(`side A must exit ${dirA.slice(3)} and that port has no track`);
    if (!wired(dirB)) return stall(`side B must exit ${dirB.slice(3)} and that port has no track`);
    qa.shift(); qb.shift();
    send(machine, state, id, dirA, wa, t);
    send(machine, state, id, dirB, wb, t);
    say(`${label(machine, id)} released both word marbles: ${prettyWord(wa)} exits ${dirA.slice(3)} (other lead ${wb[0] ?? '∅'}), ${prettyWord(wb)} exits ${dirB.slice(3)} (other lead ${wa[0] ?? '∅'})`);
    return true;
  }

  if (kind === 'crossing') {
    let moved = false;
    for (const [input, output, name] of [
      ['inA', 'outA', 'horizontal'],
      ['outA', 'inA', 'horizontal'],
      ['inB', 'outB', 'vertical'],
      ['outB', 'inB', 'vertical'],
    ]) {
      const q = queueOf(state, id, input);
      if (!q.length) continue;
      if (!wired(output)) {
        stall(`its opposite ${name} socket has no track`);
        continue;
      }
      const w = q.shift();
      send(machine, state, id, output, w, t);
      say(`${label(machine, id)} carried word marble ${prettyWord(w)} straight through its ${name} channel`);
      moved = true;
    }
    return moved;
  }

  if (kind === 'junction') {
    const qa = queueOf(state, id, 'inA');
    const qb = queueOf(state, id, 'inB');
    if (!qa.length && !qb.length) return false;
    if (!wired('out')) return stall('its out port has no track');
    const source = qa.length ? 'A' : 'B';
    const w = (qa.length ? qa : qb).shift();
    send(machine, state, id, 'out', w, t);
    say(`${label(machine, id)} passed word marble ${prettyWord(w)} from input ${source}`);
    return true;
  }

  return false;
}

export function stepRun(machine, kase, state, maxTicks = 200) {
  if (state.verdict) return [];
  state.tick += 1;
  const t = state.tick;
  state.stalls = [];
  const ev = [];
  let activity = 0;

  // Deliveries first. An input refuses two or more words arriving together.
  const due = state.transit.filter((x) => x.arrive <= t);
  state.transit = state.transit.filter((x) => x.arrive > t);
  const collision = due.length > 1 ? simultaneousInputCollision(machine, due) : undefined;
  if (collision) {
    const words = collision.arrivals.map((arrival) => prettyWord(arrival.word)).sort();
    state.verdict = 'silent';
    const where = collision.port === 'junction inputs'
      ? 'at its two inputs'
      : `at its ${collision.port} input`;
    state.detail = `${label(machine, collision.part)} refused ${words.length} word marbles arriving simultaneously ${where} on tick ${collision.arrive}: ${words.join(', ')}`;
    return ev;
  }
  for (const d of due) {
    const w = machine.wires[d.wireIndex];
    queueOf(state, w.to.part, w.to.port).push(d.word);
    state.usedWires.add(d.wireIndex);
    activity += 1;
  }

  // Valves release onto their out wire.
  const released = state.holds.filter((h) => h.release <= t);
  state.holds = state.holds.filter((h) => h.release > t);
  for (const h of released) {
    send(machine, state, h.part, 'out', h.word, t);
    if (!state.mute) ev.push(`${label(machine, h.part)} releases word marble ${prettyWord(h.word)}`);
    activity += 1;
  }

  for (const part of machine.parts) {
    if (firePart(machine, kase, state, part, t, ev)) activity += 1;
    if (state.verdict) break;
  }

  if (!state.verdict) {
    const requiredResonators = Object.keys(kase.targets).filter((id) => kase.targets[id] !== undefined);
    const seededQuills = Object.keys(kase.seeds).filter((id) => kase.seeds[id] !== undefined);
    const emissionsComplete = seededQuills.every((id) => state.emitted[id]);
    const settled = emissionsComplete && !state.transit.length && !state.holds.length && !hasQueuedWords(state);
    if (settled && requiredResonators.length &&
        requiredResonators.every((id) => state.satisfied[id] === kase.targets[id])) {
      state.verdict = 'resonant';
      state.detail = 'every resonator rang true';
      state.stalls = []; // a machine that reached its target blames nobody
    } else {
      if (!activity && !state.transit.length && !state.holds.length) {
        state.verdict = 'silent';
        state.detail = 'nothing will ever move again';
      } else if (t >= maxTicks) {
        state.verdict = 'silent';
        state.detail = `still running at tick ${t}: patience ran out`;
      }
    }
  }

  for (const line of ev) state.events.push(`t${t} · ${line}`);
  return ev;
}

export function runCase(machine, kase, maxTicks = 200) {
  const state = makeRun();
  while (!state.verdict && state.tick <= maxTicks) stepRun(machine, kase, state, maxTicks);
  return state;
}
