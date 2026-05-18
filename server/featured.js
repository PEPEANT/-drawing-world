const crypto = require("node:crypto");
const {
  addArchiveEntries,
  deleteActiveRoom,
  listArchive,
  loadActiveRoom,
  saveActiveRoom
} = require("./featured-store");
const { buildSnapshot, getTargetKey } = require("./featured-snapshot");

const DAY_OFFSET_MS = 9 * 60 * 60 * 1000;
const SCREEN_COUNT = 3;
const MERGE_RADIUS = 300;

function rollRoomDay(room, now = Date.now()) {
  const day = getDayKey(now);
  const state = getState(room, now);
  if (state.day === day) return null;

  const winners = finalizeRoomWinners(room, "daily-reset");
  room.strokes = [];
  room.votes = null;
  room.featured = createState(day);
  deleteActiveRoom(room.name);
  return { day, winners };
}

function recordArtworkLike(room, vote) {
  const point = normalizePoint(vote.point);
  if (!point || typeof vote.targetId !== "string") {
    return { changed: false, featured: buildFeaturedTop(room) };
  }

  const snapshot = buildSnapshot(room, vote.targetId, point);
  if (!snapshot) return { changed: false, featured: buildFeaturedTop(room) };

  const state = getState(room);
  const candidate = findCandidate(state, snapshot) || createCandidate(room, snapshot);
  if (!state.candidates.includes(candidate)) state.candidates.push(candidate);

  const voter = safeId(vote.voterId) || `anon:${crypto.randomUUID()}`;
  if (candidate.voters.has(voter)) return { changed: false, featured: buildFeaturedTop(room) };

  candidate.voters.add(voter);
  candidate.likes = candidate.voters.size;
  candidate.artistName = snapshot.artistName;
  candidate.center = snapshot.center;
  candidate.bounds = snapshot.bounds;
  candidate.strokes = snapshot.strokes;
  candidate.updatedAt = Date.now();
  persistState(room);

  return { changed: true, featured: buildFeaturedTop(room) };
}

function buildFeaturedTop(room, limit = SCREEN_COUNT) {
  return getState(room).candidates
    .filter((entry) => entry.likes > 0 && entry.strokes.length)
    .sort(compareCandidates)
    .slice(0, limit)
    .map(serializeCandidate);
}

function finalizeRoomWinners(room, reason = "manual") {
  const winners = buildFeaturedTop(room, SCREEN_COUNT).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    reason,
    archiveId: `${entry.day}:${entry.room}:${entry.id}`
  }));
  if (winners.length) addArchiveEntries(winners);
  return winners;
}

function clearFeaturedRoom(room) {
  room.featured = createState(getDayKey());
  deleteActiveRoom(room.name);
}

function removeFeaturedForTarget(room, targetId) {
  const state = getState(room);
  const targetKey = getTargetKey(room, targetId);
  const before = state.candidates.length;
  state.candidates = state.candidates.filter((entry) => !isTargetCandidate(entry, targetId, targetKey));
  const changed = before !== state.candidates.length;
  if (changed) persistState(room);
  return changed;
}

function removeArtworkVote(room, vote) {
  const voter = safeId(vote.voterId);
  if (!voter || typeof vote.targetId !== "string") return false;
  const targetKey = getTargetKey(room, vote.targetId);
  const state = getState(room);
  let changed = false;

  for (const candidate of state.candidates) {
    if (!isTargetCandidate(candidate, vote.targetId, targetKey)) continue;
    if (!candidate.voters.delete(voter)) continue;
    candidate.likes = candidate.voters.size;
    candidate.updatedAt = Date.now();
    changed = true;
  }

  if (changed) {
    state.candidates = state.candidates.filter((candidate) => candidate.likes > 0);
    persistState(room);
  }
  return changed;
}

function buildFeaturedArchive() {
  return listArchive();
}

