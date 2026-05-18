const PREVIEW = { width: 240, height: 150 };
const PAPER = "#f3f4f6";

export function renderFeaturedArchive(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return null;

  const section = document.createElement("section");
  section.className = "featured-archive room";
  section.append(renderHeader(list.length));

  const grid = document.createElement("div");
  grid.className = "featured-grid";
  for (const entry of list.slice(0, 12)) {
    grid.append(renderFeaturedCard(entry));
  }
  section.append(grid);
  return section;
}

function renderHeader(count) {
  const header = document.createElement("div");
  header.className = "room-header";
  header.innerHTML = `
    <div class="room-title">
      <h2>Saved top drawings</h2>
      <span>${count} archived</span>
    </div>
  `;
  return header;
}

function renderFeaturedCard(entry) {
  const card = document.createElement("article");
  card.className = "featured-card";

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW.width;
  canvas.height = PREVIEW.height;
  drawPreview(canvas, entry);

  const meta = document.createElement("div");
  meta.className = "featured-meta";
  meta.innerHTML = `
    <strong>#${Number(entry.rank) || "-"} ${escapeHtml(entry.artistName || "player")}</strong>
    <span>${Number(entry.likes) || 0} likes · ${escapeHtml(entry.day || "")}</span>
    <small>${escapeHtml(entry.room || "lobby")}</small>
  `;

  card.append(canvas, meta);
  return card;
}

function drawPreview(canvas, entry) {
  const ctx = canvas.getContext("2d");
  const bounds = normalizeBounds(entry.bounds);
  const scale = Math.min(PREVIEW.width / bounds.width, PREVIEW.height / bounds.height);
  const dx = (PREVIEW.width - bounds.width * scale) / 2 - bounds.x * scale;
  const dy = (PREVIEW.height - bounds.height * scale) / 2 - bounds.y * scale;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PREVIEW.width, PREVIEW.height);
  for (const stroke of entry.strokes || []) {
    drawStroke(ctx, stroke, scale, dx, dy);
  }
}

function drawStroke(ctx, stroke, scale, dx, dy) {
  const points = stroke.points || [];
  if (points.length < 2) return;
  ctx.strokeStyle = stroke.tool === "eraser" ? PAPER : safeColor(stroke.color);
  ctx.lineWidth = Math.max(1, (Number(stroke.size) || 4) * scale);
  ctx.lineCap = stroke.brush === "square" ? "butt" : "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x * scale + dx, points[0].y * scale + dy);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x * scale + dx, points[i].y * scale + dy);
  }
  ctx.stroke();
}

function normalizeBounds(bounds) {
  return {
    x: Number(bounds?.x) || 0,
    y: Number(bounds?.y) || 0,
    width: Math.max(1, Number(bounds?.width) || 1),
    height: Math.max(1, Number(bounds?.height) || 1)
  };
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#111827";
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
