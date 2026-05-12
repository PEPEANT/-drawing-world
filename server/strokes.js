function deleteOwnStrokeIds(room, playerId, ids) {
  const requested = new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  if (!requested.size) return [];
  return deleteStrokeIds(room, (stroke) => requested.has(stroke.id) && stroke.author === playerId);
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

function clearPlayerStrokes(room, playerId) {
  const before = room.strokes.length;
  room.strokes = room.strokes.filter((stroke) => stroke.author !== playerId);
  return before - room.strokes.length;
}

module.exports = {
  clearPlayerStrokes,
  deleteAdminStrokeIds,
  deleteOwnStrokeIds
};
