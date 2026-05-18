const fs = require("node:fs");
const path = require("node:path");
const { ROOT_DIR } = require("./config");

const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "featured-drawings.json");
const MAX_ARCHIVE = 120;
const MAX_ACTIVE_ROOMS = 60;
const MAX_ACTIVE_CANDIDATES = 40;

const store = loadStore();

function addArchiveEntries(entries) {
  const existing = new Set(store.archive.map((entry) => entry.archiveId));
  let changed = false;

  for (const entry of entries) {
    const archiveId = entry.archiveId || `${entry.day}:${entry.room}:${entry.id}`;
    if (existing.has(archiveId)) continue;
    store.archive.unshift({ ...entry, archiveId, savedAt: Date.now() });
    existing.add(archiveId);
    changed = true;
  }

  if (store.archive.length > MAX_ARCHIVE) {
    store.archive.length = MAX_ARCHIVE;
    changed = true;
  }
  if (changed) saveStore();
}

function listArchive(limit = 36) {
  return store.archive.slice(0, limit);
}

function loadActiveRoom(roomName) {
  const key = safeRoomKey(roomName);
  return key ? store.active[key] || null : null;
}

function saveActiveRoom(roomName, state) {
  const key = safeRoomKey(roomName);
  if (!key) return;
  const candidates = serializeCandidates(state?.candidates || []);
  if (!candidates.length) {
    deleteActiveRoom(key);
    return;
  }
  store.active[key] = { day: state.day, savedAt: Date.now(), candidates };
  trimActiveRooms();
  saveStore();
}

function deleteActiveRoom(roomName) {
  const key = safeRoomKey(roomName);
  if (!key || !store.active[key]) return;
  delete store.active[key];
  saveStore();
}

function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      archive: Array.isArray(data.archive) ? data.archive : [],
      active: data.active && typeof data.active === "object" ? data.active : {}
    };
  } catch {
    return { archive: [], active: {} };
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function serializeCandidates(candidates) {
  return candidates
    .slice()
    .filter((entry) => entry?.likes > 0 && Array.isArray(entry.strokes) && entry.strokes.length)
    .sort((a, b) => b.likes - a.likes || b.updatedAt - a.updatedAt)
    .slice(0, MAX_ACTIVE_CANDIDATES)
    .map((entry) => ({
      ...entry,
      voters: Array.from(entry.voters || [])
    }));
}

function trimActiveRooms() {
  const rooms = Object.entries(store.active)
    .sort((a, b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0));
  for (const [roomName] of rooms.slice(MAX_ACTIVE_ROOMS)) {
    delete store.active[roomName];
  }
}

function safeRoomKey(value) {
  return typeof value === "string" ? value.replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 32) : "";
}

module.exports = {
  addArchiveEntries,
  deleteActiveRoom,
  listArchive,
  loadActiveRoom,
  saveActiveRoom
};
