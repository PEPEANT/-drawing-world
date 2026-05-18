const { buildAiState, publishAiAnnouncement } = require("./ai-observatory");
const { send } = require("./protocol");

function sendAiState(ws) {
  send(ws, {
    type: "aiState",
    state: buildAiState()
  });
}

function publishAiMessage(ws, message, onPublished) {
  const chatMessage = publishAiAnnouncement(message.room, message.text);
  if (!chatMessage) {
    send(ws, { type: "error", message: "AI 발표 내용을 확인하세요." });
    return;
  }
  send(ws, { type: "aiPublished", message: chatMessage });
  sendAiState(ws);
  if (typeof onPublished === "function") onPublished();
}

module.exports = {
  publishAiMessage,
  sendAiState
};
