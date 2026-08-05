// v0.9 keeps its linear teaching in one compact chapter. These commissions
// introduce construction and each player-facing mechanism once; the campaign
// that follows is made only of open-ended contracts.

import { PUZZLES } from './puzzles.mjs?v=0.9.5-1';

const CHAPTER = 'I · Tutorial';
const authoredById = new Map(PUZZLES.map((level) => [level.id, level]));

const wire = (fromPart, fromPort, toPart, toPort) => ({
  from: { part: fromPart, port: fromPort },
  to: { part: toPart, port: toPort },
});

function tutorial(id, teaches) {
  const level = authoredById.get(id);
  if (!level) throw new Error(`Missing authored tutorial source: ${id}`);
  return {
    ...level,
    chapter: CHAPTER,
    meta: {
      tier: 'tutorial',
      teaches,
      tutorialMechanism: teaches.join(', '),
      linearTeaching: true,
    },
  };
}

const crossingTutorial = {
  id: 'the-crossing',
  title: 'The Crossing',
  chapter: CHAPTER,
  board: { cols: 11, rows: 7 },
  fixed: [
    { id: 'qB', kind: 'quill', x: 1, y: 0, label: 'falling voice' },
    { id: 'rA', kind: 'resonator', x: 8, y: 2, label: 'upper hall' },
    { id: 'qA', kind: 'quill', x: 1, y: 3, label: 'upper voice' },
    { id: 'rB', kind: 'resonator', x: 8, y: 4, label: 'lower hall' },
  ],
  palette: { crossing: 1 },
  cases: [
    { name: 'Aria', seeds: { qA: 'AB', qB: 'CD' }, targets: { rA: 'AB', rB: 'CD' } },
    { name: 'Encore', seeds: { qA: 'DA', qB: 'BC' }, targets: { rA: 'DA', rB: 'BC' } },
  ],
  reference: {
    parts: [{ id: 'x1', kind: 'crossing', x: 5, y: 1 }],
    wires: [
      wire('qA', 'out', 'x1', 'inA'),
      wire('x1', 'outA', 'rA', 'in'),
      wire('qB', 'out', 'x1', 'inB'),
      wire('x1', 'outB', 'rB', 'in'),
    ],
  },
  meta: {
    tier: 'tutorial',
    teaches: ['crossing'],
    tutorialMechanism: 'crossing',
    linearTeaching: true,
  },
  walkthrough: [
    {
      focus: 'board',
      title: 'Paint through another track',
      body: 'Ordinary connections can use two clicks. Here, drag the second Track straight through the first at a right angle. A Crossing appears automatically and keeps the horizontal and vertical routes separate.',
    },
    {
      focus: 'board',
      title: 'The channels stay separate',
      body: 'Every side can accept or release a word marble. It leaves through the opposite side without turning, even when another word passes through the other channel.',
    },
  ],
};

const junctionTutorial = {
  id: 'the-junction',
  title: 'The Junction',
  chapter: CHAPTER,
  board: { cols: 9, rows: 6 },
  fixed: [
    { id: 'qA', kind: 'quill', x: 1, y: 1, label: 'first entrance' },
    { id: 'qB', kind: 'quill', x: 1, y: 4, label: 'second entrance' },
    { id: 'r1', kind: 'resonator', x: 7, y: 2, label: 'shared hall' },
  ],
  palette: { junction: 1 },
  cases: [
    { name: 'Aria', seeds: { qA: 'AB' }, targets: { r1: 'AB' } },
    { name: 'Encore', seeds: { qB: 'CD' }, targets: { r1: 'CD' } },
  ],
  reference: {
    parts: [{ id: 'j1', kind: 'junction', x: 4, y: 2 }],
    wires: [
      wire('qA', 'out', 'j1', 'inA'),
      wire('qB', 'out', 'j1', 'inB'),
      wire('j1', 'out', 'r1', 'in'),
    ],
  },
  meta: {
    tier: 'tutorial',
    teaches: ['junction'],
    tutorialMechanism: 'junction',
    linearTeaching: true,
  },
  walkthrough: [
    {
      focus: 'commission',
      title: 'Two entrances, one destination',
      body: 'Only one Quill sings in each performance. A Junction lets either route continue through one shared output track.',
    },
    {
      focus: 'board',
      title: 'Merge routes deliberately',
      body: 'Connect the two Quills to inputs A and B, then connect the Junction output to the Resonator. Two word marbles arriving on the same tick would collide, so timing still matters in later machines.',
    },
  ],
};

export const TUTORIAL_LEVELS = [
  tutorial('first-resonance', ['track', 'quill', 'resonator']),
  tutorial('the-mould', ['mould']),
  tutorial('the-damper', ['damper']),
  tutorial('the-splitter', ['splitter']),
  tutorial('unison', ['unison']),
  crossingTutorial,
  junctionTutorial,
  tutorial('the-wolfs-bite', ['fork']),
];
