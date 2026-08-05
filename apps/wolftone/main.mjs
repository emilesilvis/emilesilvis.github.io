// Wolf Tone: the player shell. Renders the board, lets the player place parts
// and tracks, and drives engine.mjs one tick at a time. All physics lives in
// engine.mjs; this file decides nothing about what a part does.

import {
  PORTS, KIND_NAMES, NOTES, defaultConfig, prettyWord, byId,
  wireTicks, measureScore, mergeBestScore, makeRun, stepRun, runCase,
} from './engine.mjs?v=0.9.2-2';
import { LEVELS, referenceMachines, showsWalkthrough } from './levels.mjs?v=0.9.2-2';
import {
  initialLevelIndex,
  isLevelUnlocked,
  prerequisiteId,
  sessionMode,
} from './progression.mjs?v=0.9.2-2';
import {
  wordMarbleState,
  pathDirectionMarkers,
  pointAlongPath,
  roundedPathData,
  roundedPathPoints,
  transitProgress,
} from './motion.mjs?v=0.9.2-2';
import { boardSurface, fitCamera } from './board-camera.mjs?v=0.9.2-2';
import {
  groupMovementEdit,
  partMovementEdit,
  placementValidity,
  retargetWire as retargetWireEdit,
  routeWireWithCrossings,
  spliceCandidateAtCell,
  spliceWire,
} from './board-layout.mjs?v=0.9.2-2';
import { commissionCaseSpec, orderCommissionParts, terminalName } from './commission.mjs?v=0.9.2-2';
import { SOUND_BAR_HEIGHT, drawWordMarble, drawSoundBar, soundBarWidth } from './notation.mjs?v=0.9.2-2';
import { makeRecital, recordRecitalPass } from './recital.mjs?v=0.9.2-2';
import {
  cellKey,
  extendRouteFromPort,
  occupiedWireCells,
  wireAxisAtCell,
  wireEndpointOccupied,
  wireRouteCells,
} from './wire-routing.mjs?v=0.9.2-2';
import {
  partFootprintCells,
  partFootprintSize,
  partVisualAnchor,
  localPartPivot,
  localPortGeometry,
  localPortTagGeometry,
  portTagGeometry,
  portTagWidth,
  portGeometry,
  terminalCardGeometry,
  terminalNameGeometry,
} from './part-geometry.mjs?v=0.9.2-2';
import { partArtSelection } from './part-art.mjs?v=0.9.2-2';
import {
  playWord, playThud, playResolve, setMuted, isMuted,
  setSoundtrack, setMusicOn, isMusicOn,
} from './audio.mjs?v=0.9.2-2';

// Tutorials show teaching decks. Campaign contracts stand on the Commission's
// performances alone. Reference review stays quiet during normal play.

// The score progresses from workshop craft into the forbidden commissions.
// Cues belong to chapters and continue when adjacent commissions share one.
const CHAPTER_MUSIC = {
  'I · Tutorial': [
    '02-seasoning-the-wood.mp3',
    '03-tap-tone.mp3',
    '04-fitting-the-bridge.mp3',
    '05-sympathetic-strings.mp3',
    '06-binding.mp3',
    '08-winding.mp3',
  ],
  'II · Campaign': [
    '07-the-wolf-tone.mp3',
    '09-bookmatched.mp3',
    '10-larger-inside.mp3',
    '11-an-improper-commission.mp3',
    '12-the-workshop-at-rest.mp3',
  ],
};
const GRADUATION_TRACK = '13-graduation.mp3';

const CELL = 64;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const SPEEDS = [600, 270, 150];
const NOTE_SPACING = [85, 48, 32];  // ms between a word's audible letters, per speed
const PROCESSING_DWELL = 0.48;       // nearly half a departure tick stays in the part
// v0.9 deliberately starts a new compact campaign instead of interpreting old
// 39-level completion as progress through a different sequence.
const SAVE_KEY = 'wolftone-v0.9-campaign-v2';
const BOARD_LAYOUT_VERSION = 6;
const WIRE_TOOL = 'wire';
const UNLIMITED_KINDS = new Set(['crossing', 'junction']);
const TERMINAL_KINDS = new Set(['quill', 'resonator']);
const TRAY_KIND_ORDER = ['quill', 'resonator', WIRE_TOOL, 'crossing', 'junction'];
const TRAY_KIND_RANK = new Map(TRAY_KIND_ORDER.map((kind, index) => [kind, index]));
const CONSTRUCTION_NAMES = { [WIRE_TOOL]: 'Track', ...KIND_NAMES };
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ?reference loads every level with a hidden reference build already placed.
// Campaign commissions can switch between all their routed architecture
// witnesses. The mode is strictly read-only about progress: persist() is a
// no-op under it, so browsing the answers can neither overwrite a player's
// saved machines nor mark levels solved. Anything run or edited evaporates on
// reload.
const QUERY = new URLSearchParams(location.search);
const SESSION_MODE = sessionMode(QUERY);
const REFERENCE_MODE = SESSION_MODE === 'reference';
const PLAYTEST_MODE = SESSION_MODE === 'playtest';
const UNLOCK_ALL_LEVELS = REFERENCE_MODE || PLAYTEST_MODE;

const $ = (id) => document.getElementById(id);
const svg = $('board');
const boardScroll = $('board-scroll');
const boardShell = document.querySelector('.board-shell');
const sessionModeLabel = $('session-mode-label');
if (REFERENCE_MODE) {
  sessionModeLabel.hidden = false;
  sessionModeLabel.textContent = 'REFERENCE REVIEW · ANSWERS LOADED';
} else if (PLAYTEST_MODE) {
  sessionModeLabel.hidden = false;
  sessionModeLabel.textContent = 'PLAYTEST NAVIGATION · ANSWERS HIDDEN';
}
let zoom = 1;
let transitAnimationFrame = null;
let discreteFrames = false;  // Step shows exact tick snapshots; Run restores tweening
let boardRenderFrame = null;
let boardInteractionFrame = null;
let boardBackdropKey = null;
let surface = null;

// The canvas is unbounded: the rendered surface is the authored frame plus
// all placed content plus a margin that always keeps at least one viewport of
// open canvas scrollable beyond the outermost part. Zoom is absolute: 1
// means a cell renders at CELL pixels, so the scale never shifts as the
// surface grows.
function surfaceMargin() {
  const viewportCells = Math.ceil(
    Math.max(boardScroll.clientWidth, boardScroll.clientHeight) / (CELL * zoom));
  return Math.min(64, Math.max(12, viewportCells + 2));
}

// Recompute the surface and keep the view anchored: when the origin moves,
// the same world point must stay under the viewport, so the scroll shifts by
// the origin delta. CSS size updates first so the scroll target exists.
function syncSurface() {
  const previous = surface;
  surface = boardSurface(machine(), puzzle().board, surfaceMargin());
  svg.style.width = `${surface.cols * CELL * zoom}px`;
  svg.style.height = `${surface.rows * CELL * zoom}px`;
  if (previous && (previous.minX !== surface.minX || previous.minY !== surface.minY)) {
    boardScroll.scrollLeft += (previous.minX - surface.minX) * CELL * zoom;
    boardScroll.scrollTop += (previous.minY - surface.minY) * CELL * zoom;
  }
  return surface;
}

function sizeBoard() {
  const previousKey = surface && `${surface.minX},${surface.minY},${surface.cols}x${surface.rows}`;
  syncSurface();
  const key = `${surface.minX},${surface.minY},${surface.cols}x${surface.rows}`;
  if (previousKey !== key) scheduleBoardRender();
  $('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
  boardScroll.classList.add('can-pan');
  requestAnimationFrame(positionContextEditor);
}

function setZoom(next) {
  next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
  if (!surface || next === zoom) { zoom = next; sizeBoard(); return; }
  // Keep the world point at the viewport centre fixed through the zoom.
  const centerX = (boardScroll.scrollLeft + boardScroll.clientWidth / 2) / zoom + surface.minX * CELL;
  const centerY = (boardScroll.scrollTop + boardScroll.clientHeight / 2) / zoom + surface.minY * CELL;
  zoom = next;
  sizeBoard();
  boardScroll.scrollLeft = (centerX - surface.minX * CELL) * zoom - boardScroll.clientWidth / 2;
  boardScroll.scrollTop = (centerY - surface.minY * CELL) * zoom - boardScroll.clientHeight / 2;
}

function fitBoardToContent() {
  const camera = fitCamera(machine(), puzzle().board, {
    width: boardScroll.clientWidth,
    height: boardScroll.clientHeight,
  }, { cellSize: CELL, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, padding: 1 });
  zoom = camera.zoom;
  sizeBoard();
  const centerX = (camera.bounds.minX + camera.bounds.maxX + 1) / 2 * CELL;
  const centerY = (camera.bounds.minY + camera.bounds.maxY + 1) / 2 * CELL;
  boardScroll.scrollLeft = (centerX - surface.minX * CELL) * zoom - boardScroll.clientWidth / 2;
  boardScroll.scrollTop = (centerY - surface.minY * CELL) * zoom - boardScroll.clientHeight / 2;
}

// ── persistent state ─────────────────────────────────────

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) ?? {}; }
  catch { return {}; }
}
// Position is saved by level ID, not index: chapters interleave the two
// level sources, so an index means a different level every time the campaign
// regenerates or reorders. Old saves carried a numeric `level`; it is
// ignored and those players resume at their first unsolved level instead.
const save = {
  solved: [], machines: {}, bests: {},
  ...loadSave(),
};
function persist() {
  if (REFERENCE_MODE) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
}

// Version 6 changes every ordinary device to a square 2×2 footprint. Existing
// machine coordinates and routes cannot be repaired without guessing, so the
// one-time migration preserves progress/settings but clears only board builds.
function migrateSavedBoardLayout() {
  const previousVersion = save.boardLayoutVersion ?? 0;
  if (previousVersion >= BOARD_LAYOUT_VERSION) return;
  save.machines = {};
  save.boardLayoutVersion = BOARD_LAYOUT_VERSION;
  persist();
}

migrateSavedBoardLayout();

const levelIsUnlocked = (index) => isLevelUnlocked(LEVELS, index, {
  solved: save.solved,
  unlockAll: UNLOCK_ALL_LEVELS,
});

function soundtrackForLevel(index) {
  const level = LEVELS[index];
  if (index === LEVELS.length - 1 && save.solved.includes(level.id)) return GRADUATION_TRACK;
  const tracks = CHAPTER_MUSIC[level.chapter] ?? ['12-the-workshop-at-rest.mp3'];
  const chapterIndex = LEVELS.slice(0, index).filter((p) => p.chapter === level.chapter).length;
  return tracks[chapterIndex % tracks.length];
}

// ── session state ────────────────────────────────────────

let levelIndex = 0;
let playerParts = [];
let playerWires = [];
let terminalPositions = {};
let caseIndex = 0;
let run = null;
let recital = null;
let timer = null;
let speedIdx = 0;
let selection = null;       // { kind: 'parts', ids, primaryId } | wire | tool
let hoverInspection = null; // temporary Inspector preview; click selection persists
let armedTool = null;       // construction kind from the tray, including Track
let placementOrientation = 0; // quarter turns for the armed placement ghost
let placementHover = null;  // grid cell under an armed part ghost
let drag = null;            // new wire or endpoint retarget gesture
let justWired = false;
let partDrag = null;        // movable part gesture with an uncommitted grid preview
let marquee = null;         // Shift-drag selection rectangle on empty board
let interactionNotice = ''; // last rejected move, rotation, placement, or route
let suppressPartClick = false;
let boardPan = null;        // pointer + scroll origins while grabbing empty board
let justPanned = false;
let walkIndex = 0;
let deckHidden = false;
let caseStatuses = [];      // 'pass' | 'fail' | null per case
let verifiedRuns = null;    // exact successful runCase results from verifyAll
let bannerAction = null;    // { kind: 'case'|'level', index }
let undoStack = [];
let redoStack = [];
const referenceArchitectureIndexes = new Map();

const puzzle = () => LEVELS[levelIndex];
const contractTerminals = () => orderCommissionParts(puzzle().fixed.filter((part) =>
  part.kind === 'quill' || part.kind === 'resonator'));
const suppliedDevices = () => puzzle().fixed.filter((part) =>
  part.kind !== 'quill' && part.kind !== 'resonator');
const fixedParts = () => contractTerminals().flatMap((part) => {
  const position = terminalPositions[part.id];
  // Reference review falls back to the authored solved position. In a normal
  // session, terminals begin in the tray until the player places them.
  if (position === null || (!REFERENCE_MODE && !position)) return [];
  return [{
    orientation: 0,
    ...part,
    label: terminalName(part, contractTerminals()),
    ...(position ?? {}),
  }];
});
const machine = () => ({ parts: [...fixedParts(), ...playerParts], wires: playerWires });
const currentCase = () => puzzle().cases[caseIndex];
const editable = () => !run;

function partReference(part) {
  return TERMINAL_KINDS.has(part?.kind) ? part.label : part?.id;
}

function currentReferenceArchitectureIndex() {
  const choices = referenceMachines(puzzle());
  const requested = referenceArchitectureIndexes.get(puzzle().id) ?? 0;
  return requested >= 0 && requested < choices.length ? requested : 0;
}

function currentReferenceArchitecture() {
  const choices = referenceMachines(puzzle());
  return choices[currentReferenceArchitectureIndex()] ?? null;
}

function partSelection(ids, primaryId = ids.at(-1) ?? null) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return null;
  return {
    kind: 'parts',
    ids: uniqueIds,
    primaryId: uniqueIds.includes(primaryId) ? primaryId : uniqueIds.at(-1),
  };
}

function normalizeSelection(value) {
  if (value?.kind === 'part') return partSelection([value.id], value.id);
  if (value?.kind === 'parts') return partSelection(value.ids ?? [], value.primaryId);
  return value ?? null;
}

function selectedPartIds() {
  return selection?.kind === 'parts' ? selection.ids : [];
}

function isPartSelected(id) {
  return selectedPartIds().includes(id);
}

function primarySelectedPart() {
  if (selection?.kind !== 'parts') return null;
  return byId(machine(), selection.primaryId);
}

function togglePartSelection(id) {
  const ids = selectedPartIds();
  selection = ids.includes(id)
    ? partSelection(ids.filter((candidate) => candidate !== id))
    : partSelection([...ids, id], id);
}

function selectAllParts() {
  if (!editable()) return false;
  const ids = machine().parts.map((part) => part.id);
  if (!ids.length) return false;
  selection = partSelection(ids, ids.at(-1));
  interactionNotice = '';
  renderBoard();
  renderInspector();
  return true;
}

function terminalWordForPart(part) {
  if (part?.kind === 'quill') return currentCase().seeds[part.id] ?? null;
  if (part?.kind === 'resonator') return currentCase().targets[part.id] ?? null;
  return null;
}

function playTerminalWord(part) {
  const word = terminalWordForPart(part);
  if (word != null) playWord(word, { spacing: 110, gain: 0.3 });
}

function saveMachine() {
  save.machines[puzzle().id] = { parts: playerParts, wires: playerWires, terminalPositions };
  save.levelId = puzzle().id;
  persist();
}

function editSnapshot() {
  return structuredClone({ parts: playerParts, wires: playerWires, terminalPositions, selection });
}

function restoreSnapshot(snapshot) {
  const restored = structuredClone(snapshot);
  playerParts = restored.parts;
  playerWires = restored.wires;
  terminalPositions = restored.terminalPositions ?? {};
  selection = normalizeSelection(restored.selection);
  armedTool = null;
  placementOrientation = 0;
  placementHover = null;
  drag = null;
  partDrag = null;
  marquee = null;
}

function finishEdit() {
  caseStatuses = puzzle().cases.map(() => null);
  verifiedRuns = null;
  interactionNotice = '';
  hideBanner();
  saveMachine();
  renderAll();
}

