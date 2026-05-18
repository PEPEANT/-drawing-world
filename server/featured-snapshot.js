const CAPTURE = { width: 760, height: 500, padding: 42 };
const MAX_STROKES = 220;
const MAX_POINTS = 140;

function buildSnapshot(room, targetId, point) {
  const player = room.players.get(targetId);
  const targetKey = getTargetKey(room, targetId);
  const ownedStrokes = room.strokes.filter((stroke) => ownsStroke(stroke, targetId, targetKey));
  const crop = normalizePoint(point) ? getCrop(point) : null;
  let strokes = ownedStrokes
    .filter((stroke) => crop && strokeIntersectsCrop(stroke, crop))
    .slice(-MAX_STROKES)
    .map(cloneStroke);

  if (!strokes.length) {
    strokes = ownedStrokes.slice(-MAX_STROKES).map(cloneStroke);
  }
  if (!strokes.length) return null;

  const center = normalizePoint(point) || getStrokeCenter(strokes);
  return {
    targetId,
    targetKey,
    artistName: player?.name || "player",
    center,
    bounds: buildBounds(strokes, center),
    strokes
  };
}

function getTargetKey(room, targetId) {
  const player = room.players.get(targetId);
  return safeId(player?.clientId) || targetId;
}

function ownsStroke(stroke, targetId, targetKey) {
  return stroke?.author === targetId || (targetKey && stroke?.owner === targetKey);
}

function getCrop(point) {
  return {
    left: point.x - CAPTURE.width / 2,
    right: point.x + CAPTURE.width / 2,
    top: point.y - CAPTURE.height / 2,
    bottom: point.y + CAPTURE.height / 2
  };
}

function strokeIntersectsCrop(stroke, crop) {
  const points = stroke.points || [];
  if (points.some((point) => pointInCrop(point, crop))) return true;
  for (let i = 1; i < points.length; i += 1) {
    if (segmentIntersectsCrop(points[i - 1], points[i], crop)) return true;
  }
  return false;
}

function pointInCrop(point, crop) {
  return (
    point.x >= crop.left &&
    point.x <= crop.right &&
    point.y >= crop.top &&
    point.y <= crop.bottom
  );
}

function segmentIntersectsCrop(a, b, crop) {
  if (!isPoint(a) || !isPoint(b)) return false;
  if (pointInCrop(a, crop) || pointInCrop(b, crop)) return true;
  if (Math.max(a.x, b.x) < crop.left || Math.min(a.x, b.x) > crop.right) return false;
  if (Math.max(a.y, b.y) < crop.top || Math.min(a.y, b.y) > crop.bottom) return false;
  return (
    segmentsIntersect(a, b, { x: crop.left, y: crop.top }, { x: crop.right, y: crop.top }) ||
    segmentsIntersect(a, b, { x: crop.right, y: crop.top }, { x: crop.right, y: crop.bottom }) ||
    segmentsIntersect(a, b, { x: crop.right, y: crop.bottom }, { x: crop.left, y: crop.bottom }) ||
    segmentsIntersect(a, b, { x: crop.left, y: crop.bottom }, { x: crop.left, y: crop.top })
  );
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (abC === 0 && onSegment(a, c, b)) return true;
  if (abD === 0 && onSegment(a, d, b)) return true;
  if (cdA === 0 && onSegment(c, a, d)) return true;
  if (cdB === 0 && onSegment(c, b, d)) return true;
  return abC !== abD && cdA !== cdB;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.000001) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return (
    b.x >= Math.min(a.x, c.x) &&
    b.x <= Math.max(a.x, c.x) &&
    b.y >= Math.min(a.y, c.y) &&
    b.y <= Math.max(a.y, c.y)
  );
}

function isPoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function getStrokeCenter(strokes) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke.points || []) {
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
      top = Math.min(top, point.y);
      bottom = Math.max(bottom, point.y);
    }
  }
  if (!Number.isFinite(left)) return { x: 1600, y: 1100 };
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function normalizePoint(point) {
  return isPoint(point) ? { x: point.x, y: point.y } : null;
}

function buildBounds(strokes, center) {
  let left = center.x;
  let right = center.x;
  let top = center.y;
  let bottom = center.y;

  for (const stroke of strokes) {
    for (const point of stroke.points || []) {
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
      top = Math.min(top, point.y);
      bottom = Math.max(bottom, point.y);
    }
  }

  return {
    x: left - CAPTURE.padding,
    y: top - CAPTURE.padding,
    width: Math.max(180, right - left + CAPTURE.padding * 2),
    height: Math.max(140, bottom - top + CAPTURE.padding * 2)
  };
}

function cloneStroke(stroke) {
  return {
    id: stroke.id,
    color: stroke.color,
    size: stroke.size,
    tool: stroke.tool,
    brush: stroke.brush,
    points: samplePoints(stroke.points || [])
  };
}

function samplePoints(points) {
  if (points.length <= MAX_POINTS) return points.map(clonePoint);
  const step = Math.ceil(points.length / MAX_POINTS);
  const sampled = points.filter((_, index) => index % step === 0).map(clonePoint);
  const last = clonePoint(points[points.length - 1]);
  const tail = sampled[sampled.length - 1];
  if (!tail || tail.x !== last.x || tail.y !== last.y) sampled.push(last);
  return sampled;
}

function clonePoint(point) {
  return { x: point.x, y: point.y, pressure: point.pressure };
}

function safeId(value) {
  return typeof value === "string" ? value.replace(/[^a-z0-9_-]/gi, "").slice(0, 80) : "";
}

module.exports = {
  buildSnapshot,
  getTargetKey
};
