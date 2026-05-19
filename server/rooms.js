const { sanitizeRoomName } = require("./validation");
const { buildStrokeModeration } = require("./stroke-moderation");
const { buildFeaturedTop } = require("./featured");
const { getRoomMeta, listRoomMetas } = require("./room-registry");

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
  const output = [];
  const seen = new Set();
  for (const meta of listRoomMetas()) {
    seen.add(meta.slug);
    output.push(buildRoomState(rooms.get(meta.slug), meta, true));
  }
  for (const room of rooms.values()) {
    if (seen.has(room.name)) continue;
    output.push(buildRoomState(room, getRoomMeta(room.name), false));
  }
  return output;
}

function buildRoomState(room, meta, configured) {
  return {
    name: meta.slug,
    displayName: meta.name,
    description: meta.description,
    hidden: meta.hidden,
    locked: meta.locked,
    configured,
    clients: room ? Array.from(room.clients).filter((client) => !client.isSpectator).length : 0,
    viewers: room ? Array.from(room.clients).filter((client) => client.isSpectator).length : 0,
    players: room ? Array.from(room.players.values()) : [],
    playerCount: room ? countHumanPlayers(room) : 0,
    botCount: room ? countBots(room) : 0,
    strokes: room ? room.strokes.length : 0,
    moderationStrokes: room ? buildStrokeModeration(room) : [],
    featured: room ? buildFeaturedTop(room) : [],
    items: room ? room.items.length : 0,
    messages: room ? room.messages.length : 0
  };
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
