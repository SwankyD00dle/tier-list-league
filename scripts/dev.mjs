import { spawn } from "node:child_process";
import { connect } from "node:net";

const children = [];
let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    child.kill(signal);
  }
}

function start(args, env) {
  const child = spawn("npm", args, { env: { ...process.env, ...env }, stdio: "inherit" });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (!stopping) {
      stop();
      process.exitCode = code ?? (signal ? 1 : 0);
    }
  });
  return child;
}

function waitForPort(port, timeoutMs = 30_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      const socket = connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
          return;
        }
        setTimeout(check, 100);
      });
    }
    check();
  });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

start(["run", "dev", "--workspace", "@tier-list-league/backend"], { PORT: "3001" });

try {
  await waitForPort(3001);
  start(["run", "dev", "--workspace", "@tier-list-league/frontend", "--", "-p", "3000"], {
    BACKEND_URL: "http://localhost:3001",
  });
} catch (error) {
  console.error(error);
  stop();
  process.exitCode = 1;
}
