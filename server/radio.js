const { LIMITS } = require("./config");
const { broadcast, send } = require("./protocol");

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

module.exports = {
  handleRadioPlay,
  handleRadioStop
};
