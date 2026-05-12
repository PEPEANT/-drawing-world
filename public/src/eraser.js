import { getStrokeLayerId, replaceStrokes, state } from "./state.js";

export function eraseOwnStrokes(eraserStroke) {
  const ids = new Set();
  const radius = Math.max(4, Number(eraserStroke.size) || 18) / 2;

  for (const stroke of state.strokes) {
    if (!canEraseStroke(stroke, eraserStroke)) continue;
    if (touchesStroke(eraserStroke.points, stroke.points || [], radius)) {
      ids.add(stroke.id);
    }
  }

  if (!ids.size) return [];
  replaceStrokes(state.strokes.filter((stroke) => !ids.has(stroke.id)));
  return Array.from(ids);
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
    stroke.author === state.socketId &&
    getStrokeLayerId(stroke) === getStrokeLayerId(eraserStroke)
  );
}

function touchesStroke(eraserPoints, strokePoints, radius) {
  if (!eraserPoints?.length || !strokePoints?.length) return false;
  const limit = radius + 8;
  for (const eraserPoint of eraserPoints) {
    for (let i = 1; i < strokePoints.length; i += 1) {
      if (distanceToSegment(eraserPoint, strokePoints[i - 1], strokePoints[i]) <= limit) return true;
    }
  }
  return false;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}
