// Archived research commissions for comparing architectures. They remain
// available to analysis scripts and tests but are not part of the game shell.

const RICHNESS_CHAPTER = 'Architecture studies';
const PROBE_CHAPTER = 'Mechanic probes';
const MINED_CHAPTER = 'Mined contracts';
const wire = (fromPart, fromPort, toPart, toPort) => ({
  from: { part: fromPart, port: fromPort },
  to: { part: toPart, port: toPort },
});

function depthLevel({ studyKind, postSolve, architectures, ...level }) {
  const mechanicProbe = studyKind === 'mechanic-probe';
  const minedContract = studyKind === 'mined-contract';
  const architectureStudy = !mechanicProbe;
  const chapter = minedContract
    ? MINED_CHAPTER
    : mechanicProbe ? PROBE_CHAPTER : RICHNESS_CHAPTER;
  return {
    ...level,
    chapter,
    meta: {
      tier: 'depth-study',
      depthExperiment: true,
      studyKind,
      architectureStudy,
      mechanicProbe,
      minedContract,
    },
    architectures,
    reference: architectures[0].build,
    researchSummary: postSolve,
  };
}

const feedbackLoop = {
  id: 'feedback-loop',
  title: 'Feedback loop',
  summary: 'One fork is reused. This uses fewer parts and less track, but takes longer for repeated prefixes.',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 4, y: 4, config: { note: 'A', mode: 'consume' } },
    ],
    wires: [
      wire('q1', 'out', 'f1', 'in'),
      wire('f1', 'left', 'f1', 'in'),
      wire('f1', 'right', 'r1', 'in'),
    ],
  },
};

const unrolledLine = {
  id: 'unrolled-line',
  title: 'Unrolled line',
  summary: 'Three forks perform the checks in sequence. This uses more parts and track, but finishes sooner.',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 2, y: 4, config: { note: 'A', mode: 'consume' } },
      { id: 'f2', kind: 'fork', x: 4, y: 4, config: { note: 'A', mode: 'consume' } },
      { id: 'f3', kind: 'fork', x: 6, y: 4, config: { note: 'A', mode: 'consume' } },
    ],
    wires: [
      wire('q1', 'out', 'f1', 'in'),
      wire('f1', 'left', 'f2', 'in'),
      wire('f1', 'right', 'r1', 'in'),
      wire('f2', 'left', 'f3', 'in'),
      wire('f2', 'right', 'r1', 'in'),
      wire('f3', 'left', 'r1', 'in'),
      wire('f3', 'right', 'r1', 'in'),
    ],
  },
};

const sharedPipeline = {
  id: 'shared-pipeline',
  title: 'Shared workshop',
  summary: 'Three trains share one pair of Moulds, then Tuning Forks route the results to their Resonators.',
  build: {
    parts: [
      { id: 'mC', kind: 'mould', x: 3, y: 2, config: { note: 'C' } },
      { id: 'mD', kind: 'mould', x: 5, y: 2, config: { note: 'D' } },
      { id: 'fA', kind: 'fork', x: 7, y: 2, config: { note: 'A', mode: 'peek' } },
      { id: 'fB', kind: 'fork', x: 9, y: 4, config: { note: 'B', mode: 'peek' } },
    ],
    wires: [
      wire('qA', 'out', 'mC', 'in'),
      wire('qB', 'out', 'mC', 'in'),
      wire('qC', 'out', 'mC', 'in'),
      wire('mC', 'out', 'mD', 'in'),
      wire('mD', 'out', 'fA', 'in'),
      wire('fA', 'left', 'rA', 'in'),
      wire('fA', 'right', 'fB', 'in'),
      wire('fB', 'left', 'rB', 'in'),
      wire('fB', 'right', 'rC', 'in'),
    ],
  },
};

const parallelPipelines = {
  id: 'parallel-pipelines',
  title: 'Parallel workshops',
  summary: 'Each train uses its own pair of Moulds. This needs more parts but does not need a shared queue or routing Tuning Forks.',
  build: {
    parts: [
      { id: 'aC', kind: 'mould', x: 4, y: 0, config: { note: 'C' } },
      { id: 'aD', kind: 'mould', x: 8, y: 0, config: { note: 'D' } },
      { id: 'bC', kind: 'mould', x: 4, y: 3, config: { note: 'C' } },
      { id: 'bD', kind: 'mould', x: 8, y: 3, config: { note: 'D' } },
      { id: 'cC', kind: 'mould', x: 4, y: 7, config: { note: 'C' } },
      { id: 'cD', kind: 'mould', x: 8, y: 7, config: { note: 'D' } },
    ],
    wires: [
      wire('qA', 'out', 'aC', 'in'), wire('aC', 'out', 'aD', 'in'), wire('aD', 'out', 'rA', 'in'),
      wire('qB', 'out', 'bC', 'in'), wire('bC', 'out', 'bD', 'in'), wire('bD', 'out', 'rB', 'in'),
      wire('qC', 'out', 'cC', 'in'), wire('cC', 'out', 'cD', 'in'), wire('cD', 'out', 'rC', 'in'),
    ],
  },
};

