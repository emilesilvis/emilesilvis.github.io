// Pure motion geometry for the presentation layer. Kept DOM-free so a routed
// word's between-tick position can be locked down without a browser.

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

export function pointAlongPath(points, fraction) {
  const segments = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segments.push(length);
    total += length;
  }
  let distance = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 1; i < points.length; i += 1) {
    if (distance <= segments[i - 1] || i === points.length - 1) {
      const t = segments[i - 1] ? distance / segments[i - 1] : 0;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * Math.min(t, 1),
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * Math.min(t, 1),
      };
    }
    distance -= segments[i - 1];
  }
  return points.at(-1);
}

function roundedCorner(previous, corner, next, radius) {
  const incoming = { x: corner.x - previous.x, y: corner.y - previous.y };
  const outgoing = { x: next.x - corner.x, y: next.y - corner.y };
  const incomingLength = Math.hypot(incoming.x, incoming.y);
  const outgoingLength = Math.hypot(outgoing.x, outgoing.y);
  if (!incomingLength || !outgoingLength) return null;
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
  if (Math.abs(cross) < 1e-9) return null;
  const trim = Math.min(radius, incomingLength / 2, outgoingLength / 2);
  return {
    before: {
      x: corner.x - incoming.x / incomingLength * trim,
      y: corner.y - incoming.y / incomingLength * trim,
    },
    after: {
      x: corner.x + outgoing.x / outgoingLength * trim,
      y: corner.y + outgoing.y / outgoingLength * trim,
    },
  };
}

// Track art and marble motion share this bend construction. The SVG path uses
// true quadratic elbows; motion samples the same curves densely enough that a
// marble never appears to cut across its rails.
export function roundedPathData(points, radius = 18) {
  if (!points.length) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const corner = roundedCorner(points[index - 1], points[index], points[index + 1], radius);
    if (!corner) {
      path += ` L ${points[index].x} ${points[index].y}`;
      continue;
    }
    path += ` L ${corner.before.x} ${corner.before.y}` +
      ` Q ${points[index].x} ${points[index].y} ${corner.after.x} ${corner.after.y}`;
  }
  if (points.length > 1) path += ` L ${points.at(-1).x} ${points.at(-1).y}`;
  return path;
}

export function roundedPathPoints(points, radius = 18, curveSteps = 6) {
  if (points.length < 3) return [...points];
  const rounded = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const corner = roundedCorner(points[index - 1], current, points[index + 1], radius);
    if (!corner) {
      rounded.push(current);
      continue;
    }
    rounded.push(corner.before);
    for (let step = 1; step <= curveSteps; step += 1) {
      const t = step / curveSteps;
      const inverse = 1 - t;
      rounded.push({
        x: inverse * inverse * corner.before.x + 2 * inverse * t * current.x + t * t * corner.after.x,
        y: inverse * inverse * corner.before.y + 2 * inverse * t * current.y + t * t * corner.after.y,
      });
    }
  }
  rounded.push(points.at(-1));
  return rounded;
}

// Direction cues sit on the travelling route, but leave the midpoint clear for
// the track's timing chip. Short routes need no cue; longer routes receive
// evenly spaced markers whose angle follows the rounded path's local tangent.
export function pathDirectionMarkers(
  points,
  { spacing = 160, minLength = 112, midpointClearance = 28, tangentSample = 3 } = {},
) {
  const total = pathLength(points);
  if (total < minLength) return [];
  const count = Math.max(1, Math.floor(total / spacing));
  const markers = [];
  for (let index = 1; index <= count; index += 1) {
    let distance = total * index / (count + 1);
    if (Math.abs(distance - total / 2) < midpointClearance) {
      if (count > 1) continue;
      distance = total / 3;
    }
    const point = pointAlongPath(points, distance / total);
    const before = pointAlongPath(points, Math.max(0, distance - tangentSample) / total);
    const after = pointAlongPath(points, Math.min(total, distance + tangentSample) / total);
    markers.push({
      ...point,
      angle: Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI,
    });
  }
  return markers;
}

export function transitProgress(from, to, elapsedMs, durationMs, dwellFraction = 0) {
  const rawProgress = durationMs <= 0 ? 1 : Math.max(0, Math.min(1, elapsedMs / durationMs));
  const dwell = Math.max(0, Math.min(0.9, dwellFraction));
  const progress = rawProgress <= dwell ? 0 : (rawProgress - dwell) / (1 - dwell);
  return from + (to - from) * progress;
}

export function transitPosition(points, from, to, elapsedMs, durationMs, dwellFraction = 0) {
  return pointAlongPath(points, transitProgress(from, to, elapsedMs, durationMs, dwellFraction));
}

// Letters are separate marbles, so every member of a word samples the route
// independently. This keeps a convoy inside orthogonal elbows instead of
// drawing one rigid horizontal word across a turn. Twenty-six units leaves a
// visible rolling gap even when two 17-unit marbles straddle a sharp elbow.
export function marbleTrainStates(points, fraction, count, spacing = 26, radius = 8.2) {
  if (count <= 0) return [];
  const total = pathLength(points) || 1;
  const centre = (count - 1) / 2;
  const effectiveSpacing = count > 1 ? Math.min(spacing, total / (count - 1)) : spacing;
  const halfTrain = centre * effectiveSpacing;
  const centreDistance = Math.max(halfTrain, Math.min(total - halfTrain, fraction * total));
  return Array.from({ length: count }, (_, index) => {
    const distance = centreDistance + (centre - index) * effectiveSpacing;
    return {
      ...pointAlongPath(points, distance / total),
      surfaceRoll: ((distance / radius) * 180 / Math.PI) % 360,
    };
  });
}

export function marbleTrainPositions(points, fraction, count, spacing = 26) {
  return marbleTrainStates(points, fraction, count, spacing)
    .map(({ x, y }) => ({ x, y }));
}

// A discrete Step frame has no between-tick time in which to interpolate.
// This helper is shared with the renderer so its exact snapshot semantics are
// testable without a browser.
export function discreteTransitPosition(points, from, _to) {
  return pointAlongPath(points, from);
}
