import { PLAYER } from "./config.js";
import { state } from "./state.js";

const skinImages = new Map();

export function drawPlayer(ctx, entity) {
  const size = PLAYER.size;
  const walk = entity.moving ? Math.sin(Date.now() / 120) * 2.2 : 0;
  const squash = entity.moving ? 1 + Math.abs(Math.sin(Date.now() / 120)) * 0.035 : 1;

  ctx.save();
  ctx.translate(entity.x, entity.y + walk);
  ctx.scale(entity.facing === -1 ? -1 : 1, squash);
  ctx.globalAlpha = entity.alive === false ? 0.42 : 1;
  drawTeamRing(ctx, entity, size);

  const image = getSkinImage(entity.skin);
  if (image && image.complete) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
  } else {
    drawFallbackAvatar(ctx, size, entity.color || "#2563eb");
  }

  ctx.scale(entity.facing === -1 ? -1 : 1, 1 / squash);
  ctx.translate(0, -walk);
  ctx.globalAlpha = 1;
  drawHealthBar(ctx, entity, size);
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

function drawTeamRing(ctx, entity, size) {
  ctx.strokeStyle = entity.team === "blue" ? "#2563eb" : "#ef4444";
  ctx.lineWidth = 4 / state.camera.zoom;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHealthBar(ctx, entity, size) {
  const maxHp = Math.max(1, entity.maxHp || 100);
  const hp = Math.max(0, Math.min(maxHp, entity.hp ?? maxHp));
  const width = 54 / state.camera.zoom;
  const height = 7 / state.camera.zoom;
  const x = -width / 2;
  const y = -size / 2 - 16 / state.camera.zoom;
  ctx.fillStyle = "rgba(17, 24, 39, 0.22)";
  roundRect(ctx, x, y, width, height, 4 / state.camera.zoom);
  ctx.fillStyle = hp / maxHp > 0.35 ? "#16a34a" : "#dc2626";
  roundRect(ctx, x, y, width * (hp / maxHp), height, 4 / state.camera.zoom);
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
