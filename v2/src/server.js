import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createPool } from "./database.js";
import {
  bearerToken,
  createSessionToken,
  hashPassword,
  sessionTokenHash,
  validateRegistration,
  verifyPassword,
  verifySessionToken
} from "./auth.js";

const config = loadConfig();
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "../public");
const assetRoot = resolve(here, "../../public/assets");
const INITIAL_RESOURCES = Object.freeze({gold:1650,wood:6900,food:9350,stone:7480,iron:8040,horses:100});
const INITIAL_BUILDINGS = Object.freeze({
  "1": {type:"center",level:1},
  "2": {type:"barracks",level:1},
  "3": {type:"stable",level:1},
  "4": {type:"blacksmith",level:1},
  "5": {type:"school",level:1},
  "6": {type:"lumberyard",level:1},
  "7": {type:"temple",level:1},
  "8": {type:"market",level:1},
  "9": {type:"warehouse",level:1}
});
const FIXED_BUILDING_TYPES = Object.freeze({
  "1": "center",
  "2": "barracks",
  "3": "stable",
  "4": "blacksmith",
  "5": "school",
  "6": "lumberyard",
  "7": "temple",
  "8": "market",
  "9": "warehouse"
});
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

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 8192) {
      throw Object.assign(new Error("İstek çok büyük."), { status: 413 });
    }
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw Object.assign(new Error("Geçersiz JSON."), { status: 400 });
  }
}

async function sendStatic(res, root, relative) {
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(root + sep)) {
    return sendJson(res, 400, { error: "Geçersiz dosya yolu." });
  }
  try {
    const data = await readFile(target);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(target).toLowerCase()] || "application/octet-stream",
      "content-length": data.length,
      "x-content-type-options": "nosniff",
      "cache-control": extname(target) === ".html" ? "no-cache" : "public, max-age=300"
    });
    res.end(data);
  } catch {
    return sendJson(res, 404, { error: "Dosya bulunamadı." });
  }
}

