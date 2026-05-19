const { getAiDialogueSummary } = require("./ai-bot-conversation");
const { startAiDrawingSession } = require("./ai-bot-draw-session");
const { publishAiBotSpeech } = require("./ai-bot-dialogue");
const { recordAiEvent, setAiState } = require("./ai-bot-state");
const { broadcast, send } = require("./protocol");

const WORLD = { width: 3200, height: 2200 };
const PLAYER_CLEAR_RADIUS = 180;
const STROKE_CLEAR_RADIUS = 210;

function prepareDrawRequest(request) {
  request.reply = "작게 그려볼게.";
  request.nextAction = "start_ai_draw";
  request.score = 95;
  request.targetMode = "point";
  request.memoryNote = "유저가 AI봇에게 작은 그림 생성을 요청함";
  request.drawRequest = true;
  return request;
}

function runDrawInteraction(room, bot, request, ws, interaction, lockMs, event) {
  const drawPoint = findSafeDrawPoint(room, request);
  placeBotNearDrawPoint(bot, drawPoint);
  const result = startAiDrawingSession(room, bot, {
    topic: "shape",
    shape: "random",
    style: "simple",
    source: "user_click",
    center: drawPoint
  });
  const ok = result.ok === true;
  const reply = ok ? request.reply : "지금은 못 그려.";
  if (event) {
    event.displayedText = reply;
    event.nextAction = request.nextAction;
    event.interestScore = request.score;
    event.memoryNote = request.memoryNote;
    event.result = ok ? "spoken" : "failed";
  }
  recordAiEvent(room.name, ok ? "draw_request" : "draw_request_failed", request.memoryNote);
  publishAiBotSpeech(room, bot, reply);
  const patch = {
    lifecycle: "active",
    intent: "AI 그림 요청",
    target: getDrawTargetLabel(request),
    score: request.score,
    reason: request.memoryNote,
    speech: reply,
    lastSpeechAt: Date.now(),
    dialogue: getAiDialogueSummary(room.name),
    interaction
  };
  if (!ok) patch.mode = "talking";
  setAiState(bot, patch, room.name);
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  if (ws) {
    send(ws, {
      type: "aiBotInteractResult",
      ok,
      result: ok ? "spoken" : "failed",
      message: `AI봇: ${reply}`,
      lockMs
    });
  }
  return ok;
}

function placeBotNearDrawPoint(bot, point) {
  bot.x = clamp(point.x - 140, 80, WORLD.width - 80);
  bot.y = clamp(point.y + 105, 80, WORLD.height - 80);
  bot.moving = false;
}

function findSafeDrawPoint(room, request) {
  const base = request.targetPoint || { x: request.userX, y: request.userY };
  const offsets = [
    [220, 0], [-220, 0], [0, 220], [0, -220],
    [260, 180], [-260, 180], [260, -180], [-260, -180],
    [420, 0], [-420, 0], [0, 420], [0, -420]
  ];
  return offsets
    .map(([dx, dy]) => ({ x: clamp(base.x + dx, 360, WORLD.width - 360), y: clamp(base.y + dy, 420, WORLD.height - 320) }))
    .sort((a, b) => scoreDrawPoint(room, b, request) - scoreDrawPoint(room, a, request))[0]
    || { x: clamp(base.x, 360, WORLD.width - 360), y: clamp(base.y, 420, WORLD.height - 320) };
}

function scoreDrawPoint(room, point, request) {
  let score = 1000 - Math.hypot(point.x - request.userX, point.y - request.userY) * 0.12;
  for (const player of room.players.values()) {
    if (player.isBot) continue;
    const distance = Math.hypot(point.x - Number(player.x || 0), point.y - Number(player.y || 0));
    if (distance < PLAYER_CLEAR_RADIUS) score -= (PLAYER_CLEAR_RADIUS - distance) * 4;
  }
  for (const stroke of recentVisibleStrokes(room)) {
    const distance = distanceToStroke(point, stroke);
    if (distance < STROKE_CLEAR_RADIUS) score -= (STROKE_CLEAR_RADIUS - distance) * 2.5;
  }
  return score;
}

function recentVisibleStrokes(room) {
  return (Array.isArray(room.strokes) ? room.strokes : [])
    .filter((stroke) => stroke && stroke.tool !== "eraser")
    .slice(-90);
}

function distanceToStroke(point, stroke) {
  let best = Infinity;
  for (const item of Array.isArray(stroke.points) ? stroke.points : []) {
    const x = Number(item.x);
    const y = Number(item.y);
    if (Number.isFinite(x) && Number.isFinite(y)) best = Math.min(best, Math.hypot(point.x - x, point.y - y));
  }
  return best;
}

function getDrawTargetLabel(request) {
  if (request.targetPoint) return `${request.targetPoint.x}, ${request.targetPoint.y}`;
  return `${request.userName || "유저"} 근처`;
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

module.exports = {
  prepareDrawRequest,
  runDrawInteraction
};
