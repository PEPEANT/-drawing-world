import { DEFAULT_ROOM } from "../config.js";

const ROOM_REFRESH_MS = 5000;

export function initRoomList(ui) {
  refreshRoomCard(ui);
  window.setInterval(() => refreshRoomCard(ui), ROOM_REFRESH_MS);
}

async function refreshRoomCard(ui) {
  try {
    const response = await fetch("/api/rooms", { cache: "no-store" });
    const payload = await response.json();
    const room = payload.rooms?.find((item) => item.slug === DEFAULT_ROOM);
    updateRoomCard(ui, room);
  } catch {
    updateRoomCard(ui, null);
  }
}

function updateRoomCard(ui, room) {
  const players = room?.players ?? 0;
  const bots = room?.bots ?? 0;
  const maxPlayers = room?.maxPlayers ?? 50;
  ui.lobbyRoomCount.textContent = `${players}/${maxPlayers}${bots ? ` · AI ${bots}` : ""}`;
  ui.lobbyRoomStatus.textContent = room ? "온라인" : "오프라인 가능";
  ui.lobbyRoomCard.disabled = players >= maxPlayers;
  ui.lobbyRoomCard.classList.toggle("is-full", players >= maxPlayers);
}
