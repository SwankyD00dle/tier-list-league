import {
  type AddParticipantRequest,
  type CreateGameRequest,
  type CreateRoundRequest,
  type CreateUserRequest,
  isApiErrorResponse,
  isCreateGameResponse,
  isCreateRoundResponse,
  isCreateUserResponse,
  isGetGameResponse,
  isGetGameScoresResponse,
  isGetRoundResponse,
  isGetTierListResponse,
  isGetUserGameScoreResponse,
  isGetUserResponse,
  isHealthResponse,
  isListGamesResponse,
  isListUsersResponse,
  isLogoutResponse,
  isMeResponse,
  isParticipantsResponse,
  isRecordGameScoreResponse,
  isRefreshAuthResponse,
  isSubmitGuessResponse,
  isSubmitTierListResponse,
  isUpdateGameResponse,
  isUpdateRoundResponse,
  type RecordGameScoreRequest,
  type SubmitGuessRequest,
  type SubmitTierListRequest,
  type UpdateGameRequest,
  type UpdateRoundRequest,
} from "@tier-list-league/api-schema";

/**
 * Same-origin by default: `next.config.ts` rewrites `/api/*` to the backend. Set
 * `NEXT_PUBLIC_API_BASE_URL` to call the backend directly (for example from a server component).
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const NETWORK_FAILURE_CODE = "NETWORK_FAILURE";
const RESPONSE_SCHEMA_FAILURE_CODE = "RESPONSE_SCHEMA_VALIDATION_FAILURE";

export type ApiResult<TData> =
  | { ok: true; status: number; data: TData }
  | { ok: false; status: number; code: string; message: string; details?: unknown };

export type TypeCheck<TData> = (data: unknown) => data is TData;

export const routes = {
  health: "/api/health",
  discordAuth: "/api/auth/discord",
  discordAuthCallback: "/api/auth/discord/callback",
  refreshAuth: "/api/auth/refresh",
  logout: "/api/auth/logout",
  me: "/api/auth/me",
  users: "/api/users",
  user: (id: string) => `/api/users/${encodeURIComponent(id)}`,
  games: "/api/games",
  game: (id: string) => `/api/games/${encodeURIComponent(id)}`,
  gameParticipants: (gameId: string) => `/api/games/${encodeURIComponent(gameId)}/participants`,
  gameParticipant: (gameId: string, userId: string) =>
    `/api/games/${encodeURIComponent(gameId)}/participants/${encodeURIComponent(userId)}`,
  gameRounds: (gameId: string) => `/api/games/${encodeURIComponent(gameId)}/rounds`,
  gameScore: (gameId: string) => `/api/games/${encodeURIComponent(gameId)}/score`,
  userGameScore: (gameId: string, userId: string) =>
    `/api/games/${encodeURIComponent(gameId)}/score/${encodeURIComponent(userId)}`,
  round: (id: string) => `/api/rounds/${encodeURIComponent(id)}`,
  roundGuesses: (roundId: string) => `/api/rounds/${encodeURIComponent(roundId)}/guesses`,
  roundTierLists: (roundId: string) => `/api/rounds/${encodeURIComponent(roundId)}/tier-lists`,
  tierList: (id: string) => `/api/tier-lists/${encodeURIComponent(id)}`,
};

export type CreateUserBody = CreateUserRequest["body"];
export type CreateGameBody = CreateGameRequest["body"];
export type UpdateGameBody = UpdateGameRequest["body"];
export type AddParticipantBody = AddParticipantRequest["body"];
export type CreateRoundBody = CreateRoundRequest["body"];
export type UpdateRoundBody = UpdateRoundRequest["body"];
export type RecordGameScoreBody = RecordGameScoreRequest["body"];
export type SubmitGuessBody = SubmitGuessRequest["body"];
export type SubmitTierListBody = SubmitTierListRequest["body"];

export const api = {
  health: () => get(routes.health, isHealthResponse),

  me: () => get(routes.me, isMeResponse),
  refreshAuth: () => send("POST", routes.refreshAuth, undefined, isRefreshAuthResponse),
  logout: () => send("POST", routes.logout, undefined, isLogoutResponse),

  listUsers: () => get(routes.users, isListUsersResponse),
  getUser: (id: string) => get(routes.user(id), isGetUserResponse),
  createUser: (body: CreateUserBody) => send("POST", routes.users, body, isCreateUserResponse),

  listGames: () => get(routes.games, isListGamesResponse),
  getGame: (id: string) => get(routes.game(id), isGetGameResponse),
  createGame: (body: CreateGameBody) => send("POST", routes.games, body, isCreateGameResponse),
  updateGame: (id: string, body: UpdateGameBody) =>
    send("PATCH", routes.game(id), body, isUpdateGameResponse),

  addParticipant: (gameId: string, body: AddParticipantBody) =>
    send("POST", routes.gameParticipants(gameId), body, isParticipantsResponse),
  removeParticipant: (gameId: string, userId: string) =>
    send("DELETE", routes.gameParticipant(gameId, userId), undefined, isParticipantsResponse),

  createRound: (gameId: string, body: CreateRoundBody) =>
    send("POST", routes.gameRounds(gameId), body, isCreateRoundResponse),
  recordGameScore: (gameId: string, body: RecordGameScoreBody) =>
    send("POST", routes.gameScore(gameId), body, isRecordGameScoreResponse),
  getGameScores: (gameId: string) => get(routes.gameScore(gameId), isGetGameScoresResponse),
  getUserGameScore: (gameId: string, userId: string) =>
    get(routes.userGameScore(gameId, userId), isGetUserGameScoreResponse),

  getRound: (id: string) => get(routes.round(id), isGetRoundResponse),
  updateRound: (id: string, body: UpdateRoundBody) =>
    send("PATCH", routes.round(id), body, isUpdateRoundResponse),
  submitGuess: (roundId: string, body: SubmitGuessBody) =>
    send("POST", routes.roundGuesses(roundId), body, isSubmitGuessResponse),
  submitTierList: (roundId: string, body: SubmitTierListBody) =>
    send("POST", routes.roundTierLists(roundId), body, isSubmitTierListResponse),

  getTierList: (id: string) => get(routes.tierList(id), isGetTierListResponse),
};

function get<TData>(path: string, isResponse: TypeCheck<TData>) {
  return request(path, { method: "GET", headers: { accept: "application/json" } }, isResponse);
}

function send<TData>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  isResponse: TypeCheck<TData>,
) {
  return request(
    path,
    {
      method,
      headers:
        body === undefined
          ? { accept: "application/json" }
          : { accept: "application/json", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    isResponse,
  );
}

async function request<TData>(
  path: string,
  init: RequestInit,
  isResponse: TypeCheck<TData>,
): Promise<ApiResult<TData>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    const payload = await readJson(response);

    if (isResponse(payload)) {
      return { ok: true, status: response.status, data: payload };
    }
    if (isApiErrorResponse(payload)) {
      return {
        ok: false,
        status: response.status,
        code: payload.code,
        message: payload.message,
        details: payload.details,
      };
    }
    return {
      ok: false,
      status: response.status,
      code: RESPONSE_SCHEMA_FAILURE_CODE,
      message: `${init.method} ${path} returned a payload that does not match its response schema`,
      details: payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      code: NETWORK_FAILURE_CODE,
      message: `${init.method} ${path} failed: ${String(error)}`,
    };
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
