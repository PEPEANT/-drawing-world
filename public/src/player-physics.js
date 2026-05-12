import { PLAYER, WORLD } from "./config.js";
import { player, state } from "./state.js";
import { clamp } from "./utils.js";

export function movePlayerWithCollision(dx, dy, speed) {
  const length = Math.hypot(dx, dy) || 1;
  player.x += (dx / length) * speed;
  player.y += (dy / length) * speed;
  resolvePlayerCollisions();
}

export function resolvePlayerCollisions() {
  const radius = PLAYER.collisionRadius;
  const minDistance = radius * 2;

  for (const other of state.remotePlayers.values()) {
    if (!isFinitePosition(other)) continue;
    const dx = player.x - other.x;
    const dy = player.y - other.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= minDistance) continue;

    const nx = distance > 0.01 ? dx / distance : player.facing || 1;
    const ny = distance > 0.01 ? dy / distance : 0;
    const push = (minDistance - distance) * 0.68;
    player.x += nx * push;
    player.y += ny * push;
  }

  player.x = clamp(player.x, radius, WORLD.width - radius);
  player.y = clamp(player.y, radius, WORLD.height - radius);
}

function isFinitePosition(entity) {
  return Number.isFinite(entity?.x) && Number.isFinite(entity?.y);
}
