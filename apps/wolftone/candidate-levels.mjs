// Nine v0.9 campaign contracts: four compositional foundations followed by
// five deep contracts promoted from the behavior repertoire. The player sees
// only performances and a broad-enough palette. Logical laws, alternate
// architectures, mining bounds, and routed score evidence remain attached here
// for tests and author review.

import { measureScore, runCase } from './engine.mjs?v=0.9.0-6';
import { spatializeReference } from './reference-spatializer.mjs?v=0.9.0-6';

const CHAPTER = 'II · Campaign';
const TERMINAL_KINDS = new Set(['quill', 'resonator']);

const wire = (fromPart, fromPort, toPart, toPort) => ({
  from: { part: fromPart, port: fromPort },
  to: { part: toPart, port: toPort },
});

const fork = (id, note, x, y) => ({
  id,
  kind: 'fork',
  x,
  y,
  config: { note, mode: 'consume' },
});

const singleVoiceBench = () => [
  { id: 'q1', kind: 'quill', x: 1, y: 3 },
  { id: 'r1', kind: 'resonator', x: 9, y: 3 },
];

const refrainBench = () => [
  { id: 'q1', kind: 'quill', x: 1, y: 0 },
  { id: 'r1', kind: 'resonator', x: 9, y: 3 },
];

const fanoutBench = () => [
  { id: 'q1', kind: 'quill', x: 1, y: 0 },
  { id: 'rA', kind: 'resonator', x: 9, y: 1, label: 'lower ledger' },
  { id: 'rB', kind: 'resonator', x: 9, y: 2, label: 'upper ledger' },
];

const mergerBench = () => [
  { id: 'qA', kind: 'quill', x: 1, y: 0, label: 'first voice' },
  { id: 'qB', kind: 'quill', x: 1, y: 1, label: 'second voice' },
  { id: 'r1', kind: 'resonator', x: 9, y: 2 },
];

const phaseBench = () => [
  { id: 'q1', kind: 'quill', x: 1, y: 0 },
  { id: 'rA', kind: 'resonator', x: 9, y: 1, label: 'hall A' },
  { id: 'rC', kind: 'resonator', x: 9, y: 3, label: 'hall C' },
  { id: 'rB', kind: 'resonator', x: 9, y: 4, label: 'hall B' },
];

function optionalDeck(observation, nudge) {
  return [
    {
      focus: 'commission',
      title: 'Compare every performance',
      body: observation,
    },
    {
      focus: 'board',
      title: 'Optional nudge',
      body: nudge,
    },
  ];
}

function cloneMachine(machine) {
  return {
    parts: machine.parts.map((part) => structuredClone(part)),
    wires: machine.wires.map((route) => structuredClone(route)),
  };
}

function shiftMachine(machine, x, y) {
  const shifted = cloneMachine(machine);
  for (const part of shifted.parts) {
    part.x += x;
    part.y += y;
  }
  for (const route of shifted.wires) {
    route.route = route.route.map((cell) => ({ x: cell.x + x, y: cell.y + y }));
  }
  return shifted;
}

function routeWitness(level, witness) {
  const routed = spatializeReference({
    ...level,
    id: `${level.id}--${witness.id}`,
    reference: witness.build,
  });
  const machine = {
    parts: [...routed.fixed, ...routed.reference.parts],
    wires: routed.reference.wires.map((route, index) => ({
      id: `${witness.id}-w${index}`,
      ...route,
    })),
  };
  const runs = level.cases.map((performance) => runCase(machine, performance));
  const failure = runs.find((run) => run.verdict !== 'resonant');
  if (failure) throw new Error(`${level.id}/${witness.id}: ${failure.detail}`);
  const componentCost = machine.parts.filter((part) => !TERMINAL_KINDS.has(part.kind)).length;
  return {
    ...witness,
    board: routed.board,
    machine,
    score: measureScore(machine, { componentCost, runs }),
    routing: {
      spacing: routed.spatial.spacing,
      crossings: routed.spatial.crossings,
      junctions: routed.spatial.junctions,
      method: 'deterministic placement; up to 64 route orders per spacing',
    },
  };
}

