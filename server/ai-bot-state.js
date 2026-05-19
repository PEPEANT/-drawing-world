const AI_STATE_VERSION = 1;
const MAX_DEBUG_EVENTS = 30;
const VALID_MODES = new Set([
  "created",
  "walking",
  "quiet_patrol",
  "observing",
  "stopped",
  "sleeping",
  "waking",
  "drawing",
  "talking",
  "idle"
]);
const VALID_LIFECYCLES = new Set(["active", "quiet_patrol", "sleeping", "waking", "removed"]);

const eventLogByRoom = new Map();

function normalizeAiState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    schemaVersion: AI_STATE_VERSION,
    mode: normalizeMode(source.mode),
    lifecycle: normalizeLifecycle(source.lifecycle || source.mode),
    intent: safeText(source.intent, 48, "대기"),
    target: safeText(source.target, 64, ""),
    score: safeNumber(source.score, 0),
    reason: safeText(source.reason, 160, ""),
    speech: safeText(source.speech, 180, ""),
    memory: normalizeMemory(source.memory),
    dialogue: normalizeDialogue(source.dialogue),
    interaction: normalizeInteraction(source.interaction),
    route: normalizeRoute(source.route),
    draw: normalizeDraw(source.draw),
    senses: normalizeSenses(source.senses),
    attention: normalizeAttention(source.attention),
    proactiveAt: safeTimestamp(source.proactiveAt),
    lastSpeechAt: safeTimestamp(source.lastSpeechAt)
  };
}

function setAiState(bot, patch = {}, roomName = "", event = null) {
  if (!bot) return null;
  bot.isBot = true;
  bot.name = bot.name || "AI봇";
  bot.botType = bot.botType || "observer-v2";
  const nextState = { ...(bot.ai || {}), ...(patch || {}) };
  if (Object.prototype.hasOwnProperty.call(patch || {}, "speech") && safeText(patch.speech, 180, "")) {
    nextState.lastSpeechAt = patch.lastSpeechAt || Date.now();
  }
  bot.ai = normalizeAiState(nextState);
  bot.updatedAt = Date.now();
  if (event && roomName) recordAiEvent(roomName, event.type, event.detail);
  return bot.ai;
}

function ensureAiBotState(bot, roomName = "") {
  if (!bot) return null;
  setAiState(bot, bot.ai || {}, roomName);
  return bot;
}

function recordAiEvent(roomName, type, detail = "") {
  const room = safeRoom(roomName);
  if (!room || !type) return null;
  const events = eventLogByRoom.get(room) || [];
  const event = {
    at: Date.now(),
    type: safeText(type, 40, "event"),
    label: getEventLabel(type),
    detail: safeText(detail, 120, "")
  };
  events.unshift(event);
  if (events.length > MAX_DEBUG_EVENTS) events.length = MAX_DEBUG_EVENTS;
  eventLogByRoom.set(room, events);
  return event;
}

function getAiDebugEvents(roomName) {
  return (eventLogByRoom.get(safeRoom(roomName)) || []).map((event) => ({ ...event }));
}

function buildAiDebugSnapshot(room, bot, context = {}) {
  const roomName = room?.name || context?.room || "lobby";
  const ai = bot ? normalizeAiState(bot.ai) : normalizeAiState();
  const route = ai.route;
  return {
    schemaVersion: AI_STATE_VERSION,
    at: Date.now(),
    room: roomName,
    bot: bot ? {
      id: bot.id,
      name: bot.name || "AI봇",
      isBot: bot.isBot === true,
      botType: bot.botType || "",
      moving: Boolean(bot.moving),
      x: Math.round(Number(bot.x) || 0),
      y: Math.round(Number(bot.y) || 0)
    } : null,
    state: {
      mode: ai.mode,
      lifecycle: ai.lifecycle,
      intent: ai.intent,
      target: ai.target,
      score: ai.score,
      reason: ai.reason,
      speech: ai.speech
    },
    route: route ? {
      name: route.name || "",
      purpose: route.purpose || "",
      reason: route.reason || "",
      current: route.current || "",
      waypointIndex: safeNumber(route.waypointIndex, 0),
      waypointTotal: safeNumber(route.waypointTotal, 0),
      next: route.next || null
    } : null,
    perception: {
      senses: ai.senses,
      attention: ai.attention
    },
    memory: ai.memory,
    conversationData: ai.dialogue,
    interaction: ai.interaction,
    draw: ai.draw,
    invariants: buildInvariants(room, bot),
    events: getAiDebugEvents(roomName).slice(0, 12)
  };
}

