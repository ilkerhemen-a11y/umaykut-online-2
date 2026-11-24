import { clampVillageZoom, clampVillagePan, calculateVillagePinch, calculateVillagePan } from "./village-camera.js";
import { applyVillageSelection } from "./village-selection.js";
import { calculateVillageUpgradeProgress } from "./village-upgrade-progress.js";

applyVillageSelection(document.querySelectorAll("[data-building-slot]"), null);
const factions={
 hun:{name:"Hun Devleti",themeColor:"#7b2528",short:"Kızıl Bozkır",trait:"Atlı birlikler ve hızlı akınlar",description:"Hareketli süvari ordusu, baskın ve sefer odaklı oyun tarzı."},
 seljuk:{name:"Selçuklu Devleti",themeColor:"#8d6a2d",short:"Altın Hâkimiyet",trait:"Ticaret ve şehirleşme",description:"Üretim, ticaret, güçlü surlar ve düzenli şehir gelişimi odaklı oyun tarzı."},
 gokturk:{name:"Göktürk Devleti",themeColor:"#176b83",short:"Göklerin Hâkimiyeti",trait:"Dengeli bozkır gücü",description:"Kaynak, casus, ordu ve savunma arasında dengeli gelişim."}
};
const shell=document.querySelector(".game-shell");
const factionLabel=document.querySelector("#realm-faction");
let gameStateReady=false;
let selectedFoundingFaction=null;
function setFaction(key){
 if(!factions[key])return false;
 shell.dataset.faction=key;
 factionLabel.textContent=factions[key].name;
 document.querySelector('meta[name="theme-color"]').content=factions[key].themeColor;
 document.querySelectorAll("[data-faction-choice]").forEach(button=>{
  const active=button.dataset.factionChoice===key;
  button.setAttribute("aria-pressed",String(active));
  button.classList.toggle("selected",active);
 });
 try{localStorage.setItem("umaykut-faction-v2",key);}catch{}
 return true;
}
const foundingDialog=document.querySelector("#founding-dialog");
const foundingForm=document.querySelector("#founding-form");
const foundingVillageName=document.querySelector("#founding-village-name");
const foundingMessage=document.querySelector("#founding-message");
const foundingSubmit=document.querySelector("#founding-submit");
document.querySelectorAll("[data-faction-choice]").forEach(button=>{
 button.addEventListener("click",()=>{
  selectedFoundingFaction=button.dataset.factionChoice;
  setFaction(selectedFoundingFaction);
  foundingMessage.textContent=factions[selectedFoundingFaction].description;
  foundingSubmit.disabled=false;
 });
});
function openFoundingDialog(player,profile){
 selectedFoundingFaction=null;
 document.querySelectorAll("[data-faction-choice]").forEach(button=>{button.setAttribute("aria-pressed","false");button.classList.remove("selected");});
 foundingVillageName.value=profile?.villageName||player?.village_name||"";
 foundingMessage.textContent="Devletini seç ve köyüne bir isim ver. Bu seçim hesabına kaydedilecek.";
 foundingSubmit.disabled=true;
 if(!foundingDialog.open)foundingDialog.showModal();
}
foundingForm.addEventListener("submit",async event=>{
 event.preventDefault();
 const villageName=foundingVillageName.value.trim();
 if(!selectedFoundingFaction){foundingMessage.textContent="Önce bir devlet seçmelisin.";return;}
 if(!foundingForm.reportValidity())return;
 foundingSubmit.disabled=true;
 foundingMessage.textContent="Yurdun kuruluyor…";
 try{
  const profile=await authRequest("/api/player/profile",{
   method:"PUT",token:authToken,body:{villageName,factionId:selectedFoundingFaction}
  });
  currentPlayer={...currentPlayer,village_name:profile.villageName};
  updateVillageName(profile.villageName);
  setFaction(profile.factionId);
  foundingDialog.close();
  await loadGameState();
  await loadArmyState();
 }catch(error){
  foundingMessage.textContent=error.message||"Köyün kurulamadı. Tekrar dene.";
  foundingSubmit.disabled=false;
 }
});
function updateVillageName(name){
 const safeName=String(name||"Yeni Yurdum");
 const title=document.querySelector("#village-name-title");
 const realmName=document.querySelector("#realm-player-name");
 if(title)title.textContent=safeName;
 if(realmName)realmName.textContent=safeName.toLocaleUpperCase("tr-TR")+" YURDU";
 const mapCityName=document.querySelector("#map-city-name");
 const mapCityImage=document.querySelector("#map-city-image");
 if(mapCityName)mapCityName.textContent=safeName;
 if(mapCityImage)mapCityImage.alt=safeName+" kalesi";
}

