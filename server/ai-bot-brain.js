const { getAiBot } = require("./ai-bot");
const { chooseScoredTarget } = require("./ai-bot-targets");
const { advanceRoute, buildRoute, getCurrentWaypoint, serializeRoute } = require("./ai-bot-routes");
const { buildObservationSpeech, publishAiBotSpeech } = require("./ai-bot-dialogue");
const { getAiMemorySummary, recordAiObservation } = require("./ai-bot-memory");
const { recordAiEvent, setAiState } = require("./ai-bot-state");
const { broadcast } = require("./protocol");
const { countHumanPlayers, rooms } = require("./rooms");

const WORLD = { width: 3200, height: 2200 };
const BASE_TICK_MS = 100;
const ACTIVE_PROFILE = { tickMs: 100, broadcastMs: 160, speed: 78, observeMs: 2200, canSpeak: true };
const QUIET_PROFILE = { tickMs: 700, broadcastMs: 1200, speed: 34, observeMs: 5200, canSpeak: false };
const STOP_DISTANCE = 18;
const SPEECH_COOLDOWN_MS = 9000;
const SLEEP_AFTER_MS = 5 * 60 * 1000;
const MANUAL_ROUTE_ACTIVE_MS = 45 * 1000;
const WAKE_DELAY_MS = 2600;
const controllers = new Map();
const wakeTimers = new Map();

const QUIET_PATROL_POINTS = [
  { key: "quiet-northwest", label: "북서 순찰", x: 720, y: 520 },
  { key: "quiet-north", label: "북쪽 순찰", x: 1600, y: 470 },
  { key: "quiet-northeast", label: "북동 순찰", x: 2500, y: 560 },
  { key: "quiet-east", label: "동쪽 순찰", x: 2760, y: 1150 },
  { key: "quiet-south", label: "남쪽 순찰", x: 1700, y: 1710 },
  { key: "quiet-west", label: "서쪽 순찰", x: 620, y: 1280 }
];

function startAiBotWalk(room, bot, options = {}) {
  if (!room || !bot) return { bot: null, walking: false };
  const previous = controllers.get(room.name);
  if (previous) clearControllerTimers(previous);
  clearWakeTimer(room.name);

  const resetRoute = Boolean(options.route || options.target);
  const now = Date.now();
  const controller = {
    step: previous?.step || 0,
    target: resetRoute ? null : previous?.target || null,
    destination: resetRoute ? null : previous?.destination || null,
    route: resetRoute ? null : previous?.route || null,
    pauseUntil: 0,
    visits: previous?.visits || {},
    recentTargets: previous?.recentTargets || [],
    memory: getAiMemorySummary(room.name),
    senses: previous?.senses || [],
    attention: previous?.attention || [],
    lastSpeechAt: previous?.lastSpeechAt || 0,
    lastBroadcastAt: previous?.lastBroadcastAt || 0,
    lastTickAt: 0,
    emptySince: previous?.emptySince || (countHumanPlayers(room) > 0 ? 0 : now),
    preferredRoute: options.route || previous?.preferredRoute || "",
    manualTarget: normalizeManualTarget(options.target),
    lifecycle: previous?.lifecycle || normalizeLifecycle(bot.ai?.lifecycle),
    quietStep: previous?.quietStep || 0,
    forceActiveUntil: (options.route || options.target) ? now + MANUAL_ROUTE_ACTIVE_MS : 0
  };

  controller.timer = setInterval(() => tick(room, bot, controller), BASE_TICK_MS);
  controller.timer.unref?.();
  controllers.set(room.name, controller);
  syncLifecycle(room, bot, controller, now);
  if (!controller.target) assignTarget(room, bot, controller, options);
  recordAiEvent(room.name, options.route ? "route_start" : "walk_start", options.route || "자동 순찰");
  tick(room, bot, controller);
  return { bot, walking: true };
}

function stopAiBotWalk(room, bot, options = {}) {
  if (room) clearWakeTimer(room.name);
  const controller = room ? controllers.get(room.name) : null;
  if (controller) {
    clearControllerTimers(controller);
    controllers.delete(room.name);
  }
  if (!bot) return { bot: null, walking: false };
  bot.moving = false;
  setAiState(bot, {
    mode: "stopped",
    lifecycle: "active",
    intent: "정지",
    target: "",
    memory: getAiMemorySummary(room?.name),
    speech: "멈췄어.",
    route: null
  }, room?.name, options.silent ? null : { type: "stop", detail: "AI 이동 정지" });
  if (room?.players.has(bot.id)) {
    broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  }
  return { bot, walking: false };
}

