const { createAiBot, getAiBot, removeAiBot } = require("./ai-bot");
const { startAiBotWalk, stopAiBotWalk } = require("./ai-bot-brain");
const { send } = require("./protocol");
const { getRoom, rooms } = require("./rooms");
const { sanitizeRoomName } = require("./validation");

function handleAiBotAdminMessage(ws, message, notifyAdminState) {
  const room = sanitizeRoomName(message.room || "lobby");
  if (message.type === "aiBotState") {
    send(ws, { type: "aiBotState", bot: getAiBot(room) });
    return true;
  }
  if (message.type === "aiBotCreate") {
    const result = createAiBot(room);
    send(ws, { type: "aiBotCreated", bot: result.bot, created: result.created });
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotWalk") {
    const result = createAiBot(room);
    const walk = startAiBotWalk(getRoom(room), result.bot);
    send(ws, { type: "aiBotWalking", bot: walk.bot, created: result.created });
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotStop") {
    const targetRoom = rooms.get(room);
    const result = stopAiBotWalk(targetRoom, getAiBot(room));
    send(ws, { type: "aiBotStopped", bot: result.bot });
    notifyAdminState();
    return true;
  }
  if (message.type === "aiBotRemove") {
    stopAiBotWalk(rooms.get(room), getAiBot(room));
    const result = removeAiBot(room);
    send(ws, { type: "aiBotRemoved", id: result.bot?.id || "", removed: result.removed });
    notifyAdminState();
    return true;
  }
  return false;
}

module.exports = { handleAiBotAdminMessage };
