import { state } from "./state.js";

const BOT_LERP = 0.18;
const PLAYER_LERP = 0.3;
const SNAP_DISTANCE = 280;

export function resetRemotePlayers(players, selfId) {
  state.remotePlayers = new Map();
  for (const player of players || []) {
    if (player?.id && player.id !== selfId) {
      state.remotePlayers.set(player.id, withRenderPosition(player));
    }
  }
}

export function upsertRemotePlayer(player, selfId) {
  if (!player?.id || player.id === selfId) return;
  const existing = state.remotePlayers.get(player.id);
  if (!existing) {
    state.remotePlayers.set(player.id, withRenderPosition(player));
    return;
  }

  const targetX = safeNumber(player.x, existing.x);
  const targetY = safeNumber(player.y, existing.y);
  const renderX = safeNumber(existing.renderX, existing.x);
  const renderY = safeNumber(existing.renderY, existing.y);
  const distance = Math.hypot(targetX - renderX, targetY - renderY);
  const shouldSnap = distance > SNAP_DISTANCE || player.ai?.mode === "stopped" || player.ai?.mode === "sleeping";

  Object.assign(existing, player, {
    renderX: shouldSnap ? targetX : renderX,
    renderY: shouldSnap ? targetY : renderY,
    targetX,
    targetY
  });
}

export function smoothRemotePlayers() {
  for (const player of state.remotePlayers.values()) {
    if (!Number.isFinite(player.targetX) || !Number.isFinite(player.targetY)) continue;
    const renderX = safeNumber(player.renderX, player.x);
    const renderY = safeNumber(player.renderY, player.y);
    const dx = player.targetX - renderX;
    const dy = player.targetY - renderY;
    const distance = Math.hypot(dx, dy);
    if (!player.moving && distance < 0.5) {
      player.renderX = player.targetX;
      player.renderY = player.targetY;
      continue;
    }
    const lerp = player.isBot ? BOT_LERP : PLAYER_LERP;
    player.renderX = renderX + dx * lerp;
    player.renderY = renderY + dy * lerp;
  }
}

function withRenderPosition(player) {
  const x = safeNumber(player.x, 0);
  const y = safeNumber(player.y, 0);
  return {
    ...player,
    renderX: x,
    renderY: y,
    targetX: x,
    targetY: y
  };
}

function safeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
