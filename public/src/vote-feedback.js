import { state } from "./state.js";

const DURATION = 1700;

export function addVoteFeedback(feedback) {
  const targetId = typeof feedback?.targetId === "string" ? feedback.targetId : "";
  if (!targetId) return;

  const isDislike = feedback.value === -1;
  state.voteBubbles.set(targetId, {
    text: isDislike ? "비추 -1" : "좋아요 +1",
    color: isDislike ? "rgba(220, 38, 38, 0.9)" : "rgba(22, 163, 74, 0.92)",
    duration: DURATION,
    expiresAt: Date.now() + DURATION
  });
}

export function addFeaturedFeedback(targetId, text) {
  if (typeof targetId !== "string" || !targetId) return;
  state.voteBubbles.set(targetId, {
    text: text || "스크린 후보 등록!",
    color: "rgba(37, 99, 235, 0.94)",
    duration: 2200,
    expiresAt: Date.now() + 2200
  });
}