const freePeek = {
  id: 'free-peek',
  title: 'Peek-only reading',
  summary: 'A Tuning Fork in peek mode routes the unchanged train directly.',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 6, y: 4, config: { note: 'A', mode: 'peek' } },
    ],
    wires: [
      wire('q1', 'out', 'f1', 'in'),
      wire('f1', 'left', 'rA', 'in'),
      wire('f1', 'right', 'rB', 'in'),
    ],
  },
};

const biteAndReconstruct = {
  id: 'bite-and-reconstruct',
  title: 'Bite-only reading',
  summary: 'Bite removes the lead A marble. A Mould and Unison add it back before delivery.',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 2, y: 4, config: { note: 'A', mode: 'consume' } },
      { id: 's1', kind: 'splitter', x: 4, y: 3, config: { k: 2 } },
      { id: 'm1', kind: 'mould', x: 6, y: 5, config: { note: 'A' } },
      { id: 'u1', kind: 'unison', x: 8, y: 3, config: {} },
    ],
    wires: [
      wire('q1', 'out', 'f1', 'in'),
      wire('f1', 'left', 's1', 'in'),
      wire('f1', 'right', 'rB', 'in'),
      wire('s1', 'head', 'u1', 'tail'),
      wire('s1', 'rest', 'm1', 'in'),
      wire('m1', 'out', 'u1', 'lead'),
      wire('u1', 'out', 'rA', 'in'),
    ],
  },
};

const preservationCases = [
  { name: 'A header', seeds: { q1: 'ABC' }, targets: { rA: 'ABC' } },
  { name: 'B header', seeds: { q1: 'BCD' }, targets: { rB: 'BCD' } },
];

const splitLeadingNote = {
  id: 'split-leading-note',
  title: 'Split and return',
  summary: 'A Splitter isolates the lead marble. A Bite loop removes A or passes B into the tail seat for recombination.',
  build: {
    parts: [
      { id: 's1', kind: 'splitter', x: 3, y: 4, config: { k: 1 } },
      { id: 'f1', kind: 'fork', x: 6, y: 2, config: { note: 'A', mode: 'consume' } },
      { id: 'u1', kind: 'unison', x: 9, y: 4, config: {} },
    ],
    wires: [
      wire('q1', 'out', 's1', 'in'),
      wire('s1', 'head', 'f1', 'in'),
      wire('s1', 'rest', 'u1', 'lead'),
      wire('f1', 'left', 'f1', 'in'),
      wire('f1', 'right', 'u1', 'tail'),
      wire('u1', 'out', 'r1', 'in'),
    ],
  },
};

const appendAndDamp = {
  id: 'append-and-damp',
  title: 'Append and damp',
  summary: 'Peek selects a short deletion path for A. The B path appends B before damping the original head.',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 3, y: 4, config: { note: 'A', mode: 'peek' } },
      { id: 'm1', kind: 'mould', x: 6, y: 6, config: { note: 'B' } },
      { id: 'd1', kind: 'damper', x: 9, y: 4, config: {} },
    ],
    wires: [
      wire('q1', 'out', 'f1', 'in'),
      wire('f1', 'left', 'd1', 'in'),
      wire('f1', 'right', 'm1', 'in'),
      wire('m1', 'out', 'd1', 'in'),
      wire('d1', 'out', 'r1', 'in'),
    ],
  },
};

const biteAndRebuildTail = {
  id: 'bite-and-rebuild-tail',
  title: 'Bite and rebuild',
  summary: 'Bite removes A directly. A train beginning with B takes a second path that adds B to the tail, then removes the original B.',
  build: {
    parts: [
      { id: 'fA', kind: 'fork', x: 3, y: 4, config: { note: 'A', mode: 'consume' } },
      { id: 'mB', kind: 'mould', x: 6, y: 6, config: { note: 'B' } },
      { id: 'fB', kind: 'fork', x: 9, y: 4, config: { note: 'B', mode: 'consume' } },
    ],
    wires: [
      wire('q1', 'out', 'fA', 'in'),
      wire('fA', 'left', 'r1', 'in'),
      wire('fA', 'right', 'mB', 'in'),
      wire('mB', 'out', 'fB', 'in'),
      wire('fB', 'left', 'r1', 'in'),
    ],
  },
};

