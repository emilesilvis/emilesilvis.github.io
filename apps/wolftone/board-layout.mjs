// Browser-independent route labels used by the coupling inspector. Keeping
// this transformation outside main.mjs lets UI copy stay testable without
// booting the whole player shell.

import { cellKey, occupiedWireCells, routeValidity } from './wire-routing.mjs?v=0.9.0-1';
import { partFootprintCells } from './part-geometry.mjs?v=0.9.0-1';

export function couplingRouteText(targetSide, otherHead, exitSide) {
  const sourceSide = targetSide === 'A' ? 'B' : 'A';
  return `${sourceSide}:${otherHead}→${exitSide}`;
}

// Placement preview and placement commit share this test so the ghost never
// promises a cell that the click will reject.
export function placementValidity(parts, board, candidate, wires = []) {
  const footprint = partFootprintCells(candidate);
  if (footprint.some(({ x, y }) => x < 0 || y < 0 || x >= board.cols || y >= board.rows)) {
    return { valid: false, reason: 'Outside the board' };
  }
  const occupiedParts = new Set(parts.flatMap(partFootprintCells).map(cellKey));
  if (footprint.some((cell) => occupiedParts.has(cellKey(cell)))) {
    return { valid: false, reason: 'Cell occupied' };
  }
  const machine = { parts, wires };
  const occupiedWires = occupiedWireCells(machine);
  if (footprint.some((cell) => occupiedWires.has(cellKey(cell)))) {
    return { valid: false, reason: 'Track occupies cell' };
  }
  return { valid: true, reason: null };
}

// Moving a part uses the same placement rules as adding one, except that its
// current cell is not an obstacle. Keeping this browser-independent prevents
// the drag preview and committed edit from drifting apart.
export function movementValidity(parts, board, partId, change, wires = []) {
  const current = parts.find((part) => part.id === partId);
  if (!current) return { valid: false, reason: 'Missing part' };
  const candidate = { ...current, ...change };
  const placement = placementValidity(parts.filter((part) => part.id !== partId), board, candidate, wires);
  if (!placement.valid) return placement;
  const nextParts = parts.map((part) => part.id === partId ? candidate : part);
  const machine = { parts: nextParts, wires };
  const broken = wires
    .filter((wire) => wire.from.part === partId || wire.to.part === partId)
    .map((wire) => routeValidity(machine, board, wire))
    .find((validity) => !validity.valid);
  return broken ? { valid: false, reason: 'Would break a routed track' } : placement;
}

// Return a new wire list so a retarget stays a single undoable edit. Outputs
// are exclusive: moving either end onto an occupied physical port is rejected
// rather than silently disconnecting another string.
export function retargetWire(wires, wireId, end, nextRef, route = null) {
  if (end !== 'from' && end !== 'to') return null;
  const wire = wires.find((candidate) => candidate.id === wireId);
  if (!wire) return null;
  if (wires.some((candidate) =>
    candidate.id !== wireId &&
    candidate[end].part === nextRef.part && candidate[end].port === nextRef.port)) return null;
  return wires.map((candidate) => candidate.id === wireId
    ? { ...candidate, [end]: { ...nextRef }, ...(route !== null ? { route: structuredClone(route) } : {}) }
    : candidate);
}

// Inserting a part preserves the selected wire ID on the first leg and adds
// one new leg. Every route cell covered by the new footprint is removed; this
// lets both one-cell specials and the two-cell string course through a square
// chassis replace a straight run without consuming the chassis' spare cells.
// The caller owns port eligibility and ID creation.
export function spliceWire(wires, wireId, partId, inputPort, outputPort, nextWireId, splitCells = null) {
  const wire = wires.find((candidate) => candidate.id === wireId);
  if (!wire || wires.some((candidate) => candidate.id === nextWireId)) return null;
  const requested = splitCells && !Array.isArray(splitCells) ? [splitCells] : splitCells;
  const splitIndexes = requested && Array.isArray(wire.route)
    ? requested.map((splitCell) => wire.route.findIndex((cell) =>
        cell.x === splitCell.x && cell.y === splitCell.y))
    : [];
  const sortedIndexes = [...splitIndexes].sort((a, b) => a - b);
  const hasContiguousSplit = sortedIndexes.length > 0 &&
    sortedIndexes.every((index, position) => index >= 0 &&
      (position === 0 || index === sortedIndexes[position - 1] + 1));
  if (requested?.length && !hasContiguousSplit) return null;
  const firstSplit = hasContiguousSplit ? sortedIndexes[0] : -1;
  const lastSplit = hasContiguousSplit ? sortedIndexes.at(-1) : -1;
  const firstRoute = firstSplit >= 0 ? wire.route.slice(0, firstSplit) : wire.route;
  const secondRoute = lastSplit >= 0 ? wire.route.slice(lastSplit + 1) : wire.route;
  const first = {
    ...wire,
    to: { part: partId, port: inputPort },
    ...(Array.isArray(firstRoute) ? { route: structuredClone(firstRoute) } : {}),
  };
  const second = {
    id: nextWireId,
    from: { part: partId, port: outputPort },
    to: { ...wire.to },
    ...(Array.isArray(secondRoute) ? { route: structuredClone(secondRoute) } : {}),
  };
  return wires.flatMap((candidate) => candidate.id === wireId ? [first, second] : [candidate]);
}
