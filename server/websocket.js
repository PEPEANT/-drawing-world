const crypto = require("node:crypto");
const { WebSocketServer } = require("ws");
const { recordPlayerSession } = require("./analytics");
const { notifyAdminState } = require("./admin");
const { LIMITS } = require("./config");
const { broadcast, send } = require("./protocol");
const { getRoom, removeRoomIfEmpty } = require("./rooms");
const {
  normalizeItem,
  normalizePlayer,
  normalizeStroke,
  safeLayerId,
  safeText,
  sanitizeRoomName
} = require("./validation");

function attachGameSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== "/ws") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const roomName = sanitizeRoomName(url.searchParams.get("room"));
    const room = getRoom(roomName);
    const id = crypto.randomUUID();
    const isSpectator = url.searchParams.get("spectator") === "1";

    ws.id = id;
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
      players: Array.from(room.players.values())
    });

    ws.on("message", (raw) => handleMessage(ws, room, raw));
    ws.on("close", () => handleClose(ws, room, roomName, id));
  });
}

function handleClose(ws, room, roomName, id) {
  room.clients.delete(ws);
  room.players.delete(id);
  broadcast(room, { type: "playerLeave", id }, ws);
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

  if (message.type === "hello") {
    handleHello(ws, room, message);
    return;
  }

  if (message.type === "playerUpdate") {
    handlePlayerUpdate(ws, room, message);
    return;
  }

  if (message.type === "stroke") {
    handleStroke(ws, room, message);
    return;
  }

  if (message.type === "clearLayer") {
    handleClearLayer(room, message);
    return;
  }

  if (message.type === "chat") {
    handleChat(ws, room, message);
    return;
  }

  if (message.type === "itemAdd") {
    handleItemAdd(ws, room, message);
    return;
  }

  if (message.type === "radioPlay") {
    handleRadioPlay(ws, room, message);
    return;
  }

  if (message.type === "radioStop") {
    handleRadioStop(room, message);
  }
}

function handleClearLayer(room, message) {
  const layerId = safeLayerId(message.layerId);
  room.strokes = room.strokes.filter((stroke) => (stroke.layerId || "layer-1") !== layerId);
  broadcast(room, { type: "clearLayer", layerId }, undefined);
  notifyAdminState();
}

function handleHello(ws, room, message) {
  const player = normalizePlayer(message.player || {}, ws.id);
  ws.clientId = safeClientId(message.player?.clientId);
  recordPlayerSession({ clientId: ws.clientId || ws.id, room: ws.roomName, at: ws.connectedAt });
  player.connectedAt = ws.connectedAt;
  player.updatedAt = Date.now();
  room.players.set(ws.id, player);
  broadcast(room, { type: "playerJoin", player }, ws);
  notifyAdminState();
}

function handlePlayerUpdate(ws, room, message) {
  const existing = room.players.get(ws.id);
  if (!existing) return;
  const player = normalizePlayer({ ...existing, ...message.player }, ws.id);
  player.connectedAt = existing.connectedAt || ws.connectedAt;
  player.updatedAt = Date.now();
  room.players.set(ws.id, player);
  broadcast(room, { type: "playerUpdate", player }, ws);
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

function handleRadioPlay(ws, room, message) {
  if (typeof message.id !== "string") return;
  clearExpiredRadio(room);
  if (room.radio) {
    send(ws, { type: "radioBusy", id: room.radio.id });
    return;
  }
  const item = room.items.find((entry) => entry.id === message.id && entry.type === "radio");
  if (!item) return;
  room.radio = { id: item.id, by: ws.id, startedAt: Date.now() };
  broadcast(room, { type: "radioPlay", id: item.id, by: ws.id }, ws);
}

function handleRadioStop(room, message) {
  if (typeof message.id !== "string") return;
  if (room.radio?.id === message.id) {
    room.radio = null;
    broadcast(room, { type: "radioStop", id: message.id }, undefined);
  }
}

function clearExpiredRadio(room) {
  if (room.radio && Date.now() - room.radio.startedAt > LIMITS.radioLockMs) {
    room.radio = null;
  }
}

function safeClientId(value) {
  if (typeof value !== "string") return "";
  const clean = value.replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
  return clean;
}

function handleChat(ws, room, message) {
  const player = room.players.get(ws.id);
  const text = safeText(message.text, LIMITS.maxChatLength);
  if (!player || !text) return;
  broadcast(room, {
    type: "chat",
    message: {
      id: crypto.randomUUID(),
      author: ws.id,
      name: player.name,
      color: player.color,
      text,
      at: Date.now()
    }
  }, undefined);
}

module.exports = {
  attachGameSocket
};
