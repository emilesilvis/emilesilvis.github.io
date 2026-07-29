// Player-visible campaign progression. Kept DOM-free so locking decisions can
// be tested independently from the level switcher that presents them.

export function sessionMode(query) {
  if (query.has('reference')) return 'reference';
  if (query.has('playtest')) return 'playtest';
  return 'normal';
}

export function canPlaceReference(mode) {
  return mode !== 'playtest';
}

export function isLevelUnlocked(levels, index, { solved = [], unlockAll = false } = {}) {
  if (index < 0 || index >= levels.length) return false;
  if (unlockAll || index === 0) return true;
  const solvedIds = new Set(solved);
  return solvedIds.has(levels[index].id) || solvedIds.has(levels[index - 1].id);
}

export function initialLevelIndex(
  levels,
  { solved = [], requestedId = null, unlockAll = false } = {},
) {
  if (!levels.length) return -1;
  const requested = levels.findIndex((level) => level.id === requestedId);
  if (isLevelUnlocked(levels, requested, { solved, unlockAll })) return requested;

  const solvedIds = new Set(solved);
  const firstUnsolved = levels.findIndex((level, index) =>
    !solvedIds.has(level.id) && isLevelUnlocked(levels, index, { solved, unlockAll }));
  if (firstUnsolved >= 0) return firstUnsolved;

  for (let index = levels.length - 1; index >= 0; index -= 1) {
    if (isLevelUnlocked(levels, index, { solved, unlockAll })) return index;
  }
  return 0;
}
