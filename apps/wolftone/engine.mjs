// Wolf Tone: the whole physics in one DOM-free file, so the ladder test can
// run every reference build headlessly. A string is a word over the note
// alphabet; every part is a partial function on words; where the function is
// undefined the word waits, and the run says which part is waiting and why.
//
// PROTOTYPE: throwaway. It answers "does strings-are-tapes play?", not
// "how should this be built".

export const NOTES = ['A', 'B', 'C', 'D'];

export const PORTS = {
  quill:     { ins: [],               outs: ['out'] },
  mould:     { ins: ['in'],           outs: ['out'] },
  damper:    { ins: ['in'],           outs: ['out'] },
  valve:     { ins: ['in'],           outs: ['out'] },
  unison:    { ins: ['lead', 'tail'], outs: ['out'] },
  splitter:  { ins: ['in'],           outs: ['head', 'rest'] },
  fork:      { ins: ['in'],           outs: ['left', 'right'] },
  coupling:  { ins: ['inA', 'inB'],   outs: ['outAL', 'outAR', 'outBL', 'outBR'] },
  resonator: { ins: ['in'],           outs: [] },
};

export const KIND_NAMES = {
  quill: 'Quill', mould: 'Mould', damper: 'Damper', valve: 'Valve',
  unison: 'Unison', splitter: 'Splitter', fork: 'Tuning fork',
  coupling: 'Coupling', resonator: 'Resonator',
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

// Travel time is the Manhattan distance between the two parts' cells, min 1.
// Geometry is timing; the chip drawn on a wire is this number.
export function wireTicks(machine, wire) {
  const a = byId(machine, wire.from.part);
  const b = byId(machine, wire.to.part);
  return Math.max(1, Math.abs(a.x - b.x) + Math.abs(a.y - b.y));
}

// Player construction and fixed commission scaffolding share one complete
// machine at runtime, so the caller supplies the player-only count explicitly.
export function measureScore(machine, { playerPartCount, runs = null }) {
  const allResonant = runs?.length && runs.every((run) => run.verdict === 'resonant');
  return {
    parts: playerPartCount,
    wire: machine.wires.reduce((total, wire) => total + wireTicks(machine, wire), 0),
    time: allResonant ? Math.max(...runs.map((run) => run.tick)) : null,
  };
}

export function mergeBestScore(previous, candidate) {
  if (!previous) return { ...candidate };
  return {
    parts: Math.min(previous.parts, candidate.parts),
    wire: Math.min(previous.wire, candidate.wire),
    time: previous.time === null ? candidate.time
      : candidate.time === null ? previous.time
        : Math.min(previous.time, candidate.time),
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
    const key = `${arrival.arrive}\u0000${part}\u0000${port}`;
    const group = byInput.get(key) ?? { arrive: arrival.arrive, part, port, arrivals: [] };
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
    if (!wired('out')) return stall('its out port is unwired: the seed cannot sound');
    state.emitted[id] = true;
    send(machine, state, id, 'out', seed, t);
    say(`${label(machine, id)} sounded ${prettyWord(seed)}`);
    return true;
  }

  if (kind === 'resonator') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    const w = q.shift();
    const want = kase.targets[id];
    if (want === undefined) { sour(state, id, `${label(machine, id)} rang when it should have stayed silent this performance: it got ${prettyWord(w)}`); return true; }
    if (state.satisfied[id] !== undefined) { sour(state, id, `${label(machine, id)} had already rung true, then a second string arrived: ${prettyWord(w)}`); return true; }
    if (w === want) {
      state.satisfied[id] = w;
      say(`${label(machine, id)} rang true: ${prettyWord(w)}`);
    } else {
      sour(state, id, `${label(machine, id)} wanted ${prettyWord(want)} and got ${prettyWord(w)}`);
    }
    return true;
  }

  if (kind === 'mould') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    if (!wired('out')) return stall('its out port is unwired');
    const w = q.shift();
    send(machine, state, id, 'out', w + config.note, t);
    say(`${label(machine, id)} sang ${config.note} onto the tail: ${prettyWord(w)} → ${prettyWord(w + config.note)}`);
    return true;
  }

  if (kind === 'damper') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    if (!wired('out')) return stall('its out port is unwired');
    if (q[0] === '') return stall('its string is empty: there is no head note to damp');
    const w = q.shift();
    send(machine, state, id, 'out', w.slice(1), t);
    say(`${label(machine, id)} damped the head ${w[0]}: ${prettyWord(w)} → ${prettyWord(w.slice(1))}`);
    return true;
  }

  if (kind === 'valve') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    if (!wired('out')) return stall('its out port is unwired');
    const w = q.shift();
    state.holds.push({ part: id, word: w, release: t + config.delay });
    say(`${label(machine, id)} holds ${prettyWord(w)} for ${config.delay} tick${config.delay === 1 ? '' : 's'}`);
    return true;
  }

  if (kind === 'unison') {
    const lead = queueOf(state, id, 'lead');
    const tail = queueOf(state, id, 'tail');
    if (!lead.length && !tail.length) return false;
    if (!lead.length) return stall('its tail seat is taken but the lead seat is empty');
    if (!tail.length) return stall('its lead seat is taken but the tail seat is empty');
    if (!wired('out')) return stall('its out port is unwired');
    const w = lead.shift(), v = tail.shift();
    send(machine, state, id, 'out', w + v, t);
    say(`${label(machine, id)} merged ${prettyWord(w)} + ${prettyWord(v)} → ${prettyWord(w + v)}`);
    return true;
  }

  if (kind === 'splitter') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    const k = config.k;
    if (q[0].length < k) return stall(`its string ${prettyWord(q[0])} is shorter than the cut at k=${k}`);
    if (!wired('head')) return stall('its head exit is unwired');
    if (!wired('rest')) return stall('its rest exit is unwired');
    const w = q.shift();
    send(machine, state, id, 'head', w.slice(0, k), t);
    send(machine, state, id, 'rest', w.slice(k), t);
    say(`${label(machine, id)} cut at ${k}: ${prettyWord(w)} → ${prettyWord(w.slice(0, k))} | ${prettyWord(w.slice(k))}`);
    return true;
  }

  if (kind === 'fork') {
    const q = queueOf(state, id, 'in');
    if (!q.length) return false;
    // L iff w = a_f · w'. An empty word is not of that form: it exits right.
    const match = q[0].length > 0 && q[0][0] === config.note;
    const dir = match ? 'left' : 'right';
    if (!wired(dir)) return stall(`its ${dir} exit is unwired and that is where ${prettyWord(q[0])} must go`);
    let w = q.shift();
    if (match && config.mode === 'consume') {
      say(`${label(machine, id)} read ${config.note} and BIT it off: ${prettyWord(w)} → ${prettyWord(w.slice(1))}, exits left`);
      w = w.slice(1);
    } else {
      say(`${label(machine, id)} read the head of ${prettyWord(w)}: ${match ? config.note + ': exits left' : 'not ' + config.note + ': exits right'}`);
    }
    send(machine, state, id, dir, w, t);
    return true;
  }

  if (kind === 'coupling') {
    const qa = queueOf(state, id, 'inA');
    const qb = queueOf(state, id, 'inB');
    if (!qa.length && !qb.length) return false;
    if (!qa.length) return stall('side B has a string but side A has not arrived: a coupling waits for both');
    if (!qb.length) return stall('side A has a string but side B has not arrived: a coupling waits for both');
    const wa = qa[0], wb = qb[0];
    const dirA = wb.length > 0 && wb[0] === config.noteA ? 'outAL' : 'outAR';
    const dirB = wa.length > 0 && wa[0] === config.noteB ? 'outBL' : 'outBR';
    if (!wired(dirA)) return stall(`side A must exit ${dirA === 'outAL' ? 'left' : 'right'} and that port is unwired`);
    if (!wired(dirB)) return stall(`side B must exit ${dirB === 'outBL' ? 'left' : 'right'} and that port is unwired`);
    qa.shift(); qb.shift();
    send(machine, state, id, dirA, wa, t);
    send(machine, state, id, dirB, wb, t);
    say(`${label(machine, id)} released both: ${prettyWord(wa)} exits ${dirA === 'outAL' ? 'left' : 'right'} (other head ${wb[0] ?? '∅'}), ${prettyWord(wb)} exits ${dirB === 'outBL' ? 'left' : 'right'} (other head ${wa[0] ?? '∅'})`);
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
    state.detail = `${label(machine, collision.part)} refused ${words.length} words arriving simultaneously at its ${collision.port} input on tick ${collision.arrive}: ${words.join(', ')}`;
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
    if (!state.mute) ev.push(`${label(machine, h.part)} releases ${prettyWord(h.word)}`);
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
