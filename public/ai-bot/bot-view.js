import { setChoiceButtonsEnabled } from "./choice-buttons.js";
import {
  getActionText,
  getBotStateText,
  getBotStatusText,
  getMemoryLayerText,
  getMoodText,
  getSenseText,
  isProactiveCoolingDown,
  renderAttentionList,
  renderCortexSummary,
  renderRouteStatus,
  resetCortexSummary
} from "./cortex-view.js";
import { renderMemory } from "./memory-view.js";
import { setBotSkinSelectorEnabled } from "./skin-select.js";
import { getTalkSummaries, resetTalkLog } from "./talk-log.js";
import { renderBotWorldView, resetBotWorldView } from "./world-view.js";
import { WORLD } from "../src/config.js";

const FOLLOW_ANCHOR = { x: 50, y: 52 };
const BOT_VIEW_SCALE = 0.18;
const MAX_ROUTE_VECTOR = { x: 330, y: 230 };
const PREDICT_DISTANCE = 150;
const SPEECH_TTL_MS = 6500;
const MAX_SPEECH_LENGTH = 22;
const RANGE_RADIUS = {
  sense: 460,
  talk: 320,
  avoid: 170
};

export function renderBotView(dom, room, bot, created, context, state, cooldownMs) {
  const ai = bot?.ai || {};
  state.currentBot = bot;
  state.currentContext = context || state.currentContext;
  state.emptyStatusText = "대기 중";

  dom.botTitle.textContent = bot?.name || "AI봇";
  dom.botRoom.textContent = `room: ${room}`;
  dom.botState.textContent = getBotStateText(bot, created);
  dom.labBody.classList.add("has-bot");
  dom.cortexStatus.textContent = "토대 온라인";
  if (dom.interactionStatus) dom.interactionStatus.textContent = "운영 가능";
  dom.senseState.textContent = getSenseText(bot, state.currentContext);
  dom.memoryState.textContent = getMemoryLayerText(ai.memory, getTalkSummaries().length);
  dom.intentState.textContent = ai.intent || "대기";
  dom.actionState.textContent = getActionText(bot);
  dom.cortexDetail.textContent = ai.reason || "AI봇이 월드 상태를 읽고 다음 관측 지점을 고르고 있어.";
  renderRouteStatus(dom, ai.route);
  renderAttentionList(dom, ai.attention || state.currentContext?.attention);
  dom.botSkin.src = bot?.skin || "";
  dom.botSkin.hidden = !bot?.skin;
  setBotStagePosition(dom, bot);
  renderBotWorldView(dom, bot, state.currentContext);
  setSpeech(dom, getVisibleSpeech(bot));
  setBotControls(dom, true, ai.mode, state, cooldownMs);
  renderMemory(dom, ai.memory);
  renderDialogueData(dom, ai.dialogue);
  renderInteractionState(dom, ai.interaction);
  renderCortexSummary(dom, bot, state.currentContext, {
    created,
    lastTalkAt: state.lastTalkAt,
    lastUserText: state.lastUserText,
    talkCount: getTalkSummaries().length,
    cooldownMs
  });
  setBotState(dom, getBotStatusText(bot, created));
}

export function renderNoBotView(dom, room, statusText, state) {
  state.currentBot = null;
  state.currentContext = null;
  state.lastUserText = "";
  state.lastStateEventKey = "";

  dom.botTitle.textContent = "대기 중";
  dom.botRoom.textContent = `room: ${room}`;
  dom.botState.textContent = "bot: 없음";
  dom.labBody.classList.remove("has-bot");
  dom.cortexStatus.textContent = "토대 연결됨";
  if (dom.interactionStatus) dom.interactionStatus.textContent = "AI봇 대기";
  dom.senseState.textContent = "대기";
  dom.memoryState.textContent = "비어 있음";
  dom.intentState.textContent = "준비";
  dom.actionState.textContent = "잠김";
  dom.cortexDetail.textContent = "AI봇을 생성하면 감각, 기억, 의도, 행동 회로가 연결돼.";
  resetCortexSummary(dom, room);
  dom.botSkin.removeAttribute("src");
  dom.botSkin.hidden = true;
  resetBotStagePosition(dom);
  resetBotWorldView(dom);
  setSpeech(dom, "");
  setBotControls(dom, false, "idle", state, 0);
  renderMemory(dom, null);
  renderDialogueData(dom, null);
  renderInteractionState(dom, null);
  resetTalkLog();
  setBotState(dom, statusText);
}

