// The chapter spine: the one place that says what order the campaign reads
// in. Each chapter opens with its teaching levels (puzzles.mjs) and continues
// with its searched commissions (campaign.mjs); main.mjs builds LEVELS from
// this list, and the tests import it to prove every level names a chapter it
// contains — a level with an unknown chapter would otherwise fall out of its
// teaching order silently.
export const CHAPTER_ORDER = [
  'I · Études',
  'II · Duets',
  'III · Sight-reading',
  'IV · Wolf notes',
  'V · Entanglements',
  'VI · Tempo',
  'VII · Concerto',
];
