import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";

const config = loadConfig();
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "../public");
const assetRoot = resolve(here, "../../public/assets");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function sendStatic(response, root, relativePath) {
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + sep)) {
    sendJson(response, 400, { error: "Geçersiz dosya yolu." });
    return;
  }
  try {
    const data = await readFile(target);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(target).toLowerCase()] || "application/octet-stream",
      "content-length": data.length,
      "x-content-type-options": "nosniff",
      "cache-control": extname(target) === ".html" ? "no-cache" : "public, max-age=300"
    });
    response.end(data);
  } catch {
    sendJson(response, 404, { error: "Dosya bulunamadı." });
  }
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    if (request.method !== "GET") {
      response.setHeader("allow", "GET");
      return sendJson(response, 405, { error: "Yöntem desteklenmiyor." });
    }
    if (url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        app: config.appName,
        version: config.version
      });
    }
    if (url.pathname === "/ready") {
      return sendJson(response, 200, { status: "ready" });
    }
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return sendJson(response, 400, { error: "Geçersiz adres." });
    }
    if (pathname.startsWith("/assets/")) {
      return sendStatic(response, assetRoot, pathname.slice("/assets/".length));
    }
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    return sendStatic(response, webRoot, relative);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  createServer().listen(config.port, "0.0.0.0", () => {
    process.stdout.write(`Umaykut Online 2 V2 ${config.version} ${config.port} portunda hazır.\\n`);
  });
}
