function deleteOwnStrokeIds(room, playerId, ownerId, ids) {
  const requested = new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  if (!requested.size) return [];
  return deleteStrokeIds(room, (stroke) => requested.has(stroke.id) && isOwnedBy(stroke, playerId, ownerId));
}

function isOwnedBy(stroke, playerId, ownerId) {
  return stroke.author === playerId || (ownerId && stroke.owner === ownerId);
}

function deleteAdminStrokeIds(room, ids) {
  const requested = new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  if (!requested.size) return [];
  return deleteStrokeIds(room, (stroke) => requested.has(stroke.id));
}

function deleteStrokeIds(room, predicate) {
  const deletedIds = room.strokes.filter(predicate).map((stroke) => stroke.id);
  if (!deletedIds.length) return [];
  const deleted = new Set(deletedIds);
  room.strokes = room.strokes.filter((stroke) => !deleted.has(stroke.id));
  return deletedIds;
}

function clearPlayerStrokes(room, playerId, ownerId) {
  const before = room.strokes.length;
  room.strokes = room.strokes.filter((stroke) => !isOwnedBy(stroke, playerId, ownerId));
  return before - room.strokes.length;
}

module.exports = {
  clearPlayerStrokes,
  deleteAdminStrokeIds,
  deleteOwnStrokeIds,
  isOwnedBy
};
