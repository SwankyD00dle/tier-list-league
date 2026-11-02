// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/api";
import GameLobbyPage from "../app/game/[id]/page";
import { CreateGameModal } from "../app/game/CreateGameModal";
import { GameCard } from "../app/game/GameCard";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "game-1" }) }));
vi.mock("../api/api", () => ({
  api: {
    me: vi.fn(),
    getGame: vi.fn(),
    listUsers: vi.fn(),
    getUser: vi.fn(),
    getRound: vi.fn(),
    addParticipant: vi.fn(),
    removeParticipant: vi.fn(),
    createRound: vi.fn(),
    createGame: vi.fn(),
  },
  apiUrl: (path: string) => path,
  routes: { discordAuth: "/api/auth/discord" },
}));

const admin = {
  id: "admin",
  name: "Alex",
  discordUserId: "1",
  activeGames: [],
  createdAt: "2026-10-14T00:00:00.000Z",
};
const player = { ...admin, id: "player", name: "Sam" };
const game = {
  id: "game-1",
  name: "Friday league",
  description: "Our game",
  createdBy: admin.id,
  participants: [admin.id],
  rounds: [],
  roundCount: 3,
  createdAt: admin.createdAt,
  updatedAt: admin.createdAt,
};
const failure = (status: number) => ({
  ok: false as const,
  status,
  code: "ERROR",
  message: "Request failed",
});
const round = {
  id: "round-1",
  game: game.id,
  roundNumber: 1,
  hostedBy: admin.id,
  topic: "Snacks",
  tierList: null,
  guesses: [],
  winningGuess: null,
  honorableMentions: null,
  honorableMentionDetails: [],
  scoreDeltas: {},
  participantTierLists: null,
  createdAt: admin.createdAt,
  updatedAt: null,
  endsAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.me).mockResolvedValue({ ok: true, status: 200, data: { ...admin, ok: true } });
  vi.mocked(api.getGame).mockResolvedValue({ ok: true, status: 200, data: { ok: true, game } });
  vi.mocked(api.listUsers).mockResolvedValue({
    ok: true,
    status: 200,
    data: { ok: true, users: [admin, player] },
  });
  vi.mocked(api.getUser).mockResolvedValue({
    ok: true,
    status: 200,
    data: { ok: true, user: admin },
  });
});
afterEach(cleanup);

async function renderLobby() {
  render(createElement(GameLobbyPage));
  await screen.findByRole("heading", { name: game.name });
}

