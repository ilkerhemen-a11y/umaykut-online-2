import test from "node:test";
import assert from "node:assert/strict";
import {calculateVillageUpgradeProgress} from "../public/village-upgrade-progress.js";

test("village building upgrade progress follows timestamps and stays within 0-100 percent",()=>{
 const upgrade={startedAt:"2026-11-23T10:00:00.000Z",completesAt:"2026-11-23T10:10:00.000Z"};
 const start=Date.parse(upgrade.startedAt);
 assert.equal(calculateVillageUpgradeProgress(upgrade,start),0);
 assert.equal(calculateVillageUpgradeProgress(upgrade,start+5*60*1000),50);
 assert.equal(calculateVillageUpgradeProgress(upgrade,start+10*60*1000),100);
 assert.equal(calculateVillageUpgradeProgress(upgrade,start-1000),0);
 assert.equal(calculateVillageUpgradeProgress(upgrade,start+20*60*1000),100);
});

test("invalid or zero-length upgrade windows safely report zero progress",()=>{
 assert.equal(calculateVillageUpgradeProgress(null,Date.now()),0);
 assert.equal(calculateVillageUpgradeProgress({startedAt:"bad",completesAt:"also bad"},Date.now()),0);
 assert.equal(calculateVillageUpgradeProgress({startedAt:"2026-11-23T10:00:00Z",completesAt:"2026-11-23T10:00:00Z"},Date.now()),0);
});
