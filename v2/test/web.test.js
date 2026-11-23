import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { applyVillageSelection } from "../public/village-selection.js";

test("village building selection updates only the active marker and its accessible pressed state", () => {
  const makeMarker=(slot)=>{
    const classes=new Set();
    return {dataset:{buildingSlot:String(slot)},classes,attributes:{},classList:{toggle(name,force){if(force)classes.add(name);else classes.delete(name);}},setAttribute(name,value){this.attributes[name]=value;}};
  };
  const markers=[makeMarker(1),makeMarker(2),makeMarker(8)];
  applyVillageSelection(markers,"8");
  assert.equal(markers[0].classes.has("is-selected"),false);
  assert.equal(markers[1].attributes["aria-pressed"],"false");
  assert.equal(markers[2].classes.has("is-selected"),true);
  assert.equal(markers[2].attributes["aria-pressed"],"true");
  applyVillageSelection(markers,null);
  assert.equal(markers[2].classes.has("is-selected"),false);
  assert.equal(markers[2].attributes["aria-pressed"],"false");
});

test("V2 serves the Göktürk village image with nine compact building numbers", async (t) => {
  const server=createServer({ pool: null });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;

  const page=await fetch(base+"/");
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/id="village-name-title">Yeni Yurdum/);
  assert.match(html,/id="founding-dialog"/);
  assert.match(html,/id="map-city-name">Yeni Yurdum/);
  assert.match(html,/id="founding-village-name"/);
  assert.match(html,/id="founding-submit"[^>]*disabled/);
  assert.match(html,/Kızıl Bozkır/);
  assert.match(html,/Altın Hâkimiyet/);
  assert.match(html,/Göklerin Hâkimiyeti/);
  assert.match(html,/founding-gokturk-image/);
  assert.ok(html.includes("IMG-20261117-WA0073.jpg"));
  assert.doesNotMatch(html,/İlker.in Yurdu/);
  assert.match(html,/id="settings-dialog"/);
  assert.match(html,/id="battle-reports-dialog"/);
  assert.match(html,/data-action="battle-reports"/);
  assert.match(html,/id="battle-reports-list"/);
  assert.match(html,/data-action="inventory"/);
  assert.match(html,/data-action="incoming-attacks"/);
  assert.match(html,/data-action="outgoing-attacks"/);
  assert.match(html,/id="incoming-attacks-dialog"/);
  assert.match(html,/id="outgoing-attacks-dialog"/);
  assert.match(html,/id="neutral-region-dialog"/);
  assert.match(html,/id="neutral-region-action"/);
  assert.doesNotMatch(html,/class="map-legend"/);
  assert.doesNotMatch(html,/data-resource="(?:grain|wood|stone)"/);
  assert.match(html,/köyünün erişim alanındaki bir kaynak görseline dokun/);
  assert.match(html,/id="open-settings"/);
  assert.match(html,/data-action="settings"/);
  assert.match(html,/id="logout-button"/);
  assert.match(html,/id="setting-reduced-motion"/);
  assert.match(html,/id="setting-compact-resources"/);
  assert.match(html,/\/assets\/IMG-20261117-WA0073\.jpg/);
  assert.match(html,/href="\/app\.css\?v=20261123-temple-workers-2"/);
  assert.ok(html.includes('src="/app.js?v=20261123-temple-workers-2"'));
  assert.match(html,/id="production-dialog"/);
  assert.match(html,/id="production-open"/);
  assert.match(html,/id="production-resource-grid"/);
  assert.match(html,/id="production-breakdown-list"/);
  const stageStart=html.indexOf('<div class="city-stage">');
  const stageEnd=html.indexOf('\n      <section id="building-upgrade-tracker"',stageStart);
  assert.ok(stageEnd>stageStart);
  const stageHtml=html.slice(stageStart,stageEnd);
  assert.ok(stageHtml.includes('<img class="city-art"') && stageHtml.includes('<div class="building-numbers"'));
  const stageMarkupEnd=html.indexOf('\n        </div>\n        <div class="village-camera-controls"',stageStart);
  assert.ok(stageMarkupEnd>stageStart,"camera controls stay outside the zoomed artwork layer");
  assert.ok(stageHtml.includes('id="village-zoom-in"') && stageHtml.includes('id="village-zoom-out"') && stageHtml.includes('id="village-zoom-reset"'));
  assert.match(stageHtml,/aria-label="Köy görünümü yakınlaştırma kontrolleri"/);
  assert.match(stageHtml,/id="village-zoom-label" aria-live="polite">100%/);
  assert.match(stageHtml,/class="wall-number" id="wall-position-marker"/);
  assert.match(stageHtml,/left:50\.3%;top:75\.3%/);
  assert.match(stageHtml,/Sur \/ Sığınak/);
  assert.match(html,/id="wall-dialog"/);
  assert.ok(html.includes('class="dialog-emblem wall-dialog-emblem" src="/assets/buildings/wall.svg"'));
  assert.match(html,/id="wall-defense"/);
  assert.match(html,/id="wall-shelter"/);
  assert.doesNotMatch(html,/wall-position-(?:toggle|confirm|status)|wall-position-tools/);
  assert.doesNotMatch(html,/data-faction="gokturk"/);
  assert.match(html,/data-faction-choice="gokturk" aria-pressed="false"/);
  assert.equal((html.match(/class="building-number(?: is-center)?"/g)||[]).length,9);
  assert.match(html,/1 numaralı Merkez Binası/);
  for(const [slot,name] of [["1","Merkez"],["2","Kışla"],["3","Ahır"],["4","Demirci"],["5","Okul"],["6","Keresteci"],["7","Tapınak"],["8","Pazar"],["9","Okçu"]]){
    const markerStart=html.indexOf('data-building-slot="'+slot+'"');
    assert.notEqual(markerStart,-1);
    const markerEnd=html.indexOf("</button>",markerStart);
    assert.ok(markerEnd>markerStart);
    assert.ok(html.slice(markerStart,markerEnd).includes('class="building-label">'+name+'</span>'));
  }

  const expectedBuildingArt=[["1","/assets/seljuk-center.svg"],["2","/assets/buildings/barracks.svg"],["3","/assets/buildings/stable.svg"],["4","/assets/buildings/blacksmith.svg"],["5","/assets/buildings/school.svg"],["6","/assets/buildings/lumberjack.svg"],["7","/assets/buildings/temple.svg"],["8","/assets/buildings/market.svg"],["9","/assets/buildings/archery.svg"]];
  for(const [slot,asset] of expectedBuildingArt){
    const markerStart=stageHtml.indexOf('data-building-slot="'+slot+'"');
    const markerEnd=stageHtml.indexOf("</button>",markerStart);
    const marker=stageHtml.slice(markerStart,markerEnd);
    assert.ok(marker.includes('class="building-marker-art" src="'+asset+'"'),"slot "+slot+" uses its own isometric building asset");
  }
  assert.ok(stageHtml.includes('class="wall-marker-art" src="/assets/buildings/wall.svg"'));

  const expectedPositions=[["1",50,45],["2",41.82,33.31],["3",66.68,52.21],["4",23.79,40.14],["5",72.58,28.4],["6",28.35,24.67],["7",58.59,14.65],["8",37.46,33.92],["9",76.55,21.87]];
  for(const [slot,x,y] of expectedPositions){
    const markerStart=html.indexOf('data-building-slot="'+slot+'"');
    const markerEnd=html.indexOf("</button>",markerStart);
    assert.ok(html.slice(markerStart,markerEnd).includes('style="left:'+x+'%;top:'+y+'%"'));
  }

  // Building markers must overlay the image itself, not flow after it.
  const styles=await fetch(base+"/app.css?v=20261123-temple-workers-2");
  assert.equal(styles.status,200);
  const css=await styles.text();
  assert.ok(css.includes(".city-frame{position:relative;display:grid;place-items:center;width:100%;aspect-ratio:2/3;max-height:min(67dvh,760px);min-height:410px;"));
  assert.ok(css.includes(".city-stage{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100%;height:100%;"));
  assert.ok(css.includes(".city-art{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:fill;"));
  
  assert.ok(css.includes(".city-frame.is-zoomed{touch-action:none}"));
  assert.ok(css.includes(".village-camera-controls{position:absolute;z-index:5;"));
  assert.ok(css.includes(".building-numbers{position:absolute;inset:0;pointer-events:none}"));
  assert.match(css,/\.wall-number\{[^}]*left:50%[^}]*top:7%/);
  assert.ok(css.includes(".building-number{position:absolute;transform:translate(-50%,-50%);"));
  assert.ok(!css.includes(".wall-position-tools{"));
  assert.ok(css.includes(".wall-number{pointer-events:auto!important"));
  assert.ok(!css.includes(".wall-position-editing"));
  assert.ok(css.includes(".building-label{position:absolute;"));
  assert.ok(css.includes(".building-marker-art{") && css.includes("object-fit:contain"));
  assert.ok(css.includes(".building-number.is-selected::before"));
  assert.ok(css.includes(".building-number.is-selected .building-marker-art"));
  assert.ok(css.includes(".building-number.is-upgrading::after"));
  assert.ok(css.includes("conic-gradient(#35c46b var(--upgrade-progress,0%),#314b36 var(--upgrade-progress,0%))"));
  assert.ok(css.includes(".building-number.is-upgrading .building-marker-art{z-index:1}"));

  assert.ok(css.includes(".building-index{position:absolute;"));
  assert.ok(css.includes("font:700 7px/1.2 Arial,sans-serif"));
  assert.ok(!css.includes(".city-frame{max-height:700px}"));
  assert.ok(!css.includes(".city-frame{min-height:360px;max-height:58dvh}"));
  assert.match(html,/img class="dialog-emblem" id="building-emblem"[^>]*src="\/assets\/seljuk-center\.svg"/);
  assert.match(html,/id="building-upgrade-tracker"/);
  assert.match(html,/id="building-upgrade-list"/);
  assert.match(html,/id="map-view" hidden/);
  assert.match(html,/id="workers-available">1\.800/);
  assert.match(html,/id="workers-assigned-total">0 görevde/);
  assert.match(html,/id="recall-workers"/);
  assert.equal((html.match(/data-resource="(?:grain|wood|stone)"/g)||[]).length,0);

  const script=await fetch(base+"/app.js?v=20261123-temple-workers-2");
  assert.equal(script.status,200);
  const appScript=await script.text();
  assert.match(appScript,/data-faction-choice/);
  assert.match(appScript,/function renderBattleReports\(attacks\)/);
  assert.match(appScript,/function openBattleReports\(\)/);
  assert.match(appScript,/api\/game\/attacks/);
  assert.match(appScript,/neutral-regions\/reports/);
  assert.ok(appScript.includes('from "./village-camera.js"'));
  assert.ok(appScript.includes('from "./village-selection.js"'));
  assert.ok(appScript.includes('from "./village-upgrade-progress.js"'));
  assert.match(appScript,/function renderBuildingUpgradeProgress\(\)/);
  assert.match(appScript,/calculateVillageUpgradeProgress\(upgrade,now\)/);
  const upgradeModule=await fetch(base+"/village-upgrade-progress.js");
  assert.equal(upgradeModule.status,200);
  assert.match(await upgradeModule.text(),/export function calculateVillageUpgradeProgress/);
  assert.ok(appScript.includes('applyVillageSelection(document.querySelectorAll("[data-building-slot]"), null)'));
  assert.ok(appScript.includes('applyVillageSelection(document.querySelectorAll("[data-building-slot]"),slot)'));
  const selectionModule=await fetch(base+"/village-selection.js");
  assert.equal(selectionModule.status,200);
  assert.match(await selectionModule.text(),/export function applyVillageSelection/);
  assert.match(appScript,/pointerdown/);
  assert.match(appScript,/pointermove/);
  assert.match(appScript,/calculateVillagePinch/);
  assert.match(appScript,/function renderVillageCamera\(\)/);
  assert.ok(appScript.includes("function fitVillageImage()"));
  assert.ok(appScript.includes("villageImage.naturalWidth"));
  assert.ok(appScript.includes("new ResizeObserver(fitVillageImage)"));
  assert.match(appScript,/function renderUpgradeTracker\(\)/);
  assert.doesNotMatch(appScript,/wallPosition|WALL_POSITION_KEY/);
  assert.match(appScript,/setInterval\(\(\)=>\{updateUpgradeTracking\(\);renderBuildingUpgradeProgress\(\);updateWallUpgradeCountdown\(\);\},1000\)/);
  assert.match(appScript,/function updateWallUpgradeCountdown\(\)/);
  assert.match(appScript,/gameWall\?\.upgrade\?\[\{slot:"wall"/);
  assert.match(appScript,/renderUpgradeTracker\(\);wallMessage\.textContent="Sur yükseltmesi başladı/);
  assert.match(appScript,/asker anında orduna katıldı/);
  assert.match(appScript,/Yetiştirdiğin askerler beklemeden doğrudan orduna katılır/);
  assert.doesNotMatch(appScript,/secondsPerUnit|Yetiştiriliyor ·/);
  assert.doesNotMatch(appScript,/Eğitim süresi/);
  assert.match(css,/\.army-units\{display:flex;gap:5px;overflow-x:auto/);
  assert.match(html,/Ordu durumu/);
  assert.match(html,/id="army-unit-detail"/);
  assert.match(html,/id="army-unit-back"/);
  assert.match(appScript,/function renderArmyUnitDetail\(unitId\)/);
  assert.match(appScript,/data-select-unit/);
  assert.match(appScript,/data-recruit-unit/);
  assert.match(appScript,/setServerClock\(state.serverNow\)/);
  assert.match(appScript,/function renderProductionDialog\(\)/);
  assert.match(appScript,/currentWorkerPool/);
  assert.match(appScript,/await refreshProductionState\(\);/);
  assert.match(appScript,/productionBreakdown/);
  assert.match(appScript,/productionNodeName/);
  assert.match(appScript,/building-upgrade-count/);
  assert.match(appScript,/BUILDING_SLOT_TYPES/);
  assert.match(appScript,/const BUILDING_ART=\{/);
  assert.match(appScript,/buildingEmblem\.src=BUILDING_ART\[slot\]/);
  assert.match(appScript,/const art=node\.querySelector\("\.building-marker-art"\)/);
  assert.match(appScript,/art\.src=BUILDING_ART\[slot\]/);
  for(const assetPath of ["/assets/seljuk-center.svg","/assets/buildings/barracks.svg","/assets/buildings/stable.svg","/assets/buildings/blacksmith.svg","/assets/buildings/school.svg","/assets/buildings/lumberjack.svg","/assets/buildings/temple.svg","/assets/buildings/market.svg","/assets/buildings/archery.svg","/assets/buildings/wall.svg"]){
    const buildingAsset=await fetch(base+assetPath);
    assert.equal(buildingAsset.status,200,assetPath);
    assert.match(buildingAsset.headers.get("content-type"),/image\/svg\+xml/);
    assert.match(await buildingAsset.text(),/<svg\b/);
  }
  assert.match(appScript,/node\.querySelector\("\.building-label"\)/);
  assert.match(appScript,/node\.querySelector\("\.building-index"\)/);
  assert.match(appScript,/building\.upgrade\?\.targetLevel/);
  assert.match(appScript,/levelBadge\.textContent=String\(displayedLevel\)/);
  assert.match(appScript,/"9":"warehouse"/);
  assert.match(appScript,/umaykut-faction-v2/);
  assert.ok(appScript.includes('"/api/player/profile"'));
  assert.ok(appScript.includes('node.addEventListener("click",()=>openBuildingDialog(node.dataset.buildingSlot))'));
  assert.ok(appScript.includes('function openBuildingDialog(slot)'));
  assert.match(appScript,/openFoundingDialog/);
  assert.match(appScript,/await loadGameState\(\)/);
  assert.match(appScript,/updateVillageName/);
  assert.match(appScript,/gokturk/);
  assert.match(appScript,/updateWorkerSummary/);
  assert.match(appScript,/umaykut-worker-state-v2/);
  assert.match(appScript,/localStorage\.setItem/);
  assert.match(appScript,/recallButton\.addEventListener/);
  assert.match(appScript,/WORKER_POOL=1800/);
  assert.match(appScript,/showScreen/);
  assert.match(appScript,/api\/auth\/session/);
  assert.match(appScript,/function applySettings\(\)/);
  assert.match(appScript,/function logoutAccount\(\)/);
  assert.match(appScript,/localStorage\.removeItem\(AUTH_TOKEN_KEY\)/);
  assert.doesNotMatch(html,/marker-edit-toggle|marker-reset|marker-export|id="building-type"/);
  assert.doesNotMatch(appScript,/markerStorageKey|buildingTypeSelect|construct/);
  assert.match(appScript,/"4":"blacksmith"/);
  assert.match(appScript,/"5":"school"/);
  assert.match(appScript,/"6":"lumberyard"/);
  assert.match(appScript,/"7":"temple"/);
  assert.match(appScript,/const body=\{action:"upgrade",slot:selectedBuildingSlot\}/);
  assert.ok(!css.includes(".city-frame.marker-editing"));
  assert.ok(css.includes(".settings-dialog{"));
  assert.ok(css.includes(".bottom-nav{grid-template-columns:repeat(5,minmax(0,1fr))}"));
  assert.ok(css.includes(".reduce-motion *"));


  const asset=await fetch(base+"/assets/IMG-20261117-WA0073.jpg");
  assert.equal(asset.status,200);
  assert.match(asset.headers.get("content-type"),/image\/jpeg/);
  assert.ok(Number(asset.headers.get("content-length")) > 1_000_000);
  const bytes=new Uint8Array(await asset.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0,3)),[0xff,0xd8,0xff]);
});

test("resource bar uses the five matching isometric SVG icons and serves each asset", async (t) => {
  const server=createServer({ pool: null });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(base+"/");
  assert.equal(page.status,200);
  const html=await page.text();
  const resources=[
    ["gold","resource-gold"],["wood","resource-wood"],["grain","resource-food"],
    ["stone","resource-stone"],["iron","resource-iron"]
  ];
  for(const [asset,id] of resources){
    assert.match(html,new RegExp(`<span class="resource-icon" aria-hidden="true"><img src="/assets/resources/${asset}\\.svg" alt="" width="24" height="20"`));
    assert.match(html,new RegExp(`id="${id}"`));
    const response=await fetch(base+`/assets/resources/${asset}.svg`);
    assert.equal(response.status,200,`${asset} SVG must be served`);
    assert.ok((response.headers.get("content-type")||"").includes("image/svg+xml"));
    assert.ok((await response.text()).includes("<svg"));
  }
});
