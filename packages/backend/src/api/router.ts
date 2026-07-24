import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiRequest, ApiResponse, DefinedRoute } from "./route-helper";

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

export function createRouter(routes: RegisteredRoute[]) {
  const compiled: CompiledRoute[] = routes.map((route) => ({ ...route, ...compile(route.path) }));

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    const pending = { status: 200 };
    const reply: ApiResponse<unknown> = {
      status(code) {
        pending.status = code;
        return reply;
      },
      json(body) {
        res.writeHead(pending.status, { "content-type": "application/json" });
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

    const routeReq: ApiRequest = { body, params, query };
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
