import { dom } from "./src/dom.js";
import { initAnalyticsPanel, renderAnalytics } from "./src/analytics.js";
import { openPlayerRoom, setPreviewRoom } from "./src/preview.js";
import { renderState } from "./src/render.js";
import { connectAdmin, sendAdmin } from "./src/socket.js";

let adminKey = new URLSearchParams(location.search).get("key") || localStorage.getItem("sdw:admin-key") || "";

dom.keyInput.value = adminKey;
initAnalyticsPanel();

dom.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const key = dom.keyInput.value.trim();
  if (!key) {
    dom.authMessage.textContent = "관리자 키를 입력해줘.";
    return;
  }
  localStorage.setItem("sdw:admin-key", key);
  startAdmin(key);
});

dom.refreshButton.addEventListener("click", () => {
  sendAdmin({ type: "refresh" });
});

dom.rooms.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const room = button.dataset.room;
  if (button.dataset.action === "view") {
    setPreviewRoom(room);
    return;
  }

  if (button.dataset.action === "join") {
    openPlayerRoom(room);
    return;
  }

  if (button.dataset.action === "clear") {
    if (window.confirm(`'${room}' 방의 그림을 모두 지울까?`)) {
      sendAdmin({ type: "clearRoom", room });
    }
    return;
  }

  if (button.dataset.action === "kick") {
    const name = button.dataset.name || "플레이어";
    if (window.confirm(`${name} 님을 강퇴할까?`)) {
      sendAdmin({ type: "kick", room, id: button.dataset.id });
    }
    return;
  }

  if (button.dataset.action === "ban") {
    const name = button.dataset.name || "플레이어";
    const hours = window.prompt(`${name} 님을 몇 시간 밴할까?`, "24");
    if (hours) sendAdmin({ type: "ban", room, id: button.dataset.id, hours: Number(hours) });
    return;
  }

  if (button.dataset.action === "unban") {
    sendAdmin({ type: "unban", clientId: button.dataset.clientId });
  }
});

if (adminKey) {
  startAdmin(adminKey);
}

function startAdmin(key) {
  adminKey = key;
  dom.authMessage.textContent = "";
  setStatus("연결 중", "pending");

  connectAdmin(adminKey, {
    onOpen() {
      setStatus("관리자 연결됨", "online");
      dom.authForm.classList.add("hidden");
      dom.dashboard.classList.remove("hidden");
    },
    onClose() {
      setStatus("연결 끊김", "error");
      dom.dashboard.classList.add("hidden");
      dom.authForm.classList.remove("hidden");
    },
    onError(message) {
      dom.authMessage.textContent = message || "관리자 연결 실패";
    },
    onState(state) {
      renderState(state);
      renderAnalytics(state.analytics);
    }
  });
}

function setStatus(text, mode) {
  dom.statusText.textContent = text;
  dom.statusDot.className = `status-dot ${mode === "online" ? "online" : mode === "error" ? "error" : ""}`;
}
