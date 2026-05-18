import { CLIENT_LIMITS, PALETTE, STORAGE_KEYS, WORLD, isSpectatorMode } from "./config.js";
import { mergeStroke, sortStrokes } from "./stroke-list.js";

export const DEFAULT_LAYER_ID = "layer-1";

export const state = {
  dpr: 1,
  viewport: { width: window.innerWidth, height: window.innerHeight },
  camera: { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1 },
  targetCamera: { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1 },
  keys: new Set(),
  mobileMove: { x: 0, y: 0 },
  strokes: [],
  items: [],
  layers: loadSavedLayers(),
  activeLayerId: localStorage.getItem(STORAGE_KEYS.activeLayer) || DEFAULT_LAYER_ID,
  remotePlayers: new Map(),
  chatBubbles: new Map(),
  voteBubbles: new Map(),
  ranking: [],
  featured: [],
  voteTargetId: null,
  votePoint: null,
  isSpectator: isSpectatorMode(),
  gameStarted: isSpectatorMode(),
  currentStroke: null,
  activePointerId: null,
  tool: "none",
  brushType: localStorage.getItem("drawing-online:brush-type") || "round",
  eraserType: localStorage.getItem("drawing-online:eraser-type") || "round",
  eraserSize: Number(localStorage.getItem("drawing-online:eraser-size")) || 18,
  itemType: localStorage.getItem("drawing-online:item-type") || "flag",
  selectedItemId: null,
  online: false,
  socketId: "local",
  lastPositionSent: 0
};

export const player = {
  id: "local",
  clientId: getClientId(),
  name: getSavedValue(STORAGE_KEYS.name, STORAGE_KEYS.legacyName) || randomGuestName(),
  color: getSavedValue(STORAGE_KEYS.color, STORAGE_KEYS.legacyColor) || randomPaletteColor(),
  skin: localStorage.getItem(STORAGE_KEYS.skin) || "",
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  facing: 1,
  moving: false
};

if (!getLayer(state.activeLayerId)) {
  state.activeLayerId = state.layers[0].id;
}

export function setSocketId(id) {
  state.socketId = id;
  player.id = id;
}

export function replaceStrokes(nextStrokes) {
  state.strokes = Array.isArray(nextStrokes) ? sortStrokes(nextStrokes) : [];
  syncLayersFromStrokes();
  emitLayerChange();
}

export function addStroke(stroke) {
  state.strokes = mergeStroke(state.strokes, stroke);
  if (isOwnStroke(stroke)) ensureLayer(stroke.layerId || DEFAULT_LAYER_ID);
  trimStrokes();
  emitLayerChange();
}

export function replaceItems(nextItems) {
  state.items = Array.isArray(nextItems) ? nextItems : [];
}

export function removeItemsByIds(ids) {
  const removedIds = new Set(Array.isArray(ids) ? ids : []);
  if (!removedIds.size) return [];
  const removed = state.items.filter((item) => removedIds.has(item.id));
  state.items = state.items.filter((item) => !removedIds.has(item.id));
  return removed;
}

export function addItem(item) {
  state.items.push(item);
}

export function getItem(id) {
  return state.items.find((item) => item.id === id);
}

export function findItemAt(point) {
  for (let i = state.items.length - 1; i >= 0; i -= 1) {
    const item = state.items[i];
    const radius = item.type === "radio" ? 36 : 42;
    if (Math.hypot(item.x - point.x, item.y - point.y) <= radius) return item;
  }
  return null;
}

export function trimStrokes() {
  if (state.strokes.length > CLIENT_LIMITS.activeStrokes) {
    state.strokes = state.strokes.slice(-CLIENT_LIMITS.activeStrokes);
  }
}

export function addLayer() {
  if (state.layers.length >= CLIENT_LIMITS.layersPerPlayer) return null;
  const layer = createLayer(`layer-${Date.now()}`, `레이어 ${state.layers.length + 1}`);
  state.layers.push(layer);
  setActiveLayer(layer.id);
  saveLayers();
  emitLayerChange();
  return layer;
}