// Keep the building overlay in the exact same rendered box as the source image.
const villageFrame=document.querySelector(".city-frame");
const villageStage=document.querySelector(".city-stage");
const villageImage=document.querySelector(".city-art");
const villageZoomIn=document.querySelector("#village-zoom-in");
const villageZoomOut=document.querySelector("#village-zoom-out");
const villageZoomReset=document.querySelector("#village-zoom-reset");
const villageZoomLabel=document.querySelector("#village-zoom-label");
let villageZoom=1,villagePanX=0,villagePanY=0;
const villagePointers=new Map();
let villagePinchStart=null,villageDragStart=null;
function renderVillageCamera(){
 if(!villageFrame||!villageStage)return;
 const rect=villageFrame.getBoundingClientRect();
 villagePanX=clampVillagePan(villagePanX,rect.width,villageZoom,villageStage.offsetWidth||rect.width);
 villagePanY=clampVillagePan(villagePanY,rect.height,villageZoom,villageStage.offsetHeight||rect.height);
 villageStage.style.transform="translate(calc(-50% + "+villagePanX+"px), calc(-50% + "+villagePanY+"px)) scale("+villageZoom+")";
 villageFrame.classList.toggle("is-zoomed",villageZoom>1.001);
 if(villageZoomLabel)villageZoomLabel.textContent=Math.round(villageZoom*100)+"%";
 if(villageZoomIn)villageZoomIn.disabled=villageZoom>=2.2;
 if(villageZoomOut)villageZoomOut.disabled=villageZoom<=1;
}
function setVillageZoom(nextZoom){
 if(!villageFrame||!villageStage)return;
 const rect=villageFrame.getBoundingClientRect();
 const contentWidth=villageStage.offsetWidth||rect.width,contentHeight=villageStage.offsetHeight||rect.height;
 const next=clampVillageZoom(nextZoom);
 const worldX=-villagePanX/villageZoom,worldY=-villagePanY/villageZoom;
 villageZoom=next;
 villagePanX=clampVillagePan(-worldX*next,rect.width,next,contentWidth);
 villagePanY=clampVillagePan(-worldY*next,rect.height,next,contentHeight);
 renderVillageCamera();
}
function villagePointerDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function villagePointerMidpoint(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function finishVillagePointer(event){
 villagePointers.delete(event.pointerId);
 villagePinchStart=null;
 villageDragStart=null;
 if(villagePointers.size===1&&villageZoom>1.001){
  const [pointerId,point]=Array.from(villagePointers.entries())[0];
  villageDragStart={pointerId,startX:point.x,startY:point.y,startPanX:villagePanX,startPanY:villagePanY};
 }
}
if(villageFrame&&villageStage){
 villageFrame.addEventListener("pointerdown",event=>{
  if(event.target.closest("button"))return;
  if(event.pointerType==="mouse"&&event.button!==0)return;
  villagePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(villagePointers.size===1){
   if(villageZoom>1.001){
    villageDragStart={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,startPanX:villagePanX,startPanY:villagePanY};
    try{villageFrame.setPointerCapture(event.pointerId);}catch{}
   }
   return;
  }
  if(villagePointers.size!==2)return;
  villageDragStart=null;
  const points=Array.from(villagePointers.values()),rect=villageFrame.getBoundingClientRect(),mid=villagePointerMidpoint(points[0],points[1]);
  villagePinchStart={zoom:villageZoom,panX:villagePanX,panY:villagePanY,distance:Math.max(1,villagePointerDistance(points[0],points[1])),centerX:mid.x-rect.left,centerY:mid.y-rect.top};
  for(const [pointerId] of villagePointers){try{villageFrame.setPointerCapture(pointerId);}catch{}}
 });
 villageFrame.addEventListener("pointermove",event=>{
  if(!villagePointers.has(event.pointerId))return;
  villagePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  const rect=villageFrame.getBoundingClientRect();
  if(villagePointers.size===2&&villagePinchStart){
   const points=Array.from(villagePointers.values()),mid=villagePointerMidpoint(points[0],points[1]);
   const camera=calculateVillagePinch({
    startZoom:villagePinchStart.zoom,startPanX:villagePinchStart.panX,startPanY:villagePinchStart.panY,
    startDistance:villagePinchStart.distance,currentDistance:villagePointerDistance(points[0],points[1]),
    startCenterX:villagePinchStart.centerX,startCenterY:villagePinchStart.centerY,
    currentCenterX:mid.x-rect.left,currentCenterY:mid.y-rect.top,
    viewportWidth:rect.width,viewportHeight:rect.height,
    contentWidth:villageStage.offsetWidth||rect.width,contentHeight:villageStage.offsetHeight||rect.height
   });
   villageZoom=camera.zoom;villagePanX=camera.panX;villagePanY=camera.panY;renderVillageCamera();
   return;
  }
  if(villagePointers.size===1&&villageDragStart&&villageDragStart.pointerId===event.pointerId&&villageZoom>1.001){
   const camera=calculateVillagePan({
    startPanX:villageDragStart.startPanX,startPanY:villageDragStart.startPanY,
    deltaX:event.clientX-villageDragStart.startX,deltaY:event.clientY-villageDragStart.startY,
    viewportWidth:rect.width,viewportHeight:rect.height,
    contentWidth:villageStage.offsetWidth||rect.width,contentHeight:villageStage.offsetHeight||rect.height,zoom:villageZoom
   });
   villagePanX=camera.panX;villagePanY=camera.panY;renderVillageCamera();
  }
 });
 villageFrame.addEventListener("pointerup",finishVillagePointer);
 villageFrame.addEventListener("pointercancel",finishVillagePointer);
 villageZoomIn?.addEventListener("click",()=>setVillageZoom(villageZoom+0.15));
 villageZoomOut?.addEventListener("click",()=>setVillageZoom(villageZoom-0.15));
 villageZoomReset?.addEventListener("click",()=>{villageZoom=1;villagePanX=0;villagePanY=0;renderVillageCamera();});
}
function fitVillageImage(){
 if(!villageFrame||!villageStage||!villageImage||!villageImage.naturalWidth||!villageImage.naturalHeight)return;
 const frameWidth=villageFrame.clientWidth;
 const frameHeight=villageFrame.clientHeight;
 if(!frameWidth||!frameHeight)return;
 const scale=Math.min(frameWidth/villageImage.naturalWidth,frameHeight/villageImage.naturalHeight);
 villageStage.style.width=Math.round(villageImage.naturalWidth*scale)+"px";
 villageStage.style.height=Math.round(villageImage.naturalHeight*scale)+"px";
 renderVillageCamera();
}
if(villageImage){
 if(villageImage.complete)fitVillageImage();
 else villageImage.addEventListener("load",fitVillageImage,{once:true});
 if(typeof ResizeObserver==="function"){
  const villageResizeObserver=new ResizeObserver(fitVillageImage);
  villageResizeObserver.observe(villageFrame);
 }else{
  window.addEventListener("resize",fitVillageImage,{passive:true});
 }
}
renderVillageCamera();

const DEFAULT_RESOURCES={gold:1650,wood:6900,food:9350,stone:7480,iron:8040,horses:100};
const BUILDING_TYPES={
 center:{name:"Merkez Binası",shortName:"Merkez",icon:"🏰",description:"Yurdunun kalbi. Diğer yapıların gelişimini yönetir."},
 barracks:{name:"Kışla",shortName:"Kışla",icon:"⚔️",description:"Piyade ve savunma birliklerinin yetiştirileceği yapı."},
 lumberyard:{name:"Keresteci",shortName:"Keresteci",icon:"🪵",description:"Her yükseltme seviyesi odun üretimine +%5 bonus kazandırır."},
 blacksmith:{name:"Demirci",shortName:"Demirci",icon:"⚒️",description:"Her yükseltme seviyesi tüm askerlerin saldırı ve savunmasına +%2 bonus kazandırır."},
 school:{name:"Okul",shortName:"Okul",icon:"📚",description:"Eğitim ve araştırma çalışmalarını geliştirir."},
 temple:{name:"Tapınak",shortName:"Tapınak",icon:"🛕",description:"İnanç, birlik ve halkın moralini güçlendirir."},
 quarry:{name:"Taş Ocağı",shortName:"Taş Ocağı",icon:"🪨",description:"Taş üretimini geliştirecek yapı."},
 ironmine:{name:"Demir Madeni",shortName:"Demir Madeni",icon:"⛏️",description:"Demir üretimini geliştirecek yapı."},
 farm:{name:"Çiftlik",shortName:"Çiftlik",icon:"🌾",description:"Yiyecek üretimini geliştirecek yapı."},
 stable:{name:"Ahır",shortName:"Ahır",icon:"🐎",description:"Atlı birlikler için gerekli altyapı."},
 market:{name:"Pazar",shortName:"Pazar",icon:"🏪",description:"Kaynak ve ticaret işlemlerinin merkezi."},
 archery:{name:"Okçu",shortName:"Okçu",icon:"🏹",description:"Okçu birliklerinin yetiştirildiği ve geliştirildiği yapı."}
};
const BUILDING_SLOT_TYPES={
 "1":"center","2":"barracks","3":"stable","4":"blacksmith",
 "5":"school","6":"lumberyard","7":"temple","8":"market","9":"archery"
};
const BUILDING_ART={
 "1":"/assets/seljuk-center.svg",
 "2":"/assets/buildings/barracks.svg",
 "3":"/assets/buildings/stable.svg",
 "4":"/assets/buildings/blacksmith.svg",
 "5":"/assets/buildings/school.svg",
 "6":"/assets/buildings/lumberjack.svg",
 "7":"/assets/buildings/temple.svg",
 "8":"/assets/buildings/market.svg",
 "9":"/assets/buildings/archery.svg"
};
const DEFAULT_BUILDINGS={
 "1":{type:"center",level:1},
 "2":{type:"barracks",level:1},
 "3":{type:"stable",level:1},
 "4":{type:"blacksmith",level:1},
 "5":{type:"school",level:1},
 "6":{type:"lumberyard",level:1},
 "7":{type:"temple",level:1},
 "8":{type:"market",level:1},
 "9":{type:"archery",level:1}
};
const BUILDING_BASE_COST={wood:30,stone:20,iron:5};
const MAX_BUILDING_LEVEL=10;
let gameResources={...DEFAULT_RESOURCES};
let gameBuildings={...DEFAULT_BUILDINGS};
let gameWall={level:1,upgrade:null};
let wallServerEffects={defensePercent:5,shelterCapacity:{gold:500,wood:500,food:500,stone:500,iron:500}};
let gameProductionPerHour={gold:0,wood:0,food:0,stone:0,iron:0};
let gameProductionBreakdown=[];
let gameResourceNodes=[];
let gameStorageCapacity=15000;
function renderResourceBalances(){
 for(const key of Object.keys(DEFAULT_RESOURCES)){
  const node=document.querySelector("#resource-"+key);
  if(node)node.textContent=formatNumber(Number(gameResources[key]??0));
 }
}
function renderBuildingMarkers(){
 document.querySelectorAll("[data-building-slot]").forEach(node=>{
  const slot=node.dataset.buildingSlot;
  const building=gameBuildings[slot]||DEFAULT_BUILDINGS[slot];
  const type=BUILDING_SLOT_TYPES[slot];
  const definition=BUILDING_TYPES[type]||BUILDING_TYPES.center;
  const label=node.querySelector(".building-label");
  const levelBadge=node.querySelector(".building-index");
  const art=node.querySelector(".building-marker-art");
  if(art)art.src=BUILDING_ART[slot]||"/assets/keep.svg";
  const displayedLevel=Number(building.upgrade?.targetLevel)||Number(building.level)||1;
  if(label)label.textContent=definition.shortName||definition.name;
  if(levelBadge)levelBadge.textContent=String(displayedLevel);
  node.classList.add("is-built");
  node.classList.toggle("is-upgrading",Boolean(building.upgrade));
  node.setAttribute("aria-label",slot+" numaralı "+definition.name+" seviye "+displayedLevel);
  node.dataset.level=String(displayedLevel);
 });
 renderBuildingUpgradeProgress();
}
function renderBuildingUpgradeProgress(){
 const now=getServerNow();
 document.querySelectorAll("[data-building-slot]").forEach(node=>{
  const slot=String(node.dataset.buildingSlot||"");
  const upgrade=gameBuildings[slot]?.upgrade;
  const currentLabel=node.getAttribute("aria-label")||"";
  const baseLabel=currentLabel.replace(/, yükseltiliyor, yüzde \d+ tamamlandı$/,"").replace(/ yükseltiliyor$/,"");
  if(!upgrade){
   node.style.removeProperty("--upgrade-progress");
   delete node.dataset.upgradeProgress;
   if(currentLabel!==baseLabel)node.setAttribute("aria-label",baseLabel);
   return;
  }
  const progress=calculateVillageUpgradeProgress(upgrade,now);
  const rounded=Math.round(progress);
  node.style.setProperty("--upgrade-progress",progress.toFixed(2)+"%");
  node.dataset.upgradeProgress=String(rounded);
  node.setAttribute("aria-label",baseLabel+", yükseltiliyor, yüzde "+rounded+" tamamlandı");
 });
}
const buildingDialog=document.querySelector("#building-dialog");
const buildingClose=document.querySelector("#building-close");
const buildingTitle=document.querySelector("#building-title");
const buildingDescription=document.querySelector("#building-description");
const buildingEmblem=document.querySelector("#building-emblem");
const buildingEyebrow=document.querySelector("#building-eyebrow");
const buildingLevel=document.querySelector("#building-level");
const buildingLevelFill=document.querySelector("#building-level-fill");
const buildingCostTitle=document.querySelector("#building-cost-title");
const buildingCostWood=document.querySelector("#building-cost-wood");
const buildingCostStone=document.querySelector("#building-cost-stone");
const buildingCostIron=document.querySelector("#building-cost-iron");
const buildingMessage=document.querySelector("#building-message");
const buildingAction=document.querySelector("#building-action");
const marketLaunchButton=document.querySelector("#market-launch");
let selectedBuildingSlot=1;
function buildingCostFor(targetLevel){
 const multiplier=2*Math.pow(1.7,targetLevel-2);
 return {wood:Math.round(30*multiplier),stone:Math.round(20*multiplier),iron:Math.round(5*multiplier)};
}
const BUILDING_UPGRADE_MINUTES={2:2,3:5,4:15,5:30,6:60,7:120,8:240,9:480,10:720};
let serverClockBaseMs=Date.now();
let serverClockBaseMono=performance.now();
let upgradeCompletionCheckInFlight=false;
function setServerClock(serverNow){
 const parsed=Date.parse(serverNow);
 if(Number.isFinite(parsed)){
  serverClockBaseMs=parsed;
  serverClockBaseMono=performance.now();
 }
}
function getServerNow(){
 return serverClockBaseMs+(performance.now()-serverClockBaseMono);
}
function formatUpgradeRemainingAt(completesAt,now=getServerNow()){
 const totalSeconds=Math.ceil(Math.max(0,Date.parse(completesAt)-now)/1000);
 const hours=Math.floor(totalSeconds/3600),minutes=Math.floor((totalSeconds%3600)/60),seconds=totalSeconds%60;
 if(hours)return hours+" sa "+minutes+" dk";
 if(minutes)return minutes+" dk "+seconds+" sn";
 return seconds+" sn";
}
function formatUpgradeRemaining(completesAt){
 return formatUpgradeRemainingAt(completesAt);
}
function refreshBuildingCountdown(){
 if(!buildingDialog.open)return;
 const building=gameBuildings[String(selectedBuildingSlot)];
 if(!building?.upgrade)return;
 if(Date.parse(building.upgrade.completesAt)<=getServerNow()){
  buildingMessage.textContent="Yükseltme tamamlandı. Seviye güncelleniyor…";
 }else buildingMessage.textContent="Yükseltme sürüyor: "+formatUpgradeRemaining(building.upgrade.completesAt)+" kaldı.";
}
function renderUpgradeTracker(){
 const tracker=document.querySelector("#building-upgrade-tracker");
 const list=document.querySelector("#building-upgrade-list");
 if(!tracker||!list)return;
 const now=getServerNow();
 const active=Object.entries(gameBuildings)
  .filter(([,building])=>building?.upgrade)
  .map(([slot,building])=>({slot,building,name:(BUILDING_TYPES[BUILDING_SLOT_TYPES[slot]]||BUILDING_TYPES.center).name,level:building.level}))
  .concat(gameWall?.upgrade?[{slot:"wall",building:gameWall,name:"Sur / Sığınak",level:gameWall.level}]:[])
  .sort((a,b)=>Date.parse(a.building.upgrade.completesAt)-Date.parse(b.building.upgrade.completesAt));
 tracker.hidden=active.length===0;
 const countLabel=document.querySelector("#building-upgrade-count");
 if(countLabel)countLabel.textContent=active.length+" AKTİF";
 if(!active.length){
  list.replaceChildren();
  refreshBuildingCountdown();
  return;
 }
 list.innerHTML=active.map(({slot,building,name,level})=>{
  const started=Date.parse(building.upgrade.startedAt);
  const completes=Date.parse(building.upgrade.completesAt);
  const duration=Math.max(1,completes-started);
  const progress=Math.min(100,Math.max(0,(now-started)/duration*100));
  const remaining=formatUpgradeRemainingAt(building.upgrade.completesAt,now);
  return '<article class="upgrade-card" data-upgrade-slot="'+slot+'">'+
   '<div class="upgrade-card-top"><div><strong>'+name+'</strong><small>Seviye '+level+' → '+building.upgrade.targetLevel+'</small></div>'+
   '<b class="upgrade-countdown">'+remaining+'</b></div>'+
   '<div class="upgrade-progress"><span style="width:'+progress.toFixed(2)+'%"></span></div>'+
   '<small class="upgrade-card-foot">'+(progress>=100?'Tamamlanıyor…':'Yükseltme devam ediyor')+(slot==="wall"?' · Savunma':' · Alan '+slot)+'</small>'+
   '</article>';
 }).join("");
 if(active.some(({building})=>Date.parse(building.upgrade.completesAt)<=now)&&!upgradeCompletionCheckInFlight){
  upgradeCompletionCheckInFlight=true;
  loadGameState().finally(()=>{upgradeCompletionCheckInFlight=false;});
 }
 refreshBuildingCountdown();
}
function updateUpgradeTracking(){
 renderUpgradeTracker();
}
function updateBuildingDialog(){
 const slot=String(selectedBuildingSlot);
 const building=gameBuildings[slot]||DEFAULT_BUILDINGS[slot];
 const definition=BUILDING_TYPES[BUILDING_SLOT_TYPES[slot]]||BUILDING_TYPES.center;
 const currentLevel=Math.max(1,Number(building.level)||1);
 const targetLevel=currentLevel+1;
 const atMaximum=currentLevel>=MAX_BUILDING_LEVEL;
 const upgrading=Boolean(building.upgrade);
 const cost=buildingCostFor(targetLevel);
 buildingEmblem.src=BUILDING_ART[slot]||"/assets/keep.svg";
  buildingEmblem.alt=definition.name+" görseli";
 buildingEyebrow.textContent="İNŞA ALANI "+slot;
 buildingTitle.textContent=definition.name;
 buildingDescription.textContent=definition.description;
 buildingLevel.textContent=currentLevel+" / "+MAX_BUILDING_LEVEL+(upgrading?" · Yükseltiliyor":"");
 buildingLevelFill.style.width=(currentLevel/MAX_BUILDING_LEVEL*100)+"%";
 buildingCostTitle.textContent=atMaximum?"En yüksek seviyeye ulaşıldı":"Seviye "+targetLevel+" yükseltme maliyeti";
 buildingCostWood.textContent=formatNumber(cost.wood);
 buildingCostStone.textContent=formatNumber(cost.stone);
 buildingCostIron.textContent=formatNumber(cost.iron);
 const enough=Object.entries(cost).every(([key,value])=>Number(gameResources[key]||0)>=value);
 if(upgrading){
  buildingMessage.textContent="Yükseltme sürüyor: "+formatUpgradeRemaining(building.upgrade.completesAt)+" kaldı. Tamamlanınca seviye otomatik artacak.";
 }else if(atMaximum){
  buildingMessage.textContent="Bu bina en yüksek seviye olan 10'a ulaştı.";
 }else if(!enough){
  const missing=Object.entries(cost).filter(([key,value])=>Number(gameResources[key]||0)<value).map(([key,value])=>{
   const labels={wood:"odun",stone:"taş",iron:"demir"};
   return labels[key]+" "+formatNumber(value-Number(gameResources[key]||0));
  });
  buildingMessage.textContent="Eksik kaynak: "+missing.join(", ");
 }else buildingMessage.textContent="Gerekli kaynaklar hazır. İnşaat süresi: "+BUILDING_UPGRADE_MINUTES[targetLevel]+" dakika.";
 buildingAction.textContent=upgrading?"Yükseltiliyor":atMaximum?"Maksimum Seviye":"Seviye "+targetLevel+" Yükselt";
 buildingAction.disabled=upgrading||atMaximum||!enough||!authToken;
 if(marketLaunchButton)marketLaunchButton.hidden=slot!=="8";
}
function openBuildingDialog(slot){
 selectedBuildingSlot=Number(slot);
 applyVillageSelection(document.querySelectorAll("[data-building-slot]"),slot);
 buildingMessage.textContent="";
 updateBuildingDialog();
 if(typeof buildingDialog.showModal==="function")buildingDialog.showModal();
 else buildingDialog.setAttribute("open","");
}
document.querySelectorAll("[data-building-slot]").forEach(node=>{
 node.addEventListener("click",()=>openBuildingDialog(node.dataset.buildingSlot));
});
buildingClose.addEventListener("click",()=>buildingDialog.close());
setInterval(()=>{updateUpgradeTracking();renderBuildingUpgradeProgress();updateWallUpgradeCountdown();},1000);
buildingAction.addEventListener("click",async()=>{
 const slot=String(selectedBuildingSlot);
 const body={action:"upgrade",slot:selectedBuildingSlot};
 buildingAction.disabled=true;
 buildingMessage.textContent="İşlem gerçekleştiriliyor…";
 try{
  const result=await authRequest("/api/game/buildings",{method:"POST",token:authToken,body});
  setServerClock(result.serverNow);
  gameResources=result.resources;
  gameBuildings=Object.fromEntries(Object.entries(BUILDING_SLOT_TYPES).map(([buildingSlot,type])=>{
   const saved=result.buildings?.[buildingSlot]||{};
   return [buildingSlot,{type,level:Math.max(1,Number(saved.level)||1),upgrade:saved.upgrade||null}];
  }));
  renderResourceBalances();
  renderBuildingMarkers();
  renderUpgradeTracker();
  const definition=BUILDING_TYPES[BUILDING_SLOT_TYPES[slot]]||BUILDING_TYPES.center;
  buildingMessage.textContent=definition.name+" yükseltmesi başladı. "+formatUpgradeRemaining(result.building.upgrade.completesAt)+" sonra seviye "+result.building.upgrade.targetLevel+" olacak.";
  updateBuildingDialog();
 }catch(error){
  buildingMessage.textContent=error.message;
  updateBuildingDialog();
 }
});
renderResourceBalances();
renderBuildingMarkers();


const villageView=document.querySelector(".village-wrap");
const mapView=document.querySelector("#map-view");
const bottomNav=document.querySelector(".bottom-nav");
const navHomeParent=bottomNav.parentElement;
const navHomeNext=bottomNav.nextSibling;
const navButtons=document.querySelectorAll(".bottom-nav button");
function showScreen(screen){
 const isMap=screen==="map";
 villageView.hidden=isMap;
 mapView.hidden=!isMap;
 // Keep the main navigation in its original document position at the bottom of the page.
 document.body.classList.toggle("map-screen-active",isMap);
 navButtons.forEach(button=>button.classList.toggle("active",button.dataset.screen===screen));
 if(isMap&&authToken)loadWorldPlayers();
}
navButtons.forEach(button=>{
 button.addEventListener("click",()=>{
  if(button.dataset.screen==="map"||button.dataset.screen==="village"){
   showScreen(button.dataset.screen);
  }else{
   navButtons.forEach(item=>item.classList.remove("active"));
   button.classList.add("active");
  }
 });
});

// Settings are device preferences; account progress remains on the server.
const settingsDialog=document.querySelector("#settings-dialog");
const settingsMessage=document.querySelector("#settings-message");
const settingsPlayerName=document.querySelector("#settings-player-name");
const settingsPlayerEmail=document.querySelector("#settings-player-email");
const settingsThemeName=document.querySelector("#settings-theme-name");
const reducedMotionToggle=document.querySelector("#setting-reduced-motion");
const compactResourcesToggle=document.querySelector("#setting-compact-resources");
const SETTINGS_KEY="umaykut-v2-settings";
let currentPlayer=null;
function readSettings(){
 try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");}catch{return {};}
}
function applySettings(){
 const prefs=readSettings();
 reducedMotionToggle.checked=Boolean(prefs.reducedMotion);
 compactResourcesToggle.checked=Boolean(prefs.compactResources);
 document.documentElement.classList.toggle("reduce-motion",reducedMotionToggle.checked);
 shell.classList.toggle("compact-resources",compactResourcesToggle.checked);
}
function saveSettings(){
 try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({reducedMotion:reducedMotionToggle.checked,compactResources:compactResourcesToggle.checked}));}catch{}
 applySettings();
}
function openSettings(){
 settingsPlayerName.textContent=currentPlayer?.username||"Oyuncu";
 settingsPlayerEmail.textContent=currentPlayer?.email||"E-posta bilgisi alınamadı";
 settingsThemeName.textContent=factions[shell.dataset.faction]?.name||"Devlet seçilmedi";
 settingsMessage.textContent="";
 applySettings();
 if(!settingsDialog.open)settingsDialog.showModal();
}
document.querySelector("#open-settings").addEventListener("click",openSettings);
document.querySelector('[data-action="settings"]').addEventListener("click",openSettings);
document.querySelector("#close-settings").addEventListener("click",()=>settingsDialog.close());
reducedMotionToggle.addEventListener("change",saveSettings);
compactResourcesToggle.addEventListener("change",saveSettings);
applySettings();

const rankingDialog=document.querySelector("#ranking-dialog");
const rankingListNode=document.querySelector("#ranking-list");
const rankingMessageNode=document.querySelector("#ranking-message");
const rankingRefreshButton=document.querySelector("#ranking-refresh");
const rankingFactionNames={gokturk:"Göktürk",hun:"Hun",seljuk:"Selçuklu"};
const rankingNumber=value=>new Intl.NumberFormat("tr-TR").format(Number(value)||0);

function renderRanking(data){
 const me=data.me;
 document.querySelector("#ranking-my-position").textContent=me?"#"+rankingNumber(me.rank):"Henüz yok";
 document.querySelector("#ranking-my-score").textContent=me?rankingNumber(me.score)+" puan":"—";
 rankingListNode.replaceChildren();
 const players=Array.isArray(data.topPlayers)?data.topPlayers:[];
 if(!players.length){
  const empty=document.createElement("p");
  empty.textContent="Henüz sıralamaya katılan bir yurt bulunmuyor.";
  rankingListNode.append(empty);
  return;
 }
 players.forEach(player=>{
  const row=document.createElement("article");
  row.className="ranking-row"+(player.isMe?" is-me":"");
  const rank=document.createElement("span");
  rank.className="ranking-place";
  rank.textContent=player.rank<=3?["🥇","🥈","🥉"][player.rank-1]:"#"+rankingNumber(player.rank);
  const identity=document.createElement("span");
  identity.className="ranking-identity";
  const username=document.createElement("strong");
  username.textContent=player.username||"Oyuncu";
  const village=document.createElement("small");
  village.textContent=(player.villageName||"İsimsiz Yurt")+" · "+(rankingFactionNames[player.factionId]||"Devlet seçilmedi");
  identity.append(username,village);
  const score=document.createElement("b");
  score.className="ranking-points";
  score.textContent=rankingNumber(player.score);
  row.append(rank,identity,score);
  rankingListNode.append(row);
 });
 if(data.totalPlayers>players.length){
  const more=document.createElement("p");
  more.className="ranking-more";
  more.textContent="İlk "+rankingNumber(players.length)+" oyuncu gösteriliyor · Toplam "+rankingNumber(data.totalPlayers)+" oyuncu";
  rankingListNode.append(more);
 }
}

async function loadRanking(){
 if(!authToken)return;
 rankingRefreshButton.disabled=true;
 rankingMessageNode.textContent="Sıralama güncelleniyor…";
 try{
  const data=await authRequest("/api/game/rankings",{token:authToken});
  const ranked=Array.isArray(data.rankings)?data.rankings:[];
  const currentId=String(data.currentPlayerId||"");
  const players=ranked.map(player=>({...player,score:player.overall,isMe:String(player.playerId)===currentId}));
  const me=players.find(player=>player.isMe)||null;
  renderRanking({totalPlayers:players.length,topPlayers:players.slice(0,50),me});
  rankingMessageNode.textContent=rankingNumber(players.length)+" oyuncu değerlendirildi.";
 }catch(error){
  rankingListNode.replaceChildren(Object.assign(document.createElement("p"),{textContent:error.message||"Sıralama yüklenemedi."}));
  rankingMessageNode.textContent="Bağlantını kontrol edip yeniden deneyebilirsin.";
 }finally{
  rankingRefreshButton.disabled=false;
 }
}

