// Deterministic migration of bundled endpoint-only references into physical
// spatial layouts. This is reference authoring infrastructure, not a player
// router: the returned machines contain concrete orientations, footprints,
// Junctions, Crossings, and explicit route arrays before the UI can load them.

import { spliceWire } from './board-layout.mjs?v=0.9.2-1';
import { runCase } from './engine.mjs?v=0.9.2-1';
import { partFootprintCells, portGeometry } from './part-geometry.mjs?v=0.9.2-1';
import { cellKey, routeValidity, wirePathCells } from './wire-routing.mjs?v=0.9.2-1';

const DIRECTIONS = [
  { name: 'east', x: 1, y: 0 },
  { name: 'south', x: 0, y: 1 },
  { name: 'west', x: -1, y: 0 },
  { name: 'north', x: 0, y: -1 },
];

const TERMINAL_KINDS = new Set(['quill', 'resonator']);
const PORT_CLEARANCE = 2;
const REFERENCE_SPACINGS = [7, 8, 9];

function clone(value) {
  return structuredClone(value);
}

function sameCell(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}

function portKey(ref) {
  return `${ref.part}.${ref.port}`;
}

function inputKey(wire) {
  return portKey(wire.to);
}

function nextUniqueId(prefix, taken) {
  let index = 1;
  while (taken.has(`${prefix}${index}`)) index += 1;
  const id = `${prefix}${index}`;
  taken.add(id);
  return id;
}

function expandFanIn(parts, sourceWires) {
  const taken = new Set(parts.map((part) => part.id));
  const groups = new Map();
  for (const wire of sourceWires) {
    const group = groups.get(inputKey(wire)) ?? [];
    group.push(wire);
    groups.set(inputKey(wire), group);
  }

  const wires = [];
  let edgeIndex = 1;
  const edge = (from, to) => ({ id: `logical${edgeIndex++}`, from: clone(from), to: clone(to) });
  for (const group of groups.values()) {
    if (group.length === 1) {
      wires.push(edge(group[0].from, group[0].to));
      continue;
    }

    const target = clone(group[0].to);
    const targetPart = parts.find((part) => part.id === target.part);
    let previousOutput = null;
    group.forEach((wire, index) => {
      if (index === 0) return;
      const junction = {
        id: nextUniqueId('jref', taken),
        kind: 'junction',
        x: targetPart?.x ?? 0,
        y: targetPart?.y ?? 0,
        orientation: 0,
        config: {},
        referenceAdded: true,
      };
      parts.push(junction);
      if (index === 1) {
        wires.push(edge(group[0].from, { part: junction.id, port: 'inA' }));
      } else {
        wires.push(edge(previousOutput, { part: junction.id, port: 'inA' }));
      }
      wires.push(edge(wire.from, { part: junction.id, port: 'inB' }));
      previousOutput = { part: junction.id, port: 'out' };
    });
    wires.push(edge(previousOutput, target));
  }
  return wires;
}

// Collapse feedback loops before assigning columns. Edges between components
// form a DAG, so every non-feedback stage can advance from left to right while
// the members of a loop stay together in one compact workshop band.
function stronglyConnectedComponents(parts, wires) {
  const ids = new Set(parts.map((part) => part.id));
  const outgoing = new Map(parts.map((part) => [part.id, []]));
  for (const wire of wires) {
    if (ids.has(wire.from.part) && ids.has(wire.to.part)) {
      outgoing.get(wire.from.part).push(wire.to.part);
    }
  }

  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const stacked = new Set();
  const components = [];

  function visit(id) {
    indexes.set(id, nextIndex);
    lowLinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    stacked.add(id);

    for (const target of outgoing.get(id)) {
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(target)));
      } else if (stacked.has(target)) {
        lowLinks.set(id, Math.min(lowLinks.get(id), indexes.get(target)));
      }
    }

    if (lowLinks.get(id) !== indexes.get(id)) return;
    const component = [];
    let member = null;
    do {
      member = stack.pop();
      stacked.delete(member);
      component.push(member);
    } while (member !== id);
    components.push(component);
  }

  for (const part of parts) {
    if (!indexes.has(part.id)) visit(part.id);
  }
  return components;
}

