const { LIMITS } = require("./config");
const { broadcast, send } = require("./protocol");

function handleRadioPlay(ws, room, message) {
  if (typeof message.id !== "string") return;
  clearExpiredRadio(room);
  clearOrphanedRadio(room);
  clearMissingRadio(room);
  const item = room.items.find((entry) => entry.id === message.id && entry.type === "radio");
  if (!item) return;
  if (room.radio && !isRadioOwner(room.radio, ws)) {
    send(ws, { type: "radioBusy", id: room.radio.id });
    return;
  }
  room.radio = { id: item.id, by: ws.id, byClient: ws.clientId || "", startedAt: Date.now() };
  broadcast(room, { type: "radioPlay", id: item.id, by: ws.id }, ws);
}

function handleRadioStop(ws, room, message) {
  if (typeof message.id !== "string") return;
  if (room.radio?.id !== message.id || !isRadioOwner(room.radio, ws)) return;
  stopRadio(room, message.id);
}

function releaseRadioOwner(room, owner) {
  if (!room.radio) return false;
  const sameClient = room.radio.byClient && room.radio.byClient === owner.clientId;
  if (room.radio.by !== owner.playerId && !sameClient) return false;
  stopRadio(room, room.radio.id);
  return true;
}

function clearExpiredRadio(room) {
  if (room.radio && Date.now() - room.radio.startedAt > LIMITS.radioLockMs) {
    stopRadio(room, room.radio.id);
  }
}

function clearOrphanedRadio(room) {
  if (!room.radio) return;
  const hasOwner = Array.from(room.clients).some((client) => isRadioOwner(room.radio, client));
  if (!hasOwner) stopRadio(room, room.radio.id);
}

function clearMissingRadio(room) {
  if (!room.radio) return;
  const itemExists = room.items.some((entry) => entry.id === room.radio.id && entry.type === "radio");
  if (!itemExists) stopRadio(room, room.radio.id);
}

function isRadioOwner(radio, ws) {
  return radio.by === ws.id || (radio.byClient && radio.byClient === ws.clientId);
}

function stopRadio(room, id) {
  room.radio = null;
  broadcast(room, { type: "radioStop", id }, undefined);
}

module.exports = {
  handleRadioPlay,
  handleRadioStop,
  releaseRadioOwner
};
