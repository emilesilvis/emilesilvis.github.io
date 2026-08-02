// Approved concept plates for the playable machine. Runtime copies are
// downsampled from the lossless gallery masters so board rendering stays
// light while the gallery remains the source of truth.

export const PART_ART_SELECTIONS = Object.freeze({
  quill: selection('quill', 'a'),
  mould: selection('mould', 'a'),
  damper: selection('damper', 'b'),
  valve: selection('valve', 'a'),
  unison: selection('unison', 'a'),
  splitter: selection('splitter', 'a'),
  fork: selection('fork', 'a'),
  coupling: selection('coupling', 'a'),
  crossing: selection('crossing', 'a'),
  junction: selection('junction', 'a'),
  resonator: selection('resonator', 'b'),
});

function selection(kind, concept) {
  return Object.freeze({ concept, href: `./art/parts/${kind}-${concept}.webp` });
}

export function partArtSelection(kind) {
  return PART_ART_SELECTIONS[kind] ?? null;
}
