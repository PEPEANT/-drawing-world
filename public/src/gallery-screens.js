import { PAPER_COLOR, WORLD } from "./config.js";
import { state } from "./state.js";

const SCREENS = [
  { x: WORLD.width / 2 - 480, y: -210 },
  { x: WORLD.width / 2, y: -210 },
  { x: WORLD.width / 2 + 480, y: -210 }
];

const SCREEN = { width: 390, height: 240, radius: 10 };

export function drawGalleryScreens(ctx) {
  for (let index = 0; index < SCREENS.length; index += 1) {
    drawScreen(ctx, SCREENS[index], state.featured[index], index);
  }
}

function drawScreen(ctx, screen, entry, index) {
  const x = screen.x - SCREEN.width / 2;
  const y = screen.y - SCREEN.height / 2;
  const pulse = getUpdatePulse();

  ctx.save();
  if (entry && pulse > 0) {
    ctx.shadowColor = `rgba(37, 99, 235, ${0.45 * pulse})`;
    ctx.shadowBlur = 28 * pulse;
  }
  ctx.fillStyle = "#111827";
  roundRect(ctx, x, y, SCREEN.width, SCREEN.height, SCREEN.radius);
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, x + 12, y + 42, SCREEN.width - 24, SCREEN.height - 58, 6);
  ctx.fill();

  ctx.fillStyle = "#f9fafb";
  ctx.font = "20px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`TOP ${index + 1}`, x + 18, y + 23);

  ctx.fillStyle = entry ? "#bfdbfe" : "#cbd5e1";
  ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(entry ? `LIKE ${entry.likes || 0}` : "empty", x + SCREEN.width - 18, y + 23);

  const area = {
    x: x + 24,
    y: y + 54,
    width: SCREEN.width - 48,
    height: SCREEN.height - 84
  };

  if (entry) {
    drawArtwork(ctx, entry, area);
  } else {
    drawEmpty(ctx, area);
  }

  drawStand(ctx, screen.x, y + SCREEN.height);
  ctx.restore();
}

function drawArtwork(ctx, entry, area) {
  const bounds = normalizeBounds(entry.bounds);
  const scale = Math.min(area.width / bounds.width, area.height / bounds.height);
  const dx = area.x + (area.width - bounds.width * scale) / 2 - bounds.x * scale;
  const dy = area.y + (area.height - bounds.height * scale) / 2 - bounds.y * scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.width, area.height);
  ctx.clip();
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(area.x, area.y, area.width, area.height);

  for (const stroke of entry.strokes || []) {
    drawPreviewStroke(ctx, stroke, scale, dx, dy);
  }

  ctx.restore();
  drawCaption(ctx, entry, area);
}

function drawPreviewStroke(ctx, stroke, scale, dx, dy) {
  const points = stroke.points || [];
  if (points.length < 1) return;

  ctx.strokeStyle = stroke.tool === "eraser" ? PAPER_COLOR : safeColor(stroke.color);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1.2, (Number(stroke.size) || 4) * scale);
  ctx.lineCap = stroke.brush === "square" ? "butt" : "round";
  ctx.lineJoin = "round";
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x * scale + dx, points[0].y * scale + dy, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x * scale + dx, points[0].y * scale + dy);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x * scale + dx, points[i].y * scale + dy);
  }
  ctx.stroke();
}

function drawCaption(ctx, entry, area) {
  ctx.fillStyle = "rgba(17, 24, 39, 0.78)";
  ctx.fillRect(area.x, area.y + area.height + 4, area.width, 22);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${entry.artistName || "player"} - ${entry.likes || 0}`, area.x + area.width / 2, area.y + area.height + 15);
}

function drawEmpty(ctx, area) {
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(area.x, area.y, area.width, area.height);
  ctx.fillStyle = "#64748b";
  ctx.font = "18px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Waiting for likes", area.x + area.width / 2, area.y + area.height / 2);
}

function drawStand(ctx, x, y) {
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(x - 60, y);
  ctx.lineTo(x - 60, 0);
  ctx.moveTo(x + 60, y);
  ctx.lineTo(x + 60, 0);
  ctx.stroke();
}

function normalizeBounds(bounds) {
  return {
    x: Number(bounds?.x) || 0,
    y: Number(bounds?.y) || 0,
    width: Math.max(1, Number(bounds?.width) || 1),
    height: Math.max(1, Number(bounds?.height) || 1)
  };
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#111827";
}

function getUpdatePulse() {
  const elapsed = Date.now() - (state.featuredUpdatedAt || 0);
  return Math.max(0, 1 - elapsed / 1400);
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
}
