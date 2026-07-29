// Assemble every level source into the player-visible chapter order. Keeping
// this DOM-free makes the exact catalogue testable without importing the UI.
import { PUZZLES } from './puzzles.mjs';
import { CAMPAIGN } from './campaign.mjs';
import { ADVANCED_LEVELS } from './advanced-levels.mjs';
import { CHAPTER_ORDER } from './chapters.mjs';

export const ALL_LEVELS = [...PUZZLES, ...CAMPAIGN, ...ADVANCED_LEVELS];
export const LEVELS = CHAPTER_ORDER.flatMap((chapter) =>
  ALL_LEVELS.filter((level) => level.chapter === chapter));

export function showsWalkthrough(level, { referenceMode = false } = {}) {
  return referenceMode || PUZZLES.includes(level) || Boolean(level.meta?.tier);
}

for (const level of ALL_LEVELS) {
  if (!LEVELS.includes(level)) {
    console.warn(`level ${level.id} names unknown chapter ${level.chapter} — appended out of order`);
    LEVELS.push(level);
  }
}
