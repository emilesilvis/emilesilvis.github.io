// Wolf Tone: the player shell. Renders the board, lets the player place and
// wire parts, and drives engine.mjs one tick at a time. All physics lives in
// engine.mjs; this file decides nothing about what a part does.

import {
  PORTS, KIND_NAMES, NOTES, defaultConfig, prettyWord, byId,
  wireTicks, measureScore, mergeBestScore, makeRun, stepRun, runCase,
} from './engine.mjs?v=0.8.6-1';
import { LEVELS, showsWalkthrough } from './levels.mjs?v=0.8.6-1';
import {
  canPlaceReference,
  initialLevelIndex,
  isLevelUnlocked,
  sessionMode,
} from './progression.mjs?v=0.8.6-1';
import { discreteTransitPosition, pointAlongPath, transitPosition } from './motion.mjs?v=0.8.6-1';
import {
  movementValidity,
  placementValidity,
  retargetWire as retargetWireEdit,
  spliceWire,
} from './board-layout.mjs?v=0.8.6-1';
import { commissionCaseSpec } from './commission.mjs?v=0.8.6-1';
import { drawStrungWord, drawWordCard } from './notation.mjs?v=0.8.6-1';
import { makeRecital, recordRecitalPass } from './recital.mjs?v=0.8.6-1';
import { wireLaneOffset } from './wire-routing.mjs?v=0.8.6-1';
import {
  playWord, playThud, playResolve, setMuted, isMuted,
  setSoundtrack, setMusicOn, isMusicOn,
} from './audio.mjs?v=0.8.6-1';

// Teaching and advanced levels show walkthrough decks; searched introductory
// commissions stay quiet in normal play. ?reference reveals every deck and
// places any shipped witness on request (see deckShown).

// The Godot score was written as a progression from workshop craft to the
// forbidden commission. The web campaign has more levels, so cues belong to
// chapters and continue playing when adjacent commissions share one.
const CHAPTER_MUSIC = {
  'I · Études': [
    '02-seasoning-the-wood.mp3',
    '03-tap-tone.mp3',
    '04-fitting-the-bridge.mp3',
  ],
  'II · Duets': ['05-sympathetic-strings.mp3'],
  'III · Sight-reading': ['06-binding.mp3'],
  'IV · Wolf notes': ['07-the-wolf-tone.mp3'],
  'V · Entanglements': ['09-bookmatched.mp3'],
  'VI · Tempo': ['08-winding.mp3'],
  'VII · Concerto': ['10-larger-inside.mp3'],
  'VIII · Journeymen': ['11-an-improper-commission.mp3'],
  'IX · Masterworks': ['12-the-workshop-at-rest.mp3'],
};
const GRADUATION_TRACK = '13-graduation.mp3';

const CELL = 64;
const SPEEDS = [600, 270, 150];
const NOTE_SPACING = [85, 48, 32];  // ms between a word's letters, per speed
const PROCESSING_DWELL = 0.48;       // nearly half a departure tick stays in the part
const SAVE_KEY = 'wolftone-proto-v1';
const BOARD_LAYOUT_VERSION = 2;
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ?reference loads every level with its hidden reference build already
// placed: a review mode for walking the campaign's answers. It is strictly
// read-only about progress: persist() is a no-op under it, so browsing the
// answers can neither overwrite a player's saved machines nor mark levels
// solved. Anything run or edited in this mode evaporates on reload.
const QUERY = new URLSearchParams(location.search);
const SESSION_MODE = sessionMode(QUERY);
const REFERENCE_MODE = SESSION_MODE === 'reference';
const PLAYTEST_MODE = SESSION_MODE === 'playtest';
const UNLOCK_ALL_LEVELS = REFERENCE_MODE || PLAYTEST_MODE;

const $ = (id) => document.getElementById(id);
const svg = $('board');
const boardScroll = $('board-scroll');
const boardShell = document.querySelector('.board-shell');
let zoom = 1;
let transitAnimationFrame = null;
let discreteFrames = false;  // Step shows exact tick snapshots; Run restores tweening