export function createServer({ pool = createPool(), sessionSecret = process.env.SESSION_SECRET } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { status: "ok", app: config.appName, version: config.version });
    }

    if (req.method === "GET" && url.pathname === "/ready") {
      if (!pool) {
        return sendJson(res, 503, { status: "not_ready", databaseConfigured: false });
      }
      try {
        await pool.query("SELECT 1");
        return sendJson(res, 200, { status: "ready", databaseConfigured: true });
      } catch {
        return sendJson(res, 503, { status: "not_ready", databaseConfigured: true });
      }
    }



    if (url.pathname === "/api/game/buildings") {
      if (!pool) return sendJson(res, 503, { error: "Oyun kayıt servisi henüz yapılandırılmadı." });
      if (!sessionSecret || sessionSecret.length < 32) {
        return sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." });
      }
      if (req.method !== "POST") {
        res.setHeader("allow", "POST");
        return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
      }
      const token = bearerToken(req);
      const session = verifySessionToken(token, sessionSecret);
      if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });
      try {
        const playerResult = await pool.query(
          "SELECT p.id FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id = p.id WHERE p.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()",
          [session.id, sessionTokenHash(token)]
        );
        if (!playerResult.rowCount) return sendJson(res, 401, { error: "Oyuncu oturumu bulunamadı." });
        const playerId = playerResult.rows[0].id;
        const input = await readJson(req);
        const slot = Number(input.slot);
        const action = input.action;
        if (!Number.isSafeInteger(slot) || slot < 1 || slot > 9) {
          return sendJson(res, 400, { error: "Geçerli bir bina alanı seçmelisin." });
        }
        if (action !== "upgrade") {
          return sendJson(res, 400, { error: "Bina türleri sabittir; yalnızca mevcut binaları yükseltebilirsin." });
        }
        const fixedType = FIXED_BUILDING_TYPES[String(slot)];

        const client = await pool.connect();
        let inTransaction = false;
        try {
          await client.query("BEGIN");
          inTransaction = true;
          await client.query(
            "INSERT INTO umaykut_v2.player_game_state(player_id) VALUES($1) ON CONFLICT (player_id) DO NOTHING",
            [playerId]
          );
          const currentResult = await client.query(
            "SELECT resources, buildings FROM umaykut_v2.player_game_state WHERE player_id = $1 FOR UPDATE",
            [playerId]
          );
          const row = currentResult.rows[0];
          const resources = typeof row.resources === "string" ? JSON.parse(row.resources) : { ...row.resources };
          const buildings = typeof row.buildings === "string" ? JSON.parse(row.buildings) : { ...row.buildings };
          const key = String(slot);
          const current = buildings[key] || null;
          if (!current) {
            await client.query("ROLLBACK");
            inTransaction = false;
            return sendJson(res, 409, { error: "Bu binanın başlangıç seviyesi bulunamadı. Oyunu yenileyip tekrar dene." });
          }
          const currentLevel = Number(current.level);
          if (!Number.isSafeInteger(currentLevel) || currentLevel < 1) {
            await client.query("ROLLBACK");
            inTransaction = false;
            return sendJson(res, 409, { error: "Bina seviyesi geçersiz." });
          }
          if (currentLevel >= 10) {
            await client.query("ROLLBACK");
            inTransaction = false;
            return sendJson(res, 409, { error: "Bu bina en yüksek seviye olan 10'a ulaştı." });
          }
          const targetLevel = currentLevel + 1;
          const cost = { wood: 30 * targetLevel, stone: 20 * targetLevel, iron: 5 * targetLevel };
          const missing = Object.fromEntries(Object.entries(cost)
            .filter(([resource,amount]) => Number(resources[resource] || 0) < amount)
            .map(([resource,amount]) => [resource, amount - Number(resources[resource] || 0)]));
          if (Object.keys(missing).length) {
            await client.query("ROLLBACK");
            inTransaction = false;
            return sendJson(res, 409, { error: "Yeterli kaynak yok.", missing, cost });
          }
          for (const [resource,amount] of Object.entries(cost)) resources[resource] = Number(resources[resource]) - amount;
          const building = { type: fixedType, level: targetLevel };
          buildings[key] = building;
          await client.query(
            "UPDATE umaykut_v2.player_game_state SET resources = $2::jsonb, buildings = $3::jsonb, updated_at = NOW() WHERE player_id = $1",
            [playerId, JSON.stringify(resources), JSON.stringify(buildings)]
          );
          await client.query("COMMIT");
          inTransaction = false;
          return sendJson(res, 200, { success: true, slot, building, cost, resources, buildings });
        } catch (error) {
          if (inTransaction) {
            try { await client.query("ROLLBACK"); } catch {}
          }
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("V2 building operation failed", {
          code: error.code || "UNKNOWN",
          message: String(error.message || "Unknown building operation error").slice(0, 200)
        });
        return sendJson(res, error.status || 500, {
          error: error.status ? error.message : "Bina işlemi tamamlanamadı."
        });
      }
    }

    if (url.pathname === "/api/player/profile") {
      if (!pool) return sendJson(res, 503, { error: "Oyuncu profili servisi henüz yapılandırılmadı." });
      if (!sessionSecret || sessionSecret.length < 32) return sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." });
      if (!["GET", "PUT"].includes(req.method)) {
        res.setHeader("allow", "GET, PUT");
        return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
      }
      const token = bearerToken(req);
      const session = verifySessionToken(token, sessionSecret);
      if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });
      try {
        await pool.query("ALTER TABLE umaykut_v2.players ADD COLUMN IF NOT EXISTS village_name VARCHAR(32)");
        const validSession = await pool.query(
          "SELECT p.id FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id = p.id WHERE p.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()",
          [session.id, sessionTokenHash(token)]
        );
        if (!validSession.rowCount) return sendJson(res, 401, { error: "Oyuncu oturumu bulunamadı." });
        if (req.method === "GET") {
          const result = await pool.query(
            "SELECT p.village_name, s.faction_id FROM umaykut_v2.players p LEFT JOIN umaykut_v2.player_game_state s ON s.player_id = p.id WHERE p.id = $1",
            [session.id]
          );
          return sendJson(res, 200, {
            villageName: result.rows[0]?.village_name || null,
            factionId: result.rows[0]?.faction_id || null
          });
        }
        const input = await readJson(req);
        const villageName = typeof input.villageName === "string" ? input.villageName.trim() : "";
        const factionId = typeof input.factionId === "string" ? input.factionId : "";
        if (villageName.length < 3 || villageName.length > 32 || !/^[\p{L}\p{N}][\p{L}\p{N} '\u2019-]*$/u.test(villageName)) {
          return sendJson(res, 400, { error: "Köy adı 3–32 karakter olmalı; harf, rakam ve boşluk kullanabilirsin." });
        }
        if (!["hun", "seljuk", "gokturk"].includes(factionId)) {
          return sendJson(res, 400, { error: "Devletini seçmeden yola çıkamazsın." });
        }
        await pool.query("UPDATE umaykut_v2.players SET village_name = $2 WHERE id = $1", [session.id, villageName]);
        await pool.query(
          `INSERT INTO umaykut_v2.player_game_state(player_id, faction_id)
           VALUES($1, $2)
           ON CONFLICT (player_id) DO UPDATE SET faction_id = EXCLUDED.faction_id, updated_at = NOW()`,
          [session.id, factionId]
        );
        return sendJson(res, 200, { success: true, villageName, factionId });
      } catch (error) {
        console.error("V2 player profile request failed", {
          code: error.code || "UNKNOWN",
          message: String(error.message || "Unknown profile error").slice(0, 200)
        });
        return sendJson(res, 500, { error: "Köy bilgilerin kaydedilemedi. Tekrar dene." });
      }
    }

    if (url.pathname === "/api/game/state") {
      if (!pool) return sendJson(res, 503, { error: "Oyun kayıt servisi henüz yapılandırılmadı." });
      if (!sessionSecret || sessionSecret.length < 32) {
        return sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." });
      }
      if (!["GET", "PUT"].includes(req.method)) {
        res.setHeader("allow", "GET, PUT");
        return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
      }
      const token = bearerToken(req);
      const session = verifySessionToken(token, sessionSecret);
      if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });
      try {
        const playerResult = await pool.query(
          "SELECT p.id FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id = p.id WHERE p.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()",
          [session.id, sessionTokenHash(token)]
        );
        if (!playerResult.rowCount) return sendJson(res, 401, { error: "Oyuncu oturumu bulunamadı." });
        const playerId = playerResult.rows[0].id;
        if (req.method === "GET") {
          await pool.query(
            "INSERT INTO umaykut_v2.player_game_state(player_id) VALUES($1) ON CONFLICT (player_id) DO NOTHING",
            [playerId]
          );
          const state = await pool.query(
            "SELECT faction_id, worker_pool, worker_assignments, worker_state_initialized, resources, buildings, updated_at FROM umaykut_v2.player_game_state WHERE player_id = $1",
            [playerId]
          );
          const row = state.rows[0];
          return sendJson(res, 200, {
            factionId: row.faction_id,
            workerPool: Number(row.worker_pool),
            workerAssignments: row.worker_assignments,
            workerStateInitialized: row.worker_state_initialized,
            resources: row.resources,
            buildings: row.buildings,
            updatedAt: row.updated_at
          });
        }
        const input = await readJson(req);
        const allowedFactions = new Set(["hun", "seljuk", "gokturk"]);
        const factionId = input.factionId == null ? null : String(input.factionId);
        if (factionId !== null && !allowedFactions.has(factionId)) {
          return sendJson(res, 400, { error: "Geçerli bir devlet seçmelisin." });
        }
        const source = input.workerAssignments && typeof input.workerAssignments === "object"
          ? input.workerAssignments : {};
        const workerAssignments = { grain: source.grain, wood: source.wood, stone: source.stone };
        const values = Object.values(workerAssignments);
        if (!values.every(value => Number.isSafeInteger(value) && value >= 0) ||
            Object.keys(source).some(key => !["grain", "wood", "stone"].includes(key)) ||
            values.reduce((sum, value) => sum + value, 0) > 1800) {
          return sendJson(res, 400, { error: "İşçi dağılımı geçersiz. Toplam işçi sayısı 1.800'ü aşamaz." });
        }
        const saved = await pool.query(
          `INSERT INTO umaykut_v2.player_game_state(player_id, faction_id, worker_assignments, worker_state_initialized)
           VALUES($1, $2, $3::jsonb, TRUE)
           ON CONFLICT (player_id) DO UPDATE
             SET faction_id = COALESCE(EXCLUDED.faction_id, umaykut_v2.player_game_state.faction_id),
                 worker_assignments = EXCLUDED.worker_assignments,
                 worker_state_initialized = TRUE,
                 updated_at = NOW()
           RETURNING faction_id, worker_pool, worker_assignments, worker_state_initialized, resources, buildings, updated_at`,
          [playerId, factionId, JSON.stringify(workerAssignments)]
        );
        const row = saved.rows[0];
        return sendJson(res, 200, {
          success: true,
          factionId: row.faction_id,
          workerPool: Number(row.worker_pool),
          workerAssignments: row.worker_assignments,
          workerStateInitialized: row.worker_state_initialized,
          resources: row.resources,
          buildings: row.buildings,
          updatedAt: row.updated_at
        });
      } catch (error) {
        console.error("V2 game state request failed", {
          code: error.code || "UNKNOWN",
          message: String(error.message || "Unknown game state error").slice(0, 200)
        });
        return sendJson(res, 500, { error: "Oyun ilerlemesi kaydedilemedi." });
      }
    }

    if (url.pathname.startsWith("/api/auth/")) {
      if (!pool) return sendJson(res, 503, { error: "Hesap servisi henüz yapılandırılmadı." });
      if (!sessionSecret || sessionSecret.length < 32) {
        return sendJson(res, 503, { error: "Oturum güvenlik ayarı eksik." });
      }

      if (req.method === "POST" && url.pathname === "/api/auth/register") {
        try {
          const input = await readJson(req);
          const issue = validateRegistration(input);
          if (issue) return sendJson(res, 400, { error: issue });

          const username = input.username.trim();
          const email = input.email.trim().toLowerCase();
          await pool.query("ALTER TABLE umaykut_v2.players ADD COLUMN IF NOT EXISTS village_name VARCHAR(32)");
          const passwordHash = await hashPassword(input.password);
          const result = await pool.query(
            "INSERT INTO umaykut_v2.players(username, username_normalized, email, email_normalized, password_hash) VALUES($1, $2, $3, $4, $5) RETURNING id, username, email, created_at, village_name",
            [username, username.toLowerCase(), email, email.toLowerCase(), passwordHash]
          );
          const player = result.rows[0];
          // Give every newly registered account an independent, explicit level-1 village.
          await pool.query(
            `INSERT INTO umaykut_v2.player_game_state
              (player_id, resources, buildings, worker_assignments, worker_state_initialized)
             VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, TRUE)
             ON CONFLICT (player_id) DO NOTHING`,
            [
              player.id,
              JSON.stringify(INITIAL_RESOURCES),
              JSON.stringify(INITIAL_BUILDINGS),
              JSON.stringify({grain:0,wood:0,stone:0})
            ]
          );
          const token = createSessionToken(player.id, sessionSecret);
          const session = verifySessionToken(token, sessionSecret);
          await pool.query(
            "INSERT INTO umaykut_v2.player_sessions(player_id, token_hash, expires_at) VALUES($1, $2, to_timestamp($3))",
            [player.id, sessionTokenHash(token), session.expiresAt]
          );
          return sendJson(res, 201, { player, token, tokenType: "Bearer" });
        } catch (error) {
          if (error.code === "23505") {
            return sendJson(res, 409, { error: "Bu oyuncu adı veya e-posta zaten kayıtlı." });
          }
          // Keep diagnostics useful without ever logging passwords, hashes, email addresses, or request bodies.
          console.error("V2 account registration failed", {
            code: error.code || "UNKNOWN",
            constraint: error.constraint || null,
            message: String(error.message || "Unknown registration error").slice(0, 240)
          });
          return sendJson(res, error.status || 500, {
            error: error.status ? error.message : "Kayıt işlemi tamamlanamadı. Sunucu hatası kaydedildi."
          });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        try {
          const input = await readJson(req);
          const login = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
          const password = typeof input.password === "string" ? input.password : "";
          if (!login || !password || password.length > 128) {
            return sendJson(res, 400, { error: "E-posta/oyuncu adı ve şifre gerekli." });
          }

          await pool.query("ALTER TABLE umaykut_v2.players ADD COLUMN IF NOT EXISTS village_name VARCHAR(32)");
          const result = await pool.query(
            "SELECT id, username, email, password_hash, village_name FROM umaykut_v2.players WHERE email_normalized = $1 OR username_normalized = $1 LIMIT 1",
            [login]
          );
          const player = result.rows[0];
          if (!player || !await verifyPassword(password, player.password_hash)) {
            return sendJson(res, 401, { error: "Giriş bilgileri hatalı." });
          }

          const token = createSessionToken(player.id, sessionSecret);
          const session = verifySessionToken(token, sessionSecret);
          await pool.query(
            "INSERT INTO umaykut_v2.player_sessions(player_id, token_hash, expires_at) VALUES($1, $2, to_timestamp($3))",
            [player.id, sessionTokenHash(token), session.expiresAt]
          );
          return sendJson(res, 200, {
            player: { id: player.id, username: player.username, email: player.email, village_name: player.village_name },
            token,
            tokenType: "Bearer"
          });
        } catch (error) {
          return sendJson(res, error.status || 500, {
            error: error.status ? error.message : "Giriş işlemi tamamlanamadı."
          });
        }
      }

      if (req.method === "DELETE" && url.pathname === "/api/auth/session") {
        const token = bearerToken(req);
        const session = verifySessionToken(token, sessionSecret);
        if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });
        try {
          const result = await pool.query(
            "DELETE FROM umaykut_v2.player_sessions WHERE player_id = $1 AND token_hash = $2 RETURNING id",
            [session.id, sessionTokenHash(token)]
          );
          if (!result.rowCount) return sendJson(res, 401, { error: "Oturum zaten kapatılmış." });
          return sendJson(res, 200, { success: true, message: "Oturum güvenli şekilde kapatıldı." });
        } catch {
          return sendJson(res, 500, { error: "Oturum kapatılamadı. Tekrar dene." });
        }
      }

      if (req.method === "GET" && url.pathname === "/api/auth/me") {
        const token = bearerToken(req);
        const session = verifySessionToken(token, sessionSecret);
        if (!session) return sendJson(res, 401, { error: "Oturum geçersiz veya süresi dolmuş." });

        try {
          await pool.query("ALTER TABLE umaykut_v2.players ADD COLUMN IF NOT EXISTS village_name VARCHAR(32)");
          const result = await pool.query(
            "SELECT p.id, p.username, p.email, p.created_at, p.village_name FROM umaykut_v2.players p JOIN umaykut_v2.player_sessions s ON s.player_id = p.id WHERE p.id = $1 AND s.token_hash = $2 AND s.expires_at > NOW()",
            [session.id, sessionTokenHash(token)]
          );
          if (!result.rowCount) return sendJson(res, 401, { error: "Oyuncu bulunamadı." });
          return sendJson(res, 200, { player: result.rows[0] });
        } catch {
          return sendJson(res, 500, { error: "Oyuncu bilgisi alınamadı." });
        }
      }

      if (!["GET", "POST"].includes(req.method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
      }
      return sendJson(res, 404, { error: "Kimlik doğrulama uç noktası bulunamadı." });
    }

    if (req.method !== "GET") {
      res.setHeader("allow", "GET");
      return sendJson(res, 405, { error: "Yöntem desteklenmiyor." });
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return sendJson(res, 400, { error: "Geçersiz adres." });
    }

    if (pathname.startsWith("/assets/")) {
      return sendStatic(res, assetRoot, pathname.slice("/assets/".length));
    }
    return sendStatic(res, webRoot, pathname === "/" ? "index.html" : pathname.slice(1));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const pool = createPool();
  const server = createServer({ pool });
  server.listen(config.port, "0.0.0.0", () => {
    process.stdout.write(`Umaykut Online 2 V2 ${config.version} ${config.port} portunda hazır.\n`);
  });
  const shutdown = async () => {
    server.close();
    if (pool) await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
