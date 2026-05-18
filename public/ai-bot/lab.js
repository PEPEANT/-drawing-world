const ROOM = "lobby";
const dom = {
  authForm: document.querySelector("#authForm"),
  keyInput: document.querySelector("#keyInput"),
  authMessage: document.querySelector("#authMessage"),
  labBody: document.querySelector("#labBody"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  createButton: document.querySelector("#createBotButton"),
  walkButton: document.querySelector("#walkBotButton"),
  stopButton: document.querySelector("#stopBotButton"),
  leaveButton: document.querySelector("#leaveBotButton"),
  talkForm: document.querySelector("#talkForm"),
  talkInput: document.querySelector("#talkInput"),
  talkButton: document.querySelector("#talkButton"),
  talkReply: document.querySelector("#talkReply"),
  botTitle: document.querySelector("#botTitle"),
  botRoom: document.querySelector("#botRoom"),
  botState: document.querySelector("#botState"),
  botSkin: document.querySelector("#botSkin"),
  botSpeech: document.querySelector("#botSpeech"),
  memoryCount: document.querySelector("#memoryCount"),
  memoryList: document.querySelector("#memoryList"),
  cortexStatus: document.querySelector("#cortexStatus"),
  cortexDetail: document.querySelector("#cortexDetail"),
  senseState: document.querySelector("#senseState"),
  memoryState: document.querySelector("#memoryState"),
  intentState: document.querySelector("#intentState"),
  actionState: document.querySelector("#actionState")
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
dom.createButton.addEventListener("click", () => {
  send({ type: "aiBotCreate", room: ROOM });
  setBotState("AI봇 생성 요청 중");
});
dom.walkButton.addEventListener("click", () => {
  send({ type: "aiBotWalk", room: ROOM });
  setBotState("관측 이동 요청 중");
});
dom.stopButton.addEventListener("click", () => {
  send({ type: "aiBotStop", room: ROOM });
  setBotState("멈춤 요청 중");
});

dom.leaveButton.addEventListener("click", () => {
  send({ type: "aiBotRemove", room: ROOM });
  setBotState("퇴장 요청 중");
});

dom.talkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = dom.talkInput.value.trim();
  if (!text) return;
  dom.talkInput.value = "";
  dom.talkReply.textContent = "AI봇이 생각하는 중...";
  send({ type: "aiBotTalk", room: ROOM, text });
});

if (dom.keyInput.value) connect(dom.keyInput.value);

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
    setStatus("AI봇 실험실 연결됨", "online");
    requestBotState();
    stateTimer = window.setInterval(requestBotState, 1600);
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
    renderBot(message.bot, message.created);
    return;
  }
  if (message.type === "aiBotStopped" || message.type === "aiBotState") {
    message.bot ? renderBot(message.bot, false) : renderNoBot();
    return;
  }
  if (message.type === "aiBotTalked") {
    dom.talkReply.textContent = message.reply || "AI봇이 조용히 고개를 끄덕였어.";
    if (message.bot) renderBot(message.bot, false);
    return;
  }
  if (message.type === "aiBotRemoved") renderNoBot();
}

function renderBot(bot, created) {
  const ai = bot?.ai || {};
  dom.botTitle.textContent = bot?.name || "AI봇";
  dom.botRoom.textContent = `room: ${ROOM}`;
  dom.botState.textContent = getBotStateText(bot, created);
  dom.labBody.classList.add("has-bot");
  dom.cortexStatus.textContent = "토대 온라인";
  dom.senseState.textContent = ai.mode === "idle" ? "대기" : "활성";
  dom.memoryState.textContent = getTargetText(bot);
  dom.intentState.textContent = ai.intent || "대기";
  dom.actionState.textContent = getActionText(bot);
  dom.cortexDetail.textContent = ai.reason || "AI봇이 월드 상태를 읽고 다음 관측 지점을 고르고 있어.";
  dom.botSkin.src = bot?.skin || "";
  dom.botSkin.hidden = !bot?.skin;
  setSpeech(ai.speech || getMoodText(bot));
  setControls(true, ai.mode);
  renderMemory(ai.memory);
  setBotState(getBotStatusText(bot, created));
}

function renderNoBot() {
  dom.botTitle.textContent = "대기 중";
  dom.botRoom.textContent = `room: ${ROOM}`;
  dom.botState.textContent = "bot: 없음";
  dom.labBody.classList.remove("has-bot");
  dom.cortexStatus.textContent = "토대 연결됨";
  dom.senseState.textContent = "대기";
  dom.memoryState.textContent = "비어 있음";
  dom.intentState.textContent = "준비";
  dom.actionState.textContent = "잠김";
  dom.cortexDetail.textContent = "AI봇을 생성하면 감각, 기억, 의도, 행동 회로가 연결돼.";
  dom.botSkin.removeAttribute("src");
  dom.botSkin.hidden = true;
  setSpeech("...");
  setControls(false);
  renderMemory(null);
  setBotState("대기 중");
}

function setControls(hasBot, mode = "idle") {
  dom.createButton.disabled = hasBot;
  dom.walkButton.disabled = !hasBot || mode === "walking";
  dom.stopButton.disabled = !hasBot || mode !== "walking";
  dom.leaveButton.disabled = !hasBot;
  dom.talkButton.disabled = !hasBot;
}

function getActionText(bot) {
  if (bot?.ai?.mode === "walking") return "이동 중";
  if (bot?.ai?.mode === "observing") return "관찰 중";
  return "생성 완료";
}

function getTargetText(bot) {
  const target = bot?.ai?.target || "비어 있음";
  const score = Number(bot?.ai?.score);
  return Number.isFinite(score) ? `${target} · ${score}점` : target;
}

function renderMemory(memory) {
  const total = Number(memory?.total) || 0;
  dom.memoryCount.textContent = `${total}회`;
  const recent = Array.isArray(memory?.recent) ? memory.recent : [];
  if (!recent.length) {
    dom.memoryList.replaceChildren(createMemoryItem("아직 기록 없음"));
    return;
  }
  dom.memoryList.replaceChildren(...recent.slice(0, 4).map((entry) => (
    createMemoryItem(`${formatTime(entry.at)} ${entry.target} · ${entry.score || 0}점`)
  )));
}

function createMemoryItem(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function formatTime(value) {
  if (!Number.isFinite(value)) return "--:--";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getBotStatusText(bot, created) {
  if (bot?.ai?.mode === "walking") return "관측 이동 중";
  if (bot?.ai?.mode === "observing") return "관찰 중";
  return created ? "생성됨" : "이미 생성됨";
}

function getBotStateText(bot, created) {
  if (bot?.ai?.mode === "walking") return "bot: walking";
  if (bot?.ai?.mode === "observing") return "bot: observing";
  return created ? "bot: created" : "bot: online";
}

function getMoodText(bot) {
  if (bot?.ai?.mode === "walking") return "이동하면서 주변 그림을 찾는 중이야.";
  if (bot?.ai?.mode === "observing") return "방금 장면을 기억에 저장했어.";
  return "대기 중이야. 말을 걸어도 돼.";
}

function setSpeech(text) {
  dom.botSpeech.textContent = text || "...";
}

function setBotState(text) {
  dom.statusText.textContent = text;
}

function setStatus(text, mode) {
  dom.statusText.textContent = text;
  dom.statusDot.className = `status-dot ${mode === "online" ? "online" : mode === "error" ? "error" : ""}`;
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function requestBotState() {
  send({ type: "aiBotState", room: ROOM });
}
