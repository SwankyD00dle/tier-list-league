import assert from "node:assert/strict";
import { test } from "node:test";
import { configuration, deploy, platformClient } from "./deploy-sandbox.mjs";

const config = {
  PLATFORM_API_URL: "https://platform.example.com",
  PLATFORM_SANDBOX_ID: "987928ec-eada-4c28-8cfe-72686f1d5268",
  PLATFORM_API_KEY: "platform-secret",
};
const pause = async () => {};

test("executes deployment only in the configured sandbox and waits for completion", async () => {
  const calls = [];
  let polls = 0;
  await deploy(config, {
    pause,
    log: () => {},
    api: async (method, path, body) => {
      calls.push({ method, path, body });
      if (method === "POST") return { id: "deployment" };
      return ++polls === 1 ? { status: "running" } : { status: "exited", exitCode: 0 };
    },
  });
  assert.equal(calls[0].path, `/sandboxes/${config.PLATFORM_SANDBOX_ID}/exec`);
  assert.equal(calls[0].body.cwd, "/app");
  assert.ok(!JSON.stringify(calls[0].body).includes(config.PLATFORM_API_KEY));
  assert.deepEqual(
    calls.slice(1).map(({ method, path }) => [method, path]),
    [
      ["GET", "/execs/deployment"],
      ["GET", "/execs/deployment"],
    ],
  );
});

for (const result of [
  { status: "exited", exitCode: 1 },
  { status: "timed_out", exitCode: null },
]) {
  test(`reports failed exec (${result.status}) without printing remote output`, async () => {
    await assert.rejects(
      deploy(config, {
        pause,
        log: () => {},
        api: async (method) =>
          method === "POST" ? { id: "deployment" } : { ...result, stderr: "secret output" },
      }),
      (error) =>
        error.message.includes("Deployment exec deployment") &&
        !error.message.includes("secret output"),
    );
  });
}

test("validates credentials and sandbox ID before execution", () => {
  assert.equal(configuration(config).PLATFORM_SANDBOX_ID, config.PLATFORM_SANDBOX_ID);
  assert.throws(
    () => configuration({ ...config, PLATFORM_API_KEY: "" }),
    /Missing PLATFORM_API_KEY/,
  );
  assert.throws(() => configuration({ ...config, PLATFORM_SANDBOX_ID: "wrong" }), /UUID/);
  assert.throws(
    () => configuration({ ...config, PLATFORM_API_URL: "http://example.com" }),
    /HTTPS/,
  );
});

test("reuses the idempotency key after a lost mutation response", async () => {
  const requests = [];
  const api = platformClient(
    config,
    async (_url, request) => {
      requests.push(request);
      if (requests.length === 1) throw new Error("Lost response");
      return new Response('{"id":"new"}', { status: 202 });
    },
    pause,
  );
  assert.deepEqual(
    await api("POST", `/sandboxes/${config.PLATFORM_SANDBOX_ID}/exec`, { argv: ["true"] }),
    { id: "new" },
  );
  assert.equal(requests[0].headers["Idempotency-Key"], requests[1].headers["Idempotency-Key"]);
  assert.equal(requests[0].body, requests[1].body);
});

test("does not leak platform response bodies or retry rejected credentials", async () => {
  let count = 0;
  const api = platformClient(
    config,
    async () => {
      count++;
      return new Response("sensitive response", { status: 401 });
    },
    pause,
  );
  await assert.rejects(api("GET", "/execs/deployment"), {
    message: "Platform GET /execs/deployment: HTTP 401",
  });
  assert.equal(count, 1);
});

test("Compose deployment updates in order and stops on migration failure", async () => {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const directory = await mkdtemp(join(tmpdir(), "tier-deploy-test-"));
  try {
    const bin = join(directory, "bin");
    await mkdir(bin);
    const fake = `#!/bin/bash
name=$(basename "$0")
echo "$name $*" >>"$COMMAND_LOG"
if [[ "$name $*" == 'git branch --show-current' ]]; then echo main; fi
if [[ "$name" == docker && "$*" == *' run --rm --no-deps migrate' && "$FAIL_MIGRATION" == 1 ]]; then exit 1; fi
`;
    for (const command of ["git", "docker", "curl", "flock"]) {
      await writeFile(join(bin, command), fake, { mode: 0o755 });
    }
    const script = (await readFile(new URL("sandbox-deploy.sh", import.meta.url), "utf8"))
      .replace("cd /app", 'cd "$TEST_APP"')
      .replace("/tmp/tier-list-league-deploy.lock", `${directory}/deploy.lock`);
    for (const fail of [false, true]) {
      const log = join(directory, `commands-${fail}`);
      const result = spawnSync("bash", ["-c", script], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          TEST_APP: directory,
          COMMAND_LOG: log,
          FAIL_MIGRATION: fail ? "1" : "0",
        },
      });
      assert.equal(result.status, fail ? 1 : 0, result.stderr);
      const commands = (await readFile(log, "utf8")).split("\n");
      const operations = commands.filter((line) => / stop | pull | build$| run | up /.test(line));
      assert.equal(operations.length, fail ? 4 : 5);
      assert.match(operations[0], /stop frontend backend$/);
      assert.equal(operations[1], "git pull --ff-only origin main");
      assert.match(operations[2], / build$/);
      assert.match(operations[3], /run --rm --no-deps migrate$/);
      if (!fail) assert.match(operations[4], /up -d --no-deps --wait backend frontend$/);
      assert.ok(!commands.some((line) => / down|stop.* db/.test(line)));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