// Every player mutation crosses this one boundary. That keeps history local
// to a level and makes reference-mode edits undoable without making them save.
function applyEdit(change) {
  if (!editable()) return false;
  undoStack.push(editSnapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
  change();
  finishEdit();
  return true;
}

function undoEdit() {
  if (!editable() || !undoStack.length) return;
  redoStack.push(editSnapshot());
  restoreSnapshot(undoStack.pop());
  finishEdit();
}

function redoEdit() {
  if (!editable() || !redoStack.length) return;
  undoStack.push(editSnapshot());
  restoreSnapshot(redoStack.pop());
  finishEdit();
}

function loadLevel(i) {
  const requested = Math.max(0, Math.min(i, LEVELS.length - 1));
  if (!levelIsUnlocked(requested)) return false;
  setLevelMenu(false);
  stopTimer();
  levelIndex = requested;
  if (REFERENCE_MODE) {
    const references = referenceMachines(puzzle());
    const referenceIndex = currentReferenceArchitectureIndex();
    referenceArchitectureIndexes.set(puzzle().id, referenceIndex);
    const placed = references[referenceIndex].machine;
    const terminalIds = new Set(contractTerminals().map((part) => part.id));
    playerParts = structuredClone(placed.parts.filter((part) => !terminalIds.has(part.id)))
      .map((p) => ({ orientation: 0, config: defaultConfig(p.kind), ...p }));
    playerWires = structuredClone(placed.wires).map((w, i2) => ({ id: `ref${i2}`, ...w }));
    terminalPositions = Object.fromEntries(placed.parts
      .filter((part) => terminalIds.has(part.id))
      .map((part) => [part.id, {
        x: part.x,
        y: part.y,
        orientation: part.orientation ?? 0,
      }]));
  } else {
    const stored = save.machines[puzzle().id];
    playerParts = structuredClone(stored?.parts ?? suppliedDevices())
      .map((part) => ({ orientation: 0, config: defaultConfig(part.kind), ...part }));
    playerWires = structuredClone(stored?.wires ?? []);
    terminalPositions = structuredClone(stored?.terminalPositions ?? {});
  }
  caseIndex = 0;
  run = null;
  recital = null;
  selection = null;
  hoverInspection = null;
  armedTool = null;
  interactionNotice = '';
  placementHover = null;
  zoom = 1;
  walkIndex = 0;
  caseStatuses = puzzle().cases.map(() => null);
  verifiedRuns = null;
  undoStack = [];
  redoStack = [];
  save.levelId = puzzle().id;
  persist();
  hideBanner();
  setSoundtrack(soundtrackForLevel(levelIndex));
  if (playerWires.length) verifyAll({ quiet: true });
  renderAll();
  fitBoardToContent();
  return true;
}

// ── verdicts ─────────────────────────────────────────────

function verifyAll({ quiet = false } = {}) {
  const p = puzzle();
  const runs = p.cases.map((kase) => runCase(machine(), kase));
  caseStatuses = runs.map((r) => (r.verdict === 'resonant' ? 'pass' : 'fail'));
  const allPass = caseStatuses.every((s) => s === 'pass');
  verifiedRuns = allPass ? runs : null;
  const completedScore = allPass
    ? measureScore(machine(), { componentCost: playerParts.length, runs })
    : null;
  let newBestAxes = [];
  if (allPass && !REFERENCE_MODE) {
    const bests = save.bests;
    const previousBest = bests[p.id] ?? null;
    newBestAxes = ['cost', 'time', 'area'].filter((axis) =>
      previousBest?.[axis] == null || completedScore[axis] < previousBest[axis]);
    bests[p.id] = mergeBestScore(previousBest, completedScore);
    if (!save.solved.includes(p.id)) save.solved.push(p.id);
    persist();
  }
  const result = allPass ? { score: completedScore, newBestAxes } : null;
  if (allPass && levelIndex === LEVELS.length - 1) setSoundtrack(GRADUATION_TRACK);
  if (!quiet) {
    if (allPass) {
      showBanner('resonant', 'The commission is filled', 'Every performance rang true.',
        levelIndex < LEVELS.length - 1 ? { kind: 'level', index: levelIndex + 1 } : null,
        result);
    } else {
      const i = caseStatuses.findIndex((s) => s === 'fail');
      showBanner(runs[i].verdict === 'sour' ? 'sour' : 'silent',
        `${p.cases[i].name} did not ring`, runs[i].detail ?? '', false);
    }
  }
  renderCases();
  renderScore();
  renderNav();
  return result;
}

// ── run control ──────────────────────────────────────────

function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

function startTimer() {
  stopTimer();
  timer = setInterval(doTick, SPEEDS[speedIdx]);
}

// The words are audible. Everything is read off the run state after the
// step: engine.mjs stays DOM-free and silent for the tests and the search.
// A part that sends a word strums it quietly; the quill's seed and a true
// ring get the word at full voice. The empty word plays its own silence.
function soundTick(rungBefore) {
  const m = machine();
  const spacing = NOTE_SPACING[speedIdx];
  const sends = run.transit.filter((x) => x.depart === run.tick);
  sends.forEach((s, i) => {
    const from = byId(m, m.wires[s.wireIndex].from.part);
    const accent = from.kind === 'quill';
    playWord(s.word, { at: i * spacing * 0.5, spacing, gain: accent ? 0.3 : 0.11 });
  });
  for (const [id, word] of Object.entries(run.satisfied)) {
    if (!rungBefore.has(id)) playWord(word, { spacing: Math.max(spacing, 100), gain: 0.32, bright: true });
  }
}

function doTick() {
  if (!run || run.verdict) { stopTimer(); return; }
  const rungBefore = new Set(Object.keys(run.satisfied));
  stepRun(machine(), currentCase(), run);
  soundTick(rungBefore);
  if (run.verdict) {
    stopTimer();
    if (run.verdict === 'resonant') {
      if (recital) {
        caseStatuses[caseIndex] = 'pass';
        const { nextCase, filledNow } = recordRecitalPass(recital, caseIndex, puzzle().cases.length);
        if (filledNow) {
          const result = verifyAll({ quiet: true });
          showBanner('resonant', 'The commission is filled', 'Every performance rang true.',
            levelIndex < LEVELS.length - 1 ? { kind: 'level', index: levelIndex + 1 } : null,
            result);
        } else {
          playResolve();
        }
        caseIndex = nextCase;
        run = makeRun();
        discreteFrames = recital.paused;
        if (!recital.paused) startTimer();
        renderCases(); renderPalette(); renderBoard(); renderTransport(); renderInspector(); renderLog();
        return;
      }
      caseStatuses[caseIndex] = 'pass';
      const filled = caseStatuses.every((status) => status === 'pass');
      if (filled) {
        const result = verifyAll({ quiet: true });
        showBanner('resonant', 'The commission is filled', 'Every performance rang true.',
          levelIndex < LEVELS.length - 1 ? { kind: 'level', index: levelIndex + 1 } : null,
          result);
      } else {
        let nextCase = null;
        for (let offset = 1; offset < puzzle().cases.length; offset += 1) {
          const candidate = (caseIndex + offset) % puzzle().cases.length;
          if (caseStatuses[candidate] !== 'pass') { nextCase = candidate; break; }
        }
        showBanner('resonant', `${currentCase().name} rang true`,
          'Continue with the next performance, or Run to hear the recital.',
          nextCase === null ? null : { kind: 'case', index: nextCase });
      }
    } else if (run.verdict === 'sour') {
      if (recital) { recital.paused = true; recital.failed = true; }
      showBanner('sour', 'A sour sound', run.detail, false);
      caseStatuses[caseIndex] = 'fail';
    } else {
      if (recital) { recital.paused = true; recital.failed = true; }
      const why = run.stalls.length
        ? run.stalls.map((s) => `${partReference(byId(machine(), s.part))}: ${s.reason}`).join(' · ')
        : run.detail;
      showBanner('silent', 'The machine went silent', why, false);
      caseStatuses[caseIndex] = 'fail';
    }
    renderCases();
  }
  renderBoardRun(); renderTransport(); renderLog();
}

function onRunButton() {
  if (recital && timer) {
    recital.paused = true;
    stopTimer();
    renderBoard(); renderTransport();
    return;
  }
  recital ??= makeRecital(caseIndex);
  recital.paused = false;
  recital.failed = false;
  discreteFrames = false;
  if (!run || run.verdict) {
    run = makeRun();
    armedTool = null;
    placementHover = null;
    hideBanner();
    renderLog();
  }
  startTimer();
  renderPalette(); renderBoard(); renderTransport(); renderInspector();
}

function onStepButton() {
  stopTimer();
  discreteFrames = true;
  if (recital) {
    recital.paused = true;
    recital.failed = false;
  }
  if (!run || run.verdict) { run = makeRun(); armedTool = null; placementHover = null; hideBanner(); }
  doTick();
  renderPalette(); renderTransport(); renderInspector();
}

function onResetRun() {
  const startCase = recital?.startCase;
  stopTimer();
  recital = null;
  run = null;
  discreteFrames = false;
  if (Number.isInteger(startCase)) caseIndex = startCase;
  hideBanner();
  renderCases(); renderPalette(); renderBoard(); renderTransport(); renderInspector(); renderLog();
}

// ── banner ───────────────────────────────────────────────

function showBanner(kind, title, detail, nextAction = null, result = null) {
  // Every verdict passes through here, so this is where a verdict sounds:
  // resonant resolves, silent gets one damped thump. Sour says nothing for
  // now: the wolf-tone growl came out until it earns its place.
  if (kind === 'resonant') playResolve();
  else if (kind === 'silent') playThud();
  const b = $('banner');
  b.hidden = false;
  b.className = `banner ${kind}`;
  $('banner-icon').textContent = kind === 'resonant' ? '✓' : kind === 'sour' ? '♭' : '…';
  $('banner-title').textContent = title;
  $('banner-detail').textContent = detail;
  const scoreRow = $('banner-score');
  scoreRow.hidden = !result;
  if (result) {
    for (const axis of ['cost', 'time', 'area']) {
      $(`banner-score-${axis}`).textContent = result.score[axis];
      $(`banner-best-${axis}`).hidden = !result.newBestAxes.includes(axis);
    }
  }
  bannerAction = nextAction;
  const next = $('banner-next');
  next.hidden = !bannerAction;
  next.textContent = bannerAction?.kind === 'case' ? 'Next performance →' : 'Next commission →';
}
function hideBanner() {
  $('banner').hidden = true;
  bannerAction = null;
}

// ── editing ──────────────────────────────────────────────

function nextId(kind) {
  let n = 1;
  const taken = new Set(machine().parts.map((p) => p.id));
  while (taken.has(`${kind[0]}${n}`)) n += 1;
  return `${kind[0]}${n}`;
}

function placedTerminalCount(kind = null) {
  return contractTerminals().filter((part) =>
    (!kind || part.kind === kind) && terminalPositions[part.id] !== null &&
    (REFERENCE_MODE || Boolean(terminalPositions[part.id]))).length;
}
function placedCount(kind) {
  if (kind === 'quill' || kind === 'resonator') return placedTerminalCount(kind);
  return playerParts.filter((p) => p.kind === kind).length;
}
function paletteCount(kind) {
  if (kind === WIRE_TOOL) return Infinity;
  if (UNLIMITED_KINDS.has(kind)) return Infinity;
  if (kind === 'quill' || kind === 'resonator') {
    return contractTerminals().filter((part) => part.kind === kind).length;
  }
  return (puzzle().palette[kind] ?? 0) + suppliedDevices().filter((part) => part.kind === kind).length;
}
function paletteKinds() {
  return [...new Set([
    WIRE_TOOL,
    ...contractTerminals().map((part) => part.kind),
    ...Object.keys(puzzle().palette),
    ...suppliedDevices().map((part) => part.kind),
    'crossing',
    'junction',
  ])]
    .filter((kind) => !TERMINAL_KINDS.has(kind) || remaining(kind) > 0)
    .sort((left, right) =>
      (TRAY_KIND_RANK.get(left) ?? Infinity) - (TRAY_KIND_RANK.get(right) ?? Infinity));
}
function armedPartKind() { return armedTool && armedTool !== WIRE_TOOL ? armedTool : null; }
function remaining(kind) { return paletteCount(kind) - placedCount(kind); }
function allowedForkModes() { return puzzle().configConstraints?.forkModes ?? ['peek', 'consume']; }
function levelDefaultConfig(kind) {
  const config = defaultConfig(kind);
  if (kind === 'fork') config.mode = allowedForkModes()[0];
  return config;
}

function nextWireId() {
  let n = 1;
  const taken = new Set(playerWires.map((wire) => wire.id));
  while (taken.has(`w${n}`)) n += 1;
  return `w${n}`;
}

function placePart(kind, x, y, splice = null) {
  applyEdit(() => {
    const terminal = (kind === 'quill' || kind === 'resonator')
      ? contractTerminals().find((part) => part.kind === kind && !terminalPositions[part.id])
      : null;
    const id = terminal?.id ?? nextId(kind);
    if (terminal) {
      terminalPositions[id] = { x, y, orientation: placementOrientation };
    } else {
      playerParts.push({ id, kind, x, y, orientation: placementOrientation, config: levelDefaultConfig(kind) });
    }
    if (splice) {
      const spliced = spliceWire(
        playerWires, splice.id, id, splice.inputPort, splice.outputPort, nextWireId(), splice.cells,
      );
      if (spliced) playerWires = spliced;
    }
    armedTool = null;
    placementOrientation = 0;
    selection = null;
  });
}

function moveParts(ids, dx, dy, primaryId = ids.at(-1)) {
  if (!ids.length || (dx === 0 && dy === 0)) return false;
  const edit = groupMovementEdit(
    machine().parts, ids, { dx, dy }, playerWires,
  );
  if (!edit.valid) return false;
  return applyEdit(() => {
    const movedById = new Map(edit.parts.map((part) => [part.id, part]));
    playerParts = playerParts.map((part) => movedById.get(part.id) ?? part);
    for (const id of ids) {
      const part = movedById.get(id);
      if (part?.kind === 'quill' || part?.kind === 'resonator') {
        terminalPositions[id] = {
          ...(terminalPositions[id] ?? {}),
          x: part.x,
          y: part.y,
        };
      }
    }
    playerWires = edit.wires;
    selection = partSelection(ids, primaryId);
  });
}

function movePart(id, x, y) {
  const part = byId(machine(), id);
  if (!part) return false;
  return moveParts([id], x - part.x, y - part.y, id);
}

function rotatePart(id) {
  const part = byId(machine(), id);
  if (!part) return false;
  const orientation = ((part.orientation ?? 0) + 1) % 4;
  const edit = partMovementEdit(
    machine().parts, id, { orientation }, playerWires,
  );
  if (!edit.valid) {
    interactionNotice = `Cannot rotate: ${edit.reason}`;
    renderBoard();
    return false;
  }
  interactionNotice = '';
  return applyEdit(() => {
    const playerPart = playerParts.find((candidate) => candidate.id === id);
    if (playerPart) playerPart.orientation = orientation;
    else if (part.kind === 'quill' || part.kind === 'resonator') {
      terminalPositions[id] = { ...(terminalPositions[id] ?? {}), orientation };
    }
    playerWires = edit.wires;
    selection = partSelection([id], id);
  });
}

function deleteSelection() {
  if (!selection || !editable()) return;
  if (selection.kind === 'parts') {
    const ids = new Set(selection.ids);
    applyEdit(() => {
      for (const id of ids) {
        if (contractTerminals().some((part) => part.id === id)) terminalPositions[id] = null;
      }
      playerParts = playerParts.filter((part) => !ids.has(part.id));
      playerWires = playerWires.filter((wire) =>
        !ids.has(wire.from.part) && !ids.has(wire.to.part));
      selection = null;
    });
    return;
  }
  const id = selection.id;
  if (!playerWires.some((w) => w.id === id)) return;
  applyEdit(() => {
    playerWires = playerWires.filter((w) => w.id !== id);
    selection = null;
  });
}

function physicalPortOccupied(ref, dir, exceptWireId = null) {
  const part = byId(machine(), ref.part);
  const physicalDir = portGeometry(part, ref.port)?.dir ?? dir;
  return wireEndpointOccupied(playerWires, ref, physicalDir === 'both' ? 'both' : dir, { exceptWireId });
}

function addWire(from, to, route) {
  const outTaken = physicalPortOccupied(from, 'out');
  const inTaken = physicalPortOccupied(to, 'in');
  if (outTaken || inTaken) {
    interactionNotice = `Cannot route: ${outTaken ? 'output' : 'input'} port already has a track`;
    return false;
  }
  const candidate = { id: nextWireId(), from, to, route: structuredClone(route) };
  const edit = routeWireWithCrossings(machine(), candidate);
  if (!edit.valid) {
    interactionNotice = `Cannot route: ${edit.reason}`;
    return false;
  }
  return applyEdit(() => {
    playerParts.push(...edit.crossings);
    playerWires = edit.wires;
    selection = { kind: 'wire', id: candidate.id };
  });
}

function retargetWire(wireId, end, nextRef, route) {
  const storedRoute = end === 'from' ? [...route].reverse() : route;
  if (physicalPortOccupied(nextRef, end === 'from' ? 'out' : 'in', wireId)) {
    interactionNotice = 'Cannot route: that physical port already has a track';
    return false;
  }
  const next = retargetWireEdit(playerWires, wireId, end, nextRef, storedRoute);
  if (!next) {
    interactionNotice = 'Cannot route: that physical port already has a track';
    return false;
  }
  const currentWire = playerWires.find((wire) => wire.id === wireId);
  const current = currentWire?.[end];
  if (current?.part === nextRef.part && current?.port === nextRef.port &&
      JSON.stringify(currentWire.route ?? null) === JSON.stringify(storedRoute)) return false;
  const candidate = next.find((wire) => wire.id === wireId);
  const edit = routeWireWithCrossings(machine(), candidate);
  if (!edit.valid) {
    interactionNotice = `Cannot route: ${edit.reason}`;
    return false;
  }
  return applyEdit(() => {
    playerParts.push(...edit.crossings);
    playerWires = edit.wires;
    selection = { kind: 'wire', id: wireId };
  });
}

// ── geometry ─────────────────────────────────────────────

function portPos(m, ref) {
  const part = byId(m, ref.part);
  const geometry = portGeometry(part, ref.port);
  if (!geometry) return { x: 0, y: 0, dir: 'in', side: 'west' };
  const cx = geometry.cell.x * CELL + CELL / 2;
  const cy = geometry.cell.y * CELL + CELL / 2;
  if (geometry.side === 'north' || geometry.side === 'south') {
    return {
      x: cx,
      y: geometry.side === 'north' ? cy - 28 : cy + 28,
      dir: geometry.dir,
      side: geometry.side,
    };
  }
  return {
    x: geometry.side === 'west' ? cx - 28 : cx + 28,
    y: cy,
    dir: geometry.dir,
    side: geometry.side,
  };
}

function portBoundary(geometry) {
  const cx = geometry.cell.x * CELL + CELL / 2;
  const cy = geometry.cell.y * CELL + CELL / 2;
  if (geometry.side === 'west') return { x: geometry.cell.x * CELL, y: cy };
  if (geometry.side === 'east') return { x: (geometry.cell.x + 1) * CELL, y: cy };
  if (geometry.side === 'north') return { x: cx, y: geometry.cell.y * CELL };
  return { x: cx, y: (geometry.cell.y + 1) * CELL };
}

function cellCenter(cell) {
  return { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 };
}

function wirePoints(m, w) {
  const fromPart = byId(m, w.from.part);
  const toPart = byId(m, w.to.part);
  const route = wireRouteCells(m, w);
  const fromGeometry = portGeometry(fromPart, w.from.port);
  const toGeometry = portGeometry(toPart, w.to.port);
  const a = portPos(m, w.from);
  const b = portPos(m, w.to);
  const points = [
    a,
    portBoundary(fromGeometry),
    ...route.map(cellCenter),
    portBoundary(toGeometry),
    b,
  ];
  return points.filter((point, index) => !index ||
    point.x !== points[index - 1].x || point.y !== points[index - 1].y);
}

function pointCell(point) {
  return { x: Math.floor(point.x / CELL), y: Math.floor(point.y / CELL) };
}

function paintRouteGesture(gesture, point) {
  const m = machine();
  const anchorPart = byId(m, gesture.anchor.part);
  const anchorPort = portGeometry(anchorPart, gesture.anchor.port);
  const destination = pointCell(point);
  const occupied = occupiedWireCells(m, { exceptWireId: gesture.wireId ?? null });
  const partCells = new Map(m.parts.flatMap((part) =>
    partFootprintCells(part).map((cell) => [cellKey(cell), part.id])));
  gesture.blockedCell = null;
  gesture.blockedReason = null;
  const axisBetween = (first, second) => first.x === second.x
    ? 'vertical'
    : first.y === second.y ? 'horizontal' : null;
  const crossingAxis = (cell) => {
    const wireId = occupied.get(cellKey(cell));
    const wire = wireId ? m.wires.find((candidate) => candidate.id === wireId) : null;
    return wire ? wireAxisAtCell(m, wire, cell) : null;
  };
  const canOccupy = (cell, previous) => {
    const block = (reason) => {
      gesture.blockedCell = { ...cell };
      gesture.blockedReason = reason;
      return false;
    };
    // Reaching the cell beneath the pointer may mean the player is dropping on
    // that part's compatible port. Stop before the footprint and let pointerup
    // validate the endpoint without flashing a false obstacle first.
    if (partCells.has(cellKey(cell))) {
      if (sameGridCell(cell, destination)) return false;
      return block(`Occupied by ${partCells.get(cellKey(cell))}`);
    }
    const incomingAxis = axisBetween(previous, cell);
    if (occupied.has(cellKey(cell))) {
      const existingAxis = crossingAxis(cell);
      if (!existingAxis || !incomingAxis || existingAxis === incomingAxis) {
        return block('Tracks can cross only at right angles');
      }
    }
    if (occupied.has(cellKey(previous))) {
      const existingAxis = crossingAxis(previous);
      if (!existingAxis || !incomingAxis || existingAxis === incomingAxis) {
        return block('A Crossing must continue straight through');
      }
    }
    return true;
  };
  const previousRoute = gesture.route;
  const nextRoute = extendRouteFromPort(
    gesture.route, destination, anchorPort.cell, anchorPort.neighbor, canOccupy,
  );
  if (previousRoute.length && !nextRoute.length &&
      !sameGridCell(destination, anchorPort.cell)) {
    gesture.blockedCell = { ...destination };
    gesture.blockedReason = 'Port faces another side';
  }
  gesture.route = nextRoute;
}

function routeGesturePoints(m, gesture) {
  const anchorPart = byId(m, gesture.anchor.part);
  const geometry = portGeometry(anchorPart, gesture.anchor.port);
  const pointer = { x: gesture.x, y: gesture.y };
  const anchor = portPos(m, gesture.anchor);
  const points = [anchor, portBoundary(geometry), ...gesture.route.map(cellCenter)];
  const tail = points.at(-1);
  const pointerFollowsRoute = !gesture.blockedReason &&
    (gesture.route.length > 0 || sameGridCell(pointCell(pointer), geometry.neighbor));
  if (pointerFollowsRoute && (!tail || tail.x !== pointer.x || tail.y !== pointer.y)) {
    points.push(pointer);
  }
  return gesture.end === 'from' ? points.reverse() : points;
}

function sameGridCell(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}

// An outgoing word first appears over the working area of the part that made
// it, then moves through that part's output port and onto the track. Paired
// mechanisms get separate seats so their simultaneous words remain legible.
function processingPoint(m, wire) {
  const part = byId(m, wire.from.part);
  return partVisualAnchor(part, 'output', wire.from.port, CELL);
}

function trackTiesMarkup(points, classes = '') {
  let markup = '';
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    const nx = -dy / length;
    const ny = dx / length;
    for (let distance = 15; distance < length - 8; distance += 26) {
      const x = start.x + dx * distance / length;
      const y = start.y + dy * distance / length;
      markup += `<line class="track-tie${classes}" x1="${x - nx * 9}" y1="${y - ny * 9}" ` +
        `x2="${x + nx * 9}" y2="${y + ny * 9}"></line>`;
    }
  }
  return markup;
}

