// Browser-independent route labels used by the coupling inspector. Keeping
// this transformation outside main.mjs lets UI copy stay testable without
// booting the whole player shell.

import {
  cellKey,
  findWireRoute,
  occupiedWireCells,
  routeValidity,
  sameCell,
  wirePathCells,
  wireRouteCells,
} from './wire-routing.mjs?v=0.9.2-2';
import { partFootprintCells, portGeometry } from './part-geometry.mjs?v=0.9.2-2';
import { PORTS } from './engine.mjs?v=0.9.2-2';

// Multi-port mechanisms expose player-facing courses for drop-to-splice. A
// Crossing can use either isolated channel in either direction; other parts
// use one primary course and leave their remaining sockets free. Coupling has
// no straight-through course and stays excluded.
const PRIMARY_TRACK_COURSES = {
  unison: [{ input: 'lead', output: 'out' }],
  splitter: [{ input: 'in', output: 'head' }],
  fork: [{ input: 'in', output: 'left' }],
  crossing: [
    { input: 'inA', output: 'outA' },
    { input: 'outA', output: 'inA' },
    { input: 'inB', output: 'outB' },
    { input: 'outB', output: 'inB' },
  ],
  junction: [{ input: 'inA', output: 'out' }],
};

export function couplingRouteText(targetSide, otherHead, exitSide) {
  const sourceSide = targetSide === 'A' ? 'B' : 'A';
  return `${sourceSide}:${otherHead}→${exitSide}`;
}