function leftToRightLayout(parts, wires, spacing) {
  const components = stronglyConnectedComponents(parts, wires);
  const componentByPart = new Map();
  components.forEach((component, index) => {
    for (const id of component) componentByPart.set(id, index);
  });

  const successors = components.map(() => new Set());
  const incoming = components.map(() => 0);
  for (const wire of wires) {
    const from = componentByPart.get(wire.from.part);
    const to = componentByPart.get(wire.to.part);
    if (from === undefined || to === undefined || from === to || successors[from].has(to)) continue;
    successors[from].add(to);
    incoming[to] += 1;
  }

  const ranks = components.map(() => 0);
  const queue = incoming
    .map((count, index) => ({ count, index }))
    .filter(({ count }) => count === 0)
    .map(({ index }) => index);
  while (queue.length) {
    const current = queue.shift();
    for (const successor of successors[current]) {
      ranks[successor] = Math.max(ranks[successor], ranks[current] + 1);
      incoming[successor] -= 1;
      if (incoming[successor] === 0) queue.push(successor);
    }
  }

  // Align every destination on the final column. A short direct branch should
  // not put one Resonator in the middle of a longer machine.
  const byId = new Map(parts.map((part) => [part.id, part]));
  const processingRanks = components
    .map((component, index) => component.some((id) => byId.get(id).kind !== 'resonator')
      ? ranks[index]
      : null)
    .filter((rank) => rank !== null);
  const resonatorRank = Math.max(...processingRanks, 0) + 1;
  components.forEach((component, index) => {
    if (component.every((id) => byId.get(id).kind === 'resonator')) ranks[index] = resonatorRank;
  });

  const componentLayouts = components.map((component, index) => {
    const members = component.map((id) => byId.get(id)).sort((a, b) =>
      Number(Boolean(a.referenceAdded)) - Number(Boolean(b.referenceAdded)) ||
      a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
    // A feedback component is still a miniature directed graph. Pack larger
    // loops across a few columns so repeated journeys remain short and the
    // machine does not become one very tall stack.
    const width = members.length <= 2
      ? 1
      : Math.max(2, Math.ceil(Math.sqrt(members.length * 1.4)));
    return {
      index,
      rank: ranks[index],
      members,
      width,
      height: Math.ceil(members.length / width),
      authoredY: Math.min(...members.map((part) => part.y)),
    };
  });
  const layers = new Map();
  for (const component of componentLayouts) {
    const layer = layers.get(component.rank) ?? [];
    layer.push(component);
    layers.set(component.rank, layer);
  }

  let column = 0;
  let rows = 1;
  for (const rank of [...layers.keys()].sort((a, b) => a - b)) {
    const layer = layers.get(rank).sort((a, b) =>
      a.authoredY - b.authoredY || a.index - b.index);
    const layerWidth = Math.max(...layer.map((component) => component.width));
    let row = 0;
    for (const component of layer) {
      component.members.forEach((part, index) => {
        part.x = (column + index % component.width) * spacing;
        part.y = (row + Math.floor(index / component.width)) * spacing;
      });
      row += component.height;
    }
    rows = Math.max(rows, row);
    column += layerWidth;
  }

  return { columns: column, rows };
}

function connectedPorts(wires) {
  const ports = new Map();
  for (const wire of wires) {
    ports.set(portKey(wire.from), wire.id);
    ports.set(portKey(wire.to), wire.id);
  }
  return ports;
}

function inside(board, cell) {
  return cell.x >= 0 && cell.y >= 0 && cell.x < board.cols && cell.y < board.rows;
}

function placementOptions(part, desired, board) {
  const options = [];
  const maxRadius = board.cols + board.rows;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const dy = radius - Math.abs(dx);
      for (const signedY of dy === 0 ? [0] : [-dy, dy]) {
        for (let orientation = 0; orientation < 4; orientation += 1) {
          options.push({
            ...part,
            x: desired.x + dx,
            y: desired.y + signedY,
            orientation,
          });
        }
      }
    }
  }
  return options;
}