const biteAndAppend = {
  id: 'bite-and-append',
  title: 'Bite and append',
  summary: 'Bite removes a leading A marble and a Mould restores it at the tail. Trains beginning with B bypass both changes.',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 4, y: 4, config: { note: 'A', mode: 'consume' } },
      { id: 'm1', kind: 'mould', x: 8, y: 3, config: { note: 'A' } },
    ],
    wires: [
      wire('q1', 'out', 'f1', 'in'),
      wire('f1', 'left', 'm1', 'in'),
      wire('f1', 'right', 'r1', 'in'),
      wire('m1', 'out', 'r1', 'in'),
    ],
  },
};

const splitAndRotate = {
  id: 'split-and-rotate',
  title: 'Split and rotate',
  summary: 'Peek sends trains beginning with A through a Splitter and rejoins the tail before the isolated lead marble. Trains beginning with B bypass the workshop.',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 3, y: 4, config: { note: 'A', mode: 'peek' } },
      { id: 's1', kind: 'splitter', x: 6, y: 2, config: { k: 1 } },
      { id: 'u1', kind: 'unison', x: 9, y: 4, config: {} },
    ],
    wires: [
      wire('q1', 'out', 'f1', 'in'),
      wire('f1', 'left', 's1', 'in'),
      wire('f1', 'right', 'r1', 'in'),
      wire('s1', 'head', 'u1', 'tail'),
      wire('s1', 'rest', 'u1', 'lead'),
      wire('u1', 'out', 'r1', 'in'),
    ],
  },
};

