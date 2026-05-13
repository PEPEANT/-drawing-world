const crypto = require("node:crypto");
const { LIMITS } = require("./config");
const { broadcast } = require("./protocol");
const { getRoom, rooms } = require("./rooms");
const { safeText, sanitizeRoomName } = require("./validation");

const AI_AUTHOR = "ai-observatory";
const AI_NAME = "AI 관측실";
const AI_COLOR = "#7c3aed";

const TOPICS = [
  ["AI 이후의 교실", "인간 학생과 AI 학생이 같은 교실에 있는 장면을 그려보세요."],
  ["시뮬라크월드의 첫 시민", "이 세계에 처음 태어난 인간 또는 AI 시민을 그려보세요."],
  ["2035년의 편의점", "미래 편의점에서 인간과 로봇이 만나는 순간을 그려보세요."],
  ["서버가 잠든 밤", "아무도 없는 밤에 월드 안에서 무슨 일이 생기는지 그려보세요."],
  ["이상한 관리자실", "관리자와 AI가 같은 화면을 보는 장면을 그려보세요."],
  ["미래의 놀이터", "사람과 AI가 같이 노는 놀이터를 그려보세요."],
  ["오늘 접속한 아바타들", "현재 방에 있는 플레이어들을 하나의 단체 그림으로 그려보세요."],
  ["그림테러를 막는 수호자", "월드를 지키는 방어자나 관측자를 그려보세요."]
];

function buildAiState() {
  const roomList = Array.from(rooms.values());
  if (!rooms.has("lobby")) roomList.push(getRoom("lobby"));
  return {
    at: Date.now(),
    engine: "local-observer-v0.1",
    rooms: roomList.map(buildAiRoom)
  };
}

function publishAiAnnouncement(roomName, rawText) {
  const room = getRoom(sanitizeRoomName(roomName));
  const text = safeText(rawText, LIMITS.maxChatLength);
  if (!text) return null;
  const message = {
    id: crypto.randomUUID(),
    author: AI_AUTHOR,
    name: AI_NAME,
    color: AI_COLOR,
    text,
    at: Date.now()
  };
  room.messages.push(message);
  if (room.messages.length > LIMITS.maxChatHistory) {
    room.messages.splice(0, room.messages.length - LIMITS.maxChatHistory);
  }
  broadcast(room, { type: "chat", message }, undefined);
  return message;
}

function buildAiRoom(room) {
  const humanClients = Array.from(room.clients).filter((client) => !client.isSpectator).length;
  const viewers = Array.from(room.clients).filter((client) => client.isSpectator).length;
  const players = Array.from(room.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    x: Math.round(player.x || 0),
    y: Math.round(player.y || 0),
    moving: Boolean(player.moving),
    connectedAt: player.connectedAt || 0,
    updatedAt: player.updatedAt || 0
  }));
  const recentMessages = room.messages.slice(-20).map((message) => ({
    name: message.name,
    text: message.text,
    at: message.at || 0
  }));
  const strokeStats = buildStrokeStats(room);
  return {
    name: room.name,
    clients: humanClients,
    viewers,
    playerCount: room.players.size,
    players,
    strokes: room.strokes.length,
    items: room.items.length,
    messages: room.messages.length,
    recentMessages,
    strokeStats,
    observation: buildObservation(room, { humanClients, viewers, recentMessages, strokeStats }),
    topics: buildTopics(room)
  };
}

function buildStrokeStats(room) {
  const recent = room.strokes.slice(-80);
  const byAuthor = new Map();
  for (const stroke of recent) {
    const id = stroke.author || "unknown";
    byAuthor.set(id, (byAuthor.get(id) || 0) + 1);
  }
  const topAuthor = [...byAuthor.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    recentCount: recent.length,
    authorCount: byAuthor.size,
    topAuthor: topAuthor ? { id: topAuthor[0], count: topAuthor[1] } : null,
    topAuthorShare: topAuthor && recent.length ? topAuthor[1] / recent.length : 0
  };
}