function openRanking(){
 if(!rankingDialog.open)rankingDialog.showModal();
 loadRanking();
}
document.querySelector("#open-ranking").addEventListener("click",openRanking);
document.querySelector("#ranking-close").addEventListener("click",()=>rankingDialog.close());
rankingRefreshButton.addEventListener("click",loadRanking);

const WORKER_POOL=1800;
let currentWorkerPool=WORKER_POOL;
let currentArmyPopulation=0;
let workerProductionPerHour=25;
const WORKER_STORAGE_KEY="umaykut-worker-state-v3";
const RESOURCE_KEYS=["grain","wood","stone","gold","iron"];
const resourceInfo={
 grain:{name:"Tahıl Tarlası",type:"TAHIL BÖLGESİ",description:"Tahıl üretmek için bu tarlaya işçi görevlendir."},
 wood:{name:"Odun Deposu",type:"ODUN BÖLGESİ",description:"Odun toplamak için bu kaynağa işçi görevlendir."},
 stone:{name:"Taş Ocağı",type:"TAŞ BÖLGESİ",description:"Taş çıkarmak için bu ocağa işçi görevlendir."},
 gold:{name:"Altın Yatağı",type:"ALTIN BÖLGESİ",description:"Altın çıkarmak için bu yatağa işçi görevlendir."},
 iron:{name:"Demir Madeni",type:"DEMİR BÖLGESİ",description:"Demir çıkarmak için bu madene işçi görevlendir."}
};
const assigned={grain:0,wood:0,stone:0,gold:0,iron:0};
let availableWorkers=WORKER_POOL;
let selectedResource=null;
let selectedMineKey=null;
let selectedMineName="";
function restoreWorkerState(){
 try{
  const saved=JSON.parse(localStorage.getItem(WORKER_STORAGE_KEY)||localStorage.getItem("umaykut-worker-state-v2")||"null");
  if(!saved||!saved.assigned)return;
  if(Number.isFinite(Number(saved.workerPool)))currentWorkerPool=Math.max(WORKER_POOL,Number(saved.workerPool));
  Object.keys(saved.assigned).forEach(key=>{
   if((RESOURCE_KEYS.includes(key)||/^mine_\d+$/.test(key))&&Number.isSafeInteger(saved.assigned[key])&&saved.assigned[key]>=0)assigned[key]=saved.assigned[key];
  });
  const total=totalAssigned();
  if(total>currentWorkerPool){Object.keys(assigned).forEach(key=>assigned[key]=0);return;}
  availableWorkers=currentWorkerPool-total;
 }catch{}
}
function saveWorkerState(){
 try{localStorage.setItem(WORKER_STORAGE_KEY,JSON.stringify({version:3,workerPool:currentWorkerPool,assigned}));}catch{}
 if(gameStateReady)persistGameState().catch(()=>{
  if(workerStatus)workerStatus.textContent="Bağlantı kurulamadı; değişiklik bu cihazda saklandı.";
 });
}
const availableLabel=document.querySelector("#workers-available");
const assignedTotalLabel=document.querySelector("#workers-assigned-total");
const resourcePanel=document.querySelector("#resource-selection");
const mapPrompt=document.querySelector("#map-prompt");
const resourceType=document.querySelector("#resource-type");
const resourceName=document.querySelector("#resource-name");
const resourceDescription=document.querySelector("#resource-description");
const workerInput=document.querySelector("#worker-count");
const workerStatus=document.querySelector("#worker-status");
const assignButton=document.querySelector("#assign-workers");
const recallButton=document.querySelector("#recall-workers");
function formatNumber(value){return new Intl.NumberFormat("tr-TR").format(value);}
function totalAssigned(){return Object.values(assigned).reduce((sum,value)=>sum+value,0);}
function updateWorkerSummary(){
 availableWorkers=Math.max(0,currentWorkerPool-totalAssigned()-currentArmyPopulation);
 availableLabel.textContent=formatNumber(availableWorkers);
 assignedTotalLabel.textContent=formatNumber(totalAssigned())+" görevde";
 updateWorkerActions();
}
function selectedMineAssigned(){
 if(!selectedResource)return 0;
 return (selectedMineKey?Number(assigned[selectedMineKey]||0):0)+Number(assigned[selectedResource]||0);
}
function updateWorkerActions(){
 if(!selectedResource)return;
 const current=selectedMineAssigned();
 assignButton.disabled=availableWorkers===0;
 recallButton.disabled=current===0;
 workerInput.max=String(Math.max(availableWorkers,current,1));
}
function selectWorldMine(node,marker){
 const info=resourceInfo[node.resource_type];
 if(!info)return;
 selectedResource=node.resource_type;
 selectedMineKey="mine_"+node.id;
 selectedMineName=info.name;
 mapWorldCanvas.querySelectorAll(".resource-node-marker.is-selected").forEach(item=>item.classList.remove("is-selected"));
 marker.classList.add("is-selected");
 mapPrompt.hidden=true;
 resourcePanel.hidden=false;
 resourceType.textContent=info.type+" · VERİM "+node.yield_level+"/9";
 resourceName.textContent=info.name;
 resourceDescription.textContent=info.description;
 workerInput.value="1";
 workerStatus.textContent=`Bu kaynakta ${formatNumber(selectedMineAssigned())} işçi görevde · ${formatNumber(availableWorkers)} işçi boştadır.`;
 updateWorkerActions();
}
function readWorkerCount(){
 const count=Number(workerInput.value);
 if(!Number.isSafeInteger(count)||count<1){workerStatus.textContent="Lütfen 1 veya daha fazla tam sayı gir.";return null;}
 return count;
}
assignButton.addEventListener("click",()=>{
 if(!selectedResource||!selectedMineKey)return;
 const count=readWorkerCount();if(count===null)return;
 if(count>availableWorkers){workerStatus.textContent=`En fazla ${formatNumber(availableWorkers)} işçi gönderebilirsin.`;workerInput.value=String(Math.max(availableWorkers,1));return;}
 assigned[selectedMineKey]=(assigned[selectedMineKey]||0)+count;
 saveWorkerState();updateWorkerSummary();workerInput.value="1";
 workerStatus.textContent=`${formatNumber(count)} işçi ${selectedMineName} noktasına gönderildi. Bu kaynakta ${formatNumber(selectedMineAssigned())} görevde, ${formatNumber(availableWorkers)} boştadır. Hesabına kaydedildi.`;
});
recallButton.addEventListener("click",()=>{
 if(!selectedResource||!selectedMineKey)return;
 const count=readWorkerCount();if(count===null)return;
 const current=selectedMineAssigned();
 if(count>current){workerStatus.textContent=`Bu kaynakta yalnızca ${formatNumber(current)} işçi görevde.`;workerInput.value=String(Math.max(current,1));return;}
 let remaining=count;
 const fromMine=Math.min(remaining,Number(assigned[selectedMineKey]||0));
 assigned[selectedMineKey]-=fromMine;remaining-=fromMine;
 if(remaining>0)assigned[selectedResource]=Math.max(0,Number(assigned[selectedResource]||0)-remaining);
 saveWorkerState();updateWorkerSummary();workerInput.value="1";
 workerStatus.textContent=`${formatNumber(count)} işçi ${selectedMineName} noktasından geri çağrıldı. Bu kaynakta ${formatNumber(selectedMineAssigned())} görevde, ${formatNumber(availableWorkers)} boştadır.`;
});
restoreWorkerState();
updateWorkerSummary();

const productionDialog=document.querySelector("#production-dialog");
const productionOpen=document.querySelector("#production-open");
const productionClose=document.querySelector("#production-close");
const productionResourceGrid=document.querySelector("#production-resource-grid");
const productionBreakdownList=document.querySelector("#production-breakdown-list");
const productionWorkerTotal=document.querySelector("#production-worker-total");
const productionWorkerFree=document.querySelector("#production-worker-free");
const productionEffectsList=document.querySelector("#production-effects-list");
const productionUpdated=document.querySelector("#production-updated");
const RESOURCE_LABELS={gold:"Altın",wood:"Odun",food:"Yiyecek",stone:"Taş",iron:"Demir"};
const RESOURCE_ICONS={gold:"🪙",wood:"🪵",food:"🌾",stone:"🪨",iron:"⛏️"};
const RESOURCE_BASE_RATES={gold:2,wood:10,food:12,stone:6,iron:4};
function productionNodeName(item){
 const node=gameResourceNodes.find(node=>String(node.id)===String(item.nodeId));
 const names={gold:"Altın Yatağı",wood:"Odun Alanı",food:"Tahıl Tarlası",stone:"Taş Ocağı",iron:"Demir Madeni"};
 return node?names[node.resourceType]||"Kaynak Alanı":names[item.resourceType]||"Kaynak Alanı";
}
function renderProductionDialog(){
 if(!productionResourceGrid)return;
 const total=totalAssigned();
 productionWorkerTotal.textContent=formatNumber(total);
 productionWorkerFree.textContent=formatNumber(Math.max(0,currentWorkerPool-total-currentArmyPopulation))+" işçi boştadır";
 productionResourceGrid.replaceChildren();
 for(const key of ["gold","wood","food","stone","iron"]){
  const current=Number(gameResources[key]||0),rate=Number(gameProductionPerHour[key]||0);
  const card=document.createElement("article");card.className="production-resource-card";
  const heading=document.createElement("div");heading.className="production-resource-heading";
  const icon=document.createElement("span");icon.textContent=RESOURCE_ICONS[key];
  const name=document.createElement("b");name.textContent=RESOURCE_LABELS[key];
  heading.append(icon,name);
  const amount=document.createElement("strong");amount.textContent="+"+formatNumber(rate)+"/saat";
  const stock=document.createElement("small");stock.textContent=formatNumber(current)+" / "+formatNumber(gameStorageCapacity)+" depoda";
  const meter=document.createElement("div");meter.className="production-capacity-track";
  const fill=document.createElement("span");fill.style.width=Math.min(100,current/gameStorageCapacity*100)+"%";meter.append(fill);
  card.append(heading,amount,stock,meter);productionResourceGrid.append(card);
 }
 productionBreakdownList.replaceChildren();
 if(!gameProductionBreakdown.length){
  const empty=document.createElement("p");empty.textContent="Henüz kaynak alanlarına işçi gönderilmedi.";productionBreakdownList.append(empty);
 }else{
  gameProductionBreakdown.forEach(item=>{
   const row=document.createElement("article");row.className="production-breakdown-row";
   const title=document.createElement("strong");title.textContent=productionNodeName(item)+(item.nodeId?" · Verim "+item.yieldLevel+"/10":" · Genel alan");
   const detail=document.createElement("small");detail.textContent=formatNumber(item.workers)+" işçi × "+formatNumber(item.workerBaseRate)+" temel üretim × "+item.nodeMultiplier.toFixed(2)+" kaynak verimi × "+item.centerMultiplier.toFixed(2)+" merkez bonusu";
   const output=document.createElement("b");output.textContent="+"+formatNumber(item.hourlyProduction)+" "+RESOURCE_LABELS[item.resourceType]+"/saat";
   row.append(title,detail,output);productionBreakdownList.append(row);
  });
 }
 const centerLevel=Number(gameBuildings["1"]?.level)||1;
 const archeryLevel=Number(gameBuildings["9"]?.level)||1;
 const lumberyardLevel=Number(gameBuildings["6"]?.level)||1;
 const centerBonus=(centerLevel-1)*5;
 const lumberyardBonus=(lumberyardLevel-1)*5;
 const nodeBonus=gameProductionBreakdown.some(item=>item.nodeId);
 productionEffectsList.replaceChildren();
 const effects=[
  "Merkez seviyesi "+centerLevel+": üretime +%"+centerBonus+" bonus",
  "Keresteci seviyesi "+lumberyardLevel+": odun üretimine +%"+lumberyardBonus+" bonus",
  "Okçu seviyesi "+archeryLevel+": okçu birlikleri için eğitim altyapısı",
  nodeBonus?"Kaynak noktası verimi: her seviye temel üretime +%10 katkı sağlar.":"Kaynak noktalarına işçi gönderildiğinde verim seviyesi üretime bonus sağlar."
 ];
 effects.forEach(value=>{const p=document.createElement("p");p.textContent=value;productionEffectsList.append(p);});
 if(productionUpdated)productionUpdated.textContent="Hesaplama sunucudaki gerçek üretim değerleriyle eşleştirildi.";
}
async function openProductionDialog(){
 renderProductionDialog();
 if(productionDialog&&!productionDialog.open)productionDialog.showModal();
 if(productionUpdated)productionUpdated.textContent="Üretim bilgileri güncelleniyor…";
 try{await refreshProductionState();}catch{if(productionUpdated)productionUpdated.textContent="Son kayıtlı üretim değerleri gösteriliyor.";}
}
productionOpen?.addEventListener("click",openProductionDialog);
productionClose?.addEventListener("click",()=>productionDialog.close());



// Account access: the legacy login/register experience is connected to the V2 account API.
const AUTH_TOKEN_KEY="umaykut-v2-session";
let authMode="login";
let authToken=null;
const authScreen=document.querySelector("#auth-screen");
const gameShell=document.querySelector("#game-shell");
const authForm=document.querySelector("#auth-form");
const loginTab=document.querySelector("#login-tab");
const registerTab=document.querySelector("#register-tab");
const authUsername=document.querySelector("#auth-username");
const authUsernameLabel=document.querySelector("#auth-username-label");
const authEmailField=document.querySelector("#auth-email-field");
const authEmail=document.querySelector("#auth-email");
const authPassword=document.querySelector("#auth-password");
const authSubmit=document.querySelector("#auth-submit");
const authMessage=document.querySelector("#auth-message");

function setAuthMode(mode){
 authMode=mode==="register"?"register":"login";
 const registering=authMode==="register";
 loginTab.classList.toggle("selected",!registering);
 registerTab.classList.toggle("selected",registering);
 loginTab.setAttribute("aria-selected",String(!registering));
 registerTab.setAttribute("aria-selected",String(registering));
 authEmailField.hidden=!registering;
 authEmail.required=registering;
 authUsernameLabel.textContent=registering?"Oyuncu adı":"Oyuncu adı veya e-posta";
 authUsername.placeholder=registering?"Oyuncu adın":"Oyuncu adın veya e-posta";
 authPassword.autocomplete=registering?"new-password":"current-password";
 authSubmit.textContent=registering?"Hesap Oluştur":"Oyuna Giriş";
 authMessage.textContent="";
}
loginTab.addEventListener("click",()=>setAuthMode("login"));
registerTab.addEventListener("click",()=>setAuthMode("register"));

async function authRequest(path,{method="GET",body,token}={}){
 const headers={};
 if(body!==undefined)headers["Content-Type"]="application/json";
 if(token)headers.Authorization="Bearer "+token;
 const response=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({error:"Sunucu yanıtı okunamadı."}));
 if(!response.ok){
  const error=new Error(data.error||"İşlem tamamlanamadı.");
  error.status=response.status;
  throw error;
 }
 return data;
}


function applyProductionState(state){
 if(Number.isFinite(Number(state.workerPool)))currentWorkerPool=Math.max(WORKER_POOL,Number(state.workerPool));
 if(Number.isFinite(Number(state.workerProductionPerHour)))workerProductionPerHour=Number(state.workerProductionPerHour);
 const totalLabel=document.querySelector("#workers-total-count");
 const hourlyLabel=document.querySelector("#workers-hourly-production");
 if(totalLabel)totalLabel.textContent="Toplam işçi: "+formatNumber(currentWorkerPool);
 if(hourlyLabel)hourlyLabel.textContent="+"+formatNumber(workerProductionPerHour)+" işçi/saat";
 updateWorkerSummary();
 gameProductionPerHour={...gameProductionPerHour,...(state.productionPerHour||{})};
 gameProductionBreakdown=Array.isArray(state.productionBreakdown)?state.productionBreakdown:[];
 gameResourceNodes=Array.isArray(state.resourceNodes)?state.resourceNodes:[];
 gameStorageCapacity=Math.max(1,Number(state.storageCapacity)||gameStorageCapacity);
 if(state.resources&&typeof state.resources==="object")gameResources={...DEFAULT_RESOURCES,...state.resources};
 renderResourceBalances();
 renderProductionDialog();
}
async function refreshProductionState(){
 if(!authToken)return null;
 const state=await authRequest("/api/game/state",{token:authToken});
 setServerClock(state.serverNow);
 applyProductionState(state);
 return state;
}
async function persistGameState(){
 if(!authToken||!gameStateReady)return;
 await refreshProductionState();
 const saved=await authRequest("/api/game/state",{
  method:"PUT",
  token:authToken,
  body:{factionId:shell.dataset.faction,workerAssignments:{...assigned}}
 });
 await refreshProductionState();
 return saved;
}