function trackDirectionMarkup(points) {
  return pathDirectionMarkers(points).map(({ x, y, angle }) =>
    `<g class="track-direction" aria-hidden="true" ` +
      `transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)})">` +
      '<rect class="track-direction-bed" x="-14" y="-9" width="28" height="18" rx="8"></rect>' +
      '<path class="track-direction-chevron" d="M-8-5L-2 0L-8 5M1-5L7 0L1 5"></path></g>',
  ).join('');
}

function svgXY(e) {
  if (!surface) syncSurface();
  const r = svg.getBoundingClientRect();
  const W = surface.cols * CELL, H = surface.rows * CELL;
  const scale = Math.min(r.width / W, r.height / H);
  return {
    x: (e.clientX - r.left) / scale + surface.minX * CELL,
    y: (e.clientY - r.top) / scale + surface.minY * CELL,
  };
}

// ── board rendering ──────────────────────────────────────

const PORT_LABELS = {
  unison: { lead: 'w', tail: 'v' },
  splitter: { head: 'w', rest: 'v' },
  fork: { left: '=', right: '≠' },
  coupling: { inA: 'A', inB: 'B', outAL: 'AL', outAR: 'AR', outBL: 'BL', outBR: 'BR' },
  junction: { inA: 'A', inB: 'B', out: 'out' },
};

function playerPortName(kind, port) {
  if (kind === 'fork' && port === 'left') return 'match';
  if (kind === 'fork' && port === 'right') return 'other';
  if (kind === 'coupling' && port.startsWith('out')) return port.slice(3);
  if (kind === 'coupling' && (port === 'inA' || port === 'inB')) return port.at(-1);
  if (kind === 'junction' && (port === 'inA' || port === 'outA')) return 'A';
  if (kind === 'junction' && (port === 'inB' || port === 'outB')) return 'B';
  return port;
}

function couplingRouteClass(kind, port) {
  if (kind !== 'coupling') return '';
  if (port === 'inB' || port.startsWith('outA')) return ' route-family route-a';
  if (port === 'inA' || port.startsWith('outB')) return ' route-family route-b';
  return '';
}

function portTagMarkup(part, port, text, { preview = false } = {}) {
  if (!text) return '';
  const fontSize = preview ? 10.5 : 20;
  const tag = preview
    ? localPortTagGeometry(part.kind, port, part.orientation, CELL, text, fontSize)
    : portTagGeometry(part, port, CELL, text, fontSize);
  if (!tag) return '';
  const width = portTagWidth(text, fontSize);
  const rectX = tag.textAnchor === 'start'
    ? tag.x - 2
    : tag.textAnchor === 'end' ? tag.x - width + 2 : tag.x - width / 2;
  const prefix = preview ? 'preview-' : '';
  const height = preview ? 16 : 27;
  const radius = preview ? 3.5 : 5;
  const textOffset = preview ? 4 : 7;
  return `<g class="${prefix}port-tag" aria-hidden="true">` +
    `<rect class="${prefix}port-tag-bg" x="${rectX}" y="${tag.y - height / 2}" width="${width}" height="${height}" rx="${radius}"></rect>` +
    `<text class="${prefix}port-tag-text" x="${tag.x}" y="${tag.y + textOffset}" ` +
    `style="text-anchor:${tag.textAnchor}">${text}</text></g>`;
}

function previewPortsMarkup(part, { labels = true } = {}) {
  if (part.kind === WIRE_TOOL) return '';
  const ports = PORTS[part.kind] ?? { ins: [], outs: [] };
  let markup = '';
  for (const port of new Set([...ports.ins, ...ports.outs])) {
    const geometry = localPortGeometry(part.kind, port, part.orientation, CELL);
    if (!geometry) continue;
    markup += `<circle class="preview-port-bezel ${geometry.dir}" ` +
      `cx="${geometry.x}" cy="${geometry.y}" r="9"></circle>`;
    markup += `<circle class="preview-port ${geometry.dir}${couplingRouteClass(part.kind, port)}" ` +
      `cx="${geometry.x}" cy="${geometry.y}" r="6.6"></circle>`;
    if (labels) markup += portTagMarkup(part, port, PORT_LABELS[part.kind]?.[port], { preview: true });
  }
  return markup;
}

function partPreviewMarkup(part, state = {}) {
  const angle = (part.orientation ?? 0) * 90;
  const pivot = localPartPivot(part.kind, CELL);
  return `<g class="part-preview"><g transform="rotate(${angle} ${pivot.x} ${pivot.y})">${partFace(part, 0, 0, state)}</g>` +
    `${previewPortsMarkup(part)}</g>`;
}

function boardPreviewPortsMarkup(part) {
  const cx = part.x * CELL + CELL / 2;
  const cy = part.y * CELL + CELL / 2;
  return `<g transform="translate(${cx} ${cy})">${previewPortsMarkup(part)}</g>`;
}

function terminalAnnotationMarkup(part, kase) {
  if (part.kind !== 'quill' && part.kind !== 'resonator') return '';
  const card = terminalCardGeometry(part, CELL);
  const name = terminalNameGeometry(part, CELL);
  const word = part.kind === 'quill' ? kase.seeds[part.id] : kase.targets[part.id];
  let markup = '';
  if (word !== undefined) {
    markup += `<g class="goal-word terminal-word-card sound-bar" data-word="${word}" ` +
      `transform="translate(${card.x} ${card.y})">${drawSoundBar(0, 0, word)}</g>`;
  } else if (part.kind === 'resonator') {
    markup += `<g class="terminal-silent-card" transform="translate(${card.x} ${card.y})">` +
      '<rect x="-44" y="-14" width="88" height="28" rx="5"></rect>' +
      '<text x="0" y="6">SILENT</text></g>';
  }
  markup += `<text class="terminal-name" x="${name.x}" y="${name.y}">${part.label}</text>`;
  return markup;
}

// The engine keeps no UI-only trace of a coupling decision. Its queues and
// outgoing transit are enough to reconstruct the current crossed read: B's
// head chooses A's exit, and A's head chooses B's exit.
function couplingFeedback(part, m) {
  if (!run) return null;
  const queues = run.queues[part.id] ?? {};
  let wordA = queues.inA?.[0];
  let wordB = queues.inB?.[0];
  let sentOutA = null;
  let sentOutB = null;
  const outgoing = run.transit.map((item) => ({ item, wire: m.wires[item.wireIndex] }))
    .filter(({ wire }) => wire?.from.part === part.id);
  if (outgoing.length) {
    const latest = Math.max(...outgoing.map(({ item }) => item.depart));
    const pair = outgoing.filter(({ item }) => item.depart === latest);
    const branchA = pair.find(({ wire }) => wire.from.port.startsWith('outA'));
    const branchB = pair.find(({ wire }) => wire.from.port.startsWith('outB'));
    wordA ??= branchA?.item.word;
    wordB ??= branchB?.item.word;
    sentOutA = branchA?.wire.from.port ?? null;
    sentOutB = branchB?.wire.from.port ?? null;
  }
  if (wordA === undefined && wordB === undefined) return null;
  const outA = sentOutA ?? (wordB === undefined ? null : wordB[0] === part.config.noteA ? 'outAL' : 'outAR');
  const outB = sentOutB ?? (wordA === undefined ? null : wordA[0] === part.config.noteB ? 'outBL' : 'outBR');
  return { wordA, wordB, outA, outB };
}