describe("game lobby", () => {
  it("loads members, adds a player, and refreshes membership", async () => {
    vi.mocked(api.addParticipant).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ok: true, gameId: game.id, participants: [admin.id, player.id] },
    });
    await renderLobby();
    expect(screen.getByText("Members (1)")).toBeTruthy();
    vi.mocked(api.getGame).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ok: true, game: { ...game, participants: [admin.id, player.id] } },
    });
    fireEvent.change(screen.getByLabelText("Add a registered player"), {
      target: { value: player.id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    expect(await screen.findByText("Members (2)")).toBeTruthy();
    expect(api.addParticipant).toHaveBeenCalledWith(game.id, { userId: player.id });
  });

  it("removes another member and refreshes the lobby", async () => {
    vi.mocked(api.getGame).mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { ok: true, game: { ...game, participants: [admin.id, player.id] } },
    });
    vi.mocked(api.removeParticipant).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ok: true, gameId: game.id, participants: [admin.id] },
    });
    await renderLobby();
    expect(screen.queryByRole("button", { name: "Remove Alex" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove Sam" }));
    expect(await screen.findByText("Members (1)")).toBeTruthy();
    expect(api.removeParticipant).toHaveBeenCalledWith(game.id, player.id);
  });

  it("starts the first round with a trimmed topic and selected host", async () => {
    vi.mocked(api.createRound).mockResolvedValue({
      ok: true,
      status: 201,
      data: { ok: true, round },
    });
    vi.mocked(api.getRound).mockResolvedValue({ ok: true, status: 200, data: { ok: true, round } });
    await renderLobby();
    vi.mocked(api.getGame).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ok: true, game: { ...game, rounds: [round.id] } },
    });
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: " Snacks " } });
    fireEvent.change(screen.getByLabelText("Host"), { target: { value: admin.id } });
    fireEvent.click(screen.getByRole("button", { name: "Start first round" }));
    expect(await screen.findByText("Round 1: Snacks")).toBeTruthy();
    expect(api.createRound).toHaveBeenCalledWith(game.id, {
      topic: "Snacks",
      hostedBy: admin.id,
      expectedRoundCount: 0,
    });
    expect(screen.queryByRole("button", { name: "Start first round" })).toBeNull();
  });

  it("shows mutation errors and preserves the form for retry", async () => {
    vi.mocked(api.createRound).mockResolvedValue(failure(500));
    await renderLobby();
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Snacks" } });
    fireEvent.change(screen.getByLabelText("Host"), { target: { value: admin.id } });
    fireEvent.click(screen.getByRole("button", { name: "Start first round" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Request failed");
    expect(screen.getByLabelText("Topic")).toHaveProperty("value", "Snacks");
    expect(screen.getByRole("button", { name: "Start first round" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("hides admin controls from participants and only loads member names", async () => {
    vi.mocked(api.me).mockResolvedValue({ ok: true, status: 200, data: { ...player, ok: true } });
    await renderLobby();
    expect(api.listUsers).not.toHaveBeenCalled();
    expect(api.getUser).toHaveBeenCalledWith(admin.id);
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByText("No rounds yet. Waiting for the admin to start the game."),
    ).toBeTruthy();
  });

  it("loads historical host names for a remaining member", async () => {
    const formerHost = { ...admin, id: "former-host", name: "Taylor" };
    vi.mocked(api.me).mockResolvedValue({ ok: true, status: 200, data: { ...player, ok: true } });
    vi.mocked(api.getGame).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        game: { ...game, participants: [admin.id, player.id], rounds: [round.id] },
      },
    });
    vi.mocked(api.getRound).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ok: true, round: { ...round, hostedBy: formerHost.id, winningGuess: "winner" } },
    });
    vi.mocked(api.getUser).mockImplementation(async (id) => ({
      ok: true,
      status: 200,
      data: { ok: true, user: id === admin.id ? admin : id === player.id ? player : formerHost },
    }));
    await renderLobby();
    expect(screen.getByText("Host: Taylor · Finalized")).toBeTruthy();
    expect(api.getUser).toHaveBeenCalledTimes(3);
    expect(api.getUser).toHaveBeenCalledWith(formerHost.id);
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it.each([null, "winner"])(
    "only protects hosts of unfinished rounds (%s)",
    async (winningGuess) => {
      vi.mocked(api.getGame).mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          ok: true,
          game: { ...game, participants: [admin.id, player.id], rounds: [round.id] },
        },
      });
      vi.mocked(api.getRound).mockResolvedValue({
        ok: true,
        status: 200,
        data: { ok: true, round: { ...round, hostedBy: player.id, winningGuess } },
      });
      await renderLobby();
      expect(screen.getByRole("button", { name: "Remove Sam" })).toHaveProperty(
        "disabled",
        winningGuess === null,
      );
    },
  );

  it("shows a conflict from a stale first-round form", async () => {
    vi.mocked(api.createRound).mockResolvedValue({
      ok: false,
      status: 409,
      code: "ROUND_COUNT_CHANGED",
      message: "The game has already advanced. Reload the lobby to see its rounds.",
    });
    await renderLobby();
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Snacks" } });
    fireEvent.change(screen.getByLabelText("Host"), { target: { value: admin.id } });
    fireEvent.click(screen.getByRole("button", { name: "Start first round" }));
    expect((await screen.findByRole("alert")).textContent).toContain("already advanced");
  });

  it.each([401, 403, 404])("handles game read status %i", async (status) => {
    vi.mocked(api.getGame).mockResolvedValue(failure(status));
    render(createElement(GameLobbyPage));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      status === 401 ? "Log in" : status === 403 ? "access" : "not found",
    );
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it("retries a failed load", async () => {
    vi.mocked(api.getGame).mockResolvedValueOnce(failure(500));
    render(createElement(GameLobbyPage));
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: game.name })).toBeTruthy();
  });

  it("does not render incomplete round data as an empty game", async () => {
    vi.mocked(api.getGame).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ok: true, game: { ...game, rounds: [round.id] } },
    });
    vi.mocked(api.getRound).mockResolvedValue(failure(500));
    render(createElement(GameLobbyPage));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start first round" })).toBeNull();
  });

  it("links a game card to its lobby", () => {
    render(createElement(GameCard, { game, currentUserId: admin.id, usersById: new Map() }));
    expect(screen.getByRole("link", { name: game.name }).getAttribute("href")).toBe("/game/game-1");
  });

  it("passes the created game ID to the navigation callback", async () => {
    vi.mocked(api.createGame).mockResolvedValue({
      ok: true,
      status: 201,
      data: { ok: true, game },
    });
    const onCreated = vi.fn();
    render(createElement(CreateGameModal, { onClose: vi.fn(), onCreated }));
    fireEvent.change(screen.getByLabelText("Game name"), { target: { value: game.name } });
    fireEvent.click(screen.getByRole("button", { name: "Create game" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(game.id));
  });
});
