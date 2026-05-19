export function buildNeuralDecision(bot, context = {}, options = {}) {
  const nodes = new Set();
  const links = new Set();
  if (!bot) {
    return {
      nodes,
      links,
      badge: "대기",
      inputLabel: "대기",
      score: 0,
      memoryLabel: "비어 있음",
      intentLabel: "대기",
      actionLabel: "대기",
      reason: "AI봇을 생성하면 감각 입력이 신경망에 연결돼."
    };
  }

  const ai = bot.ai || {};
  const memory = ai.memory || {};
  const dialogue = ai.dialogue || {};
  const latestDialogue = dialogue.latest || null;
  const topSignal = firstSignal(ai.attention) || firstSignal(context.attention) || firstSignal(ai.senses) || firstSignal(context.senses);
  let type = normalizeSignalType(topSignal?.type);
  if (dialogue.latestIsFresh && latestDialogue) type = "chat";
  if (type === "patrol" && context.featuredCount > 0) type = "top";
  if (type === "patrol" && context.strokeCount > 0) type = "recent_art";
  if (type === "patrol" && context.nearbyPlayers > 0) type = "human";

  const score = Math.max(
    getFallbackScore(type, context),
    Math.round(Number(latestDialogue?.interestScore || 0)),
    Math.round(Number(topSignal?.interest ?? topSignal?.score ?? 0))
  );
  const text = String(options.lastUserText || latestDialogue?.rawText || "");
  const talkingNow = Boolean(
    (options.lastTalkAt && Date.now() - options.lastTalkAt < 8000) ||
    (latestDialogue?.createdAt && Date.now() - latestDialogue.createdAt < 90000)
  );
  const wantsUserArt = /내\s*그림|그림\s*봐|봐줘|작품/.test(text);
  const wantsStop = /멈|정지|stop/i.test(text) || ai.mode === "stopped";
  const hasRoute = Boolean(ai.route?.name);
  const isQuietPatrol = ai.mode === "quiet_patrol";
  const isSleeping = ai.mode === "sleeping";
  const isWaking = ai.mode === "waking";

  nodes.add("sense");
  if (type === "human" || context.nearbyPlayers > 0) activate(nodes, links, "player", "player-sense");
  if (type === "recent_art" || wantsUserArt || context.strokeCount > 0) activate(nodes, links, "art", "art-sense");
  if (type === "top" || context.featuredCount > 0) {
    activate(nodes, links, "top", "top-attention");
    activate(nodes, links, "likes", "likes-attention");
  }
  if (type === "chat" || talkingNow || text) {
    activate(nodes, links, "chat", "chat-attention");
    links.add("chat-memory");
  }

  if (score > 0 || talkingNow || text || type !== "patrol") {
    nodes.add("attention");
    links.add("sense-attention");
    links.add("attention-intent");
  }
  if (Number(memory.total) > 0 || talkingNow || wantsUserArt) {
    nodes.add("memory");
    links.add("memory-intent");
  }

  nodes.add("intent");
  if (hasRoute || ai.mode === "walking" || isQuietPatrol) {
    nodes.add("route");
    nodes.add("move");
    links.add("intent-route");
    links.add("route-move");
  }
  if (ai.speech || talkingNow || isWaking) {
    nodes.add("speech");
    links.add("intent-speech");
  }
  if (type === "recent_art" || type === "top" || type === "human" || ai.mode === "observing") {
    nodes.add("observe");
    links.add("intent-observe");
  }
  if (wantsUserArt) {
    nodes.add("user-art");
    links.add("intent-user-art");
  }
  if (wantsStop || isSleeping) {
    nodes.add("stop");
    links.add("intent-stop");
  }

  const inputLabel = getActiveInputLabel(type, text, context, wantsUserArt);
  const intentLabel = getIntentLabel(ai, wantsUserArt, wantsStop, type);
  const actionLabel = getOutputLabel(ai, wantsUserArt, wantsStop, type, talkingNow);
  return {
    nodes,
    links,
    badge: getBotStatusText(bot),
    inputLabel,
    score,
    memoryLabel: getMemoryLayerText(memory, Number(options.talkCount) || 0),
    intentLabel,
    actionLabel,
    reason: buildReason({ ai, type, score, talkingNow, wantsUserArt, wantsStop, inputLabel, intentLabel, actionLabel })
  };
}

function activate(nodes, links, node, link) {
  nodes.add(node);
  if (link) links.add(link);
}

