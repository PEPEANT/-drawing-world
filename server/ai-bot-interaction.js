const { buildArtCoachResponse, findRecentUserArtTarget } = require("./ai-bot-art-target");
const { getAiDialogueSummary, recordDialogueEvent } = require("./ai-bot-conversation");
const { getAiDrawingSession } = require("./ai-bot-draw-session");
const { publishAiBotSpeech } = require("./ai-bot-dialogue");
const { checkAiInteractionCooldown, markAiInteractionCooldown } = require("./ai-bot-interaction-cooldown");
const { prepareDrawRequest, runDrawInteraction } = require("./ai-bot-interaction-draw");
const { startAiBotWalk } = require("./ai-bot-brain");
const { INTENTS, getIntentLabel, intentScore, isAdviceIntent, safeIntent } = require("./ai-bot-interaction-intents");
const { recordAiEvent, setAiState } = require("./ai-bot-state");
const { broadcast, send } = require("./protocol");
const { safeText } = require("./validation");

const LOCK_MS = 25 * 1000;
const USER_ART_COOLDOWN_MS = 30 * 1000;
const MAX_QUEUE = 5;
const roomTimers = new Map();
const userArtCooldowns = new Map();

function handleAiBotInteraction(ws, room, message) {
  if (!room || !ws || ws.isSpectator) return false;
  const bot = findAiBot(room, message.botId);
  if (!bot) {
    send(ws, { type: "aiBotInteractResult", ok: false, result: "failed", message: "AI봇이 아직 없어." });
    return true;
  }
  if (bot.ai?.mode === "drawing" || getAiDrawingSession(room.name)?.botId === bot.id) {
    send(ws, { type: "aiBotInteractResult", ok: false, result: "busy", message: "AI봇이 지금 그림 그리고 있어." }); return true;
  }

  const user = room.players.get(ws.id);
  if (!user || user.isBot) return true;
  const request = buildRequest(ws, user, message);
  prepareRequest(room, request);
  const cooldown = checkAiInteractionCooldown(room.name, request);
  if (!cooldown.ok) {
    recordAiEvent(room.name, "cooldown", cooldown.message);
    send(ws, { type: "aiBotInteractResult", ok: false, result: "cooldown", message: cooldown.message });
    return true;
  }
  markAiInteractionCooldown(room.name, request);
  const state = getInteraction(room);
  pruneExpiredLock(room, bot, state);

  if (!state.lock || state.lock.userId === request.userId) {
    speakInteraction(room, bot, request, ws);
    return true;
  }

  queueInteraction(room, bot, state, request, ws);
  return true;
}

function releaseAiBotUser(room, userRef = {}) {
  if (!room) return;
  const bot = findAiBot(room);
  const state = getInteraction(room);
  const userId = userRef.clientId || userRef.playerId || "";
  const playerId = userRef.playerId || "";
  state.queue = state.queue.filter((entry) => entry.userId !== userId && entry.playerId !== playerId);
  if (state.lock && (state.lock.userId === userId || state.lock.playerId === playerId)) {
    state.lock = null;
    if (bot) processNextQueued(room, bot, state, "user_left");
  } else if (bot) {
    syncInteractionState(room, bot, state);
  }
}

function speakInteraction(room, bot, request, ws = null, result = "spoken") {
  const state = getInteraction(room);
  state.lock = {
    userId: request.userId,
    playerId: request.playerId,
    userName: request.userName,
    intent: request.intent,
    startedAt: Date.now(),
    expiresAt: Date.now() + LOCK_MS
  };
  scheduleLockExpiry(room, bot);

  const event = recordDialogueEvent(room.name, request.text, {
    speakerType: "user",
    actor: "user",
    source: "user_click",
    targetMode: request.targetMode,
    targetUserId: request.userId,
    targetArtworkId: request.targetArtworkId,
    targetPoint: request.targetPoint,
    targetMeta: request.targetMeta,
    result
  });
  if (event) {
    event.displayedText = request.reply;
    event.nextAction = request.nextAction || event.nextAction;
    event.interestScore = request.score || event.interestScore;
    if (request.memoryNote) event.memoryNote = request.memoryNote;
    event.result = result;
  }

  recordAiEvent(room.name, "talk_receive", event?.memoryNote || request.text);
  if (request.drawRequest) {
    runDrawInteraction(room, bot, request, ws, serializeInteraction(state), LOCK_MS, event);
    return;
  }
  maybeMoveForRequest(room, bot, request, event);
  publishAiBotSpeech(room, bot, request.reply);
  setAiState(bot, {
    mode: "talking",
    lifecycle: bot.ai?.lifecycle || "active",
    intent: getIntentLabel(request.intent),
    target: getTargetLabel(request),
    score: event?.interestScore || request.score || 0,
    reason: event?.memoryNote || "유저가 AI봇을 클릭해 요청함",
    speech: request.reply,
    lastSpeechAt: Date.now(),
    dialogue: getAiDialogueSummary(room.name),
    interaction: serializeInteraction(state)
  }, room.name);
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  if (ws) {
    send(ws, {
      type: "aiBotInteractResult",
      ok: true,
      result,
      message: `AI봇: ${request.reply}`,
      lockMs: LOCK_MS
    });
  }
}