function dominates(left, right) {
  const axes = ['cost', 'time', 'area'];
  return axes.every((axis) => left[axis] <= right[axis])
    && axes.some((axis) => left[axis] < right[axis]);
}

function promotedContract({
  architectures,
  observation,
  nudge,
  evidence,
  difficulty,
  foundation = false,
  ...contract
}) {
  const routed = architectures.map((architecture) => routeWitness(contract, architecture));
  const board = {
    cols: Math.max(...routed.map((architecture) => architecture.board.cols)),
    rows: Math.max(...routed.map((architecture) => architecture.board.rows)),
  };
  const fixedIds = new Set(contract.fixed.map((part) => part.id));
  const padded = routed.map((architecture) => {
    const offset = {
      x: Math.floor((board.cols - architecture.board.cols) / 2),
      y: Math.floor((board.rows - architecture.board.rows) / 2),
    };
    return {
      ...architecture,
      board,
      offset,
      machine: shiftMachine(architecture.machine, offset.x, offset.y),
    };
  });
  const frontier = padded.filter((candidate) =>
    !padded.some((other) => other !== candidate && dominates(other.score, candidate.score)));
  if (!foundation && frontier.length < 2) {
    const scores = padded.map(({ id, score }) => `${id}=${JSON.stringify(score)}`).join(', ');
    throw new Error(`${contract.id}: fewer than two spatially competitive witnesses (${scores})`);
  }

  const primary = frontier[0];
  const fixed = primary.machine.parts.filter((part) => fixedIds.has(part.id));
  const parts = primary.machine.parts.filter((part) => !fixedIds.has(part.id));
  return {
    ...contract,
    chapter: CHAPTER,
    board,
    boardMount: {
      profile: 'spatial',
      source: contract.board,
      offset: primary.offset,
    },
    fixed,
    reference: {
      parts,
      wires: primary.machine.wires.map(({ id, ...route }) => route),
    },
    architectures: padded.map((architecture) => ({
      id: architecture.id,
      title: architecture.title,
      graphClass: architecture.graphClass,
      logicalBuild: architecture.build,
      board: architecture.board,
      machine: architecture.machine,
      score: architecture.score,
      routing: architecture.routing,
      competitive: frontier.includes(architecture),
    })),
    spatial: {
      ...primary.routing,
      fixedBoard: true,
      production: true,
      witnessCount: padded.length,
      competitiveWitnesses: frontier.length,
    },
    meta: {
      tier: foundation ? 'foundation-contract' : 'deep-contract',
      difficulty,
      optional: false,
      referenceIsWitness: true,
      promotedContract: true,
      requiresCompetitiveWitnesses: !foundation,
      sourceCandidate: evidence.sourceCandidate,
      promotion: evidence,
    },
    walkthrough: optionalDeck(observation, nudge),
  };
}

const leadingBench = () => [
  { id: 'q1', kind: 'quill', x: 1, y: 0 },
  { id: 'r1', kind: 'resonator', x: 9, y: 2 },
];

const leadingAppendTest = {
  id: 'leading-append-test',
  title: 'Append, then test',
  graphClass: 'append-then-test',
  build: {
    parts: [
      { id: 'mA', kind: 'mould', x: 3, y: 1, config: { note: 'A' } },
      { id: 'fA', kind: 'fork', x: 6, y: 3, config: { note: 'A', mode: 'consume' } },
    ],
    wires: [
      wire('q1', 'out', 'mA', 'in'),
      wire('mA', 'out', 'fA', 'in'),
      wire('fA', 'left', 'r1', 'in'),
      wire('fA', 'right', 'r1', 'in'),
    ],
  },
};

const leadingTestAppend = {
  id: 'leading-test-append',
  title: 'Test, then append',
  graphClass: 'test-then-append',
  build: {
    parts: [
      { id: 'mA', kind: 'mould', x: 3, y: 1, config: { note: 'A' } },
      { id: 'fA', kind: 'fork', x: 6, y: 3, config: { note: 'A', mode: 'consume' } },
    ],
    wires: [
      wire('q1', 'out', 'fA', 'in'),
      wire('fA', 'left', 'mA', 'in'),
      wire('fA', 'right', 'mA', 'in'),
      wire('mA', 'out', 'r1', 'in'),
    ],
  },
};

