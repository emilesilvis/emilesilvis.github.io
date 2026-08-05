// Eight v0.9 campaign contracts: three compositional foundations followed by
// five audited deep contracts. The player sees
// only performances and a broad-enough palette. Logical laws, alternate
// architectures, mining bounds, and routed score evidence remain attached here
// for tests and author review.

import { measureScore, runCase } from './engine.mjs?v=0.9.2-2';
import { spatializeReference } from './reference-spatializer.mjs?v=0.9.2-2';

const CHAPTER = 'II · Campaign';
const TERMINAL_KINDS = new Set(['quill', 'resonator']);
const MIN_PRODUCTION_BOARD = Object.freeze({ cols: 38, rows: 24 });

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
  { id: 'rA', kind: 'resonator', x: 9, y: 1, label: 'lower ledger', commissionOrder: 2 },
  { id: 'rB', kind: 'resonator', x: 9, y: 2, label: 'upper ledger', commissionOrder: 1 },
];

const phaseBench = () => [
  { id: 'q1', kind: 'quill', x: 1, y: 0 },
  { id: 'rA', kind: 'resonator', x: 9, y: 1, label: 'hall A' },
  { id: 'rC', kind: 'resonator', x: 9, y: 3, label: 'hall C' },
  { id: 'rB', kind: 'resonator', x: 9, y: 4, label: 'hall B' },
];

