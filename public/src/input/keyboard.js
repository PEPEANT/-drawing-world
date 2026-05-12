import { WORLD } from "../config.js";
import { player, state } from "../state.js";
import { clamp, isTypingTarget } from "../utils.js";

export function bindKeyboard({ openChat, toggleTool }) {
  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();

    if (key === "t") {
      openChat();
      event.preventDefault();
      return;
    }

    if (key === "1") {
      toggleTool("brush");
      event.preventDefault();
      return;
    }

    if (key === "2") {
      toggleTool("eraser");
      event.preventDefault();
      return;
    }

    if (key === "3") {
      toggleTool("item");
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
    return;
  }
  const length = Math.hypot(dx, dy);
  const speed = state.keys.has("shift") ? 7.2 : 4.3;
  player.facing = dx < -0.05 ? -1 : dx > 0.05 ? 1 : player.facing;
  player.moving = true;
  player.x = clamp(player.x + (dx / length) * speed, 24, WORLD.width - 24);
  player.y = clamp(player.y + (dy / length) * speed, 24, WORLD.height - 24);
}

function isMoveKey(key) {
  return ["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright", "shift"].includes(key);
}
