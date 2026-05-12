import { APP_NAME, getRoomName } from "../config.js";
import { player, state } from "../state.js";
import { savePlayerIdentity } from "../storage.js";
import { ui } from "./dom.js";

export function initHud({ sendPlayerUpdate, toggleTool }) {
  document.title = APP_NAME;
  document.querySelector("[data-brand-name]").textContent = APP_NAME;

  ui.colorInput.value = player.color;
  ui.sizeOutput.value = ui.sizeInput.value;
  ui.roomName.textContent = `room: ${getRoomName()}`;

  ui.colorInput.addEventListener("input", () => {
    player.color = ui.colorInput.value;
    savePlayerIdentity(player);
    sendPlayerUpdate(true);
  });

  ui.sizeInput.addEventListener("input", () => {
    ui.sizeOutput.value = ui.sizeInput.value;
  });

  ui.brushButton.addEventListener("click", () => toggleTool("brush"));
  ui.eraserButton.addEventListener("click", () => toggleTool("eraser"));
  ui.itemButton.addEventListener("click", () => toggleTool("item"));
  syncToolButtons();
}

export function setOnline(value) {
  state.online = value;
  ui.connectionStatus.textContent = value ? "온라인" : "오프라인";
  ui.connectionStatus.classList.toggle("online", value);
  ui.connectionStatus.classList.toggle("offline", !value);
}

export function syncToolButtons() {
  ui.brushButton.classList.toggle("active", state.tool === "brush");
  ui.eraserButton.classList.toggle("active", state.tool === "eraser");
  ui.itemButton.classList.toggle("active", state.tool === "item");
  ui.mobileBrushButton.classList.toggle("active", state.tool === "brush");
  ui.mobileEraserButton.classList.toggle("active", state.tool === "eraser");
  ui.mobileItemButton.classList.toggle("active", state.tool === "item");
}
