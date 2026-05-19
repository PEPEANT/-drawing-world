const { createAiBot, getAiBot, removeAiBot } = require("./ai-bot");
const { drawAiArtwork, planAiArtwork } = require("./ai-bot-art");
const { cancelAiDrawingSession, getAiDrawingSession, startAiDrawingSession } = require("./ai-bot-draw-session");
const { startAiBotWalk, stopAiBotWalk } = require("./ai-bot-brain");
const { initiateAiBotSpeech, replyToAiBotPrompt } = require("./ai-bot-dialogue");
const { decorateAiBotMemory } = require("./ai-bot-memory");
const { exportConversationStore, flushConversationStore, getConversationSummary } = require("./ai-bot-conversation-store");
const { buildAiDebugSnapshot } = require("./ai-bot-state");
const { send } = require("./protocol");
const { getRoom, rooms } = require("./rooms");
const { sanitizeRoomName } = require("./validation");

function handleAiBotAdminMessage(ws, message, notifyAdminState) {
  const room = sanitizeRoomName(message.room || "lobby");
  if (isBlockedWhileDrawing(message.type)) {
    const targetRoom = rooms.get(room);
    const bot = getAiBot(room);
    if (isAiDrawing(targetRoom, bot)) {
      const nextBot = decorateAiBotMemory(bot, room);
      send(ws, buildAiBotPayload("aiBotBusy", room, nextBot, {
        ok: false,
        reason: "AI봇이 그림을 다 그릴 때까지 다른 행동은 잠깐 막아둘게."
      }));
      return true;
    }
  }
  if (message.type === "aiBotState") {
    const bot = decorateAiBotMemory(getAiBot(room), room);
    send(ws, buildAiBotPayload("aiBotState", room, bot));
    return true;
  }
  if (message.type === "aiBotCreate") {
    const result = createAiBot(room, { skin: message.skin });
    const bot = decorateAiBotMemory(result.bot, room);
    send(ws, buildAiBotPayload("aiBotCreated", room, bot, { created: result.created }));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotWalk") {
    const result = createAiBot(room, { skin: message.skin });
    const walk = startAiBotWalk(getRoom(room), result.bot);
    const bot = decorateAiBotMemory(walk.bot, room);
    send(ws, buildAiBotPayload("aiBotWalking", room, bot, { created: result.created }));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotRoute") {
    const result = createAiBot(room, { skin: message.skin });
    const route = message.route === "top" ? "top" : "patrol";
    const walk = startAiBotWalk(getRoom(room), result.bot, { route });
    const bot = decorateAiBotMemory(walk.bot, room);
    send(ws, buildAiBotPayload("aiBotRouted", room, bot, { route, created: result.created }));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotStop") {
    const targetRoom = rooms.get(room);
    const result = stopAiBotWalk(targetRoom, getAiBot(room));
    const bot = decorateAiBotMemory(result.bot, room);
    send(ws, buildAiBotPayload("aiBotStopped", room, bot));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotTalk") {
    const bot = getAiBot(room);
    const result = replyToAiBotPrompt(rooms.get(room), bot, message.text, {
      source: message.source,
      actor: "admin",
      targetMode: message.targetMode,
      targetUserId: message.targetUserId,
      operator: message.operator
    });
    const reply = result?.reply || "";
    const nextBot = decorateAiBotMemory(bot, room);
    send(ws, buildAiBotPayload("aiBotTalked", room, nextBot, { reply, result: result?.event?.result || "" }));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotProactive") {
    const bot = getAiBot(room);
    const result = initiateAiBotSpeech(rooms.get(room), bot);
    const nextBot = decorateAiBotMemory(bot, room);
    send(ws, buildAiBotPayload("aiBotProactiveTalked", room, nextBot, {
      ok: result.ok,
      spoken: result.spoken,
      reply: result.reply
    }));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotConversationSave") {
    const result = flushConversationStore();
    const bot = decorateAiBotMemory(getAiBot(room), room);
    send(ws, buildAiBotPayload("aiBotConversationSaved", room, bot, {
      ok: result.ok,
      summary: getConversationSummary(room)
    }));
    return true;
  }
  if (message.type === "aiBotConversationExport") {
    const bot = decorateAiBotMemory(getAiBot(room), room);
    send(ws, buildAiBotPayload("aiBotConversationExported", room, bot, {
      ok: true,
      data: exportConversationStore(room),
      summary: getConversationSummary(room)
    }));
    return true;
  }
  if (message.type === "aiBotDrawPlan") {
    const targetRoom = rooms.get(room);
    const bot = getAiBot(room);
    const result = planAiArtwork(targetRoom, bot, {
      topic: message.topic,
      style: message.style,
      shape: message.shape,
      character: message.character,
      prompt: message.prompt
    });
    const nextBot = decorateAiBotMemory(result.bot, room);
    send(ws, buildAiBotPayload("aiBotDrawPlanned", room, nextBot, {
      ok: result.ok,
      reason: result.reason,
      artwork: result.artwork
    }));
    return true;
  }
  if (message.type === "aiBotDrawStart") {
    const targetRoom = rooms.get(room);
    const bot = getAiBot(room);
    stopAiBotWalk(targetRoom, bot, { silent: true });
    const result = startAiDrawingSession(targetRoom, bot, {
      topic: message.topic,
      style: message.style,
      shape: message.shape,
      character: message.character,
      prompt: message.prompt
    });
    const nextBot = decorateAiBotMemory(result.bot, room);
    send(ws, buildAiBotPayload("aiBotDrawStarted", room, nextBot, {
      ok: result.ok,
      reason: result.reason,
      artwork: result.artwork
    }));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotDrawCancel") {
    const targetRoom = rooms.get(room);
    const bot = getAiBot(room);
    const result = cancelAiDrawingSession(targetRoom, bot);
    const nextBot = decorateAiBotMemory(result.bot, room);
    send(ws, buildAiBotPayload("aiBotDrawCancelled", room, nextBot, {
      ok: result.ok,
      reason: result.reason,
      artwork: result.artwork
    }));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotDraw") {
    const targetRoom = rooms.get(room);
    const bot = getAiBot(room);
    const result = drawAiArtwork(targetRoom, bot, {
      topic: message.topic,
      style: message.style,
      shape: message.shape,
      character: message.character,
      prompt: message.prompt
    });
    const nextBot = decorateAiBotMemory(result.bot, room);
    send(ws, buildAiBotPayload("aiBotDrawn", room, nextBot, {
      ok: result.ok,
      reason: result.reason,
      artwork: result.artwork
    }));
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotRemove") {
    stopAiBotWalk(rooms.get(room), getAiBot(room), { silent: true });
    cancelAiDrawingSession(rooms.get(room), getAiBot(room));
    const result = removeAiBot(room);
    send(ws, buildAiBotPayload("aiBotRemoved", room, null, { id: result.bot?.id || "", removed: result.removed }));
    notifyAdminState();
    return true;
  }
  return false;
}

