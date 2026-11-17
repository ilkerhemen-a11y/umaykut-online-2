import test from "node:test";
import assert from "node:assert/strict";
import { getTroopCatalog } from "../src/army.js";

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
  assert.equal(catalog.length, 7);
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

test("higher barracks and stable levels shorten training times", () => {
  const low = getTroopCatalog("gokturk", { barracks: { level: 1 }, stable: { level: 1 } });
  const high = getTroopCatalog("gokturk", { barracks: { level: 10 }, stable: { level: 10 } });
  assert.ok(high.find(unit => unit.id === "infantry").secondsPerUnit < low.find(unit => unit.id === "infantry").secondsPerUnit);
  assert.ok(high.find(unit => unit.id === "light_cavalry").secondsPerUnit < low.find(unit => unit.id === "light_cavalry").secondsPerUnit);
});

test("numeric V2 building slots correctly unlock troops and reduce training time", () => {
  const levelOne = getTroopCatalog("gokturk", {
    "2": { type: "barracks", level: 1 },
    "3": { type: "stable", level: 1 }
  });
  assert.equal(levelOne.find(unit => unit.id === "archer").unlocked, false);
  assert.equal(levelOne.find(unit => unit.id === "mounted_archer").unlocked, false);

  const levelFive = getTroopCatalog("gokturk", {
    "2": { type: "barracks", level: 5 },
    "3": { type: "stable", level: 5 }
  });
  assert.equal(levelFive.find(unit => unit.id === "archer").unlocked, true);
  assert.equal(levelFive.find(unit => unit.id === "shield").unlocked, true);
  assert.equal(levelFive.find(unit => unit.id === "mounted_archer").unlocked, true);
  assert.ok(levelFive.find(unit => unit.id === "infantry").secondsPerUnit <
    levelOne.find(unit => unit.id === "infantry").secondsPerUnit);
});
