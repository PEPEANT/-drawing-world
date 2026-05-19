import { state } from "./state.js";

const MAX_BADGES = 12;

export function drawAiArtBadges(ctx, view) {
  const groups = collectAiArtGroups(view);
  for (const group of groups.slice(0, MAX_BADGES)) {
    drawBadge(ctx, group);
  }
}

function collectAiArtGroups(view) {
  const groups = new Map();
  for (const stroke of state.strokes) {
    if (!stroke?.isBotArtwork || stroke.tool === "eraser") continue;
    const bounds = getStrokeBounds(stroke);
    if (!bounds || !intersects(bounds, view)) continue;
    const key = getArtworkKey(stroke);
    const group = groups.get(key) || { bounds: null, source: stroke.source || "" };
    group.bounds = mergeBounds(group.bounds, bounds);
    groups.set(key, group);
  }
  return Array.from(groups.values()).filter((group) => group.bounds);
}

function drawBadge(ctx, group) {
  const zoom = state.camera.zoom || 1;
  const label = group.source === "user_click" ? "AI봇 작품 · 요청" : "AI봇 작품";
  const fontSize = 11 / zoom;
  const paddingX = 8 / zoom;
  const paddingY = 5 / zoom;
  ctx.save();
  ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const width = ctx.measureText(label).width + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const x = group.bounds.left;
  const y = Math.max(12 / zoom, group.bounds.top - height - 10 / zoom);
  ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
  roundRect(ctx, x, y, width, height, 6 / zoom);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + height / 2);
  ctx.restore();
}

function getArtworkKey(stroke) {
  const match = String(stroke.id || "").match(/^(ai-art-[^-]+)-/);
  return match ? match[1] : `${stroke.prompt || "ai-art"}:${stroke.source || ""}`;
}

function getStrokeBounds(stroke) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const point of Array.isArray(stroke.points) ? stroke.points : []) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }
  return Number.isFinite(left) ? { left, right, top, bottom } : null;
}

function mergeBounds(current, next) {
  if (!current) return { ...next };
  return {
    left: Math.min(current.left, next.left),
    right: Math.max(current.right, next.right),
    top: Math.min(current.top, next.top),
    bottom: Math.max(current.bottom, next.bottom)
  };
}

function intersects(bounds, view) {
  if (!view) return true;
  return bounds.left <= view.right && bounds.right >= view.left && bounds.top <= view.bottom && bounds.bottom >= view.top;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.fill();
}
