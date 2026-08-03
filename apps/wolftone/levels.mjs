// The complete v0.9 player catalogue. Old generated, promoted, and advanced
// ladders remain as authoring archives; importing only these two sources keeps
// linear exercises out of the shipped progression.

import { TUTORIAL_LEVELS } from './tutorial-levels.mjs?v=0.9.1-1';
import { CANDIDATE_LEVELS } from './candidate-levels.mjs?v=0.9.1-1';
import { CHAPTER_ORDER } from './chapters.mjs?v=0.9.1-1';
import { spatializeReference } from './reference-spatializer.mjs?v=0.9.1-1';

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

export function showsWalkthrough(level, { referenceMode = false } = {}) {
  if (referenceMode) return false;
  return TUTORIAL_IDS.has(level.id) || level.meta?.tier?.endsWith('-contract');
}

for (const level of ALL_LEVELS) {
  if (!LEVELS.includes(level)) {
    throw new Error(`level ${level.id} names unknown chapter ${level.chapter}`);
  }
}