// Palette, Inspector, placement ghosts, and the board all use the approved
// concept plate through this one renderer. The transparent art occupies the
// exact normalized footprint; sockets, configuration, and run state remain
// live SVG so they stay sharp, interactive, and attached while rotating.
function partFaceClass(part, state = {}) {
  const stateClasses = [
    state.active && 'active', state.firing && 'firing', state.waiting && 'waiting',
    state.holding && 'holding', state.resolved && 'resolved',
    state.branch && `branch-${state.branch.toLowerCase()}`,
    ...(state.queuedPorts ?? []).map((port) => `queued-${port.toLowerCase()}`),
  ].filter(Boolean).join(' ');
  return `part-face part-face-${part.kind}${stateClasses ? ` ${stateClasses}` : ''}`;
}

// A Junction is track infrastructure, not a bench-top mechanism. Keep its
// live SVG in the same copper/groove material language as routed track so the
// merge reads as part of the route in every orientation and UI scale.
function junctionTrackFaceMarkup() {
  const course = 'M-28 0H18C29 0 35 7 43 16' +
    'M-28 64H1C18 64 23 35 43 16' +
    'M43 16C54 5 63 0 92 0';
  return '<g class="junction-track" aria-hidden="true">' +
    '<g class="junction-track-ties">' +
      '<path d="M-18-9V9M0-9V9M17-8V8M-18 55V73M0 55V73"></path>' +
      '<path d="M11 50 27 58M18 35 35 43M29 21 42 34M48 5 59 18M62-9V9M80-9V9"></path>' +
    '</g>' +
    `<path class="junction-track-shadow" d="${course}"></path>` +
    `<path class="junction-track-bed" d="${course}"></path>` +
    `<path class="junction-track-groove" d="${course}"></path>` +
    `<path class="junction-track-live" d="${course}"></path>` +
    '<circle class="junction-track-joint" cx="43" cy="16" r="5.5"></circle>' +
    '<g class="junction-direction" transform="translate(71 0)">' +
      '<rect x="-11" y="-8" width="22" height="16" rx="7"></rect>' +
      '<path d="M-4-4 0 0-4 4M2-4 6 0 2 4"></path>' +
    '</g>' +
    '<path class="junction-collision-mark" d="M36 9 50 23M50 9 36 23"></path>' +
  '</g>';
}

function partFace(part, cx = 0, cy = 0, state = {}) {
  const config = { ...defaultConfig(part.kind), ...part.config };
  const cls = partFaceClass(part, state);
  const counterRotation = -(part.orientation ?? 0) * 90;
  const plate = (text, x = 0, y = 0, w = 28, extra = '') => {
    const width = Math.max(w, text.length * 12 + 10);
    return `<g class="face-plate ${extra}"><rect x="${x - width / 2}" y="${y - 11}" width="${width}" height="22" rx="4"></rect>` +
      `<text x="${x}" y="${y + 6}" transform="rotate(${counterRotation} ${x} ${y})">${text}</text></g>`;
  };
  let face = '';

  if (part.kind === WIRE_TOOL) {
    face = '<path class="track-tool-ties" d="M-22 4V20M-8 4V20M-8 4H8M-8-10H8M8-20V-4M22-20V-4"></path>' +
      '<path class="track-tool-bed" d="M-29 12H0V-12H29"></path>' +
      '<path class="track-tool-groove" d="M-29 12H0V-12H29"></path>' +
      '<path class="track-tool-rail" d="M-29 12H0V-12H29"></path>';
  } else if (part.kind === 'junction') {
    face = junctionTrackFaceMarkup();
  } else {
    const art = partArtSelection(part.kind);
    const size = part.kind === 'crossing' ? 64 : 128;
    face = `<image class="part-art-image" data-concept="${art.concept}" href="${art.href}" ` +
      `x="-32" y="-32" width="${size}" height="${size}" preserveAspectRatio="none"></image>` +
      `<rect class="part-state-outline" x="-29" y="-29" width="${size - 6}" height="${size - 6}" ` +
      `rx="${part.kind === 'crossing' ? 8 : 18}"></rect>`;

    if (part.kind === 'mould') face += plate(`+ ${config.note}`, 32, 78, 38, 'mould-note');
    if (part.kind === 'valve') {
      face += plate(`${state.countdown ?? config.delay} TICKS`, 32, 76, 58, 'valve-countdown');
    }
    if (part.kind === 'splitter') face += plate(`CUT ${config.k}`, 32, 78, 48, 'splitter-position');
    if (part.kind === 'fork') {
      const mode = config.mode === 'consume' ? '×' : '◇';
      face += plate(`${config.note} ${mode}`, 32, 78, 38, 'fork-setting') +
        '<circle class="part-branch-indicator match" cx="81" cy="0" r="4"></circle>' +
        '<circle class="part-branch-indicator other" cx="81" cy="64" r="4"></circle>';
    }
    if (part.kind === 'coupling') {
      face += plate(`B→A ${config.noteA}`, 32, 22, 50, 'coupling-setting route-a') +
        plate(`A→B ${config.noteB}`, 32, 44, 50, 'coupling-setting route-b') +
        '<path class="coupling-gates part-action-trace" d="M18 16 46 48M46 16 18 48"></path>';
    }
    if (part.kind === 'unison') {
      face += '<circle class="unison-state-seat lead" cx="-13" cy="0" r="5"></circle>' +
        '<circle class="unison-state-seat tail" cx="-13" cy="64" r="5"></circle>' +
        '<path class="unison-carriage part-action-trace" d="M1 0C22 0 30 17 43 25M1 64C22 64 30 47 43 39"></path>';
    }
    if (part.kind === 'resonator') {
      face += '<circle class="resonator-state-ring" cx="32" cy="22" r="24"></circle>';
    }
  }

  return `<g class="${cls}" transform="translate(${cx} ${cy})" style="--tick-ms:${state.tickMs ?? 280}ms">${face}</g>`;
}

function partVisualState(part, m) {
  if (!run) return {};
  const outgoing = run.transit.map((item) => ({ item, wire: m.wires[item.wireIndex] }))
    .filter(({ wire }) => wire?.from.part === part.id);
  const firing = outgoing.filter(({ item }) => item.depart === run.tick);
  const latest = firing.at(-1) ?? [...outgoing].sort((a, b) => a.item.depart - b.item.depart).at(-1);
  const queues = run.queues[part.id] ?? {};
  const queuedPorts = Object.entries(queues).filter(([, words]) => words.length).map(([port]) => port);
  const hold = run.holds.find((item) => item.part === part.id);
  return {
    active: Boolean(outgoing.length || queuedPorts.length || hold),
    firing: firing.length > 0,
    waiting: run.stalls.some((stall) => stall.part === part.id),
    holding: Boolean(hold),
    resolved: run.satisfied[part.id] !== undefined,
    branch: latest?.wire?.from.port ?? null,
    queuedPorts,
    countdown: hold ? Math.max(0, hold.release - run.tick) : null,
    tickMs: SPEEDS[speedIdx],
  };
}

function animateTransitWords(motions) {
  if (transitAnimationFrame) cancelAnimationFrame(transitAnimationFrame);
  transitAnimationFrame = null;
  if (REDUCED_MOTION || !motions.length) return;
  const started = performance.now();
  const frame = (now) => {
    let unfinished = false;
    for (const motion of motions) {
      const node = svg.querySelector(`[data-motion="${motion.id}"]`);
      if (!node) continue;
      const elapsed = Math.min(motion.duration, now - started);
      const progress = transitProgress(
        motion.from, motion.to, elapsed, motion.duration, motion.dwellFraction,
      );
      const state = wordMarbleState(motion.points, progress);
      const wordMarble = node.querySelector('[data-marble="0"]');
      wordMarble?.setAttribute('transform', `translate(${state.x} ${state.y})`);
      wordMarble?.querySelector('[data-marble-surface]')
        ?.setAttribute('transform', `rotate(${state.surfaceRoll})`);
      if (elapsed < motion.duration) unfinished = true;
    }
    if (unfinished) transitAnimationFrame = requestAnimationFrame(frame);
    else transitAnimationFrame = null;
  };
  transitAnimationFrame = requestAnimationFrame(frame);
}

function wordMarbleMarkup(points, progress, word, { motionId = null, processing = false } = {}) {
  const state = wordMarbleState(points, progress);
  const motion = motionId ? ` data-motion="${motionId}"` : '';
  const classes = `transit-word moving-word${processing ? ' processing-word' : ''}`;
  return `<g class="${classes}"${motion}>` + drawWordMarble(word, state.x, state.y, {
    index: 0,
    surfaceRoll: state.surfaceRoll,
  }) + '</g>';
}

function partBodyMarkup(part, classes = '', state = {}) {
  const cx = part.x * CELL + CELL / 2;
  const cy = part.y * CELL + CELL / 2;
  const angle = (part.orientation ?? 0) * 90;
  const pivot = localPartPivot(part.kind, CELL);
  const baseSize = partFootprintSize(part.kind, 0);
  const width = (baseSize.cols - 1) * CELL + 58;
  const height = (baseSize.rows - 1) * CELL + 58;
  return `<g class="oriented-part-body" transform="translate(${cx} ${cy}) rotate(${angle} ${pivot.x} ${pivot.y})">` +
    `<rect class="part-box${classes}" x="-29" y="-29" width="${width}" height="${height}" rx="9"></rect>` +
    `${partFace(part, 0, 0, state)}</g>`;
}

function partFaceViewBox(partOrKind) {
  const part = typeof partOrKind === 'string' ? { kind: partOrKind, orientation: 0 } : partOrKind;
  const { kind } = part;
  if (kind === WIRE_TOOL) return '-36 -30 72 60';
  if (kind === 'crossing') return '-38 -38 76 76';
  return '-38 -38 140 140';
}

function footprintPreviewClasses(part) {
  if (part.kind === WIRE_TOOL) return [];
  const size = partFootprintSize(part.kind, part.orientation);
  const cells = size.cols * size.rows;
  return [
    cells > 1 && 'multi-cell',
    size.rows > size.cols && 'vertical',
    cells > 1 && size.rows === size.cols && 'square',
  ].filter(Boolean);
}

// The backdrop covers the whole rendered surface. Grid lines and pins tile
// through one user-space pattern so their cost stays flat as the surface
// grows; the pattern's corner pins are quartered by tiling and recompose into
// full pins at every intersection. Nothing marks the authored frame: it only
// stages supplied terminals and seeds the camera.
function boardBackdropMarkup(p, surface) {
  const x = surface.minX * CELL, y = surface.minY * CELL;
  const width = surface.cols * CELL, height = surface.rows * CELL;
  const gridCorners = [[0, 0], [CELL, 0], [0, CELL], [CELL, CELL]];
  let markup = `<defs>
    <linearGradient id="board-walnut" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#392719"></stop><stop offset="0.48" stop-color="#2c1c11"></stop><stop offset="1" stop-color="#1d120b"></stop>
    </linearGradient>
    <radialGradient id="board-lamp" cx="48%" cy="38%" r="68%">
      <stop offset="0" stop-color="#8d6330" stop-opacity=".17"></stop><stop offset="1" stop-color="#0c0906" stop-opacity=".2"></stop>
    </radialGradient>
    <pattern id="board-grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">
      <line class="grid-line" x1="0" y1="0" x2="0" y2="${CELL}"></line>
      <line class="grid-line" x1="0" y1="0" x2="${CELL}" y2="0"></line>
      ${gridCorners.map(([cx, cy]) =>
        `<circle class="grid-pin-shadow" cx="${cx}" cy="${cy + 1}" r="2.4"></circle>` +
        `<circle class="grid-pin" cx="${cx}" cy="${cy}" r="1.8"></circle>`).join('')}
    </pattern>
  </defs><g data-board-layer="backdrop">`;
  markup += `<rect class="board-wood" x="${x}" y="${y}" width="${width}" height="${height}"></rect>`;
  markup += `<rect class="board-lamplight" x="${x}" y="${y}" width="${width}" height="${height}"></rect>`;
  for (let gy = y + 12; gy < y + height; gy += 23) {
    const bend = (Math.round((gy - y) / 23) % 3 - 1) * 5;
    markup += `<path class="board-grain" d="M${x} ${gy} Q${x + width * 0.32} ${gy + bend} ${x + width * 0.57} ${gy - bend} T${x + width} ${gy + bend * 0.4}"></path>`;
  }
  markup += `<rect class="board-grid-fill" fill="url(#board-grid)" x="${x}" y="${y}" width="${width}" height="${height}"></rect>`;
  return `${markup}</g>`;
}

function ensureBoardLayers(p, surface) {
  const key = `${surface.minX},${surface.minY},${surface.cols}x${surface.rows}`;
  let machineLayer = svg.querySelector('[data-board-layer="machine"]');
  let runLayer = svg.querySelector('[data-board-layer="run"]');
  let interactionLayer = svg.querySelector('[data-board-layer="interaction"]');
  if (boardBackdropKey === key && machineLayer && runLayer && interactionLayer) {
    return { machineLayer, runLayer, interactionLayer };
  }
  svg.innerHTML = `${boardBackdropMarkup(p, surface)}` +
    '<g data-board-layer="machine"></g><g data-board-layer="run"></g>' +
    '<g data-board-layer="interaction"></g>';
  boardBackdropKey = key;
  machineLayer = svg.querySelector('[data-board-layer="machine"]');
  runLayer = svg.querySelector('[data-board-layer="run"]');
  interactionLayer = svg.querySelector('[data-board-layer="interaction"]');
  return { machineLayer, runLayer, interactionLayer };
}

function scheduleBoardRender() {
  if (boardRenderFrame !== null) return;
  boardRenderFrame = requestAnimationFrame(() => {
    boardRenderFrame = null;
    renderBoard();
  });
}

function wireGestureMarkup(m) {
  if (!drag) return '';
  const points = routeGesturePoints(m, drag);
  let markup = '';
  for (const cell of drag.route) {
    markup += `<rect class="temp-wire-cell" x="${cell.x * CELL + 5}" y="${cell.y * CELL + 5}" ` +
      `width="${CELL - 10}" height="${CELL - 10}" rx="7"></rect>`;
  }
  if (drag.blockedCell) {
    markup += `<rect class="blocked-wire-cell" x="${drag.blockedCell.x * CELL + 5}" ` +
      `y="${drag.blockedCell.y * CELL + 5}" width="${CELL - 10}" height="${CELL - 10}" rx="7">` +
      `<title>${drag.blockedReason}</title></rect>`;
  }
  const path = roundedPathData(points);
  return `${markup}<path class="temp-track-bed" d="${path}"></path>` +
    `<path class="temp-track-rail" d="${path}"></path>`;
}

function marqueeMarkup() {
  if (!marquee?.moved) return '';
  const x = Math.min(marquee.startX, marquee.x);
  const y = Math.min(marquee.startY, marquee.y);
  const width = Math.abs(marquee.x - marquee.startX);
  const height = Math.abs(marquee.y - marquee.startY);
  return `<rect class="selection-marquee" x="${x}" y="${y}" width="${width}" height="${height}"></rect>`;
}

function boardInteractionMarkup(m) {
  return wireGestureMarkup(m) + marqueeMarkup();
}

function renderBoardInteraction() {
  const p = puzzle();
  const { interactionLayer } = ensureBoardLayers(p, surface ?? syncSurface());
  interactionLayer.innerHTML = boardInteractionMarkup(machine());
  renderInteractionStatus();
}

function scheduleBoardInteractionRender() {
  if (boardInteractionFrame !== null) return;
  boardInteractionFrame = requestAnimationFrame(() => {
    boardInteractionFrame = null;
    renderBoardInteraction();
  });
}

