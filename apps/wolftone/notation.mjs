// SVG notation primitives. A sound phrase is always written on the same score
// bar. Inside the machine, that bar rides above one swirled glass word marble.

const CARD_PITCH_OFFSETS = { A: 3, B: 1, C: -1, D: -3 };
const SOUND_BAR_SCALE = 2;
export const SOUND_BAR_HEIGHT = 26 * SOUND_BAR_SCALE;
let wordMarbleSequence = 0;

function soundBarLayout(x, word, spacing = 14, padding = 8) {
  const shown = [...word].slice(0, 6);
  const overflow = Math.max(0, word.length - shown.length);
  const width = Math.max(shown.length, 1) * spacing + padding + (overflow ? 14 : 0);
  return { shown, overflow, width, left: x - width / 2 };
}

export function soundBarWidth(word) {
  return soundBarLayout(0, word).width * SOUND_BAR_SCALE;
}

export function drawSoundBar(x, y, word) {
  const { shown, overflow, width, left } = soundBarLayout(x, word);
  let notation = `<rect class="word-pill-box" x="${left}" y="${y - 13}" width="${width}" height="26" rx="3"></rect>`;
  for (let line = -7; line <= 1; line += 2) {
    notation += `<line class="word-staff" x1="${left + 3}" y1="${y + line}" x2="${left + width - 3}" y2="${y + line}"></line>`;
  }
  if (!word) {
    notation += `<text class="word-rest" x="${left + width / 2}" y="${y}">𝄽</text>`;
    notation += `<text class="note-letter" x="${left + width / 2}" y="${y + 10.5}">∅</text>`;
  } else {
    shown.forEach((note, index) => {
      const noteX = left + 11 + index * 14;
      const noteY = y + (CARD_PITCH_OFFSETS[note] ?? 0);
      notation += `<line class="note-stem" x1="${noteX + 3.4}" y1="${noteY}" x2="${noteX + 3.4}" y2="${noteY - 7}"></line>`;
      notation += `<ellipse class="note-head" cx="${noteX}" cy="${noteY}" rx="4.3" ry="3" ` +
        `transform="rotate(-18 ${noteX} ${noteY})" fill="var(--note-${note})"></ellipse>`;
      notation += `<text class="note-letter" x="${noteX}" y="${y + 10.5}">${note}</text>`;
    });
    if (overflow) notation += `<text class="word-more" x="${left + width - 7}" y="${y + 1}">+${overflow}</text>`;
  }
  return `<g class="sound-bar-notation" transform="translate(${x} ${y}) scale(${SOUND_BAR_SCALE}) translate(${-x} ${-y})">` +
    notation + '</g>';
}

function marbleSectorPath(index, count, radius = 26) {
  const startAngle = (-90 + index * 360 / count) * Math.PI / 180;
  const endAngle = (-90 + (index + 1) * 360 / count) * Math.PI / 180;
  const startX = radius * Math.cos(startAngle);
  const startY = radius * Math.sin(startAngle);
  const endX = radius * Math.cos(endAngle);
  const endY = radius * Math.sin(endAngle);
  const largeArc = 360 / count > 180 ? 1 : 0;
  return `M0 0L${startX.toFixed(3)} ${startY.toFixed(3)}` +
    `A${radius} ${radius} 0 ${largeArc} 1 ${endX.toFixed(3)} ${endY.toFixed(3)}Z`;
}

function marbleSoundBarMarkup(word) {
  return '<path class="word-marble-sound-bar-stem" d="M0-13V-14"></path>' +
    '<g class="word-marble-sound-bar sound-bar" data-upright-sound-bar>' +
    drawSoundBar(0, -40, word) + '</g>';
}

export function drawWordMarble(word, x, y, { index = null, surfaceRoll = 0 } = {}) {
  const data = index === null ? '' : ` data-marble="${index}"`;
  const notes = [...word].slice(0, 6);
  const id = `word-marble-${wordMarbleSequence++}`;
  const seed = [...word].reduce((total, note) => total + note.charCodeAt(0), word.length * 7);
  const colours = notes.length === 1
    ? `<circle class="word-marble-colour note-${notes[0]}" cx="0" cy="0" r="13"></circle>`
    : notes.map((note, noteIndex) =>
      `<path class="word-marble-colour note-${note}" d="${marbleSectorPath(noteIndex, notes.length)}"></path>`,
    ).join('');
  const surface = notes.length
    ? `<g clip-path="url(#${id}-clip)"><g filter="url(#${id}-swirl)" transform="rotate(-24)">${colours}</g>` +
      '<path class="word-marble-vein light" d="M-13 5C-7-7 1 10 8-2S15-6 17 1"></path>' +
      '<path class="word-marble-vein dark" d="M-14 8C-5 1 0 11 8 4S14 0 17 6"></path></g>'
    : `<circle class="word-marble-empty" cx="0" cy="0" r="13"></circle>`;

  return `<g class="word-marble" aria-label="word ${word || 'empty'}"${data} transform="translate(${x} ${y})">` +
    `<defs><clipPath id="${id}-clip"><circle cx="0" cy="0" r="12.5"></circle></clipPath>` +
    `<filter id="${id}-swirl" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency=".038 .14" numOctaves="3" seed="${seed}" result="noise"></feTurbulence>` +
    '<feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter>' +
    `<radialGradient id="${id}-glass" cx="30%" cy="22%" r="72%">` +
    '<stop offset="0" stop-color="#fff" stop-opacity=".78"></stop>' +
    '<stop offset=".19" stop-color="#fff" stop-opacity=".07"></stop>' +
    '<stop offset=".7" stop-color="#1b0805" stop-opacity=".03"></stop>' +
    '<stop offset="1" stop-color="#120704" stop-opacity=".72"></stop></radialGradient></defs>' +
    '<circle class="word-marble-shadow" cx="1.7" cy="2.8" r="13"></circle>' +
    `<g class="word-marble-rolling-surface" data-marble-surface transform="rotate(${surfaceRoll})">${surface}</g>` +
    `<circle class="word-marble-glass" cx="0" cy="0" r="12.5" fill="url(#${id}-glass)"></circle>` +
    '<ellipse class="word-marble-glow" cx="-3.7" cy="-3.7" rx="5.7" ry="3.8" transform="rotate(-28 -3.7 -3.7)"></ellipse>' +
    '<circle class="word-marble-glint" cx="-5.5" cy="-5.7" r="1.35"></circle>' +
    '<circle class="word-marble-glass-edge" cx="0" cy="0" r="12.1"></circle>' +
    marbleSoundBarMarkup(word) + '</g>';
}
