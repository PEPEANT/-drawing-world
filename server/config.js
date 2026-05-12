const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "admin";

const LIMITS = {
  maxPlayersPerRoom: 50,
  maxStrokesPerRoom: 2500,
  maxItemsPerRoom: 180,
  maxAudioUploadBytes: 12 * 1024 * 1024,
  radioLockMs: 10 * 60 * 1000,
  maxChatLength: 240,
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
  LIMITS,
  PORT,
  PUBLIC_DIR,
  mimeTypes
};
