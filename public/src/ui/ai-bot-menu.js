import { PLAYER } from "../config.js";
import { state } from "../state.js";
import { ui } from "./dom.js";

const INTENT_TEXT = {
  greeting: "안녕",
  observe_user_art: "내 그림 봐줘",
  observe_here: "여기도 봐줘",
  chat_together: "같이 대화하자",
  ask_popular_art: "인기 그림 알려줘",
  request_art_advice: "조언해줘",
  request_next_idea: "뭐 그릴까",
  request_color_tip: "색 추천",
  request_ai_draw: "AI 그림 그려줘"
};

let bound = false;
let active = null;
let sendRequest = null;

export function handleAiBotPointer(point, event, send) {
  if (state.tool !== "none" || !ui.aiBotMenu) return false;
  const bot = findAiBotAt(point);
  if (!bot) return false;
  bindMenu();
  active = {
    botId: bot.id,
    botName: bot.name || "AI봇",
    point: {
      x: Math.round(point.x),
      y: Math.round(point.y)
    }
  };
  sendRequest = send;
  openMenu(event.clientX, event.clientY, active.botName);
  return true;
}

export function closeAiBotMenu() {
  active = null;
  if (ui.aiBotMenu) ui.aiBotMenu.classList.add("hidden");
}

function bindMenu() {
  if (bound || !ui.aiBotMenu) return;
  bound = true;
  ui.aiBotMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-bot-intent]");
    if (!button) return;
    event.preventDefault();
    submitIntent(button.dataset.aiBotIntent);
  });
  ui.aiBotMenuClose?.addEventListener("click", closeAiBotMenu);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAiBotMenu();
  });
}

function openMenu(clientX, clientY, botName) {
  if (!ui.aiBotMenu) return;
  if (ui.aiBotMenuStatus) ui.aiBotMenuStatus.textContent = botName;
  ui.aiBotMenu.style.left = `${Math.min(window.innerWidth - 244, clientX + 12)}px`;
  ui.aiBotMenu.style.top = `${Math.min(window.innerHeight - 326, clientY + 12)}px`;
  ui.aiBotMenu.classList.remove("hidden");
}

function submitIntent(intent) {
  if (!active || !sendRequest || !intent) return;
  sendRequest({
    type: "aiBotInteract",
    botId: active.botId,
    intent,
    text: INTENT_TEXT[intent] || "안녕",
    targetPoint: active.point
  });
  closeAiBotMenu();
}

function findAiBotAt(point) {
  let best = null;
  let bestDistance = Math.max(PLAYER.voteRadius + 10, 52 / state.camera.zoom);
  for (const player of state.remotePlayers.values()) {
    if (player.isBot !== true) continue;
    const x = Number.isFinite(player.renderX) ? player.renderX : player.x;
    const y = Number.isFinite(player.renderY) ? player.renderY : player.y;
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < bestDistance) {
      best = player;
      bestDistance = distance;
    }
  }
  return best;
}