const firstVoicesBench = () => [
  { id: 'qA', kind: 'quill', x: 1, y: 0, label: 'tail voice' },
  { id: 'r1', kind: 'resonator', x: 9, y: 2 },
  { id: 'qB', kind: 'quill', x: 1, y: 3, label: 'lead voice' },
];

const twinCadencesBench = () => [
  { id: 'q1', kind: 'quill', x: 1, y: 0 },
  { id: 'rA', kind: 'resonator', x: 9, y: 1, label: 'first cadence' },
  { id: 'rB', kind: 'resonator', x: 9, y: 3, label: 'following cadence' },
];

const firstVoicesDirect = {
  id: 'first-voices-direct',
  title: 'Direct normalization',
  graphClass: 'branch-and-merge',
  build: {
    parts: [
      { id: 'u1', kind: 'unison', x: 6, y: 1 },
      { id: 'fC', kind: 'fork', x: 3, y: 4, config: { note: 'C', mode: 'consume' } },
    ],
    wires: [
      wire('qA', 'out', 'u1', 'tail'),
      wire('qB', 'out', 'fC', 'in'),
      wire('fC', 'left', 'u1', 'lead'),
      wire('fC', 'right', 'u1', 'lead'),
      wire('u1', 'out', 'r1', 'in'),
    ],
  },
};

const firstVoicesFeedback = {
  id: 'first-voices-feedback',
  title: 'Feedback normalizer',
  graphClass: 'feedback-normalizer',
  build: {
    parts: [
      { id: 'u1', kind: 'unison', x: 6, y: 1 },
      { id: 'fC', kind: 'fork', x: 3, y: 4, config: { note: 'C', mode: 'consume' } },
    ],
    wires: [
      wire('qA', 'out', 'u1', 'tail'),
      wire('qB', 'out', 'fC', 'in'),
      wire('fC', 'left', 'fC', 'in'),
      wire('fC', 'right', 'u1', 'lead'),
      wire('u1', 'out', 'r1', 'in'),
    ],
  },
};

const turningPhraseDirect = {
  id: 'turning-phrase-direct',
  title: 'Direct turn',
  graphClass: 'split-and-turn',
  build: {
    parts: [
      { id: 's1', kind: 'splitter', x: 3, y: 1, config: { k: 1 } },
      { id: 'u1', kind: 'unison', x: 6, y: 3 },
    ],
    wires: [
      wire('q1', 'out', 's1', 'in'),
      wire('s1', 'rest', 'u1', 'lead'),
      wire('s1', 'head', 'u1', 'tail'),
      wire('u1', 'out', 'r1', 'in'),
    ],
  },
};

const turningPhraseExpanded = {
  id: 'turning-phrase-expanded',
  title: 'Expanded turn',
  graphClass: 'decompose-and-turn',
  build: {
    parts: [
      { id: 's1', kind: 'splitter', x: 3, y: 1, config: { k: 1 } },
      { id: 's2', kind: 'splitter', x: 5, y: 4, config: { k: 1 } },
      { id: 'u1', kind: 'unison', x: 7, y: 4 },
      { id: 'u2', kind: 'unison', x: 8, y: 2 },
    ],
    wires: [
      wire('q1', 'out', 's1', 'in'),
      wire('s1', 'rest', 's2', 'in'),
      wire('s2', 'head', 'u1', 'lead'),
      wire('s2', 'rest', 'u1', 'tail'),
      wire('u1', 'out', 'u2', 'lead'),
      wire('s1', 'head', 'u2', 'tail'),
      wire('u2', 'out', 'r1', 'in'),
    ],
  },
};