export function setBotControls(dom, hasBot, mode = "idle", state = {}, cooldownMs = 0) {
  const isMoving = isAiMovingMode(mode);
  const isDrawing = mode === "drawing";
  dom.createButton.disabled = hasBot;
  dom.walkButton.disabled = !hasBot || isMoving || mode === "waking" || isDrawing;
  dom.stopButton.disabled = !hasBot || (!isMoving && mode !== "waking");
  dom.leaveButton.disabled = !hasBot;
  dom.proactiveButton.disabled = !hasBot || isDrawing || isProactiveCoolingDown(state.currentBot, cooldownMs);
  dom.routeTopButton.disabled = !hasBot || isDrawing;
  dom.routePatrolButton.disabled = !hasBot || isDrawing;
  dom.talkButton.disabled = !hasBot || isDrawing;
  if (dom.interactionTarget) dom.interactionTarget.disabled = !hasBot;
  if (dom.interactionTargetUser) dom.interactionTargetUser.disabled = !hasBot;
  if (dom.drawPreviewButton) dom.drawPreviewButton.disabled = !hasBot || mode === "drawing";
  if (dom.drawButton) dom.drawButton.disabled = !hasBot || mode === "drawing";
  if (dom.drawCancelButton) dom.drawCancelButton.disabled = !hasBot || mode !== "drawing";
  setChoiceButtonsEnabled(hasBot && !isDrawing);
  setBotSkinSelectorEnabled(dom, !hasBot);
}

function isAiMovingMode(mode) {
  return mode === "walking" || mode === "quiet_patrol";
}

export function appendStateEvent(bot, lastStateEventKey, appendBotEvent) {
  const ai = bot?.ai || {};
  if (!ai.mode || ai.mode === "created" || ai.mode === "stopped") return lastStateEventKey;

  const key = `${ai.mode}:${ai.target || ""}:${ai.speech || ""}`;
  if (key === lastStateEventKey) return lastStateEventKey;

  if (ai.mode === "walking" && ai.target) appendBotEvent(`${ai.target} 이동 중`);
  if (ai.mode === "observing") appendBotEvent(`${ai.target || "관측 지점"} 관찰`);
  if (ai.mode === "quiet_patrol" && ai.target) appendBotEvent(`${ai.target} 저전력 순찰`);
  if (ai.mode === "sleeping") appendBotEvent("수면 진입");
  if (ai.mode === "waking") appendBotEvent("기상 중");
  if (ai.mode === "drawing") appendBotEvent("AI 그림 그리는 중");
  return key;
}

export function setBotState(dom, text) {
  dom.statusText.textContent = text;
}

export function setConnectionStatus(dom, text, mode) {
  dom.statusText.textContent = text;
  dom.statusDot.className = `status-dot ${mode === "online" ? "online" : mode === "error" ? "error" : ""}`;
}

function setSpeech(dom, text) {
  const speech = String(text || "").trim();
  dom.botSpeech.textContent = speech;
  dom.botSpeech.hidden = !speech;
}

function getVisibleSpeech(bot) {
  const speech = String(bot?.ai?.speech || "").trim();
  if (!speech) return "";
  const lastSpeechAt = Number(bot?.ai?.lastSpeechAt) || 0;
  if (!lastSpeechAt || Date.now() - lastSpeechAt > SPEECH_TTL_MS) return "";
  return speech.length > MAX_SPEECH_LENGTH ? `${speech.slice(0, MAX_SPEECH_LENGTH)}...` : speech;
}