async function loadGameState(){
 if(!authToken)return;
 gameStateReady=false;
 try{
  const state=await authRequest("/api/game/state",{token:authToken});
  setServerClock(state.serverNow);
  if(state.factionId) setFaction(state.factionId);
  applyProductionState(state);
  gameWall=state.wall||{level:1,upgrade:null};
  wallServerEffects=state.wallEffects||wallEffectsForLevel(gameWall.level);
  renderWallDialog();
  gameBuildings=Object.fromEntries(Object.entries(BUILDING_SLOT_TYPES).map(([slot,type])=>{
   const saved=state.buildings?.[slot]||{};
   return [slot,{type,level:Math.max(1,Number(saved.level)||1),upgrade:saved.upgrade||null}];
  }));
  renderResourceBalances();
  renderBuildingMarkers();
  renderUpgradeTracker();
  if(state.workerStateInitialized){
   Object.keys(assigned).forEach(key=>delete assigned[key]);
   Object.entries(state.workerAssignments||{}).forEach(([key,value])=>{
    if((RESOURCE_KEYS.includes(key)||/^mine_\d+$/.test(key))&&Number.isSafeInteger(Number(value))&&Number(value)>=0)assigned[key]=Number(value);
   });
   RESOURCE_KEYS.forEach(key=>{if(!Number.isSafeInteger(assigned[key]))assigned[key]=0;});
   currentWorkerPool=Math.max(WORKER_POOL,Number(state.workerPool||WORKER_POOL));
   availableWorkers=Math.max(0,currentWorkerPool-totalAssigned());
  }else{
   await authRequest("/api/game/state",{
    method:"PUT",token:authToken,
    body:{factionId:shell.dataset.faction,workerAssignments:{...assigned}}
   });
   currentWorkerPool=Math.max(WORKER_POOL,Number(state.workerPool||WORKER_POOL));
   availableWorkers=Math.max(0,currentWorkerPool-totalAssigned());
  }
  gameStateReady=true;
  saveWorkerState();
  updateWorkerSummary();
  return state;
 }catch(error){
  gameStateReady=false;
  restoreWorkerState();
  updateWorkerSummary();
  if(workerStatus)workerStatus.textContent="Sunucu eşitlemesi yapılamadı; yerel kayıt korunuyor.";
 }
}

async function enterGame(player,token){
 currentPlayer=player||currentPlayer;
 authToken=token||authToken;
 try{if(authToken)localStorage.setItem(AUTH_TOKEN_KEY,authToken);}catch{}
 const username=player?.username||"Oyuncu";
 settingsPlayerName.textContent=username;
 settingsPlayerEmail.textContent=player?.email||"Hesap bilgileri";
 const displayName=document.querySelector("#player-display-name");
 if(displayName)displayName.textContent=username+" Bey";
 authScreen.hidden=true;
 gameShell.removeAttribute("inert");
 gameShell.removeAttribute("aria-hidden");
 await loadGameState();
 await loadArmyState();
 const profile=await authRequest("/api/player/profile",{token:authToken});
 if(profile.villageName&&profile.factionId){
  updateVillageName(profile.villageName);
  setFaction(profile.factionId);
 }else{
  openFoundingDialog(currentPlayer,profile||{});
 }
}

authForm.addEventListener("submit",async event=>{
 event.preventDefault();
 if(!authForm.reportValidity())return;
 const identifier=authUsername.value.trim();
 const password=authPassword.value;
 const registering=authMode==="register";
 const body=registering
  ?{username:identifier,email:authEmail.value.trim(),password}
  :{email:identifier,password};
 authSubmit.disabled=true;
 authMessage.textContent=registering?"Hesabın oluşturuluyor…":"Oyuna giriş yapılıyor…";
 try{
  const data=await authRequest(registering?"/api/auth/register":"/api/auth/login",{method:"POST",body});
  await enterGame(data.player,data.token);
 }catch(error){
  authMessage.textContent=error.message;
 }finally{
  authSubmit.disabled=false;
 }
});

async function restoreAccountSession(){
 let savedToken=null;
 try{savedToken=localStorage.getItem(AUTH_TOKEN_KEY);}catch{}
 if(!savedToken)return;
 authSubmit.disabled=true;
 authMessage.textContent="Oturum kontrol ediliyor…";
 try{
  const data=await authRequest("/api/auth/me",{token:savedToken});
  await enterGame(data.player,savedToken);
 }catch(error){
  if(error.status===401){
   try{localStorage.removeItem(AUTH_TOKEN_KEY);}catch{}
   authMessage.textContent="Oturum süresi dolmuş. Yeniden giriş yap.";
  }else{
   authMessage.textContent="Oturum doğrulanamadı. Bağlantını kontrol edip tekrar giriş yap.";
  }
 }finally{
  authSubmit.disabled=false;
 }
}
async function logoutAccount(){
 const logoutButton=document.querySelector("#logout-button");
 logoutButton.disabled=true;
 settingsMessage.textContent="Oturum güvenli şekilde kapatılıyor…";
 try{
  if(authToken){
   await authRequest("/api/auth/session",{method:"DELETE",token:authToken});
  }
  try{localStorage.removeItem(AUTH_TOKEN_KEY);}catch{}
  authToken=null;
  currentPlayer=null;
  gameStateReady=false;
  settingsDialog.close();
  gameShell.setAttribute("inert","");
  gameShell.setAttribute("aria-hidden","true");
  authScreen.hidden=false;
  authMessage.textContent="Güvenli çıkış yapıldı. Yeniden giriş yapabilirsin.";
  authPassword.value="";
  setAuthMode("login");
  window.scrollTo({top:0,behavior:"auto"});
 }catch(error){
  settingsMessage.textContent=error.message||"Çıkış yapılamadı. Tekrar dene.";
 }finally{
  logoutButton.disabled=false;
 }
}
document.querySelector("#logout-button").addEventListener("click",()=>{
 if(window.confirm("Oyundan çıkış yapmak istiyor musun? Şehrin ve ilerlemen hesabında saklı kalır."))logoutAccount();
});
setAuthMode("login");
restoreAccountSession();



function wallEffectsForLevel(level){const n=Math.max(1,Math.min(10,Number(level)||1));return {defensePercent:n*5,shelterCapacity:{gold:n*500,wood:n*500,food:n*500,stone:n*500,iron:n*500}};}
const wallDialog=document.querySelector("#wall-dialog");
const wallMarker=document.querySelector("#wall-position-marker");
const wallAction=document.querySelector("#wall-action");
const wallMessage=document.querySelector("#wall-message");
let wallRefreshPending=false;
function updateWallUpgradeCountdown(){
 if(!gameWall.upgrade){return;}
 const remaining=Date.parse(gameWall.upgrade.completesAt)-getServerNow();
 renderUpgradeTracker();
 if(remaining<=0){wallMessage.textContent="Sur yükseltmesi tamamlanıyor…";if(!wallRefreshPending){wallRefreshPending=true;loadGameState().finally(()=>{wallRefreshPending=false;renderWallDialog();renderUpgradeTracker();});}return;}
 const total=Math.ceil(remaining/1000),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;
 wallMessage.textContent="Seviye "+gameWall.upgrade.targetLevel+" yükseltiliyor · "+(hours?hours+" sa ":"")+(minutes?minutes+" dk ":"")+seconds+" sn kaldı.";
}
function renderWallDialog(){
 const level=Number(gameWall.level)||1,effects=wallServerEffects||wallEffectsForLevel(level);
 document.querySelector("#wall-level").textContent=level+" / 10";
 document.querySelector("#wall-level-fill").style.width=(level*10)+"%";
 document.querySelector("#wall-defense").textContent=effects.defensePercent+"%";
 document.querySelector("#wall-shelter").textContent=formatNumber(effects.shelterCapacity.wood||level*500);
 document.querySelector("#wall-shelter-breakdown").textContent="Altın "+formatNumber(effects.shelterCapacity.gold)+" · Odun "+formatNumber(effects.shelterCapacity.wood)+" · Yiyecek "+formatNumber(effects.shelterCapacity.food)+" · Taş "+formatNumber(effects.shelterCapacity.stone)+" · Demir "+formatNumber(effects.shelterCapacity.iron);
 wallMarker.querySelector("span").textContent=String(level);
 const target=level+1,cost=target<=10?wallUpgradeCostForLevel(target):null;
 document.querySelector("#wall-upgrade-title").textContent=target<=10?"Seviye "+target+" sur yükseltme maliyeti":"Sur en yüksek seviyede";
 for(const key of ["wood","stone","iron","gold"])document.querySelector("#wall-cost-"+key).textContent=cost?formatNumber(cost[key]):"—";
 wallAction.disabled=target>10||Boolean(gameWall.upgrade);
 wallAction.textContent=gameWall.upgrade?"Yükseltme sürüyor":target>10?"En yüksek seviye":"Sur seviyesini yükselt";
 if(gameWall.upgrade){wallMessage.textContent="Seviye "+gameWall.upgrade.targetLevel+" yükseltmesi devam ediyor. Tamamlanma: "+new Date(gameWall.upgrade.completesAt).toLocaleString("tr-TR");}
 else if(!wallMessage.textContent)wallMessage.textContent="Her seviye saldırı hasarını %5 azaltır ve her kaynak türünden 500 ek koruma sağlar.";
}
function wallUpgradeCostForLevel(level){const scale=Math.pow(1.65,level-2);return {wood:Math.round(250*scale),stone:Math.round(220*scale),iron:Math.round(90*scale),gold:Math.round(100*scale)};}
wallMarker.addEventListener("click",()=>{renderWallDialog();wallDialog.showModal();});
document.querySelector("#wall-close").addEventListener("click",()=>wallDialog.close());
wallAction.addEventListener("click",async()=>{
 wallAction.disabled=true;wallMessage.textContent="Sur yükseltmesi başlatılıyor…";
 try{
  const result=await authRequest("/api/game/wall",{method:"POST",token:authToken,body:{action:"upgrade"}});
  gameResources={...gameResources,...result.resources};gameWall=result.wall;wallServerEffects=result.wallEffects;
  setServerClock(result.serverNow);renderResourceBalances();renderWallDialog();renderUpgradeTracker();wallMessage.textContent="Sur yükseltmesi başladı. Yükseltme İzleme bölümünden takip edebilirsin.";
 }catch(error){wallMessage.textContent=error.message||"Sur yükseltmesi başlatılamadı.";wallAction.disabled=false;}
});

// Server-authoritative faction army and sequential troop training.
const armyDialog=document.querySelector("#army-dialog");
const armyCatalogNode=document.querySelector("#army-unit-catalog");
let selectedArmyUnitId=null;
const armyQueueNode=document.querySelector("#army-queue-list");
const armyMessageNode=document.querySelector("#army-message");
let armyState=null;
let armyRefreshTimer=null;
const troopPortraitPositions={scout:"0% 0%",infantry:"33.333% 0%",archer:"66.667% 0%",shield:"100% 0%",guard:"0% 100%",light_cavalry:"33.333% 100%",mounted_archer:"66.667% 100%",heavy_cavalry:"100% 100%"};
function applyTroopPortrait(node,unitId){
 node.classList.add("troop-portrait-sprite");
 node.style.backgroundPosition=troopPortraitPositions[unitId]||"0% 0%";
 node.setAttribute("role","img");
 node.setAttribute("aria-label",unitId+" asker portresi");
}
function armyNumber(value){return new Intl.NumberFormat("tr-TR").format(Number(value)||0);}
function renderArmySummary(){
 if(!armyState)return;
 document.querySelector("#army-total-units").textContent=armyNumber(armyState.totalUnits);
 document.querySelector("#army-total-power").textContent=armyNumber(armyState.armyPower);
 document.querySelector("#army-faction-name").textContent=armyState.factionName+" · Demirci +%"+(armyState.catalog[0]?.blacksmithBonusPercent||0);
 const strip=document.querySelector("#army-units");
 if(strip){
  strip.replaceChildren();
  armyState.catalog.forEach(unit=>{
   const card=document.createElement("button");card.type="button";card.className="army-strip-unit";card.dataset.openUnit=unit.id;
   const icon=document.createElement("span"),count=document.createElement("b"),name=document.createElement("small");
   applyTroopPortrait(icon,unit.id);count.textContent=armyNumber(armyState.troops[unit.id]||0);name.textContent=unit.name;
   card.append(icon,count,name);strip.append(card);
  });
 }
}
function showArmyUnitList(){
 document.querySelector("#army-unit-list-section").hidden=false;
 document.querySelector("#army-unit-detail").hidden=true;
 selectedArmyUnitId=null;
}
function renderArmyCatalog(){
 if(!armyState)return;
 armyCatalogNode.replaceChildren();
 armyState.catalog.forEach(unit=>{
  const card=document.createElement("button");card.type="button";card.className="army-unit-card"+(unit.unlocked?"":" is-locked");
  card.dataset.selectUnit=unit.id;
  const head=document.createElement("span");head.className="army-unit-card-head";
  const emblem=document.createElement("span");emblem.className="army-unit-emblem";applyTroopPortrait(emblem,unit.id);
  const title=document.createElement("span"),name=document.createElement("strong"),owned=document.createElement("small");
  name.textContent=unit.name;owned.textContent="Mevcut: "+armyNumber(armyState.troops[unit.id]||0);
  title.append(name,owned);head.append(emblem,title);
  const meta=document.createElement("span");meta.className="army-unit-card-meta";
  meta.textContent=unit.unlocked?"Özellikleri görüntüle · Yetiştir":"Kilitli · Gerekli bina seviyesini gör";
  card.append(head,meta);armyCatalogNode.append(card);
 });
}
function renderArmyUnitDetail(unitId){
 if(!armyState)return;
 const unit=armyState.catalog.find(item=>item.id===unitId);
 if(!unit)return;
 selectedArmyUnitId=unitId;
 document.querySelector("#army-unit-list-section").hidden=true;
 const detail=document.querySelector("#army-unit-detail"),content=document.querySelector("#army-unit-detail-content");
 detail.hidden=false;content.replaceChildren();
 const heading=document.createElement("div");heading.className="army-detail-heading";
 const emblem=document.createElement("div");emblem.className="army-detail-emblem";applyTroopPortrait(emblem,unit.id);
 const title=document.createElement("div"),name=document.createElement("h3"),owned=document.createElement("p");
 name.textContent=unit.name;owned.textContent="Ordudaki mevcut sayın: "+armyNumber(armyState.troops[unit.id]||0);
 title.append(name,owned);heading.append(emblem,title);content.append(heading);
 const description=document.createElement("p");description.className="army-detail-description";
 description.textContent=unit.building==="barracks"?"Kışlada yetiştirilen kara birliği.":"Ahırda yetiştirilen atlı birlik.";
 content.append(description);
 const stats=document.createElement("div");stats.className="army-detail-stats";
 [["Saldırı gücü",unit.attack],["Piyade savunması",unit.infantryDefense],["Süvari savunması",unit.cavalryDefense],["Hız",unit.speed],["Taşıma kapasitesi",unit.carry]].forEach(([label,value])=>{
  const item=document.createElement("div"),strong=document.createElement("strong"),small=document.createElement("small");
  strong.textContent=String(value);small.textContent=label;item.append(strong,small);stats.append(item);
 });
 content.append(stats);
 const costTitle=document.createElement("h4");costTitle.textContent="Bir asker yetiştirme maliyeti";content.append(costTitle);
 const costs=document.createElement("p");costs.className="army-unit-cost";
 costs.textContent=Object.entries(unit.cost).map(([key,value])=>({wood:"Odun",food:"Yiyecek",iron:"Demir",gold:"Altın"}[key]+" "+armyNumber(value))).join(" · ");content.append(costs);
 const unlock=document.createElement("p");unlock.className="army-unlock";
 unlock.textContent=unit.unlocked?(unit.building==="barracks"?"Kışla seviyesi ":"Ahır seviyesi ")+unit.requiredLevel+" · Birlik yetiştirilebilir":(unit.building==="barracks"?"Kışla seviye ":"Ahır seviye ")+unit.requiredLevel+" gerekli";
 content.append(unlock);
 const controls=document.createElement("div");controls.className="army-recruit-controls army-detail-controls";
 const idleWorkers=Math.max(0,Number(armyState.idleWorkers)||0);
 const workerLimit=document.createElement("p");workerLimit.className="army-unlock";workerLimit.textContent="Boşta işçi: "+armyNumber(idleWorkers)+" · En fazla bu kadar asker yetiştirebilirsin.";content.append(workerLimit);
 const amount=document.createElement("input");amount.type="number";amount.min="1";amount.max=String(idleWorkers);amount.value=idleWorkers>0?"1":"0";amount.inputMode="numeric";amount.id="army-selected-amount";amount.setAttribute("aria-label",unit.name+" yetiştirilecek asker sayısı");
 const button=document.createElement("button");button.type="button";button.textContent=unit.unlocked?(idleWorkers>0?"Bu askeri yetiştir":"Boşta işçi yok"):"Birlik kilitli";button.disabled=!unit.unlocked||idleWorkers<1;button.dataset.recruitUnit=unit.id;button.dataset.amountInput="army-selected-amount";
 controls.append(amount,button);content.append(controls);
}
function renderArmyQueue(){
 if(!armyState)return;
 armyQueueNode.replaceChildren();
 const p=document.createElement("p");p.textContent="Yetiştirdiğin askerler beklemeden doğrudan orduna katılır.";armyQueueNode.append(p);
}
async function loadArmyState(){
 if(!authToken)return;
 try{
  armyState=await authRequest("/api/game/army",{token:authToken});
  currentArmyPopulation=Math.max(0,Number(armyState.totalUnits)||0);
  updateWorkerSummary();renderProductionDialog();
  if(armyState.resources){gameResources={...gameResources,...armyState.resources};renderResourceBalances();}
  renderArmySummary();renderArmyCatalog();renderArmyQueue();
 }catch(error){
  if(armyMessageNode)armyMessageNode.textContent=error.message||"Ordu bilgileri yüklenemedi.";
 }
}

