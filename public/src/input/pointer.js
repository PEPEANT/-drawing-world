import { addStroke, getOwnStrokes, player, state } from "../state.js";
import { eraseOwnStrokes } from "../eraser.js";
import { recordStrokeAdd, recordStrokeDelete } from "../history.js";
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
    const point = screenToWorld(event.clientX, event.clientY);
    if (handleVotePointer(clampPoint(point), event)) {
      cancelPointer();
      return;
    }
    if (handleItemPointer(clampPoint(point), send)) {
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
      points: [clampPoint(point)]
    };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.currentStroke || event.pointerId !== state.activePointerId) return;
    const point = clampPoint(screenToWorld(event.clientX, event.clientY));
    const last = state.currentStroke.points[state.currentStroke.points.length - 1];
    if (distance(last, point) >= 2 / state.camera.zoom) {
      state.currentStroke.points.push(point);
    }
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
  if (state.currentStroke.tool === "eraser") {
    finishEraserStroke(send);
    return;
  }
  if (state.currentStroke.points.length > 1) {
    const stroke = state.currentStroke;
    addStroke(state.currentStroke);
    recordStrokeAdd(stroke);
    saveLocalStrokes(getOwnStrokes());
    send({ type: "stroke", stroke });
  }
  state.currentStroke = null;
  state.activePointerId = null;
}

function finishEraserStroke(send) {
  if (state.currentStroke.points.length > 1) {
    const previousStrokes = new Map(state.strokes.map((stroke) => [stroke.id, stroke]));
    const ids = eraseOwnStrokes(state.currentStroke);
    if (ids.length) {
      recordStrokeDelete(ids.map((id) => previousStrokes.get(id)).filter(Boolean));
      saveLocalStrokes(getOwnStrokes());
      send({ type: "deleteStrokes", ids });
    }
  }
  state.currentStroke = null;
  state.activePointerId = null;
}
