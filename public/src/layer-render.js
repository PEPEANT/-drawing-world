import { DEFAULT_LAYER_ID, getStrokeLayerId, state } from "./state.js";

export function drawLayeredStrokes(ctx, drawStroke) {
  const layers = state.layers.length ? state.layers : [getFallbackLayer()];
  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    drawLayerStrokes(ctx, layer.id, drawStroke);
    ctx.restore();
  }
}

function drawLayerStrokes(ctx, layerId, drawStroke) {
  for (const stroke of state.strokes) {
    if (isVisibleStroke(stroke, layerId)) {
      drawStroke(ctx, stroke);
    }
  }
  const currentStroke = state.currentStroke;
  if (isVisibleStroke(currentStroke, layerId)) {
    drawStroke(ctx, currentStroke);
  }
}

function getFallbackLayer() {
  return { id: DEFAULT_LAYER_ID, visible: true, opacity: 1 };
}

function isVisibleStroke(stroke, layerId) {
  return stroke && stroke.tool !== "eraser" && getStrokeLayerId(stroke) === layerId;
}
