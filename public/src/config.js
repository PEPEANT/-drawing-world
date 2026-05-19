export const APP_NAME = "드로잉온라인";
export const DEFAULT_ROOM = "lobby";
export const PAPER_COLOR = "#f3f4f6";
export const GRID_COLOR = "#e1e7ef";

export const WORLD = {
  width: 3200,
  height: 2200
};

export const PLAYER = {
  size: 50,
  collisionRadius: 25,
  voteRadius: 34
};

export const STORAGE_KEYS = {
  strokes: "simulac-draw-world:strokes:v1",
  legacyStrokes: "paint-walk:v1",
  name: "simulac-draw-world:name",
  legacyName: "paint-walk:name",
  color: "simulac-draw-world:color",
  legacyColor: "paint-walk:color",
  skin: "simulac-draw-world:skin:v1",
  clientId: "simulac-draw-world:client-id:v1",
  layers: "simulac-draw-world:layers:v1",
  activeLayer: "simulac-draw-world:active-layer:v1"
};

export const PALETTE = [
  "#2563eb",
  "#ef4444",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#0891b2",
  "#db2777"
];

export const CLIENT_LIMITS = {
  localStrokes: 800,
  activeStrokes: 1200,
  layersPerPlayer: 5,
  likesBeforeFeatured: 1,
  downvotesBeforeClear: 3
};

export function getRoomName() {
  const params = new URLSearchParams(location.search);
  return (params.get("room") || DEFAULT_ROOM).trim().slice(0, 32) || DEFAULT_ROOM;
}

export function isSpectatorMode() {
  const params = new URLSearchParams(location.search);
  return params.get("spectator") === "1";
}

export function getSpectatorFocusId() {
  const params = new URLSearchParams(location.search);
  return (params.get("focus") || "").trim().slice(0, 80);
}