function buildObservation(room, context) {
  const signals = [];
  if (context.humanClients === 0) signals.push("현재 인간 접속자가 없습니다.");
  if (context.humanClients > 0) signals.push(`현재 접속자는 ${context.humanClients}명입니다.`);
  if (context.viewers > 0) signals.push(`관전자는 ${context.viewers}명입니다.`);
  if (room.strokes.length === 0) signals.push("아직 그림 흔적이 없습니다.");
  if (room.strokes.length > 0) signals.push(`전체 선 기록은 ${room.strokes.length}개입니다.`);
  if (context.recentMessages.length === 0) signals.push("최근 채팅은 없습니다.");
  if (context.recentMessages.length > 0) signals.push(`최근 채팅 ${context.recentMessages.length}개를 확인했습니다.`);
  if (context.strokeStats.topAuthorShare > 0.75 && context.strokeStats.recentCount >= 24) {
    signals.push("최근 선 대부분이 한 작성자에게 몰려 있어 도배 여부를 봐야 합니다.");
  }

  const risk = getRiskLevel(context);
  return {
    risk,
    mood: getMood(context, room),
    summary: buildSummary(context, room, risk),
    recommendedAction: getRecommendedAction(context, room, risk),
    signals
  };
}

function getRiskLevel(context) {
  if (context.strokeStats.topAuthorShare > 0.85 && context.strokeStats.recentCount >= 32) return "high";
  if (context.strokeStats.topAuthorShare > 0.7 && context.strokeStats.recentCount >= 24) return "medium";
  return "low";
}

function getMood(context, room) {
  if (context.humanClients === 0 && room.strokes.length === 0) return "대기 중";
  if (context.humanClients === 0) return "기록만 남은 조용한 방";
  if (context.recentMessages.length >= 8 || context.strokeStats.recentCount >= 40) return "활동적";
  return "관찰 중";
}

function buildSummary(context, room, risk) {
  if (risk === "high") return "최근 그림 활동이 한 작성자에게 과하게 몰렸습니다. 테러 또는 도배 가능성을 확인하세요.";
  if (context.humanClients === 0) return "현재 방은 조용합니다. AI가 주제를 준비해두면 다음 방문자가 들어왔을 때 빈 느낌을 줄일 수 있습니다.";
  if (room.strokes.length === 0) return "접속자는 있지만 아직 그림이 없습니다. 짧은 주제 공지가 첫 붓질을 유도할 수 있습니다.";
  return "기본 활동은 살아 있습니다. 짧은 주제나 미니 이벤트를 열면 체류 시간을 늘릴 수 있습니다.";
}

function getRecommendedAction(context, room, risk) {
  if (risk === "high") return "관리자 페이지에서 최근 그림을 확인하고 필요하면 경고 또는 부분 삭제를 검토하세요.";
  if (context.humanClients === 0) return "오늘의 주제를 미리 발표해 빈 방의 첫 행동을 준비하세요.";
  if (room.strokes.length === 0) return "쉬운 주제를 하나 발표해 첫 그림을 유도하세요.";
  return "현재 분위기에 맞는 10분 드로잉 주제를 발표하세요.";
}

function buildTopics(room) {
  const seed = new Date().getDate() + room.strokes.length + room.messages.length + room.players.size;
  const picks = [];
  for (let i = 0; i < 3; i += 1) {
    const topic = TOPICS[(seed + i * 3) % TOPICS.length];
    picks.push({
      id: `${room.name}-${seed}-${i}`,
      title: topic[0],
      prompt: topic[1],
      reason: i === 0 ? "현재 방 상태에 가장 무난한 시작 주제입니다." : "분위기를 바꿀 수 있는 예비 주제입니다."
    });
  }
  return picks;
}

module.exports = {
  buildAiState,
  publishAiAnnouncement
};