const alternatingLoop = {
  id: 'alternating-loop',
  title: 'Alternating loop',
  summary: 'Two Bite forks form a two-state loop that repeatedly removes B, then A, until the pattern stops.',
  build: {
    parts: [
      { id: 'fB', kind: 'fork', x: 4, y: 3, config: { note: 'B', mode: 'consume' } },
      { id: 'fA', kind: 'fork', x: 8, y: 5, config: { note: 'A', mode: 'consume' } },
    ],
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
  id: 'alternating-line',
  title: 'Unrolled alternation',
  summary: 'Three Bite forks spell out B, then A, then B. It uses an extra part and more track but avoids feedback.',
  build: {
    parts: [
      { id: 'fB1', kind: 'fork', x: 2, y: 4, config: { note: 'B', mode: 'consume' } },
      { id: 'fA', kind: 'fork', x: 5, y: 4, config: { note: 'A', mode: 'consume' } },
      { id: 'fB2', kind: 'fork', x: 8, y: 4, config: { note: 'B', mode: 'consume' } },
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

export const DEPTH_LEVELS = [
  depthLevel({
    id: 'depth-loop-or-line',
    title: 'Study I: Repeated Prefix',
    studyKind: 'richness',
    postSolve: 'Two verified builds satisfy these cases. Compare their measured trade-offs, then place either build to inspect how it works.',
    board: { cols: 13, rows: 9 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 0, y: 4 },
      { id: 'r1', kind: 'resonator', x: 10, y: 4 },
    ],
    palette: { fork: 3 },
    cases: ['', 'A', 'AA', 'AAA'].map((prefix, index) => ({
      name: `Prefix ${index}`,
      seeds: { q1: `${prefix}B` },
      targets: { r1: 'B' },
    })),
    architectures: [feedbackLoop, unrolledLine],
  }),

  depthLevel({
    id: 'depth-shared-or-parallel',
    title: 'Study II: Three Voices',
    studyKind: 'richness',
    postSolve: 'Two verified builds satisfy this case. Compare their measured trade-offs, then place either build to inspect how it works.',
    board: { cols: 13, rows: 9 },
    fixed: [
      { id: 'qA', kind: 'quill', x: 0, y: 0 },
      { id: 'qB', kind: 'quill', x: 0, y: 3 },
      { id: 'qC', kind: 'quill', x: 0, y: 7 },
      { id: 'rA', kind: 'resonator', x: 12, y: 0 },
      { id: 'rB', kind: 'resonator', x: 12, y: 3 },
      { id: 'rC', kind: 'resonator', x: 12, y: 7 },
    ],
    palette: { mould: 6, fork: 2 },
    cases: [{
      name: 'Three simultaneous commissions',
      seeds: { qA: 'AB', qB: 'BA', qC: 'CA' },
      targets: { rA: 'ABCD', rB: 'BACD', rC: 'CACD' },
    }],
    architectures: [sharedPipeline, parallelPipelines],
  }),

  depthLevel({
    id: 'depth-peek-only',
    title: 'Probe III: Peek Preservation',
    studyKind: 'mechanic-probe',
    postSolve: 'This controlled probe permits Peek only. Inspect the verified build and compare its cost with the Bite-only version of the same contract.',
    board: { cols: 13, rows: 9 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 0, y: 4 },
      { id: 'rA', kind: 'resonator', x: 12, y: 3 },
      { id: 'rB', kind: 'resonator', x: 12, y: 5 },
    ],
    palette: { fork: 1 },
    configConstraints: { forkModes: ['peek'] },
    cases: preservationCases,
    architectures: [freePeek],
  }),

  depthLevel({
    id: 'depth-bite-only',
    title: 'Probe IV: Bite Preservation',
    studyKind: 'mechanic-probe',
    postSolve: 'This controlled probe permits Bite only. Inspect the verified build and compare its reconstruction cost with the Peek-only version of the same contract.',
    board: { cols: 13, rows: 9 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 0, y: 4 },
      { id: 'rA', kind: 'resonator', x: 12, y: 3 },
      { id: 'rB', kind: 'resonator', x: 12, y: 5 },
    ],
    palette: { fork: 1, splitter: 1, mould: 1, unison: 1 },
    configConstraints: { forkModes: ['consume'] },
    cases: preservationCases,
    architectures: [biteAndReconstruct],
  }),

  depthLevel({
    id: 'mined-leading-motion',
    title: 'Study V: First Chair',
    studyKind: 'mined-contract',
    postSolve: 'This contract was discovered by grouping small machines with the same bounded behaviour. Compare three different decompositions of its lead-marble rule.',
    board: { cols: 13, rows: 9 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 0, y: 4 },
      { id: 'r1', kind: 'resonator', x: 12, y: 4 },
    ],
    palette: { mould: 1, damper: 1, fork: 2, splitter: 1, unison: 1 },
    cases: [
      { name: 'Performance 1', seeds: { q1: 'AA' }, targets: { r1: 'A' } },
      { name: 'Performance 2', seeds: { q1: 'ABA' }, targets: { r1: 'BA' } },
      { name: 'Performance 3', seeds: { q1: 'BA' }, targets: { r1: 'AB' } },
      { name: 'Performance 4', seeds: { q1: 'BB' }, targets: { r1: 'BB' } },
    ],
    architectures: [splitLeadingNote, appendAndDamp, biteAndRebuildTail],
  }),

  depthLevel({
    id: 'mined-turning-phrase',
    title: 'Study VI: Refrain',
    studyKind: 'mined-contract',
    postSolve: 'The same conditional rotation can be expressed by destructive reading and repair or by splitting and recombining the train.',
    board: { cols: 13, rows: 9 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 0, y: 4 },
      { id: 'r1', kind: 'resonator', x: 12, y: 4 },
    ],
    palette: { mould: 1, fork: 2, splitter: 1, unison: 1 },
    cases: [
      { name: 'Performance 1', seeds: { q1: 'AA' }, targets: { r1: 'AA' } },
      { name: 'Performance 2', seeds: { q1: 'AAB' }, targets: { r1: 'ABA' } },
      { name: 'Performance 3', seeds: { q1: 'AB' }, targets: { r1: 'BA' } },
      { name: 'Performance 4', seeds: { q1: 'BA' }, targets: { r1: 'BA' } },
    ],
    architectures: [biteAndAppend, splitAndRotate],
  }),

  depthLevel({
    id: 'mined-alternating-prefix',
    title: 'Study VII: Long Bow',
    studyKind: 'mined-contract',
    postSolve: 'The cases bound an alternating-prefix rule to three marbles. Compare a reusable two-state loop with a fully unrolled three-test line.',
    board: { cols: 13, rows: 9 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 0, y: 4 },
      { id: 'r1', kind: 'resonator', x: 12, y: 4 },
    ],
    palette: { fork: 3 },
    cases: [
      { name: 'Performance 1', seeds: { q1: 'AAB' }, targets: { r1: 'AAB' } },
      { name: 'Performance 2', seeds: { q1: 'BAA' }, targets: { r1: 'A' } },
      { name: 'Performance 3', seeds: { q1: 'BAB' }, targets: { r1: '' } },
      { name: 'Performance 4', seeds: { q1: 'BB' }, targets: { r1: 'B' } },
    ],
    architectures: [alternatingLoop, alternatingLine],
  }),
];
