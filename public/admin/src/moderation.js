export function renderStrokeModeration(room) {
  const panel = document.createElement("div");
  panel.className = "stroke-moderation";

  const strokes = Array.isArray(room.moderationStrokes) ? room.moderationStrokes : [];
  panel.append(renderHeader(room, strokes.length));
  if (!strokes.length) {
    const empty = document.createElement("p");
    empty.className = "moderation-empty";
    empty.textContent = "선택 삭제할 그림 선이 없어.";
    panel.append(empty);
    return panel;
  }

  const list = document.createElement("div");
  list.className = "stroke-list";
  for (const stroke of strokes) {
    list.append(renderStrokeItem(stroke));
  }
  panel.append(list);
  return panel;
}

function renderHeader(room, count) {
  const header = document.createElement("div");
  header.className = "stroke-moderation-head";
  header.innerHTML = `
    <div>
      <h3>그림 선택 삭제</h3>
      <span>최근 그림 선 ${count}개</span>
    </div>
  `;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "deleteSelectedStrokes";
  button.dataset.room = room.name;
  button.textContent = "선택 삭제";
  header.append(button);
  return header;
}

function renderStrokeItem(stroke) {
  const label = document.createElement("label");
  label.className = "stroke-item";
  label.innerHTML = `
    <input type="checkbox" data-stroke-id="${escapeHtml(stroke.id)}">
    ${renderStrokeSvg(stroke)}
    <span>
      <strong>${escapeHtml(stroke.authorName)}</strong>
      <small>${escapeHtml(stroke.brush)} · ${stroke.pointCount}점 · ${escapeHtml(stroke.layerId)}</small>
    </span>
  `;
  return label;
}

function renderStrokeSvg(stroke) {
  const points = Array.isArray(stroke.preview) ? stroke.preview : [];
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  return `
    <svg class="stroke-thumb" viewBox="0 0 72 44" aria-hidden="true">
      <polyline points="${escapeHtml(path)}" fill="none" stroke="${escapeColor(stroke.color)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
  `;
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

function escapeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#111827";
}