// Fit is 100%. Higher zoom levels preserve square cells and use the board's
// own scroll container, so the surrounding bench never changes size.
function sizeBoard() {
  const p = puzzle();
  const W = p.board.cols * CELL, H = p.board.rows * CELL;
  const fit = Math.min(boardScroll.clientWidth / W, boardScroll.clientHeight / H);
  svg.style.width = `${W * fit * zoom}px`;
  svg.style.height = `${H * fit * zoom}px`;
  $('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
  boardScroll.classList.toggle('can-pan', zoom > 1);
  requestAnimationFrame(positionContextEditor);
}

function setZoom(next) {
  next = Math.max(1, Math.min(3, next));
  const factor = next / zoom;
  const cx = boardScroll.scrollLeft + boardScroll.clientWidth / 2;
  const cy = boardScroll.scrollTop + boardScroll.clientHeight / 2;
  zoom = next;
  sizeBoard();
  boardScroll.scrollLeft = cx * factor - boardScroll.clientWidth / 2;
  boardScroll.scrollTop = cy * factor - boardScroll.clientHeight / 2;
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
const save = { solved: [], machines: {}, bests: {}, ...loadSave() };
function persist() {
  if (REFERENCE_MODE) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
}

// Stable board families centre each authored board without changing relative
// distances. Translate older saved player parts once to keep their machines
// aligned with the newly centred fixed parts.
function migrateSavedBoardLayout() {
  const previousVersion = save.boardLayoutVersion ?? 0;
  if (previousVersion >= BOARD_LAYOUT_VERSION) return;
  for (const level of LEVELS) {
    const stored = save.machines[level.id];
    if (!stored?.parts?.length) continue;
    const next = level.boardMount.offset;
    // A very short-lived development build used the global 19×12 offset as
    // version 1. Correct it if that build ever reached localStorage.
    const previous = previousVersion === 1
      ? {
          x: Math.floor((19 - level.boardMount.source.cols) / 2),
          y: Math.floor((12 - level.boardMount.source.rows) / 2),
        }
      : { x: 0, y: 0 };
    stored.parts = stored.parts.map((part) => ({
      ...part,
      x: part.x + next.x - previous.x,
      y: part.y + next.y - previous.y,
    }));
  }
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
let caseIndex = 0;
let run = null;
let recital = null;
let timer = null;
let speedIdx = 0;
let selection = null;       // { kind: 'part'|'wire', id }
let hoverInspection = null; // temporary Inspector preview; click selection persists
let armedTool = null;       // part kind from palette
let placementHover = null;  // grid cell under an armed part ghost
let drag = null;            // new wire or endpoint retarget gesture
let justWired = false;
let partDrag = null;        // movable part gesture with an uncommitted grid preview
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

const puzzle = () => LEVELS[levelIndex];
const machine = () => ({ parts: [...puzzle().fixed, ...playerParts], wires: playerWires });
const currentCase = () => puzzle().cases[caseIndex];
const editable = () => !run;

function saveMachine() {
  save.machines[puzzle().id] = { parts: playerParts, wires: playerWires };
  save.levelId = puzzle().id;
  persist();
}

function editSnapshot() {
  return structuredClone({ parts: playerParts, wires: playerWires, selection });
}

function restoreSnapshot(snapshot) {
  const restored = structuredClone(snapshot);
  playerParts = restored.parts;
  playerWires = restored.wires;
  selection = restored.selection ?? null;
  armedTool = null;
  placementHover = null;
  drag = null;
  partDrag = null;
}

function finishEdit() {
  caseStatuses = puzzle().cases.map(() => null);
  verifiedRuns = null;
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
    const ref = puzzle().reference;
    playerParts = structuredClone(ref.parts).map((p) => ({ config: defaultConfig(p.kind), ...p }));
    playerWires = structuredClone(ref.wires).map((w, i2) => ({ id: `ref${i2}`, ...w }));
  } else {
    const stored = save.machines[puzzle().id];
    playerParts = structuredClone(stored?.parts ?? []);
    playerWires = structuredClone(stored?.wires ?? []);
  }
  caseIndex = 0;
  run = null;
  recital = null;
  selection = null;
  hoverInspection = null;
  armedTool = null;
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
  sizeBoard();
  boardScroll.scrollLeft = 0;
  boardScroll.scrollTop = 0;
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
    ? measureScore(machine(), { playerPartCount: playerParts.length, runs })
    : null;
  let newBestAxes = [];
  if (allPass && !REFERENCE_MODE) {
    const previousBest = save.bests[p.id] ?? null;
    newBestAxes = ['parts', 'wire', 'time'].filter((axis) =>
      previousBest?.[axis] == null || completedScore[axis] < previousBest[axis]);
    save.bests[p.id] = mergeBestScore(previousBest, completedScore);
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
      showBanner('sour', 'A sour note', run.detail, false);
      caseStatuses[caseIndex] = 'fail';
    } else {
      if (recital) { recital.paused = true; recital.failed = true; }
      const why = run.stalls.length
        ? run.stalls.map((s) => `${s.part}: ${s.reason}`).join(' · ')
        : run.detail;
      showBanner('silent', 'The machine went silent', why, false);
      caseStatuses[caseIndex] = 'fail';
    }
    renderCases();
  }
  renderBoard(); renderTransport(); renderLog();
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
    for (const axis of ['parts', 'wire', 'time']) {
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

function placedCount(kind) { return playerParts.filter((p) => p.kind === kind).length; }
function remaining(kind) { return (puzzle().palette[kind] ?? 0) - placedCount(kind); }

function nextWireId() {
  let n = 1;
  const taken = new Set(playerWires.map((wire) => wire.id));
  while (taken.has(`w${n}`)) n += 1;
  return `w${n}`;
}

function placePart(kind, x, y, spliceWireId = null) {
  applyEdit(() => {
    const id = nextId(kind);
    playerParts.push({ id, kind, x, y, config: defaultConfig(kind) });
    if (spliceWireId) {
      const ports = PORTS[kind];
      const spliced = spliceWire(
        playerWires, spliceWireId, id, ports.ins[0], ports.outs[0], nextWireId(),
      );
      if (spliced) playerWires = spliced;
    }
    if (remaining(kind) <= 0) armedTool = null;
    selection = { kind: 'part', id };
  });
}

function movePart(id, x, y) {
  const part = playerParts.find((candidate) => candidate.id === id);
  if (!part || (part.x === x && part.y === y)) return false;
  return applyEdit(() => {
    part.x = x;
    part.y = y;
    selection = { kind: 'part', id };
  });
}

function deleteSelection() {
  if (!selection || !editable()) return;
  if (selection.kind === 'part') {
    if (puzzle().fixed.some((p) => p.id === selection.id)) return;
    const id = selection.id;
    applyEdit(() => {
      playerParts = playerParts.filter((p) => p.id !== id);
      playerWires = playerWires.filter((w) => w.from.part !== id && w.to.part !== id);
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

function addWire(from, to) {
  const outTaken = playerWires.some((w) => w.from.part === from.part && w.from.port === from.port);
  if (outTaken) return false;
  return applyEdit(() => {
    playerWires.push({ id: nextWireId(), from, to });
    selection = { kind: 'wire', id: playerWires.at(-1).id };
  });
}

function retargetWire(wireId, end, nextRef) {
  const next = retargetWireEdit(playerWires, wireId, end, nextRef);
  if (!next) return false;
  const current = playerWires.find((wire) => wire.id === wireId)?.[end];
  if (current?.part === nextRef.part && current?.port === nextRef.port) return false;
  return applyEdit(() => {
    playerWires = next;
    selection = { kind: 'wire', id: wireId };
  });
}

function placeReference() {
  if (!canPlaceReference(SESSION_MODE)) return;
  const ref = puzzle().reference;
  applyEdit(() => {
    playerParts = structuredClone(ref.parts).map((p) => ({ config: defaultConfig(p.kind), ...p }));
    playerWires = structuredClone(ref.wires).map((w, i) => ({ id: `ref${i}`, ...w }));
    selection = null;
    armedTool = null;
    placementHover = null;
  });
}

// ── geometry ─────────────────────────────────────────────

function portPos(m, ref) {
  const part = byId(m, ref.part);
  const def = PORTS[part.kind];
  const cx = part.x * CELL + CELL / 2;
  const cy = part.y * CELL + CELL / 2;
  const dir = def.ins.includes(ref.port) ? 'in' : 'out';
  const list = dir === 'in' ? def.ins : def.outs;
  const i = list.indexOf(ref.port);
  const spacing = list.length > 2 ? 12 : 16;
  return {
    x: dir === 'in' ? cx - 28 : cx + 28,
    y: cy + (i - (list.length - 1) / 2) * spacing,
    dir,
  };
}

function wirePoints(m, w) {
  const a = portPos(m, w.from);
  const b = portPos(m, w.to);
  const lane = wireLaneOffset(m.wires, w);
  if (w.from.part === w.to.part) {
    return [a, { x: a.x + 18, y: a.y }, { x: a.x + 18, y: a.y - 44 + lane },
      { x: b.x - 18, y: a.y - 44 + lane }, { x: b.x - 18, y: b.y }, b];
  }
  if (b.x - a.x >= 30) {
    const midX = (a.x + b.x) / 2 + lane;
    return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
  }
  const dropY = Math.max(a.y, b.y) + 46 + lane;
  return [a, { x: a.x + 16, y: a.y }, { x: a.x + 16, y: dropY },
    { x: b.x - 16, y: dropY }, { x: b.x - 16, y: b.y }, b];
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

// Only a one-input/one-output mechanism has an unambiguous automatic splice.
// When two strings cross the same cell, neither wins: select and retarget the
// intended wire explicitly instead of letting placement guess.
function spliceCandidateAtCell(m, kind, x, y) {
  const ports = PORTS[kind];
  if (ports.ins.length !== 1 || ports.outs.length !== 1) return null;
  const point = { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 };
  const candidates = m.wires.map((wire) => {
    const points = wirePoints(m, wire);
    const distance = Math.min(...points.slice(1).map((end, index) =>
      pointToSegmentDistance(point, points[index], end)));
    return { wire, distance };
  }).filter(({ distance }) => distance <= 14).sort((a, b) => a.distance - b.distance);
  if (!candidates.length || (candidates[1] && candidates[1].distance - candidates[0].distance < 4)) return null;
  return candidates[0].wire;
}

// An outgoing word first appears over the working area of the part that made
// it, then moves through that part's output port and onto the wire. Paired
// mechanisms get separate seats so their simultaneous words remain legible.
function processingPoint(m, wire) {
  const part = byId(m, wire.from.part);
  const x = part.x * CELL + CELL / 2;
  const y = part.y * CELL + CELL / 2;
  if (part.kind === 'splitter') return { x, y: y + (wire.from.port === 'head' ? -13 : 13) };
  if (part.kind === 'coupling') return { x, y: y + (wire.from.port.startsWith('outA') ? -13 : 13) };
  return { x, y };
}

const toPath = (pts) => 'M ' + pts.map((p) => `${p.x} ${p.y}`).join(' L ');

const TONE_FREQUENCIES = { A: 440, B: 493.88, C: 523.25, D: 587.33 };
const TONE_COLORS = { A: '#e16d5c', B: '#72b8d5', C: '#e8c95f', D: '#99bc78' };

function sampleWire(points, count = 72) {
  const segments = points.slice(1).map((point, index) => ({
    start: points[index],
    end: point,
    length: Math.hypot(point.x - points[index].x, point.y - points[index].y),
  }));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0) || 1;
  return Array.from({ length: count + 1 }, (_, index) => {
    const target = total * index / count;
    let passed = 0;
    let segment = segments.at(-1);
    for (const candidate of segments) {
      segment = candidate;
      if (passed + candidate.length >= target) break;
      passed += candidate.length;
    }
    const progress = segment.length ? Math.max(0, Math.min(1, (target - passed) / segment.length)) : 0;
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const length = segment.length || 1;
    return {
      x: segment.start.x + dx * progress,
      y: segment.start.y + dy * progress,
      nx: -dy / length,
      ny: dx / length,
      progress: index / count,
    };
  });
}

function vibrationPath(samples, note, phase, amplitude) {
  const ratio = (TONE_FREQUENCIES[note] ?? TONE_FREQUENCIES.A) / TONE_FREQUENCIES.A;
  return samples.map((sample, index) => {
    const envelope = Math.sin(Math.PI * sample.progress);
    const wave = Math.sin(Math.PI * 4 * ratio * sample.progress + phase) * amplitude * envelope;
    return `${index ? 'L' : 'M'}${(sample.x + sample.nx * wave).toFixed(2)} ${(sample.y + sample.ny * wave).toFixed(2)}`;
  }).join(' ');
}

function drawWireVibration(points, word, wireId) {
  if (!word || !timer || discreteFrames || REDUCED_MOTION) return '';
  const notes = [...word].slice(0, 6);
  if (!notes.length) return '';
  const samples = sampleWire(points);
  const frames = [];
  const colors = [];
  for (const note of notes) {
    for (const [phase, amplitude] of [[0, 0.5], [Math.PI / 2, 2.1], [Math.PI, 1.25], [Math.PI * 1.5, 0.45]]) {
      frames.push(vibrationPath(samples, note, phase, amplitude));
      colors.push(TONE_COLORS[note]);
    }
  }
  frames.push(vibrationPath(samples, notes.at(-1), Math.PI * 2, 0));
  colors.push(TONE_COLORS[notes.at(-1)]);
  const duration = Math.max(420, notes.length * NOTE_SPACING[speedIdx] + 360);
  return `<g class="wire-vibration" data-vibration-wire="${wireId}" data-vibration-word="${word}">` +
    `<path class="wire-vibration-glow" d="${frames[0]}"></path>` +
    `<path class="wire-vibration-string" d="${frames[0]}" stroke="${colors[0]}">` +
    `<animate attributeName="d" values="${frames.join(';')}" dur="${duration}ms" fill="freeze"></animate>` +
    `<animate attributeName="stroke" values="${colors.join(';')}" dur="${duration}ms" fill="freeze"></animate>` +
    '</path></g>';
}

function svgXY(e) {
  const r = svg.getBoundingClientRect();
  const p = puzzle();
  const W = p.board.cols * CELL, H = p.board.rows * CELL;
  const scale = Math.min(r.width / W, r.height / H);
  const ox = (r.width - W * scale) / 2, oy = (r.height - H * scale) / 2;
  return { x: (e.clientX - r.left - ox) / scale, y: (e.clientY - r.top - oy) / scale };
}

// ── board rendering ──────────────────────────────────────

const PORT_LABELS = {
  unison: { lead: 'w', tail: 'v' },
  splitter: { head: 'w', rest: 'v' },
  fork: { left: 'L', right: 'R' },
  coupling: { inA: 'A', inB: 'B', outAL: 'AL', outAR: 'AR', outBL: 'BL', outBR: 'BR' },
};

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

// The Godot build made its parts from one small material kit rather than
// unrelated icons: pale carved bodies, rosewood mounts, turned brass, dark
// chambers, and taut strings. These compact SVG faces use the same grammar,
// but each silhouette is cut around the verb of the web game's nine parts.
// Palette and board both call this function so the tray always matches what
// lands on the bench.
function partFace(part, cx = 0, cy = 0, state = {}) {
  const config = { ...defaultConfig(part.kind), ...part.config };
  const stateClasses = [
    state.active && 'active', state.firing && 'firing', state.waiting && 'waiting',
    state.holding && 'holding', state.resolved && 'resolved',
    state.branch && `branch-${state.branch.toLowerCase()}`,
    ...(state.queuedPorts ?? []).map((port) => `queued-${port.toLowerCase()}`),
  ].filter(Boolean).join(' ');
  const cls = `part-face part-face-${part.kind}${stateClasses ? ` ${stateClasses}` : ''}`;
  const plate = (text, x = 0, y = 0, w = 22, extra = '') =>
    `<g class="face-plate ${extra}"><rect x="${x - w / 2}" y="${y - 6}" width="${w}" height="12" rx="2"></rect>` +
    `<text x="${x}" y="${y + 3.2}">${text}</text></g>`;
  const screw = (x, y, r = 2.2) =>
    `<circle class="face-screw-rim" cx="${x}" cy="${y}" r="${r + 1}"></circle>` +
    `<circle class="face-screw" cx="${x - 0.4}" cy="${y - 0.4}" r="${r}"></circle>`;
  const chamber = (x = 0, y = 0, r = 8, extra = '') =>
    `<circle class="face-chamber-rim ${extra}" cx="${x}" cy="${y}" r="${r + 3}"></circle>` +
    `<circle class="face-chamber ${extra}" cx="${x}" cy="${y}" r="${r}"></circle>`;
  let face = '';

  if (part.kind === 'quill') {
    face = `<path class="face-shadow" d="M-27-15 Q-10-25 8-17 L25-9 25 11 8 18 Q-10 25-27 15Z" transform="translate(0 2)"></path>` +
      `<path class="face-ivory" d="M-27-15 Q-10-25 8-17 L25-9 25 9 8 17 Q-10 25-27 15Z"></path>` +
      `<path class="face-grain" d="M-20-10 Q-6-16 9-11 M-21 10 Q-5 16 11 10"></path>` +
      `<path class="face-string" d="M-17 0H28"></path>` + screw(-16, 0, 4.2) +
      `<path class="face-brass-line quill-plucker" d="M-20-11 Q-7 0-20 11 M-10-15 Q2 0-10 15"></path>` +
      `<path class="face-arrow" d="M16-5 25 0 16 5Z"></path>`;
  } else if (part.kind === 'resonator') {
    face = `<path class="face-shadow" d="M-27-20H-16L26-11V11L-16 20H-27Z" transform="translate(0 2)"></path>` +
      `<path class="face-ivory" d="M-27-20H-16L26-11V11L-16 20H-27Z"></path>` +
      `<path class="face-string" d="M-30 0H-8"></path>` +
      `<path class="face-brass-bar" d="M-20-15V15"></path>` + chamber(4, 0, 8.5) +
      `<path class="face-pearl resonance-tongue" d="M0-4 Q4-9 8-4V4Q4 9 0 4Z"></path>` +
      screw(-20, -11) + screw(-20, 11);
  } else if (part.kind === 'damper') {
    face = `<rect class="face-shadow" x="-25" y="-12" width="50" height="24" rx="8" transform="translate(0 2)"></rect>` +
      `<rect class="face-rosewood" x="-25" y="-12" width="50" height="24" rx="8"></rect>` +
      `<path class="face-string" d="M-29 0H29"></path>` +
      `<ellipse class="face-ivory" cx="0" cy="0" rx="13" ry="16"></ellipse>` + chamber(0, 0, 5.5) +
      `<path class="face-brass-bar damper-arm" d="M0-19V19"></path>` + screw(0, -17, 2.8);
  } else if (part.kind === 'mould') {
    face = `<rect class="face-shadow" x="-27" y="-17" width="54" height="34" rx="15" transform="translate(0 2)"></rect>` +
      `<rect class="face-maple" x="-27" y="-17" width="54" height="34" rx="15"></rect>` +
      `<path class="face-string" d="M-30 0H30"></path>` + chamber(-9, 0, 6.5) +
      `<path class="face-brass-line mould-rake" d="M5-12V12 M11-12V12"></path>` +
      plate(`+${config.note}`, 15, 0, 19, 'mould-note') + screw(-20, -11) + screw(-20, 11);
  } else if (part.kind === 'unison') {
    face = `<path class="face-shadow" d="M-27-20Q-9-22-3-8Q2 0 27 0Q2 0-3 8Q-9 22-27 20L-19 0Z" transform="translate(0 2)"></path>` +
      `<path class="face-ivory" d="M-27-20Q-9-22-3-8Q2 0 27 0Q2 0-3 8Q-9 22-27 20L-19 0Z"></path>` +
      `<path class="face-string" d="M-30-16Q-9-16-2-5Q5 0 30 0M-30 16Q-9 16-2 5Q5 0 30 0"></path>` +
      `<circle class="unison-seat lead" cx="-18" cy="-12" r="4"></circle>` +
      `<circle class="unison-seat tail" cx="-18" cy="12" r="4"></circle>` +
      `<path class="face-brass-line unison-carriage" d="M-15-12V12M-20 0H5"></path>` +
      chamber(-9, 0, 6.8) + screw(-21, -13) + screw(-21, 13) + screw(23, 0, 3);
  } else if (part.kind === 'splitter') {
    face = `<path class="face-shadow" d="M-27-15L9-20 27-12 27 12 9 20-27 15Z" transform="translate(0 2)"></path>` +
      `<path class="face-ivory" d="M-27-15L9-20 27-12 27 12 9 20-27 15Z"></path>` +
      `<path class="face-string" d="M-30 0H-5Q7 0 28-16M-5 0Q7 0 28 16"></path>` + chamber(-7, 0, 5.8) +
      `<path class="face-brass-line splitter-blade" d="M-6-17 7 0-6 17"></path>` +
      plate(`k${config.k}`, 11, 0, 17) +
      `<path class="face-arrow" d="M20-20 28-16 20-12ZM20 12 28 16 20 20Z"></path>`;
  } else if (part.kind === 'fork') {
    const mode = config.mode === 'consume' ? '×' : '◇';
    face = `<rect class="face-shadow" x="-26" y="-18" width="52" height="36" rx="12" transform="translate(0 2)"></rect>` +
      `<rect class="face-rosewood" x="-26" y="-18" width="52" height="36" rx="12"></rect>` +
      `<path class="face-string" d="M-30 0H-12M7-7Q15-12 29-14M7 7Q15 12 29 14"></path>` +
      `<path class="face-brass-line fork-tines" d="M-10 0H5M5 0V-12M5 0V12M5-12H19M5 12H19"></path>` +
      screw(-12, 0, 5.2) + plate(`${config.note}${mode}`, 13, 0, 20);
  } else if (part.kind === 'coupling') {
    face = `<path class="face-shadow" d="M-24-22H12L25-12V12L12 22H-24Z" transform="translate(0 2)"></path>` +
      `<path class="face-ivory" d="M-24-22H12L25-12V12L12 22H-24Z"></path>` +
      `<path class="face-string" d="M-30-15H-8Q3-15 17 15M-30 15H-8Q3 15 17-15"></path>` +
      chamber(-6, -10, 4.8, 'coupling-seat-a') + chamber(-6, 10, 4.8, 'coupling-seat-b') +
      `<text class="coupling-seat-letter" x="-6" y="-7.5">A</text>` +
      `<text class="coupling-seat-letter" x="-6" y="12.5">B</text>` +
      `<circle class="face-jewel" cx="6" cy="0" r="4"></circle>` +
      `<path class="face-brass-line coupling-cross" d="M2-5 10 5M2 5 10-5"></path>` +
      `<path class="face-brass-line coupling-gates" d="M14-16V-7M14 7V16"></path>`;
  } else if (part.kind === 'valve') {
    face = `<rect class="face-shadow" x="-26" y="-13" width="52" height="26" rx="9" transform="translate(0 2)"></rect>` +
      `<rect class="face-rosewood" x="-26" y="-13" width="52" height="26" rx="9"></rect>` +
      `<path class="face-string" d="M-30 0H30"></path>` +
      `<circle class="face-brass" cx="0" cy="0" r="17"></circle>` +
      `<circle class="face-ivory" cx="0" cy="0" r="11"></circle>` + chamber(0, 0, 5) +
      `<path class="face-brass-line valve-wheel" d="M0-15V15M-15 0H15M-11-11 11 11M11-11-11 11"></path>` +
      plate(`${state.countdown ?? config.delay}t`, 18, -13, 16, 'valve-countdown');
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
      const pos = transitPosition(
        motion.points, motion.from, motion.to, elapsed, motion.duration, motion.dwellFraction,
      );
      node.setAttribute('transform', `translate(${pos.x} ${pos.y})`);
      if (elapsed < motion.duration) unfinished = true;
    }
    if (unfinished) transitAnimationFrame = requestAnimationFrame(frame);
    else transitAnimationFrame = null;
  };
  transitAnimationFrame = requestAnimationFrame(frame);
}

function renderBoard() {
  const p = puzzle();
  const baseMachine = machine();
  const movePreview = partDrag?.moved
    ? {
        x: partDrag.x,
        y: partDrag.y,
        validity: movementValidity(
          baseMachine.parts, p.board, partDrag.id, partDrag.x, partDrag.y,
        ),
      }
    : null;
  const m = movePreview?.validity.valid
    ? {
        parts: baseMachine.parts.map((part) => part.id === partDrag.id
          ? { ...part, x: movePreview.x, y: movePreview.y }
          : part),
        wires: baseMachine.wires,
      }
    : baseMachine;
  const splicePreview = armedTool && placementHover && editable()
    ? spliceCandidateAtCell(m, armedTool, placementHover.x, placementHover.y)
    : null;
  const kase = currentCase();
  const W = p.board.cols * CELL, H = p.board.rows * CELL;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.classList.toggle('discrete', discreteFrames);
  svg.classList.toggle('running', Boolean(timer) && !discreteFrames && !REDUCED_MOTION);
  svg.style.setProperty('--tick-ms', `${SPEEDS[speedIdx]}ms`);
  const transitMotions = [];
  let s = `<defs>
    <linearGradient id="board-walnut" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#392719"></stop><stop offset="0.48" stop-color="#2c1c11"></stop><stop offset="1" stop-color="#1d120b"></stop>
    </linearGradient>
    <radialGradient id="board-lamp" cx="48%" cy="38%" r="68%">
      <stop offset="0" stop-color="#8d6330" stop-opacity=".17"></stop><stop offset="1" stop-color="#0c0906" stop-opacity=".2"></stop>
    </radialGradient>
  </defs>`;
  s += `<rect class="board-wood" width="${W}" height="${H}" rx="3"></rect>`;
  s += `<rect class="board-lamplight" width="${W}" height="${H}" rx="3"></rect>`;
  for (let gy = 12; gy < H; gy += 23) {
    const bend = ((gy / 23) % 3 - 1) * 5;
    s += `<path class="board-grain" d="M0 ${gy} Q${W * 0.32} ${gy + bend} ${W * 0.57} ${gy - bend} T${W} ${gy + bend * 0.4}"></path>`;
  }
  for (let gx = 1; gx < p.board.cols; gx += 1) {
    s += `<line class="grid-line" x1="${gx * CELL}" y1="0" x2="${gx * CELL}" y2="${H}"></line>`;
  }
  for (let gy = 1; gy < p.board.rows; gy += 1) {
    s += `<line class="grid-line" x1="0" y1="${gy * CELL}" x2="${W}" y2="${gy * CELL}"></line>`;
  }
  for (let gx = 0; gx <= p.board.cols; gx += 1) {
    for (let gy = 0; gy <= p.board.rows; gy += 1) {
      s += `<circle class="grid-pin-shadow" cx="${gx * CELL}" cy="${gy * CELL + 1}" r="2.4"></circle>`;
      s += `<circle class="grid-pin" cx="${gx * CELL}" cy="${gy * CELL}" r="1.8"></circle>`;
    }
  }
  s += `<rect class="board-binding" x="4" y="4" width="${W - 8}" height="${H - 8}" rx="2"></rect>`;

  let wireHandles = '';
  m.wires.forEach((w, wireIndex) => {
    const pts = wirePoints(m, w);
    const d = toPath(pts);
    const selected = selection?.kind === 'wire' && selection.id === w.id;
    const sel = selected ? ' selected' : '';
    const spliceTarget = splicePreview?.id === w.id ? ' splice-target' : '';
    s += `<path class="wire-bed" d="${d}"></path>`;
    s += `<path class="wire-hit" data-wire="${w.id}" d="${d}"></path>`;
    const route = run && byId(m, w.from.part)?.kind === 'coupling'
      ? w.from.port.startsWith('outA') ? ' route-a' : ' route-b'
      : '';
    const liveItem = run?.transit.find((item) => item.wireIndex === wireIndex);
    const live = liveItem ? ' live-route' : '';
    s += `<path class="wire${sel}${route}${live}${spliceTarget}" data-wire="${w.id}" d="${d}"></path>`;
    if (liveItem) s += drawWireVibration(pts, liveItem.word, w.id);
    const mid = pointAlongPath(pts, 0.5);
    const ticks = wireTicks(m, w);
    s += `<rect class="wire-chip-box" x="${mid.x - 8}" y="${mid.y - 6}" width="16" height="12" rx="3"></rect>`;
    s += `<text class="wire-chip" x="${mid.x}" y="${mid.y + 3}">${ticks}</text>`;
    if (selected && editable()) {
      const from = portPos(m, w.from);
      const to = portPos(m, w.to);
      wireHandles += `<circle class="wire-handle-hit" data-wire-handle="from" data-wire="${w.id}" cx="${from.x}" cy="${from.y}" r="16"></circle>`;
      wireHandles += `<circle class="wire-handle from" data-wire-handle="from" data-wire="${w.id}" cx="${from.x}" cy="${from.y}" r="7"></circle>`;
      wireHandles += `<circle class="wire-handle-hit" data-wire-handle="to" data-wire="${w.id}" cx="${to.x}" cy="${to.y}" r="16"></circle>`;
      wireHandles += `<circle class="wire-handle to" data-wire-handle="to" data-wire="${w.id}" cx="${to.x}" cy="${to.y}" r="7"></circle>`;
    }
  });

  if (drag) {
    const anchor = portPos(m, drag.anchor);
    const start = drag.end === 'from' ? { x: drag.x, y: drag.y } : anchor;
    const end = drag.end === 'from' ? anchor : { x: drag.x, y: drag.y };
    s += `<path class="temp-wire" d="M ${start.x} ${start.y} L ${end.x} ${end.y}"></path>`;
  }

  for (const part of m.parts) {
    const cx = part.x * CELL + CELL / 2;
    const cy = part.y * CELL + CELL / 2;
    const fixed = p.fixed.some((f) => f.id === part.id);
    const sel = selection?.kind === 'part' && selection.id === part.id ? ' selected' : '';
    const moving = partDrag?.moved && partDrag.id === part.id ? ' moving' : '';
    const coupling = part.kind === 'coupling' ? couplingFeedback(part, m) : null;
    s += `<g data-part="${part.id}" class="${fixed ? 'fixed-part' : 'movable-part'}">`;
    if (fixed) {
      s += `<rect class="fixture-gutter" x="${cx - 35}" y="${cy - 32}" width="70" height="77" rx="12"></rect>`;
      s += `<rect class="fixture-gutter-inner" x="${cx - 31}" y="${cy - 28}" width="62" height="69" rx="9"></rect>`;
    }
    s += `<rect class="part-box${fixed ? ' fixed' : ''}${sel}${moving}${coupling ? ' coupling-active' : ''}" x="${cx - 29}" y="${cy - 25}" width="58" height="50" rx="9"></rect>`;
    s += partFace(part, cx, cy, partVisualState(part, m));
    s += `<rect class="part-nameplate" x="${cx - 24}" y="${cy + 27}" width="48" height="11" rx="2"></rect>`;
    s += `<text class="part-name" x="${cx}" y="${cy + 35}">${part.label ?? KIND_NAMES[part.kind].toLowerCase()}</text>`;

    const def = PORTS[part.kind];
    for (const port of [...def.ins, ...def.outs]) {
      const pos = portPos(m, { part: part.id, port });
      let routeClass = '';
      if (part.kind === 'coupling') {
        if (port === 'inB' || port.startsWith('outA')) routeClass = ' route-family route-a';
        if (port === 'inA' || port.startsWith('outB')) routeClass = ' route-family route-b';
        if (coupling) {
          if (port === 'inB' && coupling.wordB !== undefined) routeClass += ' route-source';
          if (port === 'inA' && coupling.wordA !== undefined) routeClass += ' route-source';
          if (port === coupling.outA || port === coupling.outB) routeClass += ' route-selected';
        }
      }
      s += `<circle class="port ${pos.dir}${routeClass}" data-port-part="${part.id}" data-port-name="${port}" data-port-dir="${pos.dir}" cx="${pos.x}" cy="${pos.y}" r="4.5"></circle>`;
      s += `<circle class="port-hit" data-port-part="${part.id}" data-port-name="${port}" data-port-dir="${pos.dir}" cx="${pos.x}" cy="${pos.y}" r="12" fill="transparent"></circle>`;
      const lbl = PORT_LABELS[part.kind]?.[port];
      if (lbl) s += `<text class="port-label" x="${pos.x + (pos.dir === 'in' ? 9 : -9)}" y="${pos.y + 2.5}">${lbl}</text>`;
    }

    if (part.kind === 'quill') {
      const seed = kase.seeds[part.id];
      if (seed !== undefined) s += `<g class="goal-word" data-word="${seed}">${drawWordCard(cx, cy - 34, seed)}</g>`;
    }
    if (part.kind === 'resonator') {
      const want = kase.targets[part.id];
      if (want !== undefined) s += `<g class="goal-word" data-word="${want}">${drawWordCard(cx, cy - 34, want)}</g>`;
      else s += `<text class="resonator-silent" x="${cx}" y="${cy - 30}">stay silent</text>`;
      if (run?.satisfied[part.id] !== undefined) {
        s += `<circle class="satisfied-ring" cx="${cx}" cy="${cy}" r="33"></circle>`;
      }
    }
    s += '</g>';
  }

  s += wireHandles;

  if (movePreview && !movePreview.validity.valid) {
    const part = baseMachine.parts.find((candidate) => candidate.id === partDrag.id);
    const cx = movePreview.x * CELL + CELL / 2;
    const cy = movePreview.y * CELL + CELL / 2;
    s += `<g class="movement-ghost blocked" aria-label="${movePreview.validity.reason}">`;
    s += `<rect class="part-box" x="${cx - 29}" y="${cy - 25}" width="58" height="50" rx="9"></rect>`;
    s += partFace(part, cx, cy);
    s += '</g>';
  }

  if (armedTool && placementHover && editable()) {
    const { x, y } = placementHover;
    const validity = placementValidity(m.parts, p.board, x, y);
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;
    const preview = { id: '__placement__', kind: armedTool, x, y, config: defaultConfig(armedTool) };
    s += `<g class="placement-ghost ${validity.valid ? 'valid' : 'blocked'}${splicePreview ? ' splice' : ''}" ` +
      `data-placement-valid="${validity.valid}" aria-label="${validity.reason ?? (splicePreview ? 'Insert into wire' : 'Valid placement')}">`;
    s += `<rect class="part-box" x="${cx - 29}" y="${cy - 25}" width="58" height="50" rx="9"></rect>`;
    s += partFace(preview, cx, cy);
    s += `<rect class="part-nameplate" x="${cx - 24}" y="${cy + 27}" width="48" height="11" rx="2"></rect>`;
    s += `<text class="part-name" x="${cx}" y="${cy + 35}">${KIND_NAMES[armedTool].toLowerCase()}</text>`;
    s += '</g>';
  }

  if (run) {
    for (const [motionIndex, item] of run.transit.entries()) {
      const w = m.wires[item.wireIndex];
      const ticks = Math.max(1, item.arrive - item.depart);
      const from = Math.max(0, Math.min(1, (run.tick - item.depart) / ticks));
      const to = Math.max(from, Math.min(1, (run.tick - item.depart + 1) / ticks));
      const points = [processingPoint(m, w), ...wirePoints(m, w)];
      const motionId = `transit-${motionIndex}`;
      const duration = SPEEDS[speedIdx];
      const dwellFraction = item.depart === run.tick ? PROCESSING_DWELL : 0;
      if (discreteFrames) {
        const pos = discreteTransitPosition(points, from, to);
        s += `<g class="transit-word">${drawStrungWord(pos.x, pos.y, item.word)}</g>`;
      } else if (REDUCED_MOTION) {
        const pos = pointAlongPath(points, to);
        s += `<g class="transit-word">${drawStrungWord(pos.x, pos.y, item.word)}</g>`;
      } else {
        const start = transitPosition(points, from, to, 0, duration, dwellFraction);
        s += `<g class="transit-word${dwellFraction ? ' processing-word' : ''}" data-motion="${motionId}" transform="translate(${start.x} ${start.y})">` +
          `${drawStrungWord(0, 0, item.word)}</g>`;
        transitMotions.push({ id: motionId, points, from, to, duration, dwellFraction });
      }
    }
    for (const [partId, ports] of Object.entries(run.queues)) {
      const part = byId(m, partId);
      if (!part) continue;
      for (const [port, words] of Object.entries(ports)) {
        words.forEach((word, i) => {
          const pos = portPos(m, { part: partId, port });
          const routeClass = part.kind === 'coupling'
            ? port === 'inB' ? 'coupling-head route-a' : port === 'inA' ? 'coupling-head route-b' : ''
            : '';
          s += `<g class="${routeClass}">${drawStrungWord(pos.x - 34, pos.y - i * 16, word)}</g>`;
        });
      }
    }
    for (const h of run.holds) {
      const part = byId(m, h.part);
      s += drawStrungWord(part.x * CELL + CELL / 2, part.y * CELL + CELL / 2 - 34, h.word);
    }
  }

  svg.innerHTML = s;
  animateTransitWords(transitMotions);
  renderInteractionStatus();
  requestAnimationFrame(positionContextEditor);
}

// ── side panels ──────────────────────────────────────────

function renderCommissionTitle() {
  $('commission-title').innerHTML = `<h2>${puzzle().title}</h2>`;
}

// Teaching decks explain new parts. Advanced decks expose their observation,
// optional nudge and reference witness one step at a time. Searched drills stay
// quiet unless reference mode is explicitly reviewing every answer.
const deckShown = () => showsWalkthrough(puzzle(), { referenceMode: REFERENCE_MODE });

function renderDeck() {
  const p = puzzle();
  const panel = $('walkthrough-panel');
  panel.hidden = !deckShown();
  if (panel.hidden) {
    document.querySelectorAll('[data-region]').forEach((el) => el.classList.remove('spotlight'));
    return;
  }
  walkIndex = Math.max(0, Math.min(walkIndex, p.walkthrough.length - 1));
  const step = p.walkthrough[walkIndex];
  $('deck-body').hidden = deckHidden;
  $('deck-toggle').textContent = deckHidden ? 'show' : 'hide';
  $('deck-step').innerHTML = `<strong>${step.title}</strong><p>${step.body}</p>`;
  $('deck-counter').textContent = `${walkIndex + 1} / ${p.walkthrough.length}`;
  $('deck-prev').disabled = walkIndex === 0;
  $('deck-next').disabled = walkIndex === p.walkthrough.length - 1;
  $('deck-reference').hidden = !canPlaceReference(SESSION_MODE) || deckHidden || walkIndex !== p.walkthrough.length - 1;
  document.querySelectorAll('[data-region]').forEach((el) => {
    el.classList.toggle('spotlight', !deckHidden && el.dataset.region === step.focus);
  });
}

function renderCases() {
  const p = puzzle();
  $('case-tabs').innerHTML = p.cases.map((kase, i) => {
    const status = caseStatuses[i];
    const mark = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '·';
    const cls = status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : '';
    const spec = commissionCaseSpec(p, kase);
    const entries = (items) => items.map(({ label, word }) =>
      `<span>${label ? `<b>${label}:</b> ` : ''}${prettyWord(word)}</span>`).join('<span class="case-separator"> · </span>');
    return `<button class="case-tab${i === caseIndex ? ' current' : ''}" data-case="${i}">` +
      `<span class="status ${cls}">${mark}</span><span class="case-spec">` +
      `<strong class="case-name">${kase.name}</strong>` +
      `<span class="case-spec-row"><small>IN</small><span>${entries(spec.inputs)}</span></span>` +
      `<span class="case-spec-row"><small>OUT</small><span>${entries(spec.targets)}</span></span>` +
      `</span></button>`;
  }).join('');
}

function renderScore() {
  const score = measureScore(machine(), {
    playerPartCount: playerParts.length,
    runs: verifiedRuns,
  });
  const best = save.bests[puzzle().id];
  $('score-parts').textContent = score.parts;
  $('score-wire').textContent = score.wire;
  $('score-time').textContent = score.time ?? 'n/a';
  $('best-parts').textContent = best?.parts ?? 'n/a';
  $('best-wire').textContent = best?.wire ?? 'n/a';
  $('best-time').textContent = best?.time ?? 'n/a';
}

function renderPalette() {
  const p = puzzle();
  const kinds = Object.keys(p.palette);
  $('palette').innerHTML = kinds.length
    ? kinds.map((kind) => {
      const left = remaining(kind);
      const classes = [armedTool === kind && 'armed', left <= 0 && 'exhausted'].filter(Boolean).join(' ');
      return `<button data-tool="${kind}" aria-pressed="${armedTool === kind}" class="${classes}">` +
          `<svg class="palette-icon" viewBox="-32 -26 64 52" aria-hidden="true">` +
          `${partFace({ kind, config: defaultConfig(kind) })}</svg>` +
          `<span class="palette-name">${KIND_NAMES[kind]}</span><span class="count">×${left}</span></button>`;
      }).join('')
    : '<span class="count">no parts this level: just wires</span>';
  $('construction-help').textContent = run
    ? recital
      ? 'recital playing · Pause or Reset to edit'
      : 'the machine is frozen while a run is live'
    : armedTool
      ? 'ghost follows the board · click places · click again, right-click, or Esc cancels'
      : 'drag parts to move · drag port → port to wire · Del removes';
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
  $('clear-machine').disabled = !editable() || (!playerParts.length && !playerWires.length);
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

const PART_HELP = {
  quill: {
    rule: 'seed → out',
    body: 'Outputs the current performance’s seed word at tick 1.',
  },
  mould: {
    rule: 'w → w·a',
    body: 'Adds the selected note to the end of each word.',
  },
  damper: {
    rule: 'a·w → w',
    body: 'Removes the first note. An empty word waits.',
  },
  valve: {
    rule: 'w → w after n ticks',
    body: 'Outputs the word unchanged after the selected number of ticks.',
  },
  unison: {
    rule: '(w, v) → w·v',
    body: 'Waits for both inputs, then outputs the lead word followed by the tail word.',
  },
  splitter: {
    rule: 'w·v → (w, v), |w| = k',
    body: 'Sends the first k notes to head and the remaining notes to rest. Both outputs must be connected.',
  },
  fork: {
    rule: 'head = a ? left : right',
    body: 'Sends a word left when its first note matches. Otherwise it sends the word right. Bite removes a matching first note.',
  },
  coupling: {
    rule: 'each word routes by the other head',
    body: 'Waits for both inputs. Each word’s output is selected by the other word’s first note. Both words remain unchanged.',
  },
  resonator: {
    rule: 'w = target → accept',
    body: 'Accepts only the printed target word. A different word fails the performance. A resonator marked “stay silent” accepts no word.',
  },
};

function renderToolHelp(kind) {
  const help = PART_HELP[kind];
  const ports = PORTS[kind];
  const inputs = ports.ins.length ? ports.ins.join(', ') : 'none';
  const outputs = ports.outs.length ? ports.outs.join(', ') : 'none';
  $('selection-kind').textContent = 'PARTS TRAY';
  const hint = !editable()
    ? 'The performance is running. Placement is disabled.'
    : remaining(kind) <= 0
      ? 'No copies remain. Select one on the board to configure it.'
      : armedTool === kind
        ? 'Placement is active. Press Esc to cancel.'
        : 'Select to place this part.';
  $('inspector').innerHTML = `<div class="tool-inspection">` +
    `<svg viewBox="-34 -28 68 56" aria-hidden="true">${partFace({ kind, config: defaultConfig(kind) })}</svg>` +
    `<div><strong>${KIND_NAMES[kind]}</strong><code>${help.rule}</code><p class="prose">${help.body}</p></div></div>` +
    `<p class="tool-ports"><span>IN</span> ${inputs} <span>OUT</span> ${outputs}</p>` +
    `<p class="tool-hint">${hint}</p>`;
}

function partControlMarkup(part, fixed) {
  if (fixed) return '';
  let html = '';
  if (part.kind === 'mould') {
    html += `<div class="row"><span>output note</span>${noteChips(part.config.note, 'note')}</div>`;
  }
  if (part.kind === 'splitter') {
    html += `<div class="row"><span>position k</span><button data-k="-1" aria-label="Decrease split position">−</button>` +
      `<strong>${part.config.k}</strong><button data-k="1" aria-label="Increase split position">+</button></div>`;
  }
  if (part.kind === 'fork') {
    html += `<div class="row"><span>note</span>${noteChips(part.config.note, 'note')}</div>` +
      `<div class="row"><span>mode</span><button data-mode="peek" class="${part.config.mode === 'peek' ? 'active' : ''}">peek</button>` +
      `<button data-mode="consume" class="${part.config.mode === 'consume' ? 'active' : ''}">bite</button></div>`;
  }
  if (part.kind === 'coupling') {
    html += `<div class="coupling-choice route-a"><strong>B decides A</strong>` +
      `<span>head</span><div class="coupling-notes">${noteChips(part.config.noteA, 'note-a')}</div>` +
      `<span>A → <b>L</b> · else <b>R</b></span></div>` +
      `<div class="coupling-choice route-b"><strong>A decides B</strong>` +
      `<span>head</span><div class="coupling-notes">${noteChips(part.config.noteB, 'note-b')}</div>` +
      `<span>B → <b>L</b> · else <b>R</b></span></div>`;
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
    applyEdit(() => {
      const current = playerParts.find((candidate) => candidate.id === part.id);
      if (current) current.config[key] = value;
      selection = { kind: 'part', id: part.id };
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
  if (box.hidden || selection?.kind !== 'part') return;
  const node = svg.querySelector(`[data-part="${selection.id}"]`);
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
  if (!editable() || selection?.kind !== 'part') {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const part = byId(machine(), selection.id);
  if (!part) {
    box.hidden = true;
    return;
  }
  const fixed = puzzle().fixed.some((candidate) => candidate.id === part.id);
  const controls = partControlMarkup(part, fixed);
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
    box.innerHTML = '<p class="prose">Select a part or wire to inspect it. Parts must fit within the board and the available quantities. Wire length determines travel time.</p>';
    return;
  }
  if (inspection.kind === 'tool') {
    renderToolHelp(inspection.partKind);
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
    $('selection-kind').textContent = 'WIRE';
    box.innerHTML = `<p class="prose">${w.from.part}.${w.from.port} → ${w.to.part}.${w.to.port} · travel time: ${wireTicks(machine(), w)} ticks</p>`;
    return;
  }
  const part = byId(machine(), inspection.id);
  if (!part) {
    if (hoverInspection) hoverInspection = null;
    else selection = null;
    renderInspector();
    return;
  }
  const fixed = puzzle().fixed.some((f) => f.id === part.id);
  $('selection-kind').textContent = `${KIND_NAMES[part.kind].toUpperCase()} ${part.id}`;
  let html = '';
  const kase = currentCase();

  if (part.kind === 'quill') html += `<p class="prose">Outputs ${prettyWord(kase.seeds[part.id] ?? '')} at tick 1.</p>`;
  if (part.kind === 'resonator') html += `<p class="prose">${kase.targets[part.id] !== undefined ? `Target: ${prettyWord(kase.targets[part.id])}. A different word fails the performance.` : 'Target: stay silent. Any word fails the performance.'}</p>`;
  if (part.kind === 'damper') html += '<p class="prose">Removes the first note: a·w → w. An empty word waits.</p>';
  if (part.kind === 'unison') html += '<p class="prose">Waits for both inputs. Output: lead word followed by tail word.</p>';
  if (part.kind === 'mould') html += `<p class="prose">Adds the selected ${part.config.note} note to the end of each word.</p>`;
  if (part.kind === 'splitter') html += `<p class="prose">Position ${part.config.k}: head receives the first ${part.config.k} notes; rest receives the remainder.</p>`;
  if (part.kind === 'fork') {
    html += `<p class="prose">A first-note ${part.config.note} match goes left; other words go right. ` +
      `${part.config.mode === 'consume' ? 'Bite removes the matching note.' : 'Peek leaves the word unchanged.'}</p>`;
  }
  if (part.kind === 'coupling') {
    const feedback = couplingFeedback(part, machine());
    html += `<div class="coupling-summary route-a"><strong>B decides A</strong><span>B:${part.config.noteA} → A:left · otherwise A:right</span></div>` +
      `<div class="coupling-summary route-b"><strong>A decides B</strong><span>A:${part.config.noteB} → B:left · otherwise B:right</span></div>` +
      '<p class="prose">The Coupling waits for both words. Each word keeps its notes; the other word chooses its exit.</p>';
    if (feedback?.wordA !== undefined || feedback?.wordB !== undefined) {
      const side = (output) => output?.endsWith('L') ? 'left' : output?.endsWith('R') ? 'right' : 'waiting';
      html += `<p class="coupling-live">Live: B sends A ${side(feedback.outA)} · A sends B ${side(feedback.outB)}</p>`;
    }
  }
  if (part.kind === 'valve') html += `<p class="prose">Holds each word for ${part.config.delay} ticks, then outputs it unchanged.</p>`;
  if (fixed) html += '<p class="tool-hint">This commission part is fixed to the bench.</p>';
  box.innerHTML = html;
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
      const title = unlocked ? p.title : `Locked: fill level ${i} first`;
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
  if (partDrag?.moved) text = 'Moving part · release to place · right-click or Esc cancels';
  else if (drag?.kind === 'retarget') text = `Retargeting ${drag.end === 'from' ? 'source' : 'destination'} · right-click or Esc cancels`;
  else if (drag) text = 'Connecting wire · right-click or Esc cancels';
  else if (armedTool) text = `Placing ${KIND_NAMES[armedTool]} · right-click or Esc cancels`;
  status.hidden = !text;
  status.textContent = text;
}

function cancelBoardInteraction({ clearSelection = true } = {}) {
  const capturedPointerIds = [partDrag?.pointerId, drag?.pointerId, boardPan?.pointerId]
    .filter((pointerId) => pointerId !== undefined);
  for (const pointerId of capturedPointerIds) {
    if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
  }
  setLevelMenu(false);
  armedTool = null;
  placementHover = null;
  hoverInspection = null;
  drag = null;
  partDrag = null;
  boardPan = null;
  boardScroll.classList.remove('panning');
  if (clearSelection) selection = null;
  renderPalette();
  renderBoard();
  renderInspector();
}

function sameInspection(a, b) {
  return a?.kind === b?.kind && a?.id === b?.id && a?.partKind === b?.partKind;
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

svg.addEventListener('pointerdown', (e) => {
  if (e.button === 0) svg.focus({ preventScroll: true });
  const handle = e.target.closest('[data-wire-handle]');
  if (handle && editable() && e.button === 0) {
    const wire = playerWires.find((candidate) => candidate.id === handle.dataset.wire);
    if (wire) {
      const end = handle.dataset.wireHandle;
      const anchor = end === 'from' ? wire.to : wire.from;
      const { x, y } = svgXY(e);
      drag = { kind: 'retarget', wireId: wire.id, end, anchor, x, y, pointerId: e.pointerId };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
  }
  const port = e.target.closest('[data-port-part]');
  if (port && port.dataset.portDir === 'out' && editable() && e.button === 0) {
    const from = { part: port.dataset.portPart, port: port.dataset.portName };
    const taken = playerWires.some((w) => w.from.part === from.part && w.from.port === from.port);
    if (!taken) {
      const { x, y } = svgXY(e);
      drag = { kind: 'new', end: 'to', anchor: from, x, y, pointerId: e.pointerId };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
  }
  const part = e.target.closest('[data-part]');
  const movable = part && playerParts.some((candidate) => candidate.id === part.dataset.part);
  if (movable && editable() && !armedTool && e.button === 0) {
    const placed = playerParts.find((candidate) => candidate.id === part.dataset.part);
    const { x, y } = svgXY(e);
    partDrag = {
      pointerId: e.pointerId,
      id: placed.id,
      startX: x,
      startY: y,
      x: placed.x,
      y: placed.y,
      moved: false,
    };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const interactive = e.target.closest('[data-part], [data-wire], [data-word]');
  const canGrab = zoom > 1 && (e.button === 1 || (!interactive && !armedTool && e.button === 0));
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
  if (!boardPan && !drag && !partDrag) setHoverInspection(inspectionAt(e.target));
  if (partDrag?.pointerId === e.pointerId) {
    const point = svgXY(e);
    if (Math.hypot(point.x - partDrag.startX, point.y - partDrag.startY) > 4) partDrag.moved = true;
    if (partDrag.moved) {
      const x = Math.floor(point.x / CELL);
      const y = Math.floor(point.y / CELL);
      if (partDrag.x !== x || partDrag.y !== y) {
        partDrag.x = x;
        partDrag.y = y;
        renderBoard();
      }
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
  if (!drag && armedTool && editable()) {
    const point = svgXY(e);
    const next = { x: Math.floor(point.x / CELL), y: Math.floor(point.y / CELL) };
    if (placementHover?.x !== next.x || placementHover?.y !== next.y) {
      placementHover = next;
      renderBoard();
    }
    return;
  }
  if (!drag || drag.pointerId !== e.pointerId) return;
  const { x, y } = svgXY(e);
  drag.x = x; drag.y = y;
  renderBoard();
});

svg.addEventListener('pointerleave', () => {
  setHoverInspection(null);
  if (placementHover && !drag) {
    placementHover = null;
    renderBoard();
  }
});

// Dropping a wire anywhere on a part snaps to that part's nearest in port -
// the port circles are too small to demand a direct hit, and a drop that
// silently creates nothing looks identical to a wire that exists.
function snapPort(partId, pt, dir) {
  const m = machine();
  const part = byId(m, partId);
  const ports = dir === 'in' ? PORTS[part.kind].ins : PORTS[part.kind].outs;
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

svg.addEventListener('pointerup', (e) => {
  if (partDrag?.pointerId === e.pointerId) {
    const gesture = partDrag;
    partDrag = null;
    selection = { kind: 'part', id: gesture.id };
    // Pointer capture retargets the generated click to the SVG root. Suppress
    // that click so a stationary press selects instead of immediately clearing.
    suppressPartClick = true;
    setTimeout(() => { suppressPartClick = false; }, 0);
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    const validity = movementValidity(machine().parts, puzzle().board, gesture.id, gesture.x, gesture.y);
    if (gesture.moved && validity.valid) {
      const changed = movePart(gesture.id, gesture.x, gesture.y);
      if (!changed) { renderBoard(); renderInspector(); }
    } else {
      renderBoard(); renderInspector();
    }
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
  const wantedDir = gesture.end === 'from' ? 'out' : 'in';
  let target = null;
  if (port && port.dataset.portDir === wantedDir) {
    target = { part: port.dataset.portPart, port: port.dataset.portName };
  } else {
    const partEl = el?.closest?.('[data-part]');
    const cellPart = machine().parts.find((q) =>
      q.x === Math.floor(pt.x / CELL) && q.y === Math.floor(pt.y / CELL));
    const targetId = partEl?.dataset.part ?? cellPart?.id;
    if (targetId) target = wantedDir === 'in' ? snapInPort(targetId, pt) : snapOutPort(targetId, pt);
  }
  drag = null;
  if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  let changed = false;
  if (target) {
    changed = gesture.kind === 'new'
      ? addWire(gesture.anchor, target)
      : retargetWire(gesture.wireId, gesture.end, target);
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
  if (partEl) {
    selection = { kind: 'part', id: partEl.dataset.part };
  } else if (wireEl) {
    selection = { kind: 'wire', id: wireEl.dataset.wire };
  } else if (armedTool && editable()) {
    const { x, y } = svgXY(e);
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    const p = puzzle();
    const validity = placementValidity(machine().parts, p.board, gx, gy);
    if (validity.valid && remaining(armedTool) > 0) {
      placementHover = null;
      const splice = spliceCandidateAtCell(machine(), armedTool, gx, gy);
      placePart(armedTool, gx, gy, splice?.id ?? null);
      return;
    }
  } else {
    selection = null;
  }
  renderBoard(); renderInspector();
});

$('palette').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]');
  if (!b) return;
  const kind = b.dataset.tool;
  const canPlace = editable() && remaining(kind) > 0;
  armedTool = canPlace && armedTool !== kind ? kind : null;
  placementHover = null;
  selection = armedTool ? { kind: 'tool', partKind: kind } : null;
  renderPalette(); renderBoard(); renderInspector();
});

$('palette').addEventListener('pointerover', (e) => {
  const tool = e.target.closest('[data-tool]');
  setHoverInspection(tool ? { kind: 'tool', partKind: tool.dataset.tool } : null);
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
  if (e.key === 'Escape') {
    cancelBoardInteraction();
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
  if (!editable() || (!playerParts.length && !playerWires.length)) return;
  applyEdit(() => { playerParts = []; playerWires = []; placementHover = null; selection = null; });
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
$('deck-reference').addEventListener('click', () => { onResetRun(); placeReference(); });

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
$('zoom-fit').addEventListener('click', () => setZoom(1));
window.addEventListener('resize', sizeBoard);
boardScroll.addEventListener('scroll', positionContextEditor, { passive: true });

$('prev-level').addEventListener('click', () => loadLevel(levelIndex - 1));
$('next-level').addEventListener('click', () => loadLevel(levelIndex + 1));
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
