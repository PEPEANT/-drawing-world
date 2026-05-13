import { WORLD } from "./config.js";
import { player, state } from "./state.js";

export function drawArenaGround(ctx) {
  drawBase(ctx, "#ef4444", 760, 820, 420, 560, "RED");
  drawBase(ctx, "#2563eb", WORLD.width - 1180, 820, 420, 560, "BLUE");
  ctx.save();
  ctx.strokeStyle = "rgba(17, 24, 39, 0.18)";
  ctx.lineWidth = 4 / state.camera.zoom;
  ctx.setLineDash([18 / state.camera.zoom, 16 / state.camera.zoom]);
  ctx.beginPath();
  ctx.moveTo(WORLD.width / 2, 160);
  ctx.lineTo(WORLD.width / 2, WORLD.height - 160);
  ctx.stroke();
  ctx.restore();
}

export function drawArenaEvents(ctx) {
  const now = Date.now();
  state.arenaEvents = state.arenaEvents.filter((event) => event.expiresAt > now);
  for (const event of state.arenaEvents) {
    const target = getEventTarget(event);
    if (!target) continue;
    const progress = Math.max(0, (event.expiresAt - now) / 900);
    ctx.save();
    ctx.globalAlpha = progress;
    ctx.fillStyle = event.kind === "heal" ? "#16a34a" : event.kind === "ko" ? "#dc2626" : "#f59e0b";
    ctx.font = `800 ${18 / state.camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(getEventText(event), target.x, target.y - 46 / state.camera.zoom - (1 - progress) * 20);
    ctx.restore();
  }
}

function drawBase(ctx, color, x, y, width, height, label) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5 / state.camera.zoom;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.font = `900 ${34 / state.camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(label, x + width / 2, y + height / 2);
  ctx.restore();
}

function getEventTarget(event) {
  if (event.target === state.socketId || event.source === state.socketId) return player;
  return state.remotePlayers.get(event.target) || state.remotePlayers.get(event.source);
}

function getEventText(event) {
  if (event.kind === "heal") return `+${event.value}`;
  if (event.kind === "ko") return "KO";
  if (event.kind === "hit") return `-${event.value}`;
  return "MISS";
}
