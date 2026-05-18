const { buildFeaturedTop } = require("./featured");

const WORLD = { width: 3200, height: 2200 };
const REVISIT_WINDOW_MS = 12000;
const PATROL_POINTS = [
  { x: 900, y: 760, label: "서쪽 빈 공간" },
  { x: 2300, y: 760, label: "동쪽 빈 공간" },
  { x: 2260, y: 1580, label: "남동쪽 빈 공간" },
  { x: 940, y: 1580, label: "남서쪽 빈 공간" }
];
const TOP_SCREENS = [
  { x: WORLD.width / 2 - 480, y: 120 },
  { x: WORLD.width / 2, y: 120 },
  { x: WORLD.width / 2 + 480, y: 120 }
];

function chooseScoredTarget(room, bot, controller) {
  const candidates = buildCandidates(room, bot, controller);
  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, bot, controller))
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
  const winner = ranked[0] || scoreCandidate(getFallbackTarget(controller), bot, controller);
  controller.visits[winner.key] = Date.now();
  return winner;
}

function buildCandidates(room, bot, controller) {
  return [
    getRecentArtCandidate(room, bot),
    getHumanCandidate(room, bot),
    getTopCandidate(room, controller),
    getPatrolCandidate(controller)
  ].filter(Boolean);
}

function getRecentArtCandidate(room, bot) {
  const strokes = room.strokes.slice(-14);
  const points = strokes.flatMap((stroke) => stroke.points || []).slice(-220);
  if (!points.length) return null;
  const center = averagePoints(points);
  const target = offsetFrom(center, bot, 135);
  return {
    ...target,
    key: "art:recent",
    label: "최근 그림",
    intent: "그림 관측",
    baseScore: 42 + Math.min(24, strokes.length * 3),
    reason: `최근 선 ${strokes.length}개`
  };
}

function getHumanCandidate(room, bot) {
  const humans = Array.from(room.players.values()).filter((player) => !player.isBot);
  if (!humans.length) return null;
  const center = averagePoints(humans);
  const nearest = Math.min(...humans.map((player) => Math.hypot(player.x - bot.x, player.y - bot.y)));
  const target = offsetFrom(center, bot, 190);
  const crowdBonus = Math.min(24, humans.length * 8);
  const tooClosePenalty = nearest < 160 ? 26 : 0;
  return {
    ...target,
    key: "human:cluster",
    label: "사람 주변",
    intent: "플레이어 관측",
    baseScore: 30 + crowdBonus - tooClosePenalty,
    reason: humans.length > 1 ? `플레이어 ${humans.length}명` : "플레이어 1명"
  };
}

function getTopCandidate(room, controller) {
  const featured = buildFeaturedTop(room);
  if (!featured.length) return null;
  const likes = featured.reduce((total, entry) => total + (Number(entry.likes) || 0), 0);
  const screen = TOP_SCREENS[controller.step % TOP_SCREENS.length];
  return {
    ...screen,
    key: "top:screens",
    label: "상단 스크린",
    intent: "TOP 관측",
    baseScore: 24 + featured.length * 5 + Math.min(18, likes * 4),
    reason: `TOP 후보 ${featured.length}개`
  };
}

function getPatrolCandidate(controller) {
  const point = leastRecentlyVisitedPatrol(controller);
  return {
    x: point.x,
    y: point.y,
    key: `patrol:${point.label}`,
    label: point.label,
    intent: "빈 공간 탐색",
    baseScore: 14,
    reason: "신호 없는 공간 확인"
  };
}

function getFallbackTarget(controller) {
  const point = PATROL_POINTS[controller.step % PATROL_POINTS.length];
  return {
    x: point.x,
    y: point.y,
    key: `patrol:${point.label}`,
    label: point.label,
    intent: "빈 공간 탐색",
    baseScore: 10,
    reason: "기본 순찰"
  };
}

function scoreCandidate(candidate, bot, controller) {
  const now = Date.now();
  const lastVisit = controller.visits?.[candidate.key] || 0;
  const revisitPenalty = lastVisit ? Math.max(0, 24 - ((now - lastVisit) / REVISIT_WINDOW_MS) * 24) : 0;
  const ageBonus = lastVisit ? Math.min(18, (now - lastVisit) / 3000) : 18;
  const distance = Math.hypot(candidate.x - bot.x, candidate.y - bot.y);
  const distancePenalty = Math.min(12, distance / 520);
  const score = Math.max(1, Math.round(candidate.baseScore + ageBonus - revisitPenalty - distancePenalty));
  return { ...candidate, score, distance: Math.round(distance), reason: `${candidate.reason} · ${score}점` };
}

function leastRecentlyVisitedPatrol(controller) {
  return PATROL_POINTS
    .map((point) => ({ ...point, last: controller.visits?.[`patrol:${point.label}`] || 0 }))
    .sort((a, b) => a.last - b.last || a.label.localeCompare(b.label, "ko"))[0];
}

function averagePoints(points) {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function offsetFrom(point, bot, radius) {
  const dx = bot.x - point.x || 1;
  const dy = bot.y - point.y || 1;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x: clamp(point.x + (dx / distance) * radius, 0, WORLD.width),
    y: clamp(point.y + (dy / distance) * radius, 0, WORLD.height)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { chooseScoredTarget };
