import { getTalkSummaries } from "./talk-log.js";

export function renderMemory(dom, memory) {
  const total = Number(memory?.total) || 0;
  const summaries = getTalkSummaries();
  dom.memoryCount.textContent = `${total + summaries.length}개`;
  const recent = Array.isArray(memory?.recent) ? memory.recent : [];
  if (!recent.length && !summaries.length) {
    dom.memoryList.replaceChildren(createMemoryItem("아직 기록 없음"));
    return;
  }
  const items = [
    ...summaries.map((note) => createMemoryItem(note)),
    ...recent.slice(0, Math.max(0, 4 - summaries.length)).map((entry) => (
      createMemoryItem(`${formatTime(entry.at)} ${entry.target} · ${entry.score || 0}점`)
    ))
  ];
  dom.memoryList.replaceChildren(...items);
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
