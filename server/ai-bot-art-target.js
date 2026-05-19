const RECENT_STROKE_LIMIT = 40;
const POINT_LIMIT = 2000;
const CLUSTER_RADIUS = 420;
const OBSERVE_OFFSET = 110;

function findRecentUserArtTarget(room, userRef = {}) {
  if (!room || !Array.isArray(room.strokes)) return null;
  const userStrokes = collectRecentUserStrokes(room.strokes, userRef);
  if (!userStrokes.length) return null;

  const anchor = getStrokeCenter(userStrokes[0]);
  if (!anchor) return null;

  const cluster = [];
  for (const stroke of userStrokes) {
    const center = getStrokeCenter(stroke);
    if (!center) continue;
    if (Math.hypot(center.x - anchor.x, center.y - anchor.y) <= CLUSTER_RADIUS) {
      cluster.push(stroke);
    }
  }

  const target = summarizeStrokes(cluster.length ? cluster : [userStrokes[0]]);
  if (!target) return null;

  const observePoint = buildObservePoint(target.center, target.bounds);
  return {
    key: "user_recent_art",
    label: `${userRef.userName || "유저"} 최근 그림`,
    x: observePoint.x,
    y: observePoint.y,
    center: target.center,
    bounds: target.bounds,
    strokeCount: target.strokeCount,
    pointCount: target.pointCount,
    latestStrokeId: userStrokes[0]?.id || "",
    intent: "유저 그림 관찰",
    score: 100,
    reason: `최근 그림 묶음 ${target.strokeCount}개 선 기준`,
    routeType: "art"
  };
}

function buildArtCoachResponse(room, userRef = {}, intent = "request_art_advice") {
  const meta = getRecentArtMeta(room, userRef);
  const reply = pickCoachReply(meta, intent);
  return {
    reply,
    targetMeta: meta,
    memoryNote: `그림 조언: 선 ${meta.strokeCount}개, 색 ${meta.colorCount}개, 영역 ${meta.drawingArea}`,
    nextAction: intent
  };
}

function getRecentArtMeta(room, userRef = {}) {
  if (!room || !Array.isArray(room.strokes)) return emptyMeta();
  const hasUser = Boolean(userRef.userId || userRef.playerId);
  const strokes = hasUser ? collectRecentUserStrokes(room.strokes, userRef) : collectRecentArtStrokes(room.strokes);
  const summary = summarizeStrokes(strokes);
  if (!summary) return emptyMeta();
  const width = Math.max(0, summary.bounds.right - summary.bounds.left);
  const height = Math.max(0, summary.bounds.bottom - summary.bounds.top);
  return {
    strokeCount: summary.strokeCount,
    pointCount: summary.pointCount,
    colorCount: new Set(strokes.map((stroke) => stroke.color || "").filter(Boolean)).size,
    drawingArea: Math.round(width * height),
    width: Math.round(width),
    height: Math.round(height),
    latestStrokeId: strokes[0]?.id || ""
  };
}

function collectRecentUserStrokes(strokes, userRef) {
  const ownerId = String(userRef.userId || "");
  const playerId = String(userRef.playerId || "");
  return strokes
    .filter((stroke) => isUserStroke(stroke, ownerId, playerId))
    .sort(compareRecentStroke)
    .slice(0, RECENT_STROKE_LIMIT);
}

function collectRecentArtStrokes(strokes) {
  return strokes
    .filter((stroke) => stroke && stroke.tool !== "eraser" && !stroke.isBotArtwork)
    .sort(compareRecentStroke)
    .slice(0, RECENT_STROKE_LIMIT);
}

function isUserStroke(stroke, ownerId, playerId) {
  if (!stroke || stroke.tool === "eraser") return false;
  return (ownerId && stroke.owner === ownerId) || (playerId && stroke.author === playerId);
}

function compareRecentStroke(a, b) {
  const orderA = Number.isFinite(a?.order) ? a.order : 0;
  const orderB = Number.isFinite(b?.order) ? b.order : 0;
  if (orderA !== orderB) return orderB - orderA;
  return String(b?.id || "").localeCompare(String(a?.id || ""));
}

function summarizeStrokes(strokes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  let pointCount = 0;

  for (const stroke of strokes) {
    for (const point of Array.isArray(stroke.points) ? stroke.points : []) {
      if (pointCount >= POINT_LIMIT) break;
      const x = Number(point.x);
      const y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
      pointCount += 1;
    }
    if (pointCount >= POINT_LIMIT) break;
  }

  if (!pointCount) return null;
  return {
    center: {
      x: Math.round(sumX / pointCount),
      y: Math.round(sumY / pointCount)
    },
    bounds: {
      left: Math.round(minX),
      top: Math.round(minY),
      right: Math.round(maxX),
      bottom: Math.round(maxY)
    },
    strokeCount: strokes.length,
    pointCount
  };
}

function getStrokeCenter(stroke) {
  const summary = summarizeStrokes([stroke]);
  return summary?.center || null;
}

function buildObservePoint(center, bounds) {
  const width = Math.max(0, bounds.right - bounds.left);
  const height = Math.max(0, bounds.bottom - bounds.top);
  const preferRight = center.x < 2700;
  const preferBottom = center.y < 1800;
  const offsetX = Math.max(OBSERVE_OFFSET, Math.min(220, width * 0.35 + OBSERVE_OFFSET));
  const offsetY = Math.max(70, Math.min(160, height * 0.25 + 70));
  return {
    x: clamp(center.x + (preferRight ? offsetX : -offsetX), 0, 3200),
    y: clamp(center.y + (preferBottom ? offsetY : -offsetY), 0, 2200)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pickCoachReply(meta, intent) {
  if (!meta.strokeCount) {
    return {
      request_next_idea: "작은 표시부터 해볼래?",
      request_color_tip: "한 색으로 시작해봐.",
      request_composition_tip: "가운데에 크게 잡아봐.",
      request_encouragement: "괜찮아. 한 선부터 가자."
    }[intent] || "먼저 큰 선부터 가자.";
  }
  if (intent === "request_color_tip") {
    return meta.colorCount <= 1 ? "색 하나 더 얹어볼래?" : "주요 색 하나만 살려봐.";
  }
  if (intent === "request_composition_tip") {
    if (meta.width < 140 || meta.height < 140) return "조금 크게 그려봐.";
    if (meta.width > meta.height * 2) return "세로 여백도 써볼래?";
    if (meta.height > meta.width * 2) return "가로 여백도 써볼래?";
    return "중앙을 조금 비워봐.";
  }
  if (intent === "request_next_idea") {
    return meta.colorCount <= 1 ? "작은 배경색을 얹어봐." : "작은 배경을 얹어볼래?";
  }
  if (intent === "request_encouragement") {
    return meta.pointCount > 300 ? "이미 꽤 채워졌어." : "큰 형태부터 잡자.";
  }
  if (meta.strokeCount <= 2 || meta.pointCount < 20) return "큰 선 하나 더 이어봐.";
  if (meta.colorCount <= 1) return "색 하나 더 얹어볼래?";
  if (meta.drawingArea < 15000) return "조금 크게 그려봐.";
  if (meta.pointCount > 600) return "중심만 정리해보자.";
  return "포인트만 더 살려봐.";
}

function emptyMeta() {
  return { strokeCount: 0, pointCount: 0, colorCount: 0, drawingArea: 0, width: 0, height: 0, latestStrokeId: "" };
}

module.exports = {
  buildArtCoachResponse,
  findRecentUserArtTarget
};
