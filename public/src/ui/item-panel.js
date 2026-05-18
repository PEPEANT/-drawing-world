import { findItemAt, getItem, player, state } from "../state.js";
import { initAudioUpload } from "./audio-upload.js";
import { addSystemMessage } from "./chat.js";
import { ui } from "./dom.js";

const ITEM_TYPES = [
  { id: "flag", label: "깃발" },
  { id: "radio", label: "라디오" }
];

let currentAudio = null;
let currentRadioId = null;
let sendToServer = null;

export function initItemPanel({ send, setTool }) {
  sendToServer = send;
  renderItemTypes();
  initAudioUpload();
  syncItemPanel();
  ui.itemPanelClose.addEventListener("click", closeItemPanel);
  ui.itemPopupClose.addEventListener("click", closeItemPopup);
  ui.itemOpenLinkButton.addEventListener("click", openSelectedLink);
  ui.itemPlayRadioButton.addEventListener("click", () => playSelectedRadio(true));

  ui.itemTypeButtons.addEventListener("click", (event) => {
    const button = event.target.closest("[data-item-type]");
    if (!button) return;
    state.itemType = button.dataset.itemType;
    localStorage.setItem("drawing-online:item-type", state.itemType);
    setTool("item");
    syncItemPanel();
  });

  window.addEventListener("radioPlay", (event) => {
    playRadioById(event.detail.id, false);
  });
  window.addEventListener("radioBusy", (event) => {
    stopRadio();
    addSystemMessage("이미 다른 라디오가 재생 중이야.");
  });
  window.addEventListener("radioStop", (event) => stopRadio(event.detail.id));
  window.addEventListener("beforeunload", sendCurrentRadioStop);
}

export function toggleItemPanel() {
  if (ui.itemPanel.classList.contains("hidden")) {
    openItemPanel();
    return;
  }
  closeItemPanel();
}

export function openItemPanel() {
  ui.itemPanel.classList.remove("hidden");
  syncItemPanel();
}

export function closeItemPanel() {
  ui.itemPanel.classList.add("hidden");
}

export function syncItemPanel() {
  for (const button of ui.itemTypeButtons.querySelectorAll("[data-item-type]")) {
    button.classList.toggle("active", button.dataset.itemType === state.itemType);
  }
  const isRadio = state.itemType === "radio";
  ui.itemUrlField.classList.toggle("hidden", isRadio);
  ui.itemAudioField.classList.toggle("hidden", !isRadio);
  ui.itemUrlLabel.textContent = isRadio ? "업로드 주소" : "링크";
  ui.itemHint.textContent = getHint();
}

export function handleItemPointer(point, send) {
  const touchedItem = findItemAt(point);
  if (touchedItem) {
    showItemPopup(touchedItem);
    if (touchedItem.type === "radio") playRadio(touchedItem, send, true);
    return true;
  }
  if (state.tool !== "item") return false;

  const item = buildItem(point);
  if (!item) return true;
  send({ type: "itemAdd", item });
  addSystemMessage(`${item.type === "radio" ? "라디오" : "깃발"} 설치를 요청했어.`);
  return true;
}

function renderItemTypes() {
  ui.itemTypeButtons.replaceChildren();
  for (const itemType of ITEM_TYPES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.itemType = itemType.id;
    button.textContent = itemType.label;
    ui.itemTypeButtons.append(button);
  }
}

function buildItem(point) {
  const type = state.itemType === "radio" ? "radio" : "flag";
  if (hasOwnItem(type)) {
    addSystemMessage(`${type === "radio" ? "라디오" : "깃발"}은 1인당 1개만 설치할 수 있어.`);
    return null;
  }
  const title = ui.itemTitleInput.value.trim() || (type === "radio" ? "라디오" : "깃발");
  const url = normalizeUrl(ui.itemUrlInput.value);
  if (type === "radio" && !url) {
    addSystemMessage("라디오는 MP3 파일을 먼저 선택해야 설치할 수 있어.");
    return null;
  }
  return {
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title: title.slice(0, 24),
    url,
    x: Math.round(point.x),
    y: Math.round(point.y),
    author: state.socketId,
    owner: player.clientId,
    at: Date.now()
  };
}

function showItemPopup(item) {
  state.selectedItemId = item.id;
  ui.itemPopupTitle.textContent = item.title || (item.type === "radio" ? "라디오" : "깃발");
  ui.itemPopupText.textContent = item.url || "연결된 주소가 없어.";
  ui.itemOpenLinkButton.hidden = item.type !== "flag" || !item.url;
  ui.itemPlayRadioButton.hidden = item.type !== "radio" || !item.url;
  ui.itemPopup.classList.remove("hidden");
}

function closeItemPopup() {
  state.selectedItemId = null;
  ui.itemPopup.classList.add("hidden");
}

function openSelectedLink() {
  const item = getItem(state.selectedItemId);
  if (!item?.url) return;
  window.open(item.url, "_blank", "noopener,noreferrer");
}

function playSelectedRadio(shouldBroadcast) {
  const item = getItem(state.selectedItemId);
  if (item?.type === "radio") playRadio(item, sendToServer, shouldBroadcast);
}

function playRadioById(id, shouldBroadcast) {
  const item = getItem(id);
  if (item?.type === "radio") playRadio(item, null, shouldBroadcast);
}

function playRadio(item, send, shouldBroadcast) {
  if (!item.url) return;
  if (currentRadioId && currentRadioId !== item.id) {
    sendCurrentRadioStop();
  }
  if (!currentAudio) currentAudio = new Audio();
  currentAudio.pause();
  currentAudio.src = item.url;
  currentRadioId = item.id;
  currentAudio.onended = () => {
    sendCurrentRadioStop();
    currentRadioId = null;
  };
  currentAudio.onerror = () => {
    sendCurrentRadioStop();
    currentRadioId = null;
  };
  currentAudio.play().then(() => {
    if (shouldBroadcast && send) {
      send({ type: "radioPlay", id: item.id });
    }
  }).catch(() => {
    currentRadioId = null;
    addSystemMessage("브라우저가 자동 재생을 막았어. 라디오를 한 번 직접 클릭해줘.");
  });
}

function stopRadio(id) {
  if (!currentAudio || (id && currentRadioId !== id)) return;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentRadioId = null;
}

function sendCurrentRadioStop() {
  if (currentRadioId && sendToServer) {
    sendToServer({ type: "radioStop", id: currentRadioId });
  }
}

function normalizeUrl(value) {
  const text = value.trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.href.slice(0, 240) : "";
  } catch {
    return "";
  }
}

function getHint() {
  if (state.itemType === "radio") {
    return "MP3 파일을 선택한 뒤 빈 곳을 클릭하면 라디오가 설치돼.";
  }
  return "빈 곳을 클릭하면 링크 깃발이 설치돼.";
}

function hasOwnItem(type) {
  return state.items.some((item) => {
    const owner = item.owner || item.author;
    return item.type === type && (owner === player.clientId || item.author === state.socketId);
  });
}
