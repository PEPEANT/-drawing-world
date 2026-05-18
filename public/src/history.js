import { addStroke, getOwnStrokes, isOwnStroke, replaceStrokes, state } from "./state.js";
import { saveLocalStrokes } from "./storage.js";

const undoStack = [];
const redoStack = [];
let sendToServer = () => {};

export function initHistory({ send }) {
  sendToServer = send;
}

export function recordStrokeAdd(stroke) {
  if (!isOwnStroke(stroke)) return;
  undoStack.push({ type: "add", stroke: cloneStroke(stroke) });
  redoStack.length = 0;
  trimHistory();
  emitHistoryChange();
}

export function recordStrokeDelete(strokes) {
  const ownStrokes = strokes.filter(isOwnStroke).map(cloneStroke);
  if (!ownStrokes.length) return;
  undoStack.push({ type: "delete", strokes: ownStrokes });
  redoStack.length = 0;
  trimHistory();
  emitHistoryChange();
}

export function recordStrokeSplit(removed, added) {
  const removedStrokes = removed.filter(Boolean).map(cloneStroke);
  const addedStrokes = added.filter(Boolean).map(cloneStroke);
  if (!removedStrokes.length && !addedStrokes.length) return;
  undoStack.push({ type: "split", removed: removedStrokes, added: addedStrokes });
  redoStack.length = 0;
  trimHistory();
  emitHistoryChange();
}

export function undoLastAction() {
  const action = undoStack.pop();
  if (!action) return;
  applyInverse(action);
  redoStack.push(action);
  emitHistoryChange();
}

export function redoLastAction() {
  const action = redoStack.pop();
  if (!action) return;
  applyAction(action);
  undoStack.push(action);
  emitHistoryChange();
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

function applyInverse(action) {
  if (action.type === "add") {
    removeStrokeIds([action.stroke.id]);
    return;
  }
  if (action.type === "delete") {
    restoreStrokes(action.strokes);
    return;
  }
  if (action.type === "split") {
    removeStrokeIds(action.added.map((stroke) => stroke.id));
    restoreStrokes(action.removed);
  }
}

function applyAction(action) {
  if (action.type === "add") {
    restoreStrokes([action.stroke]);
    return;
  }
  if (action.type === "delete") {
    removeStrokeIds(action.strokes.map((stroke) => stroke.id));
    return;
  }
  if (action.type === "split") {
    removeStrokeIds(action.removed.map((stroke) => stroke.id));
    restoreStrokes(action.added);
  }
}

function removeStrokeIds(ids) {
  const idSet = new Set(ids);
  if (!idSet.size) return;
  replaceStrokes(state.strokes.filter((stroke) => !idSet.has(stroke.id)));
  saveLocalStrokes(getOwnStrokes());
  sendToServer({ type: "deleteStrokes", ids: [...idSet] });
}

function restoreStrokes(strokes) {
  for (const stroke of strokes) {
    if (state.strokes.some((entry) => entry.id === stroke.id)) continue;
    const restored = { ...cloneStroke(stroke), author: state.socketId };
    addStroke(restored);
    sendToServer({ type: "stroke", stroke: restored });
  }
  saveLocalStrokes(getOwnStrokes());
}

function trimHistory() {
  if (undoStack.length > 80) undoStack.splice(0, undoStack.length - 80);
}

function cloneStroke(stroke) {
  return JSON.parse(JSON.stringify(stroke));
}

function emitHistoryChange() {
  window.dispatchEvent(new Event("historychanged"));
}
