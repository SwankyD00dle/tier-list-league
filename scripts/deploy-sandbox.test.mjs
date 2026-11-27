import assert from "node:assert/strict";
import { test } from "node:test";

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

test("workflow submits the script and handles exec success, failure and API errors", async () => {
  const { mkdtemp, readFile, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const directory = await mkdtemp(join(tmpdir(), "tier-workflow-test-"));
  try {
    const workflow = await readFile(
      new URL("../.github/workflows/deploy.yml", import.meta.url),
      "utf8",
    );
    const block = workflow.split("        run: |\n")[1].split("        env:\n")[0];
    const script = block
      .split("\n")
      .map((line) => line.slice(10))
      .join("\n");
    await writeFile(
      join(directory, "curl"),
      `#!/bin/bash
set -eu
output=''
payload=''
while (( $# )); do
  case "$1" in
    --output) output=$2; shift ;;
    --data) payload=$2; shift ;;
  esac
  shift
done
if [[ "$RESULT" == api-error ]]; then exit 22; fi
if [[ -n "$payload" ]]; then
  printf '%s' "$payload" >"$PAYLOAD_FILE"
  echo '{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}' >"$output"
elif [[ ! -f "$POLL_MARKER" ]]; then
  touch "$POLL_MARKER"
  echo '{"status":"running"}' >"$output"
else
  printf '%s' "$RESULT" >"$output"
fi
`,
      { mode: 0o755 },
    );
    await writeFile(join(directory, "sleep"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });
    const cases = [
      ['{"status":"exited","exitCode":0}', true],
      ['{"status":"exited","exitCode":1,"stderr":"sensitive output"}', false],
      ['{"status":"timed_out","exitCode":null}', false],
      ["api-error", false],
    ];
    for (const [index, [response, success]] of cases.entries()) {
      const payloadFile = join(directory, `payload-${index}`);
      const result = spawnSync("bash", ["-c", script], {
        encoding: "utf8",
        timeout: 5000,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          PLATFORM_API_URL: "https://platform.example.com",
          PLATFORM_API_KEY: "test-key",
          PLATFORM_SANDBOX_ID: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          RESULT: response,
          PAYLOAD_FILE: payloadFile,
          POLL_MARKER: join(directory, `poll-${index}`),
        },
      });
      assert.equal(result.status === 0, success, result.stderr);
      assert.ok(!`${result.stdout}${result.stderr}`.includes("sensitive output"));
      if (response !== "api-error") {
        const payload = JSON.parse(await readFile(payloadFile, "utf8"));
        assert.equal(payload.cwd, "/app");
        assert.deepEqual(payload.argv.slice(0, 2), ["bash", "-lc"]);
        assert.equal(
          payload.argv[2],
          await readFile(new URL("sandbox-deploy.sh", import.meta.url), "utf8"),
        );
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
