import { clampPoint, screenToWorld } from "../render.js";
import { state } from "../state.js";
import { ui } from "./dom.js";
import { findVoteTarget } from "./ranking.js";

let targetCanvas = null;

export function initCanvasCursor(canvas) {
  targetCanvas = canvas;
  canvas.addEventListener("pointermove", syncHoverCursor);
  canvas.addEventListener("pointerleave", updateToolCursor);
  updateToolCursor();
}

export function updateToolCursor() {
  if (!targetCanvas) return;
  targetCanvas.style.cursor = getToolCursor();
}

function syncHoverCursor(event) {
  if (!targetCanvas) return;
  if (state.tool !== "none") {
    updateToolCursor();
    return;
  }
  const point = clampPoint(screenToWorld(event.clientX, event.clientY));
  targetCanvas.style.cursor = findVoteTarget(point) ? "pointer" : "default";
}

function getToolCursor() {
  if (state.tool === "brush") return makeBrushCursor();
  if (state.tool === "eraser") return makeEraserCursor();
  if (state.tool === "item") return "copy";
  return "default";
}

function makeBrushCursor() {
  const size = Number(ui.sizeInput.value) || 8;
  const type = state.brushType;
  const color = ui.colorInput.value || "#111827";
  if (type === "square") return makeSvgCursor(squareSvg(size, color), size);
  if (type === "spray") return makeSvgCursor(spraySvg(size, color), size);
  if (type === "marker") return makeSvgCursor(circleSvg(size * 1.7, color, 0.28), size * 1.7);
  return makeSvgCursor(circleSvg(size, color, 0.18), size);
}

function makeEraserCursor() {
  const size = state.eraserSize || 18;
  if (state.eraserType === "square") return makeSvgCursor(squareSvg(size, "#ffffff", true), size);
  if (state.eraserType === "spray") return makeSvgCursor(spraySvg(size, "#ffffff", true), size);
  return makeSvgCursor(circleSvg(size, "#ffffff", 0.9, true), size);
}

function makeSvgCursor(svg, rawSize) {
  const size = Math.max(12, Math.min(80, Math.round(rawSize + 10)));
  const hotspot = Math.round(size / 2);
  const encoded = encodeURIComponent(svg.replaceAll("\n", "").trim());
  return `url("data:image/svg+xml,${encoded}") ${hotspot} ${hotspot}, crosshair`;
}

function circleSvg(rawSize, color, alpha, eraser = false) {
  const box = Math.max(16, Math.min(88, Math.round(rawSize + 10)));
  const r = Math.max(3, Math.min(36, rawSize / 2));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
    <circle cx="${box / 2}" cy="${box / 2}" r="${r}" fill="${color}" fill-opacity="${alpha}" stroke="${eraser ? "#111827" : color}" stroke-width="2"/>
  </svg>`;
}

function squareSvg(rawSize, color, eraser = false) {
  const box = Math.max(16, Math.min(88, Math.round(rawSize + 10)));
  const size = Math.max(4, Math.min(72, rawSize));
  const offset = (box - size) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
    <rect x="${offset}" y="${offset}" width="${size}" height="${size}" fill="${color}" fill-opacity="${eraser ? 0.9 : 0.2}" stroke="${eraser ? "#111827" : color}" stroke-width="2"/>
  </svg>`;
}

function spraySvg(rawSize, color, eraser = false) {
  const box = Math.max(20, Math.min(88, Math.round(rawSize + 14)));
  const center = box / 2;
  const stroke = eraser ? "#111827" : color;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
    <circle cx="${center}" cy="${center}" r="${rawSize / 2}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="3 3"/>
    <circle cx="${center - 6}" cy="${center - 2}" r="2.2" fill="${color}" stroke="${stroke}" stroke-width="${eraser ? 1 : 0}"/>
    <circle cx="${center + 5}" cy="${center - 7}" r="1.8" fill="${color}" stroke="${stroke}" stroke-width="${eraser ? 1 : 0}"/>
    <circle cx="${center + 4}" cy="${center + 6}" r="2" fill="${color}" stroke="${stroke}" stroke-width="${eraser ? 1 : 0}"/>
  </svg>`;
}
