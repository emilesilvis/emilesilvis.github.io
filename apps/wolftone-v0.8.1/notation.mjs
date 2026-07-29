// SVG notation primitives. Stationary source and target words read like score
// cards; words moving through the machine ride the courses as exposed beads.

const CARD_PITCH_OFFSETS = { A: 4, B: 2, C: 0, D: -2 };
const COURSE_PITCH_OFFSETS = { A: 3, B: 1, C: -1, D: -3 };

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

export function drawStrungWord(x, y, word) {
  const { shown, width, left } = wordLayout(x, word, 15, 3);
  let notation = `<path class="word-course" d="M${left + 1} ${y} Q${left + width / 2} ${y - 3} ${left + width - 1} ${y}"></path>`;
  if (!word) {
    notation += `<circle class="word-note-rim" cx="${left + width / 2}" cy="${y}" r="7"></circle>` +
      `<text class="word-note-letter" x="${left + width / 2}" y="${y + 2}">∅</text>`;
    return notation;
  }
  shown.forEach((note, index) => {
    const noteX = left + 9 + index * 15;
    const noteY = y + (COURSE_PITCH_OFFSETS[note] ?? 0);
    notation += `<circle class="word-note-rim" cx="${noteX}" cy="${noteY}" r="6.2"></circle>` +
      `<ellipse class="word-note-bead" cx="${noteX}" cy="${noteY}" rx="5.2" ry="4.2" ` +
      `transform="rotate(-18 ${noteX} ${noteY})" fill="var(--note-${note})"></ellipse>` +
      `<text class="word-note-letter" x="${noteX}" y="${noteY + 2}">${note}</text>`;
  });
  if (word.length > 6) notation += `<text class="word-more" x="${left + width + 2}" y="${y + 2}">+${word.length - 6}</text>`;
  return notation;
}