function isBlockedWhileDrawing(type) {
  return new Set([
    "aiBotWalk",
    "aiBotRoute",
    "aiBotStop",
    "aiBotTalk",
    "aiBotProactive",
    "aiBotDrawPlan",
    "aiBotDrawStart",
    "aiBotDraw"
  ]).has(type);
}

function isAiDrawing(room, bot) {
  if (!room || !bot) return false;
  return bot.ai?.mode === "drawing" || getAiDrawingSession(room.name)?.botId === bot.id;
}

function buildAiBotContext(room, bot, roomName = "lobby") {
  if (!room) return {
    room: roomName,
    x: 0,
    y: 0,
    humanCount: 0,
    nearbyPlayers: 0,
    strokeCount: 0,
    itemCount: 0,
    featuredCount: 0,
    route: null,
    draw: null,
    world: { players: [], strokes: [] },
    lifecycle: "",
    interaction: null,
    conversation: getConversationSummary(roomName),
    senses: [],
    attention: []
  };
  const humans = Array.from(room.players.values()).filter((player) => !player.isBot);
  const x = Math.round(Number(bot?.x) || 0);
  const y = Math.round(Number(bot?.y) || 0);
  const nearbyPlayers = bot
    ? humans.filter((player) => Math.hypot((Number(player.x) || 0) - x, (Number(player.y) || 0) - y) <= 460).length
    : 0;
  const candidates = Array.isArray(room.featured?.candidates) ? room.featured.candidates : [];
  return {
    room: room.name,
    x,
    y,
    humanCount: humans.length,
    nearbyPlayers,
    strokeCount: room.strokes.length,
    itemCount: room.items.length,
    featuredCount: candidates.filter((entry) => Number(entry?.likes) > 0).length,
    route: bot?.ai?.route || null,
    draw: bot?.ai?.draw || null,
    world: buildWorldSnapshot(room, bot, humans),
    lifecycle: bot?.ai?.lifecycle || bot?.ai?.mode || "",
    interaction: bot?.ai?.interaction || null,
    conversation: getConversationSummary(room.name),
    senses: Array.isArray(bot?.ai?.senses) ? bot.ai.senses : [],
    attention: Array.isArray(bot?.ai?.attention) ? bot.ai.attention : []
  };
}

function buildWorldSnapshot(room, bot, humans) {
  const bx = Number(bot?.x) || 0;
  const by = Number(bot?.y) || 0;
  const visibleStrokes = room.strokes
    .filter((stroke) => stroke.isBotArtwork || isNearStroke(stroke, bx, by, 980))
    .slice(-80)
    .map((stroke) => ({
      id: stroke.id,
      color: stroke.color || "#111827",
      size: Number(stroke.size) || 4,
      isBotArtwork: stroke.isBotArtwork === true,
      points: samplePoints(stroke.points || [], 70)
    }));
  return {
    players: humans.slice(0, 40).map((player) => ({
      id: player.id,
      name: player.name || "guest",
      x: Math.round(Number(player.x) || 0),
      y: Math.round(Number(player.y) || 0)
    })),
    strokes: visibleStrokes
  };
}

function isNearStroke(stroke, x, y, radius) {
  return (stroke.points || []).some((point) => Math.hypot((Number(point.x) || 0) - x, (Number(point.y) || 0) - y) <= radius);
}

function samplePoints(points, limit) {
  if (points.length <= limit) return points.map(snapshotPoint);
  const step = Math.ceil(points.length / limit);
  return points.filter((_, index) => index % step === 0 || index === points.length - 1).map(snapshotPoint);
}

function snapshotPoint(point) {
  return { x: Math.round(Number(point.x) || 0), y: Math.round(Number(point.y) || 0) };
}

function buildAiBotPayload(type, roomName, bot, extra = {}) {
  const room = rooms.get(roomName);
  const context = buildAiBotContext(room, bot, roomName);
  return {
    type,
    ...extra,
    bot,
    context,
    debug: buildAiDebugSnapshot(room, bot, context)
  };
}

module.exports = { handleAiBotAdminMessage };
