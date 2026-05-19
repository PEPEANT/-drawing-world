const { collectAiBotSenses } = require("./ai-bot-senses");
const { getAiDialogueSummary } = require("./ai-bot-conversation");
const { buildRoute } = require("./ai-bot-routes");

const WORLD = { width: 3200, height: 2200 };
const REVISIT_WINDOW_MS = 90 * 1000;
const DIALOGUE_PRIORITY_MS = 90 * 1000;
const RECENT_TARGET_PENALTIES = [48, 38, 28, 18, 10];
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

function chooseScoredTarget(room, bot, controller, options = {}) {
  const senses = collectAiBotSenses(room, bot);
  controller.senses = senses.slice(0, 5);
  const candidates = buildCandidates(room, bot, controller, senses);
  const route = options.route || controller.preferredRoute;
  const preferred = getPreferredCandidates(candidates, route, controller);
  const pool = preferred.length ? preferred : candidates;
  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, bot, controller))
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
  const rankedPool = pool
    .map((candidate) => scoreCandidate(candidate, bot, controller))
    .sort((a, b) => b.score - a.score || a.distance - b.distance);
  controller.attention = mergeAttention(rankedPool, ranked).slice(0, 3).map(serializeAttention);
  const winner = rankedPool[0] || ranked[0] || scoreCandidate(getFallbackTarget(controller), bot, controller);
  controller.visits[winner.key] = Date.now();
  controller.recentTargets = [winner.key, ...(controller.recentTargets || []).filter((key) => key !== winner.key)].slice(0, 5);
  return { ...winner, route: buildRoute(bot, winner, controller) };
}

function buildCandidates(room, bot, controller, senses) {
  return [
    getDialogueCandidate(room, bot),
    ...senses.map((sense) => buildCandidateFromSense(room, bot, controller, sense))
  ].filter(Boolean);
}

function buildCandidateFromSense(room, bot, controller, sense) {
  if (sense.type === "recent_art") return getRecentArtCandidate(sense, bot);
  if (sense.type === "human") return getHumanCandidate(sense, bot);
  if (sense.type === "top") return getTopCandidate(sense, controller);
  if (sense.type === "chat") return getChatCandidate(sense, bot);
  if (sense.type === "patrol") return getPatrolCandidate(controller, sense);
  return null;
}

function getRecentArtCandidate(sense, bot) {
  const target = offsetFrom(sense.point, bot, 135);
  return {
    ...target,
    key: "art:recent",
    label: "최근 그림",
    intent: "그림 관측",
    routeType: "art",
    baseScore: sense.interest,
    reason: sense.reason,
    sense
  };
}

function getHumanCandidate(sense, bot) {
  const target = offsetFrom(sense.point, bot, 210);
  return {
    ...target,
    key: "human:cluster",
    label: "사람 주변",
    intent: "플레이어 관측",
    routeType: "human",
    baseScore: sense.interest,
    reason: sense.reason,
    sense
  };
}

function getTopCandidate(sense, controller) {
  const screen = TOP_SCREENS[controller.step % TOP_SCREENS.length];
  return {
    ...screen,
    key: "top:screens",
    label: "상단 스크린",
    intent: "TOP 관측",
    routeType: "top",
    baseScore: sense.interest,
    reason: sense.reason,
    sense
  };
}

function getChatCandidate(sense, bot) {
  const target = offsetFrom(sense.point, bot, 230);
  return {
    ...target,
    key: sense.key,
    label: "대화 대상",
    intent: "대화 대상 접근",
    routeType: "chat",
    baseScore: sense.interest,
    reason: sense.reason,
    sense
  };
}

function getPatrolCandidate(controller, sense) {
  const point = leastRecentlyVisitedPatrol(controller);
  return {
    x: point.x,
    y: point.y,
    key: `patrol:${point.label}`,
    label: point.label,
    intent: "순찰",
    routeType: "patrol",
    baseScore: sense?.interest || 14,
    reason: sense?.reason || "신호 없는 공간 확인",
    sense
  };
}

function getDialogueCandidate(room, bot) {
  const dialogue = getAiDialogueSummary(room?.name);
  const latest = dialogue.latest;
  if (!latest || Date.now() - latest.createdAt > DIALOGUE_PRIORITY_MS) return null;
  if (!["observe_user_art", "ask_popular_art", "request_walk"].includes(latest.detectedIntent)) return null;

  if (latest.detectedIntent === "ask_popular_art") {
    return {
      ...TOP_SCREENS[0],
      key: "dialogue:top",
      label: "대화 요청 TOP",
      intent: "TOP 관측",
      routeType: "top",
      baseScore: latest.interestScore,
      reason: latest.memoryNote,
      sense: dialogueSense(latest)
    };
  }

  if (latest.detectedIntent === "observe_user_art") {
    const point = getRecentArtPoint(room) || { x: bot.x, y: bot.y };
    return {
      ...offsetFrom(point, bot, 135),
      key: "dialogue:user_art",
      label: "대화 요청 그림",
      intent: "유저 그림 관측",
      routeType: "art",
      baseScore: latest.interestScore,
      reason: latest.memoryNote,
      sense: dialogueSense(latest)
    };
  }

  const point = leastRecentlyVisitedPatrol({ visits: {} });
  return {
    x: point.x,
    y: point.y,
    key: "dialogue:walk",
    label: "대화 요청 순찰",
    intent: "순찰",
    routeType: "patrol",
    baseScore: latest.interestScore,
    reason: latest.memoryNote,
    sense: dialogueSense(latest)
  };
}