const crossedPairsBench = () => [
  // The production order is part of the spatial contract. A complete 4! × 2
  // terminal-order audit included the obvious two-pair/one-reader hybrid.
  // Timed sharing now uses Track distance rather than a dedicated delay part.
  { id: 'q3', kind: 'quill', x: 1, y: 0, label: 'first tail', commissionOrder: 3 },
  { id: 'q1', kind: 'quill', x: 1, y: 2, label: 'first lead', commissionOrder: 1 },
  { id: 'q2', kind: 'quill', x: 1, y: 4, label: 'second lead', commissionOrder: 2 },
  { id: 'q4', kind: 'quill', x: 1, y: 6, label: 'second tail', commissionOrder: 4 },
  { id: 'rB', kind: 'resonator', x: 9, y: 2, label: 'hall of B', commissionOrder: 2 },
  { id: 'rA', kind: 'resonator', x: 9, y: 4, label: 'hall of A', commissionOrder: 1 },
];

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
    referenceRouting: witness.referenceRouting,
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
      selection: routed.spatial.selection,
      legibilityRank: routed.spatial.legibilityRank,
      method: routed.spatial.selection === 'legibility'
        ? 'deterministic placement; 64 route orders ranked by Crossings, bends, and routed cells'
        : 'deterministic placement; up to 64 route orders per spacing',
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
  evidence,
  difficulty,
  foundation = false,
  ...contract
}) {
  const routed = architectures.map((architecture) => routeWitness(contract, architecture));
  const board = {
    cols: Math.max(MIN_PRODUCTION_BOARD.cols,
      ...routed.map((architecture) => architecture.board.cols)),
    rows: Math.max(MIN_PRODUCTION_BOARD.rows,
      ...routed.map((architecture) => architecture.board.rows)),
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
      explanation: architecture.explanation,
      optimization: architecture.optimization,
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
  explanation: 'The Mould adds A before the Tuning Fork reads the lead note. A leading A is then bitten off, while every other lead passes unchanged, leaving the new A at the tail.',
  optimization: 'Explicit operation order. In the left-to-right layout it ties the alternative on every routed score.',
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
  explanation: 'The Tuning Fork reads first. It bites a leading A, preserves every other lead, and sends both routes through one Mould that restores A at the tail.',
  optimization: 'An equally compact reversed operation order. In the left-to-right layout it ties the alternative on every routed score.',
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

const leadingPeekDamper = {
  id: 'leading-peek-damper',
  title: 'Peek, then damp',
  graphClass: 'separate-reader-and-cutter',
  explanation: 'A peeking A test leaves the phrase intact. Only its matching route visits a Damper; both routes then share one Mould that restores A at the tail.',
  optimization: 'A mechanically explicit interpretation that separates inspection from deletion. It spends one extra part to avoid hiding both jobs inside a biting Tuning Fork.',
  build: {
    parts: [
      { id: 'mA', kind: 'mould', x: 3, y: 1, config: { note: 'A' } },
      { id: 'fPeek', kind: 'fork', x: 5, y: 4, config: { note: 'A', mode: 'peek' } },
      { id: 'd1', kind: 'damper', x: 7, y: 4 },
    ],
    wires: [
      wire('q1', 'out', 'fPeek', 'in'),
      wire('fPeek', 'left', 'd1', 'in'),
      wire('d1', 'out', 'mA', 'in'),
      wire('fPeek', 'right', 'mA', 'in'),
      wire('mA', 'out', 'r1', 'in'),
    ],
  },
};

const firstVoicesBench = () => [
  { id: 'qB', kind: 'quill', x: 1, y: 0, label: 'lead voice', commissionOrder: 1 },
  { id: 'r1', kind: 'resonator', x: 9, y: 2 },
  { id: 'qA', kind: 'quill', x: 1, y: 3, label: 'tail voice', commissionOrder: 2 },
];

const firstVoicesDirect = {
  id: 'first-voices-direct',
  title: 'Direct normalization',
  graphClass: 'branch-and-merge',
  explanation: 'The lead voice passes through one biting C test, then either route goes directly to the lead seat of the Unison. The untouched tail voice waits in the other seat.',
  optimization: 'Cost and Time for the displayed contract through a direct, forward-only merge.',
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
  referenceRouting: { selection: 'legibility' },
  explanation: 'A matching C returns to the same biting Tuning Fork, so the route can remove every leading C before releasing the remainder into the Unison.',
  optimization: 'Generality through logical reuse. The loop handles any run of leading C notes, rather than minimizing the routed scores.',
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

const firstVoicesDamper = {
  id: 'first-voices-damper',
  title: 'Peek and damp',
  graphClass: 'peek-damper-normalizer',
  explanation: 'A peeking C test preserves the lead voice, and a Damper removes one matching C before returning the shortened phrase for another look. The first non-C lead then joins the untouched tail voice.',
  optimization: 'A mechanically explicit normalizer. It replaces the biting feedback shortcut with separate inspection and deletion parts, making a third complete strategy visible.',
  build: {
    parts: [
      { id: 'u1', kind: 'unison', x: 7, y: 1 },
      { id: 'fC', kind: 'fork', x: 3, y: 4, config: { note: 'C', mode: 'peek' } },
      { id: 'd1', kind: 'damper', x: 5, y: 5 },
    ],
    wires: [
      wire('qA', 'out', 'u1', 'tail'),
      wire('qB', 'out', 'fC', 'in'),
      wire('fC', 'left', 'd1', 'in'),
      wire('d1', 'out', 'fC', 'in'),
      wire('fC', 'right', 'u1', 'lead'),
      wire('u1', 'out', 'r1', 'in'),
    ],
  },
};

const turningPhraseDirect = {
  id: 'turning-phrase-direct',
  title: 'Direct turn',
  graphClass: 'split-and-turn',
  explanation: 'One Splitter removes the lead note. The remainder takes the lead seat of the Unison and the one-note head takes the tail seat, rotating the phrase in one recombination.',
  optimization: 'Cost, Time, and Area through the smallest direct decomposition of the phrase.',
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
  explanation: 'Two Splitters decompose the phrase into smaller pieces. One Unison rebuilds the remainder and a second places the original lead note last, spelling out the same turn in more stages.',
  optimization: 'Explicit intermediate structure. It makes the decomposition visible rather than minimizing a routed score.',
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

// The displayed commission uses A- and D-led phrases. This case-specific
// construction deliberately does not pretend to implement the more general
// four-note rotation law: it classifies those two observed heads, removes the
// head, and rebuilds it at the tail. That makes the contract open to a truly
// different solution family while the compact Splitter/Unison machine remains
// the obvious general solution.
const turningPhraseRebuild = {
  id: 'turning-phrase-rebuild',
  title: 'Classify and rebuild',
  graphClass: 'conditional-rebuild',
  explanation: 'A biting A test handles every displayed A-led phrase. Its other route handles the displayed D-led phrase with a Damper, and separate Moulds restore the removed note at the tail.',
  optimization: 'A commission-specific conditional program. It uses more parts and space, but reaches the same four targets without splitting and recombining phrase chunks.',
  build: {
    parts: [
      { id: 'fA', kind: 'fork', x: 3, y: 2, config: { note: 'A', mode: 'consume' } },
      { id: 'mA', kind: 'mould', x: 5, y: 1, config: { note: 'A' } },
      { id: 'd1', kind: 'damper', x: 5, y: 4 },
      { id: 'mD', kind: 'mould', x: 7, y: 4, config: { note: 'D' } },
    ],
    wires: [
      wire('q1', 'out', 'fA', 'in'),
      wire('fA', 'left', 'mA', 'in'),
      wire('mA', 'out', 'r1', 'in'),
      wire('fA', 'right', 'd1', 'in'),
      wire('d1', 'out', 'mD', 'in'),
      wire('mD', 'out', 'r1', 'in'),
    ],
  },
};

const crossedPairsScheduled = {
  id: 'crossed-pairs-scheduled',
  title: 'Long-track shared merger',
  graphClass: 'temporal-multiplexing',
  referenceRouting: {
    detours: [{ fromPart: 'q1', fromPort: 'out', via: 'north-6' }],
  },
  explanation: 'Both lead voices share one Unison seat and both tails share the other. The first lead takes a long Track so the second lead and first tail pair before the remaining two voices arrive; one Tuning Fork then routes both completed phrases.',
  optimization: 'Cost. One deliberately long route schedules reuse of a single Unison and Tuning Fork instead of building two complete pair-and-classify lanes.',
  build: {
    parts: [
      { id: 'u1', kind: 'unison', x: 5, y: 3 },
      { id: 'f1', kind: 'fork', x: 7, y: 3, config: { note: 'B', mode: 'peek' } },
    ],
    wires: [
      wire('q2', 'out', 'u1', 'lead'),
      wire('q3', 'out', 'u1', 'tail'),
      wire('q4', 'out', 'u1', 'tail'),
      wire('u1', 'out', 'f1', 'in'),
      wire('f1', 'left', 'rB', 'in'),
      wire('f1', 'right', 'rA', 'in'),
      wire('q1', 'out', 'u1', 'lead'),
    ],
  },
};

const crossedPairsParallel = {
  id: 'crossed-pairs-parallel',
  title: 'Fully parallel lanes',
  graphClass: 'fully-parallel-pair-and-classify',
  explanation: 'Two independent lanes each build one intended pair and classify it with its own Tuning Fork. Neither pair formation nor routing waits for shared machinery.',
  optimization: 'Time. Duplicating the complete pair-and-classify lane removes temporal scheduling and lets both completed phrases travel toward their halls simultaneously.',
  build: {
    parts: [
      { id: 'u1', kind: 'unison', x: 5, y: 1 },
      { id: 'f1', kind: 'fork', x: 7, y: 1, config: { note: 'B', mode: 'peek' } },
      { id: 'u2', kind: 'unison', x: 5, y: 5 },
      { id: 'f2', kind: 'fork', x: 7, y: 5, config: { note: 'B', mode: 'peek' } },
    ],
    wires: [
      wire('q1', 'out', 'u1', 'lead'),
      wire('q4', 'out', 'u1', 'tail'),
      wire('q2', 'out', 'u2', 'lead'),
      wire('q3', 'out', 'u2', 'tail'),
      wire('u1', 'out', 'f1', 'in'),
      wire('f1', 'left', 'rB', 'in'),
      wire('f1', 'right', 'rA', 'in'),
      wire('u2', 'out', 'f2', 'in'),
      wire('f2', 'left', 'rB', 'in'),
      wire('f2', 'right', 'rA', 'in'),
    ],
  },
};

const fanoutPeek = {
  id: 'two-ledgers-branch',
  title: 'Branch and merge',
  graphClass: 'branch-and-merge',
  explanation: 'The Splitter sends the remainder to the lower ledger. A peeking Tuning Fork routes the one-note head: B goes straight to the upper ledger, while every other note gains B before the branches rejoin.',
  optimization: 'Cost and Time. Forward-only conditional routes avoid the extra crossings and repeated travel of feedback.',
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
  explanation: 'The Splitter sends the remainder to the lower ledger. The one-note head returns through a biting B test until it no longer matches, then a Mould appends B for the upper ledger.',
  optimization: 'Area. Reused feedback keeps the routed footprint narrower, trading additional crossings and travel time.',
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

const alternatingLoop = {
  id: 'long-bow-loop',
  title: 'Alternating loop',
  graphClass: 'feedback-loop',
  explanation: 'Two biting Tuning Forks remember the expected B then A pattern. Each match removes a note and advances to the other test; the first mismatch releases the untouched suffix.',
  optimization: 'Cost and Area. Two logical tests are reused through feedback.',
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
  explanation: 'A fixed B, A, B chain performs each possible prefix test once. A mismatch exits immediately, trading duplicated Tuning Forks and a larger route for less repeated travel.',
  optimization: 'Time. Separate forward tests remove the return journey through a loop.',
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
    explanation: routed
      ? 'Three biting Tuning Forks form a reusable A, B, C cycle. A match advances around the loop; a mismatch exits from the test that noticed it and therefore selects the corresponding hall.'
      : 'Three biting Tuning Forks form a reusable A, B, C cycle. Matches consume the refrain and circle back to A; the first mismatch releases the untouched suffix.',
    optimization: 'Cost and Area. Three logical tests handle a refrain of any length by reusing the same cycle.',
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
    explanation: routed
      ? 'Six Tuning Forks lay out two A, B, C passes as one line. Each mismatch exits toward the hall assigned to that expected position, avoiding feedback at the cost of a much larger machine.'
      : 'Six Tuning Forks lay out two A, B, C passes as one line. A mismatch releases the suffix immediately, avoiding feedback at the cost of duplicated tests and a much larger machine.',
    optimization: 'Time. The fixed forward chain removes every return trip through the three-test cycle.',
    build: { parts, wires },
  };
}

const AUTHORED_CANDIDATES = [
  promotedContract({
    id: 'campaign-leading-change',
    title: 'Leading Change',
    board: { cols: 11, rows: 7 },
    fixed: leadingBench(),
    palette: { fork: 1, mould: 1, damper: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AA' }, targets: { r1: 'AA' } },
      { name: 'Canon', seeds: { q1: 'AB' }, targets: { r1: 'BA' } },
      { name: 'Fugue', seeds: { q1: 'BBA' }, targets: { r1: 'BBAA' } },
      { name: 'Cadenza', seeds: { q1: 'AAAB' }, targets: { r1: 'AABA' } },
    ],
    architectures: [leadingTestAppend, leadingAppendTest, leadingPeekDamper],
    difficulty: 1,
    foundation: true,
    evidence: {
      sourceCandidate: 'R01-derived',
      sourceProfile: 'binary-transducers',
      minimumParts: 2,
      minimumEvidence: 'bounded exhaustive search; no truncated configuration slice',
      extendedAgreement: '126/126',
      logicalArchitectures: 3,
      foundationReason: 'one conditional composition after single-part tutorials',
      spatialCompetition: 'the two operation-order builds share the frontier; the separate reader-and-cutter build is a deliberately dominated high-contrast foundation witness',
    },
  }),

  promotedContract({
    id: 'campaign-first-voices',
    title: 'First Voices',
    board: { cols: 11, rows: 7 },
    fixed: firstVoicesBench(),
    palette: { unison: 1, fork: 1, damper: 1 },
    cases: [
      { name: 'Aria', seeds: { qA: 'A', qB: 'C' }, targets: { r1: 'A' } },
      { name: 'Canon', seeds: { qA: 'A', qB: 'B' }, targets: { r1: 'BA' } },
      { name: 'Fugue', seeds: { qA: 'ABCD', qB: 'DC' }, targets: { r1: 'DCABCD' } },
      { name: 'Cadenza', seeds: { qA: 'DC', qB: 'ABCD' }, targets: { r1: 'ABCDDC' } },
    ],
    architectures: [firstVoicesDirect, firstVoicesFeedback, firstVoicesDamper],
    difficulty: 3,
    foundation: true,
    evidence: {
      sourceCandidate: 'R19',
      sourceProfile: 'voice-mergers',
      minimumParts: 2,
      minimumEvidence: 'bounded exhaustive search; no truncated configuration slice',
      extendedAgreement: '15/15',
      logicalArchitectures: 6,
      foundationReason: 'two-part multi-input composition before the three-part merger',
      spatialCompetition: 'direct and biting-feedback routes retain a Cost/Time versus Area frontier; peek-and-damp is a dominated third strategy',
    },
  }),

  promotedContract({
    id: 'campaign-turning-phrase',
    title: 'Turning Phrase',
    board: { cols: 11, rows: 7 },
    fixed: leadingBench(),
    palette: { splitter: 2, unison: 2, fork: 1, mould: 2, damper: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AB' }, targets: { r1: 'BA' } },
      { name: 'Canon', seeds: { q1: 'ABC' }, targets: { r1: 'BCA' } },
      { name: 'Fugue', seeds: { q1: 'DABC' }, targets: { r1: 'ABCD' } },
      { name: 'Cadenza', seeds: { q1: 'AABC' }, targets: { r1: 'ABCA' } },
    ],
    architectures: [turningPhraseDirect, turningPhraseExpanded, turningPhraseRebuild],
    difficulty: 2,
    foundation: true,
    evidence: {
      sourceCandidate: 'R23-derived',
      sourceProfile: 'structured-phrase-arrangements',
      minimumParts: 2,
      minimumEvidence: 'constructive two-chunk composition; no global minimum claim',
      extendedAgreement: 'two chunk builds 5456/5456; conditional rebuild 4/4 displayed cases',
      logicalArchitectures: 3,
      foundationReason: 'a split-and-recombine composition before larger campaign graphs',
      spatialCompetition: 'direct turn dominates the expanded and case-specific rebuilds; both remain high-contrast foundation witnesses',
    },
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
  }),

  promotedContract({
    id: 'campaign-crossed-pairs',
    title: 'Crossed Pairs',
    board: { cols: 11, rows: 7 },
    fixed: crossedPairsBench(),
    palette: { unison: 2, fork: 2 },
    cases: [
      { name: 'Aria', seeds: { q1: 'A', q2: 'B', q3: 'C', q4: 'D' }, targets: { rA: 'AD', rB: 'BC' } },
      { name: 'Canon', seeds: { q1: 'B', q2: 'A', q3: 'D', q4: 'C' }, targets: { rA: 'AD', rB: 'BC' } },
      { name: 'Fugue', seeds: { q1: 'AB', q2: 'BA', q3: 'CD', q4: 'DC' }, targets: { rA: 'ABDC', rB: 'BACD' } },
      { name: 'Cadenza', seeds: { q1: 'BABA', q2: 'AB', q3: 'DC', q4: 'CD' }, targets: { rA: 'ABDC', rB: 'BABACD' } },
    ],
    architectures: [crossedPairsScheduled, crossedPairsParallel],
    difficulty: 6,
    evidence: {
      sourceCandidate: 'track-scheduling-derived',
      sourceProfile: 'temporal-multiplexing',
      minimumParts: 2,
      minimumEvidence: 'constructive temporal-versus-parallel comparison; no global minimum claim',
      extendedAgreement: '20000/20000 correlated four-voice performances through length two',
      logicalArchitectures: 3,
    },
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
    difficulty: 4,
    evidence: {
      sourceCandidate: 'mined-alternating-prefix',
      sourceProfile: 'long-prefix-automata',
      minimumParts: 2,
      minimumEvidence: 'bounded inverse search',
      extendedAgreement: 'selected commission cases',
      logicalArchitectures: 2,
    },
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
    difficulty: 7,
    evidence: {
      sourceCandidate: 'R26',
      sourceProfile: 'repeated-melodies',
      minimumParts: 3,
      minimumEvidence: 'parameterized construction search; no global minimum claim',
      extendedAgreement: '5461/5461',
      logicalArchitectures: 2,
    },
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
    difficulty: 8,
    evidence: {
      sourceCandidate: 'R28',
      sourceProfile: 'repeated-melodies',
      minimumParts: 3,
      minimumEvidence: 'parameterized construction search; no global minimum claim',
      extendedAgreement: '5461/5461',
      logicalArchitectures: 2,
    },
  }),
];

export const CANDIDATE_LEVELS = [...AUTHORED_CANDIDATES]
  .sort((left, right) => left.meta.difficulty - right.meta.difficulty);
