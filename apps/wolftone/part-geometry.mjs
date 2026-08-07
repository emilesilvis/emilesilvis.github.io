// Physical grid geometry for the spatial-routing prototype. A part's x/y is
// the top-left cell of its unrotated footprint. Port cells and footprint
// offsets rotate clockwise around the declared pivot.

export const SIDES = ['north', 'east', 'south', 'west'];

const ONE_CELL = [{ x: 0, y: 0 }];
const FOUR_CELL_CHASSIS = [
  { x: 0, y: 0 }, { x: 1, y: 0 },
  { x: 0, y: 1 }, { x: 1, y: 1 },
];

export const PART_GEOMETRY = {
  quill: {
    footprint: FOUR_CELL_CHASSIS,
    pivot: { x: 0.5, y: 0.5 },
    ports: { out: { cell: { x: 1, y: 0 }, side: 'east', dir: 'out' } },
  },
  resonator: {
    footprint: FOUR_CELL_CHASSIS,
    pivot: { x: 0.5, y: 0.5 },
    ports: { in: { cell: { x: 0, y: 0 }, side: 'west', dir: 'in' } },
  },
  mould: passThroughGeometry(),
  damper: passThroughGeometry(),
  valve: passThroughGeometry(),
  unison: {
    footprint: FOUR_CELL_CHASSIS,
    pivot: { x: 0.5, y: 0.5 },
    ports: {
      lead: { cell: { x: 0, y: 0 }, side: 'west', dir: 'in' },
      tail: { cell: { x: 0, y: 1 }, side: 'west', dir: 'in' },
      out: { cell: { x: 1, y: 0 }, side: 'east', dir: 'out' },
    },
  },
  splitter: {
    footprint: FOUR_CELL_CHASSIS,
    pivot: { x: 0.5, y: 0.5 },
    ports: {
      in: { cell: { x: 0, y: 0 }, side: 'west', dir: 'in' },
      head: { cell: { x: 1, y: 0 }, side: 'east', dir: 'out' },
      rest: { cell: { x: 1, y: 1 }, side: 'east', dir: 'out' },
    },
  },
  fork: {
    footprint: FOUR_CELL_CHASSIS,
    pivot: { x: 0.5, y: 0.5 },
    ports: {
      in: { cell: { x: 0, y: 0 }, side: 'west', dir: 'in' },
      left: { cell: { x: 1, y: 0 }, side: 'east', dir: 'out' },
      right: { cell: { x: 1, y: 1 }, side: 'east', dir: 'out' },
    },
  },
  coupling: {
    footprint: FOUR_CELL_CHASSIS,
    pivot: { x: 0.5, y: 0.5 },
    ports: {
      inA: { cell: { x: 0, y: 0 }, side: 'west', dir: 'in' },
      outAL: { cell: { x: 0, y: 0 }, side: 'north', dir: 'out' },
      outAR: { cell: { x: 1, y: 0 }, side: 'north', dir: 'out' },
      inB: { cell: { x: 0, y: 1 }, side: 'west', dir: 'in' },
      outBL: { cell: { x: 0, y: 1 }, side: 'south', dir: 'out' },
      outBR: { cell: { x: 1, y: 1 }, side: 'south', dir: 'out' },
    },
  },
  crossing: {
    footprint: ONE_CELL,
    ports: {
      inA: { cell: { x: 0, y: 0 }, side: 'west', dir: 'both' },
      outA: { cell: { x: 0, y: 0 }, side: 'east', dir: 'both' },
      inB: { cell: { x: 0, y: 0 }, side: 'north', dir: 'both' },
      outB: { cell: { x: 0, y: 0 }, side: 'south', dir: 'both' },
    },
  },
  junction: {
    footprint: FOUR_CELL_CHASSIS,
    pivot: { x: 0.5, y: 0.5 },
    ports: {
      inA: { cell: { x: 0, y: 0 }, side: 'west', dir: 'in' },
      inB: { cell: { x: 0, y: 1 }, side: 'west', dir: 'in' },
      out: { cell: { x: 1, y: 0 }, side: 'east', dir: 'out' },
    },
  },
};

