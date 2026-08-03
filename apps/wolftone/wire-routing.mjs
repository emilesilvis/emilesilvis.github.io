// Spatial-routing prototype model.
//
// A wire stores the unoccupied grid cells between its source and destination:
//   { from, to, route: [{ x, y }, ...] }
//
// Physical port cells are implicit endpoints. Consequently a wire between
// adjacent, facing ports has an empty route and takes one tick, while every
// detour adds ticks.

import { partFootprintCells, portGeometry } from './part-geometry.mjs?v=0.9.1-7';

export const cellKey = ({ x, y }) => `${x},${y}`;

export function sameCell(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

export function adjacentCells(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function sideBetween(part, neighbor) {
  if (neighbor.x < part.x) return 'west';
  if (neighbor.x > part.x) return 'east';
  if (neighbor.y < part.y) return 'north';
  if (neighbor.y > part.y) return 'south';
  return null;
}

function partById(machine, id) {
  return machine.parts.find((part) => part.id === id);
}

export function wireRouteCells(machine, wire) {
  return Array.isArray(wire.route) ? wire.route : [];
}

export function wirePathCells(machine, wire) {
  const from = partById(machine, wire.from.part);
  const to = partById(machine, wire.to.part);
  if (!from || !to) return [];
  const fromPort = portGeometry(from, wire.from.port);
  const toPort = portGeometry(to, wire.to.port);
  if (!fromPort || !toPort) return [];
  return [
    { ...fromPort.cell },
    ...wireRouteCells(machine, wire).map(({ x, y }) => ({ x, y })),
    { ...toPort.cell },
  ];
}

// A Crossing can replace a routed cell only when the existing track passes
// straight through it. Returning the axis keeps painting feedback aligned with
// the same geometric rule used by the committed crossing edit.
export function wireAxisAtCell(machine, wire, cell) {
  const path = wirePathCells(machine, wire);
  const index = path.findIndex((candidate) => sameCell(candidate, cell));
  if (index <= 0 || index >= path.length - 1) return null;
  const previous = path[index - 1];
  const next = path[index + 1];
  if (previous.x === cell.x && next.x === cell.x) return 'vertical';
  if (previous.y === cell.y && next.y === cell.y) return 'horizontal';
  return null;
}

export function wireTravelTime(machine, wire) {
  const route = wireRouteCells(machine, wire);
  const from = partById(machine, wire.from.part);
  const to = partById(machine, wire.to.part);
  if (!from || !to) return 1;
  // DOM-free legacy physics fixtures still omit route data. Such a wire is
  // rejected by routeValidity and is never loadable or drawable in the game,
  // but retaining its historical timing keeps non-spatial engine tests useful.
  if (!Array.isArray(wire.route)) {
    return Math.max(1, Math.abs(from.x - to.x) + Math.abs(from.y - to.y));
  }
  return Math.max(1, route.length + 1);
}

export function occupiedWireCells(machine, { exceptWireId = null } = {}) {
  const occupied = new Map();
  for (const wire of machine.wires) {
    if (wire.id === exceptWireId) continue;
    for (const cell of wireRouteCells(machine, wire)) {
      occupied.set(cellKey(cell), wire.id);
    }
  }
  return occupied;
}

// A physical port accepts one endpoint. Keeping this rule beside the route
// model lets painting, snapping, and final validation share the same answer.
export function wireEndpointOccupied(wires, ref, dir, { exceptWireId = null } = {}) {
  if (dir === 'both') {
    return wires.some((wire) => wire.id !== exceptWireId &&
      ((wire.from.part === ref.part && wire.from.port === ref.port) ||
       (wire.to.part === ref.part && wire.to.port === ref.port)));
  }
  const end = dir === 'out' ? 'from' : dir === 'in' ? 'to' : null;
  if (!end) return false;
  return wires.some((wire) => wire.id !== exceptWireId &&
    wire[end].part === ref.part && wire[end].port === ref.port);
}

export function routeValidity(machine, board, wire, { exceptWireId = wire.id } = {}) {
  const from = partById(machine, wire.from.part);
  const to = partById(machine, wire.to.part);
  if (!from || !to) return { valid: false, reason: 'Missing endpoint' };
  if (!Array.isArray(wire.route)) return { valid: false, reason: 'Track needs an explicit route' };

  const fromPort = portGeometry(from, wire.from.port);
  const toPort = portGeometry(to, wire.to.port);
  if (!fromPort || !['out', 'both'].includes(fromPort.dir) ||
      !toPort || !['in', 'both'].includes(toPort.dir)) {
    return { valid: false, reason: 'Track needs a physical output and input' };
  }

  const partCells = new Map(machine.parts.flatMap((part) =>
    partFootprintCells(part).map((cell) => [cellKey(cell), part.id])));
  const occupied = occupiedWireCells(machine, { exceptWireId });
  const seen = new Set();
  for (const cell of wire.route) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= board.cols || cell.y >= board.rows) {
      return { valid: false, reason: 'Route leaves the board' };
    }
    const key = cellKey(cell);
    if (partCells.has(key)) return { valid: false, reason: 'Route crosses a part' };
    if (occupied.has(key)) return { valid: false, reason: 'Track overlaps another track' };
    if (seen.has(key)) return { valid: false, reason: 'Route visits a cell twice' };
    seen.add(key);
  }

  const path = wirePathCells(machine, wire);
  if (path.length < 2 || path.slice(1).some((cell, index) => !adjacentCells(path[index], cell))) {
    return { valid: false, reason: 'Route must be orthogonal and contiguous' };
  }
  if (!sameCell(path[1], fromPort.neighbor)) {
    return { valid: false, reason: 'Route leaves from the wrong port side' };
  }
  if (!sameCell(path.at(-2), toPort.neighbor)) {
    return { valid: false, reason: 'Route enters from the wrong port side' };
  }
  return { valid: true, reason: null };
}