// A running machine changes only a small fraction of the board each tick.
// Keep the routed machine mounted and update its stateful classes plus a
// compact overlay for travelling marbles and resonator rings.
function renderBoardRun(m = machine(), layers = null) {
  const p = puzzle();
  const { machineLayer, runLayer } = layers ?? ensureBoardLayers(p, surface ?? syncSurface());
  if (machineLayer.dataset.mounted !== 'true') {
    renderBoard();
    return;
  }

  svg.classList.toggle('discrete', discreteFrames);
  svg.classList.toggle('running', Boolean(timer) && !discreteFrames && !REDUCED_MOTION);
  svg.style.setProperty('--tick-ms', `${SPEEDS[speedIdx]}ms`);

  let markup = '';
  const wireNodes = machineLayer.querySelectorAll('.track-rail[data-wire]');
  m.wires.forEach((wire, wireIndex) => {
    const node = wireNodes[wireIndex];
    const couplingRoute = Boolean(run) && byId(m, wire.from.part)?.kind === 'coupling';
    const liveItem = run?.transit.find((item) => item.wireIndex === wireIndex);
    node?.classList.toggle('route-a', couplingRoute && wire.from.port.startsWith('outA'));
    node?.classList.toggle('route-b', couplingRoute && wire.from.port.startsWith('outB'));
    node?.classList.toggle('live-route', Boolean(liveItem));
  });

  const partNodes = new Map([...machineLayer.querySelectorAll('[data-part]')]
    .map((node) => [node.dataset.part, node]));
  for (const part of m.parts) {
    const node = partNodes.get(part.id);
    if (!node) continue;
    const state = partVisualState(part, m);
    const face = node.querySelector('.part-face');
    const faceClass = partFaceClass(part, state);
    if (face?.getAttribute('class') !== faceClass) face?.setAttribute('class', faceClass);
    const tickDuration = `${SPEEDS[speedIdx]}ms`;
    if (face?.style.getPropertyValue('--tick-ms') !== tickDuration) {
      face?.style.setProperty('--tick-ms', tickDuration);
    }
    if (part.kind === 'valve') {
      const countdown = state.countdown ?? part.config?.delay ?? defaultConfig(part.kind).delay;
      const text = face?.querySelector('.valve-countdown text');
      if (text) text.textContent = `${countdown} TICKS`;
    }

    const coupling = part.kind === 'coupling' ? couplingFeedback(part, m) : null;
    node.querySelector('.part-box')?.classList.toggle('coupling-active', Boolean(coupling));
    if (part.kind === 'coupling') {
      node.querySelectorAll('.port').forEach((port) => {
        const name = port.dataset.portName;
        port.classList.toggle('route-source', Boolean(coupling) &&
          ((name === 'inB' && coupling.wordB !== undefined) ||
            (name === 'inA' && coupling.wordA !== undefined)));
        port.classList.toggle('route-selected', Boolean(coupling) &&
          (name === coupling.outA || name === coupling.outB));
      });
    }

    if (part.kind === 'resonator' && run?.satisfied[part.id] !== undefined) {
      const cx = part.x * CELL + CELL / 2;
      const cy = part.y * CELL + CELL / 2;
      markup += `<circle class="satisfied-ring" cx="${cx}" cy="${cy}" r="27"></circle>`;
    }
  }

  const transitMotions = [];
  if (run) {
    for (const [motionIndex, item] of run.transit.entries()) {
      const wire = m.wires[item.wireIndex];
      const ticks = Math.max(1, item.arrive - item.depart);
      const from = Math.max(0, Math.min(1, (run.tick - item.depart) / ticks));
      const to = Math.max(from, Math.min(1, (run.tick - item.depart + 1) / ticks));
      const points = roundedPathPoints([processingPoint(m, wire), ...wirePoints(m, wire)]);
      const motionId = `transit-${motionIndex}`;
      const duration = SPEEDS[speedIdx];
      const dwellFraction = item.depart === run.tick ? PROCESSING_DWELL : 0;
      if (discreteFrames) {
        markup += wordMarbleMarkup(points, from, item.word);
      } else if (REDUCED_MOTION) {
        markup += wordMarbleMarkup(points, to, item.word);
      } else {
        markup += wordMarbleMarkup(points, from, item.word, {
          motionId, processing: Boolean(dwellFraction),
        });
        transitMotions.push({ id: motionId, points, from, to, duration, dwellFraction });
      }
    }
    for (const [partId, ports] of Object.entries(run.queues)) {
      const part = byId(m, partId);
      if (!part) continue;
      for (const [port, words] of Object.entries(ports)) {
        words.forEach((word, index) => {
          const pos = partVisualAnchor(part, 'queue', port, CELL);
          const routeClass = part.kind === 'coupling'
            ? port === 'inB' ? 'coupling-head route-a' : port === 'inA' ? 'coupling-head route-b' : ''
            : '';
          markup += `<g class="${routeClass}">${drawWordMarble(word, pos.x, pos.y - index * 26)}</g>`;
        });
      }
    }
    for (const hold of run.holds) {
      const part = byId(m, hold.part);
      const pos = partVisualAnchor(part, 'hold', null, CELL);
      markup += drawWordMarble(hold.word, pos.x, pos.y);
    }
  }

  runLayer.innerHTML = markup;
  animateTransitWords(transitMotions);
}

function partDragEdit(baseMachine = machine()) {
  if (!partDrag?.moved) return null;
  return groupMovementEdit(
    baseMachine.parts,
    partDrag.ids,
    { dx: partDrag.x - partDrag.originX, dy: partDrag.y - partDrag.originY },
    baseMachine.wires,
  );
}

function renderBoard() {
  if (boardRenderFrame !== null) {
    cancelAnimationFrame(boardRenderFrame);
    boardRenderFrame = null;
  }
  if (boardInteractionFrame !== null) {
    cancelAnimationFrame(boardInteractionFrame);
    boardInteractionFrame = null;
  }
  const p = puzzle();
  const baseMachine = machine();
  const movePreview = partDragEdit(baseMachine);
  const m = movePreview?.valid
    ? { parts: movePreview.parts, wires: movePreview.wires }
    : baseMachine;
  const partTool = armedPartKind();
  const splicePreview = partTool && placementHover && editable()
    ? spliceCandidateAtCell(
        m, partTool, placementHover.x, placementHover.y, placementOrientation,
      )
    : null;
  const kase = currentCase();
  syncSurface();
  svg.setAttribute('viewBox', `${surface.minX * CELL} ${surface.minY * CELL} ` +
    `${surface.cols * CELL} ${surface.rows * CELL}`);
  const { machineLayer, runLayer, interactionLayer } = ensureBoardLayers(p, surface);
  svg.classList.toggle('discrete', discreteFrames);
  svg.classList.toggle('running', Boolean(timer) && !discreteFrames && !REDUCED_MOTION);
  const routingActive = editable() && (armedTool === WIRE_TOOL || Boolean(drag));
  const wantedPortDir = drag
    ? drag.end === 'from' ? 'out' : drag.end === 'to' ? 'in' : null
    : null;
  svg.classList.toggle('wire-mode', routingActive);
  svg.style.setProperty('--tick-ms', `${SPEEDS[speedIdx]}ms`);
  let s = '';

  let wireHandles = '';
  m.wires.forEach((w) => {
    const pts = wirePoints(m, w);
    const roundedPts = roundedPathPoints(pts);
    const d = roundedPathData(pts);
    const selected = selection?.kind === 'wire' && selection.id === w.id;
    const sel = selected ? ' selected' : '';
    const spliceTarget = splicePreview?.id === w.id ? ' splice-target' : '';
    for (const cell of wireRouteCells(m, w)) {
      s += `<rect class="wire-cell${sel}${spliceTarget}" data-wire-cell="${w.id}" ` +
        `x="${cell.x * CELL + 4}" y="${cell.y * CELL + 4}" width="${CELL - 8}" height="${CELL - 8}" rx="7"></rect>`;
    }
    s += trackTiesMarkup(pts, `${sel}${spliceTarget}`);
    s += `<path class="track-shadow${sel}${spliceTarget}" d="${d}"></path>`;
    s += `<path class="track-bed${sel}${spliceTarget}" d="${d}"></path>`;
    s += `<path class="track-groove${sel}${spliceTarget}" d="${d}"></path>`;
    s += `<path class="track-rail${sel}${spliceTarget}" data-wire="${w.id}" d="${d}"></path>`;
    s += `<path class="track-hit" data-wire="${w.id}" d="${d}"></path>`;
    const mid = pointAlongPath(roundedPts, 0.5);
    const ticks = wireTicks(m, w);
    s += `<rect class="wire-chip-box" x="${mid.x - 8}" y="${mid.y - 6}" width="16" height="12" rx="3"></rect>`;
    s += `<text class="wire-chip" x="${mid.x}" y="${mid.y + 3}">${ticks}</text>`;
    s += trackDirectionMarkup(roundedPts);
    if (selected && editable()) {
      const from = portPos(m, w.from, w);
      const to = portPos(m, w.to, w);
      wireHandles += `<circle class="wire-handle-hit" data-wire-handle="from" data-wire="${w.id}" cx="${from.x}" cy="${from.y}" r="16"></circle>`;
      wireHandles += `<circle class="wire-handle from" data-wire-handle="from" data-wire="${w.id}" cx="${from.x}" cy="${from.y}" r="7"></circle>`;
      wireHandles += `<circle class="wire-handle-hit" data-wire-handle="to" data-wire="${w.id}" cx="${to.x}" cy="${to.y}" r="16"></circle>`;
      wireHandles += `<circle class="wire-handle to" data-wire-handle="to" data-wire="${w.id}" cx="${to.x}" cy="${to.y}" r="7"></circle>`;
    }
  });

  for (const part of m.parts) {
    const selected = partDrag ? partDrag.ids.includes(part.id) : isPartSelected(part.id);
    const sel = selected ? ' selected' : '';
    const moving = partDrag?.moved && partDrag.ids.includes(part.id) ? ' moving' : '';
    s += `<g data-part="${part.id}" class="movable-part">`;
    s += partBodyMarkup(part, `${sel}${moving}`);

    const def = PORTS[part.kind];
    for (const port of new Set([...def.ins, ...def.outs])) {
      const pos = portPos(m, { part: part.id, port });
      const portRef = { part: part.id, port };
      const taken = physicalPortOccupied(portRef, pos.dir, drag?.wireId ?? null);
      const compatible = !wantedPortDir || pos.dir === wantedPortDir || pos.dir === 'both';
      const wireClass = !routingActive ? ''
        : taken ? ' wire-taken'
          : compatible ? ' wire-ready' : ' wire-incompatible';
      const routeClass = couplingRouteClass(part.kind, port);
      const portState = taken ? 'occupied' : compatible ? 'free' : 'incompatible';
      const portRole = pos.dir === 'both' ? 'bidirectional' : pos.dir === 'in' ? 'input' : 'output';
      const displayPort = part.kind === 'crossing' ? pos.side : playerPortName(part.kind, port);
      const namedPort = port === 'in' || port === 'out' ? '' : ` ${displayPort}`;
      const portAria = `${KIND_NAMES[part.kind]}${namedPort} ${portRole} port, ${portState}`;
      s += `<circle class="port-bezel ${pos.dir}" cx="${pos.x}" cy="${pos.y}" r="10.2"></circle>`;
      s += `<circle class="port-status-ring${wireClass}" cx="${pos.x}" cy="${pos.y}" r="13"></circle>`;
      s += `<circle class="port ${pos.dir}${routeClass}" data-port-part="${part.id}" data-port-name="${port}" data-port-dir="${pos.dir}" cx="${pos.x}" cy="${pos.y}" r="7.8"></circle>`;
      s += `<circle class="port-hit${wireClass}" data-port-part="${part.id}" data-port-name="${port}" data-port-dir="${pos.dir}" data-port-state="${portState}" aria-label="${portAria}" cx="${pos.x}" cy="${pos.y}" r="15" fill="transparent"></circle>`;
      s += portTagMarkup(part, port, PORT_LABELS[part.kind]?.[port]);
    }
    s += terminalAnnotationMarkup(part, kase);
    s += '</g>';
  }

  s += wireHandles;

  if (movePreview && !movePreview.valid) {
    const dx = partDrag.x - partDrag.originX;
    const dy = partDrag.y - partDrag.originY;
    for (const original of baseMachine.parts.filter((part) => partDrag.ids.includes(part.id))) {
      const part = { ...original, x: original.x + dx, y: original.y + dy };
      s += `<g class="movement-ghost blocked" aria-label="${movePreview.reason}">`;
      s += partBodyMarkup(part);
      s += boardPreviewPortsMarkup(part);
      s += terminalAnnotationMarkup(part, kase);
      s += '</g>';
    }
  }

  if (partTool && placementHover && editable()) {
    const { x, y } = placementHover;
    const preview = {
      id: '__placement__', kind: partTool, x, y,
      orientation: placementOrientation,
      config: levelDefaultConfig(partTool),
    };
    const validity = placementValidity(m.parts, preview, m.wires);
    const canPlace = validity.valid || Boolean(splicePreview);
    s += `<g class="placement-ghost ${canPlace ? 'valid' : 'blocked'}${splicePreview ? ' splice' : ''}" ` +
      `data-placement-valid="${canPlace}" aria-label="${splicePreview ? 'Insert into track' : validity.reason ?? 'Valid placement'}">`;
    s += partBodyMarkup(preview);
    s += boardPreviewPortsMarkup(preview);
    s += '</g>';
  }

  machineLayer.innerHTML = s;
  machineLayer.dataset.mounted = 'true';
  renderBoardRun(m, { machineLayer, runLayer });
  interactionLayer.innerHTML = boardInteractionMarkup(m);
  renderInteractionStatus();
  requestAnimationFrame(positionContextEditor);
}

// ── side panels ──────────────────────────────────────────

function renderCommissionTitle() {
  $('commission-title').innerHTML = `<h2>${puzzle().title}</h2>`;
  const control = $('reference-architecture-control');
  const select = $('reference-architecture-select');
  if (!REFERENCE_MODE) {
    control.hidden = true;
    select.replaceChildren();
    return;
  }
  const references = referenceMachines(puzzle());
  control.hidden = references.length < 2;
  select.replaceChildren(...references.map((reference, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = reference.title ?? `Architecture ${index + 1}`;
    return option;
  }));
  select.value = String(currentReferenceArchitectureIndex());
}

// Walkthroughs are tutorial teaching material. Reference review reuses the same
// panel to explain the selected architecture and its trade-off.
const deckShown = () => showsWalkthrough(puzzle(), { referenceMode: REFERENCE_MODE });

function renderDeck() {
  const p = puzzle();
  const panel = $('walkthrough-panel');
  const reference = REFERENCE_MODE ? currentReferenceArchitecture() : null;
  panel.classList.toggle('architecture-explanation', REFERENCE_MODE);
  panel.hidden = REFERENCE_MODE ? !reference?.explanation : !deckShown();
  if (panel.hidden) {
    document.querySelectorAll('[data-region]').forEach((el) => el.classList.remove('spotlight'));
    return;
  }
  panel.setAttribute('aria-label', REFERENCE_MODE ? 'Architecture explanation' : 'Walkthrough');
  $('deck-body').hidden = deckHidden;
  $('deck-toggle').textContent = deckHidden ? 'show' : 'hide';
  $('deck-nav').hidden = REFERENCE_MODE;

  if (REFERENCE_MODE) {
    $('deck-label').textContent = 'ARCHITECTURE EXPLANATION';
    const step = $('deck-step');
    const title = document.createElement('strong');
    title.textContent = reference.title;
    const explanation = document.createElement('p');
    explanation.textContent = reference.explanation;
    const optimization = document.createElement('p');
    optimization.className = 'architecture-optimization';
    const optimizationLabel = document.createElement('b');
    optimizationLabel.textContent = 'OPTIMIZES FOR';
    optimization.append(optimizationLabel, ` ${reference.optimization}`);
    const scores = document.createElement('div');
    scores.className = 'architecture-score';
    scores.setAttribute('aria-label', 'Routed reference score; lower is better');
    const scoreHint = document.createElement('span');
    scoreHint.className = 'architecture-score-hint';
    scoreHint.textContent = 'ROUTED RESULT · LOWER IS BETTER';
    scores.append(scoreHint);
    for (const [axis, label] of [['cost', 'COST'], ['time', 'TIME'], ['area', 'AREA']]) {
      const measure = document.createElement('span');
      measure.className = 'architecture-score-measure';
      const name = document.createElement('small');
      name.textContent = label;
      const value = document.createElement('strong');
      value.textContent = reference.score?.[axis] ?? 'n/a';
      measure.append(name, value);
      scores.append(measure);
    }
    step.replaceChildren(title, explanation, optimization, scores);
    document.querySelectorAll('[data-region]').forEach((el) => el.classList.remove('spotlight'));
    return;
  }

  walkIndex = Math.max(0, Math.min(walkIndex, p.walkthrough.length - 1));
  const step = p.walkthrough[walkIndex];
  $('deck-label').textContent = 'WALKTHROUGH';
  $('deck-step').innerHTML = `<strong>${step.title}</strong><p>${step.body}</p>`;
  $('deck-counter').textContent = `${walkIndex + 1} / ${p.walkthrough.length}`;
  $('deck-prev').disabled = walkIndex === 0;
  $('deck-next').disabled = walkIndex === p.walkthrough.length - 1;
  document.querySelectorAll('[data-region]').forEach((el) => {
    el.classList.toggle('spotlight', !deckHidden && el.dataset.region === step.focus);
  });
}