// Local working points used to keep runtime words attached to the physical
// mechanism that owns them. Coordinates are authored for the 64px cell and
// scaled by partVisualAnchor when another cell size is requested.
export const PART_VISUAL_ANCHORS = {
  coupling: {
    queue: {
      inA: { x: 0, y: 0 },
      inB: { x: 0, y: 64 },
    },
    output: {
      outAL: { x: 0, y: 0 },
      outAR: { x: 64, y: 0 },
      outBL: { x: 0, y: 64 },
      outBR: { x: 64, y: 64 },
    },
  },
  quill: { output: { out: { x: 64, y: 0 } } },
  mould: { output: { out: { x: 64, y: 0 } } },
  damper: { output: { out: { x: 64, y: 0 } } },
  valve: {
    hold: { default: { x: 32, y: 32 } },
    output: { out: { x: 64, y: 0 } },
  },
  splitter: {
    output: {
      head: { x: 72, y: 0 },
      rest: { x: 72, y: 64 },
    },
  },
  fork: {
    output: {
      left: { x: 72, y: 0 },
      right: { x: 72, y: 64 },
    },
  },
  crossing: {
    queue: {
      inA: { x: -12, y: 0 },
      outA: { x: 12, y: 0 },
      inB: { x: 0, y: -12 },
      outB: { x: 0, y: 12 },
    },
    output: {
      inA: { x: -12, y: 0 },
      outA: { x: 12, y: 0 },
      inB: { x: 0, y: -12 },
      outB: { x: 0, y: 12 },
    },
  },
  unison: {
    queue: {
      lead: { x: -16, y: 0 },
      tail: { x: -16, y: 64 },
    },
    output: { out: { x: 64, y: 0 } },
  },
  junction: {
    queue: {
      inA: { x: -14, y: 0 },
      inB: { x: -14, y: 64 },
    },
    output: { out: { x: 64, y: 0 } },
  },
};

function passThroughGeometry() {
  return {
    footprint: FOUR_CELL_CHASSIS,
    pivot: { x: 0.5, y: 0.5 },
    ports: {
      in: { cell: { x: 0, y: 0 }, side: 'west', dir: 'in' },
      out: { cell: { x: 1, y: 0 }, side: 'east', dir: 'out' },
    },
  };
}

export function normalizeOrientation(orientation = 0) {
  return ((orientation % 4) + 4) % 4;
}

export function rotateOffset(offset, orientation = 0) {
  let { x, y } = offset;
  for (let turn = 0; turn < normalizeOrientation(orientation); turn += 1) {
    [x, y] = [-y, x];
  }
  return { x, y };
}

function rotationPivot(kind) {
  return PART_GEOMETRY[kind]?.pivot ?? { x: 0, y: 0 };
}

function cleanCoordinate(value) {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 1e-9 ? rounded : value;
}

export function rotatePartOffset(kind, offset, orientation = 0) {
  const pivot = rotationPivot(kind);
  const rotated = rotateOffset({ x: offset.x - pivot.x, y: offset.y - pivot.y }, orientation);
  return {
    x: cleanCoordinate(pivot.x + rotated.x),
    y: cleanCoordinate(pivot.y + rotated.y),
  };
}

export function localPartPivot(kind, cellSize = 64) {
  const pivot = rotationPivot(kind);
  return { x: pivot.x * cellSize, y: pivot.y * cellSize };
}

export function rotateSide(side, orientation = 0) {
  const index = SIDES.indexOf(side);
  return SIDES[(index + normalizeOrientation(orientation)) % SIDES.length];
}

