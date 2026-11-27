import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

export default function setup(project: TestProject) {
  if (process.env.TEST_DATABASE_URL) {
    project.provide("testDatabaseUrl", process.env.TEST_DATABASE_URL);
    return;
  }

  const args = [
    "compose",
    "--project-name",
    `tier-list-test-${randomUUID()}`,
    "--file",
    fileURLToPath(new URL("../../docker-compose.test.yml", import.meta.url)),
  ];
  const compose = (...command: string[]) =>
    execFileSync("docker", [...args, ...command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      timeout: 90_000,
    });
  const teardown = () => {
    compose("down", "--volumes", "--remove-orphans");
  };

  try {
    compose("up", "--detach", "--wait", "--wait-timeout", "60", "db");
    const binding = compose("port", "db", "5432").trim();
    const match = /^127\.0\.0\.1:(\d+)$/.exec(binding);
    if (!match) throw new Error(`Unexpected PostgreSQL port binding: ${binding}`);
    project.provide(
      "testDatabaseUrl",
      `postgres://postgres:postgres@127.0.0.1:${match[1]}/tier_list_league_test`,
    );
    return teardown;
  } catch (error) {
    // Startup may have created containers even when readiness or port lookup fails.
    try {
      teardown();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "PostgreSQL startup and cleanup failed");
    }
    throw error;
  }
}
