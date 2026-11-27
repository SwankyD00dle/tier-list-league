import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestProject } from "vitest/node";
import setup from "../integration-setup";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
const exec = vi.mocked(execFileSync);

function project() {
  const provide = vi.fn();
  return { provide, instance: { provide } as unknown as TestProject };
}

beforeEach(() => {
  vi.stubEnv("TEST_DATABASE_URL", "");
  exec.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("integration database setup", () => {
  it("uses an explicit database without touching Docker", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgres://localhost/existing");
    const { provide, instance } = project();
    expect(setup(instance)).toBeUndefined();
    expect(provide).toHaveBeenCalledWith("testDatabaseUrl", "postgres://localhost/existing");
    expect(exec).not.toHaveBeenCalled();
  });

  it("provides the allocated port and tears down the same isolated project", () => {
    exec.mockReturnValueOnce("").mockReturnValueOnce("127.0.0.1:54387\n").mockReturnValueOnce("");
    const { provide, instance } = project();
    const teardown = setup(instance);
    expect(provide).toHaveBeenCalledWith(
      "testDatabaseUrl",
      "postgres://postgres:postgres@127.0.0.1:54387/tier_list_league_test",
    );
    expect(exec.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(["--wait", "--wait-timeout", "60"]),
    );
    expect(teardown).toBeTypeOf("function");
    teardown?.();
    expect(exec.mock.calls[2]?.[1]).toEqual([
      ...(exec.mock.calls[0]?.[1] ?? []).slice(0, 5),
      "down",
      "--volumes",
      "--remove-orphans",
    ]);
  });

  it("cleans up after failed readiness", () => {
    exec
      .mockImplementationOnce(() => {
        throw new Error("readiness failed");
      })
      .mockReturnValueOnce("");
    expect(() => setup(project().instance)).toThrow("readiness failed");
    expect(exec.mock.calls[1]?.[1]).toContain("down");
  });

  it("cleans up after an invalid port binding", () => {
    exec.mockReturnValueOnce("").mockReturnValueOnce("0.0.0.0:54387\n").mockReturnValueOnce("");
    expect(() => setup(project().instance)).toThrow("Unexpected PostgreSQL port binding");
    expect(exec.mock.calls[2]?.[1]).toContain("down");
  });

  it("reports both startup and cleanup failures", () => {
    exec.mockImplementation(() => {
      throw new Error("Docker unavailable");
    });
    expect(() => setup(project().instance)).toThrow(AggregateError);
  });
});
