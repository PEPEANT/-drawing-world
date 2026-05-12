import { state } from "../state.js";
import { updateToolCursor } from "./cursor.js";
import { initColorPicker, syncColorPicker } from "./color-picker.js";
import { closeLayerPanel } from "./layers.js";
import { ui } from "./dom.js";

let setToolCallback = null;
const BRUSH_TYPES = [
  { id: "round", label: "기본 붓" },
  { id: "marker", label: "마커" },
  { id: "square", label: "네모 붓" },
  { id: "spray", label: "스프레이" }
];

export function initPaintPanel({ setTool }) {
  setToolCallback = setTool;
  renderBrushTypes();
  initColorPicker();

  ui.paintPanelClose.addEventListener("click", closePaintPanel);

  ui.paintPanel.addEventListener("click", (event) => {
    const brushButton = event.target.closest("[data-brush-type]");
    if (brushButton) {
      state.brushType = brushButton.dataset.brushType;
      localStorage.setItem("drawing-online:brush-type", state.brushType);
      setToolCallback("brush");
      syncPaintPanel();
      updateToolCursor();
      return;
    }

    const sizeButton = event.target.closest("[data-paint-size]");
    if (sizeButton) {
      ui.sizeInput.value = sizeButton.dataset.paintSize;
      ui.sizeOutput.value = ui.sizeInput.value;
    }
  });

  ui.paintPanel.addEventListener("dblclick", () => setToolCallback("brush"));
}

export function openPaintPanel() {
  ui.paintPanel.classList.remove("hidden");
  syncPaintPanel();
}

export function togglePaintPanel() {
  if (ui.paintPanel.classList.contains("hidden")) {
    openPaintPanel();
    return;
  }
  closePaintPanel();
}

export function closePaintPanel() {
  ui.paintPanel.classList.add("hidden");
  closeLayerPanel();
}

export function syncPaintPanel() {
  for (const button of ui.brushTypeButtons.querySelectorAll("[data-brush-type]")) {
    button.classList.toggle("active", button.dataset.brushType === state.brushType);
  }

  const brush = BRUSH_TYPES.find((item) => item.id === state.brushType) || BRUSH_TYPES[0];
  ui.brushTypeLabel.textContent = brush.label;
  syncColorPicker();
  updateToolCursor();
}

function renderBrushTypes() {
  ui.brushTypeButtons.replaceChildren();
  for (const brush of BRUSH_TYPES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.brushType = brush.id;
    button.textContent = brush.label;
    ui.brushTypeButtons.append(button);
  }
}
