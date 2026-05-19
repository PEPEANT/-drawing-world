const crypto = require("node:crypto");
const { getConversationSummary, getRecentConversationEvents, recordConversationEvent } = require("./ai-bot-conversation-store");

const MAX_DIALOGUE_EVENTS = 20;
const MAX_RECENT_EVENTS = 5;
const RECENT_DIALOGUE_MS = 90 * 1000;

const dialogueByRoom = new Map();

function recordDialogueEvent(roomName, rawText, options = {}) {
  const room = safeRoom(roomName);
  const text = safeText(rawText, 80);
  if (!room || !text) return null;

  const intent = classifyIntent(text);
  const now = Date.now();
  const event = {
    id: crypto.randomUUID(),
    at: now,
    rawText: text,
    displayedText: safeText(options.displayedText, 120),
    speakerType: safeChoice(options.speakerType, ["admin", "user", "bot"], "admin"),
    actor: safeActor(options.actor, options.speakerType),
    source: safeChoice(options.source, ["choice", "input", "operator_manual", "auto", "proactive", "user_click"], "input"),
    targetMode: safeChoice(options.targetMode, ["world", "nearby", "recent_author", "specific_user", "point", "user_art"], "world"),
    targetUserId: safeText(options.targetUserId, 48),
    targetArtworkId: safeText(options.targetArtworkId, 48),
    targetPoint: safePoint(options.targetPoint),
    targetMeta: safeMeta(options.targetMeta),
    detectedIntent: intent.key,
    interestScore: intent.score,
    memoryNote: buildMemoryNote(intent.note, options),
    nextAction: intent.nextAction,
    result: safeChoice(options.result, ["spoken", "moved", "queued", "failed"], "queued"),
    createdAt: now
  };
  const events = ensureRoomEvents(room);
  events.unshift(event);
  if (events.length > MAX_DIALOGUE_EVENTS) events.length = MAX_DIALOGUE_EVENTS;
  dialogueByRoom.set(room, events);
  queueMicrotask(() => recordConversationEvent(room, event));
  return event;
}

function getAiDialogueSummary(roomName, now = Date.now()) {
  const events = getDialogueEvents(roomName);
  const saved = getConversationSummary(roomName, now);
  const latest = events[0] || null;
  const intentCounts = new Map();
  for (const event of events) {
    intentCounts.set(event.detectedIntent, (intentCounts.get(event.detectedIntent) || 0) + 1);
  }
  return {
    total: Math.max(events.length, saved.totalEvents || 0),
    saved,
    latest: latest ? cloneEvent(latest) : null,
    latestIsFresh: latest ? now - latest.createdAt <= RECENT_DIALOGUE_MS : false,
    topIntents: Array.from(intentCounts.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent, "ko"))
      .slice(0, 3),
    recent: events.slice(0, MAX_RECENT_EVENTS).map(cloneEvent)
  };
}

function getDialogueEvents(roomName) {
  return ensureRoomEvents(safeRoom(roomName)).map(cloneEvent);
}

function clearDialogueCache() {
  dialogueByRoom.clear();
}

function ensureRoomEvents(room) {
  if (!room) return [];
  if (!dialogueByRoom.has(room)) {
    dialogueByRoom.set(room, getRecentConversationEvents(room).slice(0, MAX_DIALOGUE_EVENTS));
  }
  return dialogueByRoom.get(room);
}

