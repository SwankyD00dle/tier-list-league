import assert from "node:assert/strict";
import { test } from "node:test";
import { configuration, deploy, platformClient } from "./deploy-sandbox.mjs";

const config = {
  PLATFORM_API_URL: "https://platform.example.com",
  PLATFORM_ENDPOINT_ID: "b3c6c82e-2f51-4734-88a6-b1ebd7f3e4c4",
  PLATFORM_API_KEY: "platform-secret",
  DISCORD_CLIENT_ID: "discord-client",
  DISCORD_CLIENT_SECRET: "discord-secret",
  JWT_SECRET: "jwt-secret",
  GITHUB_REPOSITORY: "SwankyD00dle/tier-list-league",
  GITHUB_SHA: "a".repeat(40),
};
const pause = async () => {};

function fixture({
  buildFails = false,
  publicFails = false,
  ambiguousBind = false,
  owned = true,
  externallyChanged = false,
  rollbackFails = false,
  initiallyUnbound = false,
} = {}) {
  let binding = initiallyUnbound ? null : { sandboxId: "old", port: 3000 };
  let reads = 0;
  let switched = false;
  const calls = [];
  const logs = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (path === "/sandboxes" && method === "POST") return { id: "new" };
    if (path === "/sandboxes/new" && method === "GET") return { status: "running" };
    if (path === "/sandboxes/new/exec") return { id: "build" };
    if (path === "/execs/build") return { status: "exited", exitCode: buildFails ? 1 : 0 };
    if (path.endsWith("/binding")) {
      if (switched && rollbackFails) throw new Error("Rollback unavailable");
      binding = method === "DELETE" ? null : body;
      if (body?.sandboxId === "new") {
        switched = true;
        if (ambiguousBind) throw new Error("Response lost after binding");
      }
      return {};
    }
    if (path.startsWith("/ingresses/") && method === "GET") {
      reads++;
      if (externallyChanged && reads === 2) binding = { sandboxId: "external", port: 3000 };
      return { url: "https://app.example.com/", accessMode: "public", binding };
    }
    if (path === "/sandboxes/old" && method === "GET") {
      return {
        configuration: {
          labels: owned
            ? {
                owner: "tier-list-league-actions",
                repository: config.GITHUB_REPOSITORY,
              }
            : {},
        },
      };
    }
    if (method === "DELETE" && path.startsWith("/sandboxes/")) return;
    throw new Error(`Unexpected ${method} ${path}`);
  };
  return {
    calls,
    logs,
    binding: () => binding,
    run: () =>
      deploy(config, {
        api,
        pause,
        log: (message) => logs.push(message),
        fetcher: async () => ({ ok: !publicFails, json: async () => ({ sha: config.GITHUB_SHA }) }),
      }),
  };
}

const deleted = (f, id) =>
  f.calls.some((c) => c.method === "DELETE" && c.path === `/sandboxes/${id}`);

test("switches a healthy build and removes only the previous owned sandbox", async () => {
  const f = fixture();
  await f.run();
  assert.equal(f.binding().sandboxId, "new");
  assert.ok(deleted(f, "old"));
  assert.ok(!deleted(f, "new"));
  const exec = f.calls.find((c) => c.path.endsWith("/exec"));
  assert.equal(exec.body.env.JWT_SECRET, config.JWT_SECRET);
  assert.ok(!JSON.stringify(exec.body.argv).includes(config.JWT_SECRET));
  assert.ok(!f.logs.join().includes(config.JWT_SECRET));
  const switchIndex = f.calls.findIndex((c) => c.method === "PUT");
  assert.ok(switchIndex > f.calls.findIndex((c) => c.path === "/execs/build"));
});

test("retains the manually provisioned sandbox", async () => {
  const f = fixture({ owned: false });
  await f.run();
  assert.ok(!deleted(f, "old"));
});

test("a failed build never switches the endpoint", async () => {
  const f = fixture({ buildFails: true });
  await assert.rejects(f.run(), /Deploy exec/);
  assert.equal(f.binding().sandboxId, "old");
  assert.ok(!f.calls.some((c) => c.method === "PUT"));
  assert.ok(deleted(f, "new"));
});

for (const failure of ["publicFails", "ambiguousBind"]) {
  test(`${failure} restores the prior binding before deleting the candidate`, async () => {
    const f = fixture({ [failure]: true });
    await assert.rejects(f.run());
    assert.equal(f.binding().sandboxId, "old");
    assert.ok(deleted(f, "new"));
    assert.ok(!deleted(f, "old"));
  });
}

test("rollback restores an initially unbound endpoint", async () => {
  const f = fixture({ publicFails: true, initiallyUnbound: true });
  await assert.rejects(f.run());
  assert.equal(f.binding(), null);
  assert.ok(deleted(f, "new"));
});

test("failed rollback retains the candidate that may still be serving traffic", async () => {
  const f = fixture({ publicFails: true, rollbackFails: true });
  await assert.rejects(f.run());
  assert.equal(f.binding().sandboxId, "new");
  assert.ok(!deleted(f, "new"));
  assert.ok(f.logs.some((message) => message.includes("Cleanup could not be confirmed")));
});

test("does not overwrite an endpoint changed by another deployment", async () => {
  const f = fixture({ externallyChanged: true });
  await assert.rejects(f.run(), /Endpoint changed/);
  assert.equal(f.binding().sandboxId, "external");
  assert.ok(deleted(f, "new"));
});

test("validates required secrets and commit before provisioning", () => {
  assert.equal(configuration(config).GITHUB_SHA, config.GITHUB_SHA);
  assert.throws(() => configuration({ ...config, JWT_SECRET: "" }), /Missing JWT_SECRET/);
  assert.throws(() => configuration({ ...config, GITHUB_SHA: "main" }), /commit SHA/);
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
  assert.deepEqual(await api("POST", "/sandboxes", { image: "ubuntu:24.04" }), { id: "new" });
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
  await assert.rejects(api("GET", "/sandboxes"), { message: "Platform GET /sandboxes: HTTP 401" });
  assert.equal(count, 1);
});
