const { getAiBot } = require("./ai-bot");
const { getAiMemorySummary } = require("./ai-bot-memory");
const { startAiBotWalk } = require("./ai-bot-brain");
const { setAiState } = require("./ai-bot-state");
const { broadcast } = require("./protocol");

const WORLD = { width: 3200, height: 2200 };
const ENTRY_FOCUS_DISTANCE = 210;

function focusAiBotOnHumanEntry(room, player) {
  if (!room || !player) return { bot: null, focused: false };
  const bot = getAiBot(room.name);
  if (!bot || bot.ai?.mode === "drawing") return { bot, focused: false };

  const observePoint = getEntryObservePoint(player);
  bot.x = observePoint.x;
  bot.y = observePoint.y;
  bot.moving = false;
  setAiState(bot, {
    mode: "observing",
    lifecycle: "active",
    intent: "유저 입장 감지",
    target: "유저 주변",
    score: 55,
    reason: "빈 방에 유저가 들어와 AI봇을 화면 근처 관찰 지점으로 배치",
    speech: "",
    route: null,
    memory: getAiMemorySummary(room.name)
  }, room.name, { type: "wake", detail: "유저 입장 위치로 초점 이동" });
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);

  startAiBotWalk(room, bot, {
    target: {
      x: observePoint.x,
      y: observePoint.y,
      key: "human_entry",
      label: "입장 유저 주변",
      intent: "유저 입장 관찰",
      score: 55,
      reason: "첫 유저가 들어와 화면 근처에서 관찰 시작",
      routeType: "human"
    }
  });
  return { bot, focused: true };
}

function getEntryObservePoint(player) {
  const px = Number(player.x) || WORLD.width / 2;
  const py = Number(player.y) || WORLD.height / 2;
  return {
    x: clamp(px + ENTRY_FOCUS_DISTANCE, 0, WORLD.width),
    y: clamp(py - ENTRY_FOCUS_DISTANCE * 0.45, 0, WORLD.height)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { focusAiBotOnHumanEntry };
