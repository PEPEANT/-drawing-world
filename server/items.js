function removeOwnerItems(room, owner) {
  const removed = room.items.filter((item) => isOwnerItem(item, owner));
  if (!removed.length) return [];

  const removedIds = new Set(removed.map((item) => item.id));
  room.items = room.items.filter((item) => !removedIds.has(item.id));
  if (room.radio && removedIds.has(room.radio.id)) {
    room.radio = null;
  }
  return Array.from(removedIds);
}

function isOwnerItem(item, owner) {
  return item.author === owner.playerId || item.owner === owner.clientId;
}

module.exports = {
  removeOwnerItems
};
