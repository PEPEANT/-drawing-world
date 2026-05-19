import { dom } from "./dom.js";
import { renderFeaturedArchive } from "./featured.js";
import { renderStrokeModeration } from "./moderation.js";

export function renderState(state) {
  dom.clientCount.textContent = state.clientCount;
  dom.playerCount.textContent = state.playerCount;
  dom.roomCount.textContent = state.roomCount;
  dom.adminCount.textContent = state.adminCount;
  dom.updatedAt.textContent = `마지막 갱신: ${formatTime(state.at)}`;
  dom.rooms.replaceChildren();

  const featured = renderFeaturedArchive(state.featured);
  if (featured) dom.rooms.append(featured);

  if (!state.rooms.length && !state.bans?.length && !featured) {
    dom.rooms.append(dom.emptyTemplate.content.cloneNode(true));
    return;
  }

  for (const room of state.rooms) {
    dom.rooms.append(renderRoom(room));
  }
  if (state.bans?.length) dom.rooms.append(renderBanSection(state.bans));
}

function renderRoom(room) {
  const section = document.createElement("section");
  section.className = "room";

  const header = document.createElement("div");
  header.className = "room-header";
  header.append(renderRoomTitle(room), renderRoomActions(room));
  section.append(header);

  if (!room.players.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "아직 닉네임을 등록한 플레이어가 없어.";
    section.append(empty);
  } else {
    section.append(renderPlayerTable(room));
  }

  section.append(renderStrokeModeration(room));
  return section;
}

function renderRoomTitle(room) {
  const title = document.createElement("div");
  title.className = "room-title";
  const botText = room.botCount ? ` · AI ${room.botCount}` : "";
  const badges = [
    room.hidden ? '<span class="room-badge">숨김</span>' : "",
    room.locked ? '<span class="room-badge danger">잠김</span>' : "",
    !room.configured ? '<span class="room-badge">임시</span>' : ""
  ].filter(Boolean).join("");
  title.innerHTML = `
    <h2>${escapeHtml(room.displayName || room.name)}</h2>
    ${badges}
    <span>${escapeHtml(room.name)} · 접속 ${room.clients} · 관전 ${room.viewers || 0} · 플레이어 ${room.playerCount}${botText} · 선 ${room.strokes} · 아이템 ${room.items || 0}</span>
  `;
  return title;
}

function renderRoomActions(room) {
  const actions = document.createElement("div");
  actions.className = "room-actions";
  actions.append(
    createRoomButton("view", room.name, "보기"),
    createRoomButton("join", room.name, "플레이어로 접속"),
    createRoomButton("renameRoom", room.name, "이름 변경")
  );
  if (room.name !== "lobby") {
    actions.append(
      createToggleButton("toggleHidden", room.name, room.hidden, "숨김", "공개"),
      createToggleButton("toggleLocked", room.name, room.locked, "잠금", "해제")
    );
  }
  actions.append(createRoomButton("clear", room.name, "그림 초기화"));
  actions.querySelector('[data-action="renameRoom"]').dataset.displayName = room.displayName || room.name;
  return actions;
}

function renderPlayerTable(room) {
  const table = document.createElement("table");
  table.className = "player-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>닉네임</th>
        <th>위치</th>
        <th>접속 시간</th>
        <th>최근 갱신</th>
        <th></th>
      </tr>
    </thead>
  `;

  const body = document.createElement("tbody");
  for (const player of room.players) {
    body.append(renderPlayerRow(room.name, player));
  }

  table.append(body);
  return table;
}

function renderPlayerRow(roomName, player) {
  const row = document.createElement("tr");
  if (player.isBot) row.className = "is-bot";
  row.classList.add("is-watchable");
  row.dataset.action = "watchPlayer";
  row.dataset.room = roomName;
  row.dataset.id = player.id;
  row.dataset.name = player.name || (player.isBot ? "AI봇" : "플레이어");
  row.innerHTML = `
    <td>
      <span class="player-name">
        <span class="swatch" style="background:${escapeAttribute(player.color)}"></span>
        ${escapeHtml(player.name)}
        ${player.isBot ? '<span class="bot-badge">AI</span>' : ""}
      </span>
    </td>
    <td>${Math.round(player.x)}, ${Math.round(player.y)}</td>
    <td>${formatTime(player.connectedAt)}</td>
    <td>${formatTime(player.updatedAt)}</td>
    <td></td>
  `;

  if (player.isBot) {
    const locked = document.createElement("span");
    locked.className = "bot-lock";
    locked.textContent = "클릭하면 관전";
    row.lastElementChild.append(locked);
    return row;
  }

  const kickButton = createRoomButton("kick", roomName, "강퇴");
  kickButton.className = "kick-button";
  kickButton.dataset.id = player.id;
  kickButton.dataset.name = player.name;
  const banButton = createRoomButton("ban", roomName, "밴");
  banButton.className = "ban-button";
  banButton.dataset.id = player.id;
  banButton.dataset.name = player.name;
  const warnButton = createRoomButton("warn", roomName, "경고");
  warnButton.className = "warn-button";
  warnButton.dataset.id = player.id;
  warnButton.dataset.name = player.name;
  const clearButton = createRoomButton("clearPlayer", roomName, "그림 초기화");
  clearButton.className = "clear-player-button";
  clearButton.dataset.id = player.id;
  clearButton.dataset.name = player.name;
  row.lastElementChild.append(warnButton, clearButton, kickButton, banButton);
  return row;
}

function renderBanSection(bans) {
  const section = document.createElement("section");
  section.className = "room ban-list";
  section.innerHTML = `
    <div class="room-header">
      <div class="room-title"><h2>밴 목록</h2><span>${bans.length}명</span></div>
    </div>
  `;
  const table = document.createElement("table");
  table.className = "player-table";
  table.innerHTML = "<thead><tr><th>플레이어</th><th>방</th><th>해제 시간</th><th></th></tr></thead>";
  const body = document.createElement("tbody");
  for (const ban of bans) body.append(renderBanRow(ban));
  table.append(body);
  section.append(table);
  return section;
}

function renderBanRow(ban) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${escapeHtml(ban.name)}</td>
    <td>${escapeHtml(ban.room)}</td>
    <td>${formatTime(ban.expiresAt)}</td>
    <td></td>
  `;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "unban-button";
  button.dataset.action = "unban";
  button.dataset.clientId = ban.clientId;
  button.textContent = "해제";
  row.lastElementChild.append(button);
  return row;
}

function createRoomButton(action, room, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.dataset.room = room;
  button.textContent = text;
  return button;
}

function createToggleButton(action, room, active, onText, offText) {
  const button = createRoomButton(action, room, active ? offText : onText);
  button.dataset.hidden = action === "toggleHidden" ? String(active) : "";
  button.dataset.locked = action === "toggleLocked" ? String(active) : "";
  if (active) button.classList.add("is-active");
  return button;
}

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttribute(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#2563eb";
}
