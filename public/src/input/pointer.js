import { addStroke, getOwnStrokes, player, state } from "../state.js";
import { eraseOwnStrokes } from "../eraser.js";
import { recordStrokeAdd, recordStrokeSplit } from "../history.js";
import { saveLocalStrokes } from "../storage.js";
import { ui } from "../ui/dom.js";
import { handleItemPointer } from "../ui/item-panel.js";
import { handleVotePointer } from "../ui/ranking.js";
import { canvas, clampPoint, screenToWorld } from "../render.js";
import { PAPER_COLOR } from "../config.js";
import { distance } from "../utils.js";

export function bindPointer({ send }) {
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    state.activePointerId = event.pointerId;
    canvas.setPointerCapture(state.activePointerId);
    const point = toStrokePoint(event);
    if (handleVotePointer(point, event)) {
      cancelPointer();
      return;
    }
    if (handleItemPointer(point, send)) {
      cancelPointer();
      return;
    }
    if (state.tool !== "brush" && state.tool !== "eraser") {
      cancelPointer();
      return;
    }
    state.currentStroke = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      author: state.socketId,
      owner: player.clientId,
      layerId: state.activeLayerId,
      color: state.tool === "eraser" ? PAPER_COLOR : ui.colorInput.value,
      size: state.tool === "eraser" ? state.eraserSize : Number(ui.sizeInput.value),
      tool: state.tool,
      brush: state.tool === "eraser" ? state.eraserType : state.brushType,
      points: [point]
    };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.currentStroke || event.pointerId !== state.activePointerId) return;
    addPointerPoints(event);
  });

  canvas.addEventListener("pointerup", (event) => finishCurrentStroke(event, send));
  canvas.addEventListener("pointercancel", (event) => finishCurrentStroke(event, send));

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    state.targetCamera.zoom = Math.max(0.55, Math.min(1.8, state.targetCamera.zoom + direction * 0.08));
  }, { passive: false });
}

function cancelPointer() {
  if (canvas.hasPointerCapture(state.activePointerId)) {
    canvas.releasePointerCapture(state.activePointerId);
  }
  state.activePointerId = null;
}

function finishCurrentStroke(event, send) {
  if (!state.currentStroke || event.pointerId !== state.activePointerId) return;
  addPointerPoints(event);
  if (state.currentStroke.tool === "eraser") {
    finishEraserStroke(send);
    return;
  }
  if (state.currentStroke.points.length > 0) {
    const stroke = state.currentStroke;
    addStroke(state.currentStroke);
    recordStrokeAdd(stroke);
    saveLocalStrokes(getOwnStrokes());
    send({ type: "stroke", stroke });
  }
  releasePointer();
  state.currentStroke = null;
  state.activePointerId = null;
}

function finishEraserStroke(send) {
  if (state.currentStroke.points.length > 0) {
    const previousStrokes = new Map(state.strokes.map((stroke) => [stroke.id, stroke]));
    const erased = eraseOwnStrokes(state.currentStroke);
    if (erased.ids.length || erased.added.length) {
      recordStrokeSplit(erased.ids.map((id) => previousStrokes.get(id)).filter(Boolean), erased.added);
      saveLocalStrokes(getOwnStrokes());
      if (erased.ids.length) send({ type: "deleteStrokes", ids: erased.ids });
      for (const stroke of erased.added) send({ type: "stroke", stroke });
    }
  }
  releasePointer();
  state.currentStroke = null;
  state.activePointerId = null;
}

function addPointerPoints(event) {
  for (const sample of getPointerSamples(event)) {
    const point = toStrokePoint(sample);
    const last = state.currentStroke.points[state.currentStroke.points.length - 1];
    if (!last || distance(last, point) >= 2 / state.camera.zoom) {
      state.currentStroke.points.push(point);
    }
  }
}

function getPointerSamples(event) {
  return typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
}

function toStrokePoint(event) {
  const point = clampPoint(screenToWorld(event.clientX, event.clientY));
  point.pressure = normalizePressure(event);
  return point;
}

function normalizePressure(event) {
  if (event.pointerType === "pen" && Number.isFinite(event.pressure)) return Math.max(0, Math.min(1, event.pressure));
  return 0.5;
}

function releasePointer() {
  if (canvas.hasPointerCapture(state.activePointerId)) canvas.releasePointerCapture(state.activePointerId);
}