function placeParts(parts, wires, board, margin) {
  const ports = connectedPorts(wires);
  const occupied = new Set();
  const reserved = new Map();
  const placed = [];

  const ordered = [...parts].sort((a, b) =>
    Number(Boolean(a.referenceAdded)) - Number(Boolean(b.referenceAdded)) ||
    a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));

  for (const part of ordered) {
    const desired = { x: part.x + margin, y: part.y + margin };
    const usedPorts = [...ports.entries()]
      .filter(([key]) => key.startsWith(`${part.id}.`))
      .map(([key, wireId]) => ({ name: key.slice(part.id.length + 1), wireId }));
    const candidate = placementOptions(part, desired, board).find((option) => {
      const footprint = partFootprintCells(option);
      if (footprint.some((cell) => !inside(board, cell) || occupied.has(cellKey(cell)) || reserved.has(cellKey(cell)))) {
        return false;
      }
      const neighbors = [];
      for (const { name, wireId } of usedPorts) {
        const geometry = portGeometry(option, name);
        if (!geometry || !inside(board, geometry.neighbor)) return false;
        const delta = {
          x: geometry.neighbor.x - geometry.cell.x,
          y: geometry.neighbor.y - geometry.cell.y,
        };
        const stub = Array.from({ length: PORT_CLEARANCE }, (_, index) => ({
          x: geometry.cell.x + delta.x * (index + 1),
          y: geometry.cell.y + delta.y * (index + 1),
        }));
        for (const cell of stub) {
          if (!inside(board, cell)) return false;
          const key = cellKey(cell);
          if (occupied.has(key) || footprint.some((partCell) => cellKey(partCell) === key)) return false;
          const owner = reserved.get(key);
          if (owner && owner !== wireId) return false;
          neighbors.push({ key, wireId });
        }
      }
      return neighbors.every(({ key, wireId }, index) =>
        !neighbors.slice(0, index).some((other) => other.key === key && other.wireId !== wireId));
    });
    if (!candidate) throw new Error(`No spatial placement for ${part.id}`);

    placed.push(candidate);
    for (const cell of partFootprintCells(candidate)) occupied.add(cellKey(cell));
    for (const { name, wireId } of usedPorts) {
      const geometry = portGeometry(candidate, name);
      const delta = {
        x: geometry.neighbor.x - geometry.cell.x,
        y: geometry.neighbor.y - geometry.cell.y,
      };
      for (let distance = 1; distance <= PORT_CLEARANCE; distance += 1) {
        reserved.set(cellKey({
          x: geometry.cell.x + delta.x * distance,
          y: geometry.cell.y + delta.y * distance,
        }), wireId);
      }
    }
  }
  return { parts: placed, reserved };
}

function directionBetween(from, to) {
  return DIRECTIONS.find((direction) =>
    from.x + direction.x === to.x && from.y + direction.y === to.y)?.name ?? null;
}

function perpendicular(a, b) {
  const horizontalA = a === 'east' || a === 'west';
  const horizontalB = b === 'east' || b === 'west';
  return horizontalA !== horizontalB;
}

function routeOccupancy(machine) {
  const occupied = new Map();
  for (const wire of machine.wires) {
    const path = wirePathCells(machine, wire);
    wire.route.forEach((cell, routeIndex) => {
      const index = routeIndex + 1;
      const previous = path[index - 1];
      const next = path[index + 1];
      const enter = directionBetween(previous, cell);
      const leave = directionBetween(cell, next);
      occupied.set(cellKey(cell), {
        wireId: wire.id,
        direction: enter === leave ? enter : null,
      });
    });
  }
  return occupied;
}

