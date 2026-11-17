import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { createSessionToken } from "../src/auth.js";

test("config uses safe defaults", () => {
  const config = loadConfig({});
  assert.equal(config.port, 3001);
  assert.equal(config.version, "2.0.0");
});

test("config rejects invalid port", () => {
  assert.throws(() => loadConfig({ PORT: "70000" }), /PORT/);
});

test("health, readiness and 404 routes respond", async (t) => {
  const server = createServer({ pool: null });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).version, "2.0.0");

  const ready = await fetch(`${base}/ready`);
  assert.equal(ready.status, 503);
  assert.deepEqual(await ready.json(), { status: "not_ready", databaseConfigured: false });

  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
});

test("readiness checks a real database query", async (t) => {
  const pool = { query: async sql => {
    assert.equal(sql, "SELECT 1");
    return { rows: [{ "?column?": 1 }] };
  }};
  const server = createServer({ pool });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ready", databaseConfigured: true });
});

test("readiness reports an unavailable database", async (t) => {
  const server = createServer({ pool: { query: async () => { throw new Error("offline"); } } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "not_ready", databaseConfigured: true });
});

test("game state is returned only to a valid V2 player session", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  const pool = {
    query: async (sql) => {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) {
        return { rows: [{ id: playerId }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO umaykut_v2.player_game_state")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT p.village_name, s.faction_id, s.worker_pool")) {
        return { rows: [{
          village_name: "Bozkır",
          faction_id: "gokturk",
          worker_pool: 1800,
          worker_assignments: { grain: 20, wood: 30, stone: 10 },
          worker_state_initialized: true,
          resources: { gold: 1650 },
          buildings: {
            "1": { type: "center", level: 3 },
            "2": { type: "barracks", level: 2 },
            "3": { type: "stable", level: 1 },
            "4": { type: "blacksmith", level: 1 },
            "5": { type: "school", level: 1 },
            "6": { type: "lumberyard", level: 1 },
            "7": { type: "temple", level: 1 },
            "8": { type: "market", level: 1 },
            "9": { type: "warehouse", level: 1 }
          },
          updated_at: "2026-11-17T12:00:00.000Z"
        }], rowCount: 1 };
      }
      throw new Error("Unexpected SQL in game-state test.");
    }
  };
  const server = createServer({ pool, sessionSecret: secret });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game/state`, {
    headers: { Authorization: "Bearer " + token }
  });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.factionId, "gokturk");
  assert.equal(state.workerPool, 1800);
  assert.deepEqual(state.workerAssignments, { grain: 20, wood: 30, stone: 10 });
  assert.equal(state.buildings["1"].level, 3);
  assert.equal(state.buildings["2"].level, 2);
  assert.equal(Object.keys(state.buildings).length, 9);
});

test("game state rejects worker assignments above the starting pool", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  const pool = {
    query: async (sql) => {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) {
        return { rows: [{ id: playerId }], rowCount: 1 };
      }
      throw new Error("Invalid worker payload should not write to the database.");
    }
  };
  const server = createServer({ pool, sessionSecret: secret });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game/state`, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      factionId: "gokturk",
      workerAssignments: { grain: 1000, wood: 1000, stone: 0 }
    })
  });
  assert.equal(response.status, 400);
});

