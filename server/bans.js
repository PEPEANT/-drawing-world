const fs = require("node:fs");
const path = require("node:path");
const { ROOT_DIR } = require("./config");

const DATA_DIR = path.join(ROOT_DIR, "data");
const BAN_FILE = path.join(DATA_DIR, "bans.json");
const bans = new Map();

loadBans();

function banClient(clientId, details = {}) {
  const id = safeClientId(clientId);
  if (!id) return null;
  const durationMs = clampDuration(details.durationMs);
  const ban = {
    clientId: id,
    name: String(details.name || "player").slice(0, 40),
    room: String(details.room || "lobby").slice(0, 40),
    reason: String(details.reason || "관리자 밴").slice(0, 80),
    createdAt: Date.now(),
    expiresAt: Date.now() + durationMs
  };
  bans.set(id, ban);
  saveBans();
  return ban;
}

function getActiveBan(clientId) {
  const id = safeClientId(clientId);
  const ban = id ? bans.get(id) : null;
  if (!ban) return null;
  if (ban.expiresAt <= Date.now()) {
    bans.delete(id);
    saveBans();
    return null;
  }
  return ban;
}

function unbanClient(clientId) {
  const id = safeClientId(clientId);
  const removed = id && bans.delete(id);
  if (removed) saveBans();
  return Boolean(removed);
}

function listBans() {
  pruneExpired();
  return Array.from(bans.values()).sort((a, b) => a.expiresAt - b.expiresAt);
}

function formatBanReason(ban) {
  const until = new Date(ban.expiresAt).toLocaleString("ko-KR");
  return `${ban.reason}: ${until}까지 접속할 수 없어.`;
}

function pruneExpired() {
  let changed = false;
  for (const [id, ban] of bans) {
    if (ban.expiresAt <= Date.now()) {
      bans.delete(id);
      changed = true;
    }
  }
  if (changed) saveBans();
}

function loadBans() {
  try {
    const list = JSON.parse(fs.readFileSync(BAN_FILE, "utf8"));
    for (const ban of Array.isArray(list) ? list : []) {
      if (ban.clientId && ban.expiresAt > Date.now()) bans.set(ban.clientId, ban);
    }
  } catch {
    // Runtime file is created on first ban.
  }
}

function saveBans() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BAN_FILE, JSON.stringify(Array.from(bans.values()), null, 2));
}

function safeClientId(value) {
  return typeof value === "string" ? value.replace(/[^a-z0-9_-]/gi, "").slice(0, 80) : "";
}

function clampDuration(value) {
  const ms = Number(value);
  const hour = 60 * 60 * 1000;
  return Math.max(hour, Math.min(30 * 24 * hour, Number.isFinite(ms) ? ms : 24 * hour));
}

module.exports = {
  banClient,
  formatBanReason,
  getActiveBan,
  listBans,
  unbanClient
};
