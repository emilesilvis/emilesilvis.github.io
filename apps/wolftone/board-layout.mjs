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

// Moving a part uses the same placement rules as adding one, except that its
// current cell is not an obstacle. Keeping this browser-independent prevents
// the drag preview and committed edit from drifting apart.
export function movementValidity(parts, board, partId, x, y) {
  return placementValidity(parts.filter((part) => part.id !== partId), board, x, y);
}

// Return a new wire list so a retarget stays a single undoable edit. Outputs
// are exclusive: moving a source onto an occupied output is rejected rather
// than silently disconnecting another string.
export function retargetWire(wires, wireId, end, nextRef) {
  if (end !== 'from' && end !== 'to') return null;
  const wire = wires.find((candidate) => candidate.id === wireId);
  if (!wire) return null;
  if (end === 'from' && wires.some((candidate) =>
    candidate.id !== wireId &&
    candidate.from.part === nextRef.part && candidate.from.port === nextRef.port)) return null;
  return wires.map((candidate) => candidate.id === wireId
    ? { ...candidate, [end]: { ...nextRef } }
    : candidate);
}

// Inserting a one-in/one-out part preserves the selected wire ID on the first
// leg and adds one new leg. The caller owns port eligibility and ID creation.
export function spliceWire(wires, wireId, partId, inputPort, outputPort, nextWireId) {
  const wire = wires.find((candidate) => candidate.id === wireId);
  if (!wire || wires.some((candidate) => candidate.id === nextWireId)) return null;
  const first = { ...wire, to: { part: partId, port: inputPort } };
  const second = {
    id: nextWireId,
    from: { part: partId, port: outputPort },
    to: { ...wire.to },
  };
  return wires.flatMap((candidate) => candidate.id === wireId ? [first, second] : [candidate]);
}