function wakeAiBotIfSleeping(room, reason = "user_entered") {
  if (!room) return { bot: null, waking: false };
  const bot = getAiBot(room.name);
  if (!bot || (bot.ai?.mode !== "sleeping" && bot.ai?.lifecycle !== "sleeping")) {
    return { bot, waking: false };
  }
  if (wakeTimers.has(room.name)) return { bot, waking: true };

  bot.moving = false;
  setAiState(bot, {
    mode: "waking",
    lifecycle: "waking",
    intent: "기상",
    target: "",
    memory: getAiMemorySummary(room.name),
    speech: "잠에서 깨는 중.",
    route: null
  }, room.name, { type: "wake", detail: reason === "admin" ? "관리자 요청으로 기상" : "유저 입장으로 기상" });
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);

  const timer = setTimeout(() => {
    wakeTimers.delete(room.name);
    const currentRoom = rooms.get(room.name);
    const currentBot = currentRoom ? getAiBot(currentRoom.name) : null;
    if (!currentRoom || !currentBot || !currentRoom.players.has(currentBot.id)) return;
    if (countHumanPlayers(currentRoom) <= 0 && reason !== "admin") return enterSleep(currentRoom, currentBot, null, Date.now());
    startAiBotWalk(currentRoom, currentBot);
  }, WAKE_DELAY_MS);
  timer.unref?.();
  wakeTimers.set(room.name, timer);
  return { bot, waking: true };
}

function tick(room, bot, controller) {
  const now = Date.now();
  if (rooms.get(room.name) !== room) return stopAiBotWalk(room, bot);
  if (!room.players.has(bot.id)) return stopAiBotWalk(room, bot);
  if (syncLifecycle(room, bot, controller, now)) return;

  const profile = getMotionProfile(controller);
  if (now - (controller.lastTickAt || 0) < profile.tickMs) return;
  controller.lastTickAt = now;

  if (controller.pauseUntil > now) return;
  if (!controller.target) assignTarget(room, bot, controller);

  const dx = controller.target.x - bot.x;
  const dy = controller.target.y - bot.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= STOP_DISTANCE) {
    handleArrival(room, bot, controller, now, profile);
    return;
  }

  const step = Math.min(distance, profile.speed * (profile.tickMs / 1000));
  bot.x = clamp(bot.x + (dx / distance) * step, 0, WORLD.width);
  bot.y = clamp(bot.y + (dy / distance) * step, 0, WORLD.height);
  bot.facing = dx < -1 ? -1 : 1;
  bot.moving = true;
  setAiState(bot, buildAiState(getMovementMode(controller), controller.destination || controller.target, controller.memory, controller), room.name);
  broadcastBotUpdate(room, bot, controller, now);
}

function handleArrival(room, bot, controller, now, profile) {
  if (!isQuiet(controller) && advanceRoute(controller.route)) {
    controller.target = getCurrentWaypoint(controller.route);
    setAiState(bot, buildAiState("walking", controller.destination || controller.target, controller.memory, controller), room.name);
    broadcastBotUpdate(room, bot, controller, now, true);
    return;
  }

  const observedTarget = controller.destination || controller.target;
  bot.x = controller.target.x;
  bot.y = controller.target.y;
  bot.moving = false;

  if (isQuiet(controller)) {
    const quietTarget = {
      ...observedTarget,
      intent: "저전력 순찰",
      score: 10,
      reason: "사람이 없어 조용히 맵 동선만 확인"
    };
    setAiState(bot, {
      ...buildAiState("quiet_patrol", quietTarget, controller.memory, controller),
      speech: ""
    }, room.name, { type: "quiet_patrol", detail: quietTarget.label || "맵 순찰" });
    controller.target = null;
    controller.destination = null;
    controller.route = null;
    controller.pauseUntil = now + profile.observeMs;
    broadcastBotUpdate(room, bot, controller, now, true);
    return;
  }

  controller.memory = recordAiObservation(room.name, bot, observedTarget, now);
  const canSpeakNow = profile.canSpeak && now - controller.lastSpeechAt >= SPEECH_COOLDOWN_MS;
  const speech = canSpeakNow ? buildObservationSpeech(observedTarget, controller.memory) : "";
  setAiState(bot, { ...buildAiState("observing", observedTarget, controller.memory, controller), speech }, room.name, {
    type: "observe",
    detail: observedTarget.label || "관측 지점"
  });
  if (canSpeakNow) {
    publishAiBotSpeech(room, bot, speech);
    controller.lastSpeechAt = now;
    setAiState(bot, { lastSpeechAt: now }, room.name);
  }
  controller.target = null;
  controller.destination = null;
  controller.route = null;
  controller.pauseUntil = now + profile.observeMs;
  broadcastBotUpdate(room, bot, controller, now, true);
}