function buildInvariants(room, bot) {
  const humans = room ? Array.from(room.players.values()).filter((player) => !player.isBot) : [];
  return [
    { key: "isBot", label: "AI봇은 isBot=true", ok: !bot || bot.isBot === true },
    { key: "rankExcluded", label: "랭킹/투표 제외 대상", ok: !bot || bot.isBot === true },
    { key: "humanCount", label: "방 인원은 사람만 계산", ok: !room || humans.length <= room.players.size },
    { key: "routeWhenMoving", label: "이동 중이면 목표나 경로 보유", ok: !bot || !bot.moving || Boolean(bot.ai?.target || bot.ai?.route) }
  ];
}

function normalizeMode(value) {
  return VALID_MODES.has(value) ? value : "idle";
}

function normalizeLifecycle(value) {
  return VALID_LIFECYCLES.has(value) ? value : "active";
}

function normalizeMemory(memory) {
  if (!isPlainObject(memory)) return { day: "", total: 0, recent: [], targets: [] };
  return {
    day: safeText(memory.day, 16, ""),
    total: safeNumber(memory.total, 0),
    recent: Array.isArray(memory.recent) ? memory.recent.slice(0, 5).map(normalizeMemoryEntry) : [],
    targets: Array.isArray(memory.targets) ? memory.targets.slice(0, 5).map(normalizeTargetEntry) : []
  };
}

function normalizeDialogue(dialogue) {
  if (!isPlainObject(dialogue)) {
    return { total: 0, latest: null, latestIsFresh: false, topIntents: [], recent: [] };
  }
  return {
    total: safeNumber(dialogue.total, 0),
    latest: normalizeDialogueEvent(dialogue.latest),
    latestIsFresh: dialogue.latestIsFresh === true,
    topIntents: Array.isArray(dialogue.topIntents) ? dialogue.topIntents.slice(0, 3).map(normalizeIntentCount) : [],
    recent: Array.isArray(dialogue.recent) ? dialogue.recent.slice(0, 5).map(normalizeDialogueEvent).filter(Boolean) : []
  };
}

function normalizeDialogueEvent(event) {
  if (!isPlainObject(event)) return null;
  return {
    id: safeText(event.id, 64, ""),
    at: safeTimestamp(event.at),
    rawText: safeText(event.rawText, 80, ""),
    displayedText: safeText(event.displayedText, 120, ""),
    speakerType: safeText(event.speakerType, 16, "admin"),
    actor: safeText(event.actor, 16, "admin"),
    source: safeText(event.source, 16, "input"),
    targetMode: safeText(event.targetMode, 24, "world"),
    targetUserId: safeText(event.targetUserId, 48, ""),
    targetArtworkId: safeText(event.targetArtworkId, 48, ""),
    targetPoint: normalizePoint(event.targetPoint),
    targetMeta: normalizeTargetMeta(event.targetMeta),
    detectedIntent: safeText(event.detectedIntent, 32, "unknown"),
    interestScore: safeNumber(event.interestScore, 0),
    memoryNote: safeText(event.memoryNote, 120, ""),
    nextAction: safeText(event.nextAction, 40, ""),
    result: safeText(event.result, 20, "queued"),
    createdAt: safeTimestamp(event.createdAt)
  };
}

function normalizeTargetMeta(meta) {
  if (!isPlainObject(meta)) return null;
  return {
    strokeCount: safeNumber(meta.strokeCount, 0),
    pointCount: safeNumber(meta.pointCount, 0),
    latestStrokeId: safeText(meta.latestStrokeId, 80, "")
  };
}

function normalizeInteraction(interaction) {
  if (!isPlainObject(interaction)) {
    return { locked: false, active: null, queueCount: 0, queue: [] };
  }
  const active = isPlainObject(interaction.active) ? {
    userId: safeText(interaction.active.userId, 80, ""),
    userName: safeText(interaction.active.userName, 24, ""),
    intent: safeText(interaction.active.intent, 40, ""),
    startedAt: safeTimestamp(interaction.active.startedAt),
    expiresAt: safeTimestamp(interaction.active.expiresAt)
  } : null;
  const queue = Array.isArray(interaction.queue) ? interaction.queue.slice(0, 5).map((entry) => ({
    userId: safeText(entry?.userId, 80, ""),
    userName: safeText(entry?.userName, 24, ""),
    intent: safeText(entry?.intent, 40, ""),
    createdAt: safeTimestamp(entry?.createdAt)
  })) : [];
  return {
    locked: Boolean(interaction.locked && active),
    active,
    queueCount: safeNumber(interaction.queueCount ?? queue.length, 0),
    queue
  };
}

