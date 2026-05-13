import { addChatBubble, addChatMessage, closeChat, openChat, toggleChat } from "./ui/chat.js";
import { initArenaClient, selectArenaRole, sendArenaAction } from "./arena-client.js";
import { bindKeyboard, updatePlayer } from "./input/keyboard.js";
import { bindMobileControls } from "./input/mobile-controls.js";
import { connect, send, sendPlayerUpdate } from "./network.js";
import { draw, resize, updateCamera, canvas } from "./render.js";
import { initLobby } from "./ui/lobby.js";
import { initCanvasCursor } from "./ui/cursor.js";
import { initHud } from "./ui/hud.js";
import { initRanking } from "./ui/ranking.js";
import { initVoiceButton } from "./ui/voice.js";
import { player, replaceStrokes, state } from "./state.js";
import { ui } from "./ui/dom.js";

init();

function init() {
  document.body.classList.toggle("spectator-mode", state.isSpectator);
  document.body.classList.toggle("lobby-open", !state.isSpectator);
  document.body.classList.add("arena-mode");
  replaceStrokes([]);

  initHud({
    sendPlayerUpdate
  });
  initRanking({ send });
  initCanvasCursor(canvas);
  initVoiceButton();
  initArenaClient({ send });
  bindChatBubbles();

  if (state.isSpectator) {
    startGame();
  } else {
    initLobby({ startGame });
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);
}

function startGame() {
  if (state.controlsBound) return;
  state.controlsBound = true;
  if (!state.isSpectator) {
    bindKeyboard({
      arenaAttack: () => sendArenaAction("attack"),
      arenaSkill: () => sendArenaAction("skill"),
      openChat,
      redo: () => {},
      selectArenaRole,
      undo: () => {}
    });
    bindMobileControls();
    bindChat();
  }
  connect();
}

function loop(now) {
  if (state.gameStarted && !state.isSpectator) {
    updatePlayer();
  }
  updateCamera();
  sendPlayerUpdate(false, now);
  draw();
  requestAnimationFrame(loop);
}

function bindChat() {
  openChat({ focus: false });
  ui.chatToggle.addEventListener("click", toggleChat);

  ui.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeChat();
    }
  });

  ui.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = ui.chatInput.value.trim();
    if (!text) return;
    ui.chatInput.value = "";

    if (state.online) {
      send({ type: "chat", text });
      return;
    }

    const message = {
      author: player.id,
      name: player.name,
      color: player.color,
      text,
      at: Date.now()
    };
    addChatMessage(message);
    addChatBubble(message);
  });
}

function bindChatBubbles() {
  window.addEventListener("chatbubble", (event) => {
    const bubble = event.detail;
    state.chatBubbles.set(bubble.author, bubble);
  });
}
