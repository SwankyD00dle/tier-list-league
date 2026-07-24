import type { BaseHandlerConfig } from "../handler";
import type { RegisteredRoute } from "../router";
import { getGame } from "./game/get";
import { listGames } from "./game/list";
import { healthCheck } from "./health/get";
import { getRound } from "./round/get";
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
    { method: "GET", path: "/api/games/:id", definition: getGame(config) },
    { method: "GET", path: "/api/rounds/:id", definition: getRound(config) },
    { method: "GET", path: "/api/tier-lists/:id", definition: getTierList(config) },
  ];
}