const twinCadencesSplitFirst = {
  id: 'twin-cadences-split-first',
  title: 'Split, then append',
  graphClass: 'split-then-append',
  build: {
    parts: [
      { id: 's1', kind: 'splitter', x: 3, y: 2, config: { k: 1 } },
      { id: 'mA', kind: 'mould', x: 6, y: 4, config: { note: 'A' } },
    ],
    wires: [
      wire('q1', 'out', 's1', 'in'),
      wire('s1', 'head', 'rA', 'in'),
      wire('s1', 'rest', 'mA', 'in'),
      wire('mA', 'out', 'rB', 'in'),
    ],
  },
};

const twinCadencesAppendFirst = {
  id: 'twin-cadences-append-first',
  title: 'Append, then split',
  graphClass: 'append-then-split',
  build: {
    parts: [
      { id: 'mA', kind: 'mould', x: 3, y: 2, config: { note: 'A' } },
      { id: 's1', kind: 'splitter', x: 6, y: 2, config: { k: 1 } },
    ],
    wires: [
      wire('q1', 'out', 'mA', 'in'),
      wire('mA', 'out', 's1', 'in'),
      wire('s1', 'head', 'rA', 'in'),
      wire('s1', 'rest', 'rB', 'in'),
    ],
  },
};

const fanoutPeek = {
  id: 'two-ledgers-branch',
  title: 'Branch and merge',
  graphClass: 'branch-and-merge',
  build: {
    parts: [
      { id: 's1', kind: 'splitter', x: 3, y: 3, config: { k: 1 } },
      { id: 'fB', kind: 'fork', x: 5, y: 5, config: { note: 'B', mode: 'peek' } },
      { id: 'mB', kind: 'mould', x: 7, y: 4, config: { note: 'B' } },
    ],
    wires: [
      wire('q1', 'out', 's1', 'in'),
      wire('s1', 'head', 'fB', 'in'),
      wire('s1', 'rest', 'rA', 'in'),
      wire('fB', 'left', 'rB', 'in'),
      wire('fB', 'right', 'mB', 'in'),
      wire('mB', 'out', 'rB', 'in'),
    ],
  },
};

const fanoutFeedback = {
  id: 'two-ledgers-feedback',
  title: 'Bite and return',
  graphClass: 'feedback-normalizer',
  build: {
    parts: [
      { id: 's1', kind: 'splitter', x: 3, y: 3, config: { k: 1 } },
      { id: 'fB', kind: 'fork', x: 5, y: 4, config: { note: 'B', mode: 'consume' } },
      { id: 'mB', kind: 'mould', x: 7, y: 5, config: { note: 'B' } },
    ],
    wires: [
      wire('q1', 'out', 's1', 'in'),
      wire('s1', 'head', 'fB', 'in'),
      wire('s1', 'rest', 'rA', 'in'),
      wire('fB', 'left', 'fB', 'in'),
      wire('fB', 'right', 'mB', 'in'),
      wire('mB', 'out', 'rB', 'in'),
    ],
  },
};

const mergerBranch = {
  id: 'counterpoint-branch',
  title: 'Conditional tail',
  graphClass: 'branch-and-merge',
  build: {
    parts: [
      { id: 'u1', kind: 'unison', x: 7, y: 5 },
      { id: 'fC', kind: 'fork', x: 3, y: 3, config: { note: 'C', mode: 'peek' } },
      { id: 'mC', kind: 'mould', x: 5, y: 4, config: { note: 'C' } },
    ],
    wires: [
      wire('qA', 'out', 'fC', 'in'),
      wire('qB', 'out', 'u1', 'lead'),
      wire('fC', 'left', 'u1', 'tail'),
      wire('fC', 'right', 'mC', 'in'),
      wire('mC', 'out', 'u1', 'tail'),
      wire('u1', 'out', 'r1', 'in'),
    ],
  },
};

const mergerFeedback = {
  id: 'counterpoint-feedback',
  title: 'Feedback normalizer',
  graphClass: 'feedback-normalizer',
  build: {
    parts: [
      { id: 'u1', kind: 'unison', x: 7, y: 3 },
      { id: 'fC', kind: 'fork', x: 3, y: 5, config: { note: 'C', mode: 'consume' } },
      { id: 'mC', kind: 'mould', x: 8, y: 4, config: { note: 'C' } },
    ],
    wires: [
      wire('qA', 'out', 'fC', 'in'),
      wire('fC', 'left', 'fC', 'in'),
      wire('fC', 'right', 'u1', 'tail'),
      wire('qB', 'out', 'u1', 'lead'),
      wire('u1', 'out', 'mC', 'in'),
      wire('mC', 'out', 'r1', 'in'),
    ],
  },
};