function renderDialogueData(dom, dialogue) {
  const latest = dialogue?.latest;
  if (dom.dialogueIntent) dom.dialogueIntent.textContent = latest?.detectedIntent || "대기";
  if (dom.dialogueScore) dom.dialogueScore.textContent = `${Number(latest?.interestScore) || 0}점`;
  if (dom.dialogueTarget) dom.dialogueTarget.textContent = formatInteractionTarget(latest);
  if (dom.dialogueResult) dom.dialogueResult.textContent = latest?.result || "대기";
  if (dom.dialogueNote) dom.dialogueNote.textContent = latest?.memoryNote || "없음";
  if (dom.dialogueAction) dom.dialogueAction.textContent = latest?.nextAction || "대기";
  if (dom.dialogueTotal) dom.dialogueTotal.textContent = `${Number(dialogue?.total) || 0}개`;
  if (dom.dialogueTopIntents) {
    const top = Array.isArray(dialogue?.topIntents) ? dialogue.topIntents : [];
    dom.dialogueTopIntents.textContent = top.length
      ? top.map((entry) => `${entry.intent} ${entry.count}`).join(", ")
      : "없음";
  }
}

function renderInteractionState(dom, interaction) {
  if (dom.dialogueLock) {
    const active = interaction?.active;
    dom.dialogueLock.textContent = interaction?.locked && active
      ? `${active.userName || "유저"} · ${active.intent || "요청"}`
      : "없음";
  }
  if (dom.dialogueQueue) {
    dom.dialogueQueue.textContent = `${Number(interaction?.queueCount) || 0}명`;
  }
}

function formatInteractionTarget(event) {
  if (!event) return "전체 월드";
  if (event.targetMode === "point" && event.targetPoint) {
    return `위치 ${Math.round(event.targetPoint.x)}, ${Math.round(event.targetPoint.y)}`;
  }
  if (event.targetMode === "user_art" && event.targetPoint) {
    const count = Number(event.targetMeta?.strokeCount) || 0;
    const prefix = count ? `최근 그림 ${count}개` : "최근 그림";
    return `${prefix} · ${Math.round(event.targetPoint.x)}, ${Math.round(event.targetPoint.y)}`;
  }
  if (event.targetUserId) return `유저 ${event.targetUserId}`;
  if (event.targetArtworkId) return `작품 ${event.targetArtworkId}`;
  return {
    world: "전체 월드",
    nearby: "근처 유저",
    recent_author: "최근 그림 작성자",
    specific_user: "특정 유저"
  }[event.targetMode] || "전체 월드";
}

function setBotStagePosition(dom, bot) {
  const host = dom.botView || dom.labBody;
  if (!host) return;

  const x = clampNumber(bot?.x, 0, WORLD.width, WORLD.width / 2);
  const y = clampNumber(bot?.y, 0, WORLD.height, WORLD.height / 2);
  const facing = Number(bot?.facing) < 0 ? "-1" : "1";
  const mode = bot?.ai?.mode || "idle";
  const lifecycle = bot?.ai?.lifecycle || mode;
  const moving = Boolean(bot?.moving || mode === "walking" || mode === "quiet_patrol");
  const route = bot?.ai?.route || {};
  const nextPoint = normalizePoint(route.next);
  const vector = nextPoint ? buildStageVector(x, y, nextPoint) : null;
  const prediction = vector ? buildPredictionVector(vector) : null;

  host.style.setProperty("--bot-stage-x", `${FOLLOW_ANCHOR.x}%`);
  host.style.setProperty("--bot-stage-y", `${FOLLOW_ANCHOR.y}%`);
  host.style.setProperty("--bot-stage-facing", facing);
  host.style.setProperty("--bot-grid-x", `${Math.round(-x * BOT_VIEW_SCALE)}px`);
  host.style.setProperty("--bot-grid-y", `${Math.round(-y * BOT_VIEW_SCALE)}px`);
  host.style.setProperty("--sense-range-size", `${Math.round(RANGE_RADIUS.sense * BOT_VIEW_SCALE * 2)}px`);
  host.style.setProperty("--talk-range-size", `${Math.round(RANGE_RADIUS.talk * BOT_VIEW_SCALE * 2)}px`);
  host.style.setProperty("--avoid-range-size", `${Math.round(RANGE_RADIUS.avoid * BOT_VIEW_SCALE * 2)}px`);
  host.style.setProperty("--route-angle", `${vector?.angle || 0}deg`);
  host.style.setProperty("--route-length", `${Math.round(vector?.length || 0)}px`);
  host.style.setProperty("--predict-length", `${Math.round(prediction?.length || 0)}px`);
  host.style.setProperty("--next-dx", `${Math.round(vector?.dx || 0)}px`);
  host.style.setProperty("--next-dy", `${Math.round(vector?.dy || 0)}px`);
  host.style.setProperty("--predict-dx", `${Math.round(prediction?.dx || 0)}px`);
  host.style.setProperty("--predict-dy", `${Math.round(prediction?.dy || 0)}px`);
  host.classList.toggle("is-moving", moving);
  host.classList.toggle("has-prediction", Boolean(vector));
  host.classList.toggle("is-quiet", lifecycle === "quiet_patrol" || mode === "quiet_patrol");
  host.classList.toggle("is-sleeping", lifecycle === "sleeping" || mode === "sleeping");
  host.classList.toggle("is-waking", lifecycle === "waking" || mode === "waking");

  if (dom.botTrackMode) dom.botTrackMode.textContent = moving ? "AI 중심 추적" : "정지 관측";
  if (dom.botTrackMode) dom.botTrackMode.textContent = getTrackModeLabel(mode, lifecycle, moving);
  if (dom.botCoordLabel) dom.botCoordLabel.textContent = `${Math.round(x)}, ${Math.round(y)}`;
  if (dom.botNextLabel) dom.botNextLabel.textContent = nextPoint
    ? `${route.current || route.purpose || bot?.ai?.target || "다음 지점"} · ${Math.round(nextPoint.x)}, ${Math.round(nextPoint.y)}`
    : "경로 없음";
}

