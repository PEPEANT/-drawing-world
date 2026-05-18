const { broadcast } = require("./protocol");
const { getRoom, removeRoomIfEmpty, rooms } = require("./rooms");
const { sanitizeRoomName } = require("./validation");
const { buildRanking } = require("./votes");

const BOT_CLIENT_ID = "ai-bot-observer-v2";
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

function createAiBot(roomName = "lobby") {
  const room = getRoom(roomName);
  const id = getBotId(room.name);
  const existing = room.players.get(id);
  if (existing) return { bot: existing, created: false };

  const now = Date.now();
  const bot = {
    id,
    clientId: BOT_CLIENT_ID,
    name: "AI 관측자 v2",
    color: "#8b5cf6",
    skin: BOT_SKIN,
    x: 1600,
    y: 1080,
    facing: 1,
    moving: false,
    connectedAt: now,
    updatedAt: now,
    isBot: true,
    botType: "observer-v2"
  };
  room.players.set(id, bot);
  broadcast(room, { type: "playerJoin", player: bot }, undefined);
  broadcast(room, { type: "ranking", ranking: buildRanking(room) }, undefined);
  return { bot, created: true };
}

function getAiBot(roomName = "lobby") {
  const room = rooms.get(sanitizeRoomName(roomName));
  return room?.players.get(getBotId(room.name)) || null;
}

function removeAiBot(roomName = "lobby") {
  const room = rooms.get(sanitizeRoomName(roomName));
  const bot = room?.players.get(getBotId(room?.name || roomName));
  if (!room || !bot) return { bot: null, removed: false };
  room.players.delete(bot.id);
  broadcast(room, { type: "playerLeave", id: bot.id }, undefined);
  broadcast(room, { type: "ranking", ranking: buildRanking(room) }, undefined);
  removeRoomIfEmpty(room.name);
  return { bot, removed: true };
}

function getBotId(roomName) {
  return `ai-bot:${roomName}`;
}

module.exports = { createAiBot, getAiBot, removeAiBot };