function getState(room, now = Date.now()) {
  if (!room.featured) room.featured = hydrateState(loadActiveRoom(room.name)) || createState(getDayKey(now));
  if (!Array.isArray(room.featured.candidates)) room.featured.candidates = [];
  return room.featured;
}

function createState(day) {
  return { day, candidates: [] };
}

function hydrateState(saved) {
  if (!saved || typeof saved.day !== "string" || !Array.isArray(saved.candidates)) return null;
  return {
    day: saved.day,
    candidates: saved.candidates.map(hydrateCandidate).filter(Boolean)
  };
}

function hydrateCandidate(entry) {
  const strokes = Array.isArray(entry?.strokes) ? entry.strokes : [];
  const voters = new Set((Array.isArray(entry?.voters) ? entry.voters : []).map(safeId).filter(Boolean));
  const likes = voters.size || safeCount(entry?.likes);
  if (!likes || !strokes.length) return null;
  return {
    id: safeId(entry.id) || crypto.randomUUID(),
    room: typeof entry.room === "string" ? entry.room.slice(0, 32) : "",
    day: entry.day,
    targetId: safeId(entry.targetId),
    targetKey: safeId(entry.targetKey),
    artistName: typeof entry.artistName === "string" ? entry.artistName.slice(0, 24) : "player",
    center: normalizePoint(entry.center) || { x: 1600, y: 1100 },
    bounds: normalizeBounds(entry.bounds),
    strokes,
    likes,
    voters,
    createdAt: safeTime(entry.createdAt),
    updatedAt: safeTime(entry.updatedAt)
  };
}

function createCandidate(room, snapshot) {
  return {
    id: crypto.randomUUID(),
    room: room.name,
    day: getState(room).day,
    targetId: snapshot.targetId,
    targetKey: snapshot.targetKey,
    artistName: snapshot.artistName,
    center: snapshot.center,
    bounds: snapshot.bounds,
    strokes: snapshot.strokes,
    likes: 0,
    voters: new Set(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function isTargetCandidate(candidate, targetId, targetKey) {
  return candidate.targetId === targetId || (targetKey && candidate.targetKey === targetKey);
}

function findCandidate(state, snapshot) {
  return state.candidates.find((entry) => (
    entry.targetKey === snapshot.targetKey &&
    Math.hypot(entry.center.x - snapshot.center.x, entry.center.y - snapshot.center.y) <= MERGE_RADIUS
  ));
}

function compareCandidates(a, b) {
  return b.likes - a.likes || b.updatedAt - a.updatedAt || a.artistName.localeCompare(b.artistName, "ko");
}

function serializeCandidate(entry) {
  return {
    id: entry.id,
    room: entry.room,
    day: entry.day,
    artistName: entry.artistName,
    likes: entry.likes,
    center: entry.center,
    bounds: entry.bounds,
    strokes: entry.strokes,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function normalizePoint(point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
  return { x: point.x, y: point.y };
}

function normalizeBounds(bounds) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) {
    return { x: 1510, y: 1030, width: 180, height: 140 };
  }
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(180, Number.isFinite(bounds.width) ? bounds.width : 180),
    height: Math.max(140, Number.isFinite(bounds.height) ? bounds.height : 140)
  };
}

function persistState(room) {
  saveActiveRoom(room.name, getState(room));
}

function safeCount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function safeId(value) {
  return typeof value === "string" ? value.replace(/[^a-z0-9_-]/gi, "").slice(0, 80) : "";
}

function safeTime(value) {
  return Number.isFinite(value) ? value : Date.now();
}

function getDayKey(now = Date.now()) {
  return new Date(now + DAY_OFFSET_MS).toISOString().slice(0, 10);
}

module.exports = { buildFeaturedArchive, buildFeaturedTop, clearFeaturedRoom, finalizeRoomWinners, recordArtworkLike, removeArtworkVote, removeFeaturedForTarget, rollRoomDay };
