// Assemble every level source into the player-visible chapter order. Keeping
// this DOM-free makes the exact catalogue testable without importing the UI.
import { PUZZLES } from './puzzles.mjs?v=0.8.5-1';
import { CAMPAIGN } from './campaign.mjs?v=0.8.5-1';
import { ADVANCED_LEVELS } from './advanced-levels.mjs?v=0.8.5-1';
import { CHAPTER_ORDER } from './chapters.mjs?v=0.8.5-1';

const SOURCE_LEVELS = [...PUZZLES, ...CAMPAIGN, ...ADVANCED_LEVELS];
const PUZZLE_IDS = new Set(PUZZLES.map((level) => level.id));

// Stable bench families avoid level-to-level scale jitter without shrinking
// the opening commissions onto the enormous Masterwork grid. Each chapter
// keeps one physical board, and board growth marks a genuine difficulty tier.
export const BOARD_PROFILES = Object.freeze({
  standard: Object.freeze({ cols: 11, rows: 7 }),
  tall: Object.freeze({ cols: 11, rows: 9 }),
  journeyman: Object.freeze({ cols: 17, rows: 12 }),
  masterwork: Object.freeze({ cols: 19, rows: 12 }),
});

const CHAPTER_BOARD_PROFILE = {
  'I · Études': 'standard',
  'II · Duets': 'standard',
  'III · Sight-reading': 'standard',
  'IV · Wolf notes': 'standard',
  'V · Entanglements': 'tall',
  'VI · Tempo': 'tall',
  'VII · Concerto': 'standard',
  'VIII · Journeymen': 'journeyman',
  'IX · Masterworks': 'masterwork',
};

function mountOnSharedBoard(level) {
  const profile = CHAPTER_BOARD_PROFILE[level.chapter] ?? 'masterwork';
  const board = BOARD_PROFILES[profile];
  const offset = {
    x: Math.floor((board.cols - level.board.cols) / 2),
    y: Math.floor((board.rows - level.board.rows) / 2),
  };
  const shift = (part) => ({ ...part, x: part.x + offset.x, y: part.y + offset.y });
  return {
    ...level,
    board,
    boardMount: { profile, source: level.board, offset },
    fixed: level.fixed.map(shift),
    reference: { ...level.reference, parts: level.reference.parts.map(shift) },
  };
}

export const ALL_LEVELS = SOURCE_LEVELS.map(mountOnSharedBoard);
export const LEVELS = CHAPTER_ORDER.flatMap((chapter) =>
  ALL_LEVELS.filter((level) => level.chapter === chapter));

export function showsWalkthrough(level, { referenceMode = false } = {}) {
  return referenceMode || PUZZLE_IDS.has(level.id) || Boolean(level.meta?.tier);
}

for (const level of ALL_LEVELS) {
  if (!LEVELS.includes(level)) {
    console.warn(`level ${level.id} names unknown chapter ${level.chapter}: appended out of order`);
    LEVELS.push(level);
  }
}
