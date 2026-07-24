import { createServer } from "node:http";
import { consoleLogger } from "./api/logger";
import { createRouter } from "./api/router";
import { buildRoutes } from "./api/routes";
import { db } from "./database/client";

const port = Number(process.env.PORT ?? 3001);
const log = consoleLogger;
const router = createRouter(buildRoutes({ log, db }));

const server = createServer((req, res) => {
  router(req, res).catch((error) => {
    log.error({ error: String(error) }, "Unhandled request error");
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Internal server error" }));
    }
  });
});

server.listen(port, () => {
  log.info({ port }, "backend listening");
});
