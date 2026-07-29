// Nearby strings leave a shared mechanism on stable parallel lanes. They may
// converge at an input, but they should never become one unreadable course.

export function wireLaneOffset(wires, wire, spacing = 6) {
  const fromSiblings = wires.filter((candidate) => candidate.from.part === wire.from.part);
  const toSiblings = wires.filter((candidate) => candidate.to.part === wire.to.part);
  const siblings = fromSiblings.length > 1 ? fromSiblings
    : toSiblings.length > 1 ? toSiblings
    : [wire];
  const lane = siblings.findIndex((candidate) => candidate.id === wire.id);
  return (lane - (siblings.length - 1) / 2) * spacing;
}
