const { LIMITS } = require("./config");

function applyVote(room, vote) {
  const value = vote.value === -1 ? -1 : 1;
  if (!vote.voterId || !vote.targetId || vote.voterId === vote.targetId) {
    return { ok: false, reason: "다른 플레이어에게만 투표할 수 있어." };
  }
  if (!room.players.has(vote.targetId)) {
    return { ok: false, reason: "대상 플레이어가 방에 없어." };
  }

  const votes = getVoteStore(room);
  const key = `${vote.voterId}:${vote.targetId}`;
  const previous = votes.byVoter.get(key) || 0;
  if (previous === value) return { ok: true, changed: false, ranking: buildRanking(room) };

  adjustScore(votes, vote.targetId, previous, -1);
  adjustScore(votes, vote.targetId, value, 1);
  votes.byVoter.set(key, value);

  const score = getScore(votes, vote.targetId);
  const feedback = buildVoteFeedback(room, vote.targetId, value, score);
  const clearedTarget = score.dislikes >= LIMITS.downvotesBeforeClear ? clearTarget(room, vote.targetId) : null;
  return { ok: true, changed: true, clearedTarget, feedback, ranking: buildRanking(room) };
}

function buildRanking(room) {
  const votes = getVoteStore(room);
  return Array.from(room.players.values())
    .map((player) => {
      const score = getScore(votes, player.id);
      return {
        id: player.id,
        name: player.name,
        likes: score.likes,
        dislikes: score.dislikes
      };
    })
    .sort((a, b) => b.likes - a.likes || a.dislikes - b.dislikes || a.name.localeCompare(b.name, "ko"))
    .slice(0, 8);
}

function removePlayerVotes(room, playerId) {
  const votes = getVoteStore(room);
  for (const key of Array.from(votes.byVoter.keys())) {
    if (key.startsWith(`${playerId}:`) || key.endsWith(`:${playerId}`)) votes.byVoter.delete(key);
  }
  votes.scores.delete(playerId);
}

function getVoteStore(room) {
  if (!room.votes) {
    room.votes = { byVoter: new Map(), scores: new Map() };
  }
  return room.votes;
}

function getScore(votes, targetId) {
  if (!votes.scores.has(targetId)) votes.scores.set(targetId, { likes: 0, dislikes: 0 });
  return votes.scores.get(targetId);
}

function adjustScore(votes, targetId, value, direction) {
  if (!value) return;
  const score = getScore(votes, targetId);
  if (value === 1) score.likes = Math.max(0, score.likes + direction);
  if (value === -1) score.dislikes = Math.max(0, score.dislikes + direction);
}

function buildVoteFeedback(room, targetId, value, score) {
  const player = room.players.get(targetId);
  return {
    targetId,
    name: player?.name || "player",
    value,
    likes: score.likes,
    dislikes: score.dislikes
  };
}

function clearTarget(room, targetId) {
  const player = room.players.get(targetId);
  room.strokes = room.strokes.filter((stroke) => stroke.author !== targetId);
  resetDownvotes(room, targetId);
  return { id: targetId, name: player?.name || "player" };
}

function resetDownvotes(room, targetId) {
  const votes = getVoteStore(room);
  for (const [key, value] of Array.from(votes.byVoter.entries())) {
    if (key.endsWith(`:${targetId}`) && value === -1) votes.byVoter.delete(key);
  }
  getScore(votes, targetId).dislikes = 0;
}

module.exports = {
  applyVote,
  buildRanking,
  removePlayerVotes
};
