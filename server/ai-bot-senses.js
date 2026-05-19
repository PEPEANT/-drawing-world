const { buildFeaturedTop } = require("./featured");

const WORLD = { width: 3200, height: 2200 };

function collectAiBotSenses(room, bot) {
  if (!room || !bot) return [];
  const senses = [
    seeBotMention(room, bot),
    seeRecentArt(room),
    seeTopChanges(room),
    seeRoomCrowd(room, bot),
    seePatrolSpace()
  ].filter(Boolean);
  return senses.sort((a, b) => b.interest - a.interest || a.label.localeCompare(b.label, "ko"));
}

function seeBotMention(room, bot) {
  const message = [...room.messages].reverse().find((entry) => entry?.author !== bot.id && entry?.text);
  if (!message) return null;
  const text = String(message.text);
  if (!/ai봇|AI봇|봇아|봇/i.test(text)) return null;
  const speaker = room.players.get(message.author);
  return {
    key: `chat:${message.author || "unknown"}`,
    type: "chat",
    label: "AI봇 호출 감지",
    intent: "대화 대상 접근",
    interest: 100,
    reason: `${message.name || "플레이어"}가 AI봇을 부름`,
    point: speaker ? { x: speaker.x, y: speaker.y } : { x: bot.x, y: bot.y }
  };
}

function seeRecentArt(room) {
  const strokes = room.strokes.slice(-14);
  const points = strokes.flatMap((stroke) => stroke.points || []).slice(-220);
  if (!points.length) return null;
  return {
    key: "art:recent",
    type: "recent_art",
    label: "최근 그림 감지",
    intent: "그림 관측",
    interest: 80 + Math.min(16, strokes.length * 2),
    reason: `최근 선 ${strokes.length}개`,
    point: averagePoints(points)
  };
}

function seeTopChanges(room) {
  const featured = buildFeaturedTop(room);
  if (!featured.length) return null;
  const likes = featured.reduce((total, entry) => total + (Number(entry.likes) || 0), 0);
  return {
    key: "top:screens",
    type: "top",
    label: "TOP 변화 감지",
    intent: "TOP 관측",
    interest: 70 + Math.min(24, likes * 4) + featured.length * 4,
    reason: `TOP 후보 ${featured.length}개 · 좋아요 ${likes}개`,
    point: { x: WORLD.width / 2, y: 120 }
  };
}

function seeRoomCrowd(room, bot) {
  const humans = Array.from(room.players.values()).filter((player) => !player.isBot);
  if (!humans.length) return null;
  const center = averagePoints(humans);
  const nearest = Math.min(...humans.map((player) => Math.hypot(player.x - bot.x, player.y - bot.y)));
  return {
    key: "human:cluster",
    type: "human",
    label: humans.length > 1 ? "플레이어 밀집 감지" : "근처 플레이어 감지",
    intent: "플레이어 관측",
    interest: 30 + Math.min(24, humans.length * 8) - (nearest < 160 ? 18 : 0),
    reason: humans.length > 1 ? `플레이어 ${humans.length}명` : "플레이어 1명",
    point: center
  };
}

function seePatrolSpace() {
  return {
    key: "patrol:empty",
    type: "patrol",
    label: "빈 순찰 지점",
    intent: "순찰",
    interest: 10,
    reason: "큰 신호 없음",
    point: { x: WORLD.width / 2, y: WORLD.height / 2 }
  };
}

function averagePoints(points) {
  const safe = points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (!safe.length) return { x: WORLD.width / 2, y: WORLD.height / 2 };
  const sum = safe.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / safe.length, y: sum.y / safe.length };
}

module.exports = { collectAiBotSenses };