export function updateLayer(id, patch) {
  const layer = getLayer(id);
  if (!layer) return;
  const nextPatch = normalizeLayerPatch(patch, layer);
  Object.assign(layer, nextPatch);
  saveLayers();
  emitLayerChange();
}

export function deleteLayer(id) {
  if (state.layers.length <= 1) return;
  state.layers = state.layers.filter((layer) => layer.id !== id);
  state.strokes = state.strokes.filter((stroke) => !isOwnStroke(stroke) || getStrokeLayerId(stroke) !== id);
  if (state.activeLayerId === id) state.activeLayerId = state.layers[0].id;
  saveLayers();
  emitLayerChange();
}

export function setActiveLayer(id) {
  if (!getLayer(id)) return;
  state.activeLayerId = id;
  localStorage.setItem(STORAGE_KEYS.activeLayer, id);
  emitLayerChange();
}

export function ensureLayer(id) {
  if (!id || getLayer(id)) return;
  if (state.layers.length >= CLIENT_LIMITS.layersPerPlayer) return;
  state.layers.push(createLayer(id, `레이어 ${state.layers.length + 1}`));
  saveLayers();
}

export function getLayer(id) {
  return state.layers.find((layer) => layer.id === id);
}

export function getStrokeLayerId(stroke) {
  return stroke?.layerId || DEFAULT_LAYER_ID;
}

export function isOwnStroke(stroke) {
  if (!stroke) return false;
  return (
    stroke.author === state.socketId ||
    stroke.author === player.id ||
    stroke.author === "local" ||
    stroke.owner === player.clientId
  );
}

export function getOwnStrokes() {
  return state.strokes.filter(isOwnStroke);
}

function loadSavedLayers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.layers) || "[]");
    const layers = saved.filter(isValidLayer).map((layer) => ({
      id: layer.id,
      name: layer.name.slice(0, 24),
      visible: layer.visible !== false,
      opacity: clampOpacity(layer.opacity)
    }));
    return layers.length ? layers.slice(0, CLIENT_LIMITS.layersPerPlayer) : [createLayer(DEFAULT_LAYER_ID, "레이어 1")];
  } catch {
    return [createLayer(DEFAULT_LAYER_ID, "레이어 1")];
  }
}

function normalizeLayerPatch(patch, layer) {
  const nextPatch = { ...patch };
  if (typeof nextPatch.name === "string") {
    nextPatch.name = nextPatch.name.trim().slice(0, 24) || layer.name;
  }
  if ("opacity" in nextPatch) {
    nextPatch.opacity = clampOpacity(nextPatch.opacity);
  }
  return nextPatch;
}

function syncLayersFromStrokes() {
  for (const stroke of state.strokes) {
    if (isOwnStroke(stroke)) ensureLayer(getStrokeLayerId(stroke));
  }
}

function saveLayers() {
  localStorage.setItem(STORAGE_KEYS.layers, JSON.stringify(state.layers));
  localStorage.setItem(STORAGE_KEYS.activeLayer, state.activeLayerId);
}

function createLayer(id, name) {
  return { id, name, visible: true, opacity: 1 };
}

function isValidLayer(layer) {
  return layer && typeof layer.id === "string" && typeof layer.name === "string";
}

function clampOpacity(value) {
  return Math.max(0.1, Math.min(1, Number(value) || 1));
}

function emitLayerChange() {
  window.dispatchEvent(new Event("layerschanged"));
}

function getSavedValue(primaryKey, legacyKey) {
  return localStorage.getItem(primaryKey) || localStorage.getItem(legacyKey);
}

function randomGuestName() {
  return `guest-${Math.floor(1000 + Math.random() * 9000)}`;
}

function randomPaletteColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function getClientId() {
  const saved = localStorage.getItem(STORAGE_KEYS.clientId);
  if (saved) return saved;
  const id = crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random()}`;
  localStorage.setItem(STORAGE_KEYS.clientId, id);
  return id;
}
