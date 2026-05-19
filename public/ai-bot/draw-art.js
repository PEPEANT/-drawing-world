let activeArtwork = null;

export function setupDrawArt(dom, handlers = {}) {
  if (!dom.drawForm) return;
  const legacySubmit = typeof handlers === "function" ? handlers : null;
  const request = () => ({
    topic: dom.drawTopic?.value || "memory",
    shape: dom.drawShape?.value || "random",
    character: dom.drawCharacter?.value || "basic",
    style: dom.drawStyle?.value || "simple",
    prompt: dom.drawPrompt?.value.trim() || ""
  });
  dom.drawForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (legacySubmit) legacySubmit(request());
    else handlers.onPreview?.(request());
  });
  dom.drawButton?.addEventListener("click", () => handlers.onStart?.(request()));
  dom.drawCancelButton?.addEventListener("click", () => handlers.onCancel?.());
  setupPickerButtons(dom.drawForm, "[data-draw-topic]", dom.drawTopic, "drawTopic");
  setupPickerButtons(dom.drawForm, "[data-draw-shape]", dom.drawShape, "drawShape");
  setupPickerButtons(dom.drawForm, "[data-draw-character]", dom.drawCharacter, "drawCharacter");
  setupPickerButtons(dom.drawForm, "[data-draw-style]", dom.drawStyle, "drawStyle");
  renderDrawPlaceholder(dom);
}

export function setDrawEnabled(dom, enabled, draw = null) {
  const drawing = draw?.status === "drawing";
  if (dom.drawPreviewButton) dom.drawPreviewButton.disabled = !enabled || drawing;
  if (dom.drawButton) dom.drawButton.disabled = !enabled;
  if (dom.drawCancelButton) dom.drawCancelButton.disabled = !enabled || !drawing;
}

export function setDrawStatus(dom, text) {
  if (dom.drawStatus) dom.drawStatus.textContent = text || "대기 중";
}

export function renderDrawProgress(dom, draw) {
  if (!dom.drawProgress) return;
  if (!draw || draw.status === "idle") {
    dom.drawProgress.textContent = "미리보기 후 시작하면 AI봇이 stroke를 천천히 올려.";
    return;
  }
  const percent = Number(draw.progress) || 0;
  const stroke = Number(draw.strokeTotal) ? `${draw.strokeIndex}/${draw.strokeTotal}` : "-";
  if (activeArtwork && draw.artworkId === activeArtwork.id) {
    renderPreview(dom.drawPreview, buildProgressStrokes(activeArtwork.strokes || [], percent));
  }
  dom.drawProgress.textContent = draw.status === "drawing"
    ? `그리는 중 ${percent}% · 선 ${stroke}`
    : `${getDrawStatusLabel(draw.status)} · ${percent}%`;
}

export function renderDrawResult(dom, artwork, fallbackReason = "") {
  if (!artwork) {
    setDrawStatus(dom, fallbackReason || "생성 실패");
    return;
  }
  activeArtwork = artwork;
  setDrawStatus(dom, "월드 등록 준비 완료");
  if (dom.drawResultTitle) dom.drawResultTitle.textContent = `${artwork.title || "AI봇 작품"} · ${artwork.prompt || ""}`;
  if (dom.drawResultReason) dom.drawResultReason.textContent = artwork.reason || fallbackReason || "-";
  if (dom.drawResultSource) dom.drawResultSource.textContent = `${artwork.source || "admin_manual"} · ${artwork.style || "simple"}`;
  renderPreview(dom.drawPreview, artwork.strokes || []);
}

function renderDrawPlaceholder(dom) {
  activeArtwork = null;
  if (dom.drawResultTitle) dom.drawResultTitle.textContent = "아직 없음";
  if (dom.drawResultReason) dom.drawResultReason.textContent = "관리자가 실행하면 월드에 AI봇 작품으로 등록돼.";
  if (dom.drawResultSource) dom.drawResultSource.textContent = "admin_manual";
  renderPreview(dom.drawPreview, []);
}

function setupPickerButtons(root, selector, select, key) {
  if (!root || !select) return;
  const buttons = Array.from(root.querySelectorAll(selector));
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      select.value = button.dataset[key] || select.value;
      buttons.forEach((entry) => entry.classList.toggle("is-selected", entry === button));
    });
  });
}

function buildProgressStrokes(strokes, progress) {
  const total = strokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0);
  if (!total) return [];
  let remaining = Math.floor(total * Math.max(0, Math.min(100, progress)) / 100);
  if (progress > 0 && remaining === 0) remaining = 1;
  const partial = [];
  for (const stroke of strokes) {
    const points = stroke.points || [];
    if (remaining <= 0) break;
    const take = Math.min(points.length, remaining);
    partial.push({ ...stroke, points: points.slice(0, take) });
    remaining -= take;
  }
  return partial;
}

function getDrawStatusLabel(status) {
  return {
    drawing: "그리는 중",
    done: "완료",
    cancelled: "취소됨"
  }[status] || "대기";
}

function renderPreview(canvas, strokes) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPreviewGrid(ctx, canvas);
  if (!strokes.length) {
    ctx.fillStyle = "#64748b";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AI 그림 미리보기", canvas.width / 2, canvas.height / 2);
    return;
  }

  const bounds = getBounds(strokes);
  const scale = Math.min(
    (canvas.width - 42) / Math.max(1, bounds.maxX - bounds.minX),
    (canvas.height - 42) / Math.max(1, bounds.maxY - bounds.minY)
  );
  const dx = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2 - bounds.minX * scale;
  const dy = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2 - bounds.minY * scale;

  for (const stroke of strokes) {
    drawStroke(ctx, stroke, scale, dx, dy);
  }
}

function drawPreviewGrid(ctx, canvas) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#e5eaf2";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawStroke(ctx, stroke, scale, dx, dy) {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = stroke.color || "#111827";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1.5, (Number(stroke.size) || 6) * scale);
  ctx.lineCap = stroke.brush === "square" ? "butt" : "round";
  ctx.lineJoin = stroke.brush === "square" ? "miter" : "round";
  if (points.length === 1) {
    const point = transform(points[0], scale, dx, dy);
    ctx.beginPath();
    ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  const first = transform(points[0], scale, dx, dy);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const previous = transform(points[i - 1], scale, dx, dy);
    const point = transform(points[i], scale, dx, dy);
    ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + point.x) / 2, (previous.y + point.y) / 2);
  }
  const last = transform(points[points.length - 1], scale, dx, dy);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

function transform(point, scale, dx, dy) {
  return { x: point.x * scale + dx, y: point.y * scale + dy };
}

function getBounds(strokes) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const stroke of strokes) {
    for (const point of stroke.points || []) {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    }
  }
  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return bounds;
}
