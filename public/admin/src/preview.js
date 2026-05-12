import { dom } from "./dom.js";

export function setPreviewRoom(room) {
  const safeRoom = sanitizeRoom(room);
  const spectatorUrl = `/?room=${encodeURIComponent(safeRoom)}&spectator=1`;
  const playerUrl = `/?room=${encodeURIComponent(safeRoom)}`;
  dom.previewRoom.textContent = `room: ${safeRoom}`;
  dom.previewFrame.src = spectatorUrl;
  dom.previewOpen.href = spectatorUrl;
  dom.playerOpen.href = playerUrl;
}

export function openPlayerRoom(room) {
  const safeRoom = sanitizeRoom(room);
  location.href = `/?room=${encodeURIComponent(safeRoom)}`;
}

function sanitizeRoom(room) {
  return String(room || "lobby").slice(0, 32) || "lobby";
}
