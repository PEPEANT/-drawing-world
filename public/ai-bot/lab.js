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
  botTitle: document.querySelector("#botTitle"),
  botRoom: document.querySelector("#botRoom"),
  botState: document.querySelector("#botState"),
  cortexStatus: document.querySelector("#cortexStatus"),
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
  send({ type: "aiBotCreate", room: "lobby" });
  setBotState("생성 요청 중");
});

dom.walkButton.addEventListener("click", () => {
  send({ type: "aiBotWalk", room: "lobby" });
  setBotState("관측 이동 요청 중");
});

dom.stopButton.addEventListener("click", () => {
  send({ type: "aiBotStop", room: "lobby" });
  setBotState("멈춤 요청 중");
});

dom.leaveButton.addEventListener("click", () => {
  send({ type: "aiBotRemove", room: "lobby" });
  setBotState("퇴장 요청 중");
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
    dom.walkButton.disabled = true;
    dom.stopButton.disabled = true;
    dom.leaveButton.disabled = true;
    dom.cortexStatus.textContent = "토대 연결됨";
    setStatus("봇 실험실 연결됨", "online");
    requestBotState();
    stateTimer = window.setInterval(requestBotState, 1600);
  });
  socket.addEventListener("close", () => {
    if (stateTimer) window.clearInterval(stateTimer);
    stateTimer = null;
    dom.labBody.classList.add("is-locked");
    dom.createButton.disabled = true;
    dom.walkButton.disabled = true;
    dom.stopButton.disabled = true;
    dom.leaveButton.disabled = true;
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
  if (message.type === "aiBotCreated") {
    renderBot(message.bot, message.created);
    return;
  }
  if (message.type === "aiBotWalking") {
    renderBot(message.bot, message.created);
    return;
  }
  if (message.type === "aiBotStopped") {
    if (message.bot) renderBot(message.bot, false);
    else renderNoBot();
    return;
  }
  if (message.type === "aiBotState") {
    if (message.bot) renderBot(message.bot, false);
    else renderNoBot();
    return;
  }
  if (message.type === "aiBotRemoved") {
    renderNoBot();
  }
}

function renderBot(bot, created) {
  dom.botTitle.textContent = bot?.name || "AI 관측자 v2";
  dom.botRoom.textContent = "room: lobby";
  dom.botState.textContent = getBotStateText(bot, created);
  dom.labBody.classList.add("has-bot");
  dom.cortexStatus.textContent = "토대 온라인";
  dom.senseState.textContent = "활성";
  dom.memoryState.textContent = bot?.ai?.target || "비어 있음";
  dom.intentState.textContent = bot?.ai?.intent || "대기";
  dom.actionState.textContent = getActionText(bot);
  dom.createButton.disabled = true;
  dom.walkButton.disabled = bot?.ai?.mode === "walking";
  dom.stopButton.disabled = bot?.ai?.mode !== "walking";
  dom.leaveButton.disabled = false;
  setBotState(getBotStatusText(bot, created));
}

function renderNoBot() {
  dom.botTitle.textContent = "대기 중";
  dom.botRoom.textContent = "room: lobby";
  dom.botState.textContent = "bot: 없음";
  dom.labBody.classList.remove("has-bot");
  dom.cortexStatus.textContent = "토대 연결됨";
  dom.senseState.textContent = "대기";
  dom.memoryState.textContent = "비어 있음";
  dom.intentState.textContent = "준비";
  dom.actionState.textContent = "잠김";
  dom.createButton.disabled = false;
  dom.walkButton.disabled = true;
  dom.stopButton.disabled = true;
  dom.leaveButton.disabled = true;
  setBotState("대기 중");
}

function getActionText(bot) {
  if (bot?.ai?.mode === "walking") return "이동 중";
  if (bot?.ai?.mode === "observing") return "관찰 중";
  return "생성 완료";
}

function getBotStatusText(bot, created) {
  if (bot?.ai?.mode === "walking") return "관측 이동 중";
  if (bot?.ai?.mode === "observing") return "관찰 중";
  return created ? "생성됨" : "이미 생성됨";
}

function getBotStateText(bot, created) {
  if (bot?.ai?.mode === "walking") return "bot: walking";
  if (bot?.ai?.mode === "observing") return "bot: observing";
  return created ? "bot: created" : "bot: already here";
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
  send({ type: "aiBotState", room: "lobby" });
}
