import { dom } from "./dom.js";

export function setPreviewRoom(room, options = {}) {
  const safeRoom = sanitizeRoom(room);
  const focusId = sanitizeFocus(options.focusId);
  const focusName = sanitizeLabel(options.focusName);
  const spectatorUrl = buildSpectatorUrl(safeRoom, focusId);
  const playerUrl = `/?room=${encodeURIComponent(safeRoom)}`;
  dom.previewRoom.textContent = focusName ? `room: ${safeRoom} · 관전: ${focusName}` : `room: ${safeRoom}`;
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

function sanitizeFocus(value) {
  return String(value || "").slice(0, 80);
}

function sanitizeLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 24);
}

function buildSpectatorUrl(room, focusId) {
  const params = new URLSearchParams({ room, spectator: "1" });
  if (focusId) params.set("focus", focusId);
  return `/?${params.toString()}`;
}
