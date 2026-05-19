import { STORAGE_KEYS } from "../src/config.js";
import { SKIN_PRESETS, SKIN_SIZE } from "../src/ui/skin-presets.js";

const AI_SKIN_KEY = "simulac-draw-world:ai-bot-skin:v1";

let choices = [];
let selectedId = "";
let selectedSkin = "";

export function setupBotSkinSelector(dom) {
  choices = buildSkinChoices();
  dom.skinChoices.replaceChildren(...choices.map((choice) => createChoiceButton(dom, choice)));

  const savedId = localStorage.getItem(AI_SKIN_KEY);
  const fallbackId = choices.some((choice) => choice.id === "robot") ? "robot" : choices[0]?.id;
  selectSkin(dom, choices.some((choice) => choice.id === savedId) ? savedId : fallbackId);
}

export function getSelectedBotSkin() {
  return selectedSkin;
}

export function setBotSkinSelectorEnabled(dom, enabled) {
  dom.skinHint.textContent = enabled ? "생성 전 적용" : "퇴장 후 변경";
  dom.skinChoices.querySelectorAll("button").forEach((button) => {
    button.disabled = !enabled;
  });
}

function buildSkinChoices() {
  const presetChoices = SKIN_PRESETS
    .filter((preset) => preset.id !== "custom")
    .map((preset) => ({
      id: preset.id,
      name: preset.name,
      skin: drawPresetSkin(preset),
      draw: preset.draw
    }));

  const playerSkin = getStoredPlayerSkin();
  if (playerSkin) {
    presetChoices.push({
      id: "player",
      name: "내 스킨",
      skin: playerSkin
    });
  }

  return presetChoices;
}

function createChoiceButton(dom, choice) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bot-skin-choice";
  button.dataset.skinId = choice.id;

  const preview = createPreview(choice);
  const label = document.createElement("span");
  label.textContent = choice.name;
  button.append(preview, label);

  button.addEventListener("click", () => selectSkin(dom, choice.id));
  return button;
}

function createPreview(choice) {
  if (!choice.draw) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = choice.skin;
    return image;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SKIN_SIZE;
  canvas.height = SKIN_SIZE;
  choice.draw(canvas.getContext("2d"));
  return canvas;
}

function selectSkin(dom, id) {
  const choice = choices.find((item) => item.id === id) || choices[0];
  if (!choice) return;

  selectedId = choice.id;
  selectedSkin = choice.skin;
  localStorage.setItem(AI_SKIN_KEY, selectedId);

  dom.skinChoices.querySelectorAll("[data-skin-id]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.skinId === selectedId);
  });
}

function drawPresetSkin(preset) {
  const canvas = document.createElement("canvas");
  canvas.width = SKIN_SIZE;
  canvas.height = SKIN_SIZE;
  preset.draw(canvas.getContext("2d"));
  return canvas.toDataURL("image/png");
}

function getStoredPlayerSkin() {
  const skin = localStorage.getItem(STORAGE_KEYS.skin) || "";
  return skin.startsWith("data:image/png;base64,") ? skin : "";
}