function findRoute(machine, board, reservations, logicalWire) {
  const fromPart = machine.parts.find((part) => part.id === logicalWire.from.part);
  const toPart = machine.parts.find((part) => part.id === logicalWire.to.part);
  const fromPort = portGeometry(fromPart, logicalWire.from.port);
  const toPort = portGeometry(toPart, logicalWire.to.port);
  const start = fromPort.neighbor;
  const goal = toPort.neighbor;
  const waypoint = logicalWire.waypoint ?? null;
  const initialPhase = waypoint && !sameCell(start, waypoint) ? 0 : 1;
  const partCells = new Set(machine.parts.flatMap(partFootprintCells).map(cellKey));
  const occupied = routeOccupancy(machine);
  const queue = [{ cell: start, direction: null, phase: initialPhase, cost: 0, score: 0 }];
  const best = new Map([[`${cellKey(start)}|start|${initialPhase}`, 0]]);
  const previous = new Map();
  let destinationKey = null;

  while (queue.length) {
    queue.sort((a, b) => a.score - b.score || a.cost - b.cost);
    const current = queue.shift();
    const currentKey = `${cellKey(current.cell)}|${current.direction ?? 'start'}|${current.phase}`;
    if (current.cost !== best.get(currentKey)) continue;
    if (current.phase === 1 && sameCell(current.cell, goal)) {
      destinationKey = currentKey;
      break;
    }
    const currentOccupant = occupied.get(cellKey(current.cell));
    for (const direction of DIRECTIONS) {
      if (currentOccupant && direction.name !== current.direction) continue;
      const next = { x: current.cell.x + direction.x, y: current.cell.y + direction.y };
      if (!inside(board, next) || partCells.has(cellKey(next))) continue;
      const reservation = reservations.get(cellKey(next));
      if (reservation && reservation !== logicalWire.id) continue;
      const nextOccupant = occupied.get(cellKey(next));
      if (nextOccupant && (!nextOccupant.direction || !perpendicular(direction.name, nextOccupant.direction))) {
        continue;
      }
      const crossingCost = nextOccupant ? 7 : 0;
      const bendCost = current.direction && current.direction !== direction.name ? 0.35 : 0;
      const cost = current.cost + 1 + crossingCost + bendCost;
      const phase = current.phase === 0 && sameCell(next, waypoint) ? 1 : current.phase;
      const key = `${cellKey(next)}|${direction.name}|${phase}`;
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);
      previous.set(key, { key: currentKey, cell: current.cell });
      const target = phase === 0 ? waypoint : goal;
      const afterWaypoint = phase === 0
        ? Math.abs(goal.x - waypoint.x) + Math.abs(goal.y - waypoint.y)
        : 0;
      const heuristic = Math.abs(target.x - next.x) + Math.abs(target.y - next.y) + afterWaypoint;
      queue.push({ cell: next, direction: direction.name, phase, cost, score: cost + heuristic });
    }
  }
  if (!destinationKey) {
    throw new Error(
      `No spatial route for ${logicalWire.id} ${portKey(logicalWire.from)}@${cellKey(start)} to ` +
      `${portKey(logicalWire.to)}@${cellKey(goal)}`,
    );
  }

  const route = [];
  let key = destinationKey;
  let cell = { ...goal };
  while (key) {
    route.push(cell);
    const step = previous.get(key);
    if (!step) break;
    key = step.key;
    cell = step.cell;
  }
  route.reverse();
  return route;
}

function channelFor(crossing, previous, next) {
  for (const channel of ['A', 'B']) {
    const input = portGeometry(crossing, `in${channel}`);
    const output = portGeometry(crossing, `out${channel}`);
    if (sameCell(input.neighbor, previous) && sameCell(output.neighbor, next)) return channel;
  }
  return null;
}

function crossingOrientation(cell, existingPrevious, existingNext, newPrevious, newNext, id) {
  for (let orientation = 0; orientation < 4; orientation += 1) {
    const crossing = { id, kind: 'crossing', ...cell, orientation, config: {}, referenceAdded: true };
    const existingChannel = channelFor(crossing, existingPrevious, existingNext);
    const newChannel = channelFor(crossing, newPrevious, newNext);
    if (existingChannel && newChannel && existingChannel !== newChannel) {
      return { crossing, existingChannel, newChannel };
    }
  }
  return null;
}

