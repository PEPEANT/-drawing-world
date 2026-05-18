const MAX_LOBBY_SNAPSHOTS = 4;

export async function initLobbyArchive(ui) {
  if (!ui.lobbyArchiveList) return;
  renderEmptySlots(ui);
  try {
    const response = await fetch("/api/archive");
    const data = await response.json();
    renderLobbyArchive(ui, (data.snapshots || []).slice(0, MAX_LOBBY_SNAPSHOTS));
  } catch {
    renderEmptySlots(ui);
  }
}

function renderLobbyArchive(ui, snapshots) {
  ui.lobbyArchiveList.replaceChildren();
  if (!snapshots.length) {
    renderEmptySlots(ui);
    return;
  }
  ui.lobbyArchiveList.classList.remove("is-empty");
  for (let index = 0; index < MAX_LOBBY_SNAPSHOTS; index += 1) {
    const snapshot = snapshots[index];
    ui.lobbyArchiveList.append(snapshot ? createArchiveCard(snapshot) : createEmptyCard(index));
  }
}

function renderEmptySlots(ui) {
  ui.lobbyArchiveList.replaceChildren();
  ui.lobbyArchiveList.classList.add("is-empty");
  for (let index = 0; index < MAX_LOBBY_SNAPSHOTS; index += 1) {
    ui.lobbyArchiveList.append(createEmptyCard(index));
  }
}

function createEmptyCard(index) {
  const card = document.createElement("div");
  const canvas = document.createElement("canvas");
  card.className = "lobby-archive-empty-card";
  card.setAttribute("aria-label", "보존 대기 슬롯");
  canvas.width = 180;
  canvas.height = 112;
  drawEmptyPreview(canvas, index);
  card.append(canvas);
  return card;
}

function createArchiveCard(snapshot) {
  const link = document.createElement("a");
  const canvas = document.createElement("canvas");
  const text = document.createElement("span");
  link.className = "lobby-archive-card";
  link.href = `/archive#${encodeURIComponent(snapshot.id)}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  canvas.width = 180;
  canvas.height = 112;
  drawPreview(canvas, snapshot.preview);
  text.innerHTML = `
    <strong>${escapeHtml(snapshot.day || "보존 그림")}</strong>
    <small>${snapshot.strokeCount || 0}선 · ${formatReason(snapshot.reason)}</small>
  `;
  link.append(canvas, text);
  return link;
}

function drawPreview(canvas, preview) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas);
  for (const stroke of preview?.strokes || []) {
    drawStroke(ctx, stroke);
  }
}

function drawEmptyPreview(canvas, index) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas);
  ctx.strokeStyle = ["#d6dde9", "#dbe2ed", "#d2dae8", "#e0e6ef"][index % 4];
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(34 + index * 3, 74);
  ctx.bezierCurveTo(52, 52, 76, 90, 100, 60);
  ctx.bezierCurveTo(116, 42, 134, 52, 148, 36 + index * 3);
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.arc(44 + index * 6, 35, 3, 0, Math.PI * 2);
  ctx.arc(132 - index * 5, 82, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGrid(ctx, canvas) {
  ctx.strokeStyle = "#e5eaf2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= canvas.width; x += 36) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = 0; y <= canvas.height; y += 36) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}

function drawStroke(ctx, stroke) {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  if (!points.length) return;
  ctx.strokeStyle = safeColor(stroke.color);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(2, Number(stroke.size) || 4);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function formatReason(reason) {
  return reason === "daily-reset" ? "자동 보존" : "직접 보존";
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#111827";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
