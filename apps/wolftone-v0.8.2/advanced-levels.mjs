// Advanced commissions. Unlike the generated introductory campaign, these are
// authored from input/output contracts instead of a named mechanic. Their
// reference builds are witnesses, not optimality claims. Journeymen continue
// the main difficulty curve; optional Masterworks are the separated brutal tier.

const CHAPTERS = {
  journeyman: 'VIII · Journeymen',
  'optional-masterwork': 'IX · Masterworks',
};

const wire = (fromPart, fromPort, toPart, toPort) => ({
  from: { part: fromPart, port: fromPort },
  to: { part: toPart, port: toPort },
});

const advancedLevelPolicy = (tier, referenceParts) => ({
  tier,
  referenceParts,
  referenceIsWitness: true,
  shallowAudit: { proofMaxParts: 2, screenMaxParts: 4, maxRuns: 500_000 },
});

const walkthrough = (observation, nudge, referenceParts) => [
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
    title: 'Reference build — spoilers',
    body: `The shipped witness uses ${referenceParts} parts. It proves the commission is solvable, not that this is the only or best construction.`,
  },
];

function advancedLevel({ tier, observation, nudge, ...level }) {
  const referenceParts = level.reference.parts.length;
  return {
    ...level,
    chapter: CHAPTERS[tier],
    meta: advancedLevelPolicy(tier, referenceParts),
    walkthrough: walkthrough(observation, nudge, referenceParts),
  };
}