function queueInteraction(room, bot, state, request, ws) {
  const existingIndex = state.queue.findIndex((entry) => entry.userId === request.userId && entry.intent === request.intent);
  if (existingIndex >= 0) {
    send(ws, {
      type: "aiBotInteractResult",
      ok: true,
      result: "queued",
      message: `이미 대기 중이야. ${existingIndex + 1}번째야.`,
      queuePosition: existingIndex + 1
    });
    return;
  }

  if (state.queue.length >= MAX_QUEUE) {
    recordQueueEvent(room, request, "failed");
    syncInteractionState(room, bot, state);
    send(ws, {
      type: "aiBotInteractResult",
      ok: false,
      result: "failed",
      message: "AI봇 대기열이 꽉 찼어."
    });
    return;
  }

  state.queue.push(request);
  recordQueueEvent(room, request, "queued");
  syncInteractionState(room, bot, state);
  const position = state.queue.length;
  send(ws, {
    type: "aiBotInteractResult",
    ok: true,
    result: "queued",
    message: `지금 다른 사람과 대화 중이야. ${position}번째로 넣었어.`,
    queuePosition: position
  });
}

function processNextQueued(room, bot, state, reason) {
  pruneExpiredLock(room, bot, state, false);
  if (state.lock) return;
  const next = state.queue.shift();
  if (!next) {
    syncInteractionState(room, bot, state);
    return;
  }
  recordAiEvent(room.name, "queue_next", reason || "interaction_queue");
  const targetClient = findClientByUser(room, next);
  speakInteraction(room, bot, next, targetClient, "spoken");
}

function recordQueueEvent(room, request, result) {
  const event = recordDialogueEvent(room.name, request.text, {
    speakerType: "user",
    actor: "user",
    source: "user_click",
    targetMode: request.targetMode,
    targetUserId: request.userId,
    targetArtworkId: request.targetArtworkId,
    targetPoint: request.targetPoint,
    targetMeta: request.targetMeta,
    result
  });
  if (event) {
    event.displayedText = result === "queued" ? "대기열에 넣었어." : "대기열 처리 실패";
    event.nextAction = request.nextAction || event.nextAction;
    event.interestScore = request.score || event.interestScore;
    if (request.memoryNote) event.memoryNote = request.memoryNote;
  }
  recordAiEvent(room.name, result === "queued" ? "queue" : "queue_failed", request.text);
}

function maybeMoveForRequest(room, bot, request, event) {
  if (request.move === "top") {
    startAiBotWalk(room, bot, { route: "top" });
    return;
  }
  if (request.move === "point" && request.targetPoint) {
    startAiBotWalk(room, bot, {
      target: {
        ...request.targetPoint,
        key: "user_click_point",
        label: "유저 요청 위치",
        intent: "위치 관찰",
        score: event?.interestScore || 90,
        reason: "유저가 AI봇에게 이 위치를 봐달라고 요청함",
        routeType: "chat"
      }
    });
    return;
  }
  if (request.move === "user_art" && request.artTarget) {
    startAiBotWalk(room, bot, {
      target: request.artTarget
    });
    return;
  }
  if (request.move === "user_art") {
    startAiBotWalk(room, bot, {
      target: {
        x: request.userX,
        y: request.userY,
        key: "user_art_request",
        label: `${request.userName || "유저"} 주변`,
        intent: "유저 그림 관찰",
        score: event?.interestScore || 100,
        reason: request.noArtReason || "유저 그림 위치를 찾지 못해 유저 주변으로 이동",
        routeType: "chat"
      }
    });
  }
}

