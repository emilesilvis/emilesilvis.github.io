import { evaluateAnswer, matchesAnswer } from './answer.js?v=2edb0ab6765d';
import { createProgress } from './progress.js?v=2edb0ab6765d';
import { createLeaderboard } from './leaderboard.js?v=2edb0ab6765d';

const page = document.querySelector('main');
const day = Number(page.dataset.day);
const total = Number(page.dataset.total);
const previousEditions = JSON.parse(page.dataset.previousEditions || '[]');
const legacyProgress = createProgress(page.dataset.edition, total, undefined, previousEditions);
let progress = legacyProgress;
const publicProgress = page.dataset.api ? createLeaderboard(page.dataset.api, page.dataset.edition) : null;
const puzzle = document.querySelector('#puzzle');
const locked = document.querySelector('#locked');
const resume = document.querySelector('#resume');
const progressNote = document.querySelector('#progress');
const puzzleLinks = document.querySelectorAll('[data-puzzle-day]');
const answer = document.querySelector('#answer');
const feedback = document.querySelector('#feedback');
const hintButton = document.querySelector('#hint');
const hints = document.querySelector('#hints');
const playerForm = document.querySelector('#player-form');
const playerName = document.querySelector('#player-name');
const savePlayer = document.querySelector('#save-player');
const playerSummary = document.querySelector('#player-summary');
const playerStatus = document.querySelector('#player-status');
const playerActions = document.querySelector('#player-actions');
const recoveryDetails = document.querySelector('#recovery-details');
const recoveryCode = document.querySelector('#recovery-code');
const recoveryLogin = document.querySelector('#recovery-login');
const recoveryInput = document.querySelector('#recovery-input');
const restoreButton = document.querySelector('#restore-player');
const board = document.querySelector('#leaderboard');
const boardStatus = document.querySelector('#leaderboard-status');
let player = null;
let editingName = false;
let loadingBoard = false;
let hintCount = 0;
let checking = false;

function selectPlayer(next) {
  const changed = next?.id !== player?.id;
  player = next;
  progress = player ? createProgress(page.dataset.edition, total, undefined, previousEditions, player.id) : legacyProgress;
  if (changed) {
    answer.value = player ? progress.loadAnswer(day) : '';
    feedback.hidden = true;
    recoveryDetails.open = false;
    recoveryCode.textContent = '';
    document.querySelector('#copy-status').hidden = true;
  }
}

function updateProgress() {
  const completed = publicProgress ? player?.completedThrough || 0 : progress.completedThrough();
  const available = Math.min(completed + 1, total);
  puzzle.hidden = (publicProgress && !player) || day > available;
  locked.hidden = !puzzle.hidden || (publicProgress && !player);
  if (publicProgress) {
    playerForm.hidden = !!player && !editingName;
    playerSummary.hidden = !player;
    playerActions.hidden = !player;
    recoveryDetails.hidden = !player;
    recoveryLogin.hidden = !!player;
    if (player) document.querySelector('#player-label').textContent = `${player.name} · ${player.solved.length} of ${total} solved`;
  }
  for (const link of puzzleLinks) {
    const target = Number(link.dataset.puzzleDay);
    if (target <= available) {
      link.setAttribute('href', link.dataset.href);
      link.removeAttribute('aria-disabled');
      link.removeAttribute('role');
    } else {
      link.removeAttribute('href');
      link.setAttribute('role', 'link');
      link.setAttribute('aria-disabled', 'true');
    }
    if (target === available) resume.setAttribute('href', link.dataset.href);
  }
  resume.textContent = `Puzzle ${available}`;
  for (const state of document.querySelectorAll('[data-state-day]')) {
    const target = Number(state.dataset.stateDay);
    state.textContent = target <= completed ? ' · Solved' : target > available ? ' · Locked' : '';
  }
  progressNote.textContent = day <= completed
    ? (day < total ? `Puzzle ${day + 1} is unlocked.` : `All ${total} puzzles solved.`)
    : (day < total ? `Enter the correct answer to unlock Puzzle ${day + 1}.` : 'Solve this puzzle to complete the set.');
}

