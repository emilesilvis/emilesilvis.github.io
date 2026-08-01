// Campaign-native commissions promoted from the depth laboratory. The lab
// keeps its spoiler-heavy architecture comparisons; these levels expose only
// test cases and an optional hint deck. Alternate witnesses stay attached for
// offline audits, not for the cold player presentation.

const CHAPTER = 'IV · Wolf notes';
const WOLF_MASTERY_ROOT = 'campaign-wolf-two-teeth';

const wire = (fromPart, fromPort, toPart, toPort) => ({
  from: { part: fromPart, port: fromPort },
  to: { part: toPart, port: toPort },
});

const fixedBench = () => [
  { id: 'q1', kind: 'quill', x: 1, y: 3 },
  { id: 'r1', kind: 'resonator', x: 9, y: 3 },
];

const optionalDeck = (observation, nudge, referenceParts, architectureCount = 1) => [
  {
    focus: 'commission',
    title: 'Read the whole contract',
    body: observation,
  },
  {
    focus: 'board',
    title: 'Optional nudge',
    body: nudge,
  },
  {
    focus: 'board',
    title: 'Reference build: spoilers',
    body: `The verified reference uses ${referenceParts} parts. ` +
      `${architectureCount > 1
        ? `The offline audit retains ${architectureCount} structurally different witnesses. `
        : ''}` +
      'Different layouts can also represent the same underlying approach.',
  },
];

function masteryLevel({
  unlockAfter = WOLF_MASTERY_ROOT,
  architectures,
  observation,
  nudge,
  sourceCandidate = null,
  ...level
}) {
  const reference = architectures[0].build;
  return {
    ...level,
    chapter: CHAPTER,
    board: { cols: 11, rows: 7 },
    fixed: fixedBench(),
    architectures,
    reference,
    meta: {
      tier: 'promoted-contract',
      optional: true,
      unlockAfter,
      referenceIsWitness: true,
      promotedContract: architectures.length > 1,
      teachingBridge: architectures.length === 1,
      sourceCandidate,
    },
    walkthrough: optionalDeck(observation, nudge, reference.parts.length, architectures.length),
  };
}

