import { addChatBubble, addChatMessage, closeChat, openChat, toggleChat } from "./ui/chat.js";
import { bindKeyboard, updatePlayer } from "./input/keyboard.js";
import { bindMobileControls } from "./input/mobile-controls.js";
import { bindPointer } from "./input/pointer.js";
import { connect, send, sendPlayerUpdate } from "./network.js";
import { draw, resize, updateCamera, canvas } from "./render.js";
import { initLobby } from "./ui/lobby.js";
import { initExportPanel } from "./ui/export-panel.js";
import { closeLayerPanel, initLayerPanel, openLayerPanel } from "./ui/layers.js";
import { closeItemPanel, initItemPanel, openItemPanel, syncItemPanel } from "./ui/item-panel.js";
import { closePaintPanel, initPaintPanel, openPaintPanel, syncPaintPanel } from "./ui/tools.js";
import { initHud, syncToolButtons } from "./ui/hud.js";
import { initVoiceButton } from "./ui/voice.js";
import { loadLocalStrokes } from "./storage.js";
import { player, replaceStrokes, state } from "./state.js";
import { ui } from "./ui/dom.js";

init();

function init() {
  document.body.classList.toggle("spectator-mode", state.isSpectator);
  document.body.classList.toggle("lobby-open", !state.isSpectator);
  replaceStrokes(loadLocalStrokes());

  initHud({
    sendPlayerUpdate,
    setTool,
    toggleTool
  });
  initPaintPanel({ setTool });
  initItemPanel({ send, setTool });
  initLayerPanel({ send });
  initExportPanel();
  initVoiceButton();
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
    bindKeyboard({ openChat, toggleTool });
    bindMobileControls({ toggleTool });
    bindPointer({ send });
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

function setTool(nextTool, options = {}) {
  state.tool = nextTool;
  syncToolButtons();
  syncPaintPanel();
  syncItemPanel();
  syncToolPanels();
  canvas.style.cursor = getCursor();
}

function toggleTool(nextTool) {
  setTool(state.tool === nextTool ? "none" : nextTool);
}

function syncToolPanels() {
  closePaintPanel();
  closeLayerPanel();
  closeItemPanel();
  if (state.tool === "brush") {
    openPaintPanel();
    openLayerPanel();
  }
  if (state.tool === "eraser") {
    openLayerPanel();
  }
  if (state.tool === "item") {
    openItemPanel();
  }
}

function getCursor() {
  if (state.tool === "eraser") return "cell";
  if (state.tool === "item") return "copy";
  if (state.tool === "brush") return "crosshair";
  return "default";
}

function bindChat() {
  openChat({ focus: false });
  ui.chatToggle.addEventListener("click", toggleChat);
  ui.chatCloseButton.addEventListener("click", closeChat);

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
