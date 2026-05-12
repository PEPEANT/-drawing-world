const MAX_ADMIN_STROKES = 80;
const MAX_PREVIEW_POINTS = 28;

function buildStrokeModeration(room) {
  const playerNames = new Map(Array.from(room.players.values()).map((player) => [player.id, player.name]));
  return room.strokes
    .filter((stroke) => stroke && stroke.tool !== "eraser" && Array.isArray(stroke.points))
    .slice(-MAX_ADMIN_STROKES)
    .reverse()
    .map((stroke) => summarizeStroke(stroke, playerNames));
}

function summarizeStroke(stroke, playerNames) {
  const bounds = getBounds(stroke.points);
  return {
    id: stroke.id,
    author: stroke.author,
    authorName: playerNames.get(stroke.author) || stroke.name || "unknown",
    brush: stroke.brush || "round",
    color: /^#[0-9a-f]{6}$/i.test(stroke.color) ? stroke.color : "#111827",
    layerId: stroke.layerId || "layer-1",
    pointCount: stroke.points.length,
    bounds,
    preview: samplePreview(stroke.points, bounds)
  };
}

function getBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.round(Math.min(...xs)),
    y: Math.round(Math.min(...ys)),
    w: Math.max(1, Math.round(Math.max(...xs) - Math.min(...xs))),
    h: Math.max(1, Math.round(Math.max(...ys) - Math.min(...ys)))
  };
}

function samplePreview(points, bounds) {
  const step = Math.max(1, Math.ceil(points.length / MAX_PREVIEW_POINTS));
  const sampled = points.filter((_, index) => index % step === 0);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
  return sampled.map((point) => ({
    x: Math.round(((point.x - bounds.x) / bounds.w) * 72),
    y: Math.round(((point.y - bounds.y) / bounds.h) * 44)
  }));
}

module.exports = {
  buildStrokeModeration
};