updateProgress();
window.addEventListener('storage', event => {
  if (!publicProgress) updateProgress();
  else if (event.key === null || event.key?.startsWith('geomake:player:') || event.key?.endsWith(':solved')) restorePlayer();
});
window.addEventListener('pageshow', () => publicProgress ? restorePlayer() : updateProgress());

answer.value = publicProgress ? '' : progress.loadAnswer(day);
answer.addEventListener('input', () => {
  feedback.hidden = true;
  progress.saveAnswer(day, answer.value);
});

function message(text) {
  feedback.textContent = text;
  feedback.hidden = false;
}

async function readHelp(file) {
  const response = await fetch(`${page.dataset.help}/${file}.json`);
  if (!response.ok) throw new Error('Could not load this. Please try again.');
  return response.json();
}

document.querySelector('#answer-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (checking || restoringPlayer || puzzle.hidden) return;
  const submitted = answer.value;
  checking = true;
  document.querySelector('#check').disabled = true;
  try {
    evaluateAnswer(submitted);
    if (publicProgress) {
      const result = await publicProgress.check(day, submitted);
      player = result.player;
      updateProgress();
      if (answer.value === submitted) message(result.correct ? 'Correct.' : 'Not quite. Try again.');
      if (result.correct && board.open) await refreshBoard();
      return;
    }
    const expected = await readHelp('check');
    if (answer.value !== submitted) return;
    if (!matchesAnswer(submitted, expected)) {
      message('Not quite. Try again.');
    } else if (progress.markSolved(day)) {
      updateProgress();
      message('Correct.');
    } else {
      message('Correct, but your progress could not be saved. Allow browser storage and check again.');
    }
  } catch (error) {
    if (answer.value === submitted) message(error instanceof Error ? error.message : 'Please try again.');
  } finally {
    checking = false;
    document.querySelector('#check').disabled = false;
  }
});

function playerMessage(text) {
  playerStatus.textContent = text;
  playerStatus.hidden = !text;
}

async function syncPreviousAnswers() {
  // Existing browser completion is only credited publicly after each saved
  // answer has passed the same server check as a new solve.
  const completed = legacyProgress.completedThrough();
  while (player.completedThrough < completed) {
    const next = player.completedThrough + 1;
    const saved = legacyProgress.loadAnswer(next);
    if (!saved) break;
    let result;
    try { result = await publicProgress.check(next, saved); }
    catch (error) { if (error.status === 400) break; throw error; }
    player = result.player;
    if (!result.correct) break;
    progress.saveAnswer(next, saved);
  }
}

let restoringPlayer = false;
async function restorePlayer() {
  if (!publicProgress || restoringPlayer || savePlayer.disabled) return;
  restoringPlayer = true;
  savePlayer.disabled = true;
  restoreButton.disabled = true;
  playerMessage('Loading your progress…');
  try {
    selectPlayer(await publicProgress.loadPlayer());
    if (player) {
      if (!editingName) playerName.value = player.name;
    }
    playerMessage('');
  } catch (error) {
    playerMessage(error instanceof Error ? error.message : 'Could not load your progress. Please try again.');
  } finally {
    savePlayer.disabled = false;
    restoreButton.disabled = false;
    restoringPlayer = false;
    updateProgress();
  }
}

playerForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!publicProgress || savePlayer.disabled) return;
  const registering = !player;
  savePlayer.disabled = true;
  restoreButton.disabled = true;
  playerMessage('Saving…');
  try {
    selectPlayer(await publicProgress.savePlayer(playerName.value));
    // Import pre-leaderboard completion only when first registering. A recovery
    // login must never submit a different player's cached answers.
    if (registering) await syncPreviousAnswers();
    editingName = false;
    playerName.value = player.name;
    playerMessage('');
    if (registering) recoveryDetails.open = true;
    updateProgress();
    if (board.open) await refreshBoard();
  } catch (error) {
    playerMessage(error instanceof Error ? error.message : 'Could not save your name. Please try again.');
  } finally {
    savePlayer.disabled = false;
    restoreButton.disabled = false;
    updateProgress();
  }
});