function getFallbackTarget(controller) {
  const point = PATROL_POINTS[controller.step % PATROL_POINTS.length];
  return {
    x: point.x,
    y: point.y,
    key: `patrol:${point.label}`,
    label: point.label,
    intent: "순찰",
    routeType: "patrol",
    baseScore: 10,
    reason: "기본 순찰"
  };
}

function scoreCandidate(candidate, bot, controller) {
  const now = Date.now();
  const lastVisit = controller.visits?.[candidate.key] || 0;
  const revisitPenalty = lastVisit ? Math.max(0, 42 - ((now - lastVisit) / REVISIT_WINDOW_MS) * 42) : 0;
  const recentPenalty = getRecentTargetPenalty(candidate, controller);
  const ageBonus = lastVisit ? Math.min(10, (now - lastVisit) / 6000) : 10;
  const memory = getMemoryScore(candidate, controller.memory, now);
  const distance = Math.hypot(candidate.x - bot.x, candidate.y - bot.y);
  const distancePenalty = Math.min(12, distance / 520);
  const score = Math.max(1, Math.round(
    candidate.baseScore + ageBonus + memory.bonus - memory.penalty - revisitPenalty - recentPenalty - distancePenalty
  ));
  return {
    ...candidate,
    score,
    distance: Math.round(distance),
    reason: [
      `${candidate.reason || candidate.intent} +${Math.round(candidate.baseScore)}`,
      memory.reason,
      ageBonus ? `시간 +${Math.round(ageBonus)}` : "",
      revisitPenalty ? `최근 방문 -${Math.round(revisitPenalty)}` : "",
      recentPenalty ? `반복 후보 -${Math.round(recentPenalty)}` : "",
      distancePenalty ? `거리 -${Math.round(distancePenalty)}` : "",
      `최종 ${score}점`
    ].filter(Boolean).join(" · ")
  };
}

function getPreferredCandidates(candidates, route, controller) {
  if (!route) return [];
  const routeType = route === "top" ? "top" : route === "patrol" ? "patrol" : route;
  const preferred = candidates.filter((candidate) => candidate.routeType === routeType);
  if (preferred.length) return preferred;
  if (routeType === "top") return [getForcedTopCandidate(controller)];
  return [];
}

function getForcedTopCandidate(controller) {
  const screen = TOP_SCREENS[controller.step % TOP_SCREENS.length];
  return {
    ...screen,
    key: "top:manual",
    label: "상단 스크린",
    intent: "TOP 관측",
    routeType: "top",
    baseScore: 44,
    reason: "관리자 TOP 경로 요청",
    sense: {
      label: "TOP 경로 명령",
      interest: 44,
      reason: "관리자 요청"
    }
  };
}

function serializeAttention(candidate) {
  return {
    label: candidate.sense?.label || candidate.label,
    score: candidate.score,
    intent: candidate.intent,
    reason: candidate.reason
  };
}

function mergeAttention(primary, secondary) {
  const seen = new Set();
  const merged = [];
  for (const candidate of [...primary, ...secondary]) {
    const key = candidate.key || candidate.label;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(candidate);
  }
  return merged;
}

function getMemoryScore(candidate, memory, now) {
  const targets = Array.isArray(memory?.targets) ? memory.targets : [];
  const recent = Array.isArray(memory?.recent) ? memory.recent : [];
  const count = targets.find((entry) => entry.target === candidate.label)?.count || 0;
  const last = recent.find((entry) => entry.target === candidate.label);
  if (!count) return { bonus: 8, penalty: 0, reason: "오늘 미관측 +8" };

  const lastAt = Number(last?.at) || now;
  const staleBonus = Math.min(12, Math.max(0, (now - lastAt) / (10 * 60 * 1000) * 12));
  const repeatPenalty = Math.min(34, count * 7);
  const staleReason = staleBonus >= 1 ? ` · 오래 안봄 +${Math.round(staleBonus)}` : "";
  return {
    bonus: staleBonus,
    penalty: repeatPenalty,
    reason: `오늘 ${count}회 기억 -${Math.round(repeatPenalty)}${staleReason}`
  };
}

function getRecentTargetPenalty(candidate, controller) {
  const index = (controller.recentTargets || []).indexOf(candidate.key);
  return index >= 0 ? RECENT_TARGET_PENALTIES[index] || 0 : 0;
}

function leastRecentlyVisitedPatrol(controller) {
  return PATROL_POINTS
    .map((point) => ({ ...point, last: controller.visits?.[`patrol:${point.label}`] || 0 }))
    .sort((a, b) => a.last - b.last || a.label.localeCompare(b.label, "ko"))[0];
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

function dialogueSense(event) {
  return {
    label: "대화 데이터",
    type: "chat",
    interest: event.interestScore,
    reason: event.memoryNote
  };
}

function getRecentArtPoint(room) {
  const strokes = Array.isArray(room?.strokes) ? room.strokes.slice(-14) : [];
  const points = strokes.flatMap((stroke) => stroke.points || []).slice(-220);
  if (!points.length) return null;
  return averagePoints(points);
}

function averagePoints(points) {
  const safe = points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (!safe.length) return null;
  const sum = safe.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / safe.length, y: sum.y / safe.length };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { chooseScoredTarget };
