import { setupChoiceButtons } from "./choice-buttons.js";
import {
  appendStateEvent as appendBotStateEvent,
  renderBotView,
  renderNoBotView,
  setBotControls,
  setBotState as setBotStateText,
  setConnectionStatus
} from "./bot-view.js";
import {
  renderCortexSummary
} from "./cortex-view.js";
import { setupCortexModal } from "./cortex-modal.js";
import { renderDebugSnapshot } from "./debug-snapshot.js";
import { renderDrawProgress, renderDrawResult, setDrawStatus, setupDrawArt } from "./draw-art.js";
import { appendBotEvent } from "./event-log.js";
import { dom } from "./lab-dom.js";
import { renderMemory } from "./memory-view.js";
import { getSelectedBotSkin, setupBotSkinSelector } from "./skin-select.js";
import { setupStageTabs } from "./stage-tabs.js";
import { appendTalkLog, getTalkSummaries, rememberTalkNote, rememberTalkSummary } from "./talk-log.js";

const ROOM = "lobby";
const PROACTIVE_COOLDOWN_MS = 45 * 1000;
const STATE_POLL_MS = 450;
const viewState = {
  emptyStatusText: "대기 중",
  currentBot: null,
  currentContext: null,
  lastTalkAt: 0,
  lastUserText: "",
  lastStateEventKey: ""
};
let socket = null;
let stateTimer = null;
const savedKey = localStorage.getItem("sdw:admin-key") || "";
const queryKey = new URLSearchParams(location.search).get("key") || "";
dom.keyInput.value = queryKey || savedKey;
dom.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const key = dom.keyInput.value.trim();
  if (!key) {
    dom.authMessage.textContent = "관리자 키를 입력해줘.";
    return;
  }
  localStorage.setItem("sdw:admin-key", key);
  connect(key);
});
setupStageTabs(dom);
setupCortexModal(dom);
setupBotSkinSelector(dom);
renderDebugSnapshot(dom, null);
setupDrawArt(dom, {
  onPreview: ({ topic, style, shape, character, prompt }) => {
    if (!viewState.currentBot) return;
    setDrawStatus(dom, "미리보기 생성 중");
    appendBotEvent("AI 그림 미리보기 요청");
    send({ type: "aiBotDrawPlan", room: ROOM, topic, style, shape, character, prompt });
  },
  onStart: ({ topic, style, shape, character, prompt }) => {
    if (!viewState.currentBot) return;
    setDrawStatus(dom, "천천히 그리는 중");
    appendBotEvent("AI 그림 천천히 그리기 시작");
    send({ type: "aiBotDrawStart", room: ROOM, topic, style, shape, character, prompt });
  },
  onCancel: () => {
    if (!viewState.currentBot) return;
    setDrawStatus(dom, "취소 요청 중");
    appendBotEvent("AI 그림 취소 요청");
    send({ type: "aiBotDrawCancel", room: ROOM });
  }
});
dom.createButton.addEventListener("click", () => {
  send({ type: "aiBotCreate", room: ROOM, skin: getSelectedBotSkin() });
  appendBotEvent("AI 생성 요청");
  setBotState("AI봇 생성 요청 중");
});
dom.walkButton.addEventListener("click", () => {
  send({ type: "aiBotWalk", room: ROOM, skin: getSelectedBotSkin() });
  appendBotEvent("이동 요청");
  setBotState("관측 이동 요청 중");
});
dom.stopButton.addEventListener("click", () => {
  send({ type: "aiBotStop", room: ROOM });
  appendBotEvent("정지 요청");
  setBotState("멈춤 요청 중");
});
dom.leaveButton.addEventListener("click", () => {
  send({ type: "aiBotRemove", room: ROOM });
  appendBotEvent("퇴장 요청");
  setBotState("퇴장 요청 중");
});
dom.proactiveButton.addEventListener("click", () => {
  send({ type: "aiBotProactive", room: ROOM });
  appendBotEvent("먼저 말 걸기 요청");
  setBotState("먼저 말 걸기 요청 중");
});
dom.routeTopButton.addEventListener("click", () => {
  send({ type: "aiBotRoute", room: ROOM, route: "top", skin: getSelectedBotSkin() });
  appendBotEvent("TOP 경로 요청");
  setBotState("TOP 경로 요청 중");
});
dom.routePatrolButton.addEventListener("click", () => {
  send({ type: "aiBotRoute", room: ROOM, route: "patrol", skin: getSelectedBotSkin() });
  appendBotEvent("순찰 경로 요청");
  setBotState("순찰 경로 요청 중");
});
dom.conversationSaveButton?.addEventListener("click", () => {
  send({ type: "aiBotConversationSave", room: ROOM });
  appendBotEvent("상호작용 저장 요청");
});
dom.conversationExportButton?.addEventListener("click", () => {
  send({ type: "aiBotConversationExport", room: ROOM });
  appendBotEvent("상호작용 JSON 내보내기 요청");
});
dom.talkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitTalk(dom.talkInput.value.trim(), "input");
});
setupChoiceButtons(({ action, text }) => {
  if (action === "walk") {
    send({ type: "aiBotWalk", room: ROOM, skin: getSelectedBotSkin() });
    setBotState("관측 이동 요청 중");
  }
  if (action === "stop") {
    send({ type: "aiBotStop", room: ROOM });
    setBotState("멈춤 요청 중");
  }
  submitTalk(text, "choice");
});
if (dom.keyInput.value) connect(dom.keyInput.value);
function submitTalk(text, source = "input") {
  if (!text || !viewState.currentBot) return;
  const interaction = buildInteractionTarget();
  dom.talkInput.value = "";
  dom.talkReply.textContent = "AI봇 상호작용 실행 중...";
  if (dom.interactionStatus) dom.interactionStatus.textContent = "상호작용 기록 중";
  viewState.lastTalkAt = Date.now();
  viewState.lastUserText = text;
  appendTalkLog("user", text);
  appendBotEvent(`나: ${text}`);
  rememberTalkSummary(text, viewState.currentBot);
  renderMemory(dom, viewState.currentBot?.ai?.memory);
  renderCortexSummary(dom, viewState.currentBot, viewState.currentContext, {
    lastTalkAt: viewState.lastTalkAt,
    lastUserText: viewState.lastUserText,
    talkCount: getTalkSummaries().length,
    cooldownMs: PROACTIVE_COOLDOWN_MS
  });
  send({
    type: "aiBotTalk",
    room: ROOM,
    text,
    source,
    targetMode: interaction.targetMode,
    targetUserId: interaction.targetUserId,
    operator: "admin"
  });
}

