import type { IncomingMessage, ServerResponse } from "node:http";
import { serializeCookie } from "./cookie";
import type { ApiRequest, ApiResponse, CookieOptions, DefinedRoute } from "./route-helper";

export interface RegisteredRoute {
  method: string;
  path: string;
  definition: DefinedRoute;
}

interface CompiledRoute extends RegisteredRoute {
  regex: RegExp;
  paramNames: string[];
}

function compile(path: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const pattern = path
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${pattern}/?$`), paramNames };
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (raw === "") {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function normalizeHeaders(req: IncomingMessage): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers[name] = value;
    }
  }
  return headers;
}

function appendSetCookie(pendingHeaders: Record<string, string | string[]>, cookie: string): void {
  const existing = pendingHeaders["set-cookie"];
  if (existing === undefined) {
    pendingHeaders["set-cookie"] = cookie;
  } else if (typeof existing === "string") {
    pendingHeaders["set-cookie"] = [existing, cookie];
  } else {
    existing.push(cookie);
  }
}

export function createRouter(routes: RegisteredRoute[]) {
  const compiled: CompiledRoute[] = routes.map((route) => ({ ...route, ...compile(route.path) }));

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    const pending = { status: 200 };
    const pendingHeaders: Record<string, string | string[]> = {};
    let ended = false;

    const reply: ApiResponse<unknown> = {
      status(code) {
        pending.status = code;
        return reply;
      },
      setHeader(name, value) {
        pendingHeaders[name.toLowerCase()] = value;
        return reply;
      },
      setCookie(name, value, options) {
        appendSetCookie(pendingHeaders, serializeCookie(name, value, options));
        return reply;
      },
      clearCookie(name, options: CookieOptions = {}) {
        appendSetCookie(
          pendingHeaders,
          serializeCookie(name, "", { ...options, maxAge: 0, expires: new Date(0) }),
        );
        return reply;
      },
      redirect(urlTarget) {
        if (ended) {
          return reply;
        }
        ended = true;
        if (pending.status === 200) {
          pending.status = 302;
        }
        pendingHeaders.location = urlTarget;
        res.writeHead(pending.status, pendingHeaders);
        res.end();
        return reply;
      },
      json(body) {
        if (ended) {
          return reply;
        }
        ended = true;
        res.writeHead(pending.status, {
          "content-type": "application/json",
          ...pendingHeaders,
        });
        res.end(JSON.stringify(body));
        return reply;
      },
    };

    const match = compiled.find((route) => route.method === method && route.regex.test(pathname));
    if (!match) {
      reply.status(404).json({ ok: false, code: "NOT_FOUND", message: "Not found" });
      return;
    }

    const params: Record<string, string> = {};
    const captured = match.regex.exec(pathname);
    if (captured) {
      match.paramNames.forEach((name, index) => {
        const value = captured[index + 1];
        if (value !== undefined) {
          params[name] = decodeURIComponent(value);
        }
      });
    }

    const query: Record<string, string | string[]> = {};
    for (const key of url.searchParams.keys()) {
      const values = url.searchParams.getAll(key);
      query[key] = values.length > 1 ? values : (values[0] ?? "");
    }

    let body: unknown;
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await readBody(req);
      } catch {
        reply.status(400).json({ ok: false, code: "INVALID_JSON", message: "Invalid JSON body" });
        return;
      }
    }

    const routeReq: ApiRequest = {
      body,
      params,
      query,
      headers: normalizeHeaders(req),
    };
    try {
      await match.definition.handler(routeReq, reply);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            code: "INTERNAL_ERROR",
            message: "Internal server error",
          }),
        );
      }
    }
  };
}
