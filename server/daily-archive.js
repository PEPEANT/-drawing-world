const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT_DIR } = require("./config");
const { buildFeaturedTop } = require("./featured");

const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "daily-snapshots.json");
const MAX_SNAPSHOTS = 80;
const MAX_POINTS_PER_STROKE = 700;

const store = loadStore();

function createDailySnapshot(room, reason = "manual", day = getDayKey()) {
  const strokes = room.strokes.filter(isDrawableStroke).map(cloneStroke);
  if (!strokes.length) return null;
  const bounds = getBounds(strokes);
  const snapshot = {
    id: crypto.randomUUID(),
    version: 1,
    day,
    room: room.name,
    title: `${displayRoomName(room.name)} ${day}`,
    reason,
    savedAt: Date.now(),
    locked: true,
    strokeCount: strokes.length,
    itemCount: room.items.length,
    featuredCount: buildFeaturedTop(room).length,
    bounds,
    strokes,
    items: room.items.map(cloneItem),
    featured: buildFeaturedTop(room),
    players: Array.from(room.players.values()).map(clonePlayer)
  };
  saveDailySnapshot(snapshot);
  return snapshot;
}

function saveDailySnapshot(snapshot) {
  if (!snapshot?.id || !Array.isArray(snapshot.strokes) || !snapshot.strokes.length) return null;
  const existing = store.snapshots.findIndex((entry) => entry.id === snapshot.id);
  if (existing >= 0) store.snapshots.splice(existing, 1);
  store.snapshots.unshift(snapshot);
  if (store.snapshots.length > MAX_SNAPSHOTS) store.snapshots.length = MAX_SNAPSHOTS;
  saveStore();
  return snapshot;
}

function listDailySnapshots(limit = 40) {
  return store.snapshots.slice(0, limit).map((snapshot) => ({
    id: snapshot.id,
    day: snapshot.day,
    room: snapshot.room,
    title: snapshot.title,
    reason: snapshot.reason,
    savedAt: snapshot.savedAt,
    strokeCount: snapshot.strokeCount || snapshot.strokes?.length || 0,
    itemCount: snapshot.itemCount || snapshot.items?.length || 0,
    featuredCount: snapshot.featuredCount || snapshot.featured?.length || 0,
    locked: snapshot.locked !== false,
    bounds: snapshot.bounds
  }));
}

function getDailySnapshot(id) {
  return store.snapshots.find((snapshot) => snapshot.id === id) || null;
}

function isDrawableStroke(stroke) {
  return stroke && stroke.tool !== "eraser" && Array.isArray(stroke.points) && stroke.points.length;
}

function cloneStroke(stroke) {
  return {
    id: stroke.id,
    author: stroke.author,
    owner: stroke.owner,
    name: stroke.name || "",
    color: stroke.color,
    size: stroke.size,
    tool: stroke.tool,
    brush: stroke.brush,
    layerId: stroke.layerId,
    order: stroke.order,
    points: samplePoints(stroke.points || [])
  };
}

function cloneItem(item) {
  return {
    id: item.id,
    author: item.author,
    owner: item.owner,
    type: item.type,
    title: item.title,
    x: item.x,
    y: item.y
  };
}

function clonePlayer(player) {
  return {
    id: player.id,
    clientId: player.clientId,
    name: player.name,
    color: player.color,
    x: player.x,
    y: player.y
  };
}

function samplePoints(points) {
  if (points.length <= MAX_POINTS_PER_STROKE) return points.map(clonePoint);
  const step = Math.ceil(points.length / MAX_POINTS_PER_STROKE);
  const sampled = points.filter((_, index) => index % step === 0).map(clonePoint);
  sampled.push(clonePoint(points[points.length - 1]));
  return sampled;
}

function clonePoint(point) {
  return { x: point.x, y: point.y, pressure: point.pressure };
}

function getBounds(strokes) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke.points || []) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
      top = Math.min(top, point.y);
      bottom = Math.max(bottom, point.y);
    }
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, width: 3200, height: 2200 };
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { snapshots: Array.isArray(data.snapshots) ? data.snapshots : [] };
  } catch {
    return { snapshots: [] };
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function displayRoomName(roomName) {
  return roomName === "lobby" ? "시뮬라크월드" : roomName;
}

function getDayKey(now = Date.now()) {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

module.exports = {
  createDailySnapshot,
  getDailySnapshot,
  listDailySnapshots
};