function assignTarget(room, bot, controller, options = {}) {
  controller.step += 1;
  const target = !isQuiet(controller) && (options.target || controller.manualTarget)
    ? buildManualTarget(bot, controller, options.target || controller.manualTarget)
    : isQuiet(controller)
    ? chooseQuietPatrolTarget(controller)
    : chooseScoredTarget(room, bot, controller, options);
  controller.manualTarget = null;
  controller.destination = target;
  controller.route = target.route || null;
  controller.target = getCurrentWaypoint(controller.route) || target;
  controller.preferredRoute = "";
  recordAiEvent(room.name, "target_select", `${target.label} · ${target.reason || target.intent || ""}`);
}

function buildManualTarget(bot, controller, target) {
  const manual = normalizeManualTarget(target) || { x: bot.x, y: bot.y };
  const routeTarget = {
    key: manual.key || "user_click",
    label: manual.label || "유저 요청 지점",
    x: manual.x,
    y: manual.y,
    intent: manual.intent || "유저 요청 관찰",
    score: manual.score || 90,
    reason: manual.reason || "유저가 AI봇을 호출함",
    routeType: manual.routeType || "chat"
  };
  return {
    ...routeTarget,
    route: buildRoute(bot, routeTarget, controller)
  };
}

function normalizeManualTarget(target) {
  if (!target || typeof target !== "object") return null;
  const x = Number(target.x);
  const y = Number(target.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    key: typeof target.key === "string" ? target.key.slice(0, 40) : "",
    label: typeof target.label === "string" ? target.label.slice(0, 64) : "",
    x: clamp(x, 0, WORLD.width),
    y: clamp(y, 0, WORLD.height),
    intent: typeof target.intent === "string" ? target.intent.slice(0, 48) : "",
    score: Math.max(0, Math.min(100, Math.round(Number(target.score) || 0))),
    reason: typeof target.reason === "string" ? target.reason.slice(0, 120) : "",
    routeType: typeof target.routeType === "string" ? target.routeType.slice(0, 24) : ""
  };
}

function chooseQuietPatrolTarget(controller) {
  const point = QUIET_PATROL_POINTS[controller.quietStep % QUIET_PATROL_POINTS.length];
  controller.quietStep += 1;
  controller.senses = [{ label: "사람 없음", type: "room_empty", interest: 10, reason: "저전력 순찰" }];
  controller.attention = [{ label: "맵 커버리지", score: 10, intent: "quiet_patrol", reason: "방해 없이 전체 동선을 천천히 확인" }];
  return {
    ...point,
    intent: "저전력 순찰",
    score: 10,
    reason: "사람이 없어 그림 관측 대신 맵 순찰"
  };
}

function buildAiState(mode, target = {}, memory, controller = {}) {
  return {
    mode,
    lifecycle: controller.lifecycle || "active",
    intent: target.intent || "대기",
    target: target.label || "",
    score: target.score || 0,
    reason: target.reason || "",
    speech: "",
    memory,
    route: serializeRoute(controller.route),
    senses: serializeSenses(controller.senses),
    attention: serializeAttention(controller.attention)
  };
}

