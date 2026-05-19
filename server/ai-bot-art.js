const crypto = require("node:crypto");
const { LIMITS } = require("./config");
const { broadcast } = require("./protocol");
const { recordAiEvent, setAiState } = require("./ai-bot-state");

const WORLD = { width: 3200, height: 2200 };
const AUTHOR_TYPE = "bot";
const SOURCE = "admin_manual";

function planAiArtwork(room, bot, options = {}) {
  if (!room || !bot) {
    return { ok: false, reason: "AI봇을 먼저 생성해야 해.", artwork: null, bot };
  }

  const topic = normalizeTopic(options.topic);
  const style = normalizeStyle(options.style);
  const requestedShape = normalizeShape(options.shape);
  const requestedCharacter = normalizeCharacter(options.character);
  const source = normalizeSource(options.source);
  const prompt = buildPrompt(room, bot, topic, options.prompt, requestedShape, requestedCharacter);
  const seed = buildSeed(room, bot, prompt, style, requestedShape, requestedCharacter);
  const shape = topic === "shape" ? resolveShape(requestedShape, seed) : "";
  const character = topic === "character" ? requestedCharacter : "";
  const center = normalizeCenter(options.center) || getDrawingCenter(bot, seed);
  const strokes = buildArtworkStrokes({ bot, center, prompt, style, seed, topic, shape, character, source });
  const reason = buildReason(topic, bot, shape, character);
  const artworkId = `ai-art-${seed.toString(16)}`;

  return {
    ok: true,
    reason,
    bot,
    strokes,
    artwork: {
      id: artworkId,
      title: "AI봇 작품",
      topic,
      style,
      shape,
      character,
      prompt,
      source,
      authorType: AUTHOR_TYPE,
      seed,
      reason,
      strokes: strokes.map(cloneStrokeForPreview)
    }
  };
}

function drawAiArtwork(room, bot, options = {}) {
  const plan = planAiArtwork(room, bot, options);
  if (!plan.ok) return plan;

  for (const stroke of plan.strokes) {
    stroke.order = room.strokeSeq = (room.strokeSeq || 0) + 1;
    room.strokes.push(stroke);
    if (room.strokes.length > LIMITS.maxStrokesPerRoom) {
      room.strokes.splice(0, room.strokes.length - LIMITS.maxStrokesPerRoom);
    }
    broadcast(room, { type: "stroke", stroke }, undefined);
  }

  const speech = "그려봤어.";
  setAiState(bot, {
    mode: "observing",
    intent: "AI 그림 생성",
    target: "AI봇 작품",
    score: 100,
    reason: plan.reason,
    speech
  }, room.name, { type: "draw", detail: `${plan.artwork.prompt} · ${plan.artwork.style}` });
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);

  return {
    ok: true,
    reason: plan.reason,
    bot,
    artwork: plan.artwork
  };
}

function buildArtworkStrokes({ bot, center, prompt, style, seed, topic, shape, character, source }) {
  const palette = getPalette(style, seed);
  const points = buildTemplatePoints(topic, center, seed, shape, character);
  return points.map((entry, index) => ({
    id: `ai-art-${seed}-${index}`,
    author: bot.id,
    owner: bot.clientId || bot.id,
    name: "AI봇",
    color: entry.color || palette[index % palette.length],
    layerId: "ai-art",
    size: entry.size || getSize(style, index),
    tool: "brush",
    brush: getBrush(style, index),
    points: entry.points.map((point) => ({
      x: clamp(point.x, 0, WORLD.width),
      y: clamp(point.y, 0, WORLD.height),
      pressure: point.pressure ?? 0.55
    })),
    order: 0,
    isBotArtwork: true,
    authorType: AUTHOR_TYPE,
    source,
    prompt,
    shape: topic === "shape" ? shape : "",
    character: topic === "character" ? character : ""
  }));
}

function buildTemplatePoints(topic, center, seed, shape, character) {
  if (topic === "shape") return buildShapePattern(center, seed, shape);
  if (topic === "character") return buildCharacterPattern(center, seed, character);
  if (topic === "top") return buildStarPattern(center, seed);
  if (topic === "custom") return buildSymbolPattern(center, seed);
  return buildMemoryPattern(center, seed);
}

