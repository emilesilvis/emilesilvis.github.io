// Pure motion geometry for the presentation layer. Kept DOM-free so a routed
// word's between-tick position can be locked down without a browser.

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

export function transitPosition(points, from, to, elapsedMs, durationMs, dwellFraction = 0) {
  const rawProgress = durationMs <= 0 ? 1 : Math.max(0, Math.min(1, elapsedMs / durationMs));
  const dwell = Math.max(0, Math.min(0.9, dwellFraction));
  const progress = rawProgress <= dwell ? 0 : (rawProgress - dwell) / (1 - dwell);
  return pointAlongPath(points, from + (to - from) * progress);
}

// A discrete Step frame has no between-tick time in which to interpolate.
// This helper is shared with the renderer so its exact snapshot semantics are
// testable without a browser.
export function discreteTransitPosition(points, from, _to) {
  return pointAlongPath(points, from);
}
