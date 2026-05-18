export function renderStrokeModeration(room) {
  const panel = document.createElement("div");
  panel.className = "stroke-moderation";

  const groups = Array.isArray(room.moderationStrokes) ? room.moderationStrokes : [];
  const strokeCount = groups.reduce((total, group) => total + (group.strokeCount || 1), 0);
  panel.append(renderHeader(room, groups.length, strokeCount));
  if (!groups.length) {
    const empty = document.createElement("p");
    empty.className = "moderation-empty";
    empty.textContent = "선택 삭제할 그림 묶음이 없어.";
    panel.append(empty);
    return panel;
  }

  const list = document.createElement("div");
  list.className = "stroke-list";
  for (const group of groups) {
    list.append(renderGroupItem(group));
  }
  panel.append(list);
  return panel;
}

function renderHeader(room, groupCount, strokeCount) {
  const header = document.createElement("div");
  header.className = "stroke-moderation-head";
  header.innerHTML = `
    <div>
      <h3>그림 선택 삭제</h3>
      <span>최근 그림 묶음 ${groupCount}개 · 선 ${strokeCount}개</span>
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

function renderGroupItem(group) {
  const label = document.createElement("label");
  label.className = "stroke-item";
  const ids = Array.isArray(group.strokeIds) ? group.strokeIds : [group.id].filter(Boolean);
  label.innerHTML = `
    <input type="checkbox" data-stroke-ids="${escapeHtml(JSON.stringify(ids))}">
    ${renderGroupSvg(group)}
    <span>
      <strong>${escapeHtml(group.authorName)}</strong>
      <small>${formatGroupMeta(group)}</small>
    </span>
  `;
  return label;
}

function renderGroupSvg(group) {
  const strokes = Array.isArray(group.preview) ? group.preview : [];
  const lines = strokes.map(renderPreviewStroke).join("");
  return `
    <svg class="stroke-thumb" viewBox="0 0 180 120" aria-hidden="true">
      ${lines}
    </svg>
  `;
}

function renderPreviewStroke(stroke) {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  const color = escapeColor(stroke.color);
  const width = Math.max(2, Math.min(10, Number(stroke.size) || 4));
  if (points.length === 1) {
    const point = points[0];
    return `<circle cx="${number(point.x)}" cy="${number(point.y)}" r="${width / 2}" fill="${color}"></circle>`;
  }
  const path = points.map((point) => `${number(point.x)},${number(point.y)}`).join(" ");
  return `<polyline points="${escapeHtml(path)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
}

function formatGroupMeta(group) {
  const parts = [
    `${group.strokeCount || 1}선`,
    `${group.pointCount || 0}점`,
    `중심 ${Math.round(group.center?.x || 0)}, ${Math.round(group.center?.y || 0)}`
  ];
  if (Number.isFinite(group.playerDistance)) parts.push(`플레이어와 ${group.playerDistance}px`);
  return parts.join(" · ");
}

function number(value) {
  return Number.isFinite(value) ? Math.round(value) : 0;
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
