import test from "node:test";
import assert from "node:assert/strict";
import { getTroopCatalog, settleTrainingQueue } from "../src/army.js";

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
  assert.equal(hun.find(unit => unit.id === "light_cavalry").name, "Hun Akıncısı");
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
