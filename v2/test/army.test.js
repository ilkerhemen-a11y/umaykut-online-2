import test from "node:test";
import assert from "node:assert/strict";
import { getTroopCatalog, settleTrainingQueue, handleArmyRequest } from "../src/army.js";
import { createSessionToken } from "../src/auth.js";

test("level-one barracks and stable only unlock their first units", () => {
  const catalog = getTroopCatalog("gokturk", {
    barracks: { level: 1 }, stable: { level: 1 }
  });
  assert.equal(catalog.find(unit => unit.id === "infantry").unlocked, true);
  assert.equal(catalog.find(unit => unit.id === "archer").unlocked, false);
  assert.equal(catalog.find(unit => unit.id === "light_cavalry").unlocked, true);
  assert.equal(catalog.find(unit => unit.id === "mounted_archer").unlocked, false);
});

test("barracks and stable levels unlock advanced troop tiers", () => {
  const catalog = getTroopCatalog("seljuk", {
    barracks: { level: 10 }, stable: { level: 10 }
  });
  assert.equal(catalog.length, 8);
  assert.ok(catalog.every(unit => unit.unlocked));
});

test("factions receive distinct troop identities and specialties", () => {
  const buildings = { barracks: { level: 10 }, stable: { level: 10 } };
  const gokturk = getTroopCatalog("gokturk", buildings);
  const hun = getTroopCatalog("hun", buildings);
  const seljuk = getTroopCatalog("seljuk", buildings);
  assert.equal(gokturk.find(unit => unit.id === "archer").name, "Börü Okçusu");
  assert.equal(hun.find(unit => unit.id === "light_cavalry").name, "Tunga");
  assert.equal(seljuk.find(unit => unit.id === "heavy_cavalry").name, "Ağır Sipahi");
  assert.ok(hun.find(unit => unit.id === "light_cavalry").speed > gokturk.find(unit => unit.id === "light_cavalry").speed);
  assert.ok(seljuk.find(unit => unit.id === "shield").infantryDefense > gokturk.find(unit => unit.id === "shield").infantryDefense);
});

test("barracks and stable levels do not add training time", () => {
  const low = getTroopCatalog("gokturk", { barracks: { level: 1 }, stable: { level: 1 } });
  const high = getTroopCatalog("gokturk", { barracks: { level: 10 }, stable: { level: 10 } });
  assert.equal("secondsPerUnit" in low.find(unit => unit.id === "infantry"), false);
  assert.equal("secondsPerUnit" in high.find(unit => unit.id === "light_cavalry"), false);
});
test("numeric V2 building slots unlock troop tiers without training timers", () => {
  const levelOne = getTroopCatalog("gokturk", { "2": { type: "barracks", level: 1 }, "3": { type: "stable", level: 1 } });
  assert.equal(levelOne.find(unit => unit.id === "archer").unlocked, false);
  assert.equal(levelOne.find(unit => unit.id === "mounted_archer").unlocked, false);
  const levelFive = getTroopCatalog("gokturk", { "2": { type: "barracks", level: 5 }, "3": { type: "stable", level: 5 } });
  assert.equal(levelFive.find(unit => unit.id === "archer").unlocked, true);
  assert.equal(levelFive.find(unit => unit.id === "shield").unlocked, true);
  assert.equal(levelFive.find(unit => unit.id === "mounted_archer").unlocked, true);
});
test("legacy training queue entries are converted to instant troops", () => {
  const now = Date.now();
  const result = settleTrainingQueue({ infantry: 3 }, [
    { unitId: "infantry", amount: 4, completesAt: new Date(now + 60000).toISOString() },
    { unitId: "archer", amount: 2, completesAt: new Date(now + 600000).toISOString() }
  ], now);
  assert.deepEqual(result.troops, { infantry: 7, archer: 2 });
  assert.equal(result.trainingQueue.length, 0);
  assert.equal(result.changed, true);
});
test("legacy training entries without timestamps are safely settled", () => {
  const result = settleTrainingQueue({}, [{ unitId: "infantry", amount: 5 }], Date.now());
  assert.deepEqual(result.troops, { infantry: 5 });
  assert.equal(result.trainingQueue.length, 0);
  assert.equal(result.changed, true);
});