function classifyIntent(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("그려줘") || lower.includes("그림 그려") || lower.includes("ai 그림")) {
    return intent("request_ai_draw", 95, "AI봇 그림 생성을 요청함", "start_ai_draw");
  }
  if (lower.includes("멈춰") || lower.includes("멈추") || lower.includes("정지") || lower.includes("stop")) {
    return intent("request_stop", 70, "관리자가 AI봇 정지를 요청함", "stop");
  }
  if (lower.includes("색 추천") || lower.includes("색 뭐") || lower.includes("색깔") || lower.includes("컬러")) {
    return intent("request_color_tip", 70, "그림 색 조언을 요청함", "give_color_tip");
  }
  if (lower.includes("구도") || lower.includes("배치") || lower.includes("위치")) {
    return intent("request_composition_tip", 70, "그림 구도 조언을 요청함", "give_composition_tip");
  }
  if (lower.includes("뭐 그릴") || lower.includes("다음 뭐") || lower.includes("뭘 그릴") || lower.includes("아이디어")) {
    return intent("request_next_idea", 75, "다음 그림 아이디어를 요청함", "suggest_next_idea");
  }
  if (lower.includes("어렵") || lower.includes("망했") || lower.includes("망한") || lower.includes("모르겠")) {
    return intent("request_encouragement", 65, "그림 격려를 요청함", "encourage_drawing");
  }
  if (lower.includes("조언") || lower.includes("어때") || lower.includes("고칠") || lower.includes("코칭")) {
    return intent("request_art_advice", 75, "그림 조언을 요청함", "give_art_advice");
  }
  if (lower.includes("산책") || lower.includes("움직") || lower.includes("이동") || lower.includes("걸어")) {
    return intent("request_walk", 60, "관리자가 AI봇 이동을 요청함", "start_walk");
  }
  if (lower.includes("여기도") || lower.includes("여기 봐") || lower.includes("여기 볼")) {
    return intent("observe_here", 90, "유저가 특정 위치 관찰을 요청함", "observe_here");
  }
  if (lower.includes("같이 대화") || lower.includes("대화하자") || lower.includes("말하자")) {
    return intent("chat_together", 70, "유저가 AI봇과 대화를 요청함", "start_conversation");
  }
  if (lower.includes("내 그림") || lower.includes("봐줘") || lower.includes("작품")) {
    return intent("observe_user_art", 100, "관리자가 유저 그림 관찰을 요청함", "observe_user_art");
  }
  if (lower.includes("인기") || lower.includes("top") || lower.includes("좋아요")) {
    return intent("ask_popular_art", 80, "관리자가 인기 그림 흐름을 물어봄", "observe_top");
  }
  if (lower.includes("기억")) {
    return intent("request_memory", 60, "관리자가 오늘 기억 요약을 요청함", "summarize_memory");
  }
  if (lower.includes("뭐해") || lower.includes("뭐 하고") || lower.includes("보고") || lower.includes("상태")) {
    return intent("ask_status", 40, "관리자가 AI봇 상태를 물어봄", "answer_status");
  }
  if (/(안녕|하이|ㅎㅇ|hello)/i.test(text)) {
    return intent("greeting", 20, "관리자가 인사를 건넴", "reply_greeting");
  }
  return intent("unknown", 15, "분류되지 않은 대화를 감각 입력으로 기록함", "answer_short");
}

function intent(key, score, note, nextAction) {
  return { key, score, note, nextAction };
}

function cloneEvent(event) {
  return {
    id: event.id,
    at: event.at,
    rawText: event.rawText,
    displayedText: event.displayedText,
    speakerType: event.speakerType,
    actor: event.actor,
    source: event.source,
    targetMode: event.targetMode,
    targetUserId: event.targetUserId,
    targetArtworkId: event.targetArtworkId,
    targetPoint: event.targetPoint,
    targetMeta: event.targetMeta,
    detectedIntent: event.detectedIntent,
    interestScore: event.interestScore,
    memoryNote: event.memoryNote,
    nextAction: event.nextAction,
    result: event.result,
    createdAt: event.createdAt
  };
}

function buildMemoryNote(note, options = {}) {
  const target = {
    world: "전체 월드",
    nearby: "근처 유저",
    recent_author: "최근 그림 작성자",
    specific_user: options.targetUserId ? `특정 유저 ${safeText(options.targetUserId, 24)}` : "특정 유저",
    point: formatPoint(options.targetPoint),
    user_art: formatUserArt(options)
  }[options.targetMode] || "전체 월드";
  return `${note} · 대상: ${target}`;
}

function safeMeta(meta) {
  if (!meta || typeof meta !== "object") return null;
  return {
    strokeCount: safePositiveNumber(meta.strokeCount),
    pointCount: safePositiveNumber(meta.pointCount),
    colorCount: safePositiveNumber(meta.colorCount),
    drawingArea: safePositiveNumber(meta.drawingArea),
    width: safePositiveNumber(meta.width),
    height: safePositiveNumber(meta.height),
    latestStrokeId: safeText(meta.latestStrokeId, 80)
  };
}

function safePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.max(0, Math.min(3200, Math.round(x))),
    y: Math.max(0, Math.min(2200, Math.round(y)))
  };
}

function formatPoint(point) {
  const safe = safePoint(point);
  return safe ? `위치 ${safe.x}, ${safe.y}` : "선택 위치";
}

function formatUserArt(options) {
  const point = formatPoint(options.targetPoint);
  const count = safePositiveNumber(options.targetMeta?.strokeCount);
  return count ? `최근 그림 ${count}개 선 · ${point}` : `최근 그림 · ${point}`;
}

function safePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function safeText(value, limit) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function safeRoom(value) {
  return typeof value === "string" ? value.replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 32) : "";
}

function safeChoice(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function safeActor(value, speakerType) {
  if (["admin", "user", "ai"].includes(value)) return value;
  return speakerType === "bot" ? "ai" : speakerType === "user" ? "user" : "admin";
}

module.exports = {
  clearDialogueCache,
  getAiDialogueSummary,
  getDialogueEvents,
  recordDialogueEvent
};
