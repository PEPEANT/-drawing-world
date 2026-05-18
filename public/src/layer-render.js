import { getLayer, getStrokeLayerId, isOwnStroke, state } from "./state.js";

const boundsCache = new WeakMap();

export function drawLayeredStrokes(ctx, drawStroke, view) {
  for (const stroke of state.strokes) {
    if (strokeIntersectsView(stroke, view)) drawOrderedStroke(ctx, stroke, drawStroke);
  }
  if (state.currentStroke) drawOrderedStroke(ctx, state.currentStroke, drawStroke);
}

function drawOrderedStroke(ctx, stroke, drawStroke) {
  if (!isDrawableStroke(stroke)) return;
  const layer = isOwnStroke(stroke) ? getLayer(getStrokeLayerId(stroke)) : null;
  if (layer?.visible === false) return;
  ctx.save();
  if (layer) ctx.globalAlpha *= layer.opacity;
  drawStroke(ctx, stroke);
  ctx.restore();
}

function isDrawableStroke(stroke) {
  return stroke && stroke.tool !== "eraser";
}

function strokeIntersectsView(stroke, view) {
  if (!view || !isDrawableStroke(stroke)) return true;
  const bounds = getStrokeBounds(stroke);
  if (!bounds) return false;
  const margin = Math.max(24, (Number(stroke.size) || 6) * 2);
  return (
    bounds.left - margin <= view.right &&
    bounds.right + margin >= view.left &&
    bounds.top - margin <= view.bottom &&
    bounds.bottom + margin >= view.top
  );
}

function getStrokeBounds(stroke) {
  if (boundsCache.has(stroke)) return boundsCache.get(stroke);
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  if (!points.length) return null;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }
  const bounds = Number.isFinite(left) ? { left, right, top, bottom } : null;
  boundsCache.set(stroke, bounds);
  return bounds;
}
