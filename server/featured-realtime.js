const { notifyAdminState } = require("./admin");
const {
  buildFeaturedTop,
  recordArtworkLike,
  removeArtworkVote,
  removeFeaturedForTarget,
  rollRoomDay
} = require("./featured");
const { broadcast } = require("./protocol");
const { rooms } = require("./rooms");

function startDailyResetSweep() {
  const timer = setInterval(() => {
    for (const room of rooms.values()) resetRoomIfNeeded(room);
  }, 60 * 1000);
  timer.unref?.();
}

function resetRoomIfNeeded(room) {
  const reset = rollRoomDay(room);
  if (!reset) return;
  broadcast(room, {
    type: "dailyReset",
    day: reset.day,
    winners: reset.winners,
    featured: buildFeaturedTop(room)
  }, undefined);
  notifyAdminState();
}

function syncFeaturedVote(room, ws, message, targetId, result) {
  if (!result.changed) return;
  const vote = { voterId: ws.clientId || ws.id, targetId, point: message.point };
  const removed = result.previous === 1 && removeArtworkVote(room, vote);
  const added = result.value === 1 ? recordArtworkLike(room, vote).changed : false;
  if (removed || added) broadcast(room, { type: "featured", featured: buildFeaturedTop(room) }, undefined);
  if (added) broadcast(room, { type: "featuredFeedback", targetId, text: "스크린 후보 등록!" }, undefined);
}

function broadcastFeaturedRemoval(room, targetId) {
  removeFeaturedForTarget(room, targetId);
  broadcast(room, { type: "featured", featured: buildFeaturedTop(room) }, undefined);
}

module.exports = {
  broadcastFeaturedRemoval,
  resetRoomIfNeeded,
  syncFeaturedVote,
  startDailyResetSweep
};
