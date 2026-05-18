const crypto = require("node:crypto");
const { LIMITS } = require("./config");
const { broadcast } = require("./protocol");
const { safeText } = require("./validation");

const BOT_COLOR = "#7c3aed";
const OBSERVE_LINES = [
  "방금 장면을 기억에 저장했어.",
  "이 위치는 오늘 기억에 남겨둘게.",
  "여기 선의 흐름이 보여.",
  "다음 관측 목표를 다시 고르고 있어."
];

function buildObservationSpeech(target, memory) {
  const total = Number(memory?.total) || 0;
  const base = OBSERVE_LINES[total % OBSERVE_LINES.length];
  if (!target?.label) return base;
  return `${target.label} 관측 완료. ${base}`;
}

function replyToAiBotPrompt(room, bot, rawText) {
  if (!room || !bot) return null;
  const text = safeText(rawText, 120);
  if (!text) return null;
  const reply = buildReply(bot, text);
  publishAiBotSpeech(room, bot, reply);
  bot.ai = { ...(bot.ai || {}), speech: reply };
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  return reply;
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
  return message;
}

function buildReply(bot, text) {
  const ai = bot.ai || {};
  const lower = text.toLowerCase();
  if (/(안녕|하이|ㅎㅇ|hello)/i.test(text)) return "안녕. 나는 지금 이 방을 천천히 보고 있어.";
  if (lower.includes("뭐") || lower.includes("무엇") || lower.includes("보고")) {
    return ai.target ? `지금은 ${ai.target} 쪽을 보고 있어. 점수는 ${ai.score || 0}점이야.` : "아직 목표를 잡기 전이야.";
  }
  if (lower.includes("기억")) {
    const total = Number(ai.memory?.total) || 0;
    return `오늘 기억은 ${total}개야. 많이 본 곳은 덜 보고, 안 본 곳을 더 보려고 해.`;
  }
  if (lower.includes("그림") || lower.includes("선")) {
    return ai.reason || "최근 선, 사람 주변, TOP 스크린을 비교해서 볼 곳을 고르고 있어.";
  }
  if (lower.includes("멈춰") || lower.includes("멈추")) return "알겠어. 멈추기는 오른쪽 버튼으로 직접 잠가줘.";
  return "아직은 짧은 규칙으로만 대답해. 그래도 네 말을 월드 기록으로 받아들이고 있어.";
}

module.exports = {
  buildObservationSpeech,
  publishAiBotSpeech,
  replyToAiBotPrompt
};
