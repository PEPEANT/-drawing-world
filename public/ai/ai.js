const dom = {
  authForm: document.querySelector("#authForm"),
  keyInput: document.querySelector("#keyInput"),
  authMessage: document.querySelector("#authMessage"),
  observatory: document.querySelector("#observatory"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  roomSelect: document.querySelector("#roomSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  updatedAt: document.querySelector("#updatedAt"),
  clientCount: document.querySelector("#clientCount"),
  playerCount: document.querySelector("#playerCount"),
  strokeCount: document.querySelector("#strokeCount"),
  messageCount: document.querySelector("#messageCount"),
  riskBadge: document.querySelector("#riskBadge"),
  summaryText: document.querySelector("#summaryText"),
  actionText: document.querySelector("#actionText"),
  signalList: document.querySelector("#signalList"),
  messageList: document.querySelector("#messageList"),
  topicList: document.querySelector("#topicList"),
  announcementInput: document.querySelector("#announcementInput"),
  announceButton: document.querySelector("#announceButton"),
  announceStatus: document.querySelector("#announceStatus"),
  emptyTemplate: document.querySelector("#emptyTemplate")
};

let socket = null;
let currentState = null;
let selectedRoom = "lobby";
let refreshTimer = null;

const savedKey = localStorage.getItem("sdw:admin-key") || "";
const queryKey = new URLSearchParams(location.search).get("key") || "";
dom.keyInput.value = queryKey || savedKey;

dom.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const key = dom.keyInput.value.trim();
  if (!key) {
    dom.authMessage.textContent = "관리자 키를 입력하세요.";
    return;
  }
  localStorage.setItem("sdw:admin-key", key);
  connect(key);
});

dom.refreshButton.addEventListener("click", requestAiState);
dom.roomSelect.addEventListener("change", () => {
  selectedRoom = dom.roomSelect.value;
  render();
});
dom.announceButton.addEventListener("click", () => {
  const text = dom.announcementInput.value.trim();
  if (!text) {
    dom.announceStatus.textContent = "발표할 문구가 없습니다.";
    return;
  }
  send({ type: "aiAnnounce", room: selectedRoom, text });
  dom.announceStatus.textContent = "발표 요청 중...";
});

if (dom.keyInput.value) {
  connect(dom.keyInput.value);
}

function connect(key) {
  if (socket) socket.close();
  setStatus("연결 중", "pending");
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/admin-ws?key=${encodeURIComponent(key)}`);
  socket.addEventListener("open", () => {
    setStatus("AI 관측실 연결됨", "online");
    dom.authForm.classList.add("hidden");
    dom.observatory.classList.remove("hidden");
    requestAiState();
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(requestAiState, 5000);
  });
  socket.addEventListener("close", () => {
    setStatus("연결 끊김", "error");
    window.clearInterval(refreshTimer);
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
  if (message.type === "aiState") {
    currentState = message.state;
    render();
    return;
  }
  if (message.type === "aiPublished") {
    dom.announceStatus.textContent = "게임 채팅에 발표했습니다.";
    dom.announcementInput.value = "";
  }
}

function requestAiState() {
  send({ type: "aiRefresh" });
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function render() {
  if (!currentState) return;
  const rooms = currentState.rooms || [];
  if (!rooms.some((room) => room.name === selectedRoom)) {
    selectedRoom = rooms[0]?.name || "lobby";
  }
  renderRoomSelect(rooms);
  const room = rooms.find((entry) => entry.name === selectedRoom);
  if (!room) return;
  dom.updatedAt.textContent = `${new Date(currentState.at).toLocaleTimeString()} 관측`;
  dom.clientCount.textContent = room.clients;
  dom.playerCount.textContent = room.playerCount;
  dom.strokeCount.textContent = room.strokes;
  dom.messageCount.textContent = room.messages;
  renderObservation(room.observation);
  renderSignals(room.observation?.signals || []);
  renderMessages(room.recentMessages || []);
  renderTopics(room.topics || []);
}

function renderRoomSelect(rooms) {
  const previous = dom.roomSelect.value;
  dom.roomSelect.replaceChildren();
  for (const room of rooms) {
    const option = document.createElement("option");
    option.value = room.name;
    option.textContent = `${room.name} (${room.playerCount}/${room.clients})`;
    dom.roomSelect.append(option);
  }
  dom.roomSelect.value = selectedRoom || previous;
}

function renderObservation(observation) {
  const risk = observation?.risk || "low";
  dom.riskBadge.className = `risk ${risk}`;
  dom.riskBadge.textContent = risk === "high" ? "위험" : risk === "medium" ? "주의" : "안정";
  dom.summaryText.textContent = observation?.summary || "관측 대기 중입니다.";
  dom.actionText.textContent = observation?.recommendedAction || "";
}

function renderSignals(signals) {
  dom.signalList.replaceChildren();
  if (!signals.length) {
    dom.signalList.append(emptyNode());
    return;
  }
  for (const signal of signals) {
    const item = document.createElement("li");
    item.textContent = signal;
    dom.signalList.append(item);
  }
}

function renderMessages(messages) {
  dom.messageList.replaceChildren();
  if (!messages.length) {
    dom.messageList.append(emptyNode());
    return;
  }
  for (const message of [...messages].reverse()) {
    const row = document.createElement("div");
    row.className = "message-row";
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = message.name || "system";
    row.querySelector("span").textContent = message.text || "";
    dom.messageList.append(row);
  }
}

function renderTopics(topics) {
  dom.topicList.replaceChildren();
  if (!topics.length) {
    dom.topicList.append(emptyNode());
    return;
  }
  for (const topic of topics) {
    const card = document.createElement("div");
    card.className = "topic-card";
    card.innerHTML = `<strong></strong><p></p><p></p><button type="button">문구로 채택</button>`;
    card.querySelector("strong").textContent = topic.title;
    card.querySelectorAll("p")[0].textContent = topic.prompt;
    card.querySelectorAll("p")[1].textContent = topic.reason;
    card.querySelector("button").addEventListener("click", () => {
      dom.announcementInput.value = `오늘의 주제: ${topic.title} - ${topic.prompt}`;
      dom.announceStatus.textContent = "문구를 채택했습니다. 발표 버튼을 누르면 게임 채팅에 올라갑니다.";
    });
    dom.topicList.append(card);
  }
}

function emptyNode() {
  return dom.emptyTemplate.content.firstElementChild.cloneNode(true);
}

function setStatus(text, mode) {
  dom.statusText.textContent = text;
  dom.statusDot.className = `status-dot ${mode === "online" ? "online" : mode === "error" ? "error" : ""}`;
}
