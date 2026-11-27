import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const args = [
  "compose",
  "--project-name",
  `tier-list-test-${randomUUID()}`,
  "--file",
  fileURLToPath(new URL("../docker-compose.test.yml", import.meta.url)),
];
function compose(command) {
  const result = spawnSync("docker", [...args, ...command], { stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}
try {
  process.exitCode = compose([
    "up",
    "--build",
    "--abort-on-container-exit",
    "--exit-code-from",
    "tests",
  ]);
} finally {
  const cleanup = compose(["down", "--volumes", "--remove-orphans"]);
  if (cleanup !== 0 && !process.exitCode) process.exitCode = cleanup;
}