function normalizeIntentCount(entry) {
  return {
    intent: safeText(entry?.intent, 32, "unknown"),
    count: safeNumber(entry?.count, 0)
  };
}

function normalizeRoute(route) {
  if (!isPlainObject(route) || !route.name) return null;
  return {
    name: safeText(route.name, 64, ""),
    purpose: safeText(route.purpose, 64, ""),
    reason: safeText(route.reason, 160, ""),
    current: safeText(route.current, 64, ""),
    waypointIndex: safeNumber(route.waypointIndex, 0),
    waypointTotal: safeNumber(route.waypointTotal, 0),
    next: normalizePoint(route.next)
  };
}

function normalizeDraw(draw) {
  if (!isPlainObject(draw)) {
    return { status: "idle", progress: 0, strokeIndex: 0, strokeTotal: 0, pointIndex: 0, pointTotal: 0, artworkId: "", shape: "", prompt: "" };
  }
  return {
    status: safeText(draw.status, 20, "idle"),
    progress: safeNumber(draw.progress, 0),
    strokeIndex: safeNumber(draw.strokeIndex, 0),
    strokeTotal: safeNumber(draw.strokeTotal, 0),
    pointIndex: safeNumber(draw.pointIndex, 0),
    pointTotal: safeNumber(draw.pointTotal, 0),
    artworkId: safeText(draw.artworkId, 80, ""),
    shape: safeText(draw.shape, 20, ""),
    prompt: safeText(draw.prompt, 80, "")
  };
}

function normalizeSenses(senses) {
  return (Array.isArray(senses) ? senses : []).slice(0, 5).map((sense) => ({
    label: safeText(sense?.label, 64, "감각"),
    type: safeText(sense?.type, 32, "sense"),
    interest: safeNumber(sense?.interest, 0),
    reason: safeText(sense?.reason, 120, "")
  }));
}

function normalizeAttention(attention) {
  return (Array.isArray(attention) ? attention : []).slice(0, 3).map((entry) => ({
    label: safeText(entry?.label, 64, "관심"),
    score: safeNumber(entry?.score, 0),
    intent: safeText(entry?.intent, 48, ""),
    reason: safeText(entry?.reason, 120, "")
  }));
}

function normalizeMemoryEntry(entry) {
  return {
    at: safeTimestamp(entry?.at),
    target: safeText(entry?.target, 64, "관측 지점"),
    intent: safeText(entry?.intent, 48, ""),
    score: safeNumber(entry?.score, 0),
    reason: safeText(entry?.reason, 120, ""),
    x: safeNumber(entry?.x, 0),
    y: safeNumber(entry?.y, 0)
  };
}

function normalizeTargetEntry(entry) {
  return {
    target: safeText(entry?.target, 64, "관측 지점"),
    count: safeNumber(entry?.count, 0)
  };
}

function normalizePoint(point) {
  if (!isPlainObject(point)) return null;
  return { x: Math.round(Number(point.x) || 0), y: Math.round(Number(point.y) || 0) };
}

function getEventLabel(type) {
  return {
    create: "생성",
    duplicate: "중복 생성 차단",
    walk_start: "이동 시작",
    route_start: "경로 시작",
    target_select: "목표 선택",
    observe: "관찰 완료",
    stop: "정지",
    remove: "퇴장",
    talk_receive: "대화 수신",
    speech: "말풍선 출력",
    proactive: "선제 대화",
    draw: "AI 그림 생성",
    draw_start: "AI 그림 시작",
    draw_done: "AI 그림 완료",
    draw_cancel: "AI 그림 취소",
    normalize: "상태 자동 보정"
  }[type] || type;
}

function safeText(value, limit, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : fallback;
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function safeTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function safeRoom(value) {
  return typeof value === "string" ? value.replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 32) : "";
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

module.exports = {
  AI_STATE_VERSION,
  buildAiDebugSnapshot,
  ensureAiBotState,
  getAiDebugEvents,
  normalizeAiState,
  recordAiEvent,
  setAiState
};