function renderCases() {
  const p = puzzle();
  const soundBar = (word) => {
    const width = soundBarWidth(word);
    return `<svg class="commission-sound-bar sound-bar" ` +
      `viewBox="${-width / 2 - 2} ${-SOUND_BAR_HEIGHT / 2 - 2} ${width + 4} ${SOUND_BAR_HEIGHT + 4}" ` +
      `width="${width + 4}" height="${SOUND_BAR_HEIGHT + 4}" ` +
      `role="img" aria-label="sound phrase ${prettyWord(word)}">${drawSoundBar(0, 0, word)}</svg>`;
  };
  $('case-tabs').innerHTML = p.cases.map((kase, i) => {
    const status = caseStatuses[i];
    const mark = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '·';
    const cls = status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : '';
    const spec = commissionCaseSpec(p, kase);
    const entries = (items) => items.map(({ label, word }) =>
      `<span class="case-entry${label ? '' : ' unlabeled'}">` +
        `${label ? `<b>${label}</b>` : ''}<span class="case-entry-word">${soundBar(word)}</span>` +
      '</span>').join('');
    const section = (label, items) =>
      `<span class="case-spec-section"><small>${label}</small>` +
        `<span class="case-entries">${entries(items)}</span></span>`;
    const current = i === caseIndex;
    return `<button class="case-tab${i === caseIndex ? ' current' : ''}" data-case="${i}">` +
      `<span class="status ${cls}">${mark}</span><span class="case-spec">` +
      `<span class="case-heading"><strong class="case-name">${kase.name}</strong>` +
        `${current ? '<em>NOW</em>' : ''}</span>` +
      section('IN', spec.inputs) + section('OUT', spec.targets) +
      `</span></button>`;
  }).join('');
}

function renderScore() {
  const score = measureScore(machine(), {
    componentCost: playerParts.length,
    runs: verifiedRuns,
  });
  const best = save.bests[puzzle().id];
  $('score-cost').textContent = score.cost;
  $('score-time').textContent = score.time ?? 'n/a';
  $('score-area').textContent = score.area;
  $('best-cost').textContent = best?.cost ?? 'n/a';
  $('best-time').textContent = best?.time ?? 'n/a';
  $('best-area').textContent = best?.area ?? 'n/a';
  document.querySelector('.personal-best').hidden = !best;
}

function renderPalette() {
  const p = puzzle();
  const kinds = paletteKinds();
  $('palette').innerHTML = kinds.length
    ? kinds.map((kind) => {
      const preview = {
        kind,
        orientation: 0,
        config: levelDefaultConfig(kind),
      };
      const left = remaining(kind);
      const count = Number.isFinite(left) ? `×${left}` : '∞';
      const classes = [
        armedTool === kind && 'armed', left <= 0 && 'exhausted',
        ...footprintPreviewClasses(preview),
      ].filter(Boolean).join(' ');
      return `<button data-tool="${kind}" aria-pressed="${armedTool === kind}" class="${classes}">` +
          `<svg class="palette-icon" viewBox="${partFaceViewBox(preview)}" aria-hidden="true">` +
          `${partPreviewMarkup(preview)}</svg>` +
          `<span class="palette-name">${CONSTRUCTION_NAMES[kind]}</span><span class="count">${count}</span></button>`;
      }).join('')
    : '<span class="count">no parts available</span>';
  $('construction-help').textContent = run
    ? recital
      ? 'recital playing · Pause or Reset to edit'
      : 'the machine is frozen while a run is live'
    : armedTool === WIRE_TOOL
      ? 'track armed · drag from any free port and lay to a compatible port · right-click or Esc cancels'
      : armedTool
        ? 'ghost follows the board · R rotates · click places · right-click or Esc cancels'
      : 'Shift-click or Shift-drag selects parts · drag a selection to move · R rotates one part · Del removes';
}

function renderTransport() {
  $('tick-output').textContent = run ? run.tick : '–';
  $('run-status').textContent = !run ? 'READY'
    : recital?.failed ? run.verdict.toUpperCase()
    : recital ? timer ? `RECITAL${recital.filled ? ' ✓' : ''}` : 'PAUSED'
    : run.verdict ? run.verdict.toUpperCase()
    : timer ? 'PLAYING' : 'PAUSED';
  $('run-button').textContent = recital
    ? timer ? '❚❚ Pause' : recital.failed ? '▶ Retry' : '▶ Continue'
    : run?.verdict ? '▶ Again' : '▶ Run';
  document.querySelectorAll('[data-speed]').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.speed) === speedIdx);
  });
  $('undo-edit').disabled = !editable() || !undoStack.length;
  $('redo-edit').disabled = !editable() || !redoStack.length;
  $('clear-machine').disabled = !editable() ||
    (!playerParts.length && !playerWires.length && !placedTerminalCount());
}

function renderLog() {
  const items = run ? [...run.events].reverse().slice(0, 40) : [];
  $('trace-count').textContent = `${run?.events.length ?? 0} event${run?.events.length === 1 ? '' : 's'}`;
  $('event-log').innerHTML = items.map((e) => `<li>${e}</li>`).join('') ||
    '<li>press Run and the machine will narrate itself here</li>';
}

function noteChips(chosen, onAttr) {
  return NOTES.map((n) =>
    `<button class="note-chip ${n === chosen ? 'chosen' : ''}" data-${onAttr}="${n}" ` +
    `style="--note-color: var(--note-${n}); border-color: var(--note-${n});">${n}</button>`
  ).join('');
}

const CONSTRUCTION_HELP = {
  wire: {
    rule: 'port → routed cells → port',
    body: 'Lays an orthogonal marble track. Drag straight through another track at a right angle to add a Crossing automatically. Track length changes Time and Area; each Crossing adds Cost.',
  },
  quill: {
    rule: 'sound phrase → word marble',
    body: 'Transcribes the performance’s input sound phrase into one word marble at tick 1. Its sound bar gives the exact note order.',
  },
  mould: {
    rule: 'word → word·note',
    body: 'Adds the selected note to the tail of each word marble.',
  },
  damper: {
    rule: 'lead note·word → word',
    body: 'Removes the lead note. An empty word marble waits.',
  },
  valve: {
    rule: 'word marble → delayed word marble',
    body: 'Holds a word marble, then releases it unchanged after the selected number of ticks.',
  },
  unison: {
    rule: '(lead word, tail word) → joined word',
    body: 'Waits for both inputs, then joins the lead word followed by the tail word into one marble.',
  },
  splitter: {
    rule: 'word → (head, rest) after k notes',
    body: 'Makes two word marbles: the first k notes go to head and the remaining notes go to rest. Both outputs must be connected.',
  },
  fork: {
    rule: 'lead note = a ? match : other',
    body: 'Routes a word marble by its lead note. Bite removes a matching lead note; Peek leaves the word unchanged.',
  },
  coupling: {
    rule: 'each word reads the other lead note',
    body: 'Waits for both inputs. Each word marble’s exit is selected by the other word’s lead note. Both words remain unchanged.',
  },
  crossing: {
    rule: 'west ↔ east · north ↔ south',
    body: 'Accepts a word marble from any side and passes it straight out the opposite side. The two channels never mix.',
  },
  junction: {
    rule: 'A | B → out',
    body: 'Passes staggered word marbles from either input unchanged. Simultaneous arrivals collide.',
  },
  resonator: {
    rule: 'target word marble → sound waves',
    body: 'Turns a matching word marble into sound waves. A different word fails the performance; “stay silent” accepts no marble.',
  },
};

function renderToolHelp(kind) {
  const help = CONSTRUCTION_HELP[kind];
  const ports = PORTS[kind] ?? { ins: [], outs: [] };
  const inputs = ports.ins.length ? [...new Set(ports.ins.map((port) => playerPortName(kind, port)))].join(', ') : 'none';
  const outputs = ports.outs.length ? [...new Set(ports.outs.map((port) => playerPortName(kind, port)))].join(', ') : 'none';
  const preview = {
    kind,
    orientation: armedTool === kind ? placementOrientation : 0,
    config: levelDefaultConfig(kind),
  };
  const classes = ['tool-inspection', ...footprintPreviewClasses(preview)].join(' ');
  $('selection-kind').textContent = 'CONSTRUCTION TRAY';
  const hint = !editable()
    ? 'The performance is running. Placement is disabled.'
    : kind === WIRE_TOOL && armedTool === WIRE_TOOL
      ? 'Track mode is active. Drag from any free port to its compatible endpoint.'
      : kind === WIRE_TOOL
        ? 'Select to arm routing. Direct port dragging remains available as a shortcut.'
    : remaining(kind) <= 0
      ? 'No copies remain. Select one on the board to configure it.'
      : armedTool === kind
        ? 'Placement is active. Press Esc to cancel.'
        : 'Select to place this part.';
  $('inspector').innerHTML = `<div class="${classes}">` +
    `<svg viewBox="${partFaceViewBox(preview)}" aria-hidden="true">${partPreviewMarkup(preview)}</svg>` +
    `<div><strong>${CONSTRUCTION_NAMES[kind]}</strong><code>${help.rule}</code><p class="prose">${help.body}</p></div></div>` +
    (kind === WIRE_TOOL
      ? '<p class="tool-ports"><span>START</span> any free port <span>END</span> compatible free port</p>'
      : kind === 'crossing'
        ? '<p class="tool-ports"><span>SIDES</span> all four accept or release <span>PATH</span> straight across</p>'
      : `<p class="tool-ports"><span>IN</span> ${inputs} <span>OUT</span> ${outputs}</p>`) +
    `<p class="tool-hint">${hint}</p>`;
}

function partControlMarkup(part) {
  let html = '';
  if (part.kind === 'mould') {
    html += `<div class="row"><span>note to add</span>${noteChips(part.config.note, 'note')}</div>`;
  }
  if (part.kind === 'splitter') {
    html += `<div class="row"><span>cut after</span><button data-k="-1" aria-label="Decrease split position">−</button>` +
      `<strong>${part.config.k}</strong><button data-k="1" aria-label="Increase split position">+</button></div>`;
  }
  if (part.kind === 'fork') {
    const modes = allowedForkModes();
    html += `<div class="row"><span>note to match</span>${noteChips(part.config.note, 'note')}</div>` +
      `<div class="row"><span>mode</span><button data-mode="peek" class="${part.config.mode === 'peek' ? 'active' : ''}" ` +
      `${modes.includes('peek') ? '' : 'disabled title="This study permits Bite only"'}>peek</button>` +
      `<button data-mode="consume" class="${part.config.mode === 'consume' ? 'active' : ''}" ` +
      `${modes.includes('consume') ? '' : 'disabled title="This study permits Peek only"'}>bite</button></div>`;
  }
  if (part.kind === 'coupling') {
    html += `<div class="coupling-choice route-a"><strong>B decides A</strong>` +
      `<span>lead note</span><div class="coupling-notes">${noteChips(part.config.noteA, 'note-a')}</div>` +
      `<span>match → <b>AL</b> · other → <b>AR</b></span></div>` +
      `<div class="coupling-choice route-b"><strong>A decides B</strong>` +
      `<span>lead note</span><div class="coupling-notes">${noteChips(part.config.noteB, 'note-b')}</div>` +
      `<span>match → <b>BL</b> · other → <b>BR</b></span></div>`;
  }
  if (part.kind === 'valve') {
    html += `<div class="row"><span>hold</span><button data-delay="-1" aria-label="Decrease hold">−</button>` +
      `<strong>${part.config.delay}</strong><button data-delay="1" aria-label="Increase hold">+</button><span>ticks</span></div>`;
  }
  return html;
}

function bindPartControls(box, part) {
  const setConfig = (key, value) => {
    if (!editable() || part.config[key] === value) return;
    if (part.kind === 'fork' && key === 'mode' && !allowedForkModes().includes(value)) return;
    applyEdit(() => {
      const current = playerParts.find((candidate) => candidate.id === part.id);
      if (current) current.config[key] = value;
      selection = partSelection([part.id], part.id);
    });
  };
  box.querySelectorAll('[data-note]').forEach((button) => {
    button.onclick = () => setConfig('note', button.dataset.note);
  });
  box.querySelectorAll('[data-note-a]').forEach((button) => {
    button.onclick = () => setConfig('noteA', button.dataset.noteA);
  });
  box.querySelectorAll('[data-note-b]').forEach((button) => {
    button.onclick = () => setConfig('noteB', button.dataset.noteB);
  });
  box.querySelectorAll('[data-k]').forEach((button) => {
    button.onclick = () => setConfig('k', Math.max(1, Math.min(6, part.config.k + Number(button.dataset.k))));
  });
  box.querySelectorAll('[data-delay]').forEach((button) => {
    button.onclick = () => setConfig('delay', Math.max(1, Math.min(12, part.config.delay + Number(button.dataset.delay))));
  });
  box.querySelectorAll('[data-mode]').forEach((button) => {
    button.onclick = () => setConfig('mode', button.dataset.mode);
  });
}

function positionContextEditor() {
  const box = $('context-editor');
  if (box.hidden || selectedPartIds().length !== 1) return;
  const node = svg.querySelector(`[data-part="${selection.primaryId}"]`);
  if (!node || !boardShell) return;
  const partRect = node.getBoundingClientRect();
  const shellRect = boardShell.getBoundingClientRect();
  const scrollRect = boardScroll.getBoundingClientRect();
  const gap = 10;
  const minTop = scrollRect.top - shellRect.top + 6;
  const maxTop = scrollRect.bottom - shellRect.top - box.offsetHeight - 6;
  let top = partRect.top - shellRect.top - box.offsetHeight - gap;
  let placement = 'above';
  if (top < minTop) {
    top = partRect.bottom - shellRect.top + gap;
    placement = 'below';
  }
  top = Math.max(minTop, Math.min(top, maxTop));
  let left = partRect.left - shellRect.left + partRect.width / 2 - box.offsetWidth / 2;
  left = Math.max(8, Math.min(left, boardShell.clientWidth - box.offsetWidth - 8));
  const anchorX = partRect.left - shellRect.left + partRect.width / 2 - left;
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.setProperty('--anchor-x', `${Math.max(14, Math.min(anchorX, box.offsetWidth - 14))}px`);
  box.dataset.placement = placement;
}

function renderContextEditor() {
  const box = $('context-editor');
  if (!editable() || selectedPartIds().length !== 1) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const part = primarySelectedPart();
  if (!part) {
    box.hidden = true;
    return;
  }
  const controls = partControlMarkup(part);
  if (!controls) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = `<strong class="context-title">${KIND_NAMES[part.kind]}</strong>` +
    `<div class="part-editor">${controls}</div>`;
  bindPartControls(box, part);
  requestAnimationFrame(positionContextEditor);
}

