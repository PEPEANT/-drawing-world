const fs = require("node:fs");
const path = require("node:path");
const { exportAiMemoryStore, restoreAiMemoryStore } = require("./ai-bot-memory");
const { clearDialogueCache } = require("./ai-bot-conversation");
const { exportConversationStore, restoreConversationStore } = require("./ai-bot-conversation-store");
const { buildAnalyticsState, exportAnalyticsData, replaceAnalyticsData } = require("./analytics");
const { exportDailyArchive, restoreDailyArchive } = require("./daily-archive");
const { exportFeaturedStore, restoreFeaturedStore } = require("./featured-store");
const { ROOT_DIR } = require("./config");

const BACKUP_VERSION = 1;
const BACKUP_KIND = "drawing-world-full-backup";
const DATA_DIR = path.join(ROOT_DIR, "data");
const BACKUP_DIR = path.join(DATA_DIR, "full-backups");
const MAX_SERVER_BACKUPS = 14;
const SWEEP_MS = 60 * 60 * 1000;

let sweepTimer = null;

function createFullBackup(reason = "manual") {
  const backup = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    day: getDayKey(),
    timezone: "Asia/Seoul",
    reason,
    data: {
      aiMemory: exportAiMemoryStore(),
      aiConversations: exportConversationStore(),
      analytics: exportAnalyticsData(),
      featured: exportFeaturedStore(),
      dailySnapshots: exportDailyArchive()
    }
  };
  backup.summary = summarizeBackup(backup);
  return backup;
}

function restoreFullBackup(backup) {
  const normalized = normalizeBackup(backup);
  if (!normalized) return { ok: false, message: "전체 백업 JSON 파일을 확인해줘." };

  const safety = saveServerBackup("before-restore");
  const result = {
    aiMemory: restoreAiMemoryStore(normalized.data.aiMemory),
    aiConversations: restoreConversationStore(normalized.data.aiConversations),
    analytics: replaceAnalyticsData(normalized.data.analytics),
    featured: restoreFeaturedStore(normalized.data.featured),
    dailySnapshots: restoreDailyArchive(normalized.data.dailySnapshots)
  };
  clearDialogueCache();
  return {
    ok: Object.values(result).some(Boolean),
    restoredAt: Date.now(),
    result,
    safetyFile: safety.fileName,
    summary: summarizeBackup(normalized)
  };
}

function saveServerBackup(reason = "auto") {
  const backup = createFullBackup(reason);
  const day = backup.day || getDayKey();
  const suffix = reason === "auto" ? day : `${day}-${Date.now()}`;
  const fileName = `drawing-world-full-${suffix}.json`;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filePath = path.join(BACKUP_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
  trimServerBackups();
  return { fileName, filePath, backup };
}

function ensureDailyServerBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const day = getDayKey();
  const fileName = `drawing-world-full-${day}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return saveServerBackup("auto");
  }
  return { fileName, filePath, backup: null };
}

function startFullBackupSweep() {
  ensureDailyServerBackup();
  if (sweepTimer) return;
  sweepTimer = setInterval(ensureDailyServerBackup, SWEEP_MS);
  sweepTimer.unref?.();
}

function getFullBackupStatus() {
  const files = listServerBackups();
  return {
    latest: files[0] || null,
    count: files.length,
    directory: BACKUP_DIR
  };
}

function listServerBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter((name) => /^drawing-world-full-.*\.json$/.test(name))
      .map((name) => {
        const filePath = path.join(BACKUP_DIR, name);
        const stat = fs.statSync(filePath);
        return { name, size: stat.size, savedAt: stat.mtimeMs };
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function trimServerBackups() {
  for (const file of listServerBackups().slice(MAX_SERVER_BACKUPS)) {
    fs.rmSync(path.join(BACKUP_DIR, file.name), { force: true });
  }
}

function normalizeBackup(backup) {
  if (!backup || backup.kind !== BACKUP_KIND || !backup.data || typeof backup.data !== "object") return null;
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: Number(backup.exportedAt) || Date.now(),
    day: typeof backup.day === "string" ? backup.day : getDayKey(),
    timezone: "Asia/Seoul",
    reason: typeof backup.reason === "string" ? backup.reason.slice(0, 32) : "restore",
    data: {
      aiMemory: backup.data.aiMemory || { version: 1, rooms: {} },
      aiConversations: backup.data.aiConversations || { schemaVersion: 1, rooms: {} },
      analytics: backup.data.analytics || { days: {}, months: {}, years: {} },
      featured: backup.data.featured || { archive: [], active: {} },
      dailySnapshots: backup.data.dailySnapshots || { snapshots: [] }
    }
  };
}

function summarizeBackup(backup) {
  const data = backup?.data || {};
  return {
    day: backup?.day || getDayKey(),
    exportedAt: Number(backup?.exportedAt) || 0,
    aiMemoryRooms: Object.keys(data.aiMemory?.rooms || {}).length,
    aiConversationRooms: Object.keys(data.aiConversations?.rooms || {}).length,
    analyticsDays: Object.keys(data.analytics?.days || {}).length,
    featuredArchive: Array.isArray(data.featured?.archive) ? data.featured.archive.length : 0,
    dailySnapshots: Array.isArray(data.dailySnapshots?.snapshots) ? data.dailySnapshots.snapshots.length : 0,
    analyticsSummary: buildAnalyticsState()
  };
}

function getDayKey(now = Date.now()) {
  return new Date(Number(now) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

module.exports = {
  createFullBackup,
  ensureDailyServerBackup,
  getFullBackupStatus,
  restoreFullBackup,
  saveServerBackup,
  startFullBackupSweep
};
