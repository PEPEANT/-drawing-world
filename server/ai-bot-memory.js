const fs = require("node:fs");
const path = require("node:path");
const { ROOT_DIR } = require("./config");

const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "ai-bot-memory.json");
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MAX_DAYS_PER_ROOM = 14;
const MAX_OBSERVATIONS_PER_DAY = 80;

const store = loadStore();

function recordAiObservation(roomName, bot, target, now = Date.now()) {
  const room = safeRoom(roomName);
  if (!room || !target) return getAiMemorySummary(roomName, now);
  const day = getDayKey(now);
  const roomMemory = getRoomMemory(room);
  const dayMemory = getDayMemory(roomMemory, day);

  dayMemory.observations.unshift({
    at: now,
    target: safeText(target.label, 32) || "관측 지점",
    intent: safeText(target.intent, 32) || "관측",
    score: safeScore(target.score),
    reason: safeText(target.reason, 80),
    x: Math.round(Number(bot?.x) || Number(target.x) || 0),
    y: Math.round(Number(bot?.y) || Number(target.y) || 0)
  });

  if (dayMemory.observations.length > MAX_OBSERVATIONS_PER_DAY) {
    dayMemory.observations.length = MAX_OBSERVATIONS_PER_DAY;
  }
  trimDays(roomMemory);
  saveStore();
  return summarizeDay(day, dayMemory);
}

function getAiMemorySummary(roomName, now = Date.now()) {
  const room = safeRoom(roomName);
  const day = getDayKey(now);
  if (!room || !store.rooms[room]?.days?.[day]) return emptySummary(day);
  return summarizeDay(day, store.rooms[room].days[day]);
}

function decorateAiBotMemory(bot, roomName) {
  if (!bot) return bot;
  bot.ai = { ...(bot.ai || {}), memory: getAiMemorySummary(roomName) };
  return bot;
}

function summarizeDay(day, dayMemory) {
  const observations = Array.isArray(dayMemory?.observations) ? dayMemory.observations : [];
  const counts = {};
  for (const entry of observations) {
    counts[entry.target] = (counts[entry.target] || 0) + 1;
  }
  return {
    day,
    total: observations.length,
    recent: observations.slice(0, 5).map(cloneObservation),
    targets: Object.entries(counts)
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count || a.target.localeCompare(b.target, "ko"))
      .slice(0, 5)
  };
}

function cloneObservation(entry) {
  return {
    at: entry.at,
    target: entry.target,
    intent: entry.intent,
    score: entry.score,
    reason: entry.reason,
    x: entry.x,
    y: entry.y
  };
}

function getRoomMemory(room) {
  if (!store.rooms[room]) store.rooms[room] = { days: {} };
  if (!store.rooms[room].days) store.rooms[room].days = {};
  return store.rooms[room];
}

function getDayMemory(roomMemory, day) {
  if (!roomMemory.days[day]) roomMemory.days[day] = { observations: [] };
  if (!Array.isArray(roomMemory.days[day].observations)) {
    roomMemory.days[day].observations = [];
  }
  return roomMemory.days[day];
}

function trimDays(roomMemory) {
  const days = Object.keys(roomMemory.days).sort().reverse();
  for (const day of days.slice(MAX_DAYS_PER_ROOM)) {
    delete roomMemory.days[day];
  }
}

function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { version: 1, rooms: normalizeRooms(data.rooms) };
  } catch {
    return { version: 1, rooms: {} };
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
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
  for (const [day, memory] of Object.entries(days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    normalized[day] = {
      observations: (Array.isArray(memory?.observations) ? memory.observations : [])
        .map(normalizeObservation)
        .filter(Boolean)
        .slice(0, MAX_OBSERVATIONS_PER_DAY)
    };
  }
  return normalized;
}

function normalizeObservation(entry) {
  if (!entry || !Number.isFinite(entry.at)) return null;
  return {
    at: entry.at,
    target: safeText(entry.target, 32) || "관측 지점",
    intent: safeText(entry.intent, 32) || "관측",
    score: safeScore(entry.score),
    reason: safeText(entry.reason, 80),
    x: Math.round(Number(entry.x) || 0),
    y: Math.round(Number(entry.y) || 0)
  };
}

function emptySummary(day) {
  return { day, total: 0, recent: [], targets: [] };
}

function getDayKey(now = Date.now()) {
  return new Date(Number(now) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function safeRoom(value) {
  return typeof value === "string" ? value.replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 32) : "";
}

function safeText(value, limit) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function safeScore(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

module.exports = {
  decorateAiBotMemory,
  getAiMemorySummary,
  recordAiObservation
};
