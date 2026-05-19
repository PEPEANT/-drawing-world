const { LIMITS } = require("./config");
const { broadcast } = require("./protocol");
const { planAiArtwork } = require("./ai-bot-art");
const { setAiState } = require("./ai-bot-state");

const TICK_MS = 260;
const POINTS_PER_TICK = 1;
const sessions = new Map();

function startAiDrawingSession(room, bot, options = {}) {
  if (!room || !bot) {
    return { ok: false, reason: "AI봇을 먼저 생성해야 해.", bot, artwork: null };
  }
  if (sessions.has(room.name)) {
    return { ok: false, reason: "이미 AI 그림을 그리는 중이야.", bot, artwork: null };
  }

  const plan = planAiArtwork(room, bot, options);
  if (!plan.ok) return plan;

  const strokes = plan.strokes.map((stroke) => ({
    ...stroke,
    order: room.strokeSeq = (room.strokeSeq || 0) + 1,
    points: (stroke.points || []).map((point) => ({ ...point }))
  }));
  const session = {
    roomName: room.name,
    botId: bot.id,
    artwork: plan.artwork,
    reason: plan.reason,
    strokes,
    strokeIndex: 0,
    pointIndex: 0,
    tickCount: 0,
    timer: null,
    startedAt: Date.now()
  };
  sessions.set(room.name, session);
  setDrawState(room, bot, session, "drawing", "그려볼게.", { type: "draw_start", detail: plan.artwork.prompt });
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  session.timer = setInterval(() => tickDrawing(room, bot, session), TICK_MS);
  tickDrawing(room, bot, session);

  return { ok: true, reason: plan.reason, bot, artwork: plan.artwork, started: true };
}

function cancelAiDrawingSession(room, bot) {
  if (!room || !bot) return { ok: false, reason: "AI봇이 없어.", bot };
  const session = sessions.get(room.name);
  if (!session) return { ok: false, reason: "진행 중인 AI 그림이 없어.", bot };
  clearInterval(session.timer);
  sessions.delete(room.name);
  setDrawState(room, bot, session, "cancelled", "멈출게.", { type: "draw_cancel", detail: session.artwork?.prompt || "" });
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  return { ok: true, reason: "AI 그림을 멈췄어.", bot, artwork: session.artwork };
}

function getAiDrawingSession(roomName) {
  const session = sessions.get(roomName);
  return session ? { ...session, timer: undefined } : null;
}

function tickDrawing(room, bot, session) {
  if (!room || !bot || sessions.get(room.name) !== session) return;
  const stroke = session.strokes[session.strokeIndex];
  if (!stroke) {
    completeDrawing(room, bot, session);
    return;
  }

  const points = stroke.points || [];
  session.pointIndex = Math.min(points.length, session.pointIndex + POINTS_PER_TICK);
  const partial = { ...stroke, points: points.slice(0, session.pointIndex) };
  upsertStroke(room, partial);
  broadcast(room, { type: "stroke", stroke: partial }, undefined);

  if (session.pointIndex >= points.length) {
    session.strokeIndex += 1;
    session.pointIndex = 0;
  }
  session.tickCount += 1;
  setDrawState(room, bot, session, "drawing", "", null);
}

function completeDrawing(room, bot, session) {
  clearInterval(session.timer);
  sessions.delete(room.name);
  setDrawState(room, bot, session, "done", "다 그렸어.", { type: "draw_done", detail: session.artwork?.prompt || "" });
  setAiState(bot, {
    mode: "observing",
    intent: "AI 그림 완료",
    target: "AI봇 작품",
    score: 100,
    reason: session.reason
  }, room.name);
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
}

function setDrawState(room, bot, session, status, speech, event) {
  const totalStrokes = session.strokes.length;
  const totalPoints = session.strokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0);
  const donePoints = session.strokes.slice(0, session.strokeIndex)
    .reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0) + session.pointIndex;
  const progress = totalPoints ? Math.min(100, Math.round(donePoints / totalPoints * 100)) : 0;
  setAiState(bot, {
    mode: status === "drawing" ? "drawing" : "observing",
    lifecycle: "active",
    intent: status === "drawing" ? "AI 그림 그리기" : "AI 그림",
    target: session.artwork?.prompt || "AI봇 작품",
    score: 100,
    reason: session.reason,
    speech,
    draw: {
      status,
      progress,
      strokeIndex: Math.min(session.strokeIndex + 1, totalStrokes),
      strokeTotal: totalStrokes,
      pointIndex: session.pointIndex,
      pointTotal: totalPoints,
      artworkId: session.artwork?.id || "",
      shape: session.artwork?.shape || "",
      prompt: session.artwork?.prompt || ""
    }
  }, room.name, event);
}

function upsertStroke(room, stroke) {
  const index = room.strokes.findIndex((entry) => entry.id === stroke.id);
  if (index >= 0) room.strokes[index] = stroke;
  else room.strokes.push(stroke);
  if (room.strokes.length > LIMITS.maxStrokesPerRoom) {
    room.strokes.splice(0, room.strokes.length - LIMITS.maxStrokesPerRoom);
  }
}

module.exports = {
  cancelAiDrawingSession,
  getAiDrawingSession,
  startAiDrawingSession
};
