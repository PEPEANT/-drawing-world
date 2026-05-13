const { broadcast, send } = require("./protocol");
const { rooms } = require("./rooms");

const TEAM_SPAWNS = {
  red: { x: 980, y: 1100 },
  blue: { x: 2220, y: 1100 }
};

const ROLES = {
  striker: { name: "공격", hp: 120, range: 74, damage: 26, cooldown: 620 },
  ranger: { name: "원거리", hp: 90, range: 230, damage: 18, cooldown: 780 },
  healer: { name: "힐러", hp: 100, range: 170, damage: 10, heal: 24, cooldown: 850 }
};

let loopStarted = false;

function startArenaLoop() {
  if (loopStarted) return;
  loopStarted = true;
  setInterval(tickArenaRooms, 250);
}

function setupArenaPlayer(room, player, requestedRole) {
  const role = normalizeRole(requestedRole);
  const team = chooseTeam(room);
  Object.assign(player, {
    role,
    roleName: ROLES[role].name,
    team,
    hp: ROLES[role].hp,
    maxHp: ROLES[role].hp,
    alive: true,
    respawnAt: 0,
    kills: 0,
    deaths: 0,
    lastArenaActionAt: 0,
    x: TEAM_SPAWNS[team].x,
    y: TEAM_SPAWNS[team].y
  });
  return player;
}

function preserveArenaFields(nextPlayer, existing) {
  if (!existing) return nextPlayer;
  for (const key of ["role", "roleName", "team", "hp", "maxHp", "alive", "respawnAt", "kills", "deaths", "lastArenaActionAt"]) {
    nextPlayer[key] = existing[key];
  }
  if (existing.alive === false) {
    nextPlayer.x = existing.x;
    nextPlayer.y = existing.y;
    nextPlayer.moving = false;
  }
  return nextPlayer;
}

function changeArenaRole(room, playerId, requestedRole) {
  const player = room.players.get(playerId);
  if (!player) return;
  const role = normalizeRole(requestedRole);
  const wasAlive = player.alive !== false;
  const hpRatio = Math.max(0, Math.min(1, (player.hp || 0) / Math.max(1, player.maxHp || ROLES[role].hp)));
  player.role = role;
  player.roleName = ROLES[role].name;
  player.maxHp = ROLES[role].hp;
  player.hp = wasAlive ? Math.max(1, Math.round(player.maxHp * hpRatio)) : 0;
  player.alive = wasAlive;
  if (wasAlive) player.respawnAt = 0;
  broadcast(room, { type: "playerUpdate", player }, undefined);
}

function handleArenaAction(ws, room, message) {
  const player = room.players.get(ws.id);
  if (!player || player.alive === false) return;
  const role = ROLES[player.role] || ROLES.striker;
  const now = Date.now();
  if (now - (player.lastArenaActionAt || 0) < role.cooldown) return;
  player.lastArenaActionAt = now;

  if (message.action === "skill" && player.role === "healer") {
    healNearestAlly(room, player, role);
    return;
  }

  damageNearestEnemy(room, player, role);
}

function handleArenaRole(ws, room, message) {
  changeArenaRole(room, ws.id, message.role);
  broadcast(room, { type: "arenaState", state: buildArenaState(room) }, undefined);
}

function buildArenaState(room) {
  const arena = getArena(room);
  return {
    scores: arena.scores,
    players: Array.from(room.players.values()).map((player) => ({
      id: player.id,
      team: player.team,
      role: player.role,
      hp: player.hp,
      maxHp: player.maxHp,
      alive: player.alive,
      kills: player.kills || 0,
      deaths: player.deaths || 0
    }))
  };
}

function getArena(room) {
  if (!room.arena) {
    room.arena = { scores: { red: 0, blue: 0 } };
  }
  return room.arena;
}

function normalizeRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLES, role) ? role : "striker";
}

function chooseTeam(room) {
  let red = 0;
  let blue = 0;
  for (const player of room.players.values()) {
    if (player.team === "red") red += 1;
    if (player.team === "blue") blue += 1;
  }
  return red <= blue ? "red" : "blue";
}

function damageNearestEnemy(room, attacker, role) {
  const target = findNearest(room, attacker, (player) => player.team !== attacker.team && player.alive !== false, role.range);
  if (!target) {
    sendArenaEvent(room, { kind: "miss", source: attacker.id, text: "사거리 안에 적이 없습니다." });
    return;
  }
  target.hp = Math.max(0, target.hp - role.damage);
  sendArenaEvent(room, { kind: "hit", source: attacker.id, target: target.id, value: role.damage });
  if (target.hp <= 0) {
    knockout(room, attacker, target);
  }
  broadcast(room, { type: "playerUpdate", player: target }, undefined);
  broadcast(room, { type: "playerUpdate", player: attacker }, undefined);
}

function healNearestAlly(room, healer, role) {
  const target = findNearest(room, healer, (player) => player.team === healer.team && player.alive !== false && player.hp < player.maxHp, role.range);
  if (!target) {
    sendArenaEvent(room, { kind: "miss", source: healer.id, text: "회복할 아군이 없습니다." });
    return;
  }
  target.hp = Math.min(target.maxHp, target.hp + role.heal);
  sendArenaEvent(room, { kind: "heal", source: healer.id, target: target.id, value: role.heal });
  broadcast(room, { type: "playerUpdate", player: target }, undefined);
}

function knockout(room, attacker, target) {
  const arena = getArena(room);
  target.alive = false;
  target.respawnAt = Date.now() + 2800;
  target.deaths = (target.deaths || 0) + 1;
  attacker.kills = (attacker.kills || 0) + 1;
  arena.scores[attacker.team] = (arena.scores[attacker.team] || 0) + 1;
  sendArenaEvent(room, { kind: "ko", source: attacker.id, target: target.id, scores: arena.scores });
  broadcast(room, { type: "arenaState", state: buildArenaState(room) }, undefined);
}

function findNearest(room, source, filter, range) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const player of room.players.values()) {
    if (player.id === source.id || !filter(player)) continue;
    const distance = Math.hypot(player.x - source.x, player.y - source.y);
    if (distance <= range && distance < nearestDistance) {
      nearest = player;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function tickArenaRooms() {
  const now = Date.now();
  for (const room of rooms.values()) {
    let changed = false;
    for (const player of room.players.values()) {
      if (player.alive === false && player.respawnAt <= now) {
        const spawn = TEAM_SPAWNS[player.team] || TEAM_SPAWNS.red;
        player.x = spawn.x;
        player.y = spawn.y;
        player.hp = player.maxHp;
        player.alive = true;
        changed = true;
        broadcast(room, { type: "playerUpdate", player }, undefined);
      }
    }
    if (changed) {
      broadcast(room, { type: "arenaState", state: buildArenaState(room) }, undefined);
    }
  }
}

function sendArenaEvent(room, event) {
  broadcast(room, { type: "arenaEvent", event: { ...event, at: Date.now() } }, undefined);
}

module.exports = {
  buildArenaState,
  changeArenaRole,
  handleArenaAction,
  handleArenaRole,
  preserveArenaFields,
  setupArenaPlayer,
  startArenaLoop
};
