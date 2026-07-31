// Turn a performance case into the complete input/output contract shown on
// the Commission slip. Labels come from the board; unlabeled endpoints use
// stable positional names so the specification never depends on prose.

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function ordered(parts) {
  return [...parts].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

function fallbackLabel(part, parts) {
  const sorted = ordered(parts);
  const index = sorted.findIndex((candidate) => candidate.id === part.id);
  const noun = part.kind === 'quill' ? 'seed' : 'target';

  // IN and OUT already name a lone endpoint's role on the Commission slip.
  // Keep only explicit labels or fallback labels that distinguish siblings.
  if (parts.length === 1) return null;
  if (parts.length === 2 && sorted[0].y !== sorted[1].y) {
    return part.kind === 'quill'
      ? ['top seed', 'bottom seed'][index]
      : ['upper target', 'lower target'][index];
  }
  return `${noun} ${index + 1}`;
}

function endpointLabel(part, parts) {
  return part.label || fallbackLabel(part, parts);
}

export function commissionCaseSpec(level, performance) {
  const quills = ordered(level.fixed.filter((part) => part.kind === 'quill'));
  const resonators = ordered(level.fixed.filter((part) => part.kind === 'resonator'));

  return {
    inputs: quills
      .filter((part) => hasOwn(performance.seeds, part.id))
      .map((part) => ({ label: endpointLabel(part, quills), word: performance.seeds[part.id] })),
    targets: resonators
      .filter((part) => hasOwn(performance.targets, part.id))
      .map((part) => ({ label: endpointLabel(part, resonators), word: performance.targets[part.id] })),
    silent: resonators
      .filter((part) => !hasOwn(performance.targets, part.id))
      .map((part) => endpointLabel(part, resonators)),
  };
}
