const { sanitizeRoomName } = require("./validation");

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
    playerCount: room.players.size,
    strokes: room.strokes.length,
    items: room.items.length,
    messages: room.messages.length
  }));
}

module.exports = {
  getRoom,
  listRooms,
  removeRoomIfEmpty,
  rooms
};
