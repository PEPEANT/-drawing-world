const GENERAL_COOLDOWN_MS = 12 * 1000;
const ADVICE_COOLDOWN_MS = 16 * 1000;
const DRAW_COOLDOWN_MS = 90 * 1000;
const cooldowns = new Map();

function checkAiInteractionCooldown(roomName, request) {
  const now = Date.now();
  const entries = getKeys(roomName, request);
  for (const entry of entries) {
    const lastAt = cooldowns.get(entry.key) || 0;
    const waitMs = entry.ms - (now - lastAt);
    if (waitMs > 0) {
      return {
        ok: false,
        waitMs,
        message: buildMessage(entry.kind, waitMs)
      };
    }
  }
  return { ok: true, waitMs: 0, message: "" };
}

function markAiInteractionCooldown(roomName, request) {
  const now = Date.now();
  for (const entry of getKeys(roomName, request)) {
    cooldowns.set(entry.key, now);
  }
}

function getKeys(roomName, request) {
  const room = String(roomName || "lobby");
  const user = String(request?.userId || request?.playerId || "unknown");
  const intent = String(request?.intent || "");
  const keys = [{ key: `${room}:${user}:general`, ms: GENERAL_COOLDOWN_MS, kind: "general" }];
  if (intent === "request_ai_draw") {
    keys.push({ key: `${room}:${user}:draw`, ms: DRAW_COOLDOWN_MS, kind: "draw" });
  }
  if (intent.startsWith("request_") && intent !== "request_ai_draw") {
    keys.push({ key: `${room}:${user}:advice`, ms: ADVICE_COOLDOWN_MS, kind: "advice" });
  }
  return keys;
}

function buildMessage(kind, waitMs) {
  const seconds = Math.max(1, Math.ceil(waitMs / 1000));
  if (kind === "draw") return `그림 요청은 ${seconds}초 뒤에 다시 가능해.`;
  if (kind === "advice") return `조언은 ${seconds}초 뒤에 다시 가능해.`;
  return `조금만 기다려줘. ${seconds}초 남았어.`;
}

module.exports = {
  checkAiInteractionCooldown,
  markAiInteractionCooldown
};
