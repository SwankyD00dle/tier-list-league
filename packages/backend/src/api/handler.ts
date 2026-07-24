import type { db } from "../database/client";

export interface Logger {
  info(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface BaseHandlerConfig {
  log: Logger;
  db: typeof db;
}