test("fixed building slots reject construction and only allow level upgrades", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  const state = {
    resources: { gold:1650, wood:6900, food:9350, stone:7480, iron:8040, horses:100 },
    buildings: {
      "1":{type:"center",level:1},
      "2":{type:"barracks",level:1},
      "3":{type:"stable",level:1},
      "4":{type:"blacksmith",level:1},
      "5":{type:"school",level:1},
      "6":{type:"lumberyard",level:1},
      "7":{type:"temple",level:1},
      "8":{type:"market",level:1},
      "9":{type:"warehouse",level:1}
    }
  };
  const pool = {
    query: async sql => sql.includes("SELECT p.id FROM umaykut_v2.players")
      ? { rows:[{id:playerId}], rowCount:1 }
      : { rows:[], rowCount:0 },
    connect: async () => ({
      query: async (sql, values=[]) => {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows:[] };
        if (sql.includes("INSERT INTO umaykut_v2.player_game_state")) return { rows:[] };
        if (sql.includes("SELECT resources, buildings")) return { rows:[{
          resources:state.resources, buildings:state.buildings
        }] };
        if (sql.includes("UPDATE umaykut_v2.player_game_state SET resources")) {
          state.resources=JSON.parse(values[1]);
          state.buildings=JSON.parse(values[2]);
          return { rows:[] };
        }
        throw new Error("Unexpected SQL in fixed-building test: "+sql);
      },
      release: () => {}
    })
  };
  const server = createServer({ pool, sessionSecret:secret });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/game/buildings`;

  const construct = await fetch(url,{
    method:"POST",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({action:"construct",slot:6,type:"temple"})
  });
  assert.equal(construct.status,400);
  assert.equal(state.buildings["6"].type,"lumberyard");
  assert.equal(state.buildings["6"].level,1);

  const upgrade = await fetch(url,{
    method:"POST",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({action:"upgrade",slot:6,type:"temple"})
  });
  assert.equal(upgrade.status,200);
  const upgraded = await upgrade.json();
  assert.deepEqual(upgraded.cost,{wood:60,stone:40,iron:10});
  assert.equal(upgraded.building.level,1);
  assert.equal(upgraded.building.upgrade.targetLevel,2);
  assert.ok(Date.parse(upgraded.building.upgrade.completesAt)>Date.now());
  assert.equal(state.buildings["6"].level,1);
  assert.equal(state.buildings["6"].upgrade.targetLevel,2);
  assert.equal(state.resources.wood,6840);
  assert.equal(state.resources.stone,7440);
  assert.equal(state.resources.iron,8030);
  const duplicate = await fetch(url,{
    method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({action:"upgrade",slot:6})
  });
  assert.equal(duplicate.status,409);
  assert.equal(state.resources.wood,6840,"a duplicate request must not charge resources twice");
});

test("building upgrades cannot overspend resources", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  const state = {
    resources:{gold:0,wood:10,food:0,stone:10,iron:1,horses:0},
    buildings:{"1":{type:"center",level:1},"4":{type:"blacksmith",level:1}}
  };
  let committed=false;
  const pool = {
    query: async sql => sql.includes("SELECT p.id FROM umaykut_v2.players")
      ? {rows:[{id:playerId}],rowCount:1}:{rows:[],rowCount:0},
    connect: async () => ({
      query: async sql => {
        if(sql==="BEGIN"||sql==="ROLLBACK"||sql==="COMMIT"){if(sql==="COMMIT")committed=true;return {rows:[]};}
        if(sql.includes("INSERT INTO umaykut_v2.player_game_state"))return {rows:[]};
        if(sql.includes("SELECT resources, buildings"))return {rows:[state]};
        throw new Error("Unexpected SQL in insufficient-resource test.");
      },
      release:()=>{}
    })
  };
  const server=createServer({pool,sessionSecret:secret});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/game/buildings`,{
    method:"POST",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({action:"upgrade",slot:4})
  });
  assert.equal(response.status,409);
  assert.equal(committed,false);
  assert.equal(state.resources.wood,10);
  assert.equal(state.buildings["4"].level,1);
});


