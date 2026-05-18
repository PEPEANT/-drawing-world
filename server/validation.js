const crypto = require("node:crypto");

function sanitizeRoomName(value) {
  if (typeof value !== "string") return "lobby";
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 32);
  return clean || "lobby";
}

function safeText(value, limit = 40) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function safeLayerId(value) {
  if (typeof value !== "string") return "layer-1";
  const clean = value.replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
  return clean || "layer-1";
}

function safeUrl(value) {
  if (typeof value !== "string") return "";
  const text = value.trim().slice(0, 240);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function safeBrush(value) {
  return ["round", "marker", "square", "spray"].includes(value) ? value : "round";
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizePlayer(data, id) {
  return {
    id,
    name: safeText(data.name, 24) || `guest-${id.slice(0, 4)}`,
    color: /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : "#2563eb",
    skin: safeSkin(data.skin),
    x: isFiniteNumber(data.x) ? data.x : 1600,
    y: isFiniteNumber(data.y) ? data.y : 1100,
    facing: data.facing === -1 ? -1 : 1,
    moving: data.moving === true
  };
}

function safeSkin(value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("data:image/png;base64,")) return "";
  return value.length <= 7000 ? value : "";
}

function normalizeStroke(data, id, owner) {
  if (!data || !Array.isArray(data.points) || data.points.length < 1) return null;
  const points = data.points
    .slice(0, 700)
    .filter((point) => point && isFiniteNumber(point.x) && isFiniteNumber(point.y))
    .map((point) => ({
      x: Math.max(0, Math.min(3200, point.x)),
      y: Math.max(0, Math.min(2200, point.y)),
      pressure: isFiniteNumber(point.pressure) ? Math.max(0, Math.min(1, point.pressure)) : 0.5
    }));

  if (points.length < 1) return null;

  return {
    id: typeof data.id === "string" ? data.id.slice(0, 80) : crypto.randomUUID(),
    author: id,
    owner: safeOwner(owner),
    color: /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : "#111827",
    layerId: safeLayerId(data.layerId),
    size: isFiniteNumber(data.size) ? Math.max(1, Math.min(80, data.size)) : 6,
    tool: data.tool === "eraser" ? "eraser" : "brush",
    brush: safeBrush(data.brush),
    points
  };
}

function safeOwner(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
}

function normalizeItem(data, id) {
  if (!data || !isFiniteNumber(data.x) || !isFiniteNumber(data.y)) return null;
  const type = data.type === "radio" ? "radio" : "flag";
  const url = safeUrl(data.url);
  if (type === "radio" && !url) return null;
  return {
    id: typeof data.id === "string" ? data.id.slice(0, 80) : crypto.randomUUID(),
    author: id,
    type,
    title: safeText(data.title, 24) || (type === "radio" ? "라디오" : "깃발"),
    url,
    x: Math.max(0, Math.min(3200, data.x)),
    y: Math.max(0, Math.min(2200, data.y)),
    at: Date.now()
  };
}

module.exports = {
  normalizeItem,
  normalizePlayer,
  normalizeStroke,
  safeLayerId,
  safeText,
  sanitizeRoomName
};