function buildMemoryPattern(center, seed) {
  return [
    { size: 11, color: "#2563eb", points: wave(center.x - 190, center.y + 10, 380, 38, 18, seed) },
    { size: 7, color: "#0ea5e9", points: arc(center.x, center.y, 108, -0.2, Math.PI * 1.25, 34) },
    { size: 5, color: "#f472b6", points: ring(center.x + 12, center.y - 12, 52, 30) },
    { size: 13, color: "#f59e0b", points: dotCloud(center.x - 82, center.y - 70, 42, 12, seed + 9) }
  ];
}

function buildStarPattern(center, seed) {
  const star = [];
  for (let i = 0; i <= 10; i += 1) {
    const radius = i % 2 === 0 ? 105 : 42;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    star.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, pressure: 0.6 });
  }
  return [
    { size: 9, color: "#f59e0b", points: star },
    { size: 6, color: "#8b5cf6", points: wave(center.x - 180, center.y + 130, 360, 26, 22, seed) },
    { size: 8, color: "#22d3ee", points: ring(center.x + 125, center.y - 80, 34, 22) },
    { size: 5, color: "#10b981", points: dotCloud(center.x - 132, center.y - 86, 46, 10, seed + 13) }
  ];
}

function buildSymbolPattern(center, seed) {
  return [
    { size: 10, color: "#111827", points: spiral(center.x, center.y, 9, 92, 64) },
    { size: 6, color: "#ef4444", points: arc(center.x - 90, center.y - 54, 62, 0.2, Math.PI * 1.6, 26) },
    { size: 6, color: "#2563eb", points: arc(center.x + 92, center.y - 52, 62, Math.PI * 1.4, Math.PI * 3, 26) },
    { size: 12, color: "#22c55e", points: wave(center.x - 170, center.y + 116, 340, 18, 18, seed + 21) }
  ];
}

function buildShapePattern(center, seed, shape) {
  const name = resolveShape(shape, seed);
  const accent = wave(center.x - 130, center.y + 128, 260, 18, 14, seed + 31);
  const map = {
    circle: [
      { size: 10, color: "#2563eb", points: ring(center.x, center.y, 92, 42) },
      { size: 6, color: "#f472b6", points: ring(center.x + 8, center.y - 8, 44, 26) },
      { size: 7, color: "#f59e0b", points: accent }
    ],
    square: [
      { size: 10, color: "#111827", points: polygon(center.x, center.y, 4, 96, Math.PI / 4) },
      { size: 6, color: "#22d3ee", points: polygon(center.x, center.y, 4, 52, Math.PI / 4) },
      { size: 8, color: "#f97316", points: accent }
    ],
    triangle: [
      { size: 10, color: "#10b981", points: polygon(center.x, center.y + 8, 3, 112, -Math.PI / 2) },
      { size: 6, color: "#8b5cf6", points: polygon(center.x, center.y + 6, 3, 58, -Math.PI / 2) },
      { size: 7, color: "#2563eb", points: accent }
    ],
    star: buildStarPattern(center, seed).slice(0, 3)
  };
  return map[name] || map.circle;
}

