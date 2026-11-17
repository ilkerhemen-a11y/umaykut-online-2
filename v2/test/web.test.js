import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

test("V2 serves the Göktürk village image with nine compact building numbers", async (t) => {
  const server=createServer({ pool: null });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;

  const page=await fetch(base+"/");
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/İlker'in Yurdu/);
  assert.match(html,/\/assets\/IMG-20261117-WA0073\.jpg/);
  assert.match(html,/data-faction="gokturk"/);
  assert.match(html,/data-faction-choice="gokturk" aria-pressed="true"/);
  assert.equal((html.match(/class="building-number(?: is-center)?"/g)||[]).length,9);
  assert.match(html,/1 numaralı merkez binası/);
  assert.match(html,/id="map-view" hidden/);
  assert.match(html,/id="workers-available">1\.800/);
  assert.equal((html.match(/data-resource="(?:grain|wood|stone)"/g)||[]).length,3);

  const script=await fetch(base+"/app.js");
  assert.equal(script.status,200);
  const appScript=await script.text();
  assert.match(appScript,/data-faction-choice/);
  assert.match(appScript,/umaykut-faction-v2/);
  assert.match(appScript,/gokturk/);
  assert.match(appScript,/updateWorkerSummary/);\n  assert.match(appScript,/umaykut-worker-state-v2/);\n  assert.match(appScript,/localStorage\.setItem/);\n  assert.match(appScript,/recallButton\.addEventListener/);\n  assert.match(appScript,/WORKER_POOL=1800/);
  assert.match(appScript,/assigned\[selectedResource\]/);
  assert.match(appScript,/showScreen/);

  const asset=await fetch(base+"/assets/IMG-20261117-WA0073.jpg");
  assert.equal(asset.status,200);
  assert.match(asset.headers.get("content-type"),/image\/jpeg/);
  assert.ok(Number(asset.headers.get("content-length")) > 1_000_000);
  const bytes=new Uint8Array(await asset.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0,3)),[0xff,0xd8,0xff]);
});