const inventoryDialog=document.querySelector("#inventory-dialog");
const inventoryContent=document.querySelector("#inventory-content");
const inventoryMessage=document.querySelector("#inventory-message");
const INVENTORY_RESOURCE_META=[
 ["gold","Altın","🪙"],["wood","Odun","🪵"],["food","Yiyecek","🌾"],["stone","Taş","🪨"],["iron","Demir","⚒️"],["horses","At","🐎"]
];
function inventoryCard(label,value,icon,detail=""){
 const card=document.createElement("article");card.className="inventory-item";
 const emblem=document.createElement("span");emblem.className="inventory-item-icon";emblem.textContent=icon;
 const info=document.createElement("span");info.className="inventory-item-info";
 const name=document.createElement("strong");name.textContent=label;
 const amount=document.createElement("b");amount.textContent=armyNumber(value);
 info.append(name,amount);
 if(detail){const note=document.createElement("small");note.textContent=detail;info.append(note);}
 card.append(emblem,info);return card;
}
function inventorySection(title,items,emptyText){
 const section=document.createElement("section");section.className="inventory-section";
 const heading=document.createElement("h3");heading.textContent=title;section.append(heading);
 if(!items.length){const empty=document.createElement("p");empty.className="inventory-empty";empty.textContent=emptyText;section.append(empty);}
 else{const grid=document.createElement("div");grid.className="inventory-grid";items.forEach(item=>grid.append(item));section.append(grid);}
 return section;
}
function renderInventory(){
 if(!inventoryContent)return;
 inventoryContent.replaceChildren();
 const resources=INVENTORY_RESOURCE_META.map(([key,label,icon])=>inventoryCard(label,gameResources[key]||0,icon,key==="horses"?"Ordu ve sefer kaynağı":"Depodaki miktar"));
 inventoryContent.append(inventorySection("🧺 Kaynaklar",resources,"Henüz kaynak bulunmuyor."));
 const troopItems=armyState?.catalog?.map(unit=>inventoryCard(unit.name,armyState.troops?.[unit.id]||0,unit.icon,unit.unlocked?"Orduda hazır":"Kilitli birlik"))||[];
 inventoryContent.append(inventorySection("⚔️ Askerler",troopItems,"Ordu bilgisi yüklenemedi."));
 const lootNote=document.createElement("p");lootNote.className="inventory-note";
 lootNote.textContent="Savaşlardan kazanılan ganimetler, köy kaynaklarına eklendiğinde Kaynaklar bölümünde görünür. Ayrı ganimet geçmişi henüz etkin değil.";
 inventoryContent.append(inventorySection("🎁 Ganimetler",[lootNote],"Henüz ganimet kaydı bulunmuyor."));
 const specialNote=document.createElement("p");specialNote.className="inventory-note";
 specialNote.textContent="Özel eşya sistemi henüz oyuna eklenmedi. Bu bölüm yeni eşyalar açıldığında burada listelenecek.";
 inventoryContent.append(inventorySection("💎 Özel Eşyalar",[specialNote],"Henüz özel eşya bulunmuyor."));
 const totalTroops=Number(armyState?.totalUnits)||0;
 const summary=[
  inventoryCard("Toplam asker",totalTroops,"🛡️"),
  inventoryCard("Depo kapasitesi",gameStorageCapacity,"🏚️"),
  inventoryCard("Serbest işçi",Math.max(0,currentWorkerPool-totalAssigned()),"👷"),
  inventoryCard("Saatlik yiyecek üretimi",gameProductionPerHour.food||0,"🌾","Saatlik")
 ];
 const buildingLevel=Object.values(gameBuildings).reduce((sum,item)=>sum+(Number(item.level)||0),0);
 summary.push(inventoryCard("Toplam bina seviyesi",buildingLevel,"🏰"));
 inventoryContent.append(inventorySection("📊 Genel Durum",summary,"Genel durum bilgisi hazırlanıyor."));
}
async function openInventoryDialog(){
 if(!authToken)return;
 inventoryMessage.textContent="Envanter bilgileri yenileniyor…";
 if(!inventoryDialog.open)inventoryDialog.showModal();
 try{
  await loadGameState();
  await loadArmyState();
  renderInventory();
  inventoryMessage.textContent="Envanterin güncel oyun verilerinden yüklendi.";
 }catch(error){inventoryMessage.textContent=error.message||"Envanter bilgileri yüklenemedi.";}
}
document.querySelector('[data-action="inventory"]')?.addEventListener("click",openInventoryDialog);
document.querySelector("#inventory-close")?.addEventListener("click",()=>inventoryDialog.close());
inventoryDialog?.addEventListener("click",event=>{if(event.target===inventoryDialog)inventoryDialog.close();});


const questsDialog=document.querySelector("#quests-dialog");
const questsContent=document.querySelector("#quests-content");
const questsMessage=document.querySelector("#quests-message");
function renderQuests(quests,achievements=[]){
 questsContent.replaceChildren();
 const completed=quests.filter(q=>q.completed).length;
 const summary=document.createElement("div");summary.className="quests-summary";
 const summaryText=document.createElement("strong");summaryText.textContent=completed+" / "+quests.length+" görev tamamlandı";
 const summaryTrack=document.createElement("div");summaryTrack.className="quests-summary-track";
 const summaryFill=document.createElement("span");summaryFill.style.width=(quests.length?completed/quests.length*100:0)+"%";
 summaryTrack.append(summaryFill);summary.append(summaryText,summaryTrack);questsContent.append(summary);
 for(const quest of quests){
  const card=document.createElement("article");card.className="quest-card"+(quest.claimed?" is-claimed":quest.completed?" is-completed":"");
  const head=document.createElement("div");head.className="quest-card-head";
  const title=document.createElement("strong");title.textContent=quest.title;
  const status=document.createElement("span");status.className="quest-status";status.textContent=quest.claimed?"Ödül alındı":quest.completed?"Tamamlandı":"Devam ediyor";
  head.append(title,status);
  const description=document.createElement("p");description.textContent=quest.description;
  const progress=document.createElement("div");progress.className="quest-progress";
  const fill=document.createElement("span");fill.style.width=(quest.target?Math.max(0,Math.min(100,quest.progress/quest.target*100)):0)+"%";progress.append(fill);
  const values=document.createElement("small");values.className="quest-progress-label";values.textContent=formatNumber(quest.progress)+" / "+formatNumber(quest.target);
  const reward=document.createElement("div");reward.className="quest-reward";
  reward.textContent="Ödül: "+Object.entries(quest.reward).map(([key,value])=>({gold:"🪙 Altın",wood:"🪵 Odun",food:"🌾 Yiyecek",stone:"🪨 Taş",iron:"⚒️ Demir"}[key]+" "+formatNumber(value))).join(" · ");
  card.append(head,description,progress,values,reward);
  if(quest.completed&&!quest.claimed){
   const claim=document.createElement("button");claim.type="button";claim.className="quest-claim";claim.textContent="Ödülü Topla";claim.dataset.questId=quest.id;card.append(claim);
  }
  questsContent.append(card);
 }
 const achievementHeading=document.createElement("h3");achievementHeading.className="achievement-heading";achievementHeading.textContent="🏅 Başarımlar";questsContent.append(achievementHeading);
 for(const achievement of achievements){
  const card=document.createElement("article");card.className="achievement-card"+(achievement.unlocked?" is-unlocked":"");
  const emblem=document.createElement("span");emblem.className="achievement-emblem";emblem.textContent=achievement.unlocked?"🏅":"🔒";
  const details=document.createElement("span");details.className="achievement-details";
  const title=document.createElement("strong");title.textContent=achievement.title;
  const description=document.createElement("small");description.textContent=achievement.description;
  const status=document.createElement("small");status.className="achievement-status";status.textContent=achievement.unlocked?"Kazanıldı":"Henüz açılmadı";
  details.append(title,description,status);card.append(emblem,details);questsContent.append(card);
 }
}
async function loadQuests(){
 const result=await authRequest("/api/game/quests",{token:authToken});
 renderQuests(result.quests||[],result.achievements||[]);
 return result.quests||[];
}
async function openQuestsDialog(){
 if(!authToken)return;
 questsMessage.textContent="Görev ilerlemesi yenileniyor…";
 if(!questsDialog.open)questsDialog.showModal();
 try{await loadQuests();questsMessage.textContent="Görevlerin güncel oyun durumuna göre hesaplandı.";}
 catch(error){questsMessage.textContent=error.message||"Görevler yüklenemedi.";}
}
document.querySelector("#open-quests")?.addEventListener("click",openQuestsDialog);
document.querySelector("#quests-close")?.addEventListener("click",()=>questsDialog.close());
questsDialog?.addEventListener("click",event=>{if(event.target===questsDialog)questsDialog.close();});
questsContent?.addEventListener("click",async event=>{
 const button=event.target.closest("[data-quest-id]");
 if(!button||button.disabled)return;
 button.disabled=true;questsMessage.textContent="Ödül doğrulanıyor…";
 try{
  const result=await authRequest("/api/game/quests",{method:"POST",token:authToken,body:{questId:button.dataset.questId}});
  gameResources={...gameResources,...result.resources};renderResourceBalances();
  await loadQuests();questsMessage.textContent="Ödül hesabına eklendi!";
 }catch(error){questsMessage.textContent=error.message||"Ödül alınamadı.";button.disabled=false;}
});


const marketDialog=document.querySelector("#market-dialog");
const marketResource=document.querySelector("#market-resource");
const marketAmount=document.querySelector("#market-amount");
const marketMessage=document.querySelector("#market-message");
const marketBalances=document.querySelector("#market-balances");
const marketBuyButton=document.querySelector("#market-buy");
const marketSellButton=document.querySelector("#market-sell");
function renderMarket(){
 const level=Math.max(1,Number(gameBuildings["8"]?.level)||1);
 document.querySelector("#market-level").textContent=level+" / 10";
 document.querySelector("#market-capacity").textContent=formatNumber(level*1000)+" birim / işlem";
 marketBalances.replaceChildren();
 for(const [key,label,icon] of [["gold","Altın","🪙"],["wood","Odun","🪵"],["food","Yiyecek","🌾"],["stone","Taş","🪨"],["iron","Demir","⚒️"]]){
  const item=document.createElement("div");item.className="market-balance";
  const name=document.createElement("span");name.textContent=icon+" "+label;
  const value=document.createElement("b");value.textContent=formatNumber(gameResources[key]||0);
  item.append(name,value);marketBalances.append(item);
 }
}
async function openMarketDialog(){
 if(!authToken)return;
 buildingDialog.close();
 marketMessage.textContent="Pazar bilgileri yenileniyor…";
 marketDialog.showModal();
 await loadGameState();
 renderMarket();
 marketMessage.textContent="100 birim kaynak satışı 50 altın kazandırır; 100 birim alış 65 altına mal olur.";
}
async function executeMarketTrade(side){
 const amount=Number(marketAmount.value),resource=marketResource.value;
 if(!Number.isSafeInteger(amount)||amount<100||amount%100!==0){marketMessage.textContent="Miktar 100 ve katları olmalıdır.";return;}
 const button=side==="buy"?marketBuyButton:marketSellButton;
 marketBuyButton.disabled=true;marketSellButton.disabled=true;
 marketMessage.textContent="Pazar işlemi gerçekleştiriliyor…";
 try{
  const result=await authRequest("/api/game/market",{method:"POST",token:authToken,body:{side,resource,amount}});
  gameResources={...gameResources,...result.resources};renderResourceBalances();renderMarket();
  marketMessage.textContent=(side==="buy"?"Satın alma":"Satış")+" tamamlandı. "+formatNumber(amount)+" birim işlem yapıldı. Altın değişimi: "+(result.goldChange>0?"+":"")+formatNumber(result.goldChange)+".";
 }catch(error){marketMessage.textContent=error.message||"Pazar işlemi tamamlanamadı.";if(error.resources){gameResources={...gameResources,...error.resources};renderResourceBalances();renderMarket();}}
 finally{marketBuyButton.disabled=false;marketSellButton.disabled=false;}
}
marketLaunchButton?.addEventListener("click",openMarketDialog);
document.querySelector("#market-close")?.addEventListener("click",()=>marketDialog.close());
marketDialog?.addEventListener("click",event=>{if(event.target===marketDialog)marketDialog.close();});
marketBuyButton?.addEventListener("click",()=>executeMarketTrade("buy"));
marketSellButton?.addEventListener("click",()=>executeMarketTrade("sell"));

async function openArmyDialog(){
 if(!authToken)return;
 armyMessageNode.textContent="Ordu bilgileri yükleniyor…";
 showArmyUnitList();
 armyDialog.showModal();
 await loadArmyState();
 if(armyRefreshTimer)clearInterval(armyRefreshTimer);
 armyRefreshTimer=setInterval(()=>{if(armyDialog.open)loadArmyState();},5000);
}
document.querySelector('[data-action="army"]').addEventListener("click",openArmyDialog);
document.querySelector("#army-close").addEventListener("click",()=>{armyDialog.close();if(armyRefreshTimer)clearInterval(armyRefreshTimer);});
armyDialog.addEventListener("click",event=>{if(event.target===armyDialog)armyDialog.close();});
const battleReportsDialog=document.querySelector("#battle-reports-dialog");
const battleReportsList=document.querySelector("#battle-reports-list");
const battleReportsMessage=document.querySelector("#battle-reports-message");
function reportNumber(value){return new Intl.NumberFormat("tr-TR").format(Number(value)||0);}
function renderBattleReports(attacks){
 battleReportsList.replaceChildren();
 const completed=attacks.filter(raid=>raid.battle_report&&["resolved","returned"].includes(raid.status));
 if(!completed.length){
  battleReportsList.append(Object.assign(document.createElement("p"),{textContent:"Henüz tamamlanmış bir savaş raporun yok. Saldırı veya savunma yaptığında raporların burada görünecek."}));
  return;
 }
 const unitMeta={
  scout:["Casus","🕵️"],infantry:["Piyade","🗡️"],archer:["Okçu","🏹"],shield:["Kalkanlı","🛡️"],
  guard:["Muhafız","⚔️"],light_cavalry:["Hafif Süvari","🐎"],mounted_archer:["Atlı Okçu","🎯"],heavy_cavalry:["Ağır Süvari","🐴"]
 };
 const number=value=>reportNumber(Number(value||0));
 const makeUnits=(side,report,raid)=>{
  if(Array.isArray(report[side+"Units"]))return report[side+"Units"];
  const losses=report[side+"Losses"]||{},survivors=report[side+"Survivors"]||{};
  const original=side==="attacker"?(raid.troops||{}):{};
  const ids=new Set([...Object.keys(losses),...Object.keys(survivors),...Object.keys(original)]);
  return [...ids].map(id=>({id,name:unitMeta[id]?.[0]||id,icon:unitMeta[id]?.[1]||"⚔️",
   sent:Number(original[id]??(Number(losses[id]||0)+Number(survivors[id]||0))),
   lost:Number(losses[id]||0),survivors:Number(survivors[id]||0)})).filter(unit=>unit.sent>0);
 };
 const appendSide=(card,{label,name,power,units,tone})=>{
  const panel=document.createElement("section");panel.className="battle-report-side "+tone;
  const top=document.createElement("div");top.className="battle-report-side-head";
  const sideName=document.createElement("strong");sideName.textContent=label+"  ";
  const player=document.createElement("span");player.textContent=name||"Bilinmeyen köy";
  top.append(sideName,player);panel.append(top);
  const powerLine=document.createElement("div");powerLine.className="battle-report-power";
  powerLine.textContent=(tone==="attacker"?"Saldırı Gücü ":"Savunma Gücü ")+number(power);
  panel.append(powerLine);
  const grid=document.createElement("div");grid.className="battle-report-units";
  if(!units.length){const empty=document.createElement("small");empty.className="battle-report-empty";empty.textContent="Bu tarafta asker bulunmuyordu.";grid.append(empty);}
  units.forEach(unit=>{
   const tile=document.createElement("div");tile.className="battle-report-unit";
   const portrait=document.createElement("div");portrait.className="battle-report-unit-portrait";applyTroopPortrait(portrait,unit.id);
   const unitName=document.createElement("strong");unitName.textContent=unit.name||unitMeta[unit.id]?.[0]||unit.id;
   const sent=document.createElement("small");sent.textContent="Gönderilen "+number(unit.sent);
   const lost=document.createElement("small");lost.className="battle-report-unit-lost";lost.textContent="Ölen "+number(unit.lost);
   tile.append(portrait,unitName,sent,lost);grid.append(tile);
  });
  panel.append(grid);card.append(panel);
 };
 completed.forEach(raid=>{
  const report=raid.battle_report;
  const card=document.createElement("article");card.className="battle-report-card battle-report-showcase"+(raid.neutralRegion?" territory":"");
  const heading=document.createElement("div");heading.className="battle-report-heading";
  const title=document.createElement("strong");title.textContent=raid.neutralRegion
   ? (raid.battle_type==="guard_challenge"?"Tarafsız köy savaşı":"Bölge savaşı")
   : (raid.direction==="outgoing"?"Saldırı":"Savunma");
  const outcome=document.createElement("span");outcome.className="battle-report-outcome";
  const winningSide=report.winner==="attacker"?"attacker":"defender";
  outcome.textContent=winningSide==="attacker"?"SALDIRI ZAFERİ":"SAVUNMA ZAFERİ";
  heading.append(title,outcome);card.append(heading);
  const date=document.createElement("small");date.className="battle-report-date";
  date.textContent=new Date(report.resolvedAt||raid.arrives_at).toLocaleString("tr-TR");card.append(date);
  appendSide(card,{label:"SALDIRAN",name:raid.attacker_village||report.attackerVillage,power:report.attackerPower,units:makeUnits("attacker",report,raid),tone:"attacker"});
  appendSide(card,{label:"SAVUNAN",name:raid.defender_village||report.defenderVillage,power:report.defenderPower,units:makeUnits("defender",report,raid),tone:"defender"});
  if(report.outcomeText){const detail=document.createElement("p");detail.className="battle-report-result-text";detail.textContent=report.outcomeText;card.append(detail);}
  if(raid.direction==="outgoing"&&raid.loot){
   const loot=Object.entries(raid.loot).filter(([,count])=>Number(count)>0);
   if(loot.length){const lootLine=document.createElement("small");lootLine.className="battle-report-loot";lootLine.textContent="🏆 Ganimet: "+loot.map(([key,count])=>key+" "+number(count)).join(" · ");card.append(lootLine);}
  }
  battleReportsList.append(card);
 });
}
async function openBattleReports(){
 if(!authToken)return;
 await loadWorldPlayers();
 battleReportsMessage.textContent="Savaş kayıtların getiriliyor…";
 battleReportsList.replaceChildren(Object.assign(document.createElement("p"),{textContent:"Raporlar yükleniyor…"}));
 battleReportsDialog.showModal();
 try{
  const [playerData,regionData]=await Promise.all([
   authRequest("/api/game/attacks",{token:authToken}),
   authRequest("/api/game/neutral-regions/reports",{token:authToken})
  ]);
  const regionReports=(regionData.reports||[]).map(item=>{
   const report=item.battle_report||{};
   return {
    id:"region-"+item.id,direction:item.direction,
    attacker_village:item.direction==="outgoing"?"Senin ordun":item.actor_village,
    defender_village:item.direction==="outgoing"?(item.opponent_village||item.region_name):"Senin bölgen",
    arrives_at:item.created_at,status:"resolved",neutralRegion:true,region_name:item.region_name,
    battle_type:item.battle_type,
    battle_report:{
     ...report,
     attackerLostCount:report.attackerLosses||0,
     defenderLostCount:report.defenderLosses||0,
     outcomeText:report.outcomeText||"Bölge savaşı tamamlandı."
    }
   };
  });
  const allReports=[...(playerData.attacks||[]),...regionReports].sort((a,b)=>Date.parse(b.arrives_at)-Date.parse(a.arrives_at));
  renderBattleReports(allReports);
  battleReportsMessage.textContent=allReports.filter(raid=>raid.battle_report).length+" savaş kaydı bulundu.";
 }catch(error){
  battleReportsList.replaceChildren(Object.assign(document.createElement("p"),{textContent:error.message||"Savaş raporları yüklenemedi."}));
  battleReportsMessage.textContent="Bağlantını kontrol edip yeniden dene.";
 }
}

