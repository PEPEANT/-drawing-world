const { broadcast } = require("./protocol");
const { getRoom, removeRoomIfEmpty, rooms } = require("./rooms");
const { sanitizeRoomName } = require("./validation");
const { buildRanking } = require("./votes");
const { ensureAiBotState, recordAiEvent, setAiState } = require("./ai-bot-state");

const BOT_CLIENT_ID = "ai-bot-observer-v2";
const MAX_BOT_SKIN_LENGTH = 20000;
const BOT_SKIN = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect x="8" y="7" width="16" height="18" fill="#475569"/>
  <rect x="10" y="9" width="12" height="10" fill="#dbeafe"/>
  <rect x="12" y="12" width="3" height="3" fill="#22d3ee"/>
  <rect x="18" y="12" width="3" height="3" fill="#f472b6"/>
  <rect x="14" y="20" width="5" height="2" fill="#0f172a"/>
  <rect x="15" y="4" width="2" height="3" fill="#22d3ee"/>
  <rect x="13" y="3" width="6" height="1" fill="#0f172a"/>
  <rect x="7" y="24" width="18" height="3" fill="#8b5cf6"/>
</svg>`)}`;

function createAiBot(roomName = "lobby", options = {}) {
  const room = getRoom(roomName);
  const id = getBotId(room.name);
  const existing = room.players.get(id);
  if (existing) {
    ensureAiBotState(existing, room.name);
    recordAiEvent(room.name, "duplicate", "이미 생성된 AI봇을 재사용");
    return { bot: existing, created: false };
  }

  const now = Date.now();
  const bot = {
    id,
    clientId: BOT_CLIENT_ID,
    name: "AI봇",
    color: "#8b5cf6",
    skin: safeBotSkin(options.skin) || BOT_SKIN,
    x: 1600,
    y: 1080,
    facing: 1,
    moving: false,
    connectedAt: now,
    updatedAt: now,
    isBot: true,
    botType: "observer-v2",
    ai: {}
  };
  setAiState(bot, {
    mode: "created",
    lifecycle: "active",
    intent: "대기",
    target: "",
    speech: "생성됐어. 이동 명령을 기다리는 중이야."
  }, room.name, { type: "create", detail: "AI봇 생성" });
  room.players.set(id, bot);
  broadcast(room, { type: "playerJoin", player: bot }, undefined);
  broadcast(room, { type: "ranking", ranking: buildRanking(room) }, undefined);
  return { bot, created: true };
}

function getAiBot(roomName = "lobby") {
  const room = rooms.get(sanitizeRoomName(roomName));
  return ensureAiBotState(room?.players.get(getBotId(room.name)), room?.name) || null;
}

function removeAiBot(roomName = "lobby") {
  const room = rooms.get(sanitizeRoomName(roomName));
  const bot = room?.players.get(getBotId(room?.name || roomName));
  if (!room || !bot) return { bot: null, removed: false };
  recordAiEvent(room.name, "remove", "AI봇 퇴장");
  room.players.delete(bot.id);
  broadcast(room, { type: "playerLeave", id: bot.id }, undefined);
  broadcast(room, { type: "ranking", ranking: buildRanking(room) }, undefined);
  removeRoomIfEmpty(room.name);
  return { bot, removed: true };
}

function getBotId(roomName) {
  return `ai-bot:${roomName}`;
}

function safeBotSkin(value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("data:image/png;base64,")) return "";
  return value.length <= MAX_BOT_SKIN_LENGTH ? value : "";
}

module.exports = { createAiBot, getAiBot, removeAiBot };
