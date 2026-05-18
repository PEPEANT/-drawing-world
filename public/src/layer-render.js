import { getLayer, getStrokeLayerId, isOwnStroke, state } from "./state.js";

export function drawLayeredStrokes(ctx, drawStroke) {
  for (const stroke of state.strokes) drawOrderedStroke(ctx, stroke, drawStroke);
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
