const { buildFeaturedTop } = require("./featured");
const { broadcast } = require("./protocol");

const WORLD = { width: 3200, height: 2200 };
const TICK_MS = 180;
const SPEED = 78;
const STOP_DISTANCE = 18;
const OBSERVE_MS = 2200;
const controllers = new Map();

function startAiBotWalk(room, bot) {
  if (!room || !bot) return { bot: null, walking: false };
  const previous = controllers.get(room.name);
  if (previous) clearInterval(previous.timer);
  const controller = { step: previous?.step || 0, target: null, pauseUntil: 0 };
  controller.timer = setInterval(() => tick(room, bot, controller), TICK_MS);
  controller.timer.unref?.();
  controllers.set(room.name, controller);
  assignTarget(room, bot, controller);
  tick(room, bot, controller);
  return { bot, walking: true };
}

function stopAiBotWalk(room, bot) {
  const controller = room ? controllers.get(room.name) : null;
  if (controller) {
    clearInterval(controller.timer);
    controllers.delete(room.name);
  }
  if (!bot) return { bot: null, walking: false };
  bot.moving = false;
  bot.ai = { mode: "idle", intent: "대기", target: "" };
  bot.updatedAt = Date.now();
  if (room?.players.has(bot.id)) {
    broadcast(room, { type: "playerUpdate", player: bot }, undefined);
  }
  return { bot, walking: false };
}

function tick(room, bot, controller) {
  const now = Date.now();
  if (!room.players.has(bot.id)) return stopAiBotWalk(room, bot);
  if (controller.pauseUntil > now) return;
  if (!controller.target) assignTarget(room, bot, controller);

  const dx = controller.target.x - bot.x;
  const dy = controller.target.y - bot.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= STOP_DISTANCE) {
    bot.x = controller.target.x;
    bot.y = controller.target.y;
    bot.moving = false;
    bot.ai = { mode: "observing", intent: controller.target.intent, target: controller.target.label };
    bot.updatedAt = now;
    controller.target = null;
    controller.pauseUntil = now + OBSERVE_MS;
    broadcast(room, { type: "playerUpdate", player: bot }, undefined);
    return;
  }

  const step = Math.min(distance, SPEED * (TICK_MS / 1000));
  bot.x = clamp(bot.x + (dx / distance) * step, 0, WORLD.width);
  bot.y = clamp(bot.y + (dy / distance) * step, 0, WORLD.height);
  bot.facing = dx < -1 ? -1 : 1;
  bot.moving = true;
  bot.ai = { mode: "walking", intent: controller.target.intent, target: controller.target.label };
  bot.updatedAt = now;
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
}

function assignTarget(room, bot, controller) {
  controller.step += 1;
  controller.target = chooseTarget(room, bot, controller.step);
}

function chooseTarget(room, bot, step) {
  const recentArt = getRecentArtTarget(room);
  if (recentArt) return addOffset(recentArt, bot, "그림 관측", "최근 그림");

  const humanTarget = getHumanTarget(room, bot);
  if (humanTarget) return humanTarget;

  const topTarget = getTopScreenTarget(room, step);
  if (topTarget) return topTarget;

  return getPatrolTarget(step);
}

function getRecentArtTarget(room) {
  const strokes = room.strokes.slice(-10);
  const points = strokes.flatMap((stroke) => stroke.points || []).slice(-180);
  if (!points.length) return null;
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function getHumanTarget(room, bot) {
  const humans = Array.from(room.players.values()).filter((player) => !player.isBot);
  if (!humans.length) return null;
  const target = humans.reduce((acc, player) => ({ x: acc.x + player.x, y: acc.y + player.y }), { x: 0, y: 0 });
  target.x /= humans.length;
  target.y /= humans.length;
  const dx = bot.x - target.x || 1;
  const dy = bot.y - target.y || 1;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x: clamp(target.x + (dx / distance) * 190, 0, WORLD.width),
    y: clamp(target.y + (dy / distance) * 190, 0, WORLD.height),
    intent: "플레이어 관측",
    label: "사람 주변"
  };
}

function getTopScreenTarget(room, step) {
  if (!buildFeaturedTop(room).length) return null;
  const screens = [
    { x: WORLD.width / 2 - 480, y: 120 },
    { x: WORLD.width / 2, y: 120 },
    { x: WORLD.width / 2 + 480, y: 120 }
  ];
  return { ...screens[step % screens.length], intent: "TOP 관측", label: "상단 스크린" };
}

function getPatrolTarget(step) {
  const points = [
    { x: 900, y: 760 },
    { x: 2300, y: 760 },
    { x: 2260, y: 1580 },
    { x: 940, y: 1580 }
  ];
  return { ...points[step % points.length], intent: "빈 공간 탐색", label: "월드 순찰" };
}

function addOffset(point, bot, intent, label) {
  const dx = bot.x - point.x || 1;
  const dy = bot.y - point.y || 1;
  const distance = Math.hypot(dx, dy) || 1;
  return {
    x: clamp(point.x + (dx / distance) * 135, 0, WORLD.width),
    y: clamp(point.y + (dy / distance) * 135, 0, WORLD.height),
    intent,
    label
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { startAiBotWalk, stopAiBotWalk };
