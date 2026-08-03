// SVG notation primitives. Stationary source and target words read like score
// cards; words moving through the machine become individual letter marbles.

const CARD_PITCH_OFFSETS = { A: 4, B: 2, C: 0, D: -2 };

function wordLayout(x, word, spacing, padding) {
  const shown = [...word].slice(0, 6);
  const width = Math.max(shown.length, 1) * spacing + padding;
  return { shown, width, left: x - width / 2 };
}

export function drawWordCard(x, y, word) {
  const { shown, width, left } = wordLayout(x, word, 14, 8);
  let notation = `<rect class="word-pill-box" x="${left}" y="${y - 12}" width="${width}" height="24" rx="4"></rect>`;
  for (let line = -4; line <= 4; line += 2) {
    notation += `<line class="word-staff" x1="${left + 3}" y1="${y + line}" x2="${left + width - 3}" y2="${y + line}"></line>`;
  }
  if (!word) {
    notation += `<text class="word-rest" x="${left + width / 2}" y="${y + 5}">𝄽</text>`;
    notation += `<text class="note-letter" x="${left + width / 2}" y="${y + 10}">∅</text>`;
  } else {
    shown.forEach((note, index) => {
      const noteX = left + 11 + index * 14;
      const noteY = y + (CARD_PITCH_OFFSETS[note] ?? 0);
      notation += `<line class="note-stem" x1="${noteX + 3.4}" y1="${noteY}" x2="${noteX + 3.4}" y2="${noteY - 8}"></line>`;
      notation += `<ellipse class="note-head" cx="${noteX}" cy="${noteY}" rx="4.3" ry="3" ` +
        `transform="rotate(-18 ${noteX} ${noteY})" fill="var(--note-${note})"></ellipse>`;
      notation += `<text class="note-letter" x="${noteX}" y="${y + 10}">${note}</text>`;
    });
    if (word.length > 6) notation += `<text class="word-more" x="${left + width + 2}" y="${y + 3}">+${word.length - 6}</text>`;
  }
  return notation;
}

export function drawMarble(note, x, y, { index = null, surfaceRoll = 0, lead = false } = {}) {
  const data = index === null ? '' : ` data-marble="${index}"`;
  const tone = note || 'empty';
  const letter = note || '∅';
  const leadMarker = lead
    ? '<circle class="marble-lead-ring" cx="0" cy="0" r="12.2"></circle>' +
      '<g class="marble-lead-label" transform="translate(0 -26)">' +
      '<path d="M-3 8L0 12L3 8Z"></path><rect x="-17" y="-7" width="34" height="15" rx="4"></rect>' +
      '<text x="0" y="3">LEAD</text></g>'
    : '';
  return `<g class="letter-marble${lead ? ' lead-marble' : ''}"${data} transform="translate(${x} ${y})">` +
    leadMarker +
    '<circle class="marble-shadow" cx="1.4" cy="2.3" r="9.1"></circle>' +
    '<circle class="marble-rim" cx="0" cy="0" r="8.8"></circle>' +
    `<circle class="marble-shell note-${tone}" cx="0" cy="0" r="8.2"></circle>` +
    `<g class="marble-rolling-surface" data-marble-surface transform="rotate(${surfaceRoll})">` +
    '<path class="marble-vein light" d="M-6.5-1.5C-2.5-5.4 2.8-5.2 6.2-1.4"></path>' +
    '<path class="marble-vein dark" d="M-6.2 2.1C-1.8 5.7 3.5 5.1 6.4 1.2"></path></g>' +
    '<ellipse class="marble-depth" cx="1.2" cy="3.5" rx="5.1" ry="2.7"></ellipse>' +
    '<ellipse class="marble-glow" cx="-2.2" cy="-2.1" rx="3.6" ry="4.3"></ellipse>' +
    '<circle class="marble-glint" cx="-3.2" cy="-3.5" r="1.55"></circle>' +
    '<circle class="marble-pinpoint" cx="-3.7" cy="-4" r="0.55"></circle>' +
    '<g class="marble-etching">' +
    `<text class="marble-letter-groove" x="0" y="2.8">${letter}</text>` +
    `<text class="marble-letter" x="0" y="2.5">${letter}</text></g></g>`;
}

export function drawMarbleWord(x, y, word) {
  const spacing = 19;
  const { shown, width, left } = wordLayout(x, word, spacing, 3);
  if (!word) return drawMarble('', x, y);
  let notation = '';
  shown.forEach((note, index) => {
    const noteX = left + 11 + index * spacing;
    notation += drawMarble(note, noteX, y, { index });
  });
  if (word.length > 6) notation += `<text class="word-more" x="${left + width + 2}" y="${y + 2}">+${word.length - 6}</text>`;
  return notation;
}
