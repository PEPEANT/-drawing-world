const { chooseScoredTarget } = require("./ai-bot-targets");
const { getAiMemorySummary, recordAiObservation } = require("./ai-bot-memory");
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
  const controller = {
    step: previous?.step || 0,
    target: null,
    pauseUntil: 0,
    visits: previous?.visits || {},
    memory: getAiMemorySummary(room.name)
  };
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
  bot.ai = { mode: "idle", intent: "대기", target: "", memory: getAiMemorySummary(room?.name) };
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
    controller.memory = recordAiObservation(room.name, bot, controller.target, now);
    bot.ai = buildAiState("observing", controller.target, controller.memory);
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
  bot.ai = buildAiState("walking", controller.target, controller.memory);
  bot.updatedAt = now;
  broadcast(room, { type: "playerUpdate", player: bot }, undefined);
}

function assignTarget(room, bot, controller) {
  controller.step += 1;
  controller.target = chooseScoredTarget(room, bot, controller);
}

function buildAiState(mode, target, memory) {
  return {
    mode,
    intent: target.intent,
    target: target.label,
    score: target.score,
    reason: target.reason,
    memory
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { startAiBotWalk, stopAiBotWalk };