function buildCharacterPattern(center, seed, character) {
  const headY = center.y - 62;
  const bodyY = center.y + 54;
  if (character === "bot") {
    return [
      { size: 9, color: "#334155", points: polygon(center.x, headY, 4, 58, Math.PI / 4) },
      { size: 8, color: "#38bdf8", points: polygon(center.x, bodyY, 4, 76, Math.PI / 4) },
      { size: 8, color: "#0f172a", points: line(center.x - 60, bodyY - 10, center.x - 120, bodyY + 44, 10) },
      { size: 8, color: "#0f172a", points: line(center.x + 60, bodyY - 10, center.x + 120, bodyY + 44, 10) },
      { size: 10, color: "#f59e0b", points: line(center.x, headY - 58, center.x, headY - 96, 8) },
      { size: 7, color: "#2563eb", points: dotCloud(center.x - 22, headY - 4, 2, 1, seed) },
      { size: 7, color: "#2563eb", points: dotCloud(center.x + 22, headY - 4, 2, 1, seed + 3) }
    ];
  }
  if (character === "sleepy") {
    return [
      { size: 9, color: "#64748b", points: ring(center.x, headY, 58, 34) },
      { size: 7, color: "#94a3b8", points: arc(center.x - 22, headY - 6, 13, 0.2, Math.PI - 0.2, 8) },
      { size: 7, color: "#94a3b8", points: arc(center.x + 22, headY - 6, 13, 0.2, Math.PI - 0.2, 8) },
      { size: 12, color: "#a78bfa", points: arc(center.x, bodyY + 14, 95, Math.PI * 1.05, Math.PI * 1.95, 28) },
      { size: 7, color: "#f59e0b", points: line(center.x + 84, headY - 66, center.x + 132, headY - 96, 8) },
      { size: 7, color: "#f59e0b", points: line(center.x + 118, headY - 96, center.x + 84, headY - 96, 6) }
    ];
  }
  return [
    { size: 10, color: "#111827", points: ring(center.x, headY, 62, 34) },
    { size: 8, color: "#2563eb", points: arc(center.x, bodyY, 86, Math.PI * 1.12, Math.PI * 1.88, 28) },
    { size: 7, color: "#ef4444", points: arc(center.x, headY + 16, 28, 0.15, Math.PI - 0.15, 12) },
    { size: 8, color: "#22c55e", points: line(center.x - 70, bodyY - 8, center.x - 126, bodyY + 48, 10) },
    { size: 8, color: "#22c55e", points: line(center.x + 70, bodyY - 8, center.x + 126, bodyY + 48, 10) },
    { size: 7, color: "#f59e0b", points: wave(center.x - 110, headY - 64, 220, 20, 16, seed + 71) }
  ];
}

function polygon(cx, cy, sides, radius, rotation = 0) {
  return Array.from({ length: sides + 1 }, (_, index) => {
    const angle = rotation + (index % sides) * Math.PI * 2 / sides;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, pressure: 0.58 };
  });
}

function line(x1, y1, x2, y2, count = 2) {
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1);
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, pressure: 0.55 };
  });
}

function wave(x, y, width, height, count, seed) {
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1);
    return {
      x: x + width * t,
      y: y + Math.sin(t * Math.PI * 2 + random(seed) * 2) * height,
      pressure: 0.45 + 0.25 * Math.sin(t * Math.PI)
    };
  });
}

function arc(cx, cy, radius, start, end, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1);
    const angle = start + (end - start) * t;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, pressure: 0.55 };
  });
}

function ring(cx, cy, radius, count) {
  return arc(cx, cy, radius, 0, Math.PI * 2, count + 1);
}

function spiral(cx, cy, turns, maxRadius, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1);
    const angle = t * Math.PI * 2 * turns;
    const radius = maxRadius * t;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, pressure: 0.38 + t * 0.38 };
  });
}

function dotCloud(cx, cy, radius, count, seed) {
  return Array.from({ length: count }, (_, index) => {
    const angle = random(seed + index * 11) * Math.PI * 2;
    const distance = Math.sqrt(random(seed + index * 17)) * radius;
    return { x: cx + Math.cos(angle) * distance, y: cy + Math.sin(angle) * distance, pressure: 0.6 };
  });
}

function getPalette(style, seed) {
  if (style === "pixel") return ["#111827", "#22d3ee", "#f472b6", "#facc15"];
  if (style === "doodle") return ["#ef4444", "#2563eb", "#22c55e", "#111827"];
  return random(seed) > 0.5 ? ["#2563eb", "#0ea5e9", "#f472b6", "#f59e0b"] : ["#111827", "#22c55e", "#8b5cf6", "#f97316"];
}

function getBrush(style, index) {
  if (style === "pixel") return "square";
  if (style === "doodle" && index % 3 === 1) return "marker";
  return "round";
}

function getSize(style, index) {
  if (style === "pixel") return index % 2 ? 8 : 12;
  if (style === "doodle") return index % 2 ? 7 : 11;
  return index % 2 ? 6 : 10;
}

