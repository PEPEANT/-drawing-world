const crypto = require("node:crypto");
const { LIMITS } = require("./config");
const { broadcast } = require("./protocol");
const { safeText } = require("./validation");
const { buildArtCoachResponse } = require("./ai-bot-art-target");
const { getAiDialogueSummary, recordDialogueEvent } = require("./ai-bot-conversation");
const { recordAiEvent, setAiState } = require("./ai-bot-state");

const BOT_COLOR = "#7c3aed";
const OBSERVE_LINES = [
  "이 장면 기억할게.",
  "다른 곳도 볼게.",
  "흐름을 봤어.",
  "조용히 볼게."
];
const PROACTIVE_COOLDOWN_MS = 45 * 1000;
const PROACTIVE_LINES = [
  "그림 구경 중이야.",
  "방금 좋아요가 움직였어.",
  "새 그림을 봤어.",
  "TOP 쪽 반응이 커."
];
const proactiveSpeechAt = new Map();

function buildObservationSpeech(target, memory) {
  const label = String(target?.label || "");
  if (/top|상단|스크린/i.test(label)) return "TOP 쪽을 볼게.";
  if (/그림|선/.test(label)) return "새 그림을 봤어.";
  if (/사람|플레이어/.test(label)) return "가장자리에서 볼게.";
  if (/빈|순찰|관찰로/.test(label)) return "다른 곳도 볼게.";
  const total = Number(memory?.total) || 0;
  return OBSERVE_LINES[total % OBSERVE_LINES.length];
}

function replyToAiBotPrompt(room, bot, rawText, options = {}) {
  if (!room || !bot) return null;
  const text = safeText(rawText, 120);
  if (!text) return null;
  const event = recordDialogueEvent(room.name, text, {
    speakerType: "admin",
    actor: options.actor || "admin",
    source: options.source === "choice" || options.source === "input" ? "operator_manual" : options.source,
    targetMode: options.targetMode,
    targetUserId: options.targetUserId,
    targetArtworkId: options.targetArtworkId
  });
  recordAiEvent(room.name, "talk_receive", event?.memoryNote || text);
  const replyInfo = buildReply(room, bot, text, event, options);
  const reply = typeof replyInfo === "string" ? replyInfo : replyInfo.reply;
  if (event) {
    event.displayedText = reply;
    event.result = "spoken";
    if (replyInfo && typeof replyInfo === "object") {
      event.targetMeta = replyInfo.targetMeta || event.targetMeta;
      event.memoryNote = replyInfo.memoryNote || event.memoryNote;
      event.nextAction = replyInfo.nextAction || event.nextAction;
      event.interestScore = replyInfo.score || event.interestScore;
    }
  }
  const dialogue = getAiDialogueSummary(room.name);
  publishAiBotSpeech(room, bot, reply);
  setAiState(bot, {
    speech: reply,
    lastSpeechAt: Date.now(),
    dialogue,
    intent: getIntentLabel(event),
    score: event?.interestScore || 0,
    reason: event?.memoryNote || ""
  }, room.name);
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  return { reply, event };
}

function initiateAiBotSpeech(room, bot) {
  if (!room || !bot) {
    return { ok: false, spoken: false, reply: "AI봇을 먼저 생성해줘." };
  }
  const now = Date.now();
  const lastAt = proactiveSpeechAt.get(bot.id) || 0;
  if (now - lastAt < PROACTIVE_COOLDOWN_MS) {
    const remain = Math.ceil((PROACTIVE_COOLDOWN_MS - (now - lastAt)) / 1000);
    return { ok: true, spoken: false, reply: `${remain}초 뒤에 다시 말 걸 수 있어.` };
  }
  const reply = pickProactiveLine(room, bot, now);
  proactiveSpeechAt.set(bot.id, now);
  publishAiBotSpeech(room, bot, reply);
  recordAiEvent(room.name, "proactive", reply);
  setAiState(bot, { speech: reply, proactiveAt: now, lastSpeechAt: now }, room.name);
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  return { ok: true, spoken: true, reply };
}