function renderInspector() {
  renderContextEditor();
  const box = $('inspector');
  const inspection = hoverInspection ?? selection;
  if (!inspection) {
    $('selection-kind').textContent = 'BOARD';
    box.innerHTML = '<p class="prose">Lay tracks through unoccupied grid cells. Track length determines travel time; the tight occupied rectangle determines area.</p>';
    return;
  }
  if (inspection.kind === 'tool') {
    renderToolHelp(inspection.toolKind);
    return;
  }
  if (inspection.kind === 'wire') {
    const w = playerWires.find((x) => x.id === inspection.id);
    if (!w) {
      if (hoverInspection) hoverInspection = null;
      else selection = null;
      renderInspector();
      return;
    }
    $('selection-kind').textContent = 'TRACK';
    const m = machine();
    const fromPart = byId(m, w.from.part);
    const toPart = byId(m, w.to.part);
    box.innerHTML = `<p class="prose">${partReference(fromPart)}.${playerPortName(fromPart?.kind, w.from.port)} → ` +
      `${partReference(toPart)}.${playerPortName(toPart?.kind, w.to.port)} · travel time: ${wireTicks(m, w)} ticks</p>`;
    return;
  }
  if (inspection.kind === 'parts' && inspection.ids.length > 1) {
    $('selection-kind').textContent = `${inspection.ids.length} PARTS SELECTED`;
    box.innerHTML = '<p class="prose">Drag any selected part to move the collection. ' +
      'Internal tracks keep their shape; tracks leaving the selection reconnect where possible.</p>' +
      '<p class="tool-hint">Shift-click adjusts the selection · Delete returns every selected part to the tray · select one part to rotate or configure it</p>';
    return;
  }
  const partId = inspection.kind === 'parts' ? inspection.primaryId : inspection.id;
  const part = byId(machine(), partId);
  if (!part) {
    if (hoverInspection) hoverInspection = null;
    else selection = null;
    renderInspector();
    return;
  }
  $('selection-kind').textContent = TERMINAL_KINDS.has(part.kind)
    ? part.label
    : `${KIND_NAMES[part.kind].toUpperCase()} ${part.id}`;
  let html = '';
  const kase = currentCase();

  if (part.kind === 'quill') html += `<p class="prose">Transcribes the sound phrase ${prettyWord(kase.seeds[part.id] ?? '')} into one word marble at tick 1.</p>`;
  if (part.kind === 'resonator') html += `<p class="prose">${kase.targets[part.id] !== undefined ? `Target output sound: ${prettyWord(kase.targets[part.id])}. A matching word marble becomes sound waves; a different word fails the performance.` : 'Target: stay silent. Any arriving word marble fails the performance.'}</p>`;
  if (part.kind === 'damper') html += '<p class="prose">Removes the lead note. An empty word marble waits.</p>';
  if (part.kind === 'unison') html += '<p class="prose">Waits for both inputs, then joins the lead word followed by the tail word into one marble.</p>';
  if (part.kind === 'mould') html += `<p class="prose">Adds note ${part.config.note} to the tail of each word marble.</p>`;
  if (part.kind === 'splitter') html += `<p class="prose">Cuts after note ${part.config.k}: head receives the first ${part.config.k}; rest receives the remainder as a second word marble.</p>`;
  if (part.kind === 'fork') {
    html += `<p class="prose">A lead ${part.config.note} note uses match (=); all other words use other (≠). ` +
      `${part.config.mode === 'consume' ? 'Bite removes that note.' : 'Peek leaves the word unchanged.'}</p>`;
  }
  if (part.kind === 'coupling') {
    const feedback = couplingFeedback(part, machine());
    html += `<div class="coupling-summary route-a"><strong>B decides A</strong><span>B:${part.config.noteA} → AL · otherwise AR</span></div>` +
      `<div class="coupling-summary route-b"><strong>A decides B</strong><span>A:${part.config.noteB} → BL · otherwise BR</span></div>` +
      '<p class="prose">The Coupling waits for both word marbles. Each word stays intact; the other word’s lead note chooses its exit.</p>';
    if (feedback?.wordA !== undefined || feedback?.wordB !== undefined) {
      const exit = (output) => output?.startsWith('out') ? output.slice(3) : 'waiting';
      html += `<p class="coupling-live">Live: B sends A to ${exit(feedback.outA)} · A sends B to ${exit(feedback.outB)}</p>`;
    }
  }
  if (part.kind === 'crossing') html += '<p class="prose">Every side can accept or release a word marble. It always exits straight through the opposite side; the two channels never mix.</p>';
  if (part.kind === 'junction') html += '<p class="prose">Passes staggered word marbles from A or B to out. Simultaneous arrivals collide.</p>';
  if (part.kind === 'valve') html += `<p class="prose">Holds each word marble for ${part.config.delay} ticks, then releases it unchanged.</p>`;
  const classes = ['tool-inspection', ...footprintPreviewClasses(part)].join(' ');
  const help = CONSTRUCTION_HELP[part.kind];
  box.innerHTML = `<div class="${classes}">` +
    `<svg viewBox="${partFaceViewBox(part)}" aria-hidden="true">` +
    `${partPreviewMarkup(part, partVisualState(part, machine()))}</svg>` +
    `<div><strong>${part.label ?? KIND_NAMES[part.kind]}</strong><code>${help.rule}</code>${html}</div></div>`;
}

function renderNav() {
  const groups = [];
  LEVELS.forEach((p, i) => {
    if (!groups.length || groups.at(-1).chapter !== p.chapter) groups.push({ chapter: p.chapter, items: [] });
    groups.at(-1).items.push({ p, i });
  });
  $('level-nav').innerHTML = '<span class="nav-title">▪ COMMISSIONS</span>' + groups.map((g) =>
    `<section class="nav-group" aria-label="${g.chapter}">` +
    `<span class="nav-chapter">${g.chapter}</span><div class="nav-levels">` +
    g.items.map(({ p, i }) => {
      const unlocked = levelIsUnlocked(i);
      const prerequisite = LEVELS.find((candidate) =>
        candidate.id === prerequisiteId(LEVELS, i));
      const title = unlocked ? p.title : `Locked: fill ${prerequisite?.title ?? 'the prerequisite commission'} first`;
      const solved = save.solved.includes(p.id);
      return `<button class="level-choice${i === levelIndex ? ' current' : ''}${solved ? ' solved' : ''}${unlocked ? '' : ' locked'}" ` +
        `data-level="${i}" title="${title}" aria-label="Level ${i + 1}: ${title}" aria-disabled="${!unlocked}">` +
        `${i + 1}. ${p.title}${solved ? ' ✓' : ''}</button>`;
    }).join('') +
    '</div></section>'
  ).join('');
  $('current-level-label').textContent = `${levelIndex + 1}. ${puzzle().title.toUpperCase()}`;
  $('prev-level').disabled = !levelIsUnlocked(levelIndex - 1);
  $('next-level').disabled = !levelIsUnlocked(levelIndex + 1);
}

function setLevelMenu(open) {
  $('level-nav').hidden = !open;
  $('level-menu-backdrop').hidden = !open;
  $('level-menu-toggle').setAttribute('aria-expanded', String(open));
}

function renderAll() {
  renderNav(); renderCommissionTitle(); renderDeck(); renderCases(); renderScore();
  renderPalette(); renderBoard(); renderTransport(); renderInspector(); renderLog();
  sizeBoard();
}

// ── events ───────────────────────────────────────────────

function renderInteractionStatus() {
  const status = $('interaction-status');
  let text = '';
  if (partDrag?.moved) {
    const validity = partDragEdit();
    const count = partDrag.ids.length;
    text = validity.valid
      ? `Moving ${count === 1 ? 'part' : `${count} parts`} · release to place · right-click or Esc cancels`
      : `Blocked: ${validity.reason} · release to keep the current position`;
  }
  else if (marquee?.moved) {
    const count = selectedPartIds().length;
    text = `Selecting ${count || ''}${count === 1 ? ' part' : count ? ' parts' : 'parts'} · release to finish · Esc cancels`;
  }
  else if (drag?.blockedReason) text = `Blocked: ${drag.blockedReason} · backtrack or choose another cell`;
  else if (drag?.kind === 'retarget') text = `Laying track to a new ${drag.end === 'from' ? 'source' : 'destination'} · cross straight tracks at right angles · Esc cancels`;
  else if (drag?.end === 'either') text = 'Laying track from a Crossing · finish at any compatible free port · right-angle crossings are automatic';
  else if (drag) text = `Laying orthogonal track · release on an ${drag.end === 'from' ? 'output' : 'input'} · right-angle crossings are automatic`;
  else if (interactionNotice) text = interactionNotice;
  else if (armedTool === WIRE_TOOL) text = 'Track armed · drag from any free port to lay a route · right-click or Esc cancels';
  else if (armedTool) text = `Placing ${KIND_NAMES[armedTool]} · R rotates · right-click or Esc cancels`;
  else if (selection?.kind === 'parts') {
    const count = selection.ids.length;
    text = count === 1
      ? '1 part selected · drag to move · Shift-click adds or removes · R rotates · Esc clears'
      : `${count} parts selected · drag any selected part to move · Shift-click adjusts · Esc clears`;
  }
  else if (editable() && machine().parts.length) {
    text = 'Shift-drag empty space to box-select · Shift-click to add or remove · Select all uses ⌘/Ctrl+A';
  }
  status.hidden = !text;
  status.textContent = text;
}

function cancelBoardInteraction({ clearSelection = true } = {}) {
  const capturedPointerIds = [partDrag?.pointerId, drag?.pointerId, marquee?.pointerId, boardPan?.pointerId]
    .filter((pointerId) => pointerId !== undefined);
  for (const pointerId of capturedPointerIds) {
    if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
  }
  setLevelMenu(false);
  armedTool = null;
  placementOrientation = 0;
  placementHover = null;
  hoverInspection = null;
  drag = null;
  partDrag = null;
  if (marquee && !clearSelection) {
    selection = partSelection(marquee.baseIds, marquee.basePrimaryId);
  }
  marquee = null;
  interactionNotice = '';
  boardPan = null;
  boardScroll.classList.remove('panning');
  if (clearSelection) selection = null;
  renderPalette();
  renderBoard();
  renderInspector();
}

function sameInspection(a, b) {
  return a?.kind === b?.kind && a?.id === b?.id && a?.toolKind === b?.toolKind;
}

function setHoverInspection(next) {
  if (sameInspection(hoverInspection, next)) return;
  hoverInspection = next;
  renderInspector();
}

function inspectionAt(target) {
  const part = target.closest?.('[data-part]');
  if (part) return { kind: 'part', id: part.dataset.part };
  const wire = target.closest?.('[data-wire]');
  if (wire) return { kind: 'wire', id: wire.dataset.wire };
  return null;
}

function marqueePartIds(gesture) {
  const left = Math.min(gesture.startX, gesture.x);
  const right = Math.max(gesture.startX, gesture.x);
  const top = Math.min(gesture.startY, gesture.y);
  const bottom = Math.max(gesture.startY, gesture.y);
  return machine().parts
    .filter((part) => partFootprintCells(part).some((cell) =>
      cell.x * CELL < right && (cell.x + 1) * CELL > left &&
      cell.y * CELL < bottom && (cell.y + 1) * CELL > top))
    .map((part) => part.id);
}

