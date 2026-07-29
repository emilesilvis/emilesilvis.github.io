// Browser-independent route labels used by the coupling inspector. Keeping
// this transformation outside main.mjs lets UI copy stay testable without
// booting the whole player shell.

export function couplingRouteText(targetSide, otherHead, exitSide) {
  const sourceSide = targetSide === 'A' ? 'B' : 'A';
  return `${sourceSide}:${otherHead}→${exitSide}`;
}
