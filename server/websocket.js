const crypto = require("node:crypto");
const { WebSocketServer } = require("ws");
const { recordPlayerSession } = require("./analytics");
const { formatBanReason, getActiveBan } = require("./bans");
const { notifyAdminState } = require("./admin");
const { LIMITS } = require("./config");
const { broadcast, send } = require("./protocol");
const { handleRadioPlay, handleRadioStop, releaseRadioOwner } = require("./radio");
const { removeOwnerItems } = require("./items");
const { claimOwnerStrokes, hasActiveClient, safeOwner: safeClientId } = require("./ownership");
const { parseRequestUrl } = require("./request-url");
const { countHumanPlayers, getRoom, removeRoomIfEmpty } = require("./rooms");
const { isRoomLocked } = require("./room-registry");
const { deleteOwnStrokeIds, isOwnedBy } = require("./strokes");
const { applyVote, buildRanking, removePlayerVotes } = require("./votes");
const { buildFeaturedTop } = require("./featured");
const { wakeAiBotIfSleeping } = require("./ai-bot-brain");
const { focusAiBotOnHumanEntry } = require("./ai-bot-entry-focus");
const { handleAiBotInteraction, releaseAiBotUser } = require("./ai-bot-interaction");
const {
  broadcastFeaturedRemoval,
  resetRoomIfNeeded,
  syncFeaturedVote,
  startDailyResetSweep
} = require("./featured-realtime");
const {
  normalizeItem,
  normalizePlayer,
  normalizePlayerIdentity,
  normalizePlayerMovement,
  normalizeStroke,
  safeLayerId,
  safeText,
  sanitizeRoomName
} = require("./validation");

function attachGameSocket(server) {
  const wss = new WebSocketServer({ noServer: true });
  startDailyResetSweep();

  server.on("upgrade", (req, socket, head) => {
    const url = parseRequestUrl(req);
    if (url.pathname !== "/ws") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const url = parseRequestUrl(req);
    const roomName = sanitizeRoomName(url.searchParams.get("room"));
    const id = crypto.randomUUID();
    const isSpectator = url.searchParams.get("spectator") === "1";
    const clientId = safeClientId(url.searchParams.get("clientId"));
    const activeBan = getActiveBan(clientId);

    if (!isSpectator && isRoomLocked(roomName)) {
      send(ws, { type: "kicked", reason: "지금은 잠긴 방이에요." });
      ws.close(4004, "room locked");
      return;
    }
    if (!isSpectator && activeBan) {
      send(ws, { type: "kicked", reason: formatBanReason(activeBan) });
      ws.close(4003, "banned");
      return;
    }

    const room = getRoom(roomName);
    resetRoomIfNeeded(room);
    if (!isSpectator && hasActiveClient(room, clientId)) {
      send(ws, { type: "kicked", reason: "이미 같은 브라우저가 이 방에 접속 중이에요." });
      ws.close(4008, "duplicate client");
      return;
    }

    ws.id = id;
    ws.clientId = clientId;
    ws.roomName = roomName;
    ws.isSpectator = isSpectator;
    ws.connectedAt = Date.now();
    if (!isSpectator && countHumanPlayers(room) >= LIMITS.maxPlayersPerRoom) {
      send(ws, { type: "kicked", reason: "방이 가득 찼어." });
      ws.close();
      return;
    }

    room.clients.add(ws);
    notifyAdminState();

    send(ws, {
      type: "welcome",
      id,
      room: roomName,
      strokes: room.strokes,
      items: room.items,
      messages: room.messages,
      ranking: buildRanking(room),
      featured: buildFeaturedTop(room),
      players: Array.from(room.players.values())
    });

    ws.on("message", (raw) => handleMessage(ws, room, raw));
    ws.on("close", () => handleClose(ws, room, roomName, id));
  });
}

