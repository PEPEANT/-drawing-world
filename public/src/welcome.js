import { player, replaceItems, replaceStrokes, setSocketId, state } from "./state.js";
import { saveLocalStrokes } from "./storage.js";
import { addSystemMessage } from "./ui/chat.js";
import { renderRanking } from "./ui/ranking.js";

export function handleWelcome(message, send) {
  setSocketId(message.id);

  const serverStrokes = Array.isArray(message.strokes) ? message.strokes : [];
  replaceItems(message.items);
  renderRanking(message.ranking);
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