test("new registration creates a fresh level-one village and zero worker assignments", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const writes = [];
  const pool = {
    query: async (sql, values=[]) => {
      if (sql.startsWith("ALTER TABLE")) return {rows:[],rowCount:0};
      if (sql.includes("INSERT INTO umaykut_v2.players")) {
        return { rows:[{id:playerId,username:"YeniOyuncu",email:"new@example.com"}],rowCount:1 };
      }
      if (sql.includes("INSERT INTO umaykut_v2.player_game_state")) {
        writes.push({sql,values});
        return {rows:[],rowCount:1};
      }
      if (sql.includes("INSERT INTO umaykut_v2.player_sessions")) return {rows:[],rowCount:1};
      throw new Error("Unexpected SQL in new-player initialization test.");
    }
  };
  const server = createServer({pool,sessionSecret:secret});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:"YeniOyuncu",email:"new@example.com",password:"guclu-parola-123"})
  });
  assert.equal(response.status,201);
  assert.equal(writes.length,1);
  const [playerIdArg,resourcesArg,buildingsArg,workersArg]=writes[0].values;
  assert.equal(playerIdArg,playerId);
  assert.equal(JSON.parse(resourcesArg).gold,1650);
  const buildings=JSON.parse(buildingsArg);
  assert.equal(Object.keys(buildings).length,9);
  for(const building of Object.values(buildings)) assert.equal(building.level,1);
  assert.deepEqual(JSON.parse(workersArg),{grain:0,wood:0,stone:0});
});


test("first-time village founding resets legacy building progress to level one", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  const writes = [];
  const pool = {
    query: async (sql) => {
      if (sql.startsWith("ALTER TABLE")) return {rows:[],rowCount:0};
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) return {rows:[{id:playerId}],rowCount:1};
      throw new Error("Unexpected pool query in founding test: "+sql);
    },
    connect: async () => ({
      query: async (sql, values=[]) => {
        if (["BEGIN","COMMIT","ROLLBACK"].includes(sql)) return {rows:[]};
        if (sql.includes("SELECT village_name, faction_id")) return {rows:[{village_name:null,faction_id:"gokturk"}],rowCount:1};
        writes.push({sql,values});
        if (sql.includes("INSERT INTO umaykut_v2.player_game_state")) return {rows:[],rowCount:1};
        return {rows:[],rowCount:1};
      },
      release:()=>{}
    })
  };
  const server=createServer({pool,sessionSecret:secret});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api/player/profile`;
  const invalid=await fetch(base,{method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({villageName:"Bozkır",factionId:""})});
  assert.equal(invalid.status,400);
  const saved=await fetch(base,{method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({villageName:"Bozkır Kartalları",factionId:"hun"})});
  assert.equal(saved.status,200);
  assert.deepEqual(await saved.json(),{success:true,villageName:"Bozkır Kartalları",factionId:"hun",firstSetup:true});
  const stateWrite=writes.find(write=>write.sql.includes("INSERT INTO umaykut_v2.player_game_state"));
  assert.ok(stateWrite);
  const [,faction,resources,buildings,workers]=stateWrite.values;
  assert.equal(faction,"hun");
  const initialBuildings=JSON.parse(buildings);
  assert.equal(Object.keys(initialBuildings).length,9);
  for(const building of Object.values(initialBuildings)) assert.equal(building.level,1);
  assert.equal(JSON.parse(resources).gold,1650);
  assert.deepEqual(JSON.parse(workers),{grain:0,wood:0,stone:0});
});

test("founding an already established village preserves existing building progress", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  const writes = [];
  const pool = {
    query: async sql => {
      if (sql.startsWith("ALTER TABLE")) return {rows:[],rowCount:0};
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) return {rows:[{id:playerId}],rowCount:1};
      throw new Error("Unexpected pool query in established-village test: "+sql);
    },
    connect: async () => ({
      query: async (sql, values=[]) => {
        if (["BEGIN","COMMIT","ROLLBACK"].includes(sql)) return {rows:[]};
        if (sql.includes("SELECT village_name, faction_id")) return {rows:[{village_name:"Eski Yurt",faction_id:"seljuk"}],rowCount:1};
        writes.push({sql,values});
        return {rows:[],rowCount:1};
      },
      release:()=>{}
    })
  };
  const server=createServer({pool,sessionSecret:secret});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/player/profile`,{
    method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({villageName:"Eski Yurt",factionId:"seljuk"})
  });
  assert.equal(response.status,200);
  assert.equal((await response.json()).firstSetup,false);
  const stateWrite=writes.find(write=>write.sql.includes("INSERT INTO umaykut_v2.player_game_state"));
  assert.ok(stateWrite);
  assert.doesNotMatch(stateWrite.sql,/buildings = EXCLUDED\.buildings/);
  assert.doesNotMatch(stateWrite.sql,/resources = EXCLUDED\.resources/);
});

