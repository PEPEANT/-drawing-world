const crypto = require("node:crypto");
const { WebSocketServer } = require("ws");
const {
  buildArenaState,
  handleArenaAction,
  handleArenaRole,
  preserveArenaFields,
  setupArenaPlayer,
  startArenaLoop
} = require("./arena");
const { recordPlayerSession } = require("./analytics");
const { formatBanReason, getActiveBan } = require("./bans");
const { notifyAdminState } = require("./admin");
const { LIMITS } = require("./config");
const { broadcast, send } = require("./protocol");
const { handleRadioPlay, handleRadioStop } = require("./radio");
const { removeOwnerItems } = require("./items");
const { parseRequestUrl } = require("./request-url");
const { getRoom, removeRoomIfEmpty } = require("./rooms");
const { deleteOwnStrokeIds } = require("./strokes");
const { applyVote, buildRanking, removePlayerVotes } = require("./votes");
const {
  normalizeItem,
  normalizePlayer,
  normalizeStroke,
  safeLayerId,
  safeText,
  sanitizeRoomName
} = require("./validation");

function attachGameSocket(server) {
  startArenaLoop();
  const wss = new WebSocketServer({ noServer: true });

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
    const room = getRoom(roomName);
    const id = crypto.randomUUID();
    const isSpectator = url.searchParams.get("spectator") === "1";
    const clientId = safeClientId(url.searchParams.get("clientId"));
    const activeBan = getActiveBan(clientId);

    if (!isSpectator && activeBan) {
      send(ws, { type: "kicked", reason: formatBanReason(activeBan) });
      ws.close(4003, "banned");
      return;
    }

    ws.id = id;
    ws.clientId = clientId;
    ws.roomName = roomName;
    ws.isSpectator = isSpectator;
    ws.connectedAt = Date.now();
    if (!isSpectator && room.players.size >= LIMITS.maxPlayersPerRoom) {
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
      arena: buildArenaState(room),
      players: Array.from(room.players.values())
    });

    ws.on("message", (raw) => handleMessage(ws, room, raw));
    ws.on("close", () => handleClose(ws, room, roomName, id));
  });
}

function handleClose(ws, room, roomName, id) {
  room.clients.delete(ws);
  room.players.delete(id);
  const removedItemIds = removeOwnerItems(room, { playerId: id, clientId: ws.clientId });
  removePlayerVotes(room, id);
  if (removedItemIds.length) {
    broadcast(room, { type: "removeItems", ids: removedItemIds }, ws);
  }
  broadcast(room, { type: "playerLeave", id }, ws);
  broadcast(room, { type: "ranking", ranking: buildRanking(room) }, ws);
  broadcast(room, { type: "arenaState", state: buildArenaState(room) }, ws);
  removeRoomIfEmpty(roomName);
  notifyAdminState();
}

function handleMessage(ws, room, raw) {
  if (ws.isSpectator) return;

  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }

  switch (message.type) {
    case "hello": return handleHello(ws, room, message);
    case "playerUpdate": return handlePlayerUpdate(ws, room, message);
    case "stroke": return handleStroke(ws, room, message);
    case "clearLayer": return handleClearLayer(ws, room, message);
    case "deleteStrokes": return handleDeleteStrokes(ws, room, message);
    case "chat": return handleChat(ws, room, message);
    case "itemAdd": return handleItemAdd(ws, room, message);
    case "radioPlay": return handleRadioPlay(ws, room, message);
    case "radioStop": return handleRadioStop(room, message);
    case "vote": return handleVote(ws, room, message);
    case "arenaAction": return handleArenaAction(ws, room, message);
    case "arenaRole": return handleArenaRole(ws, room, message);
    default: return undefined;
  }
}

function handleClearLayer(ws, room, message) {
  const layerId = safeLayerId(message.layerId);
  room.strokes = room.strokes.filter((stroke) => stroke.author !== ws.id || (stroke.layerId || "layer-1") !== layerId);
  broadcast(room, { type: "clearLayer", layerId, author: ws.id }, undefined);
  notifyAdminState();
}

function handleDeleteStrokes(ws, room, message) {
  const deletedIds = deleteOwnStrokeIds(room, ws.id, message.ids);
  if (!deletedIds.length) return;
  broadcast(room, { type: "deleteStrokes", ids: deletedIds }, ws);
  notifyAdminState();
}

function handleHello(ws, room, message) {
  const player = normalizePlayer(message.player || {}, ws.id);
  setupArenaPlayer(room, player, message.player?.role);
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
  send(ws, { type: "playerUpdate", player });
  broadcast(room, { type: "playerJoin", player }, ws);
  send(ws, { type: "arenaState", state: buildArenaState(room) });
  broadcast(room, { type: "ranking", ranking: buildRanking(room) }, undefined);
  notifyAdminState();
}

function handlePlayerUpdate(ws, room, message) {
  const existing = room.players.get(ws.id);
  if (!existing) return;
  const player = normalizePlayer({ ...existing, ...message.player }, ws.id);
  preserveArenaFields(player, existing);
  player.clientId = existing.clientId || ws.clientId;
  player.connectedAt = existing.connectedAt || ws.connectedAt;
  player.updatedAt = Date.now();
  room.players.set(ws.id, player);
  broadcast(room, { type: "playerUpdate", player }, ws);
  notifyAdminState();
}

function handleVote(ws, room, message) {
  const result = applyVote(room, {
    voterId: ws.id,
    targetId: typeof message.target === "string" ? message.target : "",
    value: message.value
  });
  if (!result.ok) {
    send(ws, { type: "voteResult", message: result.reason });
    return;
  }
  broadcast(room, { type: "ranking", ranking: result.ranking }, undefined);
  if (result.feedback) broadcast(room, { type: "voteFeedback", feedback: result.feedback }, undefined);
  if (result.clearedTarget) broadcast(room, { type: "clearPlayerStrokes", target: result.clearedTarget }, undefined);
  notifyAdminState();
}

function handleStroke(ws, room, message) {
  const stroke = normalizeStroke(message.stroke, ws.id);
  if (!stroke) return;
  room.strokes.push(stroke);
  if (room.strokes.length > LIMITS.maxStrokesPerRoom) {
    room.strokes.splice(0, room.strokes.length - LIMITS.maxStrokesPerRoom);
  }
  broadcast(room, { type: "stroke", stroke }, ws);
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

function safeClientId(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
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
