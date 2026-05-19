const fs = require("node:fs");
const path = require("node:path");
const { ROOT_DIR } = require("./config");
const { setAiState } = require("./ai-bot-state");

const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "ai-bot-memory.json");
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MAX_DAYS_PER_ROOM = 14;
const MAX_OBSERVATIONS_PER_DAY = 80;
const MEANINGFUL_SCORE_DELTA = 10;
const SAME_TARGET_LOG_MS = 5 * 60 * 1000;

const store = loadStore();

function recordAiObservation(roomName, bot, target, now = Date.now()) {
  const room = safeRoom(roomName);
  if (!room || !target) return getAiMemorySummary(roomName, now);
  const day = getDayKey(now);
  const roomMemory = getRoomMemory(room);
  const dayMemory = getDayMemory(roomMemory, day);
  const targetName = safeText(target.label, 32) || "관측 지점";
  const score = safeScore(target.score);
  const aggregate = updateTargetSummary(dayMemory, targetName, target, bot, score, now);

  if (shouldStoreObservation(dayMemory.observations[0], targetName, score, now)) {
    dayMemory.observations.unshift({
      at: now,
      target: formatTargetSummary(aggregate),
      baseTarget: targetName,
      intent: safeText(target.intent, 32) || "관측",
      score,
      reason: safeText(target.reason, 80),
      x: Math.round(Number(bot?.x) || Number(target.x) || 0),
      y: Math.round(Number(bot?.y) || Number(target.y) || 0)
    });
  }

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
  setAiState(bot, { memory: getAiMemorySummary(roomName) }, roomName);
  return bot;
}

function summarizeDay(day, dayMemory) {
  const observations = Array.isArray(dayMemory?.observations) ? dayMemory.observations : [];
  const targets = Object.values(dayMemory?.targets || {});
  const total = targets.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0) || observations.length;
  return {
    day,
    total,
    recent: buildRecentSummaries(observations, targets),
    targets: targets
      .map((entry) => ({
        target: entry.target,
        count: entry.count,
        lastSeenAt: entry.lastSeenAt,
        maxScore: entry.maxScore
      }))
      .sort((a, b) => b.count - a.count || a.target.localeCompare(b.target, "ko"))
      .slice(0, 5)
  };
}

function cloneObservation(entry) {
  return {
    at: entry.at,
    target: entry.target,
    baseTarget: entry.baseTarget || entry.target,
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
  if (!roomMemory.days[day]) roomMemory.days[day] = { observations: [], targets: {} };
  if (!Array.isArray(roomMemory.days[day].observations)) {
    roomMemory.days[day].observations = [];
  }
  if (!roomMemory.days[day].targets || typeof roomMemory.days[day].targets !== "object") {
    roomMemory.days[day].targets = buildTargetsFromObservations(roomMemory.days[day].observations);
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
        .slice(0, MAX_OBSERVATIONS_PER_DAY),
      targets: normalizeTargets(memory?.targets, memory?.observations)
    };
  }
  return normalized;
}

function normalizeObservation(entry) {
  if (!entry || !Number.isFinite(entry.at)) return null;
  return {
    at: entry.at,
    target: safeText(entry.target, 32) || "관측 지점",
    baseTarget: safeText(entry.baseTarget, 32) || safeText(entry.target, 32) || "관측 지점",
    intent: safeText(entry.intent, 32) || "관측",
    score: safeScore(entry.score),
    reason: safeText(entry.reason, 80),
    x: Math.round(Number(entry.x) || 0),
    y: Math.round(Number(entry.y) || 0)
  };
}

function normalizeTargets(targets, observations = []) {
  if (targets && typeof targets === "object" && !Array.isArray(targets)) {
    const normalized = {};
    for (const [key, entry] of Object.entries(targets)) {
      const target = safeText(entry?.target || key, 32);
      if (!target) continue;
      normalized[target] = {
        target,
        count: Math.max(1, safeScore(entry.count) || 1),
        firstSeenAt: Number.isFinite(entry.firstSeenAt) ? entry.firstSeenAt : Date.now(),
        lastSeenAt: Number.isFinite(entry.lastSeenAt) ? entry.lastSeenAt : Date.now(),
        minScore: safeScore(entry.minScore),
        maxScore: safeScore(entry.maxScore),
        lastScore: safeScore(entry.lastScore),
        intent: safeText(entry.intent, 32) || "관측",
        reason: safeText(entry.reason, 80),
        x: Math.round(Number(entry.x) || 0),
        y: Math.round(Number(entry.y) || 0)
      };
    }
    return normalized;
  }
  return buildTargetsFromObservations(observations);
}

