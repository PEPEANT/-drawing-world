const MAX_LOBBY_SNAPSHOTS = 4;

export async function initLobbyArchive(ui) {
  if (!ui.lobbyArchiveList) return;
  ui.lobbyArchiveList.textContent = "불러오는 중...";
  try {
    const response = await fetch("/api/archive");
    const data = await response.json();
    renderLobbyArchive(ui, (data.snapshots || []).slice(0, MAX_LOBBY_SNAPSHOTS));
  } catch {
    ui.lobbyArchiveList.textContent = "아직 불러오지 못했어.";
  }
}

function renderLobbyArchive(ui, snapshots) {
  ui.lobbyArchiveList.replaceChildren();
  if (!snapshots.length) {
    ui.lobbyArchiveList.textContent = "아직 보존된 그림이 없어.";
    return;
  }
  for (const snapshot of snapshots) {
    ui.lobbyArchiveList.append(createArchiveCard(snapshot));
  }
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
