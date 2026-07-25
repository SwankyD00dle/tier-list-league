import type { Round } from "../../../database/schema/round";

export function serializeRound(found: Round) {
  return {
    id: found.id,
    game: found.game,
    roundNumber: found.roundNumber,
    hostedBy: found.hostedBy,
    topic: found.topic,
    tierList: found.tierList,
    guesses: found.guesses,
    winningGuess: found.winningGuess,
    honorableMentions: found.honorableMentions,
    honorableMentionDetails: found.honorableMentionDetails,
    scoreDeltas: found.scoreDeltas,
    participantTierLists: found.participantTierLists,
    createdAt: found.createdAt.toISOString(),
    updatedAt: found.updatedAt?.toISOString() ?? null,
    endsAt: found.endsAt?.toISOString() ?? null,
  };
}
