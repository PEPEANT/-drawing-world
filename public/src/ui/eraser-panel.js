import { state } from "../state.js";
import { ui } from "./dom.js";
import { updateToolCursor } from "./cursor.js";
import { closeLayerPanel } from "./layers.js";

let setToolCallback = null;
const ERASER_TYPES = [
  { id: "round", label: "원형 지우개" },
  { id: "square", label: "네모 지우개" },
  { id: "spray", label: "스프레이 지우개" }
];

export function initEraserPanel({ setTool }) {
  setToolCallback = setTool;
  renderEraserTypes();
  ui.eraserSizeInput.value = state.eraserSize;
  ui.eraserSizeOutput.value = state.eraserSize;
  ui.eraserPanelClose.addEventListener("click", closeEraserPanel);
  ui.eraserSizeInput.addEventListener("input", updateEraserSize);
  ui.eraserTypeButtons.addEventListener("click", (event) => {
    const button = event.target.closest("[data-eraser-type]");
    if (!button) return;
    state.eraserType = button.dataset.eraserType;
    localStorage.setItem("drawing-online:eraser-type", state.eraserType);
    setToolCallback("eraser");
    syncEraserPanel();
  });
}

export function openEraserPanel() {
  ui.eraserPanel.classList.remove("hidden");
  syncEraserPanel();
}

export function closeEraserPanel() {
  ui.eraserPanel.classList.add("hidden");
  closeLayerPanel();
}

export function syncEraserPanel() {
  for (const button of ui.eraserTypeButtons.querySelectorAll("[data-eraser-type]")) {
    button.classList.toggle("active", button.dataset.eraserType === state.eraserType);
  }
  const eraser = ERASER_TYPES.find((item) => item.id === state.eraserType) || ERASER_TYPES[0];
  ui.eraserTypeLabel.textContent = eraser.label;
  updateToolCursor();
}

function updateEraserSize() {
  state.eraserSize = Number(ui.eraserSizeInput.value) || 18;
  ui.eraserSizeOutput.value = state.eraserSize;
  localStorage.setItem("drawing-online:eraser-size", String(state.eraserSize));
  updateToolCursor();
}

function renderEraserTypes() {
  ui.eraserTypeButtons.replaceChildren();
  for (const eraser of ERASER_TYPES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.eraserType = eraser.id;
    button.textContent = eraser.label;
    ui.eraserTypeButtons.append(button);
  }
}
