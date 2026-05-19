import { getRoomName, PALETTE } from "../config.js";
import { player, state } from "../state.js";
import { savePlayerIdentity } from "../storage.js";
import { clamp } from "../utils.js";
import { ui } from "./dom.js";
import { fillSkinArea } from "./skin-fill.js";
import { initLobbyArchive } from "./lobby-archive.js";
import { initRoomList } from "./room-list.js";
import { loadSkinImageFile, saveSkinPng as saveSkinFile } from "./skin-files.js";
import { SKIN_PRESETS, SKIN_SIZE, clearSkinContext } from "./skin-presets.js";

const SKIN_SCALE = 5;
const PREVIEW_SCALE = 2;
const SKIN_BRUSH_SIZES = [1, 2, 4];
let ctx = null;
let previewCtx = null;
let selectedColor = player.color;
let selectedPreset = "painter";
let skinTool = "pen";
let skinBrushSize = 1;
let painting = false;

export function initLobby({ startGame }) {
  ctx = ui.skinCanvas.getContext("2d");
  previewCtx = ui.skinPreview.getContext("2d");
  ui.lobbyNameInput.value = player.name;
  ui.skinColorInput.value = selectedColor;
  setupCanvas(ui.skinCanvas, SKIN_SCALE);
  setupCanvas(ui.skinPreview, PREVIEW_SCALE);

  renderSkinPresets();
  renderSkinPalette();
  renderBrushSizes();
  loadSkin();
  initRoomList(ui);
  initLobbyArchive(ui);
  ui.lobbyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    player.name = ui.lobbyNameInput.value.trim().slice(0, 18) || player.name;
    player.color = selectedColor;
    player.skin = ui.skinCanvas.toDataURL("image/png");
    savePlayerIdentity(player);

    const selectedRoom = ui.lobbyForm.dataset.room || getRoomName();
    if (getRoomName() !== selectedRoom) {
      history.replaceState(null, "", `/?room=${encodeURIComponent(selectedRoom)}`);
    }
    ui.roomName.textContent = `room: ${getRoomName()}`;

    state.gameStarted = true;
    document.body.classList.remove("lobby-open");
    startGame();
  });

  ui.skinColorInput.addEventListener("input", () => selectColor(ui.skinColorInput.value));
  ui.skinEraserButton.addEventListener("click", () => setSkinTool("eraser"));
  ui.skinFillButton.addEventListener("click", () => setSkinTool("fill"));
  ui.skinClearButton.addEventListener("click", clearSkin);
  ui.skinDefaultButton.addEventListener("click", () => applyPreset("painter"));
  ui.skinLoadButton.addEventListener("click", () => ui.skinFileInput.click());
  ui.skinFileInput.addEventListener("change", loadSkinFile);
  ui.skinSaveButton.addEventListener("click", saveSkinPng);
  ui.skinCanvas.addEventListener("pointerdown", startPainting);
  ui.skinCanvas.addEventListener("pointermove", paintPixel);
  ui.skinCanvas.addEventListener("pointerup", stopPainting);
  ui.skinCanvas.addEventListener("pointercancel", stopPainting);
  ui.skinCanvas.addEventListener("pointerleave", stopPainting);
}

function setupCanvas(canvas, scale) {
  canvas.style.width = `${SKIN_SIZE * scale}px`;
  canvas.style.height = `${SKIN_SIZE * scale}px`;
  canvas.style.imageRendering = "pixelated";
}

function renderSkinPresets() {
  ui.skinPresets.replaceChildren();
  for (const preset of SKIN_PRESETS) {
    const button = document.createElement("button");
    const thumbnail = document.createElement("canvas");
    const label = document.createElement("span");
    const thumbCtx = thumbnail.getContext("2d");

    button.type = "button";
    button.className = "skin-preset";
    button.dataset.preset = preset.id;
    thumbnail.width = SKIN_SIZE;
    thumbnail.height = SKIN_SIZE;
    label.textContent = preset.name;

    preset.draw(thumbCtx);
    button.append(thumbnail, label);
    button.addEventListener("click", () => applyPreset(preset.id));
    ui.skinPresets.append(button);
  }
}