function buildInteractionTarget() {
  return {
    targetMode: dom.interactionTarget?.value || "world",
    targetUserId: dom.interactionTargetUser?.value.trim() || ""
  };
}
function connect(key) {
  if (socket) socket.close();
  setStatus("연결 중", "pending");
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/admin-ws?key=${encodeURIComponent(key)}`);
  socket.addEventListener("open", () => {
    dom.authForm.classList.add("hidden");
    dom.labBody.classList.remove("is-locked");
    dom.createButton.disabled = false;
    dom.cortexStatus.textContent = "토대 연결됨";
    setStatus("AI 관리실 연결됨", "online");
    requestBotState();
    stateTimer = window.setInterval(requestBotState, STATE_POLL_MS);
  });
  socket.addEventListener("close", () => {
    if (stateTimer) window.clearInterval(stateTimer);
    stateTimer = null;
    dom.labBody.classList.add("is-locked");
    setControls(false);
    setStatus("연결 끊김", "error");
  });
  socket.addEventListener("message", handleMessage);
}
function handleMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }
  if (message.type === "error") {
    dom.authMessage.textContent = message.message || "연결 오류";
    return;
  }
  if (message.type === "aiBotCreated" || message.type === "aiBotWalking") {
    renderBot(message.bot, message.created, message.context);
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent(message.type === "aiBotWalking" ? "이동 시작" : (message.created ? "AI 생성됨" : "이미 생성됨"));
    return;
  }
  if (message.type === "aiBotRouted") {
    renderBot(message.bot, message.created, message.context);
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent(message.route === "top" ? "TOP 경로 시작" : "순찰 경로 시작");
    return;
  }
  if (message.type === "aiBotStopped") {
    message.bot ? renderBot(message.bot, false, message.context) : renderNoBot();
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent("정지");
    return;
  }
  if (message.type === "aiBotState") {
    if (!message.bot) viewState.currentContext = message.context || null;
    message.bot ? renderBot(message.bot, false, message.context) : renderNoBot();
    renderDebugSnapshot(dom, message.debug);
    if (message.bot) appendStateEvent(message.bot);
    return;
  }
  if (message.type === "aiBotTalked") {
    dom.talkReply.textContent = message.reply || "AI봇이 조용히 고개를 끄덕였어.";
    viewState.lastTalkAt = Date.now();
    appendTalkLog("bot", dom.talkReply.textContent);
    appendBotEvent(`AI봇: ${dom.talkReply.textContent}`);
    if (dom.interactionStatus) dom.interactionStatus.textContent = message.result || "spoken";
    if (message.bot) renderBot(message.bot, false, message.context);
    renderDebugSnapshot(dom, message.debug);
    return;
  }
  if (message.type === "aiBotProactiveTalked") {
    const reply = message.reply || "AI봇이 아직 말을 고르는 중이야.";
    dom.talkReply.textContent = reply;
    if (message.spoken) {
      appendTalkLog("bot", reply);
      rememberTalkNote("AI봇이 먼저 말을 걸었다");
      appendBotEvent(`AI봇 선제 발화: ${reply}`);
    } else {
      appendBotEvent(reply);
    }
    if (message.bot) renderBot(message.bot, false, message.context);
    renderMemory(dom, message.bot?.ai?.memory || viewState.currentBot?.ai?.memory);
    renderCortexSummary(dom, message.bot || viewState.currentBot, message.context || viewState.currentContext, {
      lastTalkAt: viewState.lastTalkAt,
      lastUserText: viewState.lastUserText,
      talkCount: getTalkSummaries().length,
      cooldownMs: PROACTIVE_COOLDOWN_MS
    });
    setBotState(message.spoken ? "AI봇이 먼저 말함" : reply);
    renderDebugSnapshot(dom, message.debug);
    return;
  }
  if (message.type === "aiBotConversationSaved") {
    renderConversationStorage(message.summary || message.context?.conversation);
    appendBotEvent("상호작용 저장 완료");
    if (dom.interactionStatus) dom.interactionStatus.textContent = "저장 완료";
    return;
  }
  if (message.type === "aiBotConversationExported") {
    renderConversationStorage(message.summary || message.context?.conversation);
    downloadConversationJson(message.data);
    appendBotEvent("상호작용 JSON 내보내기 완료");
    if (dom.interactionStatus) dom.interactionStatus.textContent = "내보내기 완료";
    return;
  }
  if (message.type === "aiBotBusy") {
    const reason = message.reason || "AI봇이 지금 다른 행동 중이야.";
    if (message.bot) renderBot(message.bot, false, message.context);
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent(reason);
    setBotState(reason);
    setDrawStatus(dom, reason);
    return;
  }
  if (message.type === "aiBotDrawn") {
    if (message.bot) renderBot(message.bot, false, message.context);
    renderDrawResult(dom, message.artwork, message.reason);
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent(message.ok ? "AI 그림 월드 등록 완료" : (message.reason || "AI 그림 생성 실패"));
    setBotState(message.ok ? "AI 그림 등록 완료" : (message.reason || "AI 그림 생성 실패"));
    return;
  }
  if (message.type === "aiBotDrawPlanned") {
    renderDrawResult(dom, message.artwork, message.reason);
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent(message.ok ? "AI 그림 미리보기 생성" : (message.reason || "AI 그림 미리보기 실패"));
    setDrawStatus(dom, message.ok ? "미리보기 완료" : (message.reason || "미리보기 실패"));
    return;
  }
  if (message.type === "aiBotDrawStarted") {
    if (message.bot) renderBot(message.bot, false, message.context);
    renderDrawResult(dom, message.artwork, message.reason);
    renderDrawProgress(dom, message.bot?.ai?.draw);
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent(message.ok ? "AI 그림 그리기 시작" : (message.reason || "AI 그림 시작 실패"));
    setDrawStatus(dom, message.ok ? "천천히 그리는 중" : (message.reason || "시작 실패"));
    return;
  }
  if (message.type === "aiBotDrawCancelled") {
    if (message.bot) renderBot(message.bot, false, message.context);
    renderDrawProgress(dom, message.bot?.ai?.draw);
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent(message.ok ? "AI 그림 취소됨" : (message.reason || "AI 그림 취소 실패"));
    setDrawStatus(dom, message.ok ? "취소됨" : (message.reason || "취소 실패"));
    return;
  }
  if (message.type === "aiBotRemoved") {
    viewState.emptyStatusText = "퇴장 완료";
    viewState.currentContext = message.context || null;
    renderNoBot();
    renderDebugSnapshot(dom, message.debug);
    appendBotEvent("퇴장 완료");
  }
}
function renderBot(bot, created, context = viewState.currentContext) {
  renderBotView(dom, ROOM, bot, created, context, viewState, PROACTIVE_COOLDOWN_MS);
  renderConversationStorage(context?.conversation || bot?.ai?.dialogue?.saved);
  renderDrawProgress(dom, bot?.ai?.draw);
  const drawStatus = bot?.ai?.draw?.status;
  if (drawStatus === "drawing") setDrawStatus(dom, "천천히 그리는 중");
  if (drawStatus === "done") setDrawStatus(dom, "완료");
  if (drawStatus === "cancelled") setDrawStatus(dom, "취소됨");
}

function renderNoBot(statusText = viewState.emptyStatusText, context = viewState.currentContext) {
  renderNoBotView(dom, ROOM, statusText, viewState);
  viewState.currentContext = context || null;
  renderConversationStorage(context?.conversation);
  renderDrawProgress(dom, null);
}

function setControls(hasBot, mode = "idle") {
  setBotControls(dom, hasBot, mode, viewState, PROACTIVE_COOLDOWN_MS);
  if (dom.conversationSaveButton) dom.conversationSaveButton.disabled = !socket || socket.readyState !== WebSocket.OPEN;
  if (dom.conversationExportButton) dom.conversationExportButton.disabled = !socket || socket.readyState !== WebSocket.OPEN;
}

function appendStateEvent(bot) {
  viewState.lastStateEventKey = appendBotStateEvent(bot, viewState.lastStateEventKey, appendBotEvent);
}

function setBotState(text) {
  setBotStateText(dom, text);
}

function setStatus(text, mode) {
  setConnectionStatus(dom, text, mode);
}
function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}
function requestBotState() {
  send({ type: "aiBotState", room: ROOM });
}

function renderConversationStorage(summary) {
  if (!summary) return;
  if (dom.conversationEventCount) dom.conversationEventCount.textContent = `${Number(summary.totalEvents) || 0}개`;
  if (dom.conversationSavedAt) dom.conversationSavedAt.textContent = formatStorageTime(summary.latestSavedAt);
  if (dom.conversationTopIntents) dom.conversationTopIntents.textContent = formatStats(summary.topIntents);
  if (dom.conversationSaveButton) dom.conversationSaveButton.disabled = !socket || socket.readyState !== WebSocket.OPEN;
  if (dom.conversationExportButton) dom.conversationExportButton.disabled = !socket || socket.readyState !== WebSocket.OPEN;
}

function downloadConversationJson(data) {
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ai-bot-conversations-${ROOM}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatStorageTime(value) {
  const time = Number(value);
  if (!Number.isFinite(time) || time <= 0) return "아직 없음";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(time));
}

function formatStats(stats) {
  return Array.isArray(stats) && stats.length
    ? stats.slice(0, 3).map((entry) => `${entry.key} ${entry.count}`).join(", ")
    : "없음";
}
