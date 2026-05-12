import { CLIENT_LIMITS, STORAGE_KEYS } from "./config.js";

export function saveLocalStrokes(strokes) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.strokes,
      JSON.stringify(strokes.slice(-CLIENT_LIMITS.localStrokes))
    );
  } catch {
    localStorage.removeItem(STORAGE_KEYS.strokes);
  }
}

export function loadLocalStrokes() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.strokes) ||
      localStorage.getItem(STORAGE_KEYS.legacyStrokes) ||
      "[]";
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function savePlayerIdentity(player) {
  localStorage.setItem(STORAGE_KEYS.name, player.name);
  localStorage.setItem(STORAGE_KEYS.color, player.color);
  if (player.skin) {
    localStorage.setItem(STORAGE_KEYS.skin, player.skin);
  }
}
