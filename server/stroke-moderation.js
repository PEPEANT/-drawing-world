const MAX_ADMIN_STROKES = 120;
const MAX_ADMIN_GROUPS = 36;
const MAX_PREVIEW_POINTS = 34;
const MAX_PREVIEW_STROKES = 28;
const GROUP_MARGIN = 170;
const PREVIEW_WIDTH = 180;
const PREVIEW_HEIGHT = 120;

function buildStrokeModeration(room) {
  const playerLookup = buildPlayerLookup(room);
  const groups = [];
  const strokes = room.strokes
    .filter((stroke) => stroke && stroke.tool !== "eraser" && Array.isArray(stroke.points))
    .slice(-MAX_ADMIN_STROKES)
    .reverse();

  for (const stroke of strokes) {
    const summary = summarizeStroke(stroke, playerLookup);
    const group = findGroup(groups, summary);
    if (group) {
      addStrokeToGroup(group, summary);
      continue;
    }
    groups.push(createGroup(summary));
  }

  return groups
    .sort((a, b) => b.latestOrder - a.latestOrder)
    .slice(0, MAX_ADMIN_GROUPS)
    .map(serializeGroup);
}

function buildPlayerLookup(room) {
  const byId = new Map();
  const byOwner = new Map();
  for (const player of room.players.values()) {
    byId.set(player.id, player);
    if (player.clientId) byOwner.set(player.clientId, player);
  }
  return { byId, byOwner };
}

function summarizeStroke(stroke, playerLookup) {
  const bounds = getBounds(stroke.points);
  const player = playerLookup.byId.get(stroke.author) || playerLookup.byOwner.get(stroke.owner);
  return {
    id: stroke.id,
    author: stroke.author,
    owner: stroke.owner || "",
    ownerKey: stroke.owner || stroke.author || "unknown",
    authorName: player?.name || stroke.name || "unknown",
    brush: stroke.brush || "round",
    color: /^#[0-9a-f]{6}$/i.test(stroke.color) ? stroke.color : "#111827",
    layerId: stroke.layerId || "layer-1",
    size: Number.isFinite(stroke.size) ? stroke.size : 6,
    pointCount: stroke.points.length,
    order: Number.isFinite(stroke.order) ? stroke.order : 0,
    player: player ? { x: player.x, y: player.y } : null,
    bounds,
    points: stroke.points
  };
}

function getBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.round(Math.min(...xs)),
    y: Math.round(Math.min(...ys)),
    w: Math.max(1, Math.round(Math.max(...xs) - Math.min(...xs))),
    h: Math.max(1, Math.round(Math.max(...ys) - Math.min(...ys)))
  };
}

function findGroup(groups, stroke) {
  return groups.find((group) => (
    group.ownerKey === stroke.ownerKey &&
    boundsNear(group.bounds, stroke.bounds)
  ));
}

function createGroup(stroke) {
  const group = {
    id: stroke.id,
    author: stroke.author,
    owner: stroke.owner,
    ownerKey: stroke.ownerKey,
    authorName: stroke.authorName,
    strokeIds: [],
    strokes: [],
    pointCount: 0,
    latestOrder: 0,
    bounds: { ...stroke.bounds },
    player: stroke.player
  };
  addStrokeToGroup(group, stroke);
  return group;
}

function addStrokeToGroup(group, stroke) {
  group.strokeIds.push(stroke.id);
  group.strokes.push(stroke);
  group.pointCount += stroke.pointCount;
  group.latestOrder = Math.max(group.latestOrder, stroke.order);
  group.bounds = mergeBounds(group.bounds, stroke.bounds);
  if (stroke.player) group.player = stroke.player;
}

function serializeGroup(group) {
  const center = {
    x: Math.round(group.bounds.x + group.bounds.w / 2),
    y: Math.round(group.bounds.y + group.bounds.h / 2)
  };
  return {
    id: group.id,
    author: group.author,
    owner: group.owner,
    authorName: group.authorName,
    strokeIds: group.strokeIds,
    strokeCount: group.strokeIds.length,
    pointCount: group.pointCount,
    bounds: group.bounds,
    center,
    playerDistance: getPlayerDistance(group.player, center),
    preview: buildGroupPreview(group)
  };
}

function buildGroupPreview(group) {
  return group.strokes
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(-MAX_PREVIEW_STROKES)
    .map((stroke) => ({
      id: stroke.id,
      color: stroke.color,
      size: Math.max(2, Math.min(10, stroke.size * 0.55)),
      points: samplePreview(stroke.points, group.bounds)
    }));
}

function samplePreview(points, bounds) {
  const step = Math.max(1, Math.ceil(points.length / MAX_PREVIEW_POINTS));
  const sampled = points.filter((_, index) => index % step === 0);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
  return sampled.map((point) => ({
    x: Math.round(((point.x - bounds.x) / bounds.w) * PREVIEW_WIDTH),
    y: Math.round(((point.y - bounds.y) / bounds.h) * PREVIEW_HEIGHT)
  }));
}

function boundsNear(a, b) {
  return (
    a.x - GROUP_MARGIN <= b.x + b.w &&
    a.x + a.w + GROUP_MARGIN >= b.x &&
    a.y - GROUP_MARGIN <= b.y + b.h &&
    a.y + a.h + GROUP_MARGIN >= b.y
  );
}

function mergeBounds(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return {
    x: left,
    y: top,
    w: Math.max(1, right - left),
    h: Math.max(1, bottom - top)
  };
}

function getPlayerDistance(player, center) {
  if (!Number.isFinite(player?.x) || !Number.isFinite(player?.y)) return null;
  return Math.round(Math.hypot(player.x - center.x, player.y - center.y));
}

module.exports = {
  buildStrokeModeration
};