const CARDINAL_STEPS = [
  { x: 1, y: 0, direction: 'east' },
  { x: 0, y: 1, direction: 'south' },
  { x: -1, y: 0, direction: 'west' },
  { x: 0, y: -1, direction: 'north' },
];

// Find a compact legal route for an existing pair of endpoints. Part movement
// uses this to keep connected tracks attached. Reusing old cells is the primary
// cost; among equally conservative routes, fewer bends and a shorter path win.
// That preserves deliberate timing detours whenever the new endpoint can still
// reach them.
export function findWireRoute(machine, board, wire) {
  const from = partById(machine, wire.from.part);
  const to = partById(machine, wire.to.part);
  if (!from || !to) return null;
  const fromPort = portGeometry(from, wire.from.port);
  const toPort = portGeometry(to, wire.to.port);
  if (!fromPort || !['out', 'both'].includes(fromPort.dir) ||
      !toPort || !['in', 'both'].includes(toPort.dir)) {
    return null;
  }

  // Facing ports in neighboring cells have no intervening route cell.
  if (sameCell(fromPort.neighbor, toPort.cell) && sameCell(toPort.neighbor, fromPort.cell)) return [];

  const start = fromPort.neighbor;
  const goal = toPort.neighbor;
  const onBoard = (cell) => cell.x >= 0 && cell.y >= 0 && cell.x < board.cols && cell.y < board.rows;
  if (!onBoard(start) || !onBoard(goal)) return null;

  const blocked = new Set(machine.parts.flatMap(partFootprintCells).map(cellKey));
  for (const candidate of machine.wires) {
    if (candidate.id === wire.id) continue;
    for (const cell of wireRouteCells(machine, candidate)) blocked.add(cellKey(cell));
  }
  if (blocked.has(cellKey(start)) || blocked.has(cellKey(goal))) return null;

  const preferred = new Set(wireRouteCells(machine, wire).map(cellKey));
  let order = 0;
  const frontier = [{
    cell: { ...start },
    path: [{ ...start }],
    direction: null,
    length: 1,
    changed: preferred.has(cellKey(start)) ? 0 : 1,
    bends: 0,
    order: order++,
  }];
  const best = new Map();
  const score = ({ length, changed, bends }) => changed * 1_000_000 + bends * 1_000 + length;

  while (frontier.length) {
    frontier.sort((left, right) => score(left) - score(right) || left.order - right.order);
    const current = frontier.shift();
    const stateKey = `${cellKey(current.cell)}|${current.direction ?? 'start'}`;
    if (best.has(stateKey) && best.get(stateKey) <= score(current)) continue;
    best.set(stateKey, score(current));
    if (sameCell(current.cell, goal)) return current.path;

    const nextSteps = CARDINAL_STEPS
      .map((step) => ({
        ...step,
        cell: { x: current.cell.x + step.x, y: current.cell.y + step.y },
      }))
      .sort((left, right) => {
        const leftDistance = Math.abs(goal.x - left.cell.x) + Math.abs(goal.y - left.cell.y);
        const rightDistance = Math.abs(goal.x - right.cell.x) + Math.abs(goal.y - right.cell.y);
        return leftDistance - rightDistance;
      });
    for (const next of nextSteps) {
      const key = cellKey(next.cell);
      if (!onBoard(next.cell) || blocked.has(key) || current.path.some((cell) => sameCell(cell, next.cell))) {
        continue;
      }
      frontier.push({
        cell: next.cell,
        path: [...current.path, next.cell],
        direction: next.direction,
        length: current.length + 1,
        changed: current.changed + (preferred.has(key) ? 0 : 1),
        bends: current.bends + (current.direction && current.direction !== next.direction ? 1 : 0),
        order: order++,
      });
    }
  }
  return null;
}

