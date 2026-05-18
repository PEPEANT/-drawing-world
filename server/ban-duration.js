function normalizeBanDuration(options) {
  if (Number.isFinite(Number(options?.hours))) {
    return clampMinutes(Number(options.hours) * 60) * 60 * 1000;
  }
  const text = String(options?.durationText || "").trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(m|min|h|hr|d)?$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2] || "m";
  const minutes = unit.startsWith("d") ? value * 1440 : unit.startsWith("h") ? value * 60 : value;
  return clampMinutes(minutes) * 60 * 1000;
}

function clampMinutes(minutes) {
  return Math.max(1, Math.min(30 * 24 * 60, Number.isFinite(minutes) ? minutes : 1440));
}

module.exports = { normalizeBanDuration };
