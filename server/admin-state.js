const { buildAnalyticsState } = require("./analytics");
const { listBans } = require("./bans");
const { buildFeaturedArchive } = require("./featured");
const { listRooms } = require("./rooms");

function buildAdminState(adminCount) {
  const roomList = listRooms();
  return {
    at: Date.now(),
    roomCount: roomList.length,
    playerCount: roomList.reduce((total, room) => total + room.playerCount, 0),
    clientCount: roomList.reduce((total, room) => total + room.clients, 0),
    adminCount,
    analytics: buildAnalyticsState(),
    bans: listBans(),
    featured: buildFeaturedArchive(),
    rooms: roomList
  };
}

module.exports = { buildAdminState };