function installWire(machine, board, logicalWire, path, ids) {
  const crossings = [];
  const fullNewPath = [
    portGeometry(machine.parts.find((part) => part.id === logicalWire.from.part), logicalWire.from.port).cell,
    ...path,
    portGeometry(machine.parts.find((part) => part.id === logicalWire.to.part), logicalWire.to.port).cell,
  ];

  path.forEach((cell, routeIndex) => {
    const existing = machine.wires.find((wire) =>
      wire.route.some((candidate) => sameCell(candidate, cell)));
    if (!existing) return;
    const existingPath = wirePathCells(machine, existing);
    const existingIndex = existingPath.findIndex((candidate) => sameCell(candidate, cell));
    const crossingId = nextUniqueId('xref', ids.parts);
    const match = crossingOrientation(
      cell,
      existingPath[existingIndex - 1],
      existingPath[existingIndex + 1],
      fullNewPath[routeIndex],
      fullNewPath[routeIndex + 2],
      crossingId,
    );
    if (!match) throw new Error(`No Crossing orientation at ${cellKey(cell)}`);
    machine.parts.push(match.crossing);
    const split = spliceWire(
      machine.wires,
      existing.id,
      crossingId,
      `in${match.existingChannel}`,
      `out${match.existingChannel}`,
      nextUniqueId('rw', ids.wires),
      cell,
    );
    if (!split) throw new Error(`Could not split ${existing.id} at Crossing`);
    machine.wires = split;
    crossings.push({ routeIndex, crossing: match.crossing, channel: match.newChannel });
  });

  let from = clone(logicalWire.from);
  let start = 0;
  crossings.sort((a, b) => a.routeIndex - b.routeIndex).forEach(({ routeIndex, crossing, channel }, index) => {
    machine.wires.push({
      id: index === 0 ? logicalWire.id : nextUniqueId('rw', ids.wires),
      from,
      to: { part: crossing.id, port: `in${channel}` },
      route: clone(path.slice(start, routeIndex)),
    });
    from = { part: crossing.id, port: `out${channel}` };
    start = routeIndex + 1;
  });
  machine.wires.push({
    id: crossings.length ? nextUniqueId('rw', ids.wires) : logicalWire.id,
    from,
    to: clone(logicalWire.to),
    route: clone(path.slice(start)),
  });

  for (const wire of machine.wires) {
    const validity = routeValidity(machine, board, wire);
    if (!validity.valid) throw new Error(`${wire.id}: ${validity.reason}`);
  }
}

