const { WebSocketServer } = require("ws");
const { publishAiMessage, sendAiState } = require("./admin-ai");
const { handleAiBotAdminMessage } = require("./admin-ai-bot");
const { restoreAnalytics, sendAnalyticsBackup } = require("./admin-analytics");
const { buildAdminState } = require("./admin-state");
const { banClient, formatBanReason, unbanClient } = require("./bans");
const { normalizeBanDuration } = require("./ban-duration");
const { ADMIN_KEY } = require("./config");
const { createDailySnapshot } = require("./daily-archive");
const { buildFeaturedTop, clearFeaturedRoom, finalizeRoomWinners, removeFeaturedForTarget } = require("./featured");
const { createFullBackup, restoreFullBackup, saveServerBackup } = require("./full-backup");
const { broadcast, send } = require("./protocol");
const { getRoom, rooms } = require("./rooms");
const { clearPlayerStrokes: clearPlayerStrokeData, deleteAdminStrokeIds } = require("./strokes");
const { safeText, sanitizeRoomName } = require("./validation");

const admins = new Set();
let notifyTimer = null;
const ADMIN_NOTIFY_DELAY_MS = 1000;

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
    publishAiMessage(ws, message, notifyAdminState);
    return;
  }

  if (handleAiBotAdminMessage(ws, message, notifyAdminState)) return;

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

  if (message.type === "saveSnapshot") {
    saveRoomSnapshot(ws, message.room);
    return;
  }

  if (message.type === "exportAnalytics") {
    sendAnalyticsBackup(ws);
    return;
  }

  if (message.type === "importAnalytics") {
    restoreAnalytics(ws, message.backup, notifyAdminState);
    return;
  }

  if (message.type === "exportFullBackup") {
    const backup = createFullBackup("manual");
    send(ws, { type: "fullBackupExported", backup });
    return;
  }

  if (message.type === "saveServerFullBackup") {
    const result = saveServerBackup("manual");
    send(ws, { type: "fullBackupSaved", fileName: result.fileName, summary: result.backup.summary });
    notifyAdminState();
    return;
  }

  if (message.type === "importFullBackup") {
    const result = restoreFullBackup(message.backup);
    send(ws, result.ok
      ? { type: "fullBackupRestored", result }
      : { type: "fullBackupError", message: result.message });
    if (result.ok) notifyAdminState();
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
  if (!room || typeof playerId !== "string" || room.players.get(playerId)?.isBot) return;
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

function saveRoomSnapshot(ws, roomName) {
  const room = rooms.get(sanitizeRoomName(roomName || "lobby"));
  if (!room) {
    send(ws, { type: "snapshotError", message: "저장할 방이 없어." });
    return;
  }
  const snapshot = createDailySnapshot(room, "admin-manual");
  if (!snapshot) {
    send(ws, { type: "snapshotError", message: "저장할 그림이 없어." });
    return;
  }
  send(ws, { type: "snapshotSaved", snapshot });
  notifyAdminState();
}

function kickPlayer(roomName, playerId) {
  const room = rooms.get(sanitizeRoomName(roomName));
  if (!room || typeof playerId !== "string" || room.players.get(playerId)?.isBot) return;

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
  if (!room || typeof playerId !== "string" || room.players.get(playerId)?.isBot) return;

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
  if (player?.isBot) return;
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
  if (!admins.size) return;
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    if (!admins.size) return;
    for (const admin of admins) {
      sendAdminState(admin);
    }
  }, ADMIN_NOTIFY_DELAY_MS);
}

function sendAdminState(ws) {
  send(ws, {
    type: "state",
    state: buildAdminState(admins.size)
  });
}

module.exports = { attachAdminSocket, notifyAdminState };
