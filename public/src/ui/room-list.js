import { DEFAULT_ROOM, getRoomName } from "../config.js";

const ROOM_REFRESH_MS = 5000;

export function initRoomList(ui) {
  ui.lobbyForm.dataset.room = getRoomName();
  ui.lobbyRoomList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-room]");
    if (!button || button.disabled) return;
    ui.lobbyForm.dataset.room = button.dataset.room || DEFAULT_ROOM;
    renderSelection(ui);
  });
  refreshRoomCard(ui);
  window.setInterval(() => refreshRoomCard(ui), ROOM_REFRESH_MS);
}

async function refreshRoomCard(ui) {
  try {
    const response = await fetch("/api/rooms", { cache: "no-store" });
    const payload = await response.json();
    const rooms = normalizeRooms(payload.rooms);
    renderRooms(ui, rooms);
  } catch {
    renderRooms(ui, fallbackRooms());
  }
}

function normalizeRooms(rooms) {
  const list = Array.isArray(rooms) && rooms.length ? rooms : fallbackRooms();
  return list.map((room) => ({
    slug: room.slug || DEFAULT_ROOM,
    name: room.name || room.slug || "방",
    description: room.description || "그림 월드",
    players: Number(room.players) || 0,
    bots: Number(room.bots) || 0,
    strokes: Number(room.strokes) || 0,
    maxPlayers: Number(room.maxPlayers) || 50,
    locked: room.locked === true
  }));
}

function renderRooms(ui, rooms) {
  ui.lobbyRoomList.replaceChildren();
  ensureSelectedRoom(ui, rooms);
  for (const room of rooms) {
    ui.lobbyRoomList.append(renderRoomButton(room, ui.lobbyForm.dataset.room));
  }
  renderSelection(ui);
}

function renderRoomButton(room, selectedRoom) {
  const button = document.createElement("button");
  const title = document.createElement("span");
  const name = document.createElement("strong");
  const detail = document.createElement("small");
  const count = document.createElement("span");
  const enter = document.createElement("span");

  button.type = "submit";
  button.className = "room-card";
  button.dataset.room = room.slug;
  button.disabled = room.locked || room.players >= room.maxPlayers;
  button.classList.toggle("is-full", room.players >= room.maxPlayers);
  button.classList.toggle("is-locked", room.locked);
  button.classList.toggle("active", room.slug === selectedRoom);

  name.textContent = room.name;
  detail.textContent = room.locked ? "잠긴 방" : room.description || "그림 월드";
  count.className = "room-count";
  count.textContent = `${room.players}/${room.maxPlayers}${room.bots ? ` · AI ${room.bots}` : ""}${room.strokes ? ` · 선 ${room.strokes}` : ""}`;
  enter.className = "room-enter";
  enter.textContent = room.locked ? "잠김" : "입장";

  title.append(name, detail);
  button.append(title, count, enter);
  return button;
}

function ensureSelectedRoom(ui, rooms) {
  const current = ui.lobbyForm.dataset.room || getRoomName();
  if (rooms.some((room) => room.slug === current)) return;
  ui.lobbyForm.dataset.room = getRoomName() || rooms[0]?.slug || DEFAULT_ROOM;
}

function renderSelection(ui) {
  const selected = ui.lobbyForm.dataset.room || DEFAULT_ROOM;
  for (const button of ui.lobbyRoomList.querySelectorAll("[data-room]")) {
    button.classList.toggle("active", button.dataset.room === selected);
  }
  ui.lobbyRoomStatus.textContent = selected === getRoomName() ? "선택됨" : "이동 준비";
}

function fallbackRooms() {
  return [{
    slug: DEFAULT_ROOM,
    name: "시뮬라크월드",
    description: "공용 그림 월드",
    players: 0,
    bots: 0,
    strokes: 0,
    maxPlayers: 50,
    locked: false
  }];
}
