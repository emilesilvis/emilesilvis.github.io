import { partFootprintCells } from './part-geometry.mjs?v=0.9.2-1';
import { wireRouteCells } from './wire-routing.mjs?v=0.9.2-1';

function fullBoardBounds(board) {
  return {
    minX: 0,
    minY: 0,
    maxX: Math.max(0, board.cols - 1),
    maxY: Math.max(0, board.rows - 1),
    cols: board.cols,
    rows: board.rows,
  };
}

export function machineContentBounds(machine, board, padding = 1) {
  const cells = [
    ...machine.parts.flatMap(partFootprintCells),
    ...machine.wires.flatMap((wire) => wireRouteCells(machine, wire)),
  ];
  if (!cells.length) return fullBoardBounds(board);

  const minX = Math.max(0, Math.min(...cells.map((cell) => cell.x)) - padding);
  const minY = Math.max(0, Math.min(...cells.map((cell) => cell.y)) - padding);
  const maxX = Math.min(board.cols - 1, Math.max(...cells.map((cell) => cell.x)) + padding);
  const maxY = Math.min(board.rows - 1, Math.max(...cells.map((cell) => cell.y)) + padding);
  return {
    minX, minY, maxX, maxY,
    cols: maxX - minX + 1,
    rows: maxY - minY + 1,
  };
}

export function fitCamera(machine, board, viewport, {
  cellSize = 64,
  padding = 1,
  minZoom = 1,
  maxZoom = 3,
} = {}) {
  const bounds = machineContentBounds(machine, board, padding);
  const boardWidth = board.cols * cellSize;
  const boardHeight = board.rows * cellSize;
  const viewportWidth = Math.max(0, viewport.width);
  const viewportHeight = Math.max(0, viewport.height);
  if (!viewportWidth || !viewportHeight || !boardWidth || !boardHeight) {
    return { bounds, zoom: minZoom, scrollLeft: 0, scrollTop: 0 };
  }

  const baseScale = Math.min(viewportWidth / boardWidth, viewportHeight / boardHeight);
  const contentWidth = bounds.cols * cellSize * baseScale;
  const contentHeight = bounds.rows * cellSize * baseScale;
  const zoom = Math.max(minZoom, Math.min(
    maxZoom,
    viewportWidth / contentWidth,
    viewportHeight / contentHeight,
  ));
  const displayScale = baseScale * zoom;
  const contentCenterX = (bounds.minX + bounds.maxX + 1) * cellSize / 2 * displayScale;
  const contentCenterY = (bounds.minY + bounds.maxY + 1) * cellSize / 2 * displayScale;
  const displayWidth = boardWidth * displayScale;
  const displayHeight = boardHeight * displayScale;
  const maxScrollLeft = Math.max(0, displayWidth - viewportWidth);
  const maxScrollTop = Math.max(0, displayHeight - viewportHeight);
  return {
    bounds,
    zoom,
    scrollLeft: Math.max(0, Math.min(maxScrollLeft, contentCenterX - viewportWidth / 2)),
    scrollTop: Math.max(0, Math.min(maxScrollTop, contentCenterY - viewportHeight / 2)),
  };
}