export function sideDelta(side) {
  if (side === 'north') return { x: 0, y: -1 };
  if (side === 'east') return { x: 1, y: 0 };
  if (side === 'south') return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

// Returns a socket point in SVG pixels relative to the centre of the part's
// top-left cell. Socket centres sit four pixels inside the cell boundary so their 4.5px
// rings cover the seam between a part's internal string and an external wire.
export function localPortGeometry(kind, port, orientation = 0, cellSize = 64) {
  const definition = PART_GEOMETRY[kind]?.ports[port];
  if (!definition) return null;
  const socketRadius = cellSize / 2 - 4;
  const delta = sideDelta(definition.side);
  const local = {
    x: definition.cell.x * cellSize + delta.x * socketRadius,
    y: definition.cell.y * cellSize + delta.y * socketRadius,
  };
  const pivot = localPartPivot(kind, cellSize);
  const rotated = rotateOffset({ x: local.x - pivot.x, y: local.y - pivot.y }, orientation);
  return {
    x: cleanCoordinate(pivot.x + rotated.x),
    y: cleanCoordinate(pivot.y + rotated.y),
    side: rotateSide(definition.side, orientation),
    dir: definition.dir,
  };
}

export function portTagWidth(text = '', fontSize = 20) {
  return Math.ceil(Math.max(fontSize + 4, text.length * fontSize * 0.6 + 8));
}

// Labels sit tangentially beside a socket rather than on the normal string
// corridor. East/west labels also move inward by half their own width, keeping
// even multi-character badges inside the part footprint. North/south labels
// point toward the part's centre so larger badges stay on the chassis.
export function localPortTagGeometry(kind, port, orientation = 0, cellSize = 64, text = '', fontSize = 20) {
  const socket = localPortGeometry(kind, port, orientation, cellSize);
  if (!socket) return null;
  if (socket.side === 'west' || socket.side === 'east') {
    const inward = socket.side === 'west' ? 1 : -1;
    return {
      x: socket.x + inward * portTagWidth(text, fontSize) / 2,
      y: socket.y - 16,
      side: socket.side,
      textAnchor: 'middle',
    };
  }
  const pivot = localPartPivot(kind, cellSize);
  const inward = socket.x <= pivot.x ? 1 : -1;
  return {
    x: socket.x + inward * 8,
    y: socket.y,
    side: socket.side,
    textAnchor: inward > 0 ? 'start' : 'end',
  };
}

export function portTagGeometry(part, port, cellSize = 64, text = '', fontSize = 20) {
  const local = localPortTagGeometry(part.kind, port, part.orientation, cellSize, text, fontSize);
  if (!local) return null;
  const pivot = partPivotCentre(part, cellSize);
  return { ...local, x: pivot.x + local.x, y: pivot.y + local.y };
}

// Resolves an authored queue/output/hold point to the board. Kinds and states
// without a special anchor deliberately fall back to the pivot centre.
export function partVisualAnchor(part, channel, port = null, cellSize = 64) {
  const channelAnchors = PART_VISUAL_ANCHORS[part.kind]?.[channel];
  const canonicalPivot = localPartPivot(part.kind, 64);
  const authored = (port === null ? channelAnchors?.default : channelAnchors?.[port]) ?? canonicalPivot;
  const scale = cellSize / 64;
  const localPivot = localPartPivot(part.kind, cellSize);
  const scaled = { x: authored.x * scale, y: authored.y * scale };
  const offset = rotateOffset({ x: scaled.x - localPivot.x, y: scaled.y - localPivot.y }, part.orientation);
  const rotated = { x: localPivot.x + offset.x, y: localPivot.y + offset.y };
  const anchor = partPivotCentre(part, cellSize);
  return { x: anchor.x + rotated.x, y: anchor.y + rotated.y };
}

// Terminal annotations form a screen-stable vertical stack around the
// mechanism: its diagram name above and its sound bar below. Neither annotation
// moves when the physical terminal rotates.
export function terminalCardGeometry(part, cellSize = 64) {
  const scale = cellSize / 64;
  return {
    x: (part.x + 1) * cellSize,
    // The terminal art occupies the complete two-cell chassis after a
    // quarter turn. Keep the 52px notation card wholly below that square.
    y: part.y * cellSize + 160 * scale,
    side: 'south',
  };
}

export function terminalNameGeometry(part, cellSize = 64) {
  const scale = cellSize / 64;
  return {
    x: (part.x + 1) * cellSize,
    y: part.y * cellSize - 8 * scale,
    side: 'north',
  };
}

function partPivotCentre(part, cellSize) {
  return {
    x: (part.x + 0.5) * cellSize,
    y: (part.y + 0.5) * cellSize,
  };
}

export function partFootprintCells(part) {
  const definition = PART_GEOMETRY[part.kind];
  if (!definition) return [{ x: part.x, y: part.y }];
  return definition.footprint.map((offset) => {
    const rotated = rotatePartOffset(part.kind, offset, part.orientation);
    return { x: part.x + rotated.x, y: part.y + rotated.y };
  });
}

export function portGeometry(part, port) {
  const definition = PART_GEOMETRY[part.kind]?.ports[port];
  if (!definition) return null;
  const offset = rotatePartOffset(part.kind, definition.cell, part.orientation);
  const cell = { x: part.x + offset.x, y: part.y + offset.y };
  const side = rotateSide(definition.side, part.orientation);
  const delta = sideDelta(side);
  return {
    cell,
    neighbor: { x: cell.x + delta.x, y: cell.y + delta.y },
    side,
    dir: definition.dir,
  };
}

export function portsForKind(kind) {
  return Object.entries(PART_GEOMETRY[kind]?.ports ?? {}).reduce((ports, [name, port]) => {
    if (port.dir === 'in' || port.dir === 'both') ports.ins.push(name);
    if (port.dir === 'out' || port.dir === 'both') ports.outs.push(name);
    return ports;
  }, { ins: [], outs: [] });
}

export function partBounds(part) {
  const cells = partFootprintCells(part);
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

export function partFootprintSize(kind, orientation = 0) {
  const bounds = partBounds({ kind, x: 0, y: 0, orientation });
  return { cols: bounds.maxX - bounds.minX + 1, rows: bounds.maxY - bounds.minY + 1 };
}