const incomingAttacksDialog=document.querySelector("#incoming-attacks-dialog");
const outgoingAttacksDialog=document.querySelector("#outgoing-attacks-dialog");
function attackTimeLabel(raid){
 const now=Date.now(),arrival=Date.parse(raid.arrives_at)-now,returning=raid.return_at?Date.parse(raid.return_at)-now:0;
 if(raid.status==="marching")return arrival>0?"Hedefe varış: yaklaşık "+Math.ceil(arrival/60000)+" dk":"Hedefe ulaştı · savaş sonucu bekleniyor";
 if(raid.status==="resolved")return returning>0?"Savaş tamamlandı · dönüş: yaklaşık "+Math.ceil(returning/60000)+" dk":"Savaş tamamlandı · dönüş sürecinde";
 return "Sefer tamamlandı · ordu köye döndü";
}
function attackDetailCard(raid,direction){
 const outgoing=direction==="outgoing",card=document.createElement("article");card.className="attack-detail-card";
 const heading=document.createElement("div");heading.className="attack-detail-heading";
 const title=document.createElement("strong");title.textContent=(outgoing?"⚔️ Hedef: ":"🛡️ Saldıran: ")+(outgoing?(raid.defender_village||"Rakip köy"):(raid.attacker_village||"Bilinmeyen oyuncu"));
 const status=document.createElement("span");status.className="attack-status";status.textContent=raid.status==="marching"?"Yolda":raid.status==="resolved"?"Savaş bitti":"Tamamlandı";heading.append(title,status);card.append(heading);
 const timing=document.createElement("p");timing.className="attack-detail-timing";timing.textContent=attackTimeLabel(raid);card.append(timing);
 const dates=document.createElement("div");dates.className="attack-detail-meta";
 if(raid.departed_at){const x=document.createElement("small");x.textContent="Çıkış: "+new Date(raid.departed_at).toLocaleString("tr-TR");dates.append(x);}
 if(raid.arrives_at){const x=document.createElement("small");x.textContent="Varış: "+new Date(raid.arrives_at).toLocaleString("tr-TR");dates.append(x);}
 if(raid.return_at){const x=document.createElement("small");x.textContent="Dönüş: "+new Date(raid.return_at).toLocaleString("tr-TR");dates.append(x);}
 if(dates.children.length)card.append(dates);
 if(raid.battle_report){
  const report=raid.battle_report,grid=document.createElement("div");grid.className="attack-detail-stats";
  const ownLoss=outgoing?report.attackerLostCount:report.defenderLostCount,enemyLoss=outgoing?report.defenderLostCount:report.attackerLostCount;
  [["Senin asker kaybın",ownLoss],["Rakip asker kaybı",enemyLoss],["Savunma gücü",report.defenderPower],["Sur azaltması",String(report.wallDefensePercent||0)+"%"]].forEach(([label,value])=>{const cell=document.createElement("div"),v=document.createElement("strong"),l=document.createElement("small");v.textContent=typeof value==="string"&&value.endsWith("%")?value:reportNumber(value??0);l.textContent=label;cell.append(v,l);grid.append(cell);});
  card.append(grid);
  const ownBreakdown=outgoing?report.attackerLosses:report.defenderLosses,enemyBreakdown=outgoing?report.defenderLosses:report.attackerLosses;
  const format=losses=>Object.entries(losses||{}).filter(([,n])=>Number(n)>0).map(([id,n])=>id+": "+reportNumber(n)).join(" · ")||"Kayıp yok";
  const losses=document.createElement("p");losses.className="attack-detail-copy";losses.textContent="Senin kayıpların: "+format(ownBreakdown)+" | Rakip kayıpları: "+format(enemyBreakdown);card.append(losses);
  if(report.outcomeText){const outcome=document.createElement("p");outcome.className="attack-detail-copy";outcome.textContent=report.outcomeText;card.append(outcome);}
  if(outgoing&&raid.loot){const loot=Object.entries(raid.loot).filter(([,n])=>Number(n)>0).map(([key,n])=>key+": "+reportNumber(n));if(loot.length){const lootLine=document.createElement("p");lootLine.className="attack-detail-loot";lootLine.textContent="🏆 Ganimet: "+loot.join(" · ");card.append(lootLine);}}
 }else{
  const waiting=document.createElement("p");waiting.className="attack-detail-copy";waiting.textContent=raid.status==="marching"?"Savaş sonucu henüz oluşmadı. Ordu hedefe ulaştığında sonuç burada gösterilecek.":"Bu sefer için ayrıntılı savaş raporu bulunmuyor.";card.append(waiting);
 }
 return card;
}
let attackListRefreshTimer=null;
let attackListRefreshDirection=null;
async function refreshAttackList(direction){
 const dialog=direction==="incoming"?incomingAttacksDialog:outgoingAttacksDialog;
 if(!dialog.open||!authToken)return;
 const list=document.querySelector("#"+direction+"-attacks-list"),message=document.querySelector("#"+direction+"-attacks-message");
 try{
  const data=await authRequest("/api/game/attacks",{token:authToken});
  const raids=(data.attacks||[]).filter(raid=>raid.direction===direction).sort((a,b)=>Date.parse(b.departed_at||b.arrives_at)-Date.parse(a.departed_at||a.arrives_at));
  list.replaceChildren();
  if(!raids.length){list.append(Object.assign(document.createElement("p"),{textContent:direction==="incoming"?"Köyüne gelen saldırı bulunmuyor.":"Henüz bir saldırı göndermedin."}));}
  else raids.forEach(raid=>list.append(attackDetailCard(raid,direction)));
  message.textContent=raids.length+" kayıt bulundu.";
 }catch(error){
  if(!list.children.length)list.replaceChildren(Object.assign(document.createElement("p"),{textContent:error.message||"Saldırı kayıtları yüklenemedi."}));
  message.textContent="Güncelleme yapılamadı; yeniden denenecek.";
 }
}
function stopAttackListRefresh(){
 if(attackListRefreshTimer)clearInterval(attackListRefreshTimer);
 attackListRefreshTimer=null;
 attackListRefreshDirection=null;
}
async function openAttackList(direction){
 if(!authToken)return;
 const dialog=direction==="incoming"?incomingAttacksDialog:outgoingAttacksDialog;
 const list=document.querySelector("#"+direction+"-attacks-list"),message=document.querySelector("#"+direction+"-attacks-message");
 stopAttackListRefresh();
 list.replaceChildren(Object.assign(document.createElement("p"),{textContent:"Saldırı kayıtları yükleniyor…"}));message.textContent="";
 dialog.showModal();
 attackListRefreshDirection=direction;
 await refreshAttackList(direction);
 attackListRefreshTimer=setInterval(()=>{
  if(attackListRefreshDirection===direction)void refreshAttackList(direction);
 },5000);
}
document.querySelector('[data-action="incoming-attacks"]').addEventListener("click",()=>openAttackList("incoming"));
document.querySelector('[data-action="outgoing-attacks"]').addEventListener("click",()=>openAttackList("outgoing"));
document.querySelectorAll("[data-close-attack-list]").forEach(button=>button.addEventListener("click",()=>{(button.dataset.closeAttackList==="incoming"?incomingAttacksDialog:outgoingAttacksDialog).close();stopAttackListRefresh();}));
incomingAttacksDialog.addEventListener("close",stopAttackListRefresh);
outgoingAttacksDialog.addEventListener("close",stopAttackListRefresh);

document.querySelector('[data-action="battle-reports"]').addEventListener("click",openBattleReports);
document.querySelector("#battle-reports-close").addEventListener("click",()=>battleReportsDialog.close());
battleReportsDialog.addEventListener("click",event=>{if(event.target===battleReportsDialog)battleReportsDialog.close();});

armyCatalogNode.addEventListener("click",event=>{
 const button=event.target.closest("[data-select-unit]");
 if(button)renderArmyUnitDetail(button.dataset.selectUnit);
});
document.querySelector("#army-unit-back").addEventListener("click",showArmyUnitList);
document.querySelector("#army-units").addEventListener("click",event=>{
 const button=event.target.closest("[data-open-unit]");
 if(!button)return;
 if(!armyDialog.open)armyDialog.showModal();
 loadArmyState().then(()=>renderArmyUnitDetail(button.dataset.openUnit));
});
document.querySelector("#army-unit-detail").addEventListener("click",async event=>{
 const button=event.target.closest("[data-recruit-unit]");
 if(!button)return;
 const amount=Number(document.querySelector("#"+button.dataset.amountInput).value);
 const idleWorkers=Math.max(0,Number(armyState?.idleWorkers)||0);
  if(!Number.isSafeInteger(amount)||amount<1||amount>idleWorkers){armyMessageNode.textContent="En fazla "+armyNumber(idleWorkers)+" boşta işçin kadar asker yetiştirebilirsin.";return;}
 button.disabled=true;armyMessageNode.textContent="Askerler orduya katılıyor…";
 try{
  const result=await authRequest("/api/game/army/recruit",{method:"POST",token:authToken,body:{unitId:button.dataset.recruitUnit,amount}});
  armyState=result;currentArmyPopulation=Math.max(0,Number(result.totalUnits)||0);updateWorkerSummary();renderProductionDialog();
  gameResources={...gameResources,...result.resources};renderResourceBalances();
  renderArmySummary();renderArmyCatalog();renderArmyQueue();
  if(selectedArmyUnitId)renderArmyUnitDetail(selectedArmyUnitId);
  armyMessageNode.textContent=amount+" asker anında orduna katıldı. "+armyNumber(result.idleWorkers)+" işçi boşta kaldı. Kaynaklar hesabından düşüldü.";
 }catch(error){armyMessageNode.textContent=error.message||"Asker yetiştirme başlatılamadı.";button.disabled=false;}
});

const worldPlayerList=document.querySelector("#world-player-list");
const activeRaidsList=document.querySelector("#active-raids-list");
const attackDialog=document.querySelector("#attack-dialog");
const attackUnitList=document.querySelector("#attack-unit-list");
const attackMessage=document.querySelector("#attack-message");
const attackTargetName=document.querySelector("#attack-target-name");

const neutralRegionDialog=document.querySelector("#neutral-region-dialog");
const neutralRegionTitle=document.querySelector("#neutral-region-title");
const neutralGuardCount=document.querySelector("#neutral-guard-count");
const neutralGarrisonCount=document.querySelector("#neutral-garrison-count");
const neutralRegionOwner=document.querySelector("#neutral-region-owner");
const neutralRegionCountdown=document.querySelector("#neutral-region-countdown");
const neutralRegionUnitList=document.querySelector("#neutral-region-unit-list");
const neutralRegionTroopSection=document.querySelector("#neutral-region-troop-section");
const neutralRegionMessage=document.querySelector("#neutral-region-message");
const neutralRegionAction=document.querySelector("#neutral-region-action");
let selectedNeutralRegion=null,neutralRegionMode="garrison",neutralRegionTimer=null;

const mapWorldCanvas=document.querySelector("#map-world-canvas");
const mapViewport=document.querySelector(".world-map");
let mapZoom=0.55;
const MAP_ZOOM_MIN=0.55,MAP_ZOOM_MAX=1.6,MAP_ZOOM_STEP=0.15;
function applyMapZoom(nextZoom,preserveCenter=true,focalPoint=null){
 if(!mapWorldCanvas||!mapViewport)return;
 const mobile=window.matchMedia("(max-width: 420px)").matches;
 const baseWidth=mobile?1800:2160,baseHeight=mobile?1200:1440;
 const anchorX=focalPoint?focalPoint.x:mapViewport.clientWidth/2;
 const anchorY=focalPoint?focalPoint.y:mapViewport.clientHeight/2;
 const worldX=(mapViewport.scrollLeft+anchorX)/(baseWidth*mapZoom);
 const worldY=(mapViewport.scrollTop+anchorY)/(baseHeight*mapZoom);
 mapZoom=Math.max(MAP_ZOOM_MIN,Math.min(MAP_ZOOM_MAX,Math.round(nextZoom*100)/100));
 // CSS zoom scales the complete map scene, including every marker, label and SVG overlay.
 mapWorldCanvas.style.width=baseWidth+"px";
 mapWorldCanvas.style.height=baseHeight+"px";
 mapWorldCanvas.style.zoom=String(mapZoom);
 const label=document.querySelector("#map-zoom-level");
 if(label)label.textContent=Math.round(mapZoom*100)+"%";
 if(preserveCenter){
  requestAnimationFrame(()=>{
   mapViewport.scrollLeft=Math.max(0,worldX*baseWidth*mapZoom-anchorX);
   mapViewport.scrollTop=Math.max(0,worldY*baseHeight*mapZoom-anchorY);
  });
 }
}
document.querySelector("#map-zoom-in")?.addEventListener("click",()=>applyMapZoom(mapZoom+MAP_ZOOM_STEP));
document.querySelector("#map-zoom-out")?.addEventListener("click",()=>applyMapZoom(mapZoom-MAP_ZOOM_STEP));
document.querySelector("#map-zoom-reset")?.addEventListener("click",()=>{
 applyMapZoom(0.55,false);
 if(mapViewport&&mapWorldCanvas){
  const own=mapWorldCanvas.querySelector(".map-own-city");
  const x=own?parseFloat(own.style.left||"50"):50,y=own?parseFloat(own.style.top||"50"):50;
  requestAnimationFrame(()=>{
   mapViewport.scrollLeft=Math.max(0,x/100*mapWorldCanvas.clientWidth*mapZoom-mapViewport.clientWidth/2);
   mapViewport.scrollTop=Math.max(0,y/100*mapWorldCanvas.clientHeight*mapZoom-mapViewport.clientHeight/2);
  });
 }
});
// Touch navigation: one finger pans natively; two fingers pinch-zoom around their midpoint.
if(mapViewport){
 const activeTouches=new Map();
 let pinchStartDistance=0,pinchStartZoom=mapZoom;
 const touchDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const touchMidpoint=(a,b)=>({x:(a.x+b.x)/2-mapViewport.getBoundingClientRect().left,y:(a.y+b.y)/2-mapViewport.getBoundingClientRect().top});
 mapViewport.addEventListener("pointerdown",event=>{
  if(event.pointerType!=="touch")return;
  activeTouches.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(activeTouches.size===2){
   const points=[...activeTouches.values()];
   pinchStartDistance=Math.max(1,touchDistance(points[0],points[1]));
   pinchStartZoom=mapZoom;
  }
 });
 mapViewport.addEventListener("pointermove",event=>{
  if(event.pointerType!=="touch"||!activeTouches.has(event.pointerId))return;
  activeTouches.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(activeTouches.size<2)return;
  const points=[...activeTouches.values()].slice(0,2);
  const distance=touchDistance(points[0],points[1]);
  const midpoint=touchMidpoint(points[0],points[1]);
  applyMapZoom(pinchStartZoom*(distance/pinchStartDistance),true,midpoint);
  event.preventDefault();
 },{passive:false});
 const finishTouch=event=>{
  if(event.pointerType!=="touch")return;
  activeTouches.delete(event.pointerId);
  if(activeTouches.size<2){pinchStartDistance=0;pinchStartZoom=mapZoom;}
 };
 mapViewport.addEventListener("pointerup",finishTouch);
 mapViewport.addEventListener("pointercancel",finishTouch);
}
window.addEventListener("resize",()=>applyMapZoom(mapZoom,false));
applyMapZoom(mapZoom,false);


