const WAYPOINTS = {
  center: { x: 1600, y: 1100, label: "중앙 허브" },
  topGate: { x: 1600, y: 560, label: "상단 접근로" },
  westGate: { x: 920, y: 1120, label: "서쪽 관찰로" },
  eastGate: { x: 2280, y: 1120, label: "동쪽 관찰로" },
  southGate: { x: 1600, y: 1680, label: "남쪽 관찰로" }
};

function buildRoute(bot, target, controller = {}) {
  const type = target.routeType || "patrol";
  const routeName = getRouteName(type, target);
  const waypoints = buildWaypoints(type, bot, target, controller);
  return {
    name: routeName,
    purpose: target.intent || "관측",
    reason: target.reason || "규칙 기반 경로",
    index: 0,
    waypoints
  };
}

function getCurrentWaypoint(route) {
  return route?.waypoints?.[route.index] || null;
}

function advanceRoute(route) {
  if (!route || route.index >= route.waypoints.length - 1) return false;
  route.index += 1;
  return true;
}

function serializeRoute(route) {
  if (!route) return null;
  const current = getCurrentWaypoint(route);
  return {
    name: route.name,
    purpose: route.purpose,
    reason: route.reason,
    waypointIndex: route.index + 1,
    waypointTotal: route.waypoints.length,
    current: current?.label || "",
    next: current ? { x: Math.round(current.x), y: Math.round(current.y) } : null
  };
}

function buildWaypoints(type, bot, target, controller) {
  const destination = toWaypoint(target, target.label || "목적지");
  if (type === "top") return compactWaypoints([nearestHub(bot), WAYPOINTS.topGate, destination]);
  if (type === "human") return compactWaypoints([nearestHub(bot), destination]);
  if (type === "art") return compactWaypoints([nearestHub(bot), destination]);
  if (type === "chat") return compactWaypoints([nearestHub(bot), destination]);
  if (type === "patrol") return buildPatrolWaypoints(controller, destination);
  return compactWaypoints([nearestHub(bot), destination]);
}

function buildPatrolWaypoints(controller, destination) {
  const patrol = [WAYPOINTS.westGate, WAYPOINTS.topGate, WAYPOINTS.eastGate, WAYPOINTS.southGate];
  const start = Math.abs(Number(controller.step) || 0) % patrol.length;
  return compactWaypoints([patrol[start], patrol[(start + 1) % patrol.length], destination]);
}

function nearestHub(bot) {
  const hubs = [WAYPOINTS.center, WAYPOINTS.westGate, WAYPOINTS.eastGate, WAYPOINTS.southGate];
  return hubs
    .map((point) => ({ ...point, distance: Math.hypot(point.x - bot.x, point.y - bot.y) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function toWaypoint(point, label) {
  return {
    x: point.x,
    y: point.y,
    label
  };
}

function compactWaypoints(points) {
  const result = [];
  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const previous = result[result.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 80) continue;
    result.push({ x: point.x, y: point.y, label: point.label });
  }
  return result;
}

function getRouteName(type, target) {
  if (type === "top") return "route_top_screen";
  if (type === "art") return "route_recent_art";
  if (type === "human") return "route_player_observe";
  if (type === "chat") return "route_talk_target";
  if (type === "patrol") return "route_patrol_loop";
  return `route_${target.key || "observe"}`.replace(/[^a-z0-9_:-]/gi, "_").slice(0, 32);
}

module.exports = {
  advanceRoute,
  buildRoute,
  getCurrentWaypoint,
  serializeRoute
};