const alternatingLoop = {
  id: 'long-bow-loop',
  title: 'Alternating loop',
  graphClass: 'feedback-loop',
  build: {
    parts: [fork('fB', 'B', 4, 2), fork('fA', 'A', 6, 4)],
    wires: [
      wire('q1', 'out', 'fB', 'in'),
      wire('fB', 'left', 'fA', 'in'),
      wire('fB', 'right', 'r1', 'in'),
      wire('fA', 'left', 'fB', 'in'),
      wire('fA', 'right', 'r1', 'in'),
    ],
  },
};

const alternatingLine = {
  id: 'long-bow-line',
  title: 'Unrolled alternation',
  graphClass: 'finite-unrolling',
  build: {
    parts: [
      fork('fB1', 'B', 3, 3),
      fork('fA', 'A', 5, 3),
      fork('fB2', 'B', 7, 3),
    ],
    wires: [
      wire('q1', 'out', 'fB1', 'in'),
      wire('fB1', 'left', 'fA', 'in'),
      wire('fB1', 'right', 'r1', 'in'),
      wire('fA', 'left', 'fB2', 'in'),
      wire('fA', 'right', 'r1', 'in'),
      wire('fB2', 'left', 'r1', 'in'),
      wire('fB2', 'right', 'r1', 'in'),
    ],
  },
};

function refrainLoop({ routed = false } = {}) {
  const positions = routed
    ? { A: 2, B: 5, C: 6 }
    : { A: 1, B: 2, C: 4 };
  return {
    id: routed ? 'three-doors-loop' : 'after-refrain-loop',
    title: 'Cyclic refrain scanner',
    graphClass: 'feedback-loop',
    build: {
      parts: [
        fork('fA', 'A', 3, positions.A),
        fork('fB', 'B', 5, positions.B),
        fork('fC', 'C', 7, positions.C),
      ],
      wires: [
        wire('q1', 'out', 'fA', 'in'),
        wire('fA', 'left', 'fB', 'in'),
        wire('fA', 'right', routed ? 'rA' : 'r1', 'in'),
        wire('fB', 'left', 'fC', 'in'),
        wire('fB', 'right', routed ? 'rB' : 'r1', 'in'),
        wire('fC', 'left', 'fA', 'in'),
        wire('fC', 'right', routed ? 'rC' : 'r1', 'in'),
      ],
    },
  };
}

function refrainLine({ routed = false } = {}) {
  const notes = ['A', 'B', 'C', 'A', 'B', 'C'];
  // These authoring rows encode the best physical placement orders found by
  // an exhaustive 6! screen, constrained to remain faster than each loop.
  const rows = routed ? [5, 6, 7, 8, 9, 2] : [1, 5, 6, 7, 2, 4];
  const parts = notes.map((note, index) => fork(`f${index}`, note, 2 + index, rows[index]));
  const wires = [wire('q1', 'out', 'f0', 'in')];
  notes.forEach((note, index) => {
    const current = `f${index}`;
    const mismatch = routed ? `r${note}` : 'r1';
    wires.push(wire(current, 'right', mismatch, 'in'));
    if (index < notes.length - 1) {
      wires.push(wire(current, 'left', `f${index + 1}`, 'in'));
    } else {
      wires.push(wire(current, 'left', routed ? 'rA' : 'r1', 'in'));
    }
  });
  return {
    id: routed ? 'three-doors-line' : 'after-refrain-line',
    title: 'Six-test unrolling',
    graphClass: 'finite-unrolling',
    build: { parts, wires },
  };
}