function handleClose(ws, room, roomName, id) {
  room.clients.delete(ws);
  room.players.delete(id);
  releaseRadioOwner(room, { playerId: id, clientId: ws.clientId });
  releaseAiBotUser(room, { playerId: id, clientId: ws.clientId });
  const removedItemIds = removeOwnerItems(room, { playerId: id, clientId: ws.clientId });
  removePlayerVotes(room, id);
  if (removedItemIds.length) {
    broadcast(room, { type: "removeItems", ids: removedItemIds }, ws);
  }
  broadcast(room, { type: "playerLeave", id }, ws);
  broadcast(room, { type: "ranking", ranking: buildRanking(room) }, ws);
  removeRoomIfEmpty(roomName);
  notifyAdminState();
}

function handleMessage(ws, room, raw) {
  if (ws.isSpectator) return;
  resetRoomIfNeeded(room);

  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }

  switch (message.type) {
    case "hello": return handleHello(ws, room, message);
    case "playerIdentity": return handlePlayerIdentity(ws, room, message);
    case "playerMove": return handlePlayerMove(ws, room, message);
    case "playerUpdate": return handlePlayerUpdate(ws, room, message);
    case "stroke": return handleStroke(ws, room, message);
    case "clearLayer": return handleClearLayer(ws, room, message);
    case "deleteStrokes": return handleDeleteStrokes(ws, room, message);
    case "chat": return handleChat(ws, room, message);
    case "itemAdd": return handleItemAdd(ws, room, message);
    case "radioPlay": return handleRadioPlay(ws, room, message);
    case "radioStop": return handleRadioStop(ws, room, message);
    case "vote": return handleVote(ws, room, message);
    case "aiBotInteract": return handleAiBotInteraction(ws, room, message);
    default: return undefined;
  }
}

function handleClearLayer(ws, room, message) {
  const layerId = safeLayerId(message.layerId);
  room.strokes = room.strokes.filter((stroke) => !isOwnedBy(stroke, ws.id, ws.clientId) || (stroke.layerId || "layer-1") !== layerId);
  broadcast(room, { type: "clearLayer", layerId, author: ws.id, owner: ws.clientId }, undefined);
  notifyAdminState();
}

function handleDeleteStrokes(ws, room, message) {
  const deletedIds = deleteOwnStrokeIds(room, ws.id, ws.clientId, message.ids);
  if (!deletedIds.length) return;
  broadcast(room, { type: "deleteStrokes", ids: deletedIds }, ws);
  notifyAdminState();
}

function handleHello(ws, room, message) {
  const wasHumanEmpty = countHumanPlayers(room) === 0;
  const player = normalizePlayer(message.player || {}, ws.id);
  ws.clientId = safeClientId(message.player?.clientId) || ws.clientId;
  const activeBan = getActiveBan(ws.clientId);
  if (activeBan) {
    send(ws, { type: "kicked", reason: formatBanReason(activeBan) });
    ws.close(4003, "banned");
    return;
  }
  recordPlayerSession({ clientId: ws.clientId || ws.id, room: ws.roomName, at: ws.connectedAt });
  player.clientId = ws.clientId;
  player.connectedAt = ws.connectedAt;
  player.updatedAt = Date.now();
  room.players.set(ws.id, player);
  broadcast(room, { type: "playerJoin", player }, ws);
  const claimed = claimOwnerStrokes(room, player.clientId, ws.id);
  if (claimed) broadcast(room, { type: "claimStrokes", owner: player.clientId, author: ws.id }, undefined);
  if (wasHumanEmpty) focusAiBotOnHumanEntry(room, player);
  else wakeAiBotIfSleeping(room);
  broadcast(room, { type: "ranking", ranking: buildRanking(room) }, undefined);
  notifyAdminState();
}

function handlePlayerUpdate(ws, room, message) {
  return handlePlayerMove(ws, room, message);
}

function handlePlayerMove(ws, room, message) {
  const existing = room.players.get(ws.id);
  if (!existing) return;
  const player = normalizePlayerMovement(message.player || {}, existing);
  player.clientId = existing.clientId || ws.clientId;
  player.connectedAt = existing.connectedAt || ws.connectedAt;
  player.updatedAt = Date.now();
  room.players.set(ws.id, player);
  broadcast(room, { type: "playerMove", player: buildMovePayload(player) }, ws);
  notifyAdminState();
}

