import { PAPER_COLOR } from "./config.js";

export function drawStroke(ctx, stroke) {
  const points = getDrawablePoints(stroke);
  if (points.length < 1) return;

  if (stroke.tool === "eraser") {
    if (stroke.brush === "spray") {
      drawSpray(ctx, { ...stroke, color: PAPER_COLOR }, points);
      return;
    }
    if (stroke.brush === "square") {
      drawLine(ctx, points, { color: PAPER_COLOR, cap: "butt", join: "miter", size: stroke.size });
      return;
    }
    drawLine(ctx, points, { color: PAPER_COLOR, cap: "round", join: "round", size: stroke.size });
    return;
  }

  if (stroke.brush === "spray") {
    drawSpray(ctx, stroke, points);
    return;
  }

  if (stroke.brush === "marker") {
    drawLine(ctx, points, {
      color: stroke.color,
      cap: "round",
      join: "round",
      size: stroke.size * 1.7,
      alpha: 0.42
    });
    return;
  }

  if (stroke.brush === "square") {
    drawLine(ctx, points, { color: stroke.color, cap: "butt", join: "miter", size: stroke.size });
    return;
  }

  drawLine(ctx, points, { color: stroke.color, cap: "round", join: "round", size: stroke.size });
}

function drawLine(ctx, points, options) {
  if (points.length === 1) {
    drawDot(ctx, points[0], options);
    return;
  }
  if (hasPressure(points) && options.cap === "round") {
    drawPressureLine(ctx, points, options);
    return;
  }
  ctx.save();
  ctx.globalAlpha *= options.alpha || 1;
  ctx.lineCap = options.cap;
  ctx.lineJoin = options.join;
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.size;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const point = points[i];
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
  }

  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

function drawPressureLine(ctx, points, options) {
  ctx.save();
  ctx.globalAlpha *= options.alpha || 1;
  ctx.lineCap = options.cap;
  ctx.lineJoin = options.join;
  ctx.strokeStyle = options.color;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const point = points[i];
    ctx.lineWidth = pressureSize(options.size, (pressureOf(previous) + pressureOf(point)) / 2);
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDot(ctx, point, options) {
  ctx.save();
  ctx.globalAlpha *= options.alpha || 1;
  ctx.fillStyle = options.color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, pressureSize(options.size, pressureOf(point)) / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpray(ctx, stroke, points) {
  const radius = Math.max(4, stroke.size * 0.9);
  const density = Math.max(6, Math.round(stroke.size * 1.1));
  const baseSeed = hashString(stroke.id || "");
  ctx.save();
  ctx.fillStyle = stroke.color;
  const baseAlpha = ctx.globalAlpha;

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    for (let dot = 0; dot < density; dot += 1) {
      const seed = baseSeed + i * 131 + dot * 977;
      const angle = random(seed) * Math.PI * 2;
      const distance = Math.sqrt(random(seed + 17)) * radius;
      const size = Math.max(1, stroke.size * (0.08 + random(seed + 31) * 0.09));
      ctx.globalAlpha = baseAlpha * (0.18 + random(seed + 53) * 0.34);
      ctx.beginPath();
      ctx.arc(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function getDrawablePoints(stroke) {
  if (!Array.isArray(stroke?.points)) return [];
  return stroke.points.filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function hasPressure(points) {
  return points.some((point) => Number.isFinite(point.pressure) && Math.abs(point.pressure - 0.5) > 0.01);
}

function pressureOf(point) {
  return Number.isFinite(point.pressure) ? Math.max(0, Math.min(1, point.pressure)) : 0.5;
}

function pressureSize(size, pressure) {
  return Math.max(1, size * (0.45 + pressure * 1.1));
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function random(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}