test("the reconnaissance unit is displayed as Casus in every faction", () => {
  for (const faction of ["gokturk", "hun", "seljuk"]) {
    const unit = getTroopCatalog(faction, { barracks: { level: 2 } }).find(item => item.id === "scout");
    assert.equal(unit.name, "Casus");
    assert.equal(unit.unlocked, true);
  }
});


test("army recruitment is capped by the number of idle workers on the server", async () => {
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const secret = "test-session-secret-with-at-least-32-characters";
  const token = createSessionToken(playerId, secret);
  const state = {
    faction_id: "gokturk",
    resources: { wood: 10000, food: 10000, iron: 10000, gold: 10000 },
    buildings: { "2": { type: "barracks", level: 5 }, "3": { type: "stable", level: 5 } },
    troops: {},
    training_queue: [],
    worker_pool: 1800,
    worker_assignments: { grain: 700, wood: 600, stone: 400 }
  };
  const writes = [];
  const pool = {
    query: async sql => sql.includes("SELECT p.id FROM umaykut_v2.players")
      ? { rows: [{ id: playerId }], rowCount: 1 }
      : sql.includes("SELECT resources FROM umaykut_v2.player_game_state")
        ? { rows: [{ resources: state.resources }], rowCount: 1 }
        : (() => { throw new Error("Unexpected pool query: " + sql); })(),
    connect: async () => ({
      query: async (sql, values = []) => {
        if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
        if (sql.includes("INSERT INTO umaykut_v2.player_game_state")) return { rows: [], rowCount: 1 };
        if (sql.includes("SELECT faction_id, resources, buildings, troops, training_queue")) return { rows: [state], rowCount: 1 };
        if (sql.includes("UPDATE umaykut_v2.player_game_state SET resources=")) {
          state.resources = JSON.parse(values[1]);
          state.training_queue = JSON.parse(values[2]);
          state.troops = JSON.parse(values[3]);
          writes.push(sql);
          return { rows: [], rowCount: 1 };
        }
        throw new Error("Unexpected client query: " + sql);
      },
      release: () => {}
    })
  };
  const invoke = async amount => {
    const req = {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      [Symbol.asyncIterator]: async function* () {
        yield JSON.stringify({ unitId: "infantry", amount });
      }
    };
    const response = {
      statusCode: 200, headers: {}, body: "",
      writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
      end(body) { this.body = body; }
    };
    await handleArmyRequest({ req, res: response, url: new URL("http://localhost/api/game/army/recruit"), pool, sessionSecret: secret });
    return { status: response.statusCode, body: JSON.parse(response.body) };
  };
  const tooMany = await invoke(101);
  assert.equal(tooMany.status, 409);
  assert.equal(tooMany.body.idleWorkers, 100);
  assert.equal(state.troops.infantry, undefined);
  const allowed = await invoke(100);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.troops.infantry, 100);
  assert.equal(allowed.body.idleWorkers, 0);
  assert.equal(allowed.body.totalUnits, 100);
  assert.equal(writes.length, 1);
});

test("Hun roster uses the seven approved names and exact base battle values", () => {
  const catalog = getTroopCatalog("hun", { barracks: { level: 10 }, stable: { level: 10 } });
  const byId = Object.fromEntries(catalog.map(unit => [unit.id, unit]));
  assert.deepEqual(
    ["infantry", "archer", "shield", "guard", "light_cavalry", "mounted_archer", "heavy_cavalry"].map(id => byId[id].name),
    ["Toygun", "Kemankeş", "Tarık", "Barlas", "Tunga", "Talakan", "Tarkan"]
  );
  assert.deepEqual(
    ["infantry", "archer", "shield", "guard", "light_cavalry", "mounted_archer", "heavy_cavalry"].map(id => [
      byId[id].attack, byId[id].infantryDefense, byId[id].cavalryDefense, byId[id].speed
    ]),
    [[35,25,15,16],[60,80,35,16],[20,25,90,14],[120,60,90,24],[65,50,110,32],[95,85,60,50],[150,110,80,40]]
  );
  assert.equal(byId.archer.attackDisplay, "30 × 2");
  assert.equal(byId.guard.attackDisplay, "120–130");
  assert.equal(byId.heavy_cavalry.attack, 150);
});
