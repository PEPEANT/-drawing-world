const fs = require("node:fs");
const path = require("node:path");
const { ROOT_DIR } = require("./config");

const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "ai-bot-conversations.json");
const SCHEMA_VERSION = 1;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MAX_DAYS_PER_ROOM = 30;
const MAX_EVENTS_PER_DAY = 100;

const store = loadStore();

function recordConversationEvent(roomName, event, now = Date.now()) {
  const room = safeRoom(roomName);
  const normalized = normalizeEvent(event);
  if (!room || !normalized) return getConversationSummary(roomName, now);
  const day = getDayKey(normalized.at || now);
  const dayStore = getDayStore(getRoomStore(room), day);
  const existingIndex = dayStore.events.findIndex((entry) => entry.id === normalized.id);
  if (existingIndex >= 0) {
    dayStore.events[existingIndex] = normalized;
  } else {
    dayStore.events.unshift(normalized);
    incrementStats(dayStore.intentStats, normalized.detectedIntent);
    incrementStats(dayStore.sourceStats, normalized.source);
    incrementStats(dayStore.resultStats, normalized.result);
    incrementStats(dayStore.actorStats, normalized.actor);
  }
  if (dayStore.events.length > MAX_EVENTS_PER_DAY) dayStore.events.length = MAX_EVENTS_PER_DAY;
  dayStore.latestSavedAt = Date.now();
  trimDays(store.rooms[room]);
  saveStore();
  return summarizeDay(day, dayStore);
}

function getConversationSummary(roomName, now = Date.now()) {
  const room = safeRoom(roomName);
  const day = getDayKey(now);
  const dayStore = room ? store.rooms[room]?.days?.[day] : null;
  return dayStore ? summarizeDay(day, dayStore) : emptySummary(day);
}

function getRecentConversationEvents(roomName, now = Date.now()) {
  const room = safeRoom(roomName);
  const day = getDayKey(now);
  const events = room ? store.rooms[room]?.days?.[day]?.events : null;
  return Array.isArray(events) ? events.slice(0, MAX_EVENTS_PER_DAY).map(cloneEvent) : [];
}

function flushConversationStore() {
  saveStore();
  return { ok: true, latestSavedAt: Date.now() };
}

function exportConversationStore(roomName = "") {
  const room = safeRoom(roomName);
  if (!room) return cloneStore(store);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    rooms: store.rooms[room] ? { [room]: cloneStore(store.rooms[room]) } : {}
  };
}

function getRoomStore(room) {
  if (!store.rooms[room]) store.rooms[room] = { days: {} };
  if (!store.rooms[room].days) store.rooms[room].days = {};
  return store.rooms[room];
}

function getDayStore(roomStore, day) {
  if (!roomStore.days[day]) roomStore.days[day] = emptyDay();
  const dayStore = roomStore.days[day];
  if (!Array.isArray(dayStore.events)) dayStore.events = [];
  dayStore.intentStats = normalizeStats(dayStore.intentStats);
  dayStore.sourceStats = normalizeStats(dayStore.sourceStats);
  dayStore.resultStats = normalizeStats(dayStore.resultStats);
  dayStore.actorStats = normalizeStats(dayStore.actorStats);
  dayStore.latestSavedAt = safeTime(dayStore.latestSavedAt);
  return dayStore;
}

function summarizeDay(day, dayStore) {
  const events = Array.isArray(dayStore?.events) ? dayStore.events : [];
  return {
    day,
    totalEvents: events.length,
    latestSavedAt: safeTime(dayStore?.latestSavedAt),
    topIntents: topStats(dayStore?.intentStats),
    sourceStats: topStats(dayStore?.sourceStats),
    resultStats: topStats(dayStore?.resultStats),
    recent: events.slice(0, 10).map(cloneEvent)
  };
}

function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { schemaVersion: SCHEMA_VERSION, rooms: normalizeRooms(data.rooms) };
  } catch {
    return { schemaVersion: SCHEMA_VERSION, rooms: {} };
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2));
  fs.renameSync(tmpFile, DATA_FILE);
}

