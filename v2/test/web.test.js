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
  assert.match(html,/href="\/app\.css\?v=20261117-fixed-building-slots-4"/);
  assert.match(html,/src="\/app\.js\?v=20261117-fixed-building-slots-4"/);
  const stageStart=html.indexOf('<div class="city-stage">');
  const stageEnd=html.indexOf('\n        </div>\n      </div>\n      <dialog id="building-dialog"',stageStart);
  assert.ok(stageEnd>stageStart);
  const stageHtml=html.slice(stageStart,stageEnd);
  assert.ok(stageHtml.includes('<img class="city-art"') && stageHtml.includes('<div class="building-numbers"'));
  assert.match(html,/data-faction="gokturk"/);
  assert.match(html,/data-faction-choice="gokturk" aria-pressed="true"/);
  assert.equal((html.match(/class="building-number(?: is-center)?"/g)||[]).length,9);
  assert.match(html,/1 numaralı Merkez Binası/);
  for(const [slot,name] of [["1","Merkez"],["2","Kışla"],["3","Ahır"],["4","Demirci"],["5","Okul"],["6","Keresteci"],["7","Tapınak"],["8","Pazar"],["9","Depo"]]){
    const markerStart=html.indexOf('data-building-slot="'+slot+'"');
    assert.notEqual(markerStart,-1);
    const markerEnd=html.indexOf("</button>",markerStart);
    assert.ok(markerEnd>markerStart);
    assert.ok(html.slice(markerStart,markerEnd).includes('class="building-label">'+name+'</span>'));
  }

  const expectedPositions=[["1",50,45],["2",41.82,33.31],["3",66.68,52.21],["4",23.79,40.14],["5",72.58,28.4],["6",28.35,24.67],["7",58.59,14.65],["8",37.46,33.92],["9",76.55,21.87]];
  for(const [slot,x,y] of expectedPositions){
    const markerStart=html.indexOf('data-building-slot="'+slot+'"');
    const markerEnd=html.indexOf("</button>",markerStart);
    assert.ok(html.slice(markerStart,markerEnd).includes('style="left:'+x+'%;top:'+y+'%"'));
  }

  // Building markers must overlay the image itself, not flow after it.
  const styles=await fetch(base+"/app.css?v=20261117-fixed-building-slots-4");
  assert.equal(styles.status,200);
  const css=await styles.text();
  assert.ok(css.includes(".city-frame{position:relative;display:grid;place-items:center;width:100%;aspect-ratio:2/3;max-height:min(67dvh,760px);min-height:410px;"));
  assert.ok(css.includes(".city-stage{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100%;height:100%;"));
  assert.ok(css.includes(".city-art{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:fill;"));
  
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

  const script=await fetch(base+"/app.js?v=20261117-fixed-building-slots-4");
  assert.equal(script.status,200);
  const appScript=await script.text();
  assert.match(appScript,/data-faction-choice/);
  assert.ok(appScript.includes("function fitVillageImage()"));
  assert.ok(appScript.includes("villageImage.naturalWidth"));
  assert.ok(appScript.includes("new ResizeObserver(fitVillageImage)"));
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
  assert.doesNotMatch(html,/marker-edit-toggle|marker-reset|marker-export|id="building-type"/);
  assert.doesNotMatch(appScript,/markerStorageKey|buildingTypeSelect|construct/);
  assert.match(appScript,/"4":"blacksmith"/);
  assert.match(appScript,/"5":"school"/);
  assert.match(appScript,/"6":"lumberyard"/);
  assert.match(appScript,/"7":"temple"/);
  assert.match(appScript,/const body=\{action:"upgrade",slot:selectedBuildingSlot\}/);
  assert.ok(!css.includes(".city-frame.marker-editing"));


  const asset=await fetch(base+"/assets/IMG-20261117-WA0073.jpg");
  assert.equal(asset.status,200);
  assert.match(asset.headers.get("content-type"),/image\/jpeg/);
  assert.ok(Number(asset.headers.get("content-length")) > 1_000_000);
  const bytes=new Uint8Array(await asset.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0,3)),[0xff,0xd8,0xff]);
});
