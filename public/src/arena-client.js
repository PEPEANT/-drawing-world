import { ARENA_ROLES } from "./config.js";
import { player, state } from "./state.js";
import { addSystemMessage } from "./ui/chat.js";
import { ui } from "./ui/dom.js";

let sendToServer = () => {};

export function initArenaClient({ send }) {
  sendToServer = send;
  renderRoleButtons();
  document.querySelector("#world")?.addEventListener("pointerdown", () => {
    if (state.gameStarted) sendArenaAction("attack");
  });
  ui.arenaAttackButton?.addEventListener("click", () => sendArenaAction("attack"));
  ui.arenaSkillButton?.addEventListener("click", () => sendArenaAction("skill"));
  syncArenaHud();
}

export function selectArenaRole(role) {
  if (!ARENA_ROLES[role]) return;
  if (state.gameStarted) {
    addSystemMessage("역할 변경은 다음 입장 전에 선택해줘.");
    return;
  }
  state.selectedArenaRole = role;
  player.role = role;
  localStorage.setItem("simulac-arena:role", role);
  syncArenaHud();
  sendToServer({ type: "arenaRole", role });
}

export function sendArenaAction(action = "attack") {
  if (player.alive === false) {
    addSystemMessage("리스폰 대기 중입니다.");
    return;
  }
  sendToServer({ type: "arenaAction", action });
}

export function applyArenaState(arenaState) {
  state.arena = arenaState || { scores: { red: 0, blue: 0 }, players: [] };
  const self = state.arena.players?.find((entry) => entry.id === state.socketId);
  if (self) Object.assign(player, self);
  syncArenaHud();
}

export function addArenaEvent(event) {
  if (!event) return;
  state.arenaEvents.push({ ...event, expiresAt: Date.now() + 900 });
  state.arenaEvents = state.arenaEvents.slice(-16);
  if (event.kind === "ko") addSystemMessage("KO 발생. 점수가 갱신됐습니다.");
  if (event.kind === "miss" && event.source === state.socketId) addSystemMessage(event.text || "빗나갔습니다.");
  syncArenaHud();
}

export function syncArenaHud() {
  const role = ARENA_ROLES[state.selectedArenaRole] || ARENA_ROLES.striker;
  const scores = state.arena?.scores || { red: 0, blue: 0 };
  if (ui.redScore) ui.redScore.textContent = scores.red || 0;
  if (ui.blueScore) ui.blueScore.textContent = scores.blue || 0;
  if (ui.arenaStatus) ui.arenaStatus.textContent = player.alive === false ? "리스폰 대기" : "전투 중";
  if (ui.arenaTeamLabel) {
    ui.arenaTeamLabel.textContent = (player.team || "red").toUpperCase();
    ui.arenaTeamLabel.className = player.team === "blue" ? "team-blue" : "team-red";
  }
  if (ui.arenaRoleLabel) ui.arenaRoleLabel.textContent = player.roleName || role.label;
  if (ui.arenaRolePickLabel) ui.arenaRolePickLabel.textContent = role.label;
  const maxHp = Math.max(1, player.maxHp || role.hp);
  const hp = Math.max(0, Math.min(maxHp, player.hp ?? maxHp));
  if (ui.arenaHpBar) ui.arenaHpBar.style.width = `${Math.round((hp / maxHp) * 100)}%`;
  if (ui.arenaHpText) ui.arenaHpText.textContent = `${hp} / ${maxHp}`;
  for (const button of ui.arenaRoleButtons?.querySelectorAll("[data-arena-role]") || []) {
    button.classList.toggle("active", button.dataset.arenaRole === state.selectedArenaRole);
  }
}

function renderRoleButtons() {
  if (!ui.arenaRoleButtons) return;
  ui.arenaRoleButtons.replaceChildren();
  for (const [role, config] of Object.entries(ARENA_ROLES)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.arenaRole = role;
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector("strong").textContent = config.label;
    button.querySelector("span").textContent = config.hint;
    button.addEventListener("click", () => selectArenaRole(role));
    ui.arenaRoleButtons.append(button);
  }
}
