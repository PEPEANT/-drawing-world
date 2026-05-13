import { PLAYER, WORLD } from "../config.js";
import { movePlayerWithCollision, resolvePlayerCollisions } from "../player-physics.js";
import { player, state } from "../state.js";
import { isTypingTarget } from "../utils.js";

export function bindKeyboard({ arenaAttack, arenaSkill, openChat, redo, selectArenaRole, undo }) {
  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      redo();
      return;
    }

    if (key === "t") {
      openChat();
      event.preventDefault();
      return;
    }

    if (key === " ") {
      arenaAttack();
      event.preventDefault();
      return;
    }

    if (key === "q") {
      arenaSkill();
      event.preventDefault();
      return;
    }

    if (key === "1") {
      selectArenaRole("striker");
      event.preventDefault();
      return;
    }

    if (key === "2") {
      selectArenaRole("ranger");
      event.preventDefault();
      return;
    }

    if (key === "3") {
      selectArenaRole("healer");
      event.preventDefault();
      return;
    }

    if (isMoveKey(key)) {
      state.keys.add(key);
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.key.toLowerCase());
  });
}

export function updatePlayer() {
  let dx = 0;
  let dy = 0;
  if (state.keys.has("w") || state.keys.has("arrowup")) dy -= 1;
  if (state.keys.has("s") || state.keys.has("arrowdown")) dy += 1;
  if (state.keys.has("a") || state.keys.has("arrowleft")) dx -= 1;
  if (state.keys.has("d") || state.keys.has("arrowright")) dx += 1;
  dx += state.mobileMove.x;
  dy += state.mobileMove.y;

  if (dx === 0 && dy === 0) {
    player.moving = false;
    resolvePlayerCollisions();
    return;
  }
  const speed = state.keys.has("shift") ? 7.2 : 4.3;
  player.facing = dx < -0.05 ? -1 : dx > 0.05 ? 1 : player.facing;
  player.moving = true;
  movePlayerWithCollision(dx, dy, speed);
  player.x = Math.max(PLAYER.collisionRadius, Math.min(WORLD.width - PLAYER.collisionRadius, player.x));
  player.y = Math.max(PLAYER.collisionRadius, Math.min(WORLD.height - PLAYER.collisionRadius, player.y));
}

function isMoveKey(key) {
  return ["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright", "shift"].includes(key);
}
