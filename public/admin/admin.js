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
    const durationText = window.prompt(`${name} 님 밴 시간. 예: 30m, 2h, 1d`, "24h");
    if (durationText) sendAdmin({ type: "ban", room, id: button.dataset.id, durationText });
    return;
  }

  if (button.dataset.action === "warn") {
    const name = button.dataset.name || "플레이어";
    const text = window.prompt(`${name} 님에게 보낼 경고 메시지`, "그림/채팅 이용 규칙을 지켜주세요.");
    if (text) sendAdmin({ type: "warn", room, id: button.dataset.id, text });
    return;
  }

  if (button.dataset.action === "clearPlayer") {
    const name = button.dataset.name || "플레이어";
    if (window.confirm(`${name} 님의 그림만 초기화할까?`)) {
      sendAdmin({ type: "clearPlayer", room, id: button.dataset.id });
    }
    return;
  }

  if (button.dataset.action === "deleteSelectedStrokes") {
    const selected = Array.from(button.closest(".room")?.querySelectorAll("[data-stroke-id]:checked") || []);
    const ids = selected.map((input) => input.dataset.strokeId);
    if (!ids.length) return;
    if (window.confirm(`선택한 그림 ${ids.length}개를 삭제할까?`)) {
      sendAdmin({ type: "deleteStrokes", room, ids });
    }
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