function renderSkinPalette() {
  const colors = [
    "#111827",
    "#ffffff",
    "#94a3b8",
    "#f5b892",
    ...PALETTE,
    "#f97316",
    "#facc15",
    "#f9a8d4"
  ];
  ui.skinPalette.replaceChildren();
  for (const color of colors) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skin-swatch";
    button.dataset.color = color;
    button.style.background = color;
    button.addEventListener("click", () => selectColor(color));
    ui.skinPalette.append(button);
  }
}

function renderBrushSizes() {
  ui.skinBrushSizes.replaceChildren();
  for (const size of SKIN_BRUSH_SIZES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.skinSize = String(size);
    button.textContent = `${size}px`;
    button.addEventListener("click", () => {
      skinBrushSize = size;
      syncEditorUi();
    });
    ui.skinBrushSizes.append(button);
  }
}

function loadSkin() {
  applyPreset("painter");
}

function applyPreset(presetId) {
  const preset = SKIN_PRESETS.find((item) => item.id === presetId) || SKIN_PRESETS[0];
  selectedPreset = preset.id;
  if (preset.id !== "custom") {
    preset.draw(ctx);
  }
  updatePreview();
  syncEditorUi();
}

function clearSkin() {
  selectedPreset = "custom";
  clearSkinContext(ctx);
  updatePreview();
  syncEditorUi();
}

function startPainting(event) {
  painting = true;
  selectedPreset = "custom";
  ui.skinCanvas.setPointerCapture(event.pointerId);
  paintPixel(event);
}

function paintPixel(event) {
  if (!painting) return;
  event.preventDefault();

  const rect = ui.skinCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * SKIN_SIZE);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * SKIN_SIZE);
  const startX = clamp(x - Math.floor(skinBrushSize / 2), 0, SKIN_SIZE - skinBrushSize);
  const startY = clamp(y - Math.floor(skinBrushSize / 2), 0, SKIN_SIZE - skinBrushSize);

  if (skinTool === "fill") {
    fillSkinArea(ctx, x, y, selectedColor);
  } else if (skinTool === "eraser") {
    ctx.clearRect(startX, startY, skinBrushSize, skinBrushSize);
  } else {
    ctx.fillStyle = selectedColor;
    ctx.fillRect(startX, startY, skinBrushSize, skinBrushSize);
  }

  updatePreview();
  syncEditorUi();
}

function stopPainting(event) {
  if (event?.pointerId !== undefined && ui.skinCanvas.hasPointerCapture(event.pointerId)) {
    ui.skinCanvas.releasePointerCapture(event.pointerId);
  }
  painting = false;
}

function selectColor(color) {
  selectedColor = color;
  ui.skinColorInput.value = color;
  setSkinTool("pen");
}

function setSkinTool(nextTool) {
  skinTool = nextTool;
  syncEditorUi();
}

function saveSkinPng() {
  player.color = selectedColor;
  saveSkinFile(ui.skinCanvas, player, savePlayerIdentity);
}

async function loadSkinFile() {
  const file = ui.skinFileInput.files?.[0];
  ui.skinFileInput.value = "";
  try {
    player.skin = await loadSkinImageFile(file, ui.skinCanvas, SKIN_SIZE);
    savePlayerIdentity(player);
    selectedPreset = "custom";
    updatePreview();
    syncEditorUi();
  } catch {
  }
}

function updatePreview() {
  previewCtx.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.drawImage(ui.skinCanvas, 0, 0);
}

function syncEditorUi() {
  ui.skinEditor.classList.toggle("is-customizing", selectedPreset === "custom");
  ui.skinEraserButton.classList.toggle("active", skinTool === "eraser");
  ui.skinFillButton.classList.toggle("active", skinTool === "fill");
  for (const swatch of ui.skinPalette.querySelectorAll("[data-color]")) {
    swatch.classList.toggle("active", skinTool === "pen" && swatch.dataset.color === selectedColor);
  }
  for (const button of ui.skinBrushSizes.querySelectorAll("[data-skin-size]")) {
    button.classList.toggle("active", Number(button.dataset.skinSize) === skinBrushSize);
  }
  for (const button of ui.skinPresets.querySelectorAll("[data-preset]")) {
    button.classList.toggle("active", button.dataset.preset === selectedPreset);
  }
}