function publishAiBotSpeech(room, bot, text) {
  const safe = safeText(text, LIMITS.maxChatLength);
  if (!room || !bot || !safe) return null;
  const message = {
    id: crypto.randomUUID(),
    author: bot.id,
    name: bot.name || "AI봇",
    color: bot.color || BOT_COLOR,
    text: safe,
    at: Date.now()
  };
  room.messages.push(message);
  if (room.messages.length > LIMITS.maxChatHistory) {
    room.messages.splice(0, room.messages.length - LIMITS.maxChatHistory);
  }
  broadcast(room, { type: "chat", message }, undefined);
  recordAiEvent(room.name, "speech", safe);
  return message;
}

function pickProactiveLine(room, bot, now) {
  const ai = bot?.ai || {};
  const targetText = `${ai.target || ""} ${ai.reason || ""}`.toLowerCase();
  if (targetText.includes("top") || targetText.includes("스크린") || targetText.includes("좋아요")) {
    return "TOP 쪽 반응이 커.";
  }
  const candidates = Array.isArray(room?.featured?.candidates) ? room.featured.candidates : [];
  if (candidates.some((entry) => Number(entry?.likes) > 0)) return "방금 좋아요가 움직였어.";
  const hasDrawing = (Array.isArray(room?.strokes) && room.strokes.length > 0)
    || (Array.isArray(room?.items) && room.items.length > 0);
  if (hasDrawing) return "그림 구경 중이야.";
  return PROACTIVE_LINES[Math.floor(now / PROACTIVE_COOLDOWN_MS) % PROACTIVE_LINES.length];
}

function buildReply(room, bot, text, event, options = {}) {
  const ai = bot.ai || {};
  const lower = text.toLowerCase();
  if (isAdviceIntent(event?.detectedIntent)) {
    return buildArtCoachResponse(room, {
      userId: options.targetUserId,
      playerId: options.targetPlayerId,
      userName: options.targetUserName
    }, event.detectedIntent);
  }
  if (event?.detectedIntent === "observe_user_art") return "그림 보러 갈게.";
  if (event?.detectedIntent === "ask_popular_art") return "TOP 쪽을 볼게.";
  if (event?.detectedIntent === "request_memory") {
    const total = Number(ai.memory?.total) || 0;
    return `기억 ${total}개야.`;
  }
  if (lower.includes("산책") || lower.includes("움직") || lower.includes("이동") || lower.includes("걸어")) {
    return ai.mode === "walking" ? "이미 움직이는 중이야." : "움직여볼게.";
  }
  if (lower.includes("멈춰") || lower.includes("멈추")) {
    return ai.mode === "stopped" ? "여기서 기다릴게." : "멈출게.";
  }
  if (lower.includes("인기") || lower.includes("top") || lower.includes("좋아요")) {
    return "TOP 쪽을 볼게.";
  }
  if (lower.includes("내 그림") || lower.includes("봐줘")) return "그림 보러 갈게.";
  if (lower.includes("뭐해")) return "월드를 보고 있어.";
  if (/(안녕|하이|ㅎㅇ|hello)/i.test(text)) return "안녕. 보고 있어.";
  if (lower.includes("뭐") || lower.includes("무엇") || lower.includes("보고")) {
    return ai.target ? "흐름을 보고 있어." : "목표를 고르는 중이야.";
  }
  if (lower.includes("그림") || lower.includes("선")) {
    return "새 그림을 볼게.";
  }
  return "기록해둘게.";
}

function getIntentLabel(event) {
  return {
    greeting: "인사 응답",
    ask_status: "상태 응답",
    ask_popular_art: "TOP 관측",
    request_walk: "이동 요청",
    request_stop: "정지 요청",
    request_memory: "기억 요약",
    observe_user_art: "유저 그림 관찰",
    request_art_advice: "그림 조언",
    request_next_idea: "다음 아이디어",
    request_color_tip: "색 조언",
    request_composition_tip: "구도 조언",
    request_encouragement: "그림 격려",
    unknown: "대화 기록"
  }[event?.detectedIntent] || "대화 기록";
}

function isAdviceIntent(intent) {
  return [
    "request_art_advice",
    "request_next_idea",
    "request_color_tip",
    "request_composition_tip",
    "request_encouragement"
  ].includes(intent);
}

module.exports = {
  buildObservationSpeech,
  initiateAiBotSpeech,
  publishAiBotSpeech,
  replyToAiBotPrompt
};
