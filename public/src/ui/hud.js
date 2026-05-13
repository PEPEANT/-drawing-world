import { APP_NAME, getRoomName } from "../config.js";
import { player, state } from "../state.js";
import { savePlayerIdentity } from "../storage.js";
import { updateToolCursor } from "./cursor.js";
import { ui } from "./dom.js";

export function initHud({ sendPlayerUpdate }) {
  document.title = APP_NAME;
  document.querySelector("[data-brand-name]").textContent = APP_NAME;

  if (ui.colorInput) ui.colorInput.value = player.color;
  if (ui.sizeInput && ui.sizeOutput) ui.sizeOutput.value = ui.sizeInput.value;
  if (ui.roomName) ui.roomName.textContent = `arena: ${getRoomName()}`;

  ui.colorInput?.addEventListener("input", () => {
    player.color = ui.colorInput.value;
    savePlayerIdentity(player);
    updateToolCursor();
    sendPlayerUpdate(true);
  });

  ui.sizeInput?.addEventListener("input", () => {
    ui.sizeOutput.value = ui.sizeInput.value;
    updateToolCursor();
  });

  syncToolButtons();
}

export function setOnline(value) {
  state.online = value;
  if (!ui.connectionStatus) return;
  ui.connectionStatus.textContent = value ? "온라인" : "오프라인";
  ui.connectionStatus.classList.toggle("online", value);
  ui.connectionStatus.classList.toggle("offline", !value);
}

export function syncToolButtons() {
  ui.brushButton?.classList.toggle("active", state.tool === "brush");
  ui.eraserButton?.classList.toggle("active", state.tool === "eraser");
  ui.itemButton?.classList.toggle("active", state.tool === "item");
  ui.mobileBrushButton?.classList.toggle("active", state.tool === "brush");
  ui.mobileEraserButton?.classList.toggle("active", state.tool === "eraser");
  ui.mobileItemButton?.classList.toggle("active", state.tool === "item");
}
