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