const splitAndReturn = {
  id: 'first-chair-split-return',
  title: 'Split and return',
  build: {
    parts: [
      { id: 's1', kind: 'splitter', x: 3, y: 3, config: { k: 1 } },
      { id: 'f1', kind: 'fork', x: 5, y: 1, config: { note: 'A', mode: 'consume' } },
      { id: 'u1', kind: 'unison', x: 7, y: 3, config: {} },
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
  id: 'first-chair-append-damp',
  title: 'Append and damp',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 3, y: 3, config: { note: 'A', mode: 'peek' } },
      { id: 'm1', kind: 'mould', x: 5, y: 5, config: { note: 'B' } },
      { id: 'd1', kind: 'damper', x: 7, y: 3, config: {} },
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

const biteAndRebuild = {
  id: 'first-chair-bite-rebuild',
  title: 'Bite and rebuild',
  build: {
    parts: [
      { id: 'fA', kind: 'fork', x: 3, y: 3, config: { note: 'A', mode: 'consume' } },
      { id: 'mB', kind: 'mould', x: 5, y: 5, config: { note: 'B' } },
      { id: 'fB', kind: 'fork', x: 7, y: 3, config: { note: 'B', mode: 'consume' } },
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
  id: 'refrain-bite-append',
  title: 'Bite and append',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 4, y: 3, config: { note: 'A', mode: 'consume' } },
      { id: 'm1', kind: 'mould', x: 7, y: 2, config: { note: 'A' } },
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
  id: 'refrain-split-rotate',
  title: 'Split and rotate',
  build: {
    parts: [
      { id: 'f1', kind: 'fork', x: 3, y: 3, config: { note: 'A', mode: 'peek' } },
      { id: 's1', kind: 'splitter', x: 5, y: 1, config: { k: 1 } },
      { id: 'u1', kind: 'unison', x: 7, y: 3, config: {} },
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

const alternatingSteps = {
  id: 'alternating-steps-line',
  title: 'B then A',
  build: {
    parts: [
      { id: 'fB', kind: 'fork', x: 4, y: 3, config: { note: 'B', mode: 'consume' } },
      { id: 'fA', kind: 'fork', x: 6, y: 3, config: { note: 'A', mode: 'consume' } },
    ],
    wires: [
      wire('q1', 'out', 'fB', 'in'),
      wire('fB', 'left', 'fA', 'in'),
      wire('fB', 'right', 'r1', 'in'),
      wire('fA', 'left', 'r1', 'in'),
      wire('fA', 'right', 'r1', 'in'),
    ],
  },
};

const alternatingLoop = {
  id: 'long-bow-loop',
  title: 'Alternating loop',
  build: {
    parts: [
      { id: 'fB', kind: 'fork', x: 4, y: 2, config: { note: 'B', mode: 'consume' } },
      { id: 'fA', kind: 'fork', x: 6, y: 4, config: { note: 'A', mode: 'consume' } },
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
  id: 'long-bow-line',
  title: 'Unrolled alternation',
  build: {
    parts: [
      { id: 'fB1', kind: 'fork', x: 3, y: 3, config: { note: 'B', mode: 'consume' } },
      { id: 'fA', kind: 'fork', x: 5, y: 3, config: { note: 'A', mode: 'consume' } },
      { id: 'fB2', kind: 'fork', x: 7, y: 3, config: { note: 'B', mode: 'consume' } },
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

export const PROMOTED_LEVELS = [
  masteryLevel({
    id: 'campaign-wolf-first-chair',
    title: 'Wolf IV: First Chair',
    sourceCandidate: 'mined-leading-motion',
    palette: { mould: 1, damper: 1, fork: 2, splitter: 1, unison: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AA' }, targets: { r1: 'A' } },
      { name: 'Canon', seeds: { q1: 'ABA' }, targets: { r1: 'BA' } },
      { name: 'Fugue', seeds: { q1: 'BA' }, targets: { r1: 'AB' } },
      { name: 'Cadenza', seeds: { q1: 'BB' }, targets: { r1: 'BB' } },
    ],
    architectures: [splitAndReturn, appendAndDamp, biteAndRebuild],
    observation: 'Compare the first note with what disappears or moves to the end. One machine must satisfy all four performances.',
    nudge: 'Try separating the first note from the rest. A bitten one-note word becomes an empty word, and that silence can still occupy a Unison seat.',
  }),

  masteryLevel({
    id: 'campaign-wolf-refrain',
    title: 'Wolf V: Refrain',
    sourceCandidate: 'mined-turning-phrase',
    palette: { mould: 1, fork: 2, splitter: 1, unison: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AA' }, targets: { r1: 'AA' } },
      { name: 'Canon', seeds: { q1: 'AAB' }, targets: { r1: 'ABA' } },
      { name: 'Fugue', seeds: { q1: 'AB' }, targets: { r1: 'BA' } },
      { name: 'Cadenza', seeds: { q1: 'BA' }, targets: { r1: 'BA' } },
    ],
    architectures: [biteAndAppend, splitAndRotate],
    observation: 'Compare this contract with the earlier rotation. Pay attention to how many leading notes move before the word is delivered.',
    nudge: 'Handle one leading A, then deliver the result instead of returning it for another pass. Words beginning with B can bypass that work.',
  }),

  masteryLevel({
    id: 'campaign-wolf-alternating-steps',
    title: 'Wolf VI: Alternating Steps',
    palette: { fork: 2 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AAB' }, targets: { r1: 'AAB' } },
      { name: 'Canon', seeds: { q1: 'B' }, targets: { r1: '' } },
      { name: 'Fugue', seeds: { q1: 'BA' }, targets: { r1: '' } },
      { name: 'Cadenza', seeds: { q1: 'BB' }, targets: { r1: 'B' } },
    ],
    architectures: [alternatingSteps],
    observation: 'The contract removes B and then A, but stops as soon as the next expected note is absent.',
    nudge: 'After a B is bitten, send the remainder to a fork expecting A. A mismatch should return the remaining word unchanged.',
  }),

  masteryLevel({
    id: 'campaign-wolf-long-bow',
    title: 'Wolf VII: Long Bow',
    sourceCandidate: 'mined-alternating-prefix',
    unlockAfter: 'campaign-wolf-alternating-steps',
    palette: { fork: 3 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AAB' }, targets: { r1: 'AAB' } },
      { name: 'Canon', seeds: { q1: 'BAA' }, targets: { r1: 'A' } },
      { name: 'Fugue', seeds: { q1: 'BAB' }, targets: { r1: '' } },
      { name: 'Cadenza', seeds: { q1: 'BB' }, targets: { r1: 'B' } },
    ],
    architectures: [alternatingLoop, alternatingLine],
    observation: 'Alternating Steps stopped after B then A. This contract sometimes continues and sometimes stops earlier.',
    nudge: 'The route can remember the next expected note. After biting A, return to the B test; on a mismatch, deliver the remaining word unchanged.',
  }),
];