export const CANDIDATE_LEVELS = [
  promotedContract({
    id: 'campaign-leading-change',
    title: 'Leading Change',
    board: { cols: 11, rows: 7 },
    fixed: leadingBench(),
    palette: { fork: 1, mould: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AA' }, targets: { r1: 'AA' } },
      { name: 'Canon', seeds: { q1: 'AB' }, targets: { r1: 'BA' } },
      { name: 'Fugue', seeds: { q1: 'BBA' }, targets: { r1: 'BBAA' } },
      { name: 'Cadenza', seeds: { q1: 'AAAB' }, targets: { r1: 'AABA' } },
    ],
    architectures: [leadingTestAppend, leadingAppendTest],
    difficulty: 1,
    foundation: true,
    evidence: {
      sourceCandidate: 'R01-derived',
      sourceProfile: 'binary-transducers',
      minimumParts: 2,
      minimumEvidence: 'bounded exhaustive search; no truncated configuration slice',
      extendedAgreement: '126/126',
      logicalArchitectures: 2,
      foundationReason: 'one conditional composition after single-part tutorials',
      spatialCompetition: 'test-then-append dominates after routing; foundation exception recorded',
    },
    observation: 'Every result ends in A. Compare what changes when the input begins with A and when it begins with another note.',
    nudge: 'One part can add the final A. Another can remove a matching lead A while preserving every other lead note.',
  }),

  promotedContract({
    id: 'campaign-first-voices',
    title: 'First Voices',
    board: { cols: 11, rows: 7 },
    fixed: firstVoicesBench(),
    palette: { unison: 1, fork: 1, damper: 1 },
    cases: [
      { name: 'Aria', seeds: { qA: 'A', qB: 'C' }, targets: { r1: 'A' } },
      { name: 'Canon', seeds: { qA: 'C', qB: 'C' }, targets: { r1: 'C' } },
      { name: 'Fugue', seeds: { qA: 'ABCD', qB: 'DC' }, targets: { r1: 'DCABCD' } },
      { name: 'Cadenza', seeds: { qA: 'DC', qB: 'ABCD' }, targets: { r1: 'ABCDDC' } },
    ],
    architectures: [firstVoicesDirect, firstVoicesFeedback],
    difficulty: 2,
    foundation: true,
    evidence: {
      sourceCandidate: 'R19',
      sourceProfile: 'voice-mergers',
      minimumParts: 2,
      minimumEvidence: 'bounded exhaustive search; no truncated configuration slice',
      extendedAgreement: '15/15',
      logicalArchitectures: 6,
      foundationReason: 'two-part multi-input composition before the three-part merger',
      spatialCompetition: 'direct merge dominates after routing; foundation exception recorded',
    },
    observation: 'The tail voice is always last. Compare what happens to a leading C in the lead voice before the two voices join.',
    nudge: 'Normalize the lead voice first, then place it in the lead seat of a Unison.',
  }),

  promotedContract({
    id: 'campaign-turning-phrase',
    title: 'Turning Phrase',
    board: { cols: 11, rows: 7 },
    fixed: leadingBench(),
    palette: { splitter: 2, unison: 2 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AB' }, targets: { r1: 'BA' } },
      { name: 'Canon', seeds: { q1: 'ABC' }, targets: { r1: 'BCA' } },
      { name: 'Fugue', seeds: { q1: 'DABC' }, targets: { r1: 'ABCD' } },
      { name: 'Cadenza', seeds: { q1: 'AABC' }, targets: { r1: 'ABCA' } },
    ],
    architectures: [turningPhraseDirect, turningPhraseExpanded],
    difficulty: 3,
    foundation: true,
    evidence: {
      sourceCandidate: 'R23-derived',
      sourceProfile: 'structured-phrase-arrangements',
      minimumParts: 2,
      minimumEvidence: 'constructive two-chunk composition; no global minimum claim',
      extendedAgreement: '5456/5456',
      logicalArchitectures: 2,
      foundationReason: 'a split-and-recombine composition before larger campaign graphs',
      spatialCompetition: 'direct turn dominates the expanded decomposition; foundation exception recorded',
    },
    observation: 'The same lead marble moves from the beginning to the end in every performance; the middle keeps its order.',
    nudge: 'The two phrases from one cut can take opposite seats when they rejoin.',
  }),

  promotedContract({
    id: 'campaign-twin-cadences',
    title: 'Twin Cadences',
    board: { cols: 11, rows: 7 },
    fixed: twinCadencesBench(),
    palette: { splitter: 1, mould: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'A' }, targets: { rA: 'A', rB: 'A' } },
      { name: 'Canon', seeds: { q1: 'BA' }, targets: { rA: 'B', rB: 'AA' } },
      { name: 'Fugue', seeds: { q1: 'CAB' }, targets: { rA: 'C', rB: 'ABA' } },
      { name: 'Cadenza', seeds: { q1: 'ABCD' }, targets: { rA: 'A', rB: 'BCDA' } },
    ],
    architectures: [twinCadencesSplitFirst, twinCadencesAppendFirst],
    difficulty: 4,
    foundation: true,
    evidence: {
      sourceCandidate: 'R15-derived',
      sourceProfile: 'fanout-workshops',
      minimumParts: 2,
      minimumEvidence: 'derived split-workshop construction; no global minimum claim',
      extendedAgreement: '5460/5460',
      logicalArchitectures: 2,
      foundationReason: 'a transparent multi-output composition before Two Ledgers',
      spatialCompetition: 'routed frontier: split-first is 5 Time faster; append-first is 40 Area smaller',
    },
    observation: 'The first hall receives only the lead marble. The other hall receives everything after it, followed by the same final marble.',
    nudge: 'Adding the final A before the phrase separates does not change the lead-only cadence.',
  }),

  promotedContract({
    id: 'campaign-two-ledgers',
    title: 'Two Ledgers',
    board: { cols: 11, rows: 7 },
    fixed: fanoutBench(),
    palette: { fork: 2, splitter: 1, mould: 1, damper: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AC' }, targets: { rA: 'C', rB: 'AB' } },
      { name: 'Canon', seeds: { q1: 'BA' }, targets: { rA: 'A', rB: 'B' } },
      { name: 'Fugue', seeds: { q1: 'CA' }, targets: { rA: 'A', rB: 'CB' } },
      { name: 'Cadenza', seeds: { q1: 'AABBCC' }, targets: { rA: 'ABBCC', rB: 'AB' } },
    ],
    architectures: [fanoutFeedback, fanoutPeek],
    difficulty: 5,
    evidence: {
      sourceCandidate: 'R15',
      sourceProfile: 'fanout-workshops',
      minimumParts: 3,
      minimumEvidence: 'bounded exhaustive search; no truncated configuration slice',
      extendedAgreement: '21/21',
      logicalArchitectures: 3,
    },
    observation: 'Compare what each hall receives when only the first marble changes. The long performance follows the same contract.',
    nudge: 'One operation can separate the lead marble from the entire remaining phrase before the two products take different routes.',
  }),

  promotedContract({
    id: 'campaign-counterpoint',
    title: 'Counterpoint',
    board: { cols: 11, rows: 7 },
    fixed: mergerBench(),
    palette: { unison: 2, fork: 1, mould: 1, damper: 1, valve: 1 },
    cases: [
      { name: 'Aria', seeds: { qA: 'A', qB: 'B' }, targets: { r1: 'BAC' } },
      { name: 'Canon', seeds: { qA: 'B', qB: 'A' }, targets: { r1: 'ABC' } },
      { name: 'Fugue', seeds: { qA: 'C', qB: 'B' }, targets: { r1: 'BC' } },
      { name: 'Cadenza', seeds: { qA: 'DC', qB: 'ABCD' }, targets: { r1: 'ABCDDCC' } },
    ],
    architectures: [mergerFeedback, mergerBranch],
    difficulty: 6,
    evidence: {
      sourceCandidate: 'R20',
      sourceProfile: 'voice-mergers',
      minimumParts: 3,
      minimumEvidence: 'bounded exhaustive search; no truncated configuration slice',
      extendedAgreement: '15/15',
      logicalArchitectures: 3,
    },
    observation: 'The second voice always leads the result. Compare how the first voice changes before it joins the tail.',
    nudge: 'A matching Bite can shorten a phrase repeatedly; a mismatch can release the unchanged remainder.',
  }),

  promotedContract({
    id: 'campaign-long-bow',
    title: 'Long Bow',
    board: { cols: 11, rows: 7 },
    fixed: singleVoiceBench(),
    palette: { fork: 3 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AAB' }, targets: { r1: 'AAB' } },
      { name: 'Canon', seeds: { q1: 'BAA' }, targets: { r1: 'A' } },
      { name: 'Fugue', seeds: { q1: 'BAB' }, targets: { r1: '' } },
      { name: 'Cadenza', seeds: { q1: 'BB' }, targets: { r1: 'B' } },
    ],
    architectures: [alternatingLoop, alternatingLine],
    difficulty: 7,
    evidence: {
      sourceCandidate: 'mined-alternating-prefix',
      sourceProfile: 'long-prefix-automata',
      minimumParts: 2,
      minimumEvidence: 'bounded inverse search',
      extendedAgreement: 'selected commission cases',
      logicalArchitectures: 2,
    },
    observation: 'Compare where each input first stops following the same alternating opening. Everything from that point onward survives.',
    nudge: 'A route can remember which lead marble should come next, then return a shortened phrase to an earlier test.',
  }),

  promotedContract({
    id: 'campaign-after-the-refrain',
    title: 'After the Refrain',
    board: { cols: 11, rows: 7 },
    fixed: refrainBench(),
    palette: { fork: 6 },
    cases: [
      { name: 'Aria', seeds: { q1: 'ABCABC' }, targets: { r1: '' } },
      { name: 'Canon', seeds: { q1: 'ABCABD' }, targets: { r1: 'D' } },
      { name: 'Fugue', seeds: { q1: 'ABCDA' }, targets: { r1: 'DA' } },
      { name: 'Cadenza', seeds: { q1: 'ABCDAB' }, targets: { r1: 'DAB' } },
      { name: 'Encore', seeds: { q1: 'DABC' }, targets: { r1: 'DABC' } },
    ],
    architectures: [refrainLoop(), refrainLine()],
    difficulty: 8,
    evidence: {
      sourceCandidate: 'R26',
      sourceProfile: 'repeated-melodies',
      minimumParts: 3,
      minimumEvidence: 'parameterized construction search; no global minimum claim',
      extendedAgreement: '5461/5461',
      logicalArchitectures: 2,
    },
    observation: 'Several performances begin alike, but the surviving phrase starts at a different point. Compare the complete opening carefully.',
    nudge: 'Three successive expectations can form a reusable cycle; a mismatch can leave that cycle without consuming its lead marble.',
  }),

  promotedContract({
    id: 'campaign-three-doors',
    title: 'Three Doors',
    board: { cols: 11, rows: 7 },
    fixed: phaseBench(),
    palette: { fork: 6 },
    cases: [
      { name: 'Aria', seeds: { q1: 'ABCABC' }, targets: { rA: '' } },
      { name: 'Canon', seeds: { q1: 'DBC' }, targets: { rA: 'DBC' } },
      { name: 'Fugue', seeds: { q1: 'ADC' }, targets: { rB: 'DC' } },
      { name: 'Cadenza', seeds: { q1: 'ABD' }, targets: { rC: 'D' } },
      { name: 'Encore', seeds: { q1: 'ABCABD' }, targets: { rC: 'D' } },
    ],
    architectures: [refrainLoop({ routed: true }), refrainLine({ routed: true })],
    difficulty: 9,
    evidence: {
      sourceCandidate: 'R28',
      sourceProfile: 'repeated-melodies',
      minimumParts: 3,
      minimumEvidence: 'parameterized construction search; no global minimum claim',
      extendedAgreement: '5461/5461',
      logicalArchitectures: 2,
    },
    observation: 'The surviving suffix changes halls as well as length. Compare which expected position each performance first breaks.',
    nudge: 'A mismatch can exit directly from the test that noticed it, while a match advances to the next expectation.',
  }),
];
