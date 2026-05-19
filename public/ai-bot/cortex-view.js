import { buildNeuralDecision } from "./neural-state.js";

export function renderCortexSummary(dom, bot, context = {}, options = {}) {
  const created = Boolean(options.created);
  const lastTalkAt = options.lastTalkAt || 0;
  const cooldownMs = options.cooldownMs || 0;
  const ai = bot.ai || {};
  const memory = ai.memory || {};
  const route = ai.route || {};
  const attention = context.attention?.[0];

  dom.summaryStatus.textContent = getSummaryStatus(bot, created, lastTalkAt);
  dom.summaryPosition.textContent = `${context?.room || bot.room || "lobby"} · ${context?.x ?? Math.round(bot.x || 0)}, ${context?.y ?? Math.round(bot.y || 0)}`;
  dom.summaryAction.textContent = ai.target || getActionText(bot);
  dom.summarySpeech.textContent = ai.speech || getMoodText(bot);
  dom.summaryCooldown.textContent = getProactiveCooldownText(bot, cooldownMs);
  if (dom.summaryGoal) dom.summaryGoal.textContent = attention ? attention.label : route.reason || ai.intent || "-";
  if (dom.summaryWaypoint) dom.summaryWaypoint.textContent = route.name ? `${route.waypointIndex || 1}/${route.waypointTotal || 1}` : "-";
  if (dom.summaryReason) dom.summaryReason.textContent = route.reason || attention?.reason || "-";
  if (dom.summaryNext) dom.summaryNext.textContent = route.next ? `${Math.round(route.next.x)}, ${Math.round(route.next.y)}` : "-";
  if (dom.summarySense) dom.summarySense.textContent = getSenseText(bot, context);
  if (dom.summaryMemory) dom.summaryMemory.textContent = getMemoryLayerText(memory);
  if (dom.summaryIntent) dom.summaryIntent.textContent = ai.intent || route.reason || "대기";
  if (dom.summaryBehavior) dom.summaryBehavior.textContent = getActionText(bot);
  renderNeuralNetwork(dom, bot, context, options);
}

export function resetCortexSummary(dom, room) {
  dom.summaryStatus.textContent = "미생성";
  dom.summaryPosition.textContent = `room: ${room}`;
  dom.summaryAction.textContent = "없음";
  dom.summarySpeech.textContent = "...";
  dom.summaryCooldown.textContent = "대기";
  if (dom.summaryGoal) dom.summaryGoal.textContent = "-";
  if (dom.summaryWaypoint) dom.summaryWaypoint.textContent = "-";
  if (dom.summaryReason) dom.summaryReason.textContent = "-";
  if (dom.summaryNext) dom.summaryNext.textContent = "-";
  if (dom.summarySense) dom.summarySense.textContent = "감각 대기";
  if (dom.summaryMemory) dom.summaryMemory.textContent = "비어 있음";
  if (dom.summaryIntent) dom.summaryIntent.textContent = "대기";
  if (dom.summaryBehavior) dom.summaryBehavior.textContent = "대기";
  renderRouteStatus(dom, null);
  renderAttentionList(dom, []);
  renderNeuralNetwork(dom, null, { room });
}

export function renderRouteStatus(dom, route) {
  if (!route || !route.name) {
    dom.routePurpose.textContent = "대기";
    dom.routeName.textContent = "없음";
    dom.routeWaypoint.textContent = "-";
    dom.routeNext.textContent = "-";
    return;
  }

  dom.routePurpose.textContent = route.purpose || "관측";
  dom.routeName.textContent = route.name || "route";
  dom.routeWaypoint.textContent = `${route.waypointIndex || 1} / ${route.waypointTotal || 1} · ${route.current || "경유지"}`;
  dom.routeNext.textContent = route.next ? `${route.next.x}, ${route.next.y}` : "-";
}

export function renderAttentionList(dom, attention = []) {
  if (!dom.attentionList) return;
  dom.attentionList.innerHTML = "";

  if (!attention.length) {
    const item = document.createElement("li");
    item.className = "cortex-empty";
    item.textContent = "관심 점수 대기 중";
    dom.attentionList.appendChild(item);
    return;
  }

  attention.slice(0, 3).forEach((entry) => {
    dom.attentionList.appendChild(createAttentionItem(entry));
  });
}

export function renderNeuralNetwork(dom, bot, context = {}, options = {}) {
  if (!dom.neuralDemo) return;
  const decision = buildNeuralDecision(bot, context, options);

  dom.neuralDemo.querySelectorAll("[data-neuron]").forEach((node) => {
    node.classList.toggle("is-active", decision.nodes.has(node.dataset.neuron));
  });
  dom.neuralDemo.querySelectorAll("[data-synapse]").forEach((link) => {
    const active = decision.links.has(link.dataset.synapse);
    link.classList.toggle("is-active", active);
    link.classList.toggle("is-output", active && link.dataset.synapse.includes("intent-"));
    link.classList.toggle("is-route", active && link.dataset.synapse === "route-move");
  });

  if (dom.neuralStateBadge) dom.neuralStateBadge.textContent = decision.badge;
  if (dom.neuralInput) dom.neuralInput.textContent = decision.inputLabel;
  if (dom.neuralAttention) dom.neuralAttention.textContent = `${decision.score}점`;
  if (dom.neuralMemory) dom.neuralMemory.textContent = decision.memoryLabel;
  if (dom.neuralAction) dom.neuralAction.textContent = decision.actionLabel;
  if (dom.neuralReason) dom.neuralReason.textContent = decision.reason;
  if (dom.attentionScoreLabel) dom.attentionScoreLabel.textContent = `${decision.score}점`;
  if (dom.intentLabel) dom.intentLabel.textContent = decision.intentLabel;
}

