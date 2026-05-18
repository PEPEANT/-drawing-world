import { dom } from "./dom.js";
import { sendAdmin } from "./socket.js";

let currentRange = "daily";
let latestAnalytics = null;

export function initAnalyticsPanel() {
  dom.clientMetricButton.addEventListener("click", () => {
    dom.analyticsPanel.classList.toggle("hidden");
    renderAnalytics(latestAnalytics);
  });

  dom.analyticsPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-analytics-range]");
    if (!button) return;
    currentRange = button.dataset.analyticsRange;
    syncTabs();
    renderAnalytics(latestAnalytics);
  });

  dom.analyticsBackupButton.addEventListener("click", () => {
    dom.analyticsStatus.textContent = "백업 준비 중...";
    sendAdmin({ type: "exportAnalytics" });
  });

  dom.analyticsRestoreButton.addEventListener("click", () => {
    dom.analyticsRestoreInput.click();
  });

  dom.analyticsRestoreInput.addEventListener("change", restoreAnalyticsFile);
}

export function renderAnalytics(analytics) {
  latestAnalytics = analytics || latestAnalytics;
  if (!latestAnalytics) return;
  dom.analyticsToday.textContent = latestAnalytics.today.sessions;
  dom.analyticsMonth.textContent = latestAnalytics.month.sessions;
  dom.analyticsYear.textContent = latestAnalytics.year.sessions;
  syncTabs();
  renderChart(latestAnalytics[currentRange] || []);
}

function renderChart(rows) {
  dom.analyticsChart.replaceChildren();
  const max = Math.max(1, ...rows.map((row) => row.sessions));
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "analytics-bar";
    item.style.setProperty("--bar-height", `${Math.max(4, (row.sessions / max) * 100)}%`);
    item.innerHTML = `
      <span class="bar-value">${row.sessions}</span>
      <span class="bar-fill"></span>
      <span class="bar-label">${row.label}</span>
    `;
    dom.analyticsChart.append(item);
  }
}

function syncTabs() {
  for (const button of dom.analyticsPanel.querySelectorAll("[data-analytics-range]")) {
    button.classList.toggle("active", button.dataset.analyticsRange === currentRange);
  }
}

export function downloadAnalyticsBackup(backup) {
  if (!backup?.analytics) return "통계 백업을 만들지 못했어.";
  const day = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `drawing-online-analytics-${day}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  return "통계 백업 JSON 저장됨";
}

export function markAnalyticsRestored(backup) {
  if (backup?.summary) renderAnalytics(backup.summary);
  return "통계 복원됨";
}

async function restoreAnalyticsFile() {
  const file = dom.analyticsRestoreInput.files?.[0];
  if (!file) return;
  dom.analyticsStatus.textContent = "통계 복원 중...";
  try {
    sendAdmin({ type: "importAnalytics", backup: JSON.parse(await file.text()) });
  } catch {
    dom.analyticsStatus.textContent = "JSON 파일을 읽지 못했어.";
  } finally {
    dom.analyticsRestoreInput.value = "";
  }
}