function neutralClaimIsActive(region){
 return Boolean(region?.claimed_by_player_id&&region.claim_expires_at&&!region.claim_expired&&Date.parse(region.claim_expires_at)>Date.now());
}
function renderNeutralRegionCountdown(){
 if(!selectedNeutralRegion||!neutralRegionCountdown)return;
 if(!neutralClaimIsActive(selectedNeutralRegion)){
  neutralRegionCountdown.textContent=selectedNeutralRegion.owner_faction_id?"Bölge kalıcı olarak fethedilmiş.":"İlk garnizon dört saatlik mücadeleyi başlatır.";
  return;
 }
 const left=Math.max(0,Date.parse(selectedNeutralRegion.claim_expires_at)-Date.now());
 const seconds=Math.floor(left/1000),hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),rest=seconds%60;
 neutralRegionCountdown.textContent="Hâkimiyet süresinin bitmesine: "+hours+" sa "+minutes+" dk "+rest+" sn";
}
function fillNeutralTroopChoices(){
 neutralRegionUnitList.replaceChildren();
 if(!armyState)return;
 armyState.catalog.forEach(unit=>{
  const owned=Number(armyState.troops?.[unit.id]||0);if(owned<=0)return;
  const label=document.createElement("label");label.className="attack-unit-row";
  const name=document.createElement("span");name.textContent=unit.icon+" "+unit.name+" · Mevcut "+armyNumber(owned);
  const input=document.createElement("input");input.type="number";input.min="0";input.max=String(owned);input.value="0";input.dataset.neutralUnit=unit.id;input.setAttribute("aria-label",unit.name+" gönderilecek sayısı");
  label.append(name,input);neutralRegionUnitList.append(label);
 });
}
function renderNeutralRegionDialog(region){
 selectedNeutralRegion=region;
 neutralRegionTitle.textContent=region.region_name||"Tarafsız Bölge";
 const guards=Object.values(region.guard_troops||{}).reduce((sum,value)=>sum+Number(value||0),0);
 neutralGuardCount.textContent=armyNumber(guards);
 neutralGarrisonCount.textContent=armyNumber(region.garrison_count||0)+" / 100.000";
 const factionNames={gokturk:"Göktürk",hun:"Hun",seljuk:"Selçuklu"};
 const owned=Boolean(region.owner_faction_id);
 const active=neutralClaimIsActive(region);
 const mine=active&&region.claimed_by_player_id===currentPlayer?.id;
 const rival=active&&!mine;
 neutralRegionOwner.textContent=owned
  ?(factionNames[region.owner_faction_id]||"Bir devlet")+" hâkimiyetinde · "+(region.owner_player_id===currentPlayer?.id?"Senin bölgen":"Fethedilmiş bölge")
  :mine?"Geçici hâkimiyet sende · Muhafızları yenerek kalıcı fetih yap."
  :rival?"Geçici hâkimiyet: başka bir oyuncuda · Rakip devletler saldırabilir."
  :"Tarafsız toprak · İlk garnizon dört saatlik mücadeleyi başlatır.";
 neutralRegionMode=owned?"owned":mine?"reinforce":rival?"attack":"garrison";
 neutralRegionTroopSection.hidden=owned;
 fillNeutralTroopChoices();
 neutralRegionAction.hidden=owned;
 neutralRegionAction.disabled=false;
 neutralRegionAction.textContent=mine?"➕ Garnizona asker takviyesi":rival?"⚔️ Rakip garnizona saldır":"🏕️ İlk garnizonu kur · 4 saat başlat";
 const challengeButton=document.querySelector("#neutral-region-challenge");
 challengeButton.hidden=!mine;
 challengeButton.disabled=false;
 neutralRegionMessage.textContent=owned?"Bu bölge şu anda fethedilmiş durumda.":mine?"Garnizonuna yeni asker gönderebilir veya mevcut garnizonla muhafızlara saldırabilirsin.":rival?"Göndereceğin ordu, muhafızlar ve mevcut garnizona karşı savaşacak.":"İlk gönderdiğin birlikler garnizon olur. Dört saat içinde muhafızları yenmelisin.";
 renderNeutralRegionCountdown();
}
async function openNeutralRegionDialog(region){
 try{
  if(!armyState)await loadArmyState();
  const latest=(window.__umaykutNeutralRegions||[]).find(item=>String(item.id)===String(region.id))||region;
  renderNeutralRegionDialog(latest);
  if(neutralRegionTimer)clearInterval(neutralRegionTimer);
  neutralRegionTimer=setInterval(renderNeutralRegionCountdown,1000);
  neutralRegionDialog.showModal();
 }catch(error){window.alert(error.message||"Bölge bilgileri yüklenemedi.");}
}

