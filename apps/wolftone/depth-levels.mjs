// Experimental commissions for comparing architectures in the real game.
// They are reachable only through ?depthlab, never join normal progression,
// and never write to the campaign save.

const CHAPTER = 'Depth laboratory';
const wire = (fromPart, fromPort, toPart, toPort) => ({
  from: { part: fromPart, port: fromPort },
  to: { part: toPart, port: toPort },
});

const architectureStep = (architecture) => ({
  focus: 'board',
  title: `${architecture.title}: spoilers`,
  body: `${architecture.summary} Place this reference build to inspect it.`,
  architectureId: architecture.id,
});

function depthLevel({ observation, nudge, architectures, ...level }) {
  return {
    ...level,
    chapter: CHAPTER,
    meta: { tier: 'depth-study', architectureStudy: true },
    architectures,
    reference: architectures[0].build,
    walkthrough: [
      { focus: 'commission', title: 'Architecture study', body: observation },
      { focus: 'board', title: 'Before the spoilers', body: nudge },
      ...architectures.map(architectureStep),
    ],
  };
}

const feedbackLoop = {
  id: 'feedback-loop',
  title: 'Feedback loop',
  summary: 'One fork is reused. This uses fewer parts and less wire, but takes longer for repeated prefixes.',
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
  summary: 'Three forks perform the checks in sequence. This uses more parts and wire, but finishes sooner.',
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
  summary: 'Three words share one pair of moulds, then forks route the results to their resonators.',
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
  summary: 'Each word uses its own pair of moulds. This needs more parts but does not need a shared queue or routing forks.',
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
  summary: 'A fork in peek mode routes the unchanged word directly.',
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
  summary: 'Bite removes the first A. A mould and unison add it back before delivery.',
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
export const DEPTH_LEVELS = [
  depthLevel({
    id: 'depth-loop-or-line',
    title: 'Study I: Loop or Line',
    assignment: 'Remove every leading A from four performances. The tray permits both reuse and duplication; make any machine ring first.',
    observation: 'Compare a loop that reuses one fork with a line that uses three forks. Check the Parts, Wire, and Time scores.',
    nudge: 'Connect the matching output to another fork or back to the same fork.',
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
    title: 'Study II: Shared or Parallel',
    assignment: 'Three simultaneous voices must each gain C·D and reach their own hall. Build one workshop or several.',
    observation: 'Compare one shared pair of moulds with three separate pairs. Check the Parts, Wire, and Time scores.',
    nudge: 'The heads already name the halls. The repeated work is the C·D signature.',
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
    title: 'Study III: Preserve with Peek',
    assignment: 'The head names the hall, and the whole word must arrive unchanged. This bench permits Peek only.',
    observation: 'Use peek mode to route the word without changing it.',
    nudge: 'Read A; its matching branch names the first hall.',
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
    title: 'Study IV: Preserve with Bite',
    assignment: 'The head names the hall, and the whole word must arrive unchanged. This bench permits Bite only.',
    observation: 'Use bite mode to route the word, then restore the note it removed.',
    nudge: 'After the bite, manufacture the lost A from an empty word and place it before the surviving body.',
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
];