function handlePlayerIdentity(ws, room, message) {
  const existing = room.players.get(ws.id);
  if (!existing) return;
  const player = normalizePlayerIdentity(message.player || {}, ws.id, existing);
  player.clientId = existing.clientId || ws.clientId;
  player.connectedAt = existing.connectedAt || ws.connectedAt;
  player.updatedAt = Date.now();
  room.players.set(ws.id, player);
  broadcast(room, { type: "playerIdentity", player }, ws);
  notifyAdminState();
}

function buildMovePayload(player) {
  const payload = {
    id: player.id,
    x: player.x,
    y: player.y,
    facing: player.facing,
    moving: player.moving
  };
  if (player.isBot === true) {
    payload.isBot = true;
    if (player.ai) payload.ai = { mode: player.ai.mode, lifecycle: player.ai.lifecycle };
  }
  return payload;
}

function handleVote(ws, room, message) {
  const targetId = typeof message.target === "string" ? message.target : "";
  const result = applyVote(room, {
    voterId: ws.clientId || ws.id,
    voterPlayerId: ws.id,
    targetId,
    value: message.value
  });
  if (!result.ok) {
    send(ws, { type: "voteResult", message: result.reason });
    return;
  }
  syncFeaturedVote(room, ws, message, targetId, result);
  broadcast(room, { type: "ranking", ranking: result.ranking }, undefined);
  if (result.feedback) broadcast(room, { type: "voteFeedback", feedback: result.feedback }, undefined);
  if (result.clearedTarget) {
    broadcastFeaturedRemoval(room, result.clearedTarget.id);
    broadcast(room, { type: "clearPlayerStrokes", target: result.clearedTarget }, undefined);
  }
  notifyAdminState();
}

function handleStroke(ws, room, message) {
  const stroke = normalizeStroke(message.stroke, ws.id, ws.clientId || ws.id);
  if (!stroke) return;
  stroke.name = room.players.get(ws.id)?.name || "";
  stroke.order = room.strokeSeq = (room.strokeSeq || 0) + 1;
  room.strokes.push(stroke);
  if (room.strokes.length > LIMITS.maxStrokesPerRoom) {
    room.strokes.splice(0, room.strokes.length - LIMITS.maxStrokesPerRoom);
  }
  broadcast(room, { type: "stroke", stroke }, undefined);
  notifyAdminState();
}

function handleItemAdd(ws, room, message) {
  const item = normalizeItem(message.item, ws.id);
  if (!item) return;
  const owner = ws.clientId || ws.id;
  const hasSameType = room.items.some((entry) => (entry.owner || entry.author) === owner && entry.type === item.type);
  if (hasSameType) {
    send(ws, { type: "itemRejected", itemType: item.type, reason: "이미 설치한 아이템이 있어." });
    return;
  }
  item.owner = owner;
  room.items.push(item);
  if (room.items.length > LIMITS.maxItemsPerRoom) {
    room.items.splice(0, room.items.length - LIMITS.maxItemsPerRoom);
  }
  broadcast(room, { type: "itemAdd", item }, undefined);
  notifyAdminState();
}

function handleChat(ws, room, message) {
  const player = room.players.get(ws.id);
  const text = safeText(message.text, LIMITS.maxChatLength);
  if (!player || !text) return;
  const chatMessage = {
    id: crypto.randomUUID(),
    author: ws.id,
    name: player.name,
    color: player.color,
    text,
    at: Date.now()
  };
  room.messages.push(chatMessage);
  if (room.messages.length > LIMITS.maxChatHistory) {
    room.messages.splice(0, room.messages.length - LIMITS.maxChatHistory);
  }
  broadcast(room, { type: "chat", message: chatMessage }, undefined);
}

module.exports = { attachGameSocket };
