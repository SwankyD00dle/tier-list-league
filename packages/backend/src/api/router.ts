import type { IncomingMessage, ServerResponse } from "node:http";
import type { DefinedRoute, TypedRequest, TypedResponse } from "./route-helper";

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
    const typedRes: TypedResponse = {
      status(code) {
        pending.status = code;
        return typedRes;
      },
      json(body) {
        res.writeHead(pending.status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
        return typedRes;
      },
    };

    const match = compiled.find((route) => route.method === method && route.regex.test(pathname));
    if (!match) {
      typedRes.status(404).json({ ok: false, error: "Not found" });
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

    const query: Record<string, string | string[] | undefined> = {};
    for (const key of url.searchParams.keys()) {
      const values = url.searchParams.getAll(key);
      query[key] = values.length > 1 ? values : values[0];
    }

    let body: unknown;
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await readBody(req);
      } catch {
        typedRes.status(400).json({ ok: false, error: "Invalid JSON body" });
        return;
      }
    }

    const bodySpec = match.definition.body;
    if (bodySpec?.schema && !bodySpec.skipValidation) {
      const parsed = bodySpec.schema.safeParse(body);
      if (!parsed.success) {
        typedRes
          .status(400)
          .json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body" });
        return;
      }
      body = parsed.data;
    }

    const typedReq: TypedRequest = { body, params, query };
    try {
      await match.definition.handler(typedReq, typedRes);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Internal server error" }));
      }
    }
  };
}