function normalizeRooms(rooms) {
  const normalized = {};
  for (const [roomName, room] of Object.entries(rooms || {})) {
    const safe = safeRoom(roomName);
    if (!safe) continue;
    normalized[safe] = { days: normalizeDays(room?.days) };
  }
  return normalized;
}

function normalizeDays(days) {
  const normalized = {};
  for (const [day, dayStore] of Object.entries(days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    normalized[day] = {
      events: (Array.isArray(dayStore?.events) ? dayStore.events : [])
        .map(normalizeEvent)
        .filter(Boolean)
        .slice(0, MAX_EVENTS_PER_DAY),
      intentStats: normalizeStats(dayStore?.intentStats),
      sourceStats: normalizeStats(dayStore?.sourceStats),
      resultStats: normalizeStats(dayStore?.resultStats),
      actorStats: normalizeStats(dayStore?.actorStats),
      latestSavedAt: safeTime(dayStore?.latestSavedAt)
    };
  }
  return normalized;
}

function normalizeEvent(event) {
  if (!event || !Number.isFinite(event.at || event.createdAt)) return null;
  return {
    id: safeText(event.id, 80) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: safeTime(event.at || event.createdAt),
    source: safeText(event.source, 32) || "input",
    actor: safeText(event.actor, 16) || safeText(event.speakerType, 16) || "admin",
    rawText: safeText(event.rawText, 100),
    displayedText: safeText(event.displayedText, 120),
    detectedIntent: safeText(event.detectedIntent, 48) || "unknown",
    interestScore: safeNumber(event.interestScore),
    memoryNote: safeText(event.memoryNote, 160),
    nextAction: safeText(event.nextAction, 48),
    result: safeText(event.result, 24) || "queued",
    targetMode: safeText(event.targetMode, 32),
    targetUserId: safeText(event.targetUserId, 48),
    targetArtworkId: safeText(event.targetArtworkId, 80),
    targetPoint: safePoint(event.targetPoint),
    targetMeta: safeMeta(event.targetMeta)
  };
}

function incrementStats(stats, key) {
  const safe = safeText(key, 48) || "unknown";
  stats[safe] = (Number(stats[safe]) || 0) + 1;
}

function topStats(stats) {
  return Object.entries(normalizeStats(stats))
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "ko"))
    .slice(0, 5);
}

function trimDays(roomStore) {
  const days = Object.keys(roomStore.days).sort().reverse();
  for (const day of days.slice(MAX_DAYS_PER_ROOM)) delete roomStore.days[day];
}

function emptyDay() {
  return { events: [], intentStats: {}, sourceStats: {}, resultStats: {}, actorStats: {}, latestSavedAt: 0 };
}

function emptySummary(day) {
  return { day, totalEvents: 0, latestSavedAt: 0, topIntents: [], sourceStats: [], resultStats: [], recent: [] };
}

function cloneEvent(event) {
  return JSON.parse(JSON.stringify(event));
}

function cloneStore(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDayKey(now = Date.now()) {
  return new Date(Number(now) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function normalizeStats(stats) {
  const normalized = {};
  for (const [key, count] of Object.entries(stats || {})) normalized[safeText(key, 48)] = safeNumber(count);
  return normalized;
}

function safeMeta(meta) {
  if (!meta || typeof meta !== "object") return null;
  return {
    strokeCount: safeNumber(meta.strokeCount),
    pointCount: safeNumber(meta.pointCount),
    colorCount: safeNumber(meta.colorCount),
    drawingArea: safeNumber(meta.drawingArea),
    latestStrokeId: safeText(meta.latestStrokeId, 80)
  };
}

function safePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(0, Math.min(3200, Math.round(x))), y: Math.max(0, Math.min(2200, Math.round(y))) };
}

function safeTime(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function safeNumber(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function safeRoom(value) {
  return typeof value === "string" ? value.replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 32) : "";
}

function safeText(value, limit) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

module.exports = {
  exportConversationStore,
  flushConversationStore,
  getConversationSummary,
  getRecentConversationEvents,
  recordConversationEvent
};
