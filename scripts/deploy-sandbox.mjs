import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

export function configuration(env) {
  for (const name of ["PLATFORM_API_URL", "PLATFORM_SANDBOX_ID", "PLATFORM_API_KEY"]) {
    if (!env[name]?.trim()) throw new Error(`Missing ${name}`);
  }
  const api = new URL(env.PLATFORM_API_URL);
  if (api.protocol !== "https:" || api.username || api.password || api.search || api.hash) {
    throw new Error("PLATFORM_API_URL must be an HTTPS URL without credentials, query or fragment");
  }
  if (!/^[a-f0-9-]{36}$/i.test(env.PLATFORM_SANDBOX_ID)) {
    throw new Error("PLATFORM_SANDBOX_ID must be a UUID");
  }
  return { ...env, PLATFORM_API_URL: api.href.replace(/\/$/, "") };
}

// Retried mutations use the same idempotency key. Never log API response bodies:
// exec responses contain application output and may contain credentials.
export function platformClient(config, fetcher = fetch, pause = sleep) {
  return async (method, path, body) => {
    const headers = {
      Authorization: `Bearer ${config.PLATFORM_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetcher(`${config.PLATFORM_API_URL}/v1${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
          redirect: "error",
        });
        if (response.status === 429 || response.status >= 500) {
          if (attempt < 2) {
            await pause(2000 * (attempt + 1));
            continue;
          }
        }
        if (!response.ok) throw new Error(`Platform ${method} ${path}: HTTP ${response.status}`);
        const result = await response.text();
        return result ? JSON.parse(result) : undefined;
      } catch (error) {
        if (error.message.startsWith("Platform ")) throw error;
        if (attempt === 2) {
          throw new Error(
            `Platform ${method} ${path}: response unavailable; outcome may be unknown`,
          );
        }
        await pause(2000 * (attempt + 1));
      }
    }
  };
}

export async function deploy(config, { api, pause = sleep, log = console.log }) {
  const script = await readFile(new URL("sandbox-deploy.sh", import.meta.url), "utf8");
  const execution = await api("POST", `/sandboxes/${config.PLATFORM_SANDBOX_ID}/exec`, {
    argv: ["bash", "-lc", script],
    cwd: "/app",
    timeoutMs: 900_000,
  });
  log(`Deployment exec: ${execution.id}`);
  for (let attempt = 0; attempt < 190; attempt++) {
    const result = await api("GET", `/execs/${execution.id}`);
    if (result.status === "exited" && result.exitCode === 0) {
      log("Application updated and restarted.");
      return;
    }
    if (!["starting", "running"].includes(result.status)) {
      throw new Error(
        `Deployment exec ${execution.id}: ${result.status}, exit ${result.exitCode}. Inspect its output in the platform.`,
      );
    }
    await pause(5000);
  }
  throw new Error(
    `Deployment exec ${execution.id} did not finish. Inspect it in the platform before retrying.`,
  );
}

if (import.meta.main) {
  try {
    const config = configuration(process.env);
    await deploy(config, { api: platformClient(config) });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
