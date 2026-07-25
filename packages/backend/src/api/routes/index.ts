import type { BaseHandlerConfig } from "../handler";
import type { RegisteredRoute } from "../router";
import { createGame } from "./game/create";
import { getGame } from "./game/get";
import { listGames } from "./game/list";
import { addParticipant } from "./game/participants/create";
import { removeParticipant } from "./game/participants/delete";
import { recordGameScore } from "./game/score/create";
import { getGameScores, getUserGameScore } from "./game/score/get";
import { updateGame } from "./game/update";
import { healthCheck } from "./health/get";
import { createRound } from "./round/create";
import { getRound } from "./round/get";
import { submitGuess } from "./round/guess/create";
import { submitTierList } from "./round/tier-list/create";
import { updateRound } from "./round/update";
import { getTierList } from "./tier-list/get";
import { createUser } from "./user/create";
import { getUser } from "./user/get";
import { listUsers } from "./user/list";

export function buildRoutes(config: BaseHandlerConfig): RegisteredRoute[] {
  return [
    { method: "GET", path: "/api/health", definition: healthCheck(config) },
    { method: "GET", path: "/api/users", definition: listUsers(config) },
    { method: "POST", path: "/api/users", definition: createUser(config) },
    { method: "GET", path: "/api/users/:id", definition: getUser(config) },
    { method: "GET", path: "/api/games", definition: listGames(config) },
    { method: "POST", path: "/api/games", definition: createGame(config) },
    { method: "GET", path: "/api/games/:id", definition: getGame(config) },
    { method: "PATCH", path: "/api/games/:id", definition: updateGame(config) },
    { method: "POST", path: "/api/games/:gameId/participants", definition: addParticipant(config) },
    {
      method: "DELETE",
      path: "/api/games/:gameId/participants/:userId",
      definition: removeParticipant(config),
    },
    { method: "POST", path: "/api/games/:gameId/rounds", definition: createRound(config) },
    { method: "POST", path: "/api/games/:gameId/score", definition: recordGameScore(config) },
    { method: "GET", path: "/api/games/:gameId/score", definition: getGameScores(config) },
    {
      method: "GET",
      path: "/api/games/:gameId/score/:userId",
      definition: getUserGameScore(config),
    },
    { method: "GET", path: "/api/rounds/:id", definition: getRound(config) },
    { method: "PATCH", path: "/api/rounds/:id", definition: updateRound(config) },
    { method: "POST", path: "/api/rounds/:roundId/guesses", definition: submitGuess(config) },
    { method: "POST", path: "/api/rounds/:roundId/tier-lists", definition: submitTierList(config) },
    { method: "GET", path: "/api/tier-lists/:id", definition: getTierList(config) },
  ];
}