function firstSignal(list) {
  return Array.isArray(list) && list.length ? list[0] : null;
}

function normalizeSignalType(type) {
  if (type === "recent_art") return "recent_art";
  if (type === "top") return "top";
  if (type === "human") return "human";
  if (type === "chat") return "chat";
  return "patrol";
}

function getFallbackScore(type, context = {}) {
  if (type === "top") return 70 + Math.min(20, Number(context.featuredCount || 0) * 5);
  if (type === "recent_art") return 60 + Math.min(20, Math.floor(Number(context.strokeCount || 0) / 80));
  if (type === "human") return 30 + Math.min(20, Number(context.nearbyPlayers || 0) * 8);
  if (type === "chat") return 100;
  return 0;
}

function getActiveInputLabel(type, text, context, wantsUserArt) {
  if (text || type === "chat") return wantsUserArt ? "채팅 요청: 내 그림 봐줘" : "채팅 요청";
  if (type === "top") return "TOP 변화";
  if (type === "recent_art") return "그림 감지";
  if (type === "human" || context.nearbyPlayers > 0) return "플레이어 감지";
  if (context.featuredCount > 0) return "좋아요 변화";
  return "순찰 대기";
}

function getIntentLabel(ai, wantsUserArt, wantsStop, type) {
  if (wantsStop) return "정지";
  if (wantsUserArt) return "유저 그림 관찰";
  if (ai.route?.purpose) return ai.route.purpose;
  if (ai.intent) return ai.intent;
  if (type === "top") return "TOP 관찰";
  if (type === "recent_art") return "최근 그림 관찰";
  if (type === "human") return "플레이어 관찰";
  return "순찰";
}

function getOutputLabel(ai, wantsUserArt, wantsStop, type, talkingNow) {
  if (ai.mode === "quiet_patrol") return "저전력 순찰";
  if (ai.mode === "sleeping") return "수면";
  if (ai.mode === "waking") return "기상";
  if (wantsStop) return "멈춤";
  if (wantsUserArt) return "이동 + 말풍선";
  if (ai.mode === "walking") return "이동";
  if (talkingNow || ai.speech) return "말풍선";
  if (type === "top" || type === "recent_art" || type === "human") return "관찰";
  return "대기";
}

function buildReason({ ai, type, score, talkingNow, wantsUserArt, wantsStop, inputLabel, intentLabel, actionLabel }) {
  if (wantsUserArt) {
    return "채팅 요청이 관심망을 활성화했고, 기억망이 최근 그림 단서를 확인한 뒤 유저 그림 관찰 의도를 선택했어.";
  }
  if (wantsStop) {
    return "정지 요청이 의도망을 거쳐 행동 출력을 멈춤으로 고정했어.";
  }
  if (talkingNow) {
    return "채팅 요청이 관심망을 켜고, 의도망이 짧은 말풍선 응답을 선택했어.";
  }
  if (ai.mode === "walking") {
    return `감각 입력 ${inputLabel}이 관심망 ${score}점으로 평가되어, 경로망이 ${ai.route?.name || "관측 경로"}를 선택했어.`;
  }
  if (type === "top") {
    return `TOP 변화 신호가 관심망 ${score}점으로 올라와 의도망이 TOP 관찰을 선택했어.`;
  }
  if (type === "recent_art") {
    return `최근 그림 감지가 감각망과 관심망을 켰고, 의도망이 ${intentLabel}을 선택했어.`;
  }
  if (type === "human") {
    return `플레이어 감지가 감각망으로 들어와 의도망이 ${actionLabel} 출력을 준비했어.`;
  }
  return "현재 강한 감각 입력은 없어서 순찰 대기 상태로 신경망을 낮게 유지하고 있어.";
}

function getBotStatusText(bot) {
  if (bot?.ai?.mode === "quiet_patrol") return "저전력 순찰 중";
  if (bot?.ai?.mode === "sleeping") return "수면 중";
  if (bot?.ai?.mode === "waking") return "기상 중";
  if (bot?.ai?.mode === "walking") return "관측 이동 중";
  if (bot?.ai?.mode === "observing") return "관찰 중";
  if (bot?.ai?.mode === "stopped") return "정지";
  if (bot?.ai?.mode === "created") return "생성됨";
  return "온라인";
}

function getMemoryLayerText(memory = {}, talkCount = 0) {
  const observed = Number(memory?.total) || 0;
  return `관측 ${observed} · 대화 ${talkCount}`;
}