function buildTargetsFromObservations(observations = []) {
  const targets = {};
  for (const entry of observations) {
    const target = safeText(entry.baseTarget || entry.target, 32) || "관측 지점";
    const score = safeScore(entry.score);
    const current = targets[target] || {
      target,
      count: 0,
      firstSeenAt: entry.at,
      lastSeenAt: entry.at,
      minScore: score,
      maxScore: score,
      lastScore: score,
      intent: entry.intent,
      reason: entry.reason,
      x: entry.x,
      y: entry.y
    };
    current.count += 1;
    current.firstSeenAt = Math.min(current.firstSeenAt || entry.at, entry.at);
    current.lastSeenAt = Math.max(current.lastSeenAt || entry.at, entry.at);
    current.minScore = Math.min(current.minScore, score);
    current.maxScore = Math.max(current.maxScore, score);
    current.lastScore = score;
    current.intent = entry.intent || current.intent;
    current.reason = entry.reason || current.reason;
    current.x = entry.x;
    current.y = entry.y;
    targets[target] = current;
  }
  return targets;
}

function updateTargetSummary(dayMemory, targetName, target, bot, score, now) {
  const targets = dayMemory.targets || (dayMemory.targets = {});
  const current = targets[targetName] || {
    target: targetName,
    count: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    minScore: score,
    maxScore: score,
    lastScore: score,
    intent: safeText(target.intent, 32) || "관측",
    reason: safeText(target.reason, 80),
    x: Math.round(Number(bot?.x) || Number(target.x) || 0),
    y: Math.round(Number(bot?.y) || Number(target.y) || 0)
  };
  current.count += 1;
  current.lastSeenAt = now;
  current.minScore = Math.min(current.minScore, score);
  current.maxScore = Math.max(current.maxScore, score);
  current.lastScore = score;
  current.intent = safeText(target.intent, 32) || current.intent;
  current.reason = safeText(target.reason, 80) || current.reason;
  current.x = Math.round(Number(bot?.x) || Number(target.x) || current.x || 0);
  current.y = Math.round(Number(bot?.y) || Number(target.y) || current.y || 0);
  targets[targetName] = current;
  return current;
}

function shouldStoreObservation(previous, targetName, score, now) {
  if (!previous) return true;
  const previousTarget = previous.baseTarget || previous.target;
  if (previousTarget !== targetName) return true;
  if (Math.abs((Number(previous.score) || 0) - score) >= MEANINGFUL_SCORE_DELTA) return true;
  return now - (Number(previous.at) || 0) >= SAME_TARGET_LOG_MS;
}

function buildRecentSummaries(observations, targets) {
  const seen = new Set();
  const recent = [];
  for (const entry of observations) {
    const baseTarget = entry.baseTarget || entry.target;
    if (seen.has(baseTarget)) continue;
    seen.add(baseTarget);
    recent.push(cloneObservation(entry));
    if (recent.length >= 5) return recent;
  }
  for (const target of targets.sort((a, b) => b.lastSeenAt - a.lastSeenAt)) {
    if (seen.has(target.target)) continue;
    recent.push({
      at: target.lastSeenAt,
      target: formatTargetSummary(target),
      baseTarget: target.target,
      intent: target.intent,
      score: target.maxScore,
      reason: target.reason,
      x: target.x,
      y: target.y
    });
    if (recent.length >= 5) break;
  }
  return recent;
}

function formatTargetSummary(entry) {
  const count = Number(entry?.count) || 1;
  const score = Number(entry?.maxScore) || Number(entry?.lastScore) || 0;
  return count > 1 ? `${entry.target} ${count}회 관찰` : entry.target || `관측 ${score}점`;
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
