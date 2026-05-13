import { GRID_COLOR, PAPER_COLOR, WORLD } from "./config.js";
import { drawArenaEvents, drawArenaGround } from "./arena-render.js";
import { drawBillboard } from "./billboard.js";
import { drawPlayer } from "./player-render.js";
import { player, state } from "./state.js";
import { clamp } from "./utils.js";

export const canvas = document.querySelector("#world");
const ctx = canvas.getContext("2d", { alpha: false });

export function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  canvas.width = Math.floor(state.viewport.width * state.dpr);
  canvas.height = Math.floor(state.viewport.height * state.dpr);
  canvas.style.width = `${state.viewport.width}px`;
  canvas.style.height = `${state.viewport.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

export function draw() {
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, state.viewport.width, state.viewport.height);

  const view = getViewBounds();
  ctx.save();
  applyWorldTransform();
  drawPaper(view);
  drawArenaGround(ctx);

  if (!state.isSpectator) {
    drawPlayer(ctx, player);
  }
  for (const remotePlayer of state.remotePlayers.values()) {
    drawPlayer(ctx, remotePlayer);
  }
  drawArenaEvents(ctx);

  ctx.restore();
  drawMiniStatus();
}

export function updateCamera() {
  const focus = getCameraFocus();
  state.targetCamera.x = focus.x;
  state.targetCamera.y = focus.y;
  if (state.isSpectator) {
    state.targetCamera.zoom = 0.72;
  }
  state.camera.x += (state.targetCamera.x - state.camera.x) * 0.12;
  state.camera.y += (state.targetCamera.y - state.camera.y) * 0.12;
  state.camera.zoom += (state.targetCamera.zoom - state.camera.zoom) * 0.16;
}

function getCameraFocus() {
  if (!state.isSpectator) return player;
  const firstRemote = state.remotePlayers.values().next().value;
  return firstRemote || { x: WORLD.width / 2, y: WORLD.height / 2 };
}

export function screenToWorld(screenX, screenY) {
  return {
    x: state.camera.x + (screenX - state.viewport.width / 2) / state.camera.zoom,
    y: state.camera.y + (screenY - state.viewport.height / 2) / state.camera.zoom
  };
}

export function clampPoint(point) {
  return {
    x: clamp(point.x, 0, WORLD.width),
    y: clamp(point.y, 0, WORLD.height)
  };
}

function applyWorldTransform() {
  ctx.setTransform(
    state.dpr * state.camera.zoom,
    0,
    0,
    state.dpr * state.camera.zoom,
    state.dpr * (state.viewport.width / 2 - state.camera.x * state.camera.zoom),
    state.dpr * (state.viewport.height / 2 - state.camera.y * state.camera.zoom)
  );
}

function getViewBounds() {
  return {
    left: state.camera.x - state.viewport.width / (2 * state.camera.zoom),
    right: state.camera.x + state.viewport.width / (2 * state.camera.zoom),
    top: state.camera.y - state.viewport.height / (2 * state.camera.zoom),
    bottom: state.camera.y + state.viewport.height / (2 * state.camera.zoom)
  };
}

function drawPaper(view) {
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1 / state.camera.zoom;
  const grid = 80;
  const startX = Math.floor(view.left / grid) * grid;
  const endX = Math.ceil(view.right / grid) * grid;
  const startY = Math.floor(view.top / grid) * grid;
  const endY = Math.ceil(view.bottom / grid) * grid;

  ctx.beginPath();
  for (let x = startX; x <= endX; x += grid) {
    ctx.moveTo(x, Math.max(0, startY));
    ctx.lineTo(x, Math.min(WORLD.height, endY));
  }
  for (let y = startY; y <= endY; y += grid) {
    ctx.moveTo(Math.max(0, startX), y);
    ctx.lineTo(Math.min(WORLD.width, endX), y);
  }
  ctx.stroke();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 3 / state.camera.zoom;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
  drawBillboard(ctx);
}

function drawMiniStatus() {
  if (state.viewport.width < 720) return;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.fillStyle = "rgba(17, 24, 39, 0.72)";
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(
    `${Math.round(player.x)}, ${Math.round(player.y)} · ${player.hp || 0}/${player.maxHp || 0} HP`,
    18,
    state.viewport.height - 28
  );
}