export function getActionText(bot) {
  if (bot?.ai?.mode === "quiet_patrol") return "저전력 순찰";
  if (bot?.ai?.mode === "sleeping") return "수면 중";
  if (bot?.ai?.mode === "waking") return "기상 중";
  if (bot?.ai?.mode === "drawing") return "그리는 중";
  if (bot?.ai?.mode === "walking") return "이동 중";
  if (bot?.ai?.mode === "observing") return "관찰 중";
  if (bot?.ai?.mode === "stopped") return "정지";
  return "생성 완료";
}

export function getBotStatusText(bot, created) {
  if (bot?.ai?.mode === "quiet_patrol") return "저전력 순찰 중";
  if (bot?.ai?.mode === "sleeping") return "수면 중";
  if (bot?.ai?.mode === "waking") return "기상 중";
  if (bot?.ai?.mode === "drawing") return "그림 그리는 중";
  if (bot?.ai?.mode === "walking") return "관측 이동 중";
  if (bot?.ai?.mode === "observing") return "관찰 중";
  if (bot?.ai?.mode === "stopped" || bot?.ai?.mode === "created") return bot.ai.mode === "stopped" ? "정지" : "생성됨";
  return created ? "생성됨" : "이미 생성됨";
}

export function getBotStateText(bot, created) {
  if (bot?.ai?.mode === "quiet_patrol") return "bot: quiet patrol";
  if (bot?.ai?.mode === "sleeping") return "bot: sleeping";
  if (bot?.ai?.mode === "waking") return "bot: waking";
  if (bot?.ai?.mode === "drawing") return "bot: drawing";
  if (bot?.ai?.mode === "walking") return "bot: walking";
  if (bot?.ai?.mode === "observing") return "bot: observing";
  if (bot?.ai?.mode === "stopped" || bot?.ai?.mode === "created") return `bot: ${bot.ai.mode}`;
  return created ? "bot: created" : "bot: online";
}

export function getMoodText(bot) {
  if (bot?.ai?.mode === "quiet_patrol") return "조용히 순찰 중.";
  if (bot?.ai?.mode === "sleeping") return "잠깐 잘게.";
  if (bot?.ai?.mode === "waking") return "잠에서 깨는 중.";
  if (bot?.ai?.mode === "drawing") return "천천히 선을 올리는 중.";
  if (bot?.ai?.mode === "walking") return "이동하면서 주변 그림을 찾는 중이야.";
  if (bot?.ai?.mode === "observing") return "방금 장면을 기억에 저장했어.";
  if (bot?.ai?.mode === "stopped") return "멈춰 있어. 다시 이동 버튼을 누르면 움직일게.";
  return "대기 중이야. 말을 걸어도 돼.";
}

export function getSenseText(bot, context = {}) {
  if (bot?.ai?.mode === "quiet_patrol") return "사람 없음 · 저전력 순찰";
  if (bot?.ai?.mode === "sleeping") return "방 비어 있음 · 수면";
  if (bot?.ai?.mode === "waking") return "유저 입장 · 기상";
  if (bot?.ai?.mode === "drawing") return "AI 그림 stroke 생성";
  const sense = bot?.ai?.senses?.[0] || context?.senses?.[0];
  if (sense) return `${sense.label} · ${sense.interest}점`;
  if (context?.nearbyPlayers > 0) return `근처 플레이어 ${context.nearbyPlayers}명`;
  if (context?.featuredCount > 0) return `TOP 후보 ${context.featuredCount}개`;
  if (context?.strokeCount > 0) return `선 ${context.strokeCount}개 감지`;
  if (bot?.ai?.mode === "walking") return "이동 경로 추적";
  return "월드 대기";
}

export function getMemoryLayerText(memory = {}, talkCount = 0) {
  const observed = Number(memory?.total) || 0;
  return `관측 ${observed} · 대화 ${talkCount}`;
}

export function isProactiveCoolingDown(bot, cooldownMs, now = Date.now()) {
  return getProactiveCooldownMs(bot, cooldownMs, now) > 0;
}

export function getProactiveCooldownText(bot, cooldownMs, now = Date.now()) {
  const remaining = getProactiveCooldownMs(bot, cooldownMs, now);
  if (remaining <= 0) return "가능";
  return `${Math.ceil(remaining / 1000)}초 후`;
}

function createAttentionItem(entry) {
  const item = document.createElement("li");
  item.className = "attention-item";

  const label = document.createElement("span");
  label.textContent = entry.label || entry.type || "감각";

  const score = document.createElement("strong");
  score.textContent = `${entry.score || 0}점`;

  const reason = document.createElement("small");
  reason.textContent = entry.reason || "관찰";

  item.append(label, score, reason);
  return item;
}

function getSummaryStatus(bot, created, lastTalkAt) {
  if (!bot) return "미생성";
  if (lastTalkAt && Date.now() - lastTalkAt < 5000) return "대화 중";
  return getBotStatusText(bot, created);
}

function getProactiveCooldownMs(bot, cooldownMs, now) {
  const last = Number(bot?.ai?.proactiveAt) || 0;
  if (!last) return 0;
  return Math.max(0, cooldownMs - (now - last));
}