function resetBotStagePosition(dom) {
  const host = dom.botView || dom.labBody;
  if (!host) return;
  host.style.setProperty("--bot-stage-x", `${FOLLOW_ANCHOR.x}%`);
  host.style.setProperty("--bot-stage-y", `${FOLLOW_ANCHOR.y}%`);
  host.style.setProperty("--bot-stage-facing", "1");
  host.style.setProperty("--bot-grid-x", "0px");
  host.style.setProperty("--bot-grid-y", "0px");
  host.style.setProperty("--route-angle", "0deg");
  host.style.setProperty("--route-length", "0px");
  host.style.setProperty("--predict-length", "0px");
  host.style.setProperty("--next-dx", "0px");
  host.style.setProperty("--next-dy", "0px");
  host.style.setProperty("--predict-dx", "0px");
  host.style.setProperty("--predict-dy", "0px");
  host.classList.remove("is-moving");
  host.classList.remove("has-prediction");
  host.classList.remove("is-quiet");
  host.classList.remove("is-sleeping");
  host.classList.remove("is-waking");
  if (dom.botTrackMode) dom.botTrackMode.textContent = "대기";
  if (dom.botCoordLabel) dom.botCoordLabel.textContent = "-";
  if (dom.botNextLabel) dom.botNextLabel.textContent = "-";
}

function getTrackModeLabel(mode, lifecycle, moving) {
  if (lifecycle === "sleeping" || mode === "sleeping") return "수면 중";
  if (lifecycle === "waking" || mode === "waking") return "기상 중";
  if (mode === "drawing") return "그림 그리는 중";
  if (lifecycle === "quiet_patrol" || mode === "quiet_patrol") return "저전력 순찰";
  return moving ? "AI 중심 추적" : "정지 관측";
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizePoint(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function buildStageVector(x, y, point) {
  const rawDx = (point.x - x) * BOT_VIEW_SCALE;
  const rawDy = (point.y - y) * BOT_VIEW_SCALE;
  const clipped = clipVector(rawDx, rawDy, MAX_ROUTE_VECTOR.x, MAX_ROUTE_VECTOR.y);
  const length = Math.hypot(clipped.dx, clipped.dy);
  return {
    ...clipped,
    length,
    angle: length > 0 ? Math.atan2(clipped.dy, clipped.dx) * 180 / Math.PI : 0
  };
}

function buildPredictionVector(vector) {
  const length = Math.min(vector.length, PREDICT_DISTANCE);
  if (length <= 0) return { dx: 0, dy: 0, length: 0 };
  const ratio = length / vector.length;
  return {
    dx: vector.dx * ratio,
    dy: vector.dy * ratio,
    length
  };
}

function clipVector(dx, dy, maxX, maxY) {
  const ratio = Math.max(Math.abs(dx) / maxX, Math.abs(dy) / maxY, 1);
  return { dx: dx / ratio, dy: dy / ratio };
}
