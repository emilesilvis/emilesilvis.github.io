import { partFootprintCells } from './part-geometry.mjs?v=0.9.6-2';
import { wireRouteCells } from './wire-routing.mjs?v=0.9.6-2';

// The canvas is unbounded. A level's authored `board` rect is only its frame:
// the staging area at the origin where supplied terminals sit and where the
// camera looks on an empty board. Content may grow past it in any direction,
// so every rect here is derived from content, never clamped to the frame.

function frameBounds(frame) {
  return {
    minX: 0,
    minY: 0,
    maxX: Math.max(0, frame.cols - 1),
    maxY: Math.max(0, frame.rows - 1),
    cols: Math.max(1, frame.cols),
    rows: Math.max(1, frame.rows),
  };
}

export function machineContentBounds(machine, frame, padding = 1) {
  const cells = [
    ...machine.parts.flatMap(partFootprintCells),
    ...machine.wires.flatMap((wire) => wireRouteCells(machine, wire)),
  ];
  if (!cells.length) return frameBounds(frame);

  const minX = Math.min(...cells.map((cell) => cell.x)) - padding;
  const minY = Math.min(...cells.map((cell) => cell.y)) - padding;
  const maxX = Math.max(...cells.map((cell) => cell.x)) + padding;
  const maxY = Math.max(...cells.map((cell) => cell.y)) + padding;
  return {
    minX, minY, maxX, maxY,
    cols: maxX - minX + 1,
    rows: maxY - minY + 1,
  };
}

// The rendered surface: frame plus content plus a scrollable margin on every
// side. The renderer draws exactly this rect and the scroll container pans
// inside it, so the margin is what makes open space reachable. Callers grow
// the margin with the viewport so at least one screenful of empty canvas is
// always in reach beyond the outermost part.
export function boardSurface(machine, frame, margin = 12) {
  const content = machineContentBounds(machine, frame, 0);
  const staged = frameBounds(frame);
  const minX = Math.min(content.minX, staged.minX) - margin;
  const minY = Math.min(content.minY, staged.minY) - margin;
  const maxX = Math.max(content.maxX, staged.maxX) + margin;
  const maxY = Math.max(content.maxY, staged.maxY) + margin;
  return {
    minX, minY, maxX, maxY,
    cols: maxX - minX + 1,
    rows: maxY - minY + 1,
  };
}

// Zoom is absolute: 1 means one grid cell renders at cellSize pixels,
// independent of how much surface exists around the machine. Fit picks the
// zoom that frames the occupied content and centers the scroll on it within
// the surface.
export function fitCamera(machine, frame, viewport, {
  cellSize = 64,
  padding = 1,
  minZoom = 0.25,
  maxZoom = 3,
  margin = 12,
} = {}) {
  const bounds = machineContentBounds(machine, frame, padding);
  const surface = boardSurface(machine, frame, margin);
  const viewportWidth = Math.max(0, viewport.width);
  const viewportHeight = Math.max(0, viewport.height);
  if (!viewportWidth || !viewportHeight) {
    return { bounds, surface, zoom: 1, scrollLeft: 0, scrollTop: 0 };
  }

  const zoom = Math.max(minZoom, Math.min(
    maxZoom,
    viewportWidth / (bounds.cols * cellSize),
    viewportHeight / (bounds.rows * cellSize),
  ));
  const displayCell = cellSize * zoom;
  const contentCenterX = ((bounds.minX + bounds.maxX + 1) / 2 - surface.minX) * displayCell;
  const contentCenterY = ((bounds.minY + bounds.maxY + 1) / 2 - surface.minY) * displayCell;
  const maxScrollLeft = Math.max(0, surface.cols * displayCell - viewportWidth);
  const maxScrollTop = Math.max(0, surface.rows * displayCell - viewportHeight);
  return {
    bounds,
    surface,
    zoom,
    scrollLeft: Math.max(0, Math.min(maxScrollLeft, contentCenterX - viewportWidth / 2)),
    scrollTop: Math.max(0, Math.min(maxScrollTop, contentCenterY - viewportHeight / 2)),
  };
}
