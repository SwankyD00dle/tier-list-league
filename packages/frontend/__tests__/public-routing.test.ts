import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("public app routing", () => {
  it.each([
    [undefined, ""],
    ["http://localhost:3000", ""],
    ["https://example.test/", ""],
    ["https://example.test/ingress/app-19", "/ingress/app-19"],
    ["https://example.test/ingress/app-19/", "/ingress/app-19"],
  ])(
    "configures assets, pages, rewrite and client base consistently for %s",
    async (origin, prefix) => {
      vi.stubEnv("APP_PUBLIC_URL", origin);
      vi.stubEnv("BACKEND_URL", "http://localhost:3001");
      const { default: config } = await import("../next.config");
      expect(config.basePath).toBe(prefix);
      expect(config.env?.NEXT_PUBLIC_BASE_PATH).toBe(prefix);
      // Next automatically adds basePath to rewrite sources, not external destinations.
      expect(await config.rewrites?.()).toEqual([
        { source: "/api/:path*", destination: "http://localhost:3001/api/:path*" },
      ]);
    },
  );

  it.each([
    "",
    "/relative",
    "ftp://example.test/app",
    "https://user:password@example.test/app",
    "https://example.test/app?query=1",
    "https://example.test/app#fragment",
    "https://example.test/app?",
    "https://example.test/app#",
    "https://example.test/one/../two",
    "https://example.test/one/%2e%2e/two",
    "https://example.test/one\\two",
    "https://example.test/one//two",
    "https://example.test/:wildcard",
    "https://example.test ",
    "https://example.test\\",
  ])("rejects ambiguous or unsafe origin without echoing it: %s", async (origin) => {
    vi.stubEnv("APP_PUBLIC_URL", origin);
    await expect(import("../next.config")).rejects.toThrow("APP_PUBLIC_URL must be");
    await expect(import("../next.config")).rejects.not.toThrow("password");
  });

  it.each(["", "/ingress/app-19"])(
    "prefixes same-origin fetch and OAuth links with '%s'",
    async (prefix) => {
      vi.stubEnv("NEXT_PUBLIC_BASE_PATH", prefix);
      vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
      vi.stubGlobal("fetch", fetchMock);
      const { api, apiUrl, routes } = await import("../api/api");
      expect(await api.health()).toMatchObject({ ok: true });
      expect(fetchMock).toHaveBeenCalledWith(`${prefix}/api/health`, expect.any(Object));
      expect(apiUrl(routes.discordAuth)).toBe(`${prefix}/api/auth/discord`);
      expect(apiUrl(routes.discordAuthCallback)).toBe(`${prefix}/api/auth/discord/callback`);
      await api.logout();
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${prefix}/api/auth/logout`,
        expect.objectContaining({ method: "POST" }),
      );
      expect(apiUrl(routes.game("a/b"))).toBe(`${prefix}/api/games/a%2Fb`);
    },
  );

  it("preserves an explicit API origin without adding the frontend prefix", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/ingress/app-19");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test/backend");
    const { apiUrl, routes } = await import("../api/api");
    expect(apiUrl(routes.me)).toBe("https://api.example.test/backend/api/auth/me");
    expect(apiUrl(routes.discordAuth)).toBe("https://api.example.test/backend/api/auth/discord");
  });
});
