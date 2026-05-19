const INTENTS = {
  greeting: { text: "안녕", reply: "안녕.", targetMode: "nearby", nextAction: "reply_greeting" },
  observe_user_art: { text: "내 그림 봐줘", reply: "그림 보러 갈게.", targetMode: "user_art", nextAction: "observe_user_art", move: "user_art" },
  observe_here: { text: "여기도 봐줘", reply: "여기 볼게.", targetMode: "point", nextAction: "observe_here", move: "point" },
  chat_together: { text: "같이 대화하자", reply: "잠깐 대화하자.", targetMode: "nearby", nextAction: "start_conversation" },
  ask_popular_art: { text: "인기 그림 알려줘", reply: "TOP 쪽 볼게.", targetMode: "world", nextAction: "observe_top", move: "top" },
  request_art_advice: { text: "그림 조언", reply: "큰 선 하나 더 이어봐.", targetMode: "user_art", nextAction: "give_art_advice" },
  request_next_idea: { text: "다음 아이디어", reply: "작은 배경을 얹어볼래?", targetMode: "user_art", nextAction: "suggest_next_idea" },
  request_color_tip: { text: "색 추천", reply: "색 하나 더 얹어볼래?", targetMode: "user_art", nextAction: "give_color_tip" },
  request_composition_tip: { text: "구도 조언", reply: "중앙을 조금 비워봐.", targetMode: "user_art", nextAction: "give_composition_tip" },
  request_encouragement: { text: "어렵다", reply: "큰 형태부터 잡자.", targetMode: "user_art", nextAction: "encourage_drawing" }
};

function safeIntent(value) {
  return Object.prototype.hasOwnProperty.call(INTENTS, value) ? value : "greeting";
}

function intentScore(nextAction) {
  return {
    observe_user_art: 100,
    route_to_user_art: 100,
    observe_here: 90,
    observe_top: 80,
    give_art_advice: 75,
    suggest_next_idea: 75,
    give_color_tip: 70,
    give_composition_tip: 70,
    encourage_drawing: 65,
    start_conversation: 70,
    reply_greeting: 20
  }[nextAction] || 30;
}

function getIntentLabel(intent) {
  return {
    greeting: "인사 응답",
    observe_user_art: "유저 그림 관찰",
    observe_here: "선택 위치 관찰",
    chat_together: "대화",
    ask_popular_art: "TOP 관찰",
    request_art_advice: "그림 조언",
    request_next_idea: "다음 아이디어",
    request_color_tip: "색 조언",
    request_composition_tip: "구도 조언",
    request_encouragement: "그림 격려"
  }[intent] || "유저 요청";
}

function isAdviceIntent(intent) {
  return [
    "request_art_advice",
    "request_next_idea",
    "request_color_tip",
    "request_composition_tip",
    "request_encouragement"
  ].includes(intent);
}

module.exports = {
  INTENTS,
  getIntentLabel,
  intentScore,
  isAdviceIntent,
  safeIntent
};