// Placement preview and placement commit share this test so the ghost never
// promises a cell that the click will reject. The canvas is unbounded, so
// only occupancy can refuse a cell.
export function placementValidity(parts, candidate, wires = []) {
  const footprint = partFootprintCells(candidate);
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

// Find the one routed track that can be replaced by a part's straight-through
// course at this cell. The browser uses this same DOM-free decision for the
// placement ghost and the committed edit.
export function spliceCandidateAtCell(machine, kind, x, y, orientation = 0) {
  const ports = PORTS[kind];
  if (!ports) return null;
  const insertionCourses = PRIMARY_TRACK_COURSES[kind] ??
    (ports.ins.length === 1 && ports.outs.length === 1
      ? [{ input: ports.ins[0], output: ports.outs[0] }]
      : null);
  if (!insertionCourses) return null;
  const candidates = machine.wires.filter((wire) =>
    wireRouteCells(machine, wire).some((cell) => cell.x === x && cell.y === y));
  if (candidates.length !== 1) return null;
  const wire = candidates[0];
  const inserted = { id: '__insertion__', kind, x, y, orientation };
  const footprint = partFootprintCells(inserted);
  const path = wirePathCells(machine, wire);
  for (const insertionPorts of insertionCourses) {
    const input = portGeometry(inserted, insertionPorts.input);
    const output = portGeometry(inserted, insertionPorts.output);
    if (!input || !output || (input.cell.x !== output.cell.x && input.cell.y !== output.cell.y)) continue;
    const course = [input.cell];
    let cursor = input.cell;
    while (!sameCell(cursor, output.cell)) {
      cursor = {
        x: cursor.x + Math.sign(output.cell.x - cursor.x),
        y: cursor.y + Math.sign(output.cell.y - cursor.y),
      };
      course.push(cursor);
    }
    const courseKeys = new Set(course.map(cellKey));
    const unusedFootprint = footprint.filter((cell) => !courseKeys.has(cellKey(cell)));
    if (unusedFootprint.some((cell) =>
      machine.parts.some((part) => partFootprintCells(part).some((occupied) => sameCell(cell, occupied))) ||
      machine.wires.some((candidate) => wireRouteCells(machine, candidate).some((occupied) => sameCell(cell, occupied))))) {
      continue;
    }
    const indexes = course.map((courseCell) => path.findIndex((cell) => sameCell(cell, courseCell)));
    if (indexes.some((index) => index <= 0 || index >= path.length - 1) ||
        indexes.some((index, position) => position > 0 && index !== indexes[position - 1] + 1)) continue;
    const previous = path[indexes[0] - 1];
    const next = path[indexes.at(-1) + 1];
    if (!previous || !next || (previous.x !== next.x && previous.y !== next.y)) continue;
    if (sameCell(input.neighbor, previous) && sameCell(output.neighbor, next)) {
      return {
        ...wire,
        cells: course,
        inputPort: insertionPorts.input,
        outputPort: insertionPorts.output,
      };
    }
  }
  return null;
}

function nextUniqueId(prefix, taken) {
  let index = 1;
  while (taken.has(`${prefix}${index}`)) index += 1;
  const id = `${prefix}${index}`;
  taken.add(id);
  return id;
}

function crossingChannel(crossing, previous, next) {
  for (const channel of ['A', 'B']) {
    const input = portGeometry(crossing, `in${channel}`);
    const output = portGeometry(crossing, `out${channel}`);
    if (sameCell(input.neighbor, previous) && sameCell(output.neighbor, next)) return channel;
  }
  return null;
}

function crossingForPaths(cell, existingPrevious, existingNext, newPrevious, newNext, id) {
  for (let orientation = 0; orientation < 4; orientation += 1) {
    const crossing = { id, kind: 'crossing', ...cell, orientation, config: {} };
    const existingChannel = crossingChannel(crossing, existingPrevious, existingNext);
    const newChannel = crossingChannel(crossing, newPrevious, newNext);
    if (existingChannel && newChannel && existingChannel !== newChannel) {
      return { crossing, existingChannel, newChannel };
    }
  }
  return null;
}

// Install a newly drawn or retargeted wire as one atomic prospective edit.
// Every perpendicular straight-through overlap becomes a one-cell Crossing;
// bends and parallel overlaps remain illegal. The requested wire ID stays on
// its first leg, while all additional legs receive collision-free IDs.
export function routeWireWithCrossings(machine, wire) {
  const parts = structuredClone(machine.parts);
  let wires = structuredClone(machine.wires.filter((candidate) => candidate.id !== wire.id));
  const logicalWire = structuredClone(wire);
  const partIds = new Set(parts.map((part) => part.id));
  const wireIds = new Set([...wires.map((candidate) => candidate.id), logicalWire.id]);
  const fullNewPath = wirePathCells({ parts, wires: [] }, logicalWire);
  if (fullNewPath.length !== (logicalWire.route?.length ?? -2) + 2) {
    return { valid: false, reason: 'Missing endpoint', parts: machine.parts, wires: machine.wires, crossings: [] };
  }

  const crossings = [];
  for (let routeIndex = 0; routeIndex < logicalWire.route.length; routeIndex += 1) {
    const cell = logicalWire.route[routeIndex];
    const overlapping = wires.filter((candidate) =>
      wireRouteCells({ parts, wires }, candidate).some((occupied) => sameCell(occupied, cell)));
    if (!overlapping.length) continue;
    if (overlapping.length > 1) {
      return { valid: false, reason: 'Crossing cell has more than one track', parts: machine.parts, wires: machine.wires, crossings: [] };
    }

    const existing = overlapping[0];
    const existingPath = wirePathCells({ parts, wires }, existing);
    const existingIndex = existingPath.findIndex((candidate) => sameCell(candidate, cell));
    const crossingId = nextUniqueId('c', partIds);
    const match = crossingForPaths(
      cell,
      existingPath[existingIndex - 1],
      existingPath[existingIndex + 1],
      fullNewPath[routeIndex],
      fullNewPath[routeIndex + 2],
      crossingId,
    );
    if (!match) {
      return { valid: false, reason: 'Crossings must be straight and perpendicular', parts: machine.parts, wires: machine.wires, crossings: [] };
    }

    parts.push(match.crossing);
    const split = spliceWire(
      wires,
      existing.id,
      crossingId,
      `in${match.existingChannel}`,
      `out${match.existingChannel}`,
      nextUniqueId('w', wireIds),
      cell,
    );
    if (!split) {
      return { valid: false, reason: 'Could not split the crossed track', parts: machine.parts, wires: machine.wires, crossings: [] };
    }
    wires = split;
    crossings.push({ routeIndex, crossing: match.crossing, channel: match.newChannel });
  }

  let from = structuredClone(logicalWire.from);
  let start = 0;
  for (const [index, { routeIndex, crossing, channel }] of crossings.entries()) {
    wires.push({
      id: index === 0 ? logicalWire.id : nextUniqueId('w', wireIds),
      from,
      to: { part: crossing.id, port: `in${channel}` },
      route: structuredClone(logicalWire.route.slice(start, routeIndex)),
    });
    from = { part: crossing.id, port: `out${channel}` };
    start = routeIndex + 1;
  }
  wires.push({
    id: crossings.length ? nextUniqueId('w', wireIds) : logicalWire.id,
    from,
    to: structuredClone(logicalWire.to),
    route: structuredClone(logicalWire.route.slice(start)),
  });

  const prospective = { parts, wires };
  const invalid = wires
    .map((candidate) => routeValidity(prospective, candidate))
    .find((validity) => !validity.valid);
  return invalid
    ? { ...invalid, parts: machine.parts, wires: machine.wires, crossings: [] }
    : { valid: true, reason: null, parts, wires, crossings: crossings.map(({ crossing }) => crossing) };
}

function resolveMovedWires(parts, stationaryWires, preferredWires) {
  const resolved = new Map(stationaryWires.map((wire) => [wire.id, wire]));
  for (const preferred of preferredWires) {
    let nextWire = preferred;
    let nextMachine = { parts, wires: [...resolved.values(), nextWire] };
    if (!routeValidity(nextMachine, nextWire).valid) {
      const route = findWireRoute(nextMachine, nextWire);
      if (route === null) return null;
      nextWire = { ...nextWire, route };
      nextMachine = { parts, wires: [...resolved.values(), nextWire] };
      if (!routeValidity(nextMachine, nextWire).valid) return null;
    }
    resolved.set(nextWire.id, nextWire);
  }
  return resolved;
}

// Translate several parts as one atomic edit. Tracks wholly inside the
// selection keep their exact geometry and timing by translating with it;
// tracks crossing the selection edge stay anchored outside and reroute. No
// prospective state escapes when any footprint or route is illegal.
export function groupMovementEdit(parts, partIds, { dx, dy }, wires = []) {
  const selectedIds = new Set(partIds);
  if (!selectedIds.size || [...selectedIds].some((id) => !parts.some((part) => part.id === id))) {
    return { valid: false, reason: 'Missing part', parts, wires };
  }

  const stationaryParts = parts.filter((part) => !selectedIds.has(part.id));
  const movedParts = parts
    .filter((part) => selectedIds.has(part.id))
    .map((part) => ({ ...part, x: part.x + dx, y: part.y + dy }));
  const connectedWires = wires.filter((wire) =>
    selectedIds.has(wire.from.part) || selectedIds.has(wire.to.part));
  const stationaryWires = wires.filter((wire) => !connectedWires.includes(wire));

  const placed = [...stationaryParts];
  for (const candidate of movedParts) {
    const placement = placementValidity(placed, candidate, stationaryWires);
    if (!placement.valid) return { ...placement, parts, wires };
    placed.push(candidate);
  }
  const nextPartsById = new Map(movedParts.map((part) => [part.id, part]));
  const nextParts = parts.map((part) => nextPartsById.get(part.id) ?? part);

  const internalWires = connectedWires
    .filter((wire) => selectedIds.has(wire.from.part) && selectedIds.has(wire.to.part))
    .map((wire) => ({
      ...wire,
      route: Array.isArray(wire.route)
        ? wire.route.map((cell) => ({ x: cell.x + dx, y: cell.y + dy }))
        : wire.route,
    }));
  const edgeWires = connectedWires
    .filter((wire) => !selectedIds.has(wire.from.part) || !selectedIds.has(wire.to.part));

  // Internal tracks define the collection's shape, so reserve them before
  // flexible edge tracks search for new routes.
  const internalResult = new Map(stationaryWires.map((wire) => [wire.id, wire]));
  for (const internalWire of internalWires) {
    const nextMachine = {
      parts: nextParts,
      wires: [...internalResult.values(), internalWire],
    };
    if (!routeValidity(nextMachine, internalWire).valid) {
      return { valid: false, reason: 'Would break a routed track', parts, wires };
    }
    internalResult.set(internalWire.id, internalWire);
  }
  const resolved = resolveMovedWires(
    nextParts, [...internalResult.values()], edgeWires,
  );
  if (!resolved) {
    return { valid: false, reason: 'Would break a routed track', parts, wires };
  }
  return {
    valid: true,
    reason: null,
    parts: nextParts,
    wires: wires.map((wire) => resolved.get(wire.id)),
  };
}

// Return the prospective machine for a part move. Position-only changes use
// the group interface so one-part and many-part drags cannot disagree. A
// rotation keeps the same connected-track preservation rules at this seam.
export function partMovementEdit(parts, partId, change, wires = []) {
  const current = parts.find((part) => part.id === partId);
  if (!current) return { valid: false, reason: 'Missing part', parts, wires };
  if (change.orientation === undefined) {
    return groupMovementEdit(parts, [partId], {
      dx: (change.x ?? current.x) - current.x,
      dy: (change.y ?? current.y) - current.y,
    }, wires);
  }

  const candidate = { ...current, ...change };
  const connectedIds = new Set(wires
    .filter((wire) => wire.from.part === partId || wire.to.part === partId)
    .map((wire) => wire.id));
  const stationaryWires = wires.filter((wire) => !connectedIds.has(wire.id));
  const placement = placementValidity(
    parts.filter((part) => part.id !== partId), candidate, stationaryWires,
  );
  if (!placement.valid) return { ...placement, parts, wires };

  const nextParts = parts.map((part) => part.id === partId ? candidate : part);
  const preferredWires = wires.filter((wire) => connectedIds.has(wire.id));
  const resolved = resolveMovedWires(nextParts, stationaryWires, preferredWires);
  return resolved
    ? {
      valid: true,
      reason: null,
      parts: nextParts,
      wires: wires.map((wire) => resolved.get(wire.id)),
    }
    : { valid: false, reason: 'Would break a routed track', parts, wires };
}

export function movementValidity(parts, partId, change, wires = []) {
  const { valid, reason } = partMovementEdit(parts, partId, change, wires);
  return { valid, reason };
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
