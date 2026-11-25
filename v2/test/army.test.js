import test from "node:test";
import assert from "node:assert/strict";
import {
  getTroopCatalog, normalizeArmyUpgrades, getArmyUpgradeCost, handleArmyRequest
} from "../src/army.js";
import { createSessionToken } from "../src/auth.js";

test("army upgrade levels normalize independently between zero and ten", () => {
  assert.deepEqual(normalizeArmyUpgrades({ infantryAttack: 14, infantryDefense: -2, cavalryDefense: 4.8 }), {
    infantryAttack: 10, infantryDefense: 0, cavalryDefense: 4
  });
});

test("upgrade cost increases by 1000 gold per next level", () => {
  assert.equal(getArmyUpgradeCost(1), 1000);
  assert.equal(getArmyUpgradeCost(2), 2000);
  assert.equal(getArmyUpgradeCost(10), 10000);
  assert.throws(() => getArmyUpgradeCost(11), RangeError);
});

test("army upgrades add attack and both defense bonuses to troop catalog without changing cavalry attack", () => {
  const buildings = { barracks: { level: 10 }, stable: { level: 10 } };
  const catalog = getTroopCatalog("seljuk", buildings, {
    infantryAttack: 3, infantryDefense: 2, cavalryDefense: 4
  });
  const infantry = catalog.find(unit => unit.id === "infantry");
  const cavalry = catalog.find(unit => unit.id === "light_cavalry");
  assert.equal(infantry.attack, 18);
  assert.equal(infantry.infantryDefense, 22);
  assert.equal(infantry.cavalryDefense, 14);
  assert.equal(cavalry.attack, 20);
  assert.equal(cavalry.infantryDefense, 52);
  assert.equal(cavalry.cavalryDefense, 144);
});

test("troop recruitment endpoint is available again and validates service configuration", async () => {
  const response = { writeHead(status) { this.statusCode = status; }, end(body) { this.body = body; } };
  await handleArmyRequest({
    req: { method: "POST" }, res: response,
    url: new URL("http://localhost/api/game/army/recruit"), pool: null, sessionSecret: null
  });
  assert.equal(response.statusCode, 503);
  assert.match(JSON.parse(response.body).error, /kayıt servisi/);
});

test("recruiting a troop deducts its resources and adds one unit to the persistent army", async () => {
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const secret = "test-session-secret-with-at-least-32-characters";
  const token = createSessionToken(playerId, secret);
  const state = {
    faction_id: "seljuk", resources: { gold: 500, wood: 500, food: 600, iron: 700, horses: 10 },
    buildings: { "2": { type: "barracks", level: 1 }, "3": { type: "stable", level: 1 }, "4": { type: "blacksmith", level: 1 }, "9": { type: "archery", level: 1 } },
    troops: { infantry: 0 }, training_queue: [], worker_pool: 5000, worker_assignments: {},
    army_upgrades: { infantryAttack: 0, infantryDefense: 0, cavalryDefense: 0 }
  };
  const client = {
    async query(sql, params) {
      if (sql.includes("SELECT faction_id, resources")) return { rows: [state], rowCount: 1 };
      if (sql.includes("SET resources=$2::jsonb, troops=$3::jsonb")) {
        state.resources = JSON.parse(params[1]); state.troops = JSON.parse(params[2]);
      }
      return { rows: [], rowCount: 1 };
    },
    release() {}
  };
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) return { rows: [{ id: playerId }], rowCount: 1 };
      if (sql.includes("SELECT resources, army_upgrades")) return { rows: [{ resources: state.resources, army_upgrades: state.army_upgrades }], rowCount: 1 };
      throw new Error("Unexpected pool query: " + sql);
    },
    async connect() { return client; }
  };
  const req = {
    method: "POST", headers: { authorization: "Bearer " + token },
    async *[Symbol.asyncIterator]() { yield JSON.stringify({ unitId: "infantry", amount: 1 }); }
  };
  const res = { writeHead(status) { this.statusCode = status; }, end(body) { this.body = body; } };
  await handleArmyRequest({ req, res, url: new URL("http://localhost/api/game/army/recruit"), pool, sessionSecret: secret });
  const body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.troops.infantry, 1);
  assert.equal(body.resources.wood, 465);
  assert.equal(body.resources.food, 555);
  assert.equal(body.resources.iron, 685);
  assert.equal(body.workerConsumingUnits, 1);
  assert.equal(body.idleWorkers, 4999);
});

