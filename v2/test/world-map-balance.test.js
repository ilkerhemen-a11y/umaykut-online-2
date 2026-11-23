import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("world resource migration equalizes the four core global resources without deleting existing nodes", async () => {
  const sql = await read("../migrations/021_equal_resource_distribution_and_random_spawn.sql");
  for (const type of ["stone", "wood", "iron", "grain"]) {
    assert.ok(sql.includes("('" + type + "'::varchar)"), type + " is included in the equalized resource set");
  }
  assert.match(sql, /GREATEST\(32,MAX\(current_count\)\)/);
  assert.match(sql, /generate_series\(1,GREATEST\(0,t\.target_count-c\.current_count\)\)/);
  assert.match(sql, /4\+random\(\)\*92/);
  assert.match(sql, /floor\(random\(\)\*6\)/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+umaykut_v2\.world_resource_nodes/i);
  assert.match(sql, /UPDATE umaykut_v2\.world_resource_nodes n[\s\S]*WHERE n\.id=p\.id/);
  assert.match(sql, /WHERE NOT EXISTS[\s\S]*n\.resource_type=v\.resource_type/);
});

test("new player resource nodes use randomized positions close to the village", async () => {
  const server = await read("../src/server.js");
  assert.equal(server.split("random()*2*pi()+v.resource_slot*0 AS angle, 1.25+random()*0.45+v.resource_slot*0 AS radius").length - 1, 2);
  assert.equal((server.match(/cos\(spawn\.angle\+v\.resource_slot\*2\*pi\(\)\/5\)\*spawn\.radius/g) || []).length, 2);
  assert.equal((server.match(/sin\(spawn\.angle\+v\.resource_slot\*2\*pi\(\)\/5\)\*spawn\.radius/g) || []).length, 2);
});

test("world map expands evenly while retaining its original terrain artwork", async () => {
  const [html, app, appCss, factionsCss] = await Promise.all([
    read("../public/index.html"),
    read("../public/app.js"),
    read("../public/app.css"),
    read("../public/factions.css")
  ]);
  assert.match(html, /src="\/assets\/IMG-20261117-WA7167\.jpg"/);
  assert.match(app, /const baseWidth=mobile\?1800:2160,baseHeight=mobile\?1200:1440/);
  assert.match(appCss, /\.map-world-canvas\{[^}]*width:2160px;height:1440px/);
  assert.match(factionsCss, /\.map-world-canvas\{[^}]*width:2160px;height:1440px/);
  assert.match(factionsCss, /@media\(max-width:420px\)\{\.map-world-canvas\{width:1800px;height:1200px\}/);
  assert.match(app, /const minGap=92/);
  assert.match(app, /a\.resource&&b\.resource\?92:125/);
  assert.match(appCss, /\.map-mine-point\.resource-node-marker\{z-index:5;width:46px;min-width:46px;height:46px/);
  assert.match(appCss, /\.map-mine-point\.resource-node-marker>img\{width:38px;height:38px\}/);
});
