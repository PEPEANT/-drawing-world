import { dom } from "./src/dom.js";
import { downloadAnalyticsBackup, initAnalyticsPanel, markAnalyticsRestored, renderAnalytics } from "./src/analytics.js";
import {
  downloadFullBackup,
  initFullBackupPanel,
  markFullBackupRestored,
  markServerBackupSaved,
  renderFullBackupStatus,
  setFullBackupStatus
} from "./src/full-backup.js";
import { downloadSnapshot } from "./src/snapshot.js";
import { openPlayerRoom, setPreviewRoom } from "./src/preview.js";
import { renderState } from "./src/render.js";
import { connectAdmin, sendAdmin } from "./src/socket.js";

let adminKey = new URLSearchParams(location.search).get("key") || localStorage.getItem("sdw:admin-key") || "";

dom.keyInput.value = adminKey;
initAnalyticsPanel();
initFullBackupPanel();

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

dom.snapshotButton.addEventListener("click", () => {
  dom.snapshotMessage.textContent = "보존 중...";
  sendAdmin({ type: "saveSnapshot", room: currentRoom() });
});

dom.roomCreateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const slug = dom.roomSlugInput.value.trim();
  const displayName = dom.roomDisplayInput.value.trim();
  const description = dom.roomDescriptionInput.value.trim();
  if (!slug && !displayName) {
    dom.roomManagerMessage.textContent = "주소 이름이나 표시 이름을 입력해줘.";
    return;
  }
  sendAdmin({ type: "createRoom", slug, displayName, description });
  dom.roomManagerMessage.textContent = "방을 만들었어.";
  dom.roomSlugInput.value = "";
  dom.roomDisplayInput.value = "";
  dom.roomDescriptionInput.value = "";
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

  if (button.dataset.action === "renameRoom") {
    const current = button.dataset.displayName || room;
    const displayName = window.prompt("새 표시 이름", current);
    if (displayName) sendAdmin({ type: "updateRoomMeta", room, displayName });
    return;
  }

  if (button.dataset.action === "toggleHidden") {
    sendAdmin({ type: "updateRoomMeta", room, hidden: button.dataset.hidden !== "true" });
    return;
  }

  if (button.dataset.action === "toggleLocked") {
    sendAdmin({ type: "updateRoomMeta", room, locked: button.dataset.locked !== "true" });
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
    const selected = Array.from(button.closest(".room")?.querySelectorAll("[data-stroke-id]:checked, [data-stroke-ids]:checked") || []);
    const ids = [...new Set(selected.flatMap(getSelectedStrokeIds))];
    if (!ids.length) return;
    if (window.confirm(`선택한 그림 묶음 ${selected.length}개, 선 ${ids.length}개를 삭제할까?`)) {
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
      renderSecurityWarning(state.security);
      renderState(state);
      renderAnalytics(state.analytics);
      renderFullBackupStatus(state.fullBackup);
    },
    onSnapshotSaved(snapshot) {
      dom.snapshotMessage.textContent = downloadSnapshot(snapshot);
    },
    onSnapshotError(message) {
      dom.snapshotMessage.textContent = message || "그림을 보존하지 못했어.";
    },
    onAnalyticsBackup(backup) {
      dom.analyticsStatus.textContent = downloadAnalyticsBackup(backup);
    },
    onAnalyticsRestored(backup) {
      dom.analyticsStatus.textContent = markAnalyticsRestored(backup);
    },
    onAnalyticsError(message) {
      dom.analyticsStatus.textContent = message || "통계를 복원하지 못했어.";
    },
    onFullBackupExported(backup) {
      downloadFullBackup(backup);
    },
    onFullBackupSaved(message) {
      markServerBackupSaved(message);
    },
    onFullBackupRestored(result) {
      markFullBackupRestored(result);
    },
    onFullBackupError(message) {
      setFullBackupStatus(message || "전체 백업을 처리하지 못했어.");
    }
  });
}

function renderSecurityWarning(security) {
  dom.securityWarning.classList.toggle("hidden", !security?.adminKeyDefault);
}

function setStatus(text, mode) {
  dom.statusText.textContent = text;
  dom.statusDot.className = `status-dot ${mode === "online" ? "online" : mode === "error" ? "error" : ""}`;
}

function getSelectedStrokeIds(input) {
  if (input.dataset.strokeId) return [input.dataset.strokeId];
  try {
    const ids = JSON.parse(input.dataset.strokeIds || "[]");
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function currentRoom() {
  return dom.previewRoom.textContent.replace(/^room:\s*/, "").trim() || "lobby";
}
