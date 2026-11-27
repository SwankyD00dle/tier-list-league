import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const owner = "tier-list-league-actions";

export function configuration(env) {
  for (const name of [
    "PLATFORM_API_URL",
    "PLATFORM_ENDPOINT_ID",
    "PLATFORM_API_KEY",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "JWT_SECRET",
    "GITHUB_REPOSITORY",
    "GITHUB_SHA",
  ]) {
    if (!env[name]?.trim()) throw new Error(`Missing ${name}`);
  }
  const api = new URL(env.PLATFORM_API_URL);
  if (api.protocol !== "https:" || api.username || api.password || api.search || api.hash) {
    throw new Error("PLATFORM_API_URL must be an HTTPS URL without credentials, query or fragment");
  }
  if (!/^[a-f0-9-]{36}$/i.test(env.PLATFORM_ENDPOINT_ID)) {
    throw new Error("PLATFORM_ENDPOINT_ID must be a UUID");
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY) || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA)) {
    throw new Error("Invalid GitHub repository or commit SHA");
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

function sameBinding(a, b) {
  return a?.sandboxId === b?.sandboxId && a?.port === b?.port;
}

export async function deploy(config, { api, pause = sleep, fetcher = fetch, log = console.log }) {
  const endpointPath = `/ingresses/${config.PLATFORM_ENDPOINT_ID}`;
  const original = await api("GET", endpointPath);
  const url = new URL(original.url);
  if (original.accessMode !== "public" || url.protocol !== "https:" || url.pathname !== "/") {
    throw new Error("Deployment requires a public HTTPS endpoint at the domain root");
  }
  const previous = original.binding;
  const [startup, script] = await Promise.all([
    readFile(new URL("sandbox-startup.sh", import.meta.url), "utf8"),
    readFile(new URL("sandbox-deploy.sh", import.meta.url), "utf8"),
  ]);
  let candidate;
  let switchAttempted = false;
  try {
    candidate = await api("POST", "/sandboxes", {
      image: "ubuntu:24.04",
      cpu: 2,
      memoryMiB: 4096,
      diskMiB: 30720,
      ttlSeconds: null,
      network: { egress: "open" },
      labels: { owner, repository: config.GITHUB_REPOSITORY, commit: config.GITHUB_SHA },
      startup: { mode: "command", argv: ["bash", "-lc", startup] },
    });
    log(`Candidate sandbox: ${candidate.id}`);
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      const sandbox = await api("GET", `/sandboxes/${candidate.id}`);
      if (sandbox.status === "running") {
        ready = true;
        break;
      }
      if (!["queued", "provisioning", "restoring"].includes(sandbox.status)) {
        throw new Error(`Sandbox ${candidate.id}: ${sandbox.status}`);
      }
      await pause(5000);
    }
    if (!ready) throw new Error(`Sandbox ${candidate.id} did not start`);
    const execution = await api("POST", `/sandboxes/${candidate.id}/exec`, {
      argv: ["bash", "-lc", script],
      timeoutMs: 900_000,
      env: {
        GITHUB_REPOSITORY: config.GITHUB_REPOSITORY,
        GITHUB_SHA: config.GITHUB_SHA,
        APP_PUBLIC_URL: url.origin,
        COOKIE_SECURE: "true",
        DISCORD_CLIENT_ID: config.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: config.DISCORD_CLIENT_SECRET,
        JWT_SECRET: config.JWT_SECRET,
      },
    });
    log(`Build and health-check exec: ${execution.id}`);
    let built = false;
    for (let attempt = 0; attempt < 190; attempt++) {
      const result = await api("GET", `/execs/${execution.id}`);
      if (result.status === "exited" && result.exitCode === 0) {
        built = true;
        break;
      }
      if (!["starting", "running"].includes(result.status)) {
        throw new Error(`Deploy exec ${execution.id}: ${result.status}, exit ${result.exitCode}`);
      }
      await pause(5000);
    }
    if (!built) throw new Error(`Deploy exec ${execution.id} did not finish`);
    const current = await api("GET", endpointPath);
    if (!sameBinding(current.binding, previous)) {
      throw new Error("Endpoint changed during deployment; refusing to replace its new binding");
    }
    switchAttempted = true;
    await api("PUT", `${endpointPath}/binding`, { sandboxId: candidate.id, port: 3000 });
    let healthy = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const options = {
          headers: {
            "User-Agent": "Mozilla/5.0 (sandbox-deployment)",
            "Cache-Control": "no-cache",
          },
          signal: AbortSignal.timeout(10_000),
          redirect: "error",
        };
        const version = await fetcher(
          `${url.origin}/deployment.json?sha=${config.GITHUB_SHA}`,
          options,
        );
        const health = await fetcher(`${url.origin}/api/health`, options);
        if (version.ok && health.ok && (await version.json()).sha === config.GITHUB_SHA) {
          healthy = true;
          break;
        }
      } catch {
        // The ingress may take a few seconds to route to the new sandbox.
      }
      await pause(5000);
    }
    if (!healthy) throw new Error("Public endpoint did not serve the healthy deployed commit");
  } catch (error) {
    if (candidate) {
      try {
        const current = await api("GET", endpointPath);
        if (current.binding?.sandboxId === candidate.id) {
          if (!switchAttempted) throw new Error("Candidate was bound externally");
          await api(previous ? "PUT" : "DELETE", `${endpointPath}/binding`, previous ?? undefined);
        }
        const restored = await api("GET", endpointPath);
        if (restored.binding?.sandboxId === candidate.id)
          throw new Error("Candidate is still bound");
        await api("DELETE", `/sandboxes/${candidate.id}`);
      } catch {
        log(
          `Cleanup could not be confirmed. Inspect endpoint and sandbox ${candidate.id} manually.`,
        );
      }
    }
    throw error;
  }
  log(`Deployed ${config.GITHUB_SHA} to ${url.origin} (sandbox ${candidate.id})`);
  if (previous?.sandboxId && previous.sandboxId !== candidate.id) {
    try {
      const old = await api("GET", `/sandboxes/${previous.sandboxId}`);
      const labels = old.configuration.labels;
      if (labels?.owner === owner && labels.repository === config.GITHUB_REPOSITORY) {
        await api("DELETE", `/sandboxes/${previous.sandboxId}`);
      } else {
        log(`Retained previous sandbox ${previous.sandboxId}: not owned by this workflow.`);
      }
    } catch {
      log(
        `Deployment succeeded; manually inspect/clean up previous sandbox ${previous.sandboxId}.`,
      );
    }
  }
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
