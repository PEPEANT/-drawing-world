const fs = require("node:fs");
const path = require("node:path");
const { ROOT_DIR } = require("./config");
const { safeText, sanitizeRoomName } = require("./validation");

const DATA_FILE = path.join(ROOT_DIR, "data", "rooms.json");
const SCHEMA_VERSION = 1;
const DEFAULT_ROOM = {
  slug: "lobby",
  name: "시뮬라크월드",
  description: "공용 그림 월드",
  hidden: false,
  locked: false
};

let store = loadStore();

function listRoomMetas() {
  ensureDefaultRoom();
  return Object.values(store.rooms)
    .map(cloneRoom)
    .sort((a, b) => {
      if (a.slug === "lobby") return -1;
      if (b.slug === "lobby") return 1;
      return (a.createdAt || 0) - (b.createdAt || 0) || a.slug.localeCompare(b.slug);
    });
}

function getRoomMeta(roomName) {
  const slug = sanitizeRoomName(roomName);
  ensureDefaultRoom();
  return cloneRoom(store.rooms[slug] || createFallbackRoom(slug));
}

function createManagedRoom(input = {}) {
  const slug = sanitizeRoomName(input.slug || input.name || input.displayName);
  const now = Date.now();
  const existing = store.rooms[slug];
  const room = normalizeRoom({
    ...existing,
    slug,
    name: safeRoomName(input.displayName || input.name || existing?.name || slug),
    description: safeDescription(input.description || existing?.description || ""),
    hidden: Boolean(existing?.hidden),
    locked: Boolean(existing?.locked),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  });
  store.rooms[slug] = room;
  saveStore();
  return cloneRoom(room);
}

function updateManagedRoom(roomName, patch = {}) {
  const slug = sanitizeRoomName(roomName);
  const current = store.rooms[slug] || createFallbackRoom(slug);
  const next = normalizeRoom({
    ...current,
    name: patch.displayName !== undefined ? safeRoomName(patch.displayName) : current.name,
    description: patch.description !== undefined ? safeDescription(patch.description) : current.description,
    hidden: patch.hidden !== undefined ? Boolean(patch.hidden) : current.hidden,
    locked: patch.locked !== undefined ? Boolean(patch.locked) : current.locked,
    updatedAt: Date.now()
  });
  store.rooms[slug] = next;
  saveStore();
  return cloneRoom(next);
}

function isRoomLocked(roomName) {
  return Boolean(getRoomMeta(roomName).locked);
}

function exportRoomRegistry() {
  ensureDefaultRoom();
  return normalizeStore(store);
}

function restoreRoomRegistry(incoming) {
  const normalized = normalizeStore(incoming);
  store = normalized;
  saveStore();
  return true;
}

function createFallbackRoom(slug) {
  const now = Date.now();
  return normalizeRoom({
    slug,
    name: slug === DEFAULT_ROOM.slug ? DEFAULT_ROOM.name : slug,
    description: slug === DEFAULT_ROOM.slug ? DEFAULT_ROOM.description : "",
    hidden: false,
    locked: false,
    createdAt: now,
    updatedAt: now
  });
}

function ensureDefaultRoom() {
  if (store.rooms?.lobby) return;
  const now = Date.now();
  store.rooms.lobby = normalizeRoom({ ...DEFAULT_ROOM, createdAt: now, updatedAt: now });
  saveStore();
}

function loadStore() {
  try {
    return normalizeStore(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  } catch {
    return normalizeStore({ schemaVersion: SCHEMA_VERSION, rooms: {} });
  }
}

function saveStore() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeStore(store), null, 2));
}

function normalizeStore(source = {}) {
  const rooms = {};
  for (const [key, value] of Object.entries(source.rooms || {})) {
    const room = normalizeRoom({ ...value, slug: value?.slug || key });
    if (room.slug) rooms[room.slug] = room;
  }
  const normalized = { schemaVersion: SCHEMA_VERSION, rooms };
  if (!normalized.rooms.lobby) {
    const now = Date.now();
    normalized.rooms.lobby = normalizeRoom({ ...DEFAULT_ROOM, createdAt: now, updatedAt: now });
  }
  return normalized;
}

function normalizeRoom(room = {}) {
  const slug = sanitizeRoomName(room.slug);
  const now = Date.now();
  return {
    slug,
    name: safeRoomName(room.name) || (slug === DEFAULT_ROOM.slug ? DEFAULT_ROOM.name : slug),
    description: safeDescription(room.description) || (slug === DEFAULT_ROOM.slug ? DEFAULT_ROOM.description : ""),
    hidden: slug === DEFAULT_ROOM.slug ? false : Boolean(room.hidden),
    locked: slug === DEFAULT_ROOM.slug ? false : Boolean(room.locked),
    createdAt: Number(room.createdAt) || now,
    updatedAt: Number(room.updatedAt) || Number(room.createdAt) || now
  };
}

function safeRoomName(value) {
  return safeText(value, 32);
}

function safeDescription(value) {
  return safeText(value, 64);
}

function cloneRoom(room) {
  return { ...room };
}

module.exports = {
  createManagedRoom,
  exportRoomRegistry,
  getRoomMeta,
  isRoomLocked,
  listRoomMetas,
  restoreRoomRegistry,
  updateManagedRoom
};
