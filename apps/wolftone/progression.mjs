// Player-visible campaign progression. Kept DOM-free so locking decisions can
// be tested independently from the level switcher that presents them.

export function sessionMode(query) {
  if (query.has('reference')) return 'reference';
  if (query.has('playtest')) return 'playtest';
  return 'normal';
}

export function prerequisiteId(levels, index) {
  if (index <= 0 || index >= levels.length) return null;
  const explicit = levels[index].meta?.unlockAfter;
  if (explicit) return explicit;

  let previous = index - 1;
  while (previous >= 0 && levels[previous].meta?.optional) previous -= 1;
  return levels[previous]?.id ?? null;
}

export function isLevelUnlocked(levels, index, { solved = [], unlockAll = false } = {}) {
  if (index < 0 || index >= levels.length) return false;
  if (unlockAll || index === 0) return true;
  const solvedIds = new Set(solved);
  if (solvedIds.has(levels[index].id)) return true;
  const prerequisite = prerequisiteId(levels, index);
  return prerequisite !== null && solvedIds.has(prerequisite);
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