let selectedAttackTarget=null;
let cachedWorldPlayers=[];
function renderWorldMap(data){
 if(!mapWorldCanvas)return;
 cachedWorldPlayers=Array.isArray(data.players)?data.players:[];
 const world=data.world||{world_x:50,world_y:50};
 const ownX=Math.max(0,Math.min(100,Number(world.world_x)||50));
 const ownY=Math.max(0,Math.min(100,Number(world.world_y)||50));
 const ownCity=mapWorldCanvas.querySelector(".map-own-city");
 if(ownCity){ownCity.style.left=ownX+"%";ownCity.style.top=ownY+"%";}
 const overlay=mapWorldCanvas.querySelector(".map-geography-overlay");
 if(overlay){
  overlay.querySelectorAll(".mining-range-ring").forEach(ring=>ring.remove());
  const schoolLevel=Math.max(1,Math.min(5,Number(gameBuildings["5"]?.level)||1));
  const miningRange=2+(schoolLevel-1)*2;
  const ring=document.createElementNS("http://www.w3.org/2000/svg","circle");
  ring.setAttribute("class","mining-range-ring");
  ring.setAttribute("cx",String(ownX*18));ring.setAttribute("cy",String(ownY*12));
  ring.setAttribute("r",String(miningRange*18));
  ring.setAttribute("data-school-level",String(schoolLevel));
  overlay.append(ring);
 }
 mapWorldCanvas.querySelectorAll(".dynamic-world-marker").forEach(marker=>marker.remove());
 const mineTypes={
  stone:{asset:"stone.svg",name:"Taş Ocağı"},
  wood:{asset:"wood.svg",name:"Odun Deposu"},
  iron:{asset:"iron.svg",name:"Demir Madeni"},
  gold:{asset:"gold.svg",name:"Altın Yatağı"},
  grain:{asset:"grain.svg",name:"Tahıl Tarlası"}
 };

 const neutralVillages=Array.isArray(data.neutralRegions)?data.neutralRegions:[];
 neutralVillages.forEach(village=>{
  const marker=document.createElement("button");marker.type="button";
  marker.className="map-point map-neutral-village dynamic-world-marker";
  marker.dataset.neutralVillage=String(village.id);
  marker.style.left=Number(village.world_x)+"%";marker.style.top=Number(village.world_y)+"%";
  const factionColors={gokturk:"#2587b8",hun:"#b94343",seljuk:"#d4a83e"};
  const color=factionColors[village.owner_faction_id]||factionColors[(neutralClaimIsActive(village)?village.claimed_faction_id:null)]||"#b99b61";
  marker.style.borderColor=color;marker.style.boxShadow="0 0 0 2px "+color+"55,0 3px 12px #000b";
  marker.setAttribute("aria-label",village.region_name+", "+(village.owner_faction_id?"fethedilmiş bölge":"tarafsız köy"));
  const icon=document.createElement("span");icon.textContent=village.owner_faction_id?"🏰":"🏘️";
  const name=document.createElement("small");name.textContent=village.region_name;
  const status=document.createElement("b");
  status.textContent=village.owner_faction_id?({gokturk:"Göktürk",hun:"Hun",seljuk:"Selçuklu"}[village.owner_faction_id]+" hâkimiyeti"):(neutralClaimIsActive(village)?(({gokturk:"Göktürk",hun:"Hun",seljuk:"Selçuklu"}[village.claimed_faction_id]||"Geçici")+" geçici hâkimiyeti"):"Tarafsız");
  marker.append(icon,name,status);mapWorldCanvas.append(marker);
 });
 const resourceNodes=(data.resourceNodes||[]).filter(node=>mineTypes[node.resource_type]);
 const canvasWidth=mapWorldCanvas.clientWidth||1476,canvasHeight=mapWorldCanvas.clientHeight||984;
 // Keep the real world coordinates untouched; calculate separate, collision-free display positions.
 const resourceLayout=resourceNodes.map(node=>({
  node,
  x:Math.max(4,Math.min(96,Number(node.world_x)||50))*canvasWidth/100,
  y:Math.max(5,Math.min(95,Number(node.world_y)||50))*canvasHeight/100
 }));
 const fixedMarkers=[...mapWorldCanvas.querySelectorAll(".dynamic-world-marker:not(.resource-node-marker)")].map(marker=>({
  x:(parseFloat(marker.style.left)||50)*canvasWidth/100,
  y:(parseFloat(marker.style.top)||50)*canvasHeight/100
 }));
 cachedWorldPlayers.forEach(player=>fixedMarkers.push({
  x:(Number(player.world_x)||50)*canvasWidth/100,
  y:(Number(player.world_y)||50)*canvasHeight/100
 }));
 // A gentle repulsion pass prevents resource icons and village markers from stacking.
 const minGap=92;
 for(let pass=0;pass<90;pass++){
  for(let i=0;i<resourceLayout.length;i++){
   const a=resourceLayout[i];
   for(let j=i+1;j<resourceLayout.length;j++){
    const b=resourceLayout[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d<minGap){
     const angle=d<.01?((i*2.399963+j)*1.0):Math.atan2(dy,dx);
     const push=(minGap-d)*.28,px=Math.cos(angle)*push,py=Math.sin(angle)*push;
     a.x-=px;a.y-=py;b.x+=px;b.y+=py;
    }
   }
   for(let j=0;j<fixedMarkers.length;j++){
    const b=fixedMarkers[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
    if(d<minGap+8){
     const angle=d<.01?(i*2.399963):Math.atan2(dy,dx);
     const push=(minGap+8-d)*.32;
     a.x+=Math.cos(angle)*push;a.y+=Math.sin(angle)*push;
    }
   }
   a.x=Math.max(42,Math.min(canvasWidth-42,a.x));
   a.y=Math.max(42,Math.min(canvasHeight-42,a.y));
  }
 }
 resourceLayout.forEach(({node,x,y})=>{
  const type=mineTypes[node.resource_type];if(!type)return;
  const displayX=x/canvasWidth*100,displayY=y/canvasHeight*100;
  const marker=document.createElement("button");marker.type="button";
  marker.className="map-point map-mine-point resource-node-marker resource-node-"+node.resource_type+" dynamic-world-marker";
  marker.dataset.worldMine=String(node.id);
  marker.style.left=displayX+"%";marker.style.top=displayY+"%";
  const schoolLevel=Math.max(1,Math.min(5,Number(gameBuildings["5"]?.level)||1));
  const range=2+(schoolLevel-1)*2;
  const dx=(Number(node.world_x)-ownX)*18,dy=(Number(node.world_y)-ownY)*12;
  const inRange=Math.hypot(dx,dy)<=range*18;
  marker.dataset.inRange=String(inRange);
  marker.classList.toggle("mine-out-of-range",!inRange);
  marker.title=type.name+" · Verim "+node.yield_level+"/9 · "+(inRange?"Mavi alan içinde":"Mavi alan dışında");
  marker.setAttribute("aria-label",type.name+", verim "+node.yield_level+" / 9, "+(inRange?"mavi alan içinde":"mavi alan dışında"));
  const icon=document.createElement("img");icon.src="/assets/resources/"+type.asset;icon.alt="";icon.width=32;icon.height=32;icon.loading="lazy";icon.decoding="async";
  const name=document.createElement("small");name.textContent=type.name;
  const yieldLabel=document.createElement("b");yieldLabel.textContent="Verim "+node.yield_level+"/9";
  marker.append(icon,name,yieldLabel);mapWorldCanvas.append(marker);
 });
 cachedWorldPlayers.forEach(player=>{
  const marker=document.createElement("button");marker.type="button";
  marker.className="map-point map-player-point dynamic-world-marker";
  marker.dataset.worldPlayer=player.id;
  marker.style.left=Number(player.world_x)+"%";marker.style.top=Number(player.world_y)+"%";
  marker.setAttribute("aria-label",player.village_name+" oyuncu köyü");
  const icon=document.createElement("span");icon.textContent="🏰";
  const name=document.createElement("small");name.textContent=player.village_name||"Oyuncu yurdu";
  const faction=document.createElement("b");faction.textContent=factions[player.faction_id]?.name||"Oyuncu";
  marker.append(icon,name,faction);mapWorldCanvas.append(marker);
 });
 // Final pass separates all visible world entities, including neutral villages and players.
 const placedMarkers=[...mapWorldCanvas.querySelectorAll(".dynamic-world-marker")].map(element=>({
  element,
  x:(parseFloat(element.style.left)||50)*canvasWidth/100,
  y:(parseFloat(element.style.top)||50)*canvasHeight/100,
  resource:element.classList.contains("resource-node-marker")
 }));
 for(let pass=0;pass<55;pass++){
  for(let i=0;i<placedMarkers.length;i++){
   const a=placedMarkers[i];
   for(let j=i+1;j<placedMarkers.length;j++){
    const b=placedMarkers[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    const gap=a.resource&&b.resource?92:125;
    if(d<gap){
     const angle=d<.01?i*2.399963:Math.atan2(dy,dx);
     const push=(gap-d)*.24,px=Math.cos(angle)*push,py=Math.sin(angle)*push;
     a.x-=px;a.y-=py;b.x+=px;b.y+=py;
    }
   }
   a.x=Math.max(48,Math.min(canvasWidth-48,a.x));
   a.y=Math.max(48,Math.min(canvasHeight-48,a.y));
  }
 }
 placedMarkers.forEach(({element,x,y})=>{
  element.style.left=(x/canvasWidth*100)+"%";
  element.style.top=(y/canvasHeight*100)+"%";
 });
 if(mapViewport&&mapWorldCanvas){
  requestAnimationFrame(()=>{
   const scaleX=mapWorldCanvas.clientWidth/100,scaleY=mapWorldCanvas.clientHeight/100;
   mapViewport.scrollLeft=Math.max(0,ownX*scaleX-mapViewport.clientWidth/2);
   mapViewport.scrollTop=Math.max(0,ownY*scaleY-mapViewport.clientHeight/2);
  });
 }
}
mapWorldCanvas?.addEventListener("click",async event=>{
 const mine=event.target.closest("[data-world-mine]");
 if(mine){
  mapWorldCanvas.querySelectorAll(".resource-node-marker.is-selected").forEach(item=>item.classList.remove("is-selected"));
  mine.classList.add("is-selected");
  const node=(window.__umaykutWorldNodes||[]).find(item=>String(item.id)===mine.dataset.worldMine);
  if(node){
   const ownCity=mapWorldCanvas.querySelector(".map-own-city");
   const ownX=parseFloat(ownCity?.style.left)||50,ownY=parseFloat(ownCity?.style.top)||50;
   const schoolLevel=Math.max(1,Math.min(5,Number(gameBuildings["5"]?.level)||1));
   const range=2+(schoolLevel-1)*2;
   const dx=(Number(node.world_x)-ownX)*18,dy=(Number(node.world_y)-ownY)*12;
   if(Math.hypot(dx,dy)>range*18){
    mapPrompt.hidden=false;resourcePanel.hidden=true;
    mapPrompt.textContent="Bu maden okulunun mevcut erişim çemberinin dışında. Okul seviyeni yükselterek erişim alanını genişletebilirsin.";
    return;
   }
   selectWorldMine(node,mine);
  }
  return;
 }

 const neutralMarker=event.target.closest("[data-neutral-village]");
 if(neutralMarker){
  const region=(window.__umaykutNeutralRegions||[]).find(item=>String(item.id)===neutralMarker.dataset.neutralVillage);
  if(region)openNeutralRegionDialog(region);
  return;
 }
 const playerMarker=event.target.closest("[data-world-player]");
 if(!playerMarker)return;
 const target=cachedWorldPlayers.find(player=>player.id===playerMarker.dataset.worldPlayer);
 if(!target)return;
 try{if(!armyState)await loadArmyState();openAttackDialog(target);}
 catch(error){window.alert(error.message||"Oyuncu bilgisi alınamadı.");}
});

function renderMarchingArmies(playersData,raidsData){
 if(!mapWorldCanvas)return;
 const overlay=mapWorldCanvas.querySelector(".map-geography-overlay");
 if(!overlay)return;
 overlay.querySelectorAll(".live-army-route").forEach(route=>route.remove());
 mapWorldCanvas.querySelectorAll(".map-army-marker").forEach(marker=>marker.remove());
 const own=playersData.world||{world_x:50,world_y:50};
 const ownX=Math.max(0,Math.min(100,Number(own.world_x)||50));
 const ownY=Math.max(0,Math.min(100,Number(own.world_y)||50));
 const players=Array.isArray(playersData.players)?playersData.players:[];
 const now=Date.parse(raidsData.serverNow)||Date.now();
 (raidsData.attacks||[]).filter(raid=>raid.status==="marching").forEach(raid=>{
  const outgoing=raid.direction==="outgoing";
  const targetId=outgoing?raid.defender_id:raid.attacker_id;
  const target=players.find(player=>player.id===targetId);
  if(!target)return;
  const targetX=Math.max(0,Math.min(100,Number(target.world_x)||50));
  const targetY=Math.max(0,Math.min(100,Number(target.world_y)||50));
  const startX=outgoing?ownX:targetX,startY=outgoing?ownY:targetY;
  const endX=outgoing?targetX:ownX,endY=outgoing?targetY:ownY;
  const x1=startX*18,y1=startY*12,x2=endX*18,y2=endY*12;
  const dx=x2-x1,dy=y2-y1;
  const cx=dx/2-dy*.12,cy=dy/2+dx*.12;
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d","M "+x1+" "+y1+" Q "+(x1+cx)+" "+(y1+cy)+" "+x2+" "+y2);
  path.setAttribute("class","live-army-route "+(outgoing?"outgoing":"incoming"));
  overlay.append(path);
  const marker=document.createElement("div");
  marker.className="map-army-marker";
  marker.textContent="⚔️";
  marker.title=(outgoing?"Giden ordu: ":"Gelen ordu: ")+(target.village_name||"Rakip yurdu");
  marker.setAttribute("aria-label",marker.title);
  const departed=Date.parse(raid.departed_at),arrives=Date.parse(raid.arrives_at);
  const total=Math.max(1000,arrives-departed);
  const elapsed=Math.max(0,Math.min(total,now-departed));
  const duration=total/1000;
  marker.style.animationDuration=duration+"s";
  marker.style.animationDelay=(-elapsed/1000)+"s";
  if(typeof CSS!=="undefined"&&CSS.supports("offset-path",'path("M 0 0 L 1 1")')){
   marker.style.left=startX+"%";marker.style.top=startY+"%";
   marker.style.offsetPath='path("M 0px 0px Q '+cx+'px '+cy+'px '+dx+'px '+dy+'px")';
   marker.style.offsetRotate="auto";
  }else{
   const progress=elapsed/total;
   marker.style.left=(startX+(endX-startX)*progress)+"%";
   marker.style.top=(startY+(endY-startY)*progress)+"%";
  }
  mapWorldCanvas.append(marker);
 });
}

async function loadWorldPlayers(){
 if(!authToken||!worldPlayerList)return;
 worldPlayerList.replaceChildren(Object.assign(document.createElement("p"),{textContent:"Köyler aranıyor…"}));
 try{
  const [playersData,raidsData,scoutData,neutralData]=await Promise.all([
   authRequest("/api/game/players",{token:authToken}),
   authRequest("/api/game/attacks",{token:authToken}),
   authRequest("/api/game/scouting",{token:authToken}),
   authRequest("/api/game/neutral-regions",{token:authToken})
  ]);
  window.__umaykutWorldNodes=playersData.resourceNodes||[];
  window.__umaykutNeutralRegions=neutralData.regions||[];
  renderWorldMap({...playersData,neutralRegions:window.__umaykutNeutralRegions});
  renderMarchingArmies(playersData,raidsData);
  worldPlayerList.replaceChildren();
  if(!playersData.players.length)worldPlayerList.append(Object.assign(document.createElement("p"),{textContent:"Henüz başka bir oyuncu köy kurmamış."}));
  playersData.players.forEach(player=>{
   const card=document.createElement("article");card.className="world-player-card";
   const info=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("small");
   name.textContent=player.village_name;meta.textContent=(factions[player.faction_id]?.name||"Devlet")+" · "+player.username;info.append(name,meta);
   const actions=document.createElement("div");actions.className="world-player-actions";
   const action=document.createElement("button");action.type="button";action.textContent="Saldırı hazırla";action.dataset.attackTarget=player.id;
   const scout=document.createElement("button");scout.type="button";scout.textContent="Casus gönder";scout.dataset.scoutTarget=player.id;
   actions.append(action,scout);card.append(info,actions);worldPlayerList.append(card);
  });
  activeRaidsList.replaceChildren();
  if(!raidsData.attacks.length)activeRaidsList.append(Object.assign(document.createElement("p"),{textContent:"Aktif sefer bulunmuyor."}));
  raidsData.attacks.forEach(raid=>{
   const item=document.createElement("article");item.className="world-raid-card";
   const title=document.createElement("strong"),time=document.createElement("small");
   title.textContent=(raid.direction==="outgoing"?"Giden saldırı: ":"Gelen saldırı: ")+(raid.direction==="outgoing"?raid.defender_village:raid.attacker_village);
   const arrivalMs=Date.parse(raid.arrives_at)-Date.now();
   const returnMs=raid.return_at?Date.parse(raid.return_at)-Date.now():0;
   if(raid.status==="marching")time.textContent=arrivalMs>0?"Hedefe varış: yaklaşık "+Math.ceil(arrivalMs/60000)+" dk":"Hedefe ulaştı · savaş sonucu hazırlanıyor";
   else if(raid.status==="resolved")time.textContent=returnMs>0?"Savaş bitti · sağ kalan askerler dönüyor: "+Math.ceil(returnMs/60000)+" dk":"Dönüş tamamlanıyor · rapor hazır";
   else time.textContent="Sefer tamamlandı · askerler köye döndü";
   item.append(title,time);
   if(raid.battle_report){
    const report=raid.battle_report,details=document.createElement("small");
    const ownLoss=raid.direction==="outgoing"?report.attackerLostCount:report.defenderLostCount;
    const enemyLoss=raid.direction==="outgoing"?report.defenderLostCount:report.attackerLostCount;
    const ownBreakdown=raid.direction==="outgoing"?report.attackerLosses:report.defenderLosses;
    const enemyBreakdown=raid.direction==="outgoing"?report.defenderLosses:report.attackerLosses;
    const fmt=losses=>Object.entries(losses||{}).filter(([,n])=>Number(n)>0).map(([id,n])=>id+": "+n).join(", ")||"Yok";
    const loot=raid.direction==="outgoing"?(raid.loot||{}):{};
    const lootText=Object.entries(loot).filter(([,n])=>Number(n)>0).map(([key,n])=>key+": "+n).join(" · ");
    const outcome=report.winner===(raid.direction==="outgoing"?"attacker":"defender")?"Zafer":"Savunma başarılı";
    details.textContent=outcome+" · "+(report.outcomeText||"Savaş tamamlandı")+" · Senin kayıpların: "+ownLoss+" ("+fmt(ownBreakdown)+") · Rakip kayıpları: "+enemyLoss+" ("+fmt(enemyBreakdown)+") · Savunma gücü: "+report.defenderPower+" · Sur engeli: %"+report.wallDefensePercent+(lootText?" · Ganimet: "+lootText:"");
    item.append(details);
   }
   activeRaidsList.append(item);
  });
  const scoutReportsList=document.querySelector("#scout-reports-list");
  scoutReportsList.replaceChildren();
  if(!scoutData.missions.length)scoutReportsList.append(Object.assign(document.createElement("p"),{textContent:"Henüz casus görevi bulunmuyor."}));
  scoutData.missions.forEach(mission=>{
   const card=document.createElement("article");card.className="world-raid-card scout-report-card";
   const portrait=document.createElement("img");portrait.className="scout-portrait";portrait.src="/assets/IMG-20261117-WA9037.jpg";portrait.alt="Casus";
   const content=document.createElement("div");content.className="scout-report-content";
   const title=document.createElement("strong"),status=document.createElement("small");
   title.textContent=mission.defender_report?"Köyüne casus geldi: "+mission.attacker_village:"Casus: "+mission.defender_village;
   const arrival=Date.parse(mission.arrives_at)-Date.now(),returning=mission.return_at?Date.parse(mission.return_at)-Date.now():0;
   status.textContent=mission.defender_report?"Savunma bildirimi · Gelen casus: "+mission.defender_report.incomingScouts+" · Kaybedilen casus: "+mission.defender_report.ownScoutsLost+" · Kalan: "+mission.defender_report.ownScoutsRemaining:mission.status==="marching"?"Hedefe varış: "+Math.max(0,Math.ceil(arrival/60000))+" dk":mission.status==="resolved"?"Casus tamamlandı · dönüş: "+Math.max(0,Math.ceil(returning/60000))+" dk":"Casus birliği köye döndü";
   content.append(title,status);
   if(mission.scout_report){
    const report=mission.scout_report,detail=document.createElement("small");
    const resources=Object.entries(report.resources||{}).map(([key,value])=>key+": "+value).join(" · ");
    const troops=Object.entries(report.troops||{}).map(([key,value])=>key+": "+value).join(" · ")||"Asker bulunamadı";
    detail.textContent=report.informationGathered===false?"Casus başarısız. Casusların tamamı kaybedildi.": "Kaynaklar: "+resources+" · Savunma ordusu: "+troops+" · Geri dönecek casus: "+Number(report.attackerSurvivors||0);
    content.append(detail);
   }
   card.append(portrait,content);
   scoutReportsList.append(card);
  });
 }catch(error){worldPlayerList.replaceChildren(Object.assign(document.createElement("p"),{textContent:error.message||"Oyuncu köyleri yüklenemedi."}));}
}
function openAttackDialog(target){
 selectedAttackTarget=target;
 const factionName=factions[target.faction_id]?.name||"Devlet";
 attackTargetName.textContent="Hedef: "+target.village_name+" · "+factionName;
 attackMessage.textContent="Göndermek istediğin asker sayılarını seç.";
 attackUnitList.replaceChildren();
 armyState.catalog.forEach(unit=>{
  const owned=Number(armyState.troops[unit.id]||0);if(owned<=0)return;
  const label=document.createElement("label");label.className="attack-unit-row";
  const name=document.createElement("span");name.textContent=unit.icon+" "+unit.name+" · Mevcut "+armyNumber(owned);
  const input=document.createElement("input");input.type="number";input.min="0";input.max=String(owned);input.value="0";input.dataset.attackUnit=unit.id;input.setAttribute("aria-label",unit.name+" gönderilecek sayısı");
  label.append(name,input);attackUnitList.append(label);
 });
 if(!attackUnitList.children.length){attackMessage.textContent="Gönderilecek hazır asker bulunmuyor. Önce asker yetiştir.";return;}
 attackDialog.showModal();
}
worldPlayerList.addEventListener("click",async event=>{
 const scoutButton=event.target.closest("[data-scout-target]");
 if(scoutButton){
  try{
   if(!armyState)await loadArmyState();
   const available=Number(armyState?.troops?.scout||0);
   if(available<1){window.alert("Casus bulunmuyor. Kışla seviyesini 2 yapıp Ordu bölümünden casus yetiştir.");return;}
   const amount=Number(window.prompt("Gönderilecek casus sayısı (Mevcut: "+available+")","1"));
   if(!Number.isSafeInteger(amount)||amount<1||amount>available)return;
   const result=await authRequest("/api/game/scouting",{method:"POST",token:authToken,body:{targetPlayerId:scoutButton.dataset.scoutTarget,amount}});
   window.alert("Casus birliği yola çıktı. Varış yaklaşık "+Math.ceil(result.marchSeconds/60)+" dakika.");
   await loadArmyState();await loadWorldPlayers();
  }catch(error){window.alert(error.message||"Casus emri gönderilemedi.");}
  return;
 }
 const button=event.target.closest("[data-attack-target]");if(!button)return;
 try{
  if(!armyState)await loadArmyState();
  const data=await authRequest("/api/game/players",{token:authToken});
  const target=data.players.find(player=>player.id===button.dataset.attackTarget);
  if(target)openAttackDialog(target);
 }catch(error){attackMessage.textContent=error.message||"Hedef köy seçilemedi.";}
});
document.querySelector("#refresh-world-players").addEventListener("click",loadWorldPlayers);

document.querySelector("#neutral-region-close").addEventListener("click",()=>{
 if(neutralRegionTimer)clearInterval(neutralRegionTimer);
 neutralRegionDialog.close();
});
async function submitNeutralRegionAction(endpoint){
 if(!selectedNeutralRegion||neutralRegionMode==="owned")return;
 let troops={};
 if(endpoint!=="challenge"){
  neutralRegionUnitList.querySelectorAll("[data-neutral-unit]").forEach(input=>{
   const amount=Number(input.value);
   if(Number.isSafeInteger(amount)&&amount>0)troops[input.dataset.neutralUnit]=amount;
  });
  if(!Object.keys(troops).length){neutralRegionMessage.textContent="En az bir asker seçmelisin.";return;}
 }
 const button=endpoint==="challenge"?document.querySelector("#neutral-region-challenge"):neutralRegionAction;
 button.disabled=true;
 neutralRegionMessage.textContent=endpoint==="garrison"?"Garnizona asker gönderiliyor…":endpoint==="challenge"?"Muhafızlarla savaş başlıyor…":"Rakip garnizona saldırı gönderiliyor…";
 try{
  const result=await authRequest("/api/game/neutral-regions/"+endpoint,{
   method:"POST",token:authToken,body:{regionId:selectedNeutralRegion.id,troops}
  });
  neutralRegionMessage.textContent=result.message||"Bölge işlemi tamamlandı.";
  await loadArmyState();
  await loadWorldPlayers();
  const updated=(window.__umaykutNeutralRegions||[]).find(item=>String(item.id)===String(selectedNeutralRegion.id));
  if(updated)renderNeutralRegionDialog(updated);
  if(result.captured)neutralRegionMessage.textContent=result.message+" Kayıplar: "+armyNumber(result.attackerLosses||0)+" · Sağ kalan: "+armyNumber(result.attackerSurvivors||0)+".";
 }catch(error){
  neutralRegionMessage.textContent=error.message||"Bölge işlemi tamamlanamadı.";
 }finally{
  button.disabled=false;
 }
}
neutralRegionAction.addEventListener("click",()=>submitNeutralRegionAction(neutralRegionMode==="attack"?"attack":"garrison"));
document.querySelector("#neutral-region-challenge").addEventListener("click",()=>submitNeutralRegionAction("challenge"));

document.querySelector("#attack-close").addEventListener("click",()=>attackDialog.close());
document.querySelector("#send-attack").addEventListener("click",async()=>{
 if(!selectedAttackTarget)return;
 const troops={};
 attackUnitList.querySelectorAll("[data-attack-unit]").forEach(input=>{const amount=Number(input.value);if(amount>0)troops[input.dataset.attackUnit]=amount;});
 if(!Object.keys(troops).length){attackMessage.textContent="En az bir birlik seçmelisin.";return;}
 const button=document.querySelector("#send-attack");button.disabled=true;attackMessage.textContent="Saldırı emri sunucuya gönderiliyor…";
 try{
  const result=await authRequest("/api/game/attack",{method:"POST",token:authToken,body:{targetPlayerId:selectedAttackTarget.id,troops}});
  attackMessage.textContent="Saldırı yola çıktı! Varış süresi yaklaşık "+Math.ceil(result.marchSeconds/60)+" dakika.";
  await loadArmyState();await loadWorldPlayers();
  setTimeout(()=>{if(attackDialog.open)attackDialog.close();},1200);
 }catch(error){attackMessage.textContent=error.message||"Saldırı gönderilemedi.";}
 finally{button.disabled=false;}
});
