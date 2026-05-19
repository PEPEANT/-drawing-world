const SCALE = 0.18;
const ANCHOR = { x: 0.5, y: 0.52 };

export function renderBotWorldView(dom, bot, context = {}) {
  const svg = dom.botWorldLayer;
  if (!svg || !bot) return;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const origin = {
    x: width * ANCHOR.x,
    y: height * ANCHOR.y,
    worldX: Number(bot.x) || 0,
    worldY: Number(bot.y) || 0
  };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren(
    ...buildStrokeNodes(context.world?.strokes || [], origin, width, height),
    ...buildPlayerNodes(context.world?.players || [], origin, width, height)
  );
}

export function resetBotWorldView(dom) {
  dom.botWorldLayer?.replaceChildren();
}

function buildStrokeNodes(strokes, origin, width, height) {
  return strokes.flatMap((stroke) => {
    const points = (stroke.points || []).map((point) => project(point, origin))
      .filter((point) => isLooseVisible(point, width, height));
    if (points.length < 2) return [];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute("class", stroke.isBotArtwork ? "bot-world-stroke is-ai-art" : "bot-world-stroke");
    line.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    line.setAttribute("stroke", stroke.color || "#111827");
    line.setAttribute("stroke-width", Math.max(1.2, (Number(stroke.size) || 4) * SCALE));
    return [line];
  });
}

function buildPlayerNodes(players, origin, width, height) {
  return players.flatMap((player) => {
    const point = project(player, origin);
    if (!isLooseVisible(point, width, height)) return [];
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "bot-world-player");
    group.setAttribute("transform", `translate(${point.x} ${point.y})`);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "5");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("y", "-10");
    label.setAttribute("text-anchor", "middle");
    label.textContent = String(player.name || "user").slice(0, 12);
    group.append(dot, label);
    return [group];
  });
}

function project(point, origin) {
  return {
    x: Math.round(origin.x + ((Number(point.x) || 0) - origin.worldX) * SCALE),
    y: Math.round(origin.y + ((Number(point.y) || 0) - origin.worldY) * SCALE)
  };
}

function isLooseVisible(point, width, height) {
  return point.x >= -80 && point.y >= -80 && point.x <= width + 80 && point.y <= height + 80;
}