function getDrawingCenter(bot, seed) {
  const x = Number(bot?.x) || WORLD.width / 2;
  const y = Number(bot?.y) || WORLD.height / 2;
  return {
    x: clamp(x + (random(seed) - 0.5) * 420, 360, WORLD.width - 360),
    y: clamp(y + (random(seed + 7) - 0.5) * 320, 420, WORLD.height - 320)
  };
}

function buildPrompt(room, bot, topic, customPrompt, shape, character) {
  if (topic === "custom" && typeof customPrompt === "string" && customPrompt.trim()) {
    return customPrompt.replace(/\s+/g, " ").trim().slice(0, 80);
  }
  if (topic === "shape") {
    return `도형 연습: ${getShapeLabel(shape)}`;
  }
  if (topic === "character") {
    return `캐릭터 연습: ${getCharacterLabel(character)}`;
  }
  if (topic === "top") {
    const top = room.featured?.top?.[0] || room.featured?.candidates?.[0];
    return top?.authorName ? `TOP 그림 흐름: ${top.authorName}` : "TOP 그림 흐름";
  }
  const target = bot?.ai?.memory?.targets?.[0]?.target || bot?.ai?.target || "오늘 기억";
  return `오늘 기억: ${target}`;
}

function buildReason(topic, bot, shape, character) {
  if (topic === "top") return "TOP 그림과 좋아요 흐름을 참고한 관리자 수동 실행";
  if (topic === "custom") return "관리자가 직접 입력한 주제를 AI봇 작품으로 변환";
  if (topic === "shape") return `${getShapeLabel(shape)} 도형을 천천히 그리는 AI 그림 v0`;
  if (topic === "character") return `${getCharacterLabel(character)}를 천천히 그리는 AI 그림 v0`;
  const total = Number(bot?.ai?.memory?.total) || 0;
  return `AI봇의 오늘 관측 기억 ${total}개를 참고한 관리자 수동 실행`;
}

function normalizeTopic(value) {
  return ["memory", "top", "custom", "shape", "character"].includes(value) ? value : "memory";
}

function normalizeStyle(value) {
  return ["simple", "pixel", "doodle"].includes(value) ? value : "simple";
}

function normalizeShape(value) {
  return ["random", "circle", "square", "triangle", "star"].includes(value) ? value : "random";
}

function normalizeCharacter(value) {
  return ["basic", "bot", "sleepy"].includes(value) ? value : "basic";
}

function normalizeCenter(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(Math.round(x), 360, WORLD.width - 360),
    y: clamp(Math.round(y), 420, WORLD.height - 320)
  };
}

function normalizeSource(value) {
  return ["admin_manual", "user_click"].includes(value) ? value : SOURCE;
}

function resolveShape(value, seed) {
  if (value && value !== "random") return value;
  const shapes = ["circle", "square", "triangle", "star"];
  return shapes[Math.floor(random(seed + 43) * shapes.length) % shapes.length];
}

function getShapeLabel(shape) {
  return {
    random: "랜덤 도형",
    circle: "동그라미",
    square: "네모",
    triangle: "세모",
    star: "별"
  }[shape] || "도형";
}

function getCharacterLabel(character) {
  return {
    basic: "기본 캐릭터",
    bot: "로봇 캐릭터",
    sleepy: "잠자는 캐릭터"
  }[character] || "캐릭터";
}

function buildSeed(room, bot, prompt, style, shape = "", character = "") {
  const hash = crypto.createHash("sha1")
    .update(`${room.name}:${bot.id}:${prompt}:${style}:${shape}:${character}:${Date.now()}`)
    .digest("hex")
    .slice(0, 8);
  return parseInt(hash, 16);
}

function cloneStrokeForPreview(stroke) {
  return {
    id: stroke.id,
    color: stroke.color,
    size: stroke.size,
    brush: stroke.brush,
    points: stroke.points,
    prompt: stroke.prompt,
    shape: stroke.shape || "",
    character: stroke.character || ""
  };
}

function random(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { drawAiArtwork, planAiArtwork };
