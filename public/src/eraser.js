import { getStrokeLayerId, isOwnStroke, player, replaceStrokes, state } from "./state.js";

const MIN_POINTS = 2;
const MIN_LENGTH = 3;

export function eraseOwnStrokes(eraserStroke) {
  const removed = [];
  const added = [];
  const radius = Math.max(4, Number(eraserStroke.size) || 18) / 2 + 8;

  for (const stroke of state.strokes) {
    if (!canEraseStroke(stroke, eraserStroke)) continue;
    const pieces = splitStroke(stroke, eraserStroke.points || [], radius);
    if (!pieces) continue;
    removed.push(stroke.id);
    added.push(...pieces);
  }

  if (removed.length || added.length) {
    const removedIds = new Set(removed);
    replaceStrokes([...state.strokes.filter((stroke) => !removedIds.has(stroke.id)), ...added]);
  }
  return { ids: removed, added };
}

export function removeStrokesByIds(ids) {
  const removeIds = new Set(Array.isArray(ids) ? ids : []);
  if (!removeIds.size) return;
  replaceStrokes(state.strokes.filter((stroke) => !removeIds.has(stroke.id)));
}

function canEraseStroke(stroke, eraserStroke) {
  return (
    stroke &&
    stroke.tool !== "eraser" &&
    isOwnStroke(stroke) &&
    getStrokeLayerId(stroke) === getStrokeLayerId(eraserStroke)
  );
}

function splitStroke(stroke, eraserPoints, radius) {
  const points = stroke.points || [];
  if (!eraserPoints.length || !points.length) return null;
  if (points.length === 1) return pointHit(points[0], eraserPoints, radius) ? [] : null;

  const pieces = [];
  let current = [];
  let changed = false;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const cuts = getCutRanges(a, b, eraserPoints, radius);
    if (cuts.length) changed = true;
    addSegmentPieces(current, pieces, a, b, cuts);
  }
  pushPiece(pieces, current);
  if (!changed) return null;
  if (!pieces.length) return [];
  if (pieces.length === 1 && samePoints(points, pieces[0].points)) return null;
  return pieces.map((piece, index) => buildPiece(stroke, piece.points, index));
}

function addSegmentPieces(current, pieces, a, b, cuts) {
  let start = 0;
  for (const cut of cuts) {
    addPreservedRange(current, a, b, start, cut.start);
    pushPiece(pieces, current);
    current.length = 0;
    start = cut.end;
  }
  addPreservedRange(current, a, b, start, 1);
}

function addPreservedRange(current, a, b, start, end) {
  if (end - start < 0.001) return;
  const first = interpolatePoint(a, b, start);
  const last = interpolatePoint(a, b, end);
  pushUnique(current, first);
  pushUnique(current, last);
}

function pushPiece(pieces, points) {
  if (points.length < MIN_POINTS || pathLength(points) < MIN_LENGTH) return;
  pieces.push({ points: points.map(clonePoint) });
}

function buildPiece(stroke, points, index) {
  return {
    ...stroke,
    id: `${stroke.id}-cut-${Date.now()}-${index}`,
    author: state.socketId,
    owner: player.clientId,
    points
  };
}

function getCutRanges(a, b, eraserPoints, radius) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!length) return pointHit(a, eraserPoints, radius) ? [{ start: 0, end: 1 }] : [];
  const ranges = [];
  for (const point of eraserPoints) {
    const hit = projectionHit(point, a, b, radius, length);
    if (hit) ranges.push(hit);
  }
  return mergeRanges(ranges);
}

function projectionHit(point, a, b, radius, length) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (length * length)));
  const hitX = a.x + dx * t;
  const hitY = a.y + dy * t;
  if (Math.hypot(point.x - hitX, point.y - hitY) > radius) return null;
  const pad = Math.min(0.45, radius / length);
  return { start: Math.max(0, t - pad), end: Math.min(1, t + pad) };
}

function mergeRanges(ranges) {
  const sorted = ranges.filter(Boolean).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) merged.push({ ...range });
    else last.end = Math.max(last.end, range.end);
  }
  return merged;
}

function pointHit(point, eraserPoints, radius) {
  return eraserPoints.some((eraserPoint) => Math.hypot(point.x - eraserPoint.x, point.y - eraserPoint.y) <= radius);
}

function interpolatePoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: (Number(a.pressure) || 0.5) + ((Number(b.pressure) || 0.5) - (Number(a.pressure) || 0.5)) * t
  };
}

function pushUnique(points, point) {
  const last = points[points.length - 1];
  if (!last || Math.hypot(last.x - point.x, last.y - point.y) > 0.5) points.push(point);
}

function samePoints(source, next) {
  return source.length === next.length && source.every((point, index) => Math.hypot(point.x - next[index].x, point.y - next[index].y) < 0.5);
}

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

function clonePoint(point) {
  return { x: point.x, y: point.y, pressure: point.pressure };
}
