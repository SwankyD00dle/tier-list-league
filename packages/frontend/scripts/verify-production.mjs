import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { setTimeout } from "node:timers/promises";

// Real production Next builds/listeners; only the internal API is a test double.
// Run from this workspace with `npm run test:production` (no credentials or DB needed).
const backend = createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ upstreamPath: req.url }));
});
backend.listen(0, "127.0.0.1");
await once(backend, "listening");
const backendAddress = backend.address();
assert(backendAddress && typeof backendAddress !== "string");

try {
  for (const prefix of ["", "/ingress/app-19"]) {
    const env = {
      ...process.env,
      APP_PUBLIC_URL: `https://example.test${prefix}`,
      BACKEND_URL: `http://127.0.0.1:${backendAddress.port}`,
      NEXT_PUBLIC_API_BASE_URL: "",
      NEXT_TELEMETRY_DISABLED: "1",
    };
    const build = spawnSync("npm", ["run", "build"], {
      env,
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(build.status, 0, `Production build failed: ${build.stdout}\n${build.stderr}`);
    const manifest = JSON.parse(await readFile(".next/routes-manifest.json", "utf8"));
    assert.equal(manifest.basePath, prefix);
    assert.equal(manifest.rewrites.afterFiles[0].source, `${prefix}/api/:path*`);
    assert.equal(manifest.rewrites.afterFiles[0].destination, `${env.BACKEND_URL}/api/:path*`);

    const portReservation = createServer();
    portReservation.listen(0, "127.0.0.1");
    await once(portReservation, "listening");
    const address = portReservation.address();
    assert(address && typeof address !== "string");
    await new Promise((resolve) => portReservation.close(resolve));
    // Also exercise config loading when Next is launched from the monorepo root.
    const frontend = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "packages/frontend",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(address.port),
      ],
      { env, cwd: "../..", stdio: ["ignore", "pipe", "pipe"] },
    );
    let logs = "";
    for (const stream of [frontend.stdout, frontend.stderr]) {
      stream.on("data", (chunk) => {
        logs = `${logs}${chunk}`.slice(-32_000);
      });
    }
    const stopped = once(frontend, "exit");
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          ready = (await fetch(`${origin}${prefix}/`, { signal: AbortSignal.timeout(1000) })).ok;
        } catch {
          // Listener may not have bound yet.
        }
        if (ready || frontend.exitCode !== null) break;
        await setTimeout(100);
      }
      assert(ready, `Frontend did not become ready: ${logs}`);
      for (const page of ["/", "/game"]) {
        const response = await fetch(`${origin}${prefix}${page}`);
        assert(response.ok, `Page ${prefix}${page} failed`);
        const html = await response.text();
        assert(html.includes("Tier List League"));
        const assets = [...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(
          (match) => match[1],
        );
        assert(
          assets.some((asset) => asset.endsWith(".js")),
          "Missing scripts",
        );
        assert(
          assets.some((asset) => asset.endsWith(".css")),
          "Missing styles",
        );
        for (const asset of new Set(assets)) {
          assert(asset.startsWith(`${prefix}/_next/static/`), `Asset lost prefix: ${asset}`);
          assert((await fetch(`${origin}${asset}`)).ok, `Asset unavailable: ${asset}`);
        }
      }
      for (const path of [
        "/api/health",
        "/api/auth/discord",
        "/api/auth/discord/callback?code=test&state=test",
      ]) {
        const response = await fetch(`${origin}${prefix}${path}`);
        assert(response.ok);
        assert.deepEqual(await response.json(), { upstreamPath: path });
      }
      if (prefix) {
        assert.equal((await fetch(`${origin}/game`)).status, 404);
        assert.equal((await fetch(`${origin}/api/health`)).status, 404);
      }
      console.log(
        `PASS production pages, JS/CSS assets and API/OAuth rewrites: ${prefix || "(root)"}`,
      );
    } finally {
      frontend.kill("SIGTERM");
      await Promise.race([stopped, setTimeout(5000).then(() => frontend.kill("SIGKILL"))]);
    }
  }
} finally {
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
}