document.querySelector('#recovery-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!publicProgress || restoringPlayer || savePlayer.disabled || checking) return;
  restoringPlayer = true;
  savePlayer.disabled = true;
  restoreButton.disabled = true;
  document.querySelector('#check').disabled = true;
  playerMessage('Loading your saved progress…');
  try {
    selectPlayer(await publicProgress.restorePlayer(recoveryInput.value));
    editingName = false;
    playerName.value = player.name;
    recoveryInput.value = '';
    recoveryLogin.open = false;
    playerMessage('Logged in. Your saved progress is restored.');
    updateProgress();
    if (board.open) await refreshBoard();
  } catch (error) {
    playerMessage(error instanceof Error ? error.message : 'Could not restore your progress. Please try again.');
  } finally {
    restoringPlayer = false;
    savePlayer.disabled = false;
    restoreButton.disabled = false;
    document.querySelector('#check').disabled = false;
    updateProgress();
  }
});

recoveryDetails.addEventListener('toggle', () => {
  recoveryCode.textContent = recoveryDetails.open && player ? publicProgress.recoveryCode() : '';
});

document.querySelector('#copy-recovery-code').addEventListener('click', async () => {
  if (!player) return;
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(publicProgress.recoveryCode());
    status.textContent = 'Copied. Save it somewhere private.';
  } catch {
    status.textContent = 'Select and copy the code above.';
  }
  status.hidden = false;
});

document.querySelector('#change-name').addEventListener('click', () => {
  editingName = true;
  updateProgress();
  playerName.focus();
});

document.querySelector('#log-out').addEventListener('click', async () => {
  if (!publicProgress || restoringPlayer || checking || savePlayer.disabled) return;
  try {
    publicProgress.logOut();
    selectPlayer(null);
    editingName = false;
    playerName.value = '';
    playerMessage('Logged out. Use your recovery code to log back in.');
    updateProgress();
    if (board.open) await refreshBoard();
  } catch (error) {
    playerMessage(error instanceof Error ? error.message : 'Could not log out. Please try again.');
  }
});

async function refreshBoard() {
  if (!publicProgress || loadingBoard) return;
  loadingBoard = true;
  const refresh = document.querySelector('#refresh-leaderboard');
  refresh.disabled = true;
  boardStatus.textContent = 'Loading…';
  try {
    const result = await publicProgress.loadBoard();
    const rows = document.querySelector('#leaderboard-rows');
    rows.replaceChildren();
    for (const item of result.players) {
      const row = document.createElement('tr');
      if (item.id === player?.id) row.classList.add('current-player');
      for (const value of [item.rank, item.name, `${item.solved} / ${result.total}`]) {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.append(cell);
      }
      rows.append(row);
    }
    document.querySelector('#leaderboard-table').hidden = result.players.length === 0;
    boardStatus.textContent = result.players.length ? 'Top 100 players. Equal scores share a rank.' : 'No players yet.';
  } catch (error) {
    boardStatus.textContent = error instanceof Error ? error.message : 'Could not load the leaderboard. Please try again.';
  } finally {
    loadingBoard = false;
    refresh.disabled = false;
  }
}

board.addEventListener('toggle', () => { if (board.open) refreshBoard(); });
document.querySelector('#refresh-leaderboard').addEventListener('click', refreshBoard);
if (publicProgress) restorePlayer();

hintButton.addEventListener('click', async () => {
  hintButton.disabled = true;
  try {
    const hint = await readHelp(`hint-${hintCount + 1}`);
    const item = document.createElement('li');
    item.textContent = hint;
    hints.append(item);
    hints.hidden = false;
    hintCount++;
    hintButton.textContent = hintCount < Number(page.dataset.hints) ? 'Another hint' : 'All hints shown';
  } catch (error) {
    message(error instanceof Error ? error.message : 'Please try again.');
  } finally {
    hintButton.disabled = hintCount >= Number(page.dataset.hints);
  }
});