function prepareRequest(room, request) {
  if (request.intent === "request_ai_draw") return prepareDrawRequest(request);
  if (isAdviceIntent(request.intent)) {
    const advice = buildArtCoachResponse(room, request, request.intent);
    request.reply = advice.reply;
    request.targetMeta = advice.targetMeta;
    request.nextAction = advice.nextAction;
    request.score = intentScore(request.nextAction);
    request.memoryNote = advice.memoryNote;
    request.targetMode = "user_art";
    return request;
  }
  if (request.intent !== "observe_user_art") return request;
  const cooldownKey = `${room.name}:${request.userId}`;
  const now = Date.now();
  const lastAt = userArtCooldowns.get(cooldownKey) || 0;
  if (now - lastAt < USER_ART_COOLDOWN_MS) {
    request.reply = "방금 봤어.";
    request.nextAction = "cooldown_user_art";
    request.move = "";
    request.score = 35;
    request.memoryNote = "같은 유저의 최근 그림 요청이 너무 빨라 쿨다운으로 처리함";
    return request;
  }

  const artTarget = findRecentUserArtTarget(room, request);
  if (!artTarget) {
    request.reply = "아직 그림이 안 보여.";
    request.nextAction = "no_user_art";
    request.move = "";
    request.score = 25;
    request.memoryNote = "유저의 최근 그림을 찾지 못해 이동하지 않음";
    return request;
  }

  userArtCooldowns.set(cooldownKey, now);
  request.reply = "그림 보러 갈게.";
  request.artTarget = artTarget;
  request.targetPoint = artTarget.center || { x: artTarget.x, y: artTarget.y };
  request.targetMeta = {
    strokeCount: artTarget.strokeCount,
    pointCount: artTarget.pointCount,
    latestStrokeId: artTarget.latestStrokeId
  };
  request.targetArtworkId = artTarget.latestStrokeId;
  request.targetMode = "user_art";
  request.nextAction = "route_to_user_art";
  request.score = 100;
  request.memoryNote = `유저 최근 그림 묶음 ${artTarget.strokeCount}개 선을 찾아 관찰 대상으로 선택함`;
  return request;
}

function buildRequest(ws, user, message) {
  const config = INTENTS[safeIntent(message.intent)] || INTENTS.greeting;
  const text = safeText(message.text, 80) || config.text;
  const point = normalizePoint(message.targetPoint);
  return {
    intent: safeIntent(message.intent),
    text,
    reply: config.reply,
    nextAction: config.nextAction,
    move: config.move || "",
    targetMode: config.targetMode,
    targetPoint: point,
    targetArtworkId: "",
    targetMeta: null,
    artTarget: null,
    userId: ws.clientId || user.clientId || ws.id,
    playerId: ws.id,
    userName: safeText(user.name, 24) || "유저",
    userX: Math.round(Number(user.x) || 1600),
    userY: Math.round(Number(user.y) || 1100),
    score: intentScore(config.nextAction),
    createdAt: Date.now()
  };
}

function syncInteractionState(room, bot, state) {
  if (!bot) return;
  setAiState(bot, {
    dialogue: getAiDialogueSummary(room.name),
    interaction: serializeInteraction(state)
  }, room.name);
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
}

function serializeInteraction(state) {
  const now = Date.now();
  return {
    locked: Boolean(state.lock && state.lock.expiresAt > now),
    active: state.lock && state.lock.expiresAt > now ? {
      userId: state.lock.userId,
      userName: state.lock.userName,
      intent: state.lock.intent,
      startedAt: state.lock.startedAt,
      expiresAt: state.lock.expiresAt
    } : null,
    queueCount: state.queue.length,
    queue: state.queue.slice(0, MAX_QUEUE).map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      intent: entry.intent,
      createdAt: entry.createdAt
    }))
  };
}

function getInteraction(room) {
  room.aiInteraction ||= { lock: null, queue: [] };
  if (!Array.isArray(room.aiInteraction.queue)) room.aiInteraction.queue = [];
  return room.aiInteraction;
}

function pruneExpiredLock(room, bot, state, processQueue = true) {
  if (!state.lock || state.lock.expiresAt > Date.now()) return;
  state.lock = null;
  if (processQueue) {
    processNextQueued(room, bot, state, "lock_timeout");
  } else {
    syncInteractionState(room, bot, state);
  }
}

function scheduleLockExpiry(room, bot) {
  const previous = roomTimers.get(room.name);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    const state = getInteraction(room);
    pruneExpiredLock(room, bot, state);
  }, LOCK_MS + 80);
  timer.unref?.();
  roomTimers.set(room.name, timer);
}

function findAiBot(room, botId = "") {
  const id = safeText(botId, 100);
  if (id && room.players.get(id)?.isBot) return room.players.get(id);
  return Array.from(room.players.values()).find((player) => player.isBot === true) || null;
}

function findClientByUser(room, request) {
  for (const client of room.clients) {
    if (client.readyState !== client.OPEN) continue;
    if (client.id === request.playerId || client.clientId === request.userId) return client;
  }
  return null;
}

function normalizePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.max(0, Math.min(3200, Math.round(x))),
    y: Math.max(0, Math.min(2200, Math.round(y)))
  };
}

function getTargetLabel(request) {
  if (request.intent === "observe_user_art" && request.targetPoint) {
    return `${request.userName || "유저"} 최근 그림`;
  }
  if (request.targetPoint) return `${request.targetPoint.x}, ${request.targetPoint.y}`;
  return request.userName || "유저";
}

module.exports = {
  handleAiBotInteraction,
  releaseAiBotUser
};
