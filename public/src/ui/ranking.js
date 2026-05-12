import { CLIENT_LIMITS, PLAYER } from "../config.js";
import { getStrokeLayerId, state } from "../state.js";
import { ui } from "./dom.js";

let sendVote = () => {};

export function initRanking({ send }) {
  sendVote = send;
  ui.rankingToggle.addEventListener("click", toggleRanking);
  ui.voteLikeButton.addEventListener("click", () => submitVote(1));
  ui.voteDislikeButton.addEventListener("click", () => submitVote(-1));
  ui.voteCloseButton.addEventListener("click", closeVotePopup);
  ui.voteHint.textContent = `비추 ${CLIENT_LIMITS.downvotesBeforeClear}개 이상이면 해당 플레이어의 그림이 삭제돼.`;
  renderRanking([]);
}

export function toggleRanking() {
  const closed = ui.rankingPanel.classList.toggle("is-closed");
  ui.rankingToggle.classList.toggle("active", !closed);
}

export function renderRanking(ranking) {
  state.ranking = Array.isArray(ranking) ? ranking : [];
  ui.rankingList.replaceChildren();

  if (!state.ranking.length) {
    const empty = document.createElement("li");
    empty.innerHTML = "<span>아직 추천이 없어</span><small>0</small>";
    ui.rankingList.append(empty);
    return;
  }

  state.ranking.forEach((entry, index) => {
    const item = document.createElement("li");
    const likes = Number(entry.likes) || 0;
    const dislikes = Number(entry.dislikes) || 0;
    item.innerHTML = `
      <strong>${index + 1}</strong>
      <span>${escapeHtml(entry.name)}</span>
      <small>${likes}${dislikes ? ` / -${dislikes}` : ""}</small>
    `;
    ui.rankingList.append(item);
  });
}

export function handleVotePointer(point, event) {
  if (state.tool !== "none") return false;
  const target = findVoteTarget(point);
  if (!target) return false;
  state.voteTargetId = target.id;
  ui.voteTargetName.textContent = target.name || "플레이어";
  ui.votePopup.style.left = `${Math.min(window.innerWidth - 210, event.clientX + 12)}px`;
  ui.votePopup.style.top = `${Math.min(window.innerHeight - 86, event.clientY + 12)}px`;
  ui.votePopup.classList.remove("hidden");
  return true;
}

export function closeVotePopup() {
  state.voteTargetId = null;
  ui.votePopup.classList.add("hidden");
}

function submitVote(value) {
  if (!state.voteTargetId) return;
  sendVote({ type: "vote", target: state.voteTargetId, value });
  closeVotePopup();
}

export function findVoteTarget(point) {
  return findRemotePlayer(point) || findStrokeAuthor(point);
}

function findRemotePlayer(point) {
  let best = null;
  let bestDistance = PLAYER.voteRadius;
  for (const player of state.remotePlayers.values()) {
    const distance = Math.hypot(player.x - point.x, player.y - point.y);
    if (distance < bestDistance) {
      best = player;
      bestDistance = distance;
    }
  }
  return best;
}

function findStrokeAuthor(point) {
  const maxDistance = Math.max(10, 14 / state.camera.zoom);
  for (let i = state.strokes.length - 1; i >= 0; i -= 1) {
    const stroke = state.strokes[i];
    if (!canVoteStroke(stroke)) continue;
    if (distanceToStroke(point, stroke) <= maxDistance) {
      const player = state.remotePlayers.get(stroke.author);
      if (player) return { id: player.id, name: player.name };
    }
  }
  return null;
}

function canVoteStroke(stroke) {
  if (!stroke || stroke.tool === "eraser" || stroke.author === state.socketId) return false;
  const layer = state.layers.find((entry) => entry.id === getStrokeLayerId(stroke));
  return layer?.visible !== false;
}

function distanceToStroke(point, stroke) {
  const points = stroke.points || [];
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    best = Math.min(best, distanceToSegment(point, points[i - 1], points[i]));
  }
  return best;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return Math.hypot(point.x - x, point.y - y);
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
