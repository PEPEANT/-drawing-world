import { PLAYER } from "./config.js";
import { state } from "./state.js";

const skinImages = new Map();

export function drawPlayer(ctx, entity) {
  const size = PLAYER.size;
  const walk = entity.moving ? Math.sin(Date.now() / 120) * 2.2 : 0;
  const squash = entity.moving ? 1 + Math.abs(Math.sin(Date.now() / 120)) * 0.035 : 1;
  const x = Number.isFinite(entity.renderX) ? entity.renderX : entity.x;
  const y = Number.isFinite(entity.renderY) ? entity.renderY : entity.y;

  ctx.save();
  ctx.translate(x, y + walk);
  ctx.scale(entity.facing === -1 ? -1 : 1, squash);

  const image = getSkinImage(entity.skin);
  if (image && image.complete) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
  } else {
    drawFallbackAvatar(ctx, size, entity.color || "#2563eb");
  }

  ctx.scale(entity.facing === -1 ? -1 : 1, 1 / squash);
  ctx.translate(0, -walk);
  if (entity.isBot) {
    drawBotMarker(ctx, size);
    if (entity.ai?.mode === "sleeping") drawBotSleepMarker(ctx, size);
  }
  drawName(ctx, entity, size);
  drawVoteBubble(ctx, entity, size);
  drawChatBubble(ctx, entity, size);
  ctx.restore();
}

function drawName(ctx, entity, size) {
  ctx.fillStyle = "#111827";
  ctx.font = `${12 / state.camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(entity.name || "guest", 0, size / 2 + 7);
}

function drawFallbackAvatar(ctx, size, color) {
  ctx.fillStyle = color;
  roundRect(ctx, -size / 2, -size / 2, size, size, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-8, -6, 4, 4);
  ctx.fillRect(6, -6, 4, 4);
  ctx.fillStyle = "#111827";
  ctx.fillRect(-6, 7, 12, 3);
}

function drawBotMarker(ctx, size) {
  const pulse = 0.55 + Math.sin(Date.now() / 420) * 0.18;
  const radius = size / 2 + 7 / state.camera.zoom;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 2 / state.camera.zoom;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  const badgeY = -size / 2 - 18 / state.camera.zoom;
  const badgeWidth = 24 / state.camera.zoom;
  const badgeHeight = 15 / state.camera.zoom;
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#eef2ff";
  roundRect(ctx, -badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 6 / state.camera.zoom);
  ctx.fillStyle = "#4338ca";
  ctx.font = `${9 / state.camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AI", 0, badgeY + badgeHeight / 2);
  ctx.restore();
}

function drawBotSleepMarker(ctx, size) {
  const offset = Math.sin(Date.now() / 520) * 3 / state.camera.zoom;
  ctx.save();
  ctx.fillStyle = "#64748b";
  ctx.font = `${12 / state.camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Zz", size / 2 + 7 / state.camera.zoom, -size / 2 - 4 / state.camera.zoom + offset);
  ctx.restore();
}

function drawVoteBubble(ctx, entity, size) {
  const bubble = state.voteBubbles.get(entity.id);
  if (!bubble) return 0;
  if (bubble.expiresAt < Date.now()) {
    state.voteBubbles.delete(entity.id);
    return 0;
  }

  const progress = Math.max(0, (bubble.expiresAt - Date.now()) / bubble.duration);
  const lift = (1 - progress) * 14 / state.camera.zoom;
  const width = drawBubbleBox(ctx, {
    text: bubble.text,
    y: -size / 2 - 34 / state.camera.zoom - lift,
    color: bubble.color,
    alpha: Math.min(1, progress * 1.4),
    fontWeight: 800
  });
  return width;
}

function drawChatBubble(ctx, entity, size) {
  const bubble = state.chatBubbles.get(entity.id);
  if (!bubble) return;
  if (bubble.expiresAt < Date.now()) {
    state.chatBubbles.delete(entity.id);
    return;
  }

  const text = bubble.text.length > 42 ? `${bubble.text.slice(0, 42)}...` : bubble.text;
  drawBubbleBox(ctx, {
    text,
    y: -size / 2 - 70 / state.camera.zoom,
    color: "rgba(17, 24, 39, 0.88)",
    alpha: 1,
    fontWeight: 500
  });
}

function drawBubbleBox(ctx, options) {
  const fontSize = 13 / state.camera.zoom;
  const paddingX = 9 / state.camera.zoom;
  const paddingY = 6 / state.camera.zoom;
  ctx.font = `${options.fontWeight} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const width = Math.min(230 / state.camera.zoom, ctx.measureText(options.text).width + paddingX * 2);
  const height = fontSize + paddingY * 2;
  const x = -width / 2;

  ctx.save();
  ctx.globalAlpha = options.alpha;
  ctx.fillStyle = options.color;
  roundRect(ctx, x, options.y, width, height, 7 / state.camera.zoom);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(options.text, 0, options.y + height / 2);
  ctx.restore();
  return height;
}

function getSkinImage(skin) {
  if (!skin) return null;
  if (skinImages.has(skin)) return skinImages.get(skin);
  const image = new Image();
  image.src = skin;
  skinImages.set(skin, image);
  return image;
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
