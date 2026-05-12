import { getRoomName } from "./config.js";
import {
  addItem,
  addStroke,
  getStrokeLayerId,
  player,
  replaceItems,
  replaceStrokes,
  setSocketId,
  state
} from "./state.js";
import { saveLocalStrokes } from "./storage.js";
import { addChatBubble, addChatMessage, addSystemMessage } from "./ui/chat.js";
import { setOnline } from "./ui/hud.js";

let ws = null;
let reconnectAllowed = true;
let kickReason = "";

export function connect() {
  if (!("WebSocket" in window) || location.protocol === "file:") {
    setOnline(false);
    addSystemMessage("로컬 모드로 시작했어. 서버로 열면 같은 방의 사람들과 공유돼.");
    return;
  }

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const spectatorFlag = state.isSpectator ? "&spectator=1" : "";
  const socketUrl = `${protocol}://${location.host}/ws?room=${encodeURIComponent(getRoomName())}${spectatorFlag}`;
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
  if (state.isSpectator) return;
  if (!state.online || !ws || ws.readyState !== WebSocket.OPEN) return;
  if (!force && now - state.lastPositionSent < 80) return;
  state.lastPositionSent = now;
  send({
    type: "playerUpdate",
    player: {
      name: player.name,
      clientId: player.clientId,
      color: player.color,
      skin: player.skin,
      facing: player.facing,
      moving: player.moving,
      x: player.x,
      y: player.y
    }
  });
}

function handleSocketMessage(message) {
  if (message.type === "kicked") {
    reconnectAllowed = false;
    kickReason = message.reason || "관리자에 의해 퇴장되었습니다.";
    addSystemMessage(kickReason);
    return;
  }

  if (message.type === "welcome") {
    handleWelcome(message);
    return;
  }

  if (message.type === "playerJoin" || message.type === "playerUpdate") {
    if (message.player && message.player.id !== state.socketId) {
      state.remotePlayers.set(message.player.id, message.player);
    }
    return;
  }

  if (message.type === "playerLeave") {
    state.remotePlayers.delete(message.id);
    return;
  }

  if (message.type === "stroke" && message.stroke) {
    addStroke(message.stroke);
    saveLocalStrokes(state.strokes);
    return;
  }

  if (message.type === "clear") {
    replaceStrokes([]);
    saveLocalStrokes(state.strokes);
    return;
  }

  if (message.type === "clearLayer") {
    replaceStrokes(state.strokes.filter((stroke) => getStrokeLayerId(stroke) !== message.layerId));
    saveLocalStrokes(state.strokes);
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

function handleWelcome(message) {
  setSocketId(message.id);

  const serverStrokes = Array.isArray(message.strokes) ? message.strokes : [];
  replaceItems(message.items);
  if (serverStrokes.length > 0) {
    replaceStrokes(serverStrokes);
    saveLocalStrokes(state.strokes);
  } else if (state.strokes.length > 0) {
    for (const stroke of state.strokes.slice(-300)) {
      send({ type: "stroke", stroke: { ...stroke, author: state.socketId } });
    }
  }

  state.remotePlayers = new Map();
  for (const remotePlayer of message.players || []) {
    if (remotePlayer.id !== state.socketId) {
      state.remotePlayers.set(remotePlayer.id, remotePlayer);
    }
  }

  if (state.isSpectator) {
    addSystemMessage(`관전 모드로 '${message.room}' 방을 보고 있어.`);
    return;
  }

  send({
    type: "hello",
    player: {
      name: player.name,
      clientId: player.clientId,
      color: player.color,
      skin: player.skin,
      facing: player.facing,
      moving: player.moving,
      x: player.x,
      y: player.y
    }
  });
  addSystemMessage(`온라인 방 '${message.room}'에 들어왔어.`);
}
