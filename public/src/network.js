import { getRoomName } from "./config.js";
import {
  addItem,
  addStroke,
  getOwnStrokes,
  getStrokeLayerId,
  isOwnStroke,
  player,
  removeItemsByIds,
  replaceItems,
  replaceStrokes,
  state
} from "./state.js";
import { removeStrokesByIds } from "./eraser.js";
import { saveLocalStrokes } from "./storage.js";
import { addChatBubble, addChatMessage, addSystemMessage } from "./ui/chat.js";
import { setOnline } from "./ui/hud.js";
import { renderRanking } from "./ui/ranking.js";
import { addFeaturedFeedback, addVoteFeedback } from "./vote-feedback.js";
import { handleWelcome } from "./welcome.js";
import { upsertRemotePlayer } from "./remote-motion.js";

let ws = null, reconnectAllowed = true;
let kickReason = "";
let lastMovePayload = "";
let lastIdentityPayload = "";

export function connect() {
  if (!("WebSocket" in window) || location.protocol === "file:") {
    setOnline(false);
    addSystemMessage("로컬 모드로 시작했어. 서버로 열면 같은 방의 사람들과 공유돼.");
    return;
  }

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const spectatorFlag = state.isSpectator ? "&spectator=1" : "";
  const clientFlag = `&clientId=${encodeURIComponent(player.clientId)}`;
  const socketUrl = `${protocol}://${location.host}/ws?room=${encodeURIComponent(getRoomName())}${clientFlag}${spectatorFlag}`;
  ws = new WebSocket(socketUrl);

  ws.addEventListener("open", () => {
    setOnline(true);
  });

  ws.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    handleSocketMessage(message);
  });

  ws.addEventListener("close", () => {
    const wasOnline = state.online;
    setOnline(false);
    state.remotePlayers.clear();
    if (!reconnectAllowed) {
      addSystemMessage(kickReason || "관리자에 의해 퇴장되었습니다.");
      return;
    }
    if (wasOnline) {
      addSystemMessage("연결이 끊겼어. 지금 그리는 건 이 브라우저에 저장돼.");
    }
    window.setTimeout(connect, 1800);
  });

  ws.addEventListener("error", () => {
    setOnline(false);
  });
}

