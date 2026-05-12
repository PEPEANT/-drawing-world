import { ui } from "./dom.js";

const BUBBLE_LIFETIME = 5200;

export function addChatMessage(message) {
  appendChatMessage(message, true);
}

export function replaceChatMessages(messages) {
  ui.chatLog.replaceChildren();
  for (const message of Array.isArray(messages) ? messages : []) {
    appendChatMessage(message, false);
  }
  ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
}

function appendChatMessage(message, shouldScroll) {
  const row = document.createElement("div");
  row.className = "chat-message";

  const name = document.createElement("div");
  name.className = "chat-name";
  name.textContent = message.name || "guest";
  name.style.color = message.color || "#2563eb";

  const text = document.createElement("div");
  text.className = "chat-text";
  text.textContent = message.text || "";

  row.append(name, text);
  ui.chatLog.append(row);
  if (shouldScroll) {
    ui.chatLog.scrollTop = ui.chatLog.scrollHeight;
  }
}

export function addChatBubble(message) {
  if (!message.author || !message.text || message.name === "system") return;
  window.dispatchEvent(new CustomEvent("chatbubble", {
    detail: {
      author: message.author,
      text: message.text,
      expiresAt: Date.now() + BUBBLE_LIFETIME
    }
  }));
}

export function addSystemMessage(text) {
  addChatMessage({
    name: "system",
    color: "#697184",
    text,
    at: Date.now()
  });
}

export function openChat({ focus = true } = {}) {
  ui.chatPanel.classList.remove("is-closed");
  ui.chatToggle.classList.add("active");
  if (focus) {
    window.setTimeout(() => ui.chatInput.focus(), 0);
  }
}

export function closeChat() {
  ui.chatPanel.classList.add("is-closed");
  ui.chatToggle.classList.remove("active");
  ui.chatInput.blur();
}

export function toggleChat() {
  if (ui.chatPanel.classList.contains("is-closed")) {
    openChat();
    return;
  }
  closeChat();
}