function spatializeReferenceAtSpacing(level, spacing) {
  const original = clone(level);
  const originalParts = [...original.fixed, ...original.reference.parts].map((part) => ({
    orientation: 0,
    config: {},
    ...part,
  }));
  const originalFixedIds = new Set(original.fixed.map((part) => part.id));
  const logicalWires = expandFanIn(originalParts, original.reference.wires);
  // Leave enough room for the physical port stubs while keeping bundled
  // examples close enough to read as one machine rather than scattered parts.
  // Graph layers make the authored answer read in the same direction as text:
  // Quills on the left, transformations in the middle, Resonators on the right.
  const { columns, rows } = leftToRightLayout(originalParts, logicalWires, spacing);
  const margin = 4;
  const board = {
    cols: (columns - 1) * spacing + margin * 2 + 2,
    rows: (rows - 1) * spacing + margin * 2 + 2,
  };
  const placement = placeParts(originalParts, logicalWires, board, margin);
  if (level.id === 'the-valve') {
    const delayedTail = logicalWires.find((wire) => wire.from.part === 'q4');
    if (delayedTail) delayedTail.waypoint = { x: 1, y: board.rows - 2 };
  }
  if (level.id === 'valve-race') {
    const delayedLead = logicalWires.find((wire) => wire.from.part === 'q1');
    const delayedTail = logicalWires.find((wire) => wire.from.part === 'q4');
    if (delayedLead) delayedLead.waypoint = { x: 1, y: board.rows - 2 };
    if (delayedTail) delayedTail.waypoint = { x: 1, y: 1 };
  }
  // The archived shared-pipeline study deliberately sends three simultaneous
  // Quills through one workshop. Its old Manhattan placement staggered those
  // arrivals. Preserve that authored ordering now that fan-in is represented
  // by physical Junctions instead of several wires sharing one input port.
  const delayedSharedVoice = level.id.endsWith('-shared-pipeline')
    ? logicalWires.find((wire) => wire.from.part === 'qC')
    : null;
  const sharedWaypoints = delayedSharedVoice ? [
    { x: 1, y: 1 },
    { x: board.cols - 2, y: 1 },
    { x: 1, y: board.rows - 2 },
    { x: board.cols - 2, y: board.rows - 2 },
  ] : [null];
  let machine = null;
  let routeError = null;
  for (let attempt = 0; attempt < 64 * sharedWaypoints.length && !machine; attempt += 1) {
    const routingAttempt = attempt % 64;
    if (delayedSharedVoice) {
      delayedSharedVoice.waypoint = sharedWaypoints[Math.floor(attempt / 64)];
    }
    const candidateMachine = { parts: clone(placement.parts), wires: [] };
    const ids = {
      parts: new Set(candidateMachine.parts.map((part) => part.id)),
      wires: new Set(logicalWires.map((wire) => wire.id)),
    };
    const routingOrder = [...logicalWires];
    if (routingAttempt === 1) routingOrder.reverse();
    else if (routingAttempt === 2) {
      routingOrder.sort((a, b) =>
        Number(candidateMachine.parts.find((part) => part.id === b.from.part)?.kind === 'junction') -
        Number(candidateMachine.parts.find((part) => part.id === a.from.part)?.kind === 'junction'));
    } else if (routingAttempt >= 3 && routingAttempt < 3 + logicalWires.length) {
      const offset = routingAttempt - 3;
      routingOrder.push(...routingOrder.splice(0, offset));
    } else if (routingAttempt > 2) {
      routingOrder.sort((a, b) => routeOrder(a.id, routingAttempt) - routeOrder(b.id, routingAttempt));
    }
    try {
      for (const logicalWire of routingOrder) {
        const path = findRoute(candidateMachine, board, placement.reserved, logicalWire);
        installWire(candidateMachine, board, logicalWire, path, ids);
      }
      const failedRun = original.cases
        .map((kase) => runCase(candidateMachine, kase, 1000))
        .find((run) => run.verdict !== 'resonant');
      if (failedRun) throw new Error(`reference timing failed: ${failedRun.detail}`);
      machine = candidateMachine;
    } catch (error) {
      routeError = error;
    }
  }
  if (!machine) {
    throw new Error(`${level.id}: ${routeError?.message ?? 'spatial routing failed'}`, { cause: routeError });
  }

  for (const wire of machine.wires) {
    try {
      const validity = routeValidity(machine, board, wire);
      if (!validity.valid) throw new Error(`${wire.id}: ${validity.reason}`);
    } catch (error) {
      throw new Error(`${level.id}: ${error.message}`, { cause: error });
    }
  }

  const fixed = machine.parts.filter((part) => originalFixedIds.has(part.id));
  const referenceParts = machine.parts.filter((part) => !originalFixedIds.has(part.id));
  const fixedIds = new Set(fixed.map((part) => part.id));
  if (fixed.some((part) => !TERMINAL_KINDS.has(part.kind) && !originalFixedIds.has(part.id))) {
    throw new Error('Reference-added devices cannot become supplied fixtures');
  }
  return {
    ...original,
    board,
    boardMount: {
      profile: 'spatial',
      source: original.boardMount?.source ?? original.board,
      offset: { x: margin, y: margin },
    },
    fixed: fixed.map(({ referenceAdded, ...part }) => part),
    reference: {
      ...original.reference,
      parts: referenceParts.map(({ referenceAdded, ...part }) => part),
      wires: machine.wires.map(({ id, ...wire }) => wire),
    },
    spatial: {
      fixedIds: [...fixedIds],
      junctions: referenceParts.filter((part) => part.kind === 'junction').length,
      crossings: referenceParts.filter((part) => part.kind === 'crossing').length,
      spacing,
    },
  };
}

export function spatializeReference(level) {
  let failure = null;
  for (const spacing of REFERENCE_SPACINGS) {
    try {
      return spatializeReferenceAtSpacing(level, spacing);
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

function routeOrder(id, attempt) {
  let hash = attempt * 2654435761;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}