export function send(payload) {
  if (!state.online || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

export function sendPlayerUpdate(force = false, now = performance.now()) {
  if (state.isSpectator || !state.online || !ws || ws.readyState !== WebSocket.OPEN) return;
  const payload = {
    facing: player.facing,
    moving: player.moving,
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10
  };
  const serialized = JSON.stringify(payload);
  const changed = serialized !== lastMovePayload;
  if (!force && now - state.lastPositionSent < (changed ? 80 : 1800)) return;
  state.lastPositionSent = now; lastMovePayload = serialized;
  send({ type: "playerMove", player: payload });
}

export function sendPlayerIdentity(force = false) {
  if (state.isSpectator || !state.online || !ws || ws.readyState !== WebSocket.OPEN) return;
  const payload = {
    name: player.name,
    clientId: player.clientId,
    color: player.color,
    skin: player.skin
  };
  const serialized = JSON.stringify(payload);
  if (!force && serialized === lastIdentityPayload) return;
  lastIdentityPayload = serialized;
  send({ type: "playerIdentity", player: payload });
}

function handleSocketMessage(message) {
  if (message.type === "kicked") {
    reconnectAllowed = false;
    kickReason = message.reason || "관리자에 의해 퇴장되었습니다.";
    addSystemMessage(kickReason);
    return;
  }

  if (message.type === "welcome") {
    handleWelcome(message, send);
    return;
  }

  if (
    message.type === "playerJoin" ||
    message.type === "playerUpdate" ||
    message.type === "playerMove" ||
    message.type === "playerIdentity"
  ) {
    if (message.player && message.player.id !== state.socketId) {
      upsertRemotePlayer(message.player, state.socketId);
    }
    return;
  }

  if (message.type === "playerLeave") {
    state.remotePlayers.delete(message.id);
    return;
  }

  if (message.type === "stroke" && message.stroke) {
    addStroke(message.stroke);
    if (isOwnStroke(message.stroke)) saveLocalStrokes(getOwnStrokes());
    return;
  }

  if (message.type === "claimStrokes") {
    replaceStrokes(state.strokes.map((stroke) => (
      stroke.owner === message.owner ? { ...stroke, author: message.author } : stroke
    )));
    saveLocalStrokes(getOwnStrokes());
    return;
  }

  if (message.type === "clear") {
    replaceStrokes([]);
    saveLocalStrokes(getOwnStrokes());
    return;
  }

  if (message.type === "dailyReset") {
    replaceStrokes([]);
    state.featured = Array.isArray(message.featured) ? message.featured : [];
    saveLocalStrokes(getOwnStrokes());
    addSystemMessage("Daily drawing board reset.");
    return;
  }

  if (message.type === "clearLayer") {
    replaceStrokes(state.strokes.filter((stroke) => {
      if (getStrokeLayerId(stroke) !== message.layerId) return true;
      if (message.owner) return stroke.owner !== message.owner;
      if (message.author) return stroke.author !== message.author;
      return !isOwnStroke(stroke);
    }));
    saveLocalStrokes(getOwnStrokes());
    return;
  }

  if (message.type === "deleteStrokes") {
    removeStrokesByIds(message.ids);
    saveLocalStrokes(getOwnStrokes());
    return;
  }

  if (message.type === "clearPlayerStrokes" && message.target) {
    replaceStrokes(state.strokes.filter((stroke) => (
      stroke.author !== message.target.id && (!message.target.owner || stroke.owner !== message.target.owner)
    )));
    saveLocalStrokes(getOwnStrokes());
    addSystemMessage(message.reason || `${message.target.name || "플레이어"} 그림이 삭제됐어.`);
    return;
  }

  if (message.type === "adminWarning") {
    addSystemMessage(`관리자 경고: ${message.text || "운영 규칙을 지켜줘."}`);
    return;
  }

  if (message.type === "ranking") {
    renderRanking(message.ranking);
    return;
  }

  if (message.type === "featured") {
    state.featured = Array.isArray(message.featured) ? message.featured : [];
    state.featuredUpdatedAt = Date.now();
    return;
  }

  if (message.type === "featuredFeedback") {
    addFeaturedFeedback(message.targetId, message.text);
    return;
  }

  if (message.type === "voteResult") {
    addSystemMessage(message.message || "투표를 처리하지 못했어.");
    return;
  }

  if (message.type === "voteFeedback") {
    addVoteFeedback(message.feedback);
    return;
  }

  if (message.type === "aiBotInteractResult") {
    addSystemMessage(message.message || "AI봇에게 요청을 보냈어.");
    return;
  }

  if (message.type === "itemAdd" && message.item) {
    addItem(message.item);
    return;
  }

  if (message.type === "itemRejected") {
    addSystemMessage(message.reason || "아이템을 설치할 수 없어.");
    return;
  }

  if (message.type === "clearItems") {
    replaceItems([]);
    return;
  }

  if (message.type === "removeItems") {
    for (const item of removeItemsByIds(message.ids)) {
      if (item.type === "radio") {
        window.dispatchEvent(new CustomEvent("radioStop", { detail: { id: item.id } }));
      }
    }
    return;
  }

  if (message.type === "radioPlay") {
    window.dispatchEvent(new CustomEvent("radioPlay", { detail: message }));
    return;
  }

  if (message.type === "radioBusy") {
    window.dispatchEvent(new CustomEvent("radioBusy", { detail: message }));
    return;
  }

  if (message.type === "radioStop") {
    window.dispatchEvent(new CustomEvent("radioStop", { detail: message }));
    return;
  }

  if (message.type === "chat" && message.message) {
    addChatMessage(message.message);
    addChatBubble(message.message);
  }
}