svg.addEventListener('pointerdown', (e) => {
  if (e.button === 0) svg.focus({ preventScroll: true });
  if (e.button === 0) interactionNotice = '';
  // Shift-click belongs to multi-selection even when the pointer is directly
  // over a socket; let the click handler toggle the containing part instead
  // of beginning a routing gesture.
  if (e.button === 0 && e.shiftKey && e.target.closest('[data-part]')) return;
  const handle = e.target.closest('[data-wire-handle]');
  if (handle && editable() && e.button === 0) {
    const wire = playerWires.find((candidate) => candidate.id === handle.dataset.wire);
    if (wire) {
      const end = handle.dataset.wireHandle;
      const anchor = end === 'from' ? wire.to : wire.from;
      const { x, y } = svgXY(e);
      drag = {
        kind: 'retarget', wireId: wire.id, end, anchor, route: [], x, y, pointerId: e.pointerId,
      };
      svg.setPointerCapture(e.pointerId);
      renderBoard();
      e.preventDefault();
      return;
    }
  }
  const port = e.target.closest('[data-port-part]');
  if (port && editable() && e.button === 0 && (!armedTool || armedTool === WIRE_TOOL)) {
    const anchor = { part: port.dataset.portPart, port: port.dataset.portName };
    const dir = port.dataset.portDir;
    const taken = physicalPortOccupied(anchor, dir);
    if (!taken) {
      const { x, y } = svgXY(e);
      drag = {
        kind: 'new',
        end: dir === 'out' ? 'to' : dir === 'in' ? 'from' : 'either',
        anchor,
        route: [],
        x,
        y,
        pointerId: e.pointerId,
      };
      svg.setPointerCapture(e.pointerId);
      renderBoard();
      e.preventDefault();
      return;
    }
    interactionNotice = 'Cannot route: that physical port already has a track';
    renderBoard();
    e.preventDefault();
    return;
  }
  const part = e.target.closest('[data-part]');
  const pressedPart = part ? byId(machine(), part.dataset.part) : null;
  const movable = pressedPart && (playerParts.some((candidate) => candidate.id === pressedPart.id) ||
    pressedPart.kind === 'quill' || pressedPart.kind === 'resonator');
  if (movable && editable() && !armedTool && e.button === 0) {
    const placed = pressedPart;
    const { x, y } = svgXY(e);
    const ids = isPartSelected(placed.id) ? selectedPartIds() : [placed.id];
    partDrag = {
      pointerId: e.pointerId,
      id: placed.id,
      ids,
      primaryId: placed.id,
      startX: x,
      startY: y,
      offsetX: Math.floor(x / CELL) - placed.x,
      offsetY: Math.floor(y / CELL) - placed.y,
      originX: placed.x,
      originY: placed.y,
      x: placed.x,
      y: placed.y,
      moved: false,
    };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const interactive = e.target.closest('[data-part], [data-wire], [data-word]');
  if (e.shiftKey && !interactive && editable() && !armedTool && e.button === 0) {
    const { x, y } = svgXY(e);
    marquee = {
      pointerId: e.pointerId,
      startX: x,
      startY: y,
      x,
      y,
      moved: false,
      baseIds: selectedPartIds(),
      basePrimaryId: selection?.kind === 'parts' ? selection.primaryId : null,
    };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const canGrab = e.button === 1 || (!interactive && !armedTool && e.button === 0);
  if (canGrab) {
    boardPan = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: boardScroll.scrollLeft,
      top: boardScroll.scrollTop,
      moved: false,
    };
    svg.setPointerCapture(e.pointerId);
    boardScroll.classList.add('panning');
    e.preventDefault();
  }
});

svg.addEventListener('pointermove', (e) => {
  if (!boardPan && !drag && !partDrag && !marquee) setHoverInspection(inspectionAt(e.target));
  if (partDrag?.pointerId === e.pointerId) {
    const point = svgXY(e);
    if (Math.hypot(point.x - partDrag.startX, point.y - partDrag.startY) > 4) partDrag.moved = true;
    if (partDrag.moved) {
      const x = Math.floor(point.x / CELL) - partDrag.offsetX;
      const y = Math.floor(point.y / CELL) - partDrag.offsetY;
      if (partDrag.x !== x || partDrag.y !== y) {
        partDrag.x = x;
        partDrag.y = y;
        scheduleBoardRender();
      }
    }
    e.preventDefault();
    return;
  }
  if (marquee?.pointerId === e.pointerId) {
    const point = svgXY(e);
    marquee.x = point.x;
    marquee.y = point.y;
    if (Math.hypot(point.x - marquee.startX, point.y - marquee.startY) > 4) marquee.moved = true;
    if (marquee.moved) {
      const hits = marqueePartIds(marquee);
      selection = partSelection(
        [...marquee.baseIds, ...hits],
        hits.at(-1) ?? marquee.basePrimaryId,
      );
      scheduleBoardRender();
    }
    e.preventDefault();
    return;
  }
  if (boardPan?.pointerId === e.pointerId) {
    const dx = e.clientX - boardPan.x;
    const dy = e.clientY - boardPan.y;
    if (Math.hypot(dx, dy) > 3) boardPan.moved = true;
    boardScroll.scrollLeft = boardPan.left - dx;
    boardScroll.scrollTop = boardPan.top - dy;
    e.preventDefault();
    return;
  }
  if (!drag && armedPartKind() && editable()) {
    const point = svgXY(e);
    const next = { x: Math.floor(point.x / CELL), y: Math.floor(point.y / CELL) };
    if (placementHover?.x !== next.x || placementHover?.y !== next.y) {
      placementHover = next;
      scheduleBoardRender();
    }
    return;
  }
  if (!drag || drag.pointerId !== e.pointerId) return;
  const { x, y } = svgXY(e);
  drag.x = x; drag.y = y;
  paintRouteGesture(drag, { x, y });
  scheduleBoardInteractionRender();
});

svg.addEventListener('pointerleave', () => {
  setHoverInspection(null);
  if (placementHover && !drag) {
    placementHover = null;
    renderBoard();
  }
});

// Dropping a wire anywhere on a part snaps to that part's nearest free compatible port -
// the port circles are too small to demand a direct hit, and a drop that
// silently creates nothing looks identical to a wire that exists.
function snapPort(partId, pt, dir) {
  const m = machine();
  const part = byId(m, partId);
  const ports = [...new Set(dir === 'in' ? PORTS[part.kind].ins : PORTS[part.kind].outs)]
    .filter((port) => {
      const physicalDir = portGeometry(part, port)?.dir;
      return physicalDir === dir || physicalDir === 'both';
    })
    .filter((port) => !physicalPortOccupied(
      { part: partId, port }, dir, drag?.wireId ?? null,
    ));
  if (!ports.length) return null;
  let best = null, bestD = Infinity;
  for (const port of ports) {
    const pos = portPos(m, { part: partId, port });
    const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
    if (d < bestD) { bestD = d; best = port; }
  }
  return { part: partId, port: best };
}

const snapInPort = (partId, pt) => snapPort(partId, pt, 'in');
const snapOutPort = (partId, pt) => snapPort(partId, pt, 'out');

function snapEitherPort(partId, pt) {
  const m = machine();
  const part = byId(m, partId);
  const ports = [...new Set([...PORTS[part.kind].ins, ...PORTS[part.kind].outs])]
    .map((port) => ({ port, dir: portGeometry(part, port)?.dir }))
    .filter(({ port, dir }) => dir && !physicalPortOccupied(
      { part: partId, port }, dir, drag?.wireId ?? null,
    ));
  let best = null, bestD = Infinity;
  for (const candidate of ports) {
    const pos = portPos(m, { part: partId, port: candidate.port });
    const distance = Math.hypot(pos.x - pt.x, pos.y - pt.y);
    if (distance < bestD) {
      bestD = distance;
      best = { ref: { part: partId, port: candidate.port }, dir: candidate.dir };
    }
  }
  return best;
}

svg.addEventListener('pointerup', (e) => {
  if (partDrag?.pointerId === e.pointerId) {
    const gesture = partDrag;
    const movement = partDragEdit();
    partDrag = null;
    selection = partSelection(gesture.moved ? gesture.ids : [gesture.id], gesture.primaryId);
    if (!gesture.moved) {
      playTerminalWord(byId(machine(), gesture.id));
    }
    // Pointer capture retargets the generated click to the SVG root. Suppress
    // that click so a stationary press selects instead of immediately clearing.
    suppressPartClick = true;
    setTimeout(() => { suppressPartClick = false; }, 0);
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    if (gesture.moved && movement?.valid) {
      const changed = moveParts(
        gesture.ids,
        gesture.x - gesture.originX,
        gesture.y - gesture.originY,
        gesture.primaryId,
      );
      if (!changed) { renderBoard(); renderInspector(); }
    } else {
      if (gesture.moved && !movement?.valid) interactionNotice = `Cannot move: ${movement.reason}`;
      renderBoard(); renderInspector();
    }
    e.preventDefault();
    return;
  }
  if (marquee?.pointerId === e.pointerId) {
    marquee = null;
    suppressPartClick = true;
    setTimeout(() => { suppressPartClick = false; }, 0);
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    renderBoard();
    renderInspector();
    e.preventDefault();
    return;
  }
  if (boardPan?.pointerId === e.pointerId) {
    justPanned = boardPan.moved;
    boardPan = null;
    boardScroll.classList.remove('panning');
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    if (justPanned) setTimeout(() => { justPanned = false; }, 0);
    e.preventDefault();
    return;
  }
  if (!drag || drag.pointerId !== e.pointerId) return;
  const gesture = drag;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const port = el?.closest?.('[data-port-part]');
  const pt = svgXY(e);
  paintRouteGesture(gesture, pt);
  const wantedDir = gesture.end === 'from' ? 'out' : gesture.end === 'to' ? 'in' : null;
  let target = null;
  let targetDir = null;
  const droppedPortDir = port?.dataset.portDir ?? null;
  if (port && (!wantedDir || droppedPortDir === wantedDir || droppedPortDir === 'both')) {
    target = { part: port.dataset.portPart, port: port.dataset.portName };
    targetDir = droppedPortDir;
  } else {
    const partEl = el?.closest?.('[data-part]');
    const cell = { x: Math.floor(pt.x / CELL), y: Math.floor(pt.y / CELL) };
    const cellPart = machine().parts.find((candidate) =>
      partFootprintCells(candidate).some((occupied) => sameGridCell(occupied, cell)));
    const targetId = partEl?.dataset.part ?? cellPart?.id;
    if (targetId && gesture.end === 'either') {
      const snapped = snapEitherPort(targetId, pt);
      target = snapped?.ref ?? null;
      targetDir = snapped?.dir ?? null;
    } else if (targetId) {
      target = wantedDir === 'in' ? snapInPort(targetId, pt) : snapOutPort(targetId, pt);
      targetDir = wantedDir;
    }
  }
  drag = null;
  if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  let changed = false;
  if (target) {
    if (gesture.kind === 'new') {
      const end = gesture.end === 'either'
        ? targetDir === 'out' ? 'from' : 'to'
        : gesture.end;
      changed = end === 'to'
        ? addWire(gesture.anchor, target, gesture.route)
        : addWire(target, gesture.anchor, [...gesture.route].reverse());
    } else {
      changed = retargetWire(gesture.wireId, gesture.end, target, gesture.route);
    }
  }
  if (!changed) {
    interactionNotice ||= gesture.blockedReason
      ? `Cannot route: ${gesture.blockedReason}`
      : target ? 'Cannot route: that port or path is unavailable' : 'Cannot route: release on a compatible free port';
  }
  justWired = true;
  if (!changed) renderBoard();
  e.preventDefault();
});

svg.addEventListener('pointercancel', (e) => {
  if (partDrag?.pointerId === e.pointerId) {
    partDrag = null;
    renderBoard();
  }
  if (drag?.pointerId === e.pointerId) {
    drag = null;
    renderBoard();
  }
  if (marquee?.pointerId === e.pointerId) {
    selection = partSelection(marquee.baseIds, marquee.basePrimaryId);
    marquee = null;
    renderBoard();
    renderInspector();
  }
  if (boardPan?.pointerId !== e.pointerId) return;
  boardPan = null;
  boardScroll.classList.remove('panning');
});

boardShell.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  cancelBoardInteraction();
});

svg.addEventListener('click', (e) => {
  if (justPanned) return;
  if (suppressPartClick) { suppressPartClick = false; return; }
  if (justWired) { justWired = false; return; }
  // A goal pill plays its word: hear the seed or the target before building.
  // The click falls through to selection, so the part underneath still opens.
  const pill = e.target.closest('[data-word]');
  if (pill) playWord(pill.dataset.word, { spacing: 110, gain: 0.3 });
  const partEl = e.target.closest('[data-part]');
  const wireEl = e.target.closest('[data-wire]');
  if (armedPartKind() && editable()) {
    const { x, y } = svgXY(e);
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    const p = puzzle();
    const partTool = armedPartKind();
    const splice = spliceCandidateAtCell(machine(), partTool, gx, gy, placementOrientation);
    const candidate = {
      id: '__placement__', kind: partTool, x: gx, y: gy,
      orientation: placementOrientation,
    };
    const validity = placementValidity(machine().parts, candidate, playerWires);
    if ((validity.valid || splice) && remaining(partTool) > 0) {
      interactionNotice = '';
      placementHover = null;
      placePart(partTool, gx, gy, splice);
      return;
    }
    interactionNotice = `Cannot place: ${validity.reason}`;
  } else if (partEl) {
    if (e.shiftKey && editable()) togglePartSelection(partEl.dataset.part);
    else selection = partSelection([partEl.dataset.part], partEl.dataset.part);
  } else if (wireEl) {
    selection = { kind: 'wire', id: wireEl.dataset.wire };
  } else {
    selection = null;
  }
  renderBoard(); renderInspector();
});

$('palette').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]');
  if (!b) return;
  const kind = b.dataset.tool;
  const available = remaining(kind) > 0;
  if (discreteFrames && run && available) onResetRun();
  const canPlace = editable() && available;
  armedTool = canPlace && armedTool !== kind ? kind : null;
  interactionNotice = '';
  placementOrientation = 0;
  placementHover = null;
  selection = armedTool ? { kind: 'tool', toolKind: kind } : null;
  renderPalette(); renderBoard(); renderInspector();
});

$('palette').addEventListener('pointerover', (e) => {
  const tool = e.target.closest('[data-tool]');
  setHoverInspection(tool ? { kind: 'tool', toolKind: tool.dataset.tool } : null);
});
$('palette').addEventListener('pointerleave', () => setHoverInspection(null));

document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  const command = e.metaKey || e.ctrlKey;
  if (!typing && command && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redoEdit(); else undoEdit();
    return;
  }
  if (!typing && command && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redoEdit();
    return;
  }
  const boardFocused = document.activeElement === svg || document.activeElement === document.body;
  if (!typing && command && boardFocused && e.key.toLowerCase() === 'a' && editable()) {
    e.preventDefault();
    selectAllParts();
    return;
  }
  if (!typing && !command && boardFocused && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redoEdit(); else undoEdit();
    return;
  }
  if (!typing && !command && boardFocused && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redoEdit();
    return;
  }
  if (!typing && !command && !e.shiftKey && e.key === 'Tab') {
    e.preventDefault();
    onStepButton();
    return;
  }
  if (!typing && !command && (armedPartKind() || boardFocused) && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    if (armedPartKind()) {
      placementOrientation = (placementOrientation + 1) % 4;
      renderBoard();
      renderInspector();
      renderInteractionStatus();
    } else if (selectedPartIds().length === 1) {
      rotatePart(selection.primaryId);
    } else if (selectedPartIds().length > 1) {
      interactionNotice = 'Select one part to rotate it';
      renderBoard();
    }
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (run) onResetRun();
    else cancelBoardInteraction();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selection && boardFocused) {
    e.preventDefault();
    deleteSelection();
  }
});

$('run-button').addEventListener('click', onRunButton);
$('step-button').addEventListener('click', onStepButton);
$('reset-run').addEventListener('click', onResetRun);
$('undo-edit').addEventListener('click', undoEdit);
$('redo-edit').addEventListener('click', redoEdit);
$('clear-machine').addEventListener('click', () => {
  if (!editable() || (!playerParts.length && !playerWires.length && !placedTerminalCount())) return;
  applyEdit(() => {
    playerParts = [];
    playerWires = [];
    terminalPositions = REFERENCE_MODE
      ? Object.fromEntries(contractTerminals().map((part) => [part.id, null]))
      : {};
    placementHover = null;
    selection = null;
  });
});

document.querySelectorAll('[data-speed]').forEach((b) => {
  b.addEventListener('click', () => {
    speedIdx = Number(b.dataset.speed);
    if (timer) { stopTimer(); timer = setInterval(doTick, SPEEDS[speedIdx]); }
    renderTransport();
  });
});

$('case-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-case]');
  if (!tab) return;
  onResetRun();
  caseIndex = Number(tab.dataset.case);
  renderCases(); renderBoard(); renderInspector();
});

$('deck-prev').addEventListener('click', () => { walkIndex -= 1; renderDeck(); });
$('deck-next').addEventListener('click', () => { walkIndex += 1; renderDeck(); });
$('deck-toggle').addEventListener('click', () => { deckHidden = !deckHidden; renderDeck(); });
setMuted(save.muted ?? false);
setMusicOn(save.music ?? !(save.muted ?? false));
function renderMute() {
  $('mute-button').textContent = isMuted() ? '♪ off' : '♪ on';
  $('mute-button').classList.toggle('active', !isMuted());
}
$('mute-button').addEventListener('click', () => {
  setMuted(!isMuted());
  save.muted = isMuted();
  persist();
  renderMute();
});
renderMute();

function renderMusic() {
  $('music-button').textContent = isMusicOn() ? '♫ on' : '♫ off';
  $('music-button').classList.toggle('active', isMusicOn());
}
$('music-button').addEventListener('click', () => {
  setMusicOn(!isMusicOn());
  save.music = isMusicOn();
  persist();
  renderMusic();
});
renderMusic();

$('zoom-in').addEventListener('click', () => setZoom(zoom * 1.25));
$('zoom-out').addEventListener('click', () => setZoom(zoom / 1.25));
$('zoom-fit').addEventListener('click', fitBoardToContent);
window.addEventListener('resize', sizeBoard);
boardScroll.addEventListener('scroll', positionContextEditor, { passive: true });

$('prev-level').addEventListener('click', () => loadLevel(levelIndex - 1));
$('next-level').addEventListener('click', () => loadLevel(levelIndex + 1));
$('reference-architecture-select').addEventListener('change', (event) => {
  referenceArchitectureIndexes.set(puzzle().id, Number(event.currentTarget.value));
  loadLevel(levelIndex);
});
$('level-menu-toggle').addEventListener('click', () => {
  setLevelMenu($('level-nav').hidden);
});
$('level-menu-backdrop').addEventListener('click', () => setLevelMenu(false));
$('banner-next').addEventListener('click', () => {
  if (bannerAction?.kind === 'level') {
    loadLevel(bannerAction.index);
    return;
  }
  if (bannerAction?.kind === 'case') {
    const nextCase = bannerAction.index;
    onResetRun();
    caseIndex = nextCase;
    renderCases(); renderBoard(); renderInspector();
  }
});
$('banner-close').addEventListener('click', hideBanner);
$('level-nav').addEventListener('click', (e) => {
  const dot = e.target.closest('[data-level]');
  if (dot?.getAttribute('aria-disabled') !== 'true') loadLevel(Number(dot.dataset.level));
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.level-switcher')) setLevelMenu(false);
});

// Resume only into a level the current mode may open. Playtest/reference URLs
// may request a one-based level number for facilitator-led sessions without
// changing or pre-solving the player's campaign save.
{
  const requestedNumber = Number(QUERY.get('level'));
  const requestedId = UNLOCK_ALL_LEVELS && Number.isInteger(requestedNumber) && requestedNumber > 0
    ? LEVELS[requestedNumber - 1]?.id
    : save.levelId;
  loadLevel(initialLevelIndex(LEVELS, {
    solved: save.solved,
    requestedId,
    unlockAll: UNLOCK_ALL_LEVELS,
  }));
}