function syncLifecycle(room, bot, controller, now) {
  const humans = countHumanPlayers(room);
  if (humans > 0) {
    controller.emptySince = 0;
    setControllerLifecycle(room, bot, controller, "active");
    return false;
  }

  controller.emptySince ||= now;
  if (now - controller.emptySince >= SLEEP_AFTER_MS) {
    enterSleep(room, bot, controller, now);
    return true;
  }

  const nextLifecycle = now < (controller.forceActiveUntil || 0) ? "active" : "quiet_patrol";
  setControllerLifecycle(room, bot, controller, nextLifecycle);
  return false;
}

function setControllerLifecycle(room, bot, controller, lifecycle) {
  if (controller.lifecycle === lifecycle) return;
  controller.lifecycle = lifecycle;
  if (lifecycle === "quiet_patrol") {
    controller.target = null;
    controller.destination = null;
    controller.route = null;
    recordAiEvent(room.name, "quiet_patrol", "사람 없는 방에서 저전력 순찰로 전환");
  }
  if (lifecycle === "active") {
    recordAiEvent(room.name, "wake", "사람이 있어 일반 관측으로 전환");
  }
  setAiState(bot, {
    mode: lifecycle === "quiet_patrol" ? "quiet_patrol" : bot.ai?.mode,
    lifecycle,
    memory: getAiMemorySummary(room.name)
  }, room.name);
}

function enterSleep(room, bot, controller, now) {
  if (controller) {
    clearControllerTimers(controller);
    controllers.delete(room.name);
  }
  bot.moving = false;
  setAiState(bot, {
    mode: "sleeping",
    lifecycle: "sleeping",
    intent: "수면",
    target: "",
    score: 0,
    reason: "사람이 없어 이동 루프를 멈춤",
    memory: getAiMemorySummary(room.name),
    speech: "잠깐 잘게.",
    lastSpeechAt: Date.now(),
    route: null,
    senses: [{ label: "방 비어 있음", type: "room_empty", interest: 0, reason: "수면" }],
    attention: [{ label: "저전력 수면", score: 0, intent: "sleep", reason: "유저 입장 때 다시 기상" }]
  }, room.name, { type: "sleep", detail: "사람 없는 방에서 수면" });
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  return { bot, sleeping: true, at: now };
}

function getMotionProfile(controller) {
  return isQuiet(controller) ? QUIET_PROFILE : ACTIVE_PROFILE;
}

function getMovementMode(controller) {
  return isQuiet(controller) ? "quiet_patrol" : "walking";
}

function isQuiet(controller) {
  return controller.lifecycle === "quiet_patrol";
}

function normalizeLifecycle(value) {
  return value === "quiet_patrol" || value === "sleeping" || value === "waking" ? value : "active";
}

function clearControllerTimers(controller) {
  if (controller?.timer) clearInterval(controller.timer);
  if (controller?.wakeTimer) clearTimeout(controller.wakeTimer);
}

function clearWakeTimer(roomName) {
  const timer = wakeTimers.get(roomName);
  if (!timer) return;
  clearTimeout(timer);
  wakeTimers.delete(roomName);
}

function serializeSenses(senses) {
  return (Array.isArray(senses) ? senses : []).slice(0, 5).map((sense) => ({
    label: sense.label,
    type: sense.type,
    interest: Math.round(Number(sense.interest) || 0),
    reason: sense.reason
  }));
}

function serializeAttention(attention) {
  return (Array.isArray(attention) ? attention : []).slice(0, 3).map((entry) => ({
    label: entry.label,
    score: Math.round(Number(entry.score) || 0),
    intent: entry.intent,
    reason: entry.reason
  }));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function broadcastBotUpdate(room, bot, controller, now, force = false) {
  const profile = getMotionProfile(controller);
  if (!force && now - (controller.lastBroadcastAt || 0) < profile.broadcastMs) return;
  controller.lastBroadcastAt = now;
  broadcast(room, { type: "playerMove", player: buildMovePayload(bot) }, undefined);
}

function buildMovePayload(bot) {
  return {
    id: bot.id,
    x: bot.x,
    y: bot.y,
    facing: bot.facing,
    moving: bot.moving,
    isBot: true,
    ai: bot.ai ? { mode: bot.ai.mode, lifecycle: bot.ai.lifecycle } : undefined
  };
}

module.exports = { startAiBotWalk, stopAiBotWalk, wakeAiBotIfSleeping };
