const { createAnalyticsBackup, restoreAnalyticsBackup } = require("./analytics");
const { send } = require("./protocol");

function sendAnalyticsBackup(ws) {
  send(ws, { type: "analyticsBackup", backup: createAnalyticsBackup() });
}

function restoreAnalytics(ws, backup, onRestored) {
  const restored = restoreAnalyticsBackup(backup);
  if (!restored) {
    send(ws, { type: "analyticsError", message: "통계 백업 파일을 확인해줘." });
    return;
  }
  send(ws, { type: "analyticsRestored", backup: restored });
  if (typeof onRestored === "function") onRestored();
}

module.exports = {
  restoreAnalytics,
  sendAnalyticsBackup
};
