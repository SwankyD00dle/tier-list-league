import { createServer } from "node:http";
import { sql } from "drizzle-orm";
import { db } from "./db/client";

const port = Number(process.env.PORT ?? 3001);

const server = createServer((req, res) => {
  if (req.url === "/health") {
    db.execute(sql`select 1`).then(
      () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      },
      () => {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "db_unavailable" }));
      },
    );
    return;
  }

  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ service: "tier-list-league backend" }));
});

server.listen(port, () => {
  console.log(`backend listening on port ${port}`);
});