test("unfounded characters are repaired to nine level-one buildings on state load", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  let persisted = null;
  const pool = {
    query: async (sql, values=[]) => {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) return { rows:[{id:playerId}], rowCount:1 };
      if (sql.includes("INSERT INTO umaykut_v2.player_game_state")) return { rows:[], rowCount:1 };
      if (sql.includes("SELECT p.village_name, s.faction_id, s.worker_pool")) {
        return { rows:[{
          village_name:null, faction_id:null, worker_pool:1800,
          worker_assignments:{grain:0,wood:0,stone:0}, worker_state_initialized:true,
          resources:{gold:1650}, buildings:{"1":{type:"center",level:7}},
          updated_at:"2026-11-17T12:00:00.000Z"
        }], rowCount:1 };
      }
      if (sql.includes("UPDATE umaykut_v2.player_game_state SET buildings")) {
        persisted = JSON.parse(values[1]);
        return { rows:[], rowCount:1 };
      }
      throw new Error("Unexpected SQL in initial-building repair test: "+sql);
    }
  };
  const server=createServer({pool,sessionSecret:secret});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/game/state`,{
    headers:{Authorization:"Bearer "+token}
  });
  assert.equal(response.status,200);
  const state=await response.json();
  assert.equal(Object.keys(state.buildings).length,9);
  for(const building of Object.values(state.buildings)) assert.equal(building.level,1);
  assert.deepEqual(persisted,state.buildings);
});

test("established characters keep valid building levels while missing slots are repaired", async (t) => {
  const secret = "test-session-secret-with-at-least-32-characters";
  const playerId = "8f2f3d1a-2d3b-4b5c-9d7e-123456789abc";
  const token = createSessionToken(playerId, secret);
  let persisted = null;
  const pool = {
    query: async (sql, values=[]) => {
      if (sql.includes("SELECT p.id FROM umaykut_v2.players")) return { rows:[{id:playerId}], rowCount:1 };
      if (sql.includes("INSERT INTO umaykut_v2.player_game_state")) return { rows:[], rowCount:1 };
      if (sql.includes("SELECT p.village_name, s.faction_id, s.worker_pool")) {
        return { rows:[{
          village_name:"Eski Yurt", faction_id:"gokturk", worker_pool:1800,
          worker_assignments:{grain:0,wood:0,stone:0}, worker_state_initialized:true,
          resources:{gold:1650},
          buildings:{"1":{type:"center",level:4},"2":{type:"barracks",level:2}},
          updated_at:"2026-11-17T12:00:00.000Z"
        }], rowCount:1 };
      }
      if (sql.includes("UPDATE umaykut_v2.player_game_state SET buildings")) {
        persisted = JSON.parse(values[1]);
        return { rows:[], rowCount:1 };
      }
      throw new Error("Unexpected SQL in established-building repair test: "+sql);
    }
  };
  const server=createServer({pool,sessionSecret:secret});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/game/state`,{
    headers:{Authorization:"Bearer "+token}
  });
  assert.equal(response.status,200);
  const state=await response.json();
  assert.equal(state.buildings["1"].level,4);
  assert.equal(state.buildings["2"].level,2);
  assert.equal(Object.keys(state.buildings).length,9);
  assert.equal(state.buildings["9"].level,1);
  assert.deepEqual(persisted,state.buildings);
});
