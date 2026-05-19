const MAX_LOG_ITEMS = 12;
const MAX_NOTE_ITEMS = 4;
const conversationNotes = [];

export function appendTalkLog(role, text) {
  const list = document.querySelector("#talkLog");
  if (!list || !text) return;
  if (list.children.length === 1 && isEmptyItem(list.firstElementChild)) {
    list.replaceChildren();
  }
  const item = document.createElement("li");
  item.className = role === "bot" ? "from-bot" : "from-user";
  item.textContent = `${formatTalkTime(Date.now())} ${role === "bot" ? "AI봇" : "나"}: ${text}`;
  list.prepend(item);
  while (list.children.length > MAX_LOG_ITEMS) list.lastElementChild?.remove();
}

export function rememberTalkSummary(text, bot) {
  for (const note of buildTalkNotes(text, bot)) {
    rememberTalkNote(note);
  }
}

export function rememberTalkNote(note) {
  if (!note || conversationNotes.includes(note)) return;
  conversationNotes.unshift(note);
  while (conversationNotes.length > MAX_NOTE_ITEMS) conversationNotes.pop();
}

export function getTalkSummaries() {
  return conversationNotes.slice();
}

export function resetTalkLog() {
  const list = document.querySelector("#talkLog");
  if (!list) return;
  const item = document.createElement("li");
  item.dataset.empty = "true";
  item.textContent = "최근 대화가 여기에 쌓여.";
  list.replaceChildren(item);
}

function isEmptyItem(item) {
  return item?.dataset.empty === "true" || item?.textContent === "최근 대화가 여기에 쌓여.";
}

function buildTalkNotes(text, bot) {
  const notes = [];
  const lower = String(text || "").toLowerCase();
  const ai = bot?.ai || {};
  const target = `${ai.target || ""} ${ai.reason || ""}`;
  if (/(안녕|하이|ㅎㅇ|hello)/i.test(text)) notes.push("관리자가 인사를 건넴");
  if (lower.includes("산책") || lower.includes("움직") || lower.includes("이동")) notes.push("관리자가 산책을 요청함");
  if (lower.includes("멈춰") || lower.includes("멈추")) notes.push("관리자가 정지를 요청함");
  if (lower.includes("인기") || lower.includes("top") || lower.includes("좋아요")) notes.push("관리자가 TOP 그림을 물어봄");
  if (lower.includes("내 그림") || lower.includes("봐줘")) notes.push("관리자가 그림 확인을 요청함");
  if (ai.mode === "walking") notes.push("이동 중 상태에서 대화함");
  if (/top|상단|스크린/i.test(target)) notes.push("AI봇은 TOP 그림을 관찰 중");
  if (lower.includes("뭐") || lower.includes("보고")) notes.push("관리자가 관측 대상을 물어봄");
  return notes;
}

function formatTalkTime(value) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(value));
}
