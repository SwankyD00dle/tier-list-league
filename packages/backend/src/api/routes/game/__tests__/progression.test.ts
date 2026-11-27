import type { GameScores } from "@tier-list-league/api-schema/types";
import { describe, expect, it } from "vitest";
import type { Game } from "../../../../database/schema/game";
import type { Round } from "../../../../database/schema/round";
import { chooseNextHost, gameWinners } from "../progression";

const game = { participants: ["a", "b", "c"], roundCount: 1, pointsTarget: null } as Game;
const history = (hosts: string[]) =>
  hosts.map((hostedBy) => ({ hostedBy, phase: "finalized" }) as Round);
const scores = (totals: number[]): GameScores =>
  Object.fromEntries(game.participants.map((id, i) => [id, { total: totals[i] ?? 0, rounds: {} }]));

describe("game progression rules", () => {
  it("waits for every current player to finish their hosting quota", () => {
    expect(gameWinners(game, history(["a", "b"]), scores([0, 3, 3]))).toEqual([]);
    expect(gameWinners(game, history(["a", "b", "c"]), scores([0, 3, 3]))).toEqual(["b", "c"]);
    expect(
      gameWinners({ ...game, roundCount: 2 }, history(["a", "b", "c"]), scores([0, 3, 3])),
    ).toEqual([]);
  });
  it("uses the points target instead of the hosting quota", () => {
    const pointsGame = { ...game, pointsTarget: 6 };
    expect(gameWinners(pointsGame, history(["a", "b", "c"]), scores([3, 3, 3]))).toEqual([]);
    expect(gameWinners(pointsGame, history(["a"]), scores([0, 6, 0]))).toEqual(["b"]);
  });
  it("selects the winner when eligible and sends repeat winners to an unhosted player", () => {
    expect(chooseNextHost(game, history(["a"]), "b", 0)).toBe("b");
    expect(chooseNextHost({ ...game, pointsTarget: 12 }, history(["a", "b"]), "a", 1)).toBe("c");
  });
  it("avoids hosts who have exhausted their quota and ignores unfinished rounds", () => {
    expect(chooseNextHost(game, history(["a", "b"]), "a", 0)).toBe("c");
    expect(chooseNextHost(game, history(["a", "b", "c"]), "a", 1)).toBeNull();
    expect(
      gameWinners(
        game,
        [...history(["a", "b"]), { hostedBy: "c", phase: "judging" } as Round],
        scores([3, 3, 3]),
      ),
    ).toEqual([]);
  });
  it("excludes departed players from both completion and winners", () => {
    expect(
      gameWinners({ ...game, participants: ["a", "b"] }, history(["a", "b"]), scores([3, 0, 9])),
    ).toEqual(["a"]);
  });
});