export function machineArea(machine) {
  const cells = [
    ...machine.parts.flatMap(partFootprintCells),
    ...machine.wires.flatMap((wire) => wireRouteCells(machine, wire)),
  ];
  if (!cells.length) return 0;
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  return (Math.max(...xs) - Math.min(...xs) + 1) *
    (Math.max(...ys) - Math.min(...ys) + 1);
}

// Extend a painted route towards a pointer cell. Moving over an earlier route
// cell backtracks; fast pointer movement is filled one orthogonal step at a
// time. The first obstacle stops the stroke without corrupting its valid head.
export function extendRoute(route, destination, anchor, canOccupy) {
  if (sameCell(destination, anchor)) return [];
  const existingIndex = route.findIndex((cell) => sameCell(cell, destination));
  if (existingIndex >= 0) return route.slice(0, existingIndex + 1);

  const next = route.map(({ x, y }) => ({ x, y }));
  let current = next.at(-1) ?? anchor;
  const xFirst = Math.abs(destination.x - current.x) >= Math.abs(destination.y - current.y);
  const axes = xFirst ? ['x', 'y'] : ['y', 'x'];
  for (const axis of axes) {
    while (current[axis] !== destination[axis]) {
      const candidate = {
        x: current.x + (axis === 'x' ? Math.sign(destination.x - current.x) : 0),
        y: current.y + (axis === 'y' ? Math.sign(destination.y - current.y) : 0),
      };
      if (sameCell(candidate, anchor)) {
        // Crossing back over the device must not let the stroke emerge from a
        // different side. Clear to the port and wait for a later movement on
        // its physical side to seed the route again.
        return [];
      }
      if (!canOccupy(candidate, current)) return next;
      next.push(candidate);
      current = candidate;
    }
  }
  return next;
}

// The first painted cell is dictated by the physical side of the port, not by
// the dominant axis of a fast pointer movement. Once that cell is seeded, the
// normal painter may fill any skipped cells and backtrack as usual.
export function extendRouteFromPort(route, destination, anchor, neighbor, canOccupy) {
  if (sameCell(destination, anchor)) return [];
  if (route.length) return extendRoute(route, destination, anchor, canOccupy);
  if (!neighbor || !canOccupy(neighbor, anchor)) return [];
  return extendRoute([{ ...neighbor }], destination, anchor, canOccupy);
}
