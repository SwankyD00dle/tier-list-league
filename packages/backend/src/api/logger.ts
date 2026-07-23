import type { Logger } from "./handler";

export const consoleLogger: Logger = {
  info(obj, msg) {
    console.log(JSON.stringify({ level: "info", msg, ...obj }));
  },
  error(obj, msg) {
    console.error(JSON.stringify({ level: "error", msg, ...obj }));
  },
};
