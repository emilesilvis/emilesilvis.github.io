import { evaluateAnswer, matchesAnswer } from './answer.js?v=9f8e67d17ccf';
import { createProgress } from './progress.js?v=9f8e67d17ccf';

const page = document.querySelector('main');
const day = Number(page.dataset.day);
const total = Number(page.dataset.total);
const progress = createProgress(page.dataset.edition, total);
const puzzle = document.querySelector('#puzzle');
const locked = document.querySelector('#locked');
const resume = document.querySelector('#resume');
const progressNote = document.querySelector('#progress');
const puzzleLinks = document.querySelectorAll('[data-puzzle-day]');
const answer = document.querySelector('#answer');
const feedback = document.querySelector('#feedback');
const hintButton = document.querySelector('#hint');
const explainButton = document.querySelector('#explain');
const hints = document.querySelector('#hints');
const solution = document.querySelector('#solution');
let hintCount = 0;
let checking = false;

function updateProgress() {
  const completed = progress.completedThrough();
  const available = Math.min(completed + 1, total);
  puzzle.hidden = day > available;
  locked.hidden = !puzzle.hidden;
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
window.addEventListener('storage', updateProgress);
window.addEventListener('pageshow', updateProgress);

answer.value = progress.loadAnswer(day);
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
  if (checking || puzzle.hidden) return;
  const submitted = answer.value;
  checking = true;
  document.querySelector('#check').disabled = true;
  try {
    evaluateAnswer(submitted);
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

explainButton.addEventListener('click', async () => {
  if (!solution.hidden) {
    solution.hidden = true;
    explainButton.setAttribute('aria-expanded', 'false');
    explainButton.textContent = 'Solution';
    return;
  }
  explainButton.disabled = true;
  try {
    if (!solution.childElementCount) {
      const detail = await readHelp('solution');
      const result = document.createElement('p');
      const value = document.createElement('strong');
      value.textContent = detail.answer;
      result.append(value);
      const steps = document.createElement('ol');
      for (const step of detail.steps) {
        const item = document.createElement('li');
        item.textContent = step;
        steps.append(item);
      }
      solution.append(result, steps);
    }
    solution.hidden = false;
    explainButton.setAttribute('aria-expanded', 'true');
    explainButton.textContent = 'Hide solution';
  } catch (error) {
    message(error instanceof Error ? error.message : 'Please try again.');
  } finally {
    explainButton.disabled = false;
  }
});
