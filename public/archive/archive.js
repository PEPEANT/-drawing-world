const canvas = document.querySelector("#archiveCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const list = document.querySelector("#snapshotList");
const title = document.querySelector("#snapshotTitle");
const meta = document.querySelector("#snapshotMeta");
const fileInput = document.querySelector("#snapshotFile");
const refreshButton = document.querySelector("#refreshButton");

let activeId = "";
let currentSnapshot = null;
let canvasSize = { width: 1, height: 1 };

refreshButton.addEventListener("click", loadSnapshotList);
fileInput.addEventListener("change", loadSnapshotFile);
window.addEventListener("resize", () => drawSnapshot(currentSnapshot));

loadSnapshotList();
drawEmpty();

async function loadSnapshotList() {
  list.textContent = "불러오는 중...";
  try {
    const response = await fetch("/api/archive");
    const data = await response.json();
    renderSnapshotList(Array.isArray(data.snapshots) ? data.snapshots : []);
  } catch {
    list.textContent = "서버 보존 목록을 불러오지 못했어.";
  }
}

function renderSnapshotList(snapshots) {
  list.replaceChildren();
  if (!snapshots.length) {
    list.textContent = "아직 서버에 남은 보존 그림이 없어. JSON 파일을 불러올 수 있어.";
    return;
  }
  for (const snapshot of snapshots) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `snapshot-card ${snapshot.id === activeId ? "active" : ""}`;
    button.innerHTML = `
      <strong>${escapeHtml(snapshot.title || snapshot.day)}</strong>
      <small>${snapshot.strokeCount || 0}선 · ${formatTime(snapshot.savedAt)} · ${escapeHtml(snapshot.reason || "")}</small>
    `;
    button.addEventListener("click", () => loadServerSnapshot(snapshot.id));
    list.append(button);
  }
}

async function loadServerSnapshot(id) {
  try {
    const response = await fetch(`/api/archive/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (data.snapshot) setSnapshot(data.snapshot);
  } catch {
    meta.textContent = "그림을 불러오지 못했어.";
  }
}

async function loadSnapshotFile() {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    setSnapshot(JSON.parse(await file.text()));
  } catch {
    meta.textContent = "JSON 파일을 읽지 못했어.";
  } finally {
    fileInput.value = "";
  }
}

function setSnapshot(snapshot) {
  currentSnapshot = normalizeSnapshot(snapshot);
  activeId = currentSnapshot.id || "";
  title.textContent = currentSnapshot.title || `${currentSnapshot.day || "보존 그림"}`;
  meta.textContent = `${currentSnapshot.strokeCount}선 · ${formatTime(currentSnapshot.savedAt)} · 수정 불가`;
  drawSnapshot(currentSnapshot);
  loadSnapshotList();
}

function normalizeSnapshot(snapshot) {
  const strokes = Array.isArray(snapshot?.strokes) ? snapshot.strokes : [];
  return {
    ...snapshot,
    strokeCount: snapshot?.strokeCount || strokes.length,
    bounds: snapshot?.bounds || getBounds(strokes),
    strokes
  };
}

function drawSnapshot(snapshot) {
  resizeCanvas();
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
  drawGrid();
  if (!snapshot?.strokes?.length) {
    drawEmpty();
    return;
  }
  const view = paddedBounds(snapshot.bounds);
  const scale = Math.min(canvasSize.width / view.width, canvasSize.height / view.height);
  const dx = (canvasSize.width - view.width * scale) / 2 - view.x * scale;
  const dy = (canvasSize.height - view.height * scale) / 2 - view.y * scale;
  for (const stroke of snapshot.strokes.slice().sort((a, b) => (a.order || 0) - (b.order || 0))) {
    drawStroke(stroke, scale, dx, dy);
  }
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvasSize = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
  canvas.width = Math.floor(canvasSize.width * ratio);
  canvas.height = Math.floor(canvasSize.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawGrid() {
  ctx.strokeStyle = "#e5eaf2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= canvasSize.width; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasSize.height);
  }
  for (let y = 0; y <= canvasSize.height; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvasSize.width, y);
  }
  ctx.stroke();
}

function drawStroke(stroke, scale, dx, dy) {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  if (!points.length) return;
  ctx.strokeStyle = safeColor(stroke.color);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1, (Number(stroke.size) || 6) * scale);
  ctx.lineCap = stroke.brush === "square" ? "butt" : "round";
  ctx.lineJoin = "round";
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x * scale + dx, points[0].y * scale + dy, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x * scale + dx, points[0].y * scale + dy);
  for (const point of points.slice(1)) ctx.lineTo(point.x * scale + dx, point.y * scale + dy);
  ctx.stroke();
}

function drawEmpty() {
  resizeCanvas();
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
}

function getBounds(strokes) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke.points || []) {
      left = Math.min(left, point.x); right = Math.max(right, point.x);
      top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
    }
  }
  return Number.isFinite(left) ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

function paddedBounds(bounds) {
  const safe = bounds || { x: 0, y: 0, width: 3200, height: 2200 };
  const padding = 120;
  return {
    x: safe.x - padding,
    y: safe.y - padding,
    width: Math.max(1, safe.width + padding * 2),
    height: Math.max(1, safe.height + padding * 2)
  };
}

function formatTime(value) {
  return value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#111827";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
