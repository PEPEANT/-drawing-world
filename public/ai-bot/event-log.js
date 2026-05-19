const MAX_EVENT_ITEMS = 16;

export function appendBotEvent(text) {
  const list = document.querySelector("#eventLog");
  if (!list || !text) return;
  if (list.children.length === 1 && isEmptyItem(list.firstElementChild)) {
    list.replaceChildren();
  }
  const item = document.createElement("li");
  item.textContent = `${formatTime(Date.now())} ${text}`;
  list.prepend(item);
  while (list.children.length > MAX_EVENT_ITEMS) list.lastElementChild?.remove();
}

export function resetBotEvents() {
  const list = document.querySelector("#eventLog");
  if (!list) return;
  const item = document.createElement("li");
  item.dataset.empty = "true";
  item.textContent = "최근 이벤트가 여기에 쌓여.";
  list.replaceChildren(item);
}

function isEmptyItem(item) {
  return item?.dataset.empty === "true" || item?.textContent === "최근 이벤트가 여기에 쌓여.";
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(value));
}
