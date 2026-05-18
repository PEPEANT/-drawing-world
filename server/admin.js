const { WebSocketServer } = require("ws");
const { buildAiState, publishAiAnnouncement } = require("./ai-observatory");
const { buildAdminState } = require("./admin-state");
const { banClient, formatBanReason, unbanClient } = require("./bans");
const { ADMIN_KEY } = require("./config");
const {
  buildFeaturedTop,
  clearFeaturedRoom,
  finalizeRoomWinners,
  removeFeaturedForTarget
} = require("./featured");
const { broadcast, send } = require("./protocol");
const { getRoom, rooms } = require("./rooms");
const { clearPlayerStrokes: clearPlayerStrokeData, deleteAdminStrokeIds } = require("./strokes");
const { safeText, sanitizeRoomName } = require("./validation");

const admins = new Set();
let notifyTimer = null;

function attachAdminSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== "/admin-ws") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.searchParams.get("key") !== ADMIN_KEY) {
      send(ws, { type: "error", message: "관리자 키가 올바르지 않습니다." });
      ws.close(1008, "invalid admin key");
      return;
    }

    admins.add(ws);
    sendAdminState(ws);

    ws.on("message", (raw) => handleAdminMessage(ws, raw));
    ws.on("close", () => {
      admins.delete(ws);
    });
  });
}

function handleAdminMessage(ws, raw) {
  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if (message.type === "refresh") {
    sendAdminState(ws);
    return;
  }

  if (message.type === "aiRefresh") {
    sendAiState(ws);
    return;
  }

  if (message.type === "aiAnnounce") {
    publishAiMessage(ws, message);
    return;
  }

  if (message.type === "kick") {
    kickPlayer(message.room, message.id);
    return;
  }

  if (message.type === "ban") {
    banPlayer(message.room, message.id, message);
    return;
  }

  if (message.type === "warn") {
    warnPlayer(message.room, message.id, message.text);
    return;
  }

  if (message.type === "clearPlayer") {
    clearPlayerStrokes(message.room, message.id);
    return;
  }

  if (message.type === "deleteStrokes") {
    deleteSelectedStrokes(message.room, message.ids);
    return;
  }

  if (message.type === "unban") {
    unbanClient(message.clientId);
    notifyAdminState();
    return;
  }

  if (message.type === "clearRoom") {
    clearRoom(message.room);
  }
}

function banPlayer(roomName, playerId, options) {
  const room = rooms.get(sanitizeRoomName(roomName));
  if (!room || typeof playerId !== "string") return;
  const durationMs = normalizeBanDuration(options);

  for (const client of room.clients) {
    if (client.id !== playerId) continue;
    const player = room.players.get(playerId);
    const ban = banClient(client.clientId || player?.clientId || playerId, {
      durationMs,
      name: player?.name,
      room: room.name
    });
    send(client, { type: "kicked", reason: formatBanReason(ban) });
    client.close(4003, "banned by admin");
    notifyAdminState();
    break;
  }
}

function deleteSelectedStrokes(roomName, ids) {
  const room = rooms.get(sanitizeRoomName(roomName));
  if (!room) return;
  const deletedIds = deleteAdminStrokeIds(room, ids);
  if (!deletedIds.length) return;
  broadcast(room, { type: "deleteStrokes", ids: deletedIds }, undefined);
  notifyAdminState();
}

function kickPlayer(roomName, playerId) {
  const room = rooms.get(sanitizeRoomName(roomName));
  if (!room || typeof playerId !== "string") return;

  for (const client of room.clients) {
    if (client.id === playerId) {
      send(client, { type: "kicked", reason: "관리자에 의해 퇴장되었습니다." });
      client.close(4001, "kicked by admin");
      break;
    }
  }
}

function warnPlayer(roomName, playerId, text) {
  const room = rooms.get(sanitizeRoomName(roomName));
  const warning = safeText(text, 160) || "운영 규칙을 지켜주세요.";
  if (!room || typeof playerId !== "string") return;

  for (const client of room.clients) {
    if (client.id === playerId) {
      send(client, { type: "adminWarning", text: warning });
      break;
    }
  }
}

function clearPlayerStrokes(roomName, playerId) {
  const room = rooms.get(sanitizeRoomName(roomName));
  if (!room || typeof playerId !== "string") return;
  const player = room.players.get(playerId);
  if (!clearPlayerStrokeData(room, playerId, player?.clientId)) return;
  removeFeaturedForTarget(room, playerId);
  broadcast(room, {
    type: "clearPlayerStrokes",
    target: { id: playerId, owner: player?.clientId || "", name: player?.name || "플레이어" },
    reason: `${player?.name || "플레이어"} 그림이 관리자에 의해 초기화됐어.`
  }, undefined);
  broadcast(room, { type: "featured", featured: buildFeaturedTop(room) }, undefined);
  notifyAdminState();
}

function clearRoom(roomName) {
  const room = getRoom(roomName);
  finalizeRoomWinners(room, "admin-clear");
  room.strokes = [];
  room.items = [];
  room.radio = null;
  room.votes = null;
  clearFeaturedRoom(room);
  broadcast(room, { type: "clear", by: "admin" }, undefined);
  broadcast(room, { type: "clearItems", by: "admin" }, undefined);
  broadcast(room, { type: "featured", featured: buildFeaturedTop(room) }, undefined);
  notifyAdminState();
}

function notifyAdminState() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    for (const admin of admins) {
      sendAdminState(admin);
    }
  }, 120);
}

function sendAdminState(ws) {
  send(ws, {
    type: "state",
    state: buildAdminState(admins.size)
  });
}

function sendAiState(ws) {
  send(ws, {
    type: "aiState",
    state: buildAiState()
  });
}

function publishAiMessage(ws, message) {
  const chatMessage = publishAiAnnouncement(message.room, message.text);
  if (!chatMessage) {
    send(ws, { type: "error", message: "AI 발표 내용을 확인하세요." });
    return;
  }
  send(ws, { type: "aiPublished", message: chatMessage });
  sendAiState(ws);
  notifyAdminState();
}

function normalizeBanDuration(options) {
  if (Number.isFinite(Number(options?.hours))) {
    return clampMinutes(Number(options.hours) * 60) * 60 * 1000;
  }
  const text = String(options?.durationText || "").trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(m|min|h|hr|d)?$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2] || "m";
  const minutes = unit.startsWith("d") ? value * 1440 : unit.startsWith("h") ? value * 60 : value;
  return clampMinutes(minutes) * 60 * 1000;
}

function clampMinutes(minutes) {
  return Math.max(1, Math.min(30 * 24 * 60, Number.isFinite(minutes) ? minutes : 1440));
}

module.exports = { attachAdminSocket, notifyAdminState };
