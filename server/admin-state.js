const { buildAnalyticsState } = require("./analytics");
const { listBans } = require("./bans");
const { ADMIN_KEY_IS_DEFAULT } = require("./config");
const { buildFeaturedArchive } = require("./featured");
const { getFullBackupStatus } = require("./full-backup");
const { listRooms } = require("./rooms");

function buildAdminState(adminCount) {
  const roomList = listRooms();
  return {
    at: Date.now(),
    roomCount: roomList.length,
    playerCount: roomList.reduce((total, room) => total + room.playerCount, 0),
    clientCount: roomList.reduce((total, room) => total + room.clients, 0),
    adminCount,
    security: {
      adminKeyDefault: ADMIN_KEY_IS_DEFAULT
    },
    analytics: buildAnalyticsState(),
    fullBackup: getFullBackupStatus(),
    bans: listBans(),
    featured: buildFeaturedArchive(),
    rooms: roomList
  };
}

module.exports = { buildAdminState };