test("buying an army upgrade deducts only gold and persists the independent level", async () => {
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const secret = "test-session-secret-with-at-least-32-characters";
  const token = createSessionToken(playerId, secret);
  const state = {
    faction_id: "seljuk", resources: { gold: 5000, wood: 500, food: 600, iron: 700, horses: 10 },
    buildings: { "2": { type: "barracks", level: 10 }, "3": { type: "stable", level: 10 }, "4": { type: "blacksmith", level: 1 } },
    troops: { infantry: 12, light_cavalry: 4 }, training_queue: [],
    worker_pool: 1000, worker_assignments: { wood: 10 },
    army_upgrades: { infantryAttack: 0, infantryDefense: 0, cavalryDefense: 0 }
  };
  const client = {
    async query(sql, params) {
      if (sql.includes("SELECT faction_id, resources")) return { rows: [state], rowCount: 1 };
      if (sql.includes("SET resources=$2::jsonb, army_upgrades=$3::jsonb")) {
        state.resources = JSON.parse(params[1]); state.army_upgrades = JSON.parse(params[2]);
      }
      return { rows: [], rowCount: 1 };
    },
    release() {}
  };
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) return { rows: [{ id: playerId }], rowCount: 1 };
      if (sql.includes("SELECT resources, army_upgrades")) return { rows: [{ resources: state.resources, army_upgrades: state.army_upgrades }], rowCount: 1 };
      throw new Error("Unexpected pool query: " + sql);
    },
    async connect() { return client; }
  };
  const req = {
    method: "POST", headers: { authorization: "Bearer " + token },
    async *[Symbol.asyncIterator]() { yield JSON.stringify({ upgradeId: "infantryAttack" }); }
  };
  const res = { writeHead(status) { this.statusCode = status; }, end(body) { this.body = body; } };
  await handleArmyRequest({ req, res, url: new URL("http://localhost/api/game/army/upgrade"), pool, sessionSecret: secret });
  const body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.armyUpgrades.infantryAttack, 1);
  assert.equal(body.resources.gold, 4000);
  assert.equal(body.resources.wood, 500);
  assert.equal(body.troops.infantry, 12);
  assert.equal(body.catalog.find(unit => unit.id === "infantry").attack, 16);
});

test("recruitment accepts batches above 100 and charges the exact resource cost", async () => {
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const secret = "test-session-secret-with-at-least-32-characters";
  const token = createSessionToken(playerId, secret);
  const state = {
    faction_id: "seljuk",
    resources: { gold: 500, wood: 6000, food: 7000, iron: 3000, horses: 10 },
    buildings: { "2": { type: "barracks", level: 1 }, "3": { type: "stable", level: 1 }, "4": { type: "blacksmith", level: 1 }, "9": { type: "archery", level: 1 } },
    troops: { infantry: 0 }, training_queue: [], worker_pool: 5000, worker_assignments: {},
    army_upgrades: { infantryAttack: 0, infantryDefense: 0, cavalryDefense: 0 }
  };
  const client = {
    async query(sql, params) {
      if (sql.includes("SELECT faction_id, resources")) return { rows: [state], rowCount: 1 };
      if (sql.includes("SET resources=$2::jsonb, troops=$3::jsonb")) {
        state.resources = JSON.parse(params[1]);
        state.troops = JSON.parse(params[2]);
      }
      return { rows: [], rowCount: 1 };
    },
    release() {}
  };
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) return { rows: [{ id: playerId }], rowCount: 1 };
      if (sql.includes("SELECT resources, army_upgrades")) return { rows: [{ resources: state.resources, army_upgrades: state.army_upgrades }], rowCount: 1 };
      throw new Error("Unexpected pool query: " + sql);
    },
    async connect() { return client; }
  };
  const req = {
    method: "POST", headers: { authorization: "Bearer " + token },
    async *[Symbol.asyncIterator]() { yield JSON.stringify({ unitId: "infantry", amount: 150 }); }
  };
  const res = { writeHead(status) { this.statusCode = status; }, end(body) { this.body = body; } };
  await handleArmyRequest({ req, res, url: new URL("http://localhost/api/game/army/recruit"), pool, sessionSecret: secret });
  const body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.troops.infantry, 150);
  assert.equal(body.resources.wood, 750);
  assert.equal(body.resources.food, 250);
  assert.equal(body.resources.iron, 750);
  assert.equal(body.workerConsumingUnits, 150);
  assert.equal(body.idleWorkers, 4850);
});