export const ADVANCED_LEVELS = [
  advancedLevel({
    tier: 'journeyman',
    id: 'journeyman-fourfold-seal',
    title: 'Journeyman I — Fourfold Seal',
    assignment: 'Five performances name four different halls and four different accepted endings. Build one machine for the printed contract.',
    observation: 'Compare which opening note changes, which hall is required, and which final note appears. The brief deliberately names no devices.',
    nudge: 'Separate the decision about the destination from the work unique to that destination.',
    board: { cols: 15, rows: 9 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 4 },
      { id: 'rA', kind: 'resonator', x: 13, y: 1, label: 'first hall' },
      { id: 'rB', kind: 'resonator', x: 13, y: 3, label: 'second hall' },
      { id: 'rC', kind: 'resonator', x: 13, y: 5, label: 'third hall' },
      { id: 'rD', kind: 'resonator', x: 13, y: 7, label: 'fourth hall' },
    ],
    palette: { fork: 4, mould: 4, damper: 2, splitter: 1 },
    cases: [
      { name: 'Aria', seeds: { q1: 'ACD' }, targets: { rA: 'ACDA' } },
      { name: 'Canon', seeds: { q1: 'BCA' }, targets: { rB: 'BCAB' } },
      { name: 'Fugue', seeds: { q1: 'CAD' }, targets: { rC: 'CADC' } },
      { name: 'Cadenza', seeds: { q1: 'DAB' }, targets: { rD: 'DABD' } },
      { name: 'Reprise', seeds: { q1: 'AAC' }, targets: { rA: 'AACA' } },
    ],
    reference: {
      parts: [
        { id: 'fA', kind: 'fork', x: 3, y: 4, config: { note: 'A', mode: 'peek' } },
        { id: 'fB', kind: 'fork', x: 5, y: 5, config: { note: 'B', mode: 'peek' } },
        { id: 'fC', kind: 'fork', x: 7, y: 6, config: { note: 'C', mode: 'peek' } },
        { id: 'mA', kind: 'mould', x: 9, y: 1, config: { note: 'A' } },
        { id: 'mB', kind: 'mould', x: 9, y: 3, config: { note: 'B' } },
        { id: 'mC', kind: 'mould', x: 9, y: 5, config: { note: 'C' } },
        { id: 'mD', kind: 'mould', x: 9, y: 7, config: { note: 'D' } },
      ],
      wires: [
        wire('q1', 'out', 'fA', 'in'),
        wire('fA', 'left', 'mA', 'in'),
        wire('fA', 'right', 'fB', 'in'),
        wire('fB', 'left', 'mB', 'in'),
        wire('fB', 'right', 'fC', 'in'),
        wire('fC', 'left', 'mC', 'in'),
        wire('fC', 'right', 'mD', 'in'),
        wire('mA', 'out', 'rA', 'in'),
        wire('mB', 'out', 'rB', 'in'),
        wire('mC', 'out', 'rC', 'in'),
        wire('mD', 'out', 'rD', 'in'),
      ],
    },
  }),

  advancedLevel({
    tier: 'journeyman',
    id: 'journeyman-crossed-ledger',
    title: 'Journeyman II — Crossed Ledger',
    assignment: 'Across the four opening pairs, each voice has two possible halls and each hall accepts a different ending. One machine must satisfy all four.',
    observation: 'Read the four performances as a truth table. Changing only one voice sometimes moves only the other voice.',
    nudge: 'The two decisions are related. Look for a device that can observe the opposite input while preserving both words.',
    board: { cols: 13, rows: 12 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 3, label: 'first voice' },
      { id: 'q2', kind: 'quill', x: 1, y: 7, label: 'second voice' },
      { id: 'r1', kind: 'resonator', x: 11, y: 1, label: 'first hall' },
      { id: 'r2', kind: 'resonator', x: 11, y: 4, label: 'first annex' },
      { id: 'r3', kind: 'resonator', x: 11, y: 7, label: 'second hall' },
      { id: 'r4', kind: 'resonator', x: 11, y: 10, label: 'second annex' },
    ],
    palette: { coupling: 1, mould: 4 },
    cases: [
      { name: 'Aria', seeds: { q1: 'CB', q2: 'AD' }, targets: { r1: 'CBA', r3: 'ADC' } },
      { name: 'Canon', seeds: { q1: 'DB', q2: 'AD' }, targets: { r1: 'DBA', r4: 'ADD' } },
      { name: 'Fugue', seeds: { q1: 'CB', q2: 'BD' }, targets: { r2: 'CBB', r3: 'BDC' } },
      { name: 'Cadenza', seeds: { q1: 'DB', q2: 'BD' }, targets: { r2: 'DBB', r4: 'BDD' } },
    ],
    reference: {
      parts: [
        { id: 'c1', kind: 'coupling', x: 5, y: 5, config: { noteA: 'A', noteB: 'C' } },
        { id: 'm1', kind: 'mould', x: 8, y: 1, config: { note: 'A' } },
        { id: 'm2', kind: 'mould', x: 8, y: 4, config: { note: 'B' } },
        { id: 'm3', kind: 'mould', x: 8, y: 7, config: { note: 'C' } },
        { id: 'm4', kind: 'mould', x: 8, y: 10, config: { note: 'D' } },
      ],
      wires: [
        wire('q1', 'out', 'c1', 'inA'),
        wire('q2', 'out', 'c1', 'inB'),
        wire('c1', 'outAL', 'm1', 'in'),
        wire('c1', 'outAR', 'm2', 'in'),
        wire('c1', 'outBL', 'm3', 'in'),
        wire('c1', 'outBR', 'm4', 'in'),
        wire('m1', 'out', 'r1', 'in'),
        wire('m2', 'out', 'r2', 'in'),
        wire('m3', 'out', 'r3', 'in'),
        wire('m4', 'out', 'r4', 'in'),
      ],
    },
  }),

  advancedLevel({
    tier: 'optional-masterwork',
    id: 'masterwork-sealed-quartet',
    title: 'Masterwork I — Sealed Quartet',
    assignment: 'Each sealed word must leave its first note in the archive and deliver the remaining word, with the spelling shown, to the only other hall named for that performance.',
    observation: 'The archive and the sounding hall are both required. A solution that merely removes the first note has thrown away required work.',
    nudge: 'Keep the one-note label beside its body long enough for both to follow the same decision tree.',
    board: { cols: 19, rows: 11 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 5 },
      { id: 'r0', kind: 'resonator', x: 17, y: 1, label: 'archive' },
      { id: 'rA', kind: 'resonator', x: 17, y: 3, label: 'first hall' },
      { id: 'rB', kind: 'resonator', x: 17, y: 5, label: 'second hall' },
      { id: 'rC', kind: 'resonator', x: 17, y: 7, label: 'third hall' },
      { id: 'rD', kind: 'resonator', x: 17, y: 9, label: 'fourth hall' },
    ],
    palette: { splitter: 2, coupling: 3, fork: 3, mould: 4, damper: 2 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AACD' }, targets: { r0: 'A', rA: 'ACDA' } },
      { name: 'Canon', seeds: { q1: 'BBCD' }, targets: { r0: 'B', rB: 'BCDB' } },
      { name: 'Fugue', seeds: { q1: 'CCAD' }, targets: { r0: 'C', rC: 'CADC' } },
      { name: 'Cadenza', seeds: { q1: 'DDBA' }, targets: { r0: 'D', rD: 'DBAD' } },
      { name: 'Reprise', seeds: { q1: 'AADA' }, targets: { r0: 'A', rA: 'ADAA' } },
    ],
    reference: {
      parts: [
        { id: 's1', kind: 'splitter', x: 3, y: 5, config: { k: 1 } },
        { id: 'cA', kind: 'coupling', x: 5, y: 5, config: { noteA: 'A', noteB: 'A' } },
        { id: 'cB', kind: 'coupling', x: 8, y: 6, config: { noteA: 'B', noteB: 'B' } },
        { id: 'cC', kind: 'coupling', x: 11, y: 7, config: { noteA: 'C', noteB: 'C' } },
        { id: 'mA', kind: 'mould', x: 14, y: 3, config: { note: 'A' } },
        { id: 'mB', kind: 'mould', x: 14, y: 5, config: { note: 'B' } },
        { id: 'mC', kind: 'mould', x: 14, y: 7, config: { note: 'C' } },
        { id: 'mD', kind: 'mould', x: 14, y: 9, config: { note: 'D' } },
      ],
      wires: [
        wire('q1', 'out', 's1', 'in'),
        wire('s1', 'head', 'cA', 'inA'),
        wire('s1', 'rest', 'cA', 'inB'),
        wire('cA', 'outAL', 'r0', 'in'),
        wire('cA', 'outBL', 'mA', 'in'),
        wire('cA', 'outAR', 'cB', 'inA'),
        wire('cA', 'outBR', 'cB', 'inB'),
        wire('cB', 'outAL', 'r0', 'in'),
        wire('cB', 'outBL', 'mB', 'in'),
        wire('cB', 'outAR', 'cC', 'inA'),
        wire('cB', 'outBR', 'cC', 'inB'),
        wire('cC', 'outAL', 'r0', 'in'),
        wire('cC', 'outBL', 'mC', 'in'),
        wire('cC', 'outAR', 'r0', 'in'),
        wire('cC', 'outBR', 'mD', 'in'),
        wire('mA', 'out', 'rA', 'in'),
        wire('mB', 'out', 'rB', 'in'),
        wire('mC', 'out', 'rC', 'in'),
        wire('mD', 'out', 'rD', 'in'),
      ],
    },
  }),

  advancedLevel({
    tier: 'journeyman',
    id: 'journeyman-six-note-law',
    title: 'Journeyman III — Six-note Law',
    assignment: 'The four six-note seeds obey one shared law. Infer it from the accepted words; the same machine must serve every performance.',
    observation: 'Read each seed as three adjacent two-note phrases, then compare where every output phrase came from and what changed.',
    nudge: 'Solve the rearrangement on paper before placing anything. One phrase is shortened; the lost note returns elsewhere as a constant.',
    board: { cols: 17, rows: 9 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 4 },
      { id: 'r1', kind: 'resonator', x: 15, y: 4 },
    ],
    palette: { splitter: 3, unison: 3, damper: 2, mould: 2, fork: 2 },
    cases: [
      { name: 'Aria', seeds: { q1: 'ABCDDA' }, targets: { r1: 'DAABDD' } },
      { name: 'Canon', seeds: { q1: 'DCABBC' }, targets: { r1: 'BCDCBD' } },
      { name: 'Fugue', seeds: { q1: 'BADDAC' }, targets: { r1: 'ACBADD' } },
      { name: 'Cadenza', seeds: { q1: 'CABCDB' }, targets: { r1: 'DBCACD' } },
    ],
    reference: {
      parts: [
        { id: 's1', kind: 'splitter', x: 3, y: 4, config: { k: 2 } },
        { id: 's2', kind: 'splitter', x: 5, y: 6, config: { k: 2 } },
        { id: 'd1', kind: 'damper', x: 8, y: 7 },
        { id: 'u1', kind: 'unison', x: 8, y: 3 },
        { id: 'u2', kind: 'unison', x: 11, y: 4 },
        { id: 'm1', kind: 'mould', x: 13, y: 4, config: { note: 'D' } },
      ],
      wires: [
        wire('q1', 'out', 's1', 'in'),
        wire('s1', 'head', 'u1', 'tail'),
        wire('s1', 'rest', 's2', 'in'),
        wire('s2', 'head', 'd1', 'in'),
        wire('s2', 'rest', 'u1', 'lead'),
        wire('u1', 'out', 'u2', 'lead'),
        wire('d1', 'out', 'u2', 'tail'),
        wire('u2', 'out', 'm1', 'in'),
        wire('m1', 'out', 'r1', 'in'),
      ],
    },
  }),

  advancedLevel({
    tier: 'optional-masterwork',
    id: 'masterwork-long-cadence',
    title: 'Masterwork II — Long Cadence',
    assignment: 'Six performances, three halls. Several different seeds converge on the same accepted word; the reprise does not. Build one machine for the printed contract.',
    observation: 'Compare the three performances that converge, then use the reprise to distinguish “remove a prefix” from “remove everything before a particular note.”',
    nudge: 'There are two normalization stages before the surviving head can choose among three endings.',
    board: { cols: 19, rows: 11 },
    fixed: [
      { id: 'q1', kind: 'quill', x: 1, y: 5 },
      { id: 'rA', kind: 'resonator', x: 17, y: 2, label: 'first hall' },
      { id: 'rC', kind: 'resonator', x: 17, y: 5, label: 'second hall' },
      { id: 'rD', kind: 'resonator', x: 17, y: 8, label: 'third hall' },
    ],
    palette: { fork: 5, mould: 6, damper: 2, splitter: 2, unison: 2 },
    cases: [
      { name: 'Aria', seeds: { q1: 'AABCD' }, targets: { rC: 'CDAC' } },
      { name: 'Canon', seeds: { q1: 'ABBCD' }, targets: { rC: 'CDAC' } },
      { name: 'Fugue', seeds: { q1: 'BBCD' }, targets: { rC: 'CDAC' } },
      { name: 'Cadenza', seeds: { q1: 'AADCB' }, targets: { rD: 'DCBBD' } },
      { name: 'Interlude', seeds: { q1: 'BDB' }, targets: { rD: 'DBBD' } },
      { name: 'Reprise', seeds: { q1: 'ABAC' }, targets: { rA: 'ACCA' } },
    ],
    reference: {
      parts: [
        { id: 'fA', kind: 'fork', x: 3, y: 5, config: { note: 'A', mode: 'consume' } },
        { id: 'fB', kind: 'fork', x: 5, y: 5, config: { note: 'B', mode: 'consume' } },
        { id: 'fC', kind: 'fork', x: 7, y: 5, config: { note: 'C', mode: 'peek' } },
        { id: 'fD', kind: 'fork', x: 9, y: 7, config: { note: 'D', mode: 'peek' } },
        { id: 'mA1', kind: 'mould', x: 11, y: 2, config: { note: 'C' } },
        { id: 'mA2', kind: 'mould', x: 14, y: 2, config: { note: 'A' } },
        { id: 'mC1', kind: 'mould', x: 11, y: 5, config: { note: 'A' } },
        { id: 'mC2', kind: 'mould', x: 14, y: 5, config: { note: 'C' } },
        { id: 'mD1', kind: 'mould', x: 11, y: 8, config: { note: 'B' } },
        { id: 'mD2', kind: 'mould', x: 14, y: 8, config: { note: 'D' } },
      ],
      wires: [
        wire('q1', 'out', 'fA', 'in'),
        wire('fA', 'left', 'fA', 'in'),
        wire('fA', 'right', 'fB', 'in'),
        wire('fB', 'left', 'fB', 'in'),
        wire('fB', 'right', 'fC', 'in'),
        wire('fC', 'left', 'mC1', 'in'),
        wire('fC', 'right', 'fD', 'in'),
        wire('fD', 'left', 'mD1', 'in'),
        wire('fD', 'right', 'mA1', 'in'),
        wire('mA1', 'out', 'mA2', 'in'),
        wire('mA2', 'out', 'rA', 'in'),
        wire('mC1', 'out', 'mC2', 'in'),
        wire('mC2', 'out', 'rC', 'in'),
        wire('mD1', 'out', 'mD2', 'in'),
        wire('mD2', 'out', 'rD', 'in'),
      ],
    },
  }),
];

export const JOURNEYMEN = ADVANCED_LEVELS.filter((level) => level.meta.tier === 'journeyman');
export const MASTERWORKS = ADVANCED_LEVELS.filter((level) => level.meta.tier === 'optional-masterwork');
