import { getOwnStrokes, player, replaceItems, replaceStrokes, setSocketId, state } from "./state.js";
import { saveLocalStrokes } from "./storage.js";
import { addSystemMessage, replaceChatMessages } from "./ui/chat.js";
import { renderRanking } from "./ui/ranking.js";

export function handleWelcome(message, send) {
  setSocketId(message.id);

  const serverStrokes = Array.isArray(message.strokes) ? message.strokes : [];
  replaceItems(message.items);
  replaceChatMessages(message.messages);
  renderRanking(message.ranking);
  replaceStrokes(serverStrokes);
  saveLocalStrokes(getOwnStrokes());

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
