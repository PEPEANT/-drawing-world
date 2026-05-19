const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "analytics.json");
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const data = loadData();

function recordPlayerSession({ clientId, room, at = Date.now() }) {
  const dayKey = toDayKey(at);
  const monthKey = dayKey.slice(0, 7);
  const yearKey = dayKey.slice(0, 4);
  const id = sanitizeClientId(clientId);

  incrementBucket(data.days, dayKey, id, room);
  incrementBucket(data.months, monthKey, id, room);
  incrementBucket(data.years, yearKey, id, room);
  saveData();
}

function buildAnalyticsState(now = Date.now()) {
  const todayKey = toDayKey(now);
  const monthKey = todayKey.slice(0, 7);
  const yearKey = todayKey.slice(0, 4);
  return {
    today: summarize(data.days[todayKey]),
    month: summarize(data.months[monthKey]),
    year: summarize(data.years[yearKey]),
    daily: buildSeries(now, 14, "day"),
    monthly: buildSeries(now, 12, "month"),
    yearly: buildSeries(now, 5, "year")
  };
}

function createAnalyticsBackup() {
  return {
    version: 1,
    exportedAt: Date.now(),
    timezone: "Asia/Seoul",
    analytics: cloneData(data),
    summary: buildAnalyticsState()
  };
}

function exportAnalyticsData() {
  return cloneData(data);
}

function restoreAnalyticsBackup(backup) {
  const incoming = normalizeData(backup?.analytics || backup);
  if (!hasAnalyticsData(incoming)) return null;
  mergeData(data, incoming);
  saveData();
  return createAnalyticsBackup();
}

function replaceAnalyticsData(source) {
  const incoming = normalizeData(source?.analytics || source);
  if (!hasAnalyticsData(incoming)) return false;
  data.days = incoming.days;
  data.months = incoming.months;
  data.years = incoming.years;
  saveData();
  return true;
}

function buildSeries(now, count, unit) {
  const rows = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const key = getKeyForOffset(now, unit, offset);
    const source = unit === "day" ? data.days : unit === "month" ? data.months : data.years;
    rows.push({ key, label: getLabel(key, unit), ...summarize(source[key]) });
  }
  return rows;
}

function getKeyForOffset(now, unit, offset) {
  const next = new Date(Number(now) + KST_OFFSET_MS);
  if (unit === "day") next.setUTCDate(next.getUTCDate() - offset);
  if (unit === "month") next.setUTCMonth(next.getUTCMonth() - offset);
  if (unit === "year") next.setUTCFullYear(next.getUTCFullYear() - offset);
  const key = next.toISOString().slice(0, 10);
  if (unit === "month") return key.slice(0, 7);
  if (unit === "year") return key.slice(0, 4);
  return key;
}

function incrementBucket(target, key, clientId, room) {
  const bucket = target[key] || { sessions: 0, clients: {}, rooms: {} };
  bucket.sessions += 1;
  bucket.clients[clientId] = 1;
  bucket.rooms[room || "lobby"] = (bucket.rooms[room || "lobby"] || 0) + 1;
  target[key] = bucket;
}

function summarize(bucket) {
  if (!bucket) return { sessions: 0, unique: 0 };
  return {
    sessions: bucket.sessions || 0,
    unique: Object.keys(bucket.clients || {}).length
  };
}

function toDayKey(value) {
  return new Date(Number(value) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function getLabel(key, unit) {
  if (unit === "day") return key.slice(5);
  if (unit === "month") return key;
  return key;
}

function sanitizeClientId(value) {
  return typeof value === "string" && value ? value.slice(0, 80) : "unknown";
}

function loadData() {
  try {
    return normalizeData(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  } catch {
    return { days: {}, months: {}, years: {} };
  }
}

function saveData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function normalizeData(value) {
  return {
    days: normalizeBuckets(value?.days),
    months: normalizeBuckets(value?.months),
    years: normalizeBuckets(value?.years)
  };
}

function normalizeBuckets(value) {
  const buckets = {};
  for (const [key, bucket] of Object.entries(value || {})) {
    buckets[key] = {
      sessions: Math.max(0, Number(bucket?.sessions) || 0),
      clients: normalizeMap(bucket?.clients, 1),
      rooms: normalizeMap(bucket?.rooms, 0)
    };
  }
  return buckets;
}

function normalizeMap(value, fallback) {
  const map = {};
  for (const [key, count] of Object.entries(value || {})) {
    if (!key) continue;
    map[String(key).slice(0, 100)] = fallback ? 1 : Math.max(0, Number(count) || 0);
  }
  return map;
}

function hasAnalyticsData(source) {
  return ["days", "months", "years"].some((key) => Object.keys(source[key]).length);
}

function mergeData(target, source) {
  for (const key of ["days", "months", "years"]) mergeBuckets(target[key], source[key]);
}

function mergeBuckets(target, source) {
  for (const [key, incoming] of Object.entries(source)) {
    const bucket = target[key] || { sessions: 0, clients: {}, rooms: {} };
    bucket.sessions = Math.max(bucket.sessions || 0, incoming.sessions || 0);
    bucket.clients = { ...(bucket.clients || {}), ...(incoming.clients || {}) };
    for (const [room, count] of Object.entries(incoming.rooms || {})) {
      bucket.rooms[room] = Math.max(bucket.rooms?.[room] || 0, count || 0);
    }
    target[key] = bucket;
  }
}

function cloneData(source) {
  return JSON.parse(JSON.stringify(normalizeData(source)));
}

module.exports = {
  buildAnalyticsState,
  createAnalyticsBackup,
  exportAnalyticsData,
  replaceAnalyticsData,
  restoreAnalyticsBackup,
  recordPlayerSession
};
