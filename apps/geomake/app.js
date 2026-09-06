import { evaluateAnswer, matchesAnswer } from './answer.js?v=9d30678079ce';

const page = document.querySelector('main');
const answer = document.querySelector('#answer');
const feedback = document.querySelector('#feedback');
const hintButton = document.querySelector('#hint');
const explainButton = document.querySelector('#explain');
const hints = document.querySelector('#hints');
const solution = document.querySelector('#solution');
const storageKey = `geomake:${page.dataset.edition}:${page.dataset.day}:answer`;
let hintCount = 0;
let checking = false;

try { answer.value = localStorage.getItem(storageKey) || ''; } catch { /* Optional convenience only. */ }
answer.addEventListener('input', () => {
  feedback.hidden = true;
  try { localStorage.setItem(storageKey, answer.value); } catch { /* Solving works without storage. */ }
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
  if (checking) return;
  const submitted = answer.value;
  checking = true;
  document.querySelector('#check').disabled = true;
  try {
    evaluateAnswer(submitted);
    const expected = await readHelp('check');
    if (answer.value === submitted) message(matchesAnswer(submitted, expected) ? 'Correct.' : 'Not quite. Try again.');
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
