function hasActiveClient(room, clientId) {
  if (!clientId) return false;
  for (const client of room.clients) {
    if (!client.isSpectator && client.readyState === 1 && client.clientId === clientId) return true;
  }
  return false;
}

function claimOwnerStrokes(room, ownerId, playerId) {
  const owner = safeOwner(ownerId);
  if (!owner || !playerId) return 0;
  let changed = 0;
  for (const stroke of room.strokes) {
    if (!stroke || stroke.owner !== owner || stroke.author === playerId) continue;
    stroke.author = playerId;
    changed += 1;
  }
  return changed;
}

function safeOwner(value) {
  return typeof value === "string" ? value.replace(/[^a-z0-9_-]/gi, "").slice(0, 80) : "";
}

module.exports = {
  claimOwnerStrokes,
  hasActiveClient,
  safeOwner
};
