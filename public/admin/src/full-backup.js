import { dom } from "./dom.js";
import { sendAdmin } from "./socket.js";

export function initFullBackupPanel() {
  dom.fullBackupDownloadButton.addEventListener("click", () => {
    setFullBackupStatus("전체 백업 준비 중...");
    sendAdmin({ type: "exportFullBackup" });
  });

  dom.serverBackupButton.addEventListener("click", () => {
    setFullBackupStatus("서버 내부 백업 저장 중...");
    sendAdmin({ type: "saveServerFullBackup" });
  });

  dom.fullBackupRestoreButton.addEventListener("click", () => {
    dom.fullBackupRestoreInput.click();
  });

  dom.fullBackupRestoreInput.addEventListener("change", restoreFullBackupFile);
}

export function renderFullBackupStatus(status) {
  const latest = status?.latest;
  if (!latest) {
    setFullBackupStatus("서버 내부 자동 백업이 아직 없어. 다운로드 백업을 먼저 받아두는 게 좋아.");
    return;
  }
  setFullBackupStatus(`서버 내부 자동 백업 ${formatTime(latest.savedAt)} · ${status.count || 0}개 보관`);
}

export function downloadFullBackup(backup) {
  if (backup?.kind !== "drawing-world-full-backup") {
    setFullBackupStatus("전체 백업을 만들지 못했어.");
    return;
  }
  const day = backup.day || new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `drawing-world-full-backup-${day}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  setFullBackupStatus(buildSummaryText("전체 백업 다운로드 완료", backup.summary));
}

export function markServerBackupSaved(message) {
  setFullBackupStatus(`서버 내부 백업 저장됨 · ${message.fileName || "backup.json"}`);
}

export function markFullBackupRestored(result) {
  setFullBackupStatus(buildSummaryText("전체 백업 복원됨", result?.summary));
}

export function setFullBackupStatus(message) {
  dom.fullBackupStatus.textContent = message || "";
}

async function restoreFullBackupFile() {
  const file = dom.fullBackupRestoreInput.files?.[0];
  if (!file) return;
  if (!window.confirm("전체 백업을 복원할까? 현재 서버 데이터는 복원 전 안전 백업을 만든 뒤 백업 파일 내용으로 교체돼.")) {
    dom.fullBackupRestoreInput.value = "";
    return;
  }
  setFullBackupStatus("전체 백업 복원 중...");
  try {
    sendAdmin({ type: "importFullBackup", backup: JSON.parse(await file.text()) });
  } catch {
    setFullBackupStatus("JSON 파일을 읽지 못했어.");
  } finally {
    dom.fullBackupRestoreInput.value = "";
  }
}

function buildSummaryText(prefix, summary = {}) {
  return `${prefix} · AI기억 ${summary.aiMemoryRooms || 0}방, 대화 ${summary.aiConversationRooms || 0}방, 통계 ${summary.analyticsDays || 0}일, TOP ${summary.featuredArchive || 0}개, 지난그림 ${summary.dailySnapshots || 0}개`;
}

function formatTime(value) {
  const date = new Date(Number(value) || Date.now());
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
