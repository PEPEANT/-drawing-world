import { dom } from "./dom.js";

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
