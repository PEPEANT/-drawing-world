const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "analytics.json");
const data = loadData();

function recordPlayerSession({ clientId, room, at = Date.now() }) {
  const date = new Date(at);
  const dayKey = toDayKey(date);
  const monthKey = dayKey.slice(0, 7);
  const yearKey = dayKey.slice(0, 4);
  const id = sanitizeClientId(clientId);

  incrementBucket(data.days, dayKey, id, room);
  incrementBucket(data.months, monthKey, id, room);
  incrementBucket(data.years, yearKey, id, room);
  saveData();
}

function buildAnalyticsState(now = Date.now()) {
  const date = new Date(now);
  const todayKey = toDayKey(date);
  const monthKey = todayKey.slice(0, 7);
  const yearKey = todayKey.slice(0, 4);
  return {
    today: summarize(data.days[todayKey]),
    month: summarize(data.months[monthKey]),
    year: summarize(data.years[yearKey]),
    daily: buildSeries(date, 14, "day"),
    monthly: buildSeries(date, 12, "month"),
    yearly: buildSeries(date, 5, "year")
  };
}

function buildSeries(date, count, unit) {
  const rows = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const key = getKeyForOffset(date, unit, offset);
    const source = unit === "day" ? data.days : unit === "month" ? data.months : data.years;
    rows.push({ key, label: getLabel(key, unit), ...summarize(source[key]) });
  }
  return rows;
}

function getKeyForOffset(date, unit, offset) {
  const next = new Date(date);
  if (unit === "day") next.setDate(next.getDate() - offset);
  if (unit === "month") next.setMonth(next.getMonth() - offset);
  if (unit === "year") next.setFullYear(next.getFullYear() - offset);
  const key = toDayKey(next);
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

function toDayKey(date) {
  return date.toISOString().slice(0, 10);
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
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { days: {}, months: {}, years: {} };
  }
}

function saveData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  buildAnalyticsState,
  recordPlayerSession
};
