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
  assert.match(html,/1 numaralı Merkez Binası/);
  for(const [slot,name] of [["1","Merkez"],["2","Kışla"],["3","Ahır"],["4","Oduncu Ocağı"],["5","Çiftlik"],["6","Taş Ocağı"],["7","Demir Madeni"],["8","Pazar"],["9","Depo"]]){
    assert.match(html,new RegExp('data-building-slot="'+slot+'"[^>]*>[\\s\\S]*?building-label">'+name+'<'));
  }

  // Building markers must overlay the image itself, not flow after it.
  const styles=await fetch(base+"/app.css");
  assert.equal(styles.status,200);
  const css=await styles.text();
  assert.ok(css.includes(".city-frame{position:relative;width:100%;height:auto;aspect-ratio:auto;max-height:none;min-height:0;"));
  assert.ok(css.includes(".city-art{position:relative;display:block;width:100%;height:auto;"));
  assert.ok(css.includes(".building-numbers{position:absolute;inset:0;pointer-events:none}"));
  assert.ok(css.includes(".building-number{position:absolute;transform:translate(-50%,-50%);"));
  assert.ok(css.includes("pointer-events:auto"));
  assert.ok(css.includes(".building-label{position:absolute;"));
  assert.ok(css.includes("font:700 7px/1.2 Arial,sans-serif"));
  assert.ok(!css.includes(".city-frame{max-height:700px}"));
  assert.ok(!css.includes(".city-frame{min-height:360px;max-height:58dvh}"));
  assert.match(html,/id="map-view" hidden/);
  assert.match(html,/id="workers-available">1\.800/);
  assert.match(html,/id="workers-assigned-total">0 görevde/);
  assert.match(html,/id="recall-workers"/);
  assert.equal((html.match(/data-resource="(?:grain|wood|stone)"/g)||[]).length,3);

  const script=await fetch(base+"/app.js");
  assert.equal(script.status,200);
  const appScript=await script.text();
  assert.match(appScript,/data-faction-choice/);
  assert.match(appScript,/BUILDING_SLOT_TYPES/);
  assert.match(appScript,/node\.querySelector\("\.building-label"\)/);
  assert.match(appScript,/"9":"warehouse"/);
  assert.match(appScript,/umaykut-faction-v2/);
  assert.match(appScript,/gokturk/);
  assert.match(appScript,/updateWorkerSummary/);
  assert.match(appScript,/umaykut-worker-state-v2/);
  assert.match(appScript,/localStorage\.setItem/);
  assert.match(appScript,/recallButton\.addEventListener/);
  assert.match(appScript,/WORKER_POOL=1800/);
  assert.match(appScript,/showScreen/);

  const asset=await fetch(base+"/assets/IMG-20261117-WA0073.jpg");
  assert.equal(asset.status,200);
  assert.match(asset.headers.get("content-type"),/image\/jpeg/);
  assert.ok(Number(asset.headers.get("content-length")) > 1_000_000);
  const bytes=new Uint8Array(await asset.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0,3)),[0xff,0xd8,0xff]);
});
