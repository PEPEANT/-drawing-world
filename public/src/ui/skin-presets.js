export const SKIN_SIZE = 32;

export const SKIN_PRESETS = [
  { id: "painter", name: "페인터", draw: drawPainterSkin },
  { id: "robot", name: "로봇", draw: drawRobotSkin },
  { id: "gpichan", name: "지피쨩", draw: drawGpichanSkin },
  { id: "kaguya", name: "카구야", draw: drawKaguyaSkin },
  { id: "custom", name: "+ 커스텀", draw: clearSkinContext }
];

export function clearSkinContext(ctx) {
  ctx.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE);
}

function drawPainterSkin(ctx) {
  clearSkinContext(ctx);
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(8, 8, 16, 16);
  ctx.fillStyle = "#60a5fa";
  ctx.fillRect(9, 7, 14, 3);
  ctx.fillStyle = "#f5b892";
  ctx.fillRect(10, 11, 12, 9);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(12, 13, 3, 3);
  ctx.fillRect(18, 13, 3, 3);
  ctx.fillStyle = "#111827";
  ctx.fillRect(13, 14, 1, 1);
  ctx.fillRect(19, 14, 1, 1);
  ctx.fillRect(15, 18, 4, 1);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(7, 22, 18, 4);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(23, 17, 3, 8);
}

function drawRobotSkin(ctx) {
  clearSkinContext(ctx);
  ctx.fillStyle = "#64748b";
  ctx.fillRect(8, 7, 16, 18);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(10, 9, 12, 10);
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(12, 12, 3, 3);
  ctx.fillRect(18, 12, 3, 3);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(14, 21, 5, 2);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(15, 4, 2, 3);
  ctx.fillRect(13, 3, 6, 1);
}

function drawGpichanSkin(ctx) {
  clearSkinContext(ctx);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(9, 6, 14, 6);
  ctx.fillRect(8, 10, 16, 8);
  ctx.fillStyle = "#f5d0b4";
  ctx.fillRect(11, 11, 10, 7);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(12, 13, 2, 2);
  ctx.fillRect(18, 13, 2, 2);
  ctx.fillStyle = "#111827";
  ctx.fillRect(13, 14, 1, 1);
  ctx.fillRect(19, 14, 1, 1);
  ctx.fillRect(15, 17, 3, 1);
  ctx.fillRect(13, 19, 6, 3);
  ctx.fillRect(10, 22, 12, 5);
  ctx.fillRect(12, 27, 3, 3);
  ctx.fillRect(18, 27, 3, 3);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(8, 19, 5, 8);
  ctx.fillRect(20, 19, 5, 8);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(22, 12, 3, 3);
  ctx.fillStyle = "#111827";
  ctx.fillRect(15, 22, 5, 5);
}

function drawKaguyaSkin(ctx) {
  clearSkinContext(ctx);
  ctx.fillStyle = "#f8d76f";
  ctx.fillRect(9, 4, 13, 4);
  ctx.fillRect(7, 7, 17, 7);
  ctx.fillRect(6, 11, 5, 15);
  ctx.fillRect(21, 10, 5, 16);
  ctx.fillStyle = "#f6c453";
  ctx.fillRect(5, 18, 4, 8);
  ctx.fillRect(24, 17, 3, 9);
  ctx.fillStyle = "#f5c7a9";
  ctx.fillRect(11, 10, 10, 8);
  ctx.fillRect(20, 7, 3, 6);
  ctx.fillRect(22, 5, 2, 3);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(12, 12, 2, 2);
  ctx.fillRect(18, 12, 2, 2);
  ctx.fillStyle = "#111827";
  ctx.fillRect(13, 13, 1, 1);
  ctx.fillRect(19, 13, 1, 1);
  ctx.fillRect(15, 16, 3, 1);
  ctx.fillRect(10, 18, 12, 9);
  ctx.fillRect(9, 21, 4, 5);
  ctx.fillRect(20, 20, 4, 6);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(14, 19, 5, 2);
  ctx.fillStyle = "#7dd3fc";
  ctx.fillRect(13, 27, 3, 3);
  ctx.fillRect(18, 27, 3, 3);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(12, 30, 4, 1);
  ctx.fillRect(18, 30, 4, 1);
}
