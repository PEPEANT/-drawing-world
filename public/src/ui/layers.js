import {
  addLayer,
  deleteLayer,
  getLayer,
  getStrokeLayerId,
  replaceStrokes,
  setActiveLayer,
  state,
  updateLayer
} from "../state.js";
import { saveLocalStrokes } from "../storage.js";
import { ui } from "./dom.js";

let sendToServer = () => {};

export function initLayerPanel({ send }) {
  sendToServer = send;
  ui.layerAddButton.addEventListener("click", () => {
    addLayer();
  });
  ui.layerOpacityInput.addEventListener("input", () => {
    const opacity = Number(ui.layerOpacityInput.value) / 100;
    updateLayer(state.activeLayerId, { opacity });
  });
  ui.layerClearButton.addEventListener("click", () => {
    clearLayerStrokes(state.activeLayerId);
  });
  ui.layerDeleteButton.addEventListener("click", () => {
    const layerId = state.activeLayerId;
    if (state.layers.length <= 1) return;
    clearLayerStrokes(layerId);
    deleteLayer(layerId);
    saveLocalStrokes(state.strokes);
  });
  window.addEventListener("layerschanged", renderLayerPanel);
  renderLayerPanel();
  closeLayerPanel();
}

export function openLayerPanel() {
  ui.layerPanel.classList.remove("hidden");
}

export function closeLayerPanel() {
  ui.layerPanel.classList.add("hidden");
}

export function renderLayerPanel() {
  const activeLayer = getLayer(state.activeLayerId) || state.layers[0];
  ui.layerList.replaceChildren();

  for (const layer of [...state.layers].reverse()) {
    ui.layerList.append(renderLayerItem(layer));
  }

  ui.layerOpacityInput.value = Math.round((activeLayer?.opacity || 1) * 100);
  ui.layerOpacityOutput.textContent = `${ui.layerOpacityInput.value}%`;
  ui.layerDeleteButton.disabled = state.layers.length <= 1;
}

function renderLayerItem(layer) {
  const item = document.createElement("div");
  item.className = `layer-item ${layer.id === state.activeLayerId ? "active" : ""}`;
  item.addEventListener("click", () => setActiveLayer(layer.id));

  const preview = document.createElement("canvas");
  preview.className = "layer-preview";
  preview.width = 64;
  preview.height = 36;
  drawLayerPreview(preview, layer);

  const name = document.createElement("input");
  name.className = "layer-name-input";
  name.value = layer.name;
  name.maxLength = 24;
  name.addEventListener("click", (event) => event.stopPropagation());
  name.addEventListener("change", () => {
    updateLayer(layer.id, { name: name.value.trim() || layer.name });
  });

  const visibility = document.createElement("button");
  visibility.type = "button";
  visibility.textContent = layer.visible ? "보기" : "숨김";
  visibility.className = layer.visible ? "" : "muted";
  visibility.addEventListener("click", (event) => {
    event.stopPropagation();
    updateLayer(layer.id, { visible: !layer.visible });
  });

  item.append(preview, name, visibility);
  return item;
}

function clearLayerStrokes(layerId) {
  replaceStrokes(state.strokes.filter((stroke) => getStrokeLayerId(stroke) !== layerId));
  saveLocalStrokes(state.strokes);
  sendToServer({ type: "clearLayer", layerId });
}

function drawLayerPreview(canvas, layer) {
  const ctx = canvas.getContext("2d");
  const strokes = state.strokes.filter((stroke) => getStrokeLayerId(stroke) === layer.id);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!strokes.length) return;

  const bounds = getStrokeBounds(strokes);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((canvas.width - 8) / width, (canvas.height - 8) / height);
  const offsetX = (canvas.width - width * scale) / 2 - bounds.minX * scale;
  const offsetY = (canvas.height - height * scale) / 2 - bounds.minY * scale;

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    drawPreviewStroke(ctx, stroke, scale, offsetX, offsetY);
  }
  ctx.restore();
}

function drawPreviewStroke(ctx, stroke, scale, offsetX, offsetY) {
  const points = stroke.points || [];
  if (points.length < 2) return;
  ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
  ctx.lineWidth = Math.max(1, stroke.size * scale);
  ctx.beginPath();
  ctx.moveTo(points[0].x * scale + offsetX, points[0].y * scale + offsetY);
  for (const point of points.slice(1)) {
    ctx.lineTo(point.x * scale + offsetX, point.y * scale + offsetY);
  }
  ctx.stroke();
}

function getStrokeBounds(strokes) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const stroke of strokes) {
    for (const point of stroke.points || []) {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    }
  }
  return bounds;
}
