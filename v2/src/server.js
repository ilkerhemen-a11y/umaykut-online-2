import http from "node:http";
import { loadConfig } from "./config.js";

const config = loadConfig();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

export function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        app: config.appName,
        version: config.version
      });
    }
    if (request.method === "GET" && url.pathname === "/ready") {
      return sendJson(response, 200, { status: "ready" });
    }
    return sendJson(response, 404, { error: "Bulunamadı." });
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  createServer().listen(config.port, "0.0.0.0", () => {
    process.stdout.write(`Umaykut Online 2 V2 ${config.version} ${config.port} portunda hazır.\\n`);
  });
}
