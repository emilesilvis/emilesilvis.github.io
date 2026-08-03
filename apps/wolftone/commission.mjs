// Turn a performance case into the complete input/output contract shown on
// the Commission slip. Terminal names are stable diagram references rather
// than prose authored for an individual commission.

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function orderCommissionParts(parts) {
  const commissionOrder = (part) => part.commissionOrder ?? Number.MAX_SAFE_INTEGER;
  return [...parts].sort((a, b) =>
    commissionOrder(a) - commissionOrder(b) || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

function romanNumeral(value) {
  const numerals = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let remaining = value;
  let result = '';
  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result;
}

export function terminalName(part, parts) {
  const siblings = orderCommissionParts(parts.filter((candidate) => candidate.kind === part.kind));
  const index = siblings.findIndex((candidate) => candidate.id === part.id);
  const prefix = part.kind === 'quill' ? 'Q' : 'R';
  return `${prefix}${romanNumeral(index + 1)}`;
}

export function commissionCaseSpec(level, performance) {
  const quills = orderCommissionParts(level.fixed.filter((part) => part.kind === 'quill'));
  const resonators = orderCommissionParts(level.fixed.filter((part) => part.kind === 'resonator'));

  return {
    inputs: quills
      .filter((part) => hasOwn(performance.seeds, part.id))
      .map((part) => ({ label: terminalName(part, quills), word: performance.seeds[part.id] })),
    targets: resonators
      .filter((part) => hasOwn(performance.targets, part.id))
      .map((part) => ({ label: terminalName(part, resonators), word: performance.targets[part.id] })),
    silent: resonators
      .filter((part) => !hasOwn(performance.targets, part.id))
      .map((part) => terminalName(part, resonators)),
  };
}
