// The complete v0.9 player catalogue. Old generated, promoted, and advanced
// ladders remain as authoring archives; importing only these two sources keeps
// linear exercises out of the shipped progression.

import { TUTORIAL_LEVELS } from './tutorial-levels.mjs?v=0.9.5-1';
import { CANDIDATE_LEVELS } from './candidate-levels.mjs?v=0.9.5-1';
import { CHAPTER_ORDER } from './chapters.mjs?v=0.9.5-1';
import { spatializeReference } from './reference-spatializer.mjs?v=0.9.5-1';

const SOURCE_LEVELS = [...TUTORIAL_LEVELS, ...CANDIDATE_LEVELS];
const TUTORIAL_IDS = new Set(TUTORIAL_LEVELS.map((level) => level.id));

// Named families remain useful to camera and presentation tests. Candidate
// contracts carry one fixed board large enough for every audited witness.
export const BOARD_PROFILES = Object.freeze({
  tutorial: Object.freeze({ cols: 31, rows: 24 }),
  campaign: Object.freeze({ cols: 38, rows: 24 }),
});

function prepareLevel(level) {
  // Candidate witnesses already contain reviewed physical parts, crossings,
  // junctions, and explicit routes on their fixed production board.
  if (level.spatial?.production) return level;
  return spatializeReference(level);
}

export const ALL_LEVELS = SOURCE_LEVELS.map(prepareLevel);
export const LEVELS = CHAPTER_ORDER.flatMap((chapter) =>
  ALL_LEVELS.filter((level) => level.chapter === chapter));

// Reference review can present every authored physical witness, while older
// tutorial levels still expose their single bundled reference through the same
// shape. Callers receive complete placed machines, including terminals.
export function referenceMachines(level) {
  const architectures = (level.architectures ?? []).filter((architecture) =>
    architecture.machine?.parts && architecture.machine?.wires);
  if (architectures.length) return architectures;

  const terminalPositions = level.reference.terminalPositions ?? {};
  return [{
    id: `${level.id}-reference`,
    title: 'Reference machine',
    machine: {
      parts: [
        ...level.fixed.map((part) => ({
          orientation: 0,
          ...part,
          ...(terminalPositions[part.id] ?? {}),
        })),
        ...level.reference.parts,
      ],
      wires: level.reference.wires.map((wire, index) => ({
        id: `reference-w${index}`,
        ...wire,
      })),
    },
  }];
}

export function showsWalkthrough(level, { referenceMode = false } = {}) {
  if (referenceMode) return false;
  return TUTORIAL_IDS.has(level.id);
}

for (const level of ALL_LEVELS) {
  if (!LEVELS.includes(level)) {
    throw new Error(`level ${level.id} names unknown chapter ${level.chapter}`);
  }
}
