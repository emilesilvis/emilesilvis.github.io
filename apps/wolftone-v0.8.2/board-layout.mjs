// Browser-independent route labels used by the coupling inspector. Keeping
// this transformation outside main.mjs lets UI copy stay testable without
// booting the whole player shell.

export function couplingRouteText(targetSide, otherHead, exitSide) {
  const sourceSide = targetSide === 'A' ? 'B' : 'A';
  return `${sourceSide}:${otherHead}→${exitSide}`;
}

// Placement preview and placement commit share this test so the ghost never
// promises a cell that the click will reject.
export function placementValidity(parts, board, x, y) {
  if (x < 0 || y < 0 || x >= board.cols || y >= board.rows) {
    return { valid: false, reason: 'Outside the board' };
  }
  if (parts.some((part) => part.x === x && part.y === y)) {
    return { valid: false, reason: 'Cell occupied' };
  }
  return { valid: true, reason: null };
}
