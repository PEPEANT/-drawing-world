import { state } from "./state.js";

export function drawItems(ctx, view) {
  for (const item of state.items) {
    if (view && !itemIntersectsView(item, view)) continue;
    if (item.type === "radio") {
      drawRadio(ctx, item);
    } else {
      drawFlag(ctx, item);
    }
  }
}

function drawFlag(ctx, item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.lineTo(0, -42);
  ctx.stroke();

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(2, -42);
  ctx.lineTo(42, -32);
  ctx.lineTo(2, -18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(shortLabel(item.title || "깃발"), 0, 24);
  ctx.restore();
}

function drawRadio(ctx, item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.fillStyle = "#111827";
  roundRect(ctx, -26, -18, 52, 36, 7);
  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, -18, -10, 20, 20, 4);
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.arc(13, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(8, -18);
  ctx.lineTo(25, -38);
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(shortLabel(item.title || "라디오"), 0, 24);
  ctx.restore();
}

function shortLabel(value) {
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

function itemIntersectsView(item, view) {
  const radius = item.type === "radio" ? 70 : 60;
  return (
    item.x - radius <= view.right &&
    item.x + radius >= view.left &&
    item.y - radius <= view.bottom &&
    item.y + radius >= view.top
  );
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
