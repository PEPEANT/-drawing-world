const { sanitizeRoomName } = require("./validation");
const { buildStrokeModeration } = require("./stroke-moderation");
const { buildFeaturedTop } = require("./featured");

const rooms = new Map();

function getRoom(name) {
  const roomName = sanitizeRoomName(name);
  if (!rooms.has(roomName)) {
    rooms.set(roomName, {
      name: roomName,
      strokes: [],
      items: [],
      messages: [],
      radio: null,
      strokeSeq: 0,
      players: new Map(),
      clients: new Set()
    });
  }
  return rooms.get(roomName);
}

function removeRoomIfEmpty(roomName) {
  const room = rooms.get(roomName);
  if (
    room &&
    room.clients.size === 0 &&
    countHumanPlayers(room) === 0 &&
    countBots(room) === 0 &&
    room.strokes.length === 0 &&
    room.items.length === 0 &&
    room.messages.length === 0
  ) {
    rooms.delete(roomName);
  }
}

function listRooms() {
  return Array.from(rooms.values()).map((room) => ({
    name: room.name,
    clients: Array.from(room.clients).filter((client) => !client.isSpectator).length,
    viewers: Array.from(room.clients).filter((client) => client.isSpectator).length,
    players: Array.from(room.players.values()),
    playerCount: countHumanPlayers(room),
    botCount: countBots(room),
    strokes: room.strokes.length,
    moderationStrokes: buildStrokeModeration(room),
    featured: buildFeaturedTop(room),
    items: room.items.length,
    messages: room.messages.length
  }));
}

function countHumanPlayers(room) {
  return Array.from(room.players.values()).filter((player) => !player.isBot).length;
}

function countBots(room) {
  return Array.from(room.players.values()).filter((player) => player.isBot).length;
}

module.exports = {
  countBots,
  countHumanPlayers,
  getRoom,
  listRooms,
  removeRoomIfEmpty,
  rooms
};
