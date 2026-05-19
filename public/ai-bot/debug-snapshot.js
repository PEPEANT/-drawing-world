export function renderDebugSnapshot(dom, debug) {
  if (!dom.debugSnapshot) return;
  if (!debug) {
    dom.debugSnapshot.textContent = "AI봇 상태 수신 대기 중";
    renderInvariantList(dom, []);
    renderDebugEvents(dom, []);
    return;
  }

  dom.debugSnapshot.textContent = JSON.stringify(buildCompactSnapshot(debug), null, 2);
  renderInvariantList(dom, debug.invariants || []);
  renderDebugEvents(dom, debug.events || []);
}

function buildCompactSnapshot(debug) {
  return {
    schema: debug.schemaVersion,
    room: debug.room,
    mode: debug.state?.mode || "idle",
    intent: debug.state?.intent || "대기",
    target: debug.state?.target || "",
    score: debug.state?.score || 0,
    reason: debug.state?.reason || "",
    route: debug.route ? {
      name: debug.route.name,
      waypoint: `${debug.route.waypointIndex}/${debug.route.waypointTotal}`,
      next: debug.route.next
    } : null,
    attention: (debug.perception?.attention || []).slice(0, 3),
    conversationData: debug.conversationData ? {
      total: debug.conversationData.total,
      latest: debug.conversationData.latest ? {
        intent: debug.conversationData.latest.detectedIntent,
        score: debug.conversationData.latest.interestScore,
        note: debug.conversationData.latest.memoryNote,
        nextAction: debug.conversationData.latest.nextAction
      } : null,
      topIntents: debug.conversationData.topIntents || []
    } : null,
    bot: debug.bot ? {
      id: debug.bot.id,
      isBot: debug.bot.isBot,
      moving: debug.bot.moving,
      x: debug.bot.x,
      y: debug.bot.y
    } : null
  };
}

function renderInvariantList(dom, invariants) {
  if (!dom.debugInvariantList) return;
  if (!invariants.length) {
    dom.debugInvariantList.replaceChildren(createListItem("대기", false));
    return;
  }
  dom.debugInvariantList.replaceChildren(...invariants.map((item) => (
    createListItem(`${item.ok ? "OK" : "WARN"} · ${item.label}`, !item.ok)
  )));
}

function renderDebugEvents(dom, events) {
  if (!dom.debugEventList) return;
  if (!events.length) {
    dom.debugEventList.replaceChildren(createListItem("최근 AI 이벤트 없음", false));
    return;
  }
  dom.debugEventList.replaceChildren(...events.slice(0, 6).map((event) => {
    const time = formatTime(event.at);
    const detail = event.detail ? ` · ${event.detail}` : "";
    return createListItem(`${time} ${event.label || event.type}${detail}`, false);
  }));
}

function createListItem(text, isWarning) {
  const item = document.createElement("li");
  item.className = isWarning ? "is-warning" : "";
  item.textContent = text;
  return item;
}

function formatTime(value) {
  if (!Number.isFinite(value)) return "--:--";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(value));
}
