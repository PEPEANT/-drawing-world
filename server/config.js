const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY_SOURCE = typeof process.env.ADMIN_KEY === "string" ? process.env.ADMIN_KEY.trim() : "";
const ADMIN_KEY = ADMIN_KEY_SOURCE || "admin";
const ADMIN_KEY_IS_DEFAULT = !ADMIN_KEY_SOURCE;

const LIMITS = {
  maxPlayersPerRoom: 50,
  maxStrokesPerRoom: 2500,
  maxItemsPerRoom: 180,
  maxAudioUploadBytes: 12 * 1024 * 1024,
  radioLockMs: 10 * 60 * 1000,
  maxChatLength: 240,
  maxChatHistory: 120,
  downvotesBeforeClear: 3,
  banDurationMs: 24 * 60 * 60 * 1000
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

module.exports = {
  ADMIN_KEY,
  ADMIN_KEY_IS_DEFAULT,
  LIMITS,
  PORT,
  PUBLIC_DIR,
  ROOT_DIR,
  mimeTypes
};
