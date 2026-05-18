export function mergeStroke(strokes, stroke) {
  if (!stroke?.id) return sortStrokes([...strokes, stroke]);
  const index = strokes.findIndex((entry) => entry.id === stroke.id);
  if (index === -1) return sortStrokes([...strokes, stroke]);
  const next = strokes.slice();
  next[index] = { ...next[index], ...stroke };
  return sortStrokes(next);
}

export function sortStrokes(strokes) {
  return strokes.slice().sort((a, b) => getOrder(a) - getOrder(b));
}

function getOrder(stroke) {
  return Number.isFinite(stroke?.order) ? stroke.order : Number.MAX_SAFE_INTEGER;
}
