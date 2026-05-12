import { DEFAULT_LAYER_ID, getStrokeLayerId, isOwnStroke, state } from "./state.js";

export function drawLayeredStrokes(ctx, drawStroke) {
  drawRemoteStrokes(ctx, drawStroke);
  const layers = state.layers.length ? state.layers : [getFallbackLayer()];
  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    drawLayerStrokes(ctx, layer.id, drawStroke);
    ctx.restore();
  }
}

function drawRemoteStrokes(ctx, drawStroke) {
  for (const stroke of state.strokes) {
    if (isDrawableStroke(stroke) && !isOwnStroke(stroke)) {
      drawStroke(ctx, stroke);
    }
  }
}

function drawLayerStrokes(ctx, layerId, drawStroke) {
  for (const stroke of state.strokes) {
    if (isVisibleLayerStroke(stroke, layerId)) {
      drawStroke(ctx, stroke);
    }
  }
  const currentStroke = state.currentStroke;
  if (isVisibleLayerStroke(currentStroke, layerId)) {
    drawStroke(ctx, currentStroke);
  }
}

function getFallbackLayer() {
  return { id: DEFAULT_LAYER_ID, visible: true, opacity: 1 };
}

function isVisibleLayerStroke(stroke, layerId) {
  return isDrawableStroke(stroke) && isOwnStroke(stroke) && getStrokeLayerId(stroke) === layerId;
}

function isDrawableStroke(stroke) {
  return stroke && stroke.tool !== "eraser";
}
