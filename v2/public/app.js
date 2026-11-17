const factions={
 hun:{name:"Hun Devleti",themeColor:"#7b2528",short:"Kızıl Bozkır",trait:"Atlı birlikler ve hızlı akınlar",description:"Hareketli süvari ordusu, baskın ve sefer odaklı oyun tarzı."},
 seljuk:{name:"Selçuklu Devleti",themeColor:"#8d6a2d",short:"Altın Hâkimiyet",trait:"Ticaret ve şehirleşme",description:"Üretim, ticaret, güçlü surlar ve düzenli şehir gelişimi odaklı oyun tarzı."},
 gokturk:{name:"Göktürk Devleti",themeColor:"#176b83",short:"Göklerin Hâkimiyeti",trait:"Dengeli bozkır gücü",description:"Kaynak, keşif, ordu ve savunma arasında dengeli gelişim."}
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
function fitVillageImage(){
 if(!villageFrame||!villageStage||!villageImage||!villageImage.naturalWidth||!villageImage.naturalHeight)return;
 const frameWidth=villageFrame.clientWidth;
 const frameHeight=villageFrame.clientHeight;
 if(!frameWidth||!frameHeight)return;
 const scale=Math.min(frameWidth/villageImage.naturalWidth,frameHeight/villageImage.naturalHeight);
 villageStage.style.width=Math.round(villageImage.naturalWidth*scale)+"px";
 villageStage.style.height=Math.round(villageImage.naturalHeight*scale)+"px";
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

const DEFAULT_RESOURCES={gold:1650,wood:6900,food:9350,stone:7480,iron:8040,horses:100};
const BUILDING_TYPES={
 center:{name:"Merkez Binası",shortName:"Merkez",icon:"🏰",description:"Yurdunun kalbi. Diğer yapıların gelişimini yönetir."},
 barracks:{name:"Kışla",shortName:"Kışla",icon:"⚔️",description:"Piyade ve savunma birliklerinin yetiştirileceği yapı."},
 lumberyard:{name:"Keresteci",shortName:"Keresteci",icon:"🪵",description:"Ormanlardan elde edilen odun üretimini geliştirir."},
 blacksmith:{name:"Demirci",shortName:"Demirci",icon:"⚒️",description:"Demir işçiliğini ve silah üretimini geliştirir."},
 school:{name:"Okul",shortName:"Okul",icon:"📚",description:"Eğitim ve araştırma çalışmalarını geliştirir."},
 temple:{name:"Tapınak",shortName:"Tapınak",icon:"🛕",description:"İnanç, birlik ve halkın moralini güçlendirir."},
 quarry:{name:"Taş Ocağı",shortName:"Taş Ocağı",icon:"🪨",description:"Taş üretimini geliştirecek yapı."},
 ironmine:{name:"Demir Madeni",shortName:"Demir Madeni",icon:"⛏️",description:"Demir üretimini geliştirecek yapı."},
 farm:{name:"Çiftlik",shortName:"Çiftlik",icon:"🌾",description:"Yiyecek üretimini geliştirecek yapı."},
 stable:{name:"Ahır",shortName:"Ahır",icon:"🐎",description:"Atlı birlikler için gerekli altyapı."},
 market:{name:"Pazar",shortName:"Pazar",icon:"🏪",description:"Kaynak ve ticaret işlemlerinin merkezi."},
 warehouse:{name:"Okçu",shortName:"Okçu",icon:"🏹",description:"Okçu birliklerinin eğitildiği ve hazırlandığı yapı."}
};
const BUILDING_SLOT_TYPES={
 "1":"center","2":"barracks","3":"stable","4":"blacksmith",
 "5":"school","6":"lumberyard","7":"temple","8":"market","9":"warehouse"
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
 "9":{type:"warehouse",level:1}
};
const BUILDING_BASE_COST={wood:30,stone:20,iron:5};
const MAX_BUILDING_LEVEL=10;
let gameResources={...DEFAULT_RESOURCES};
let gameBuildings={...DEFAULT_BUILDINGS};
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
  const displayedLevel=Number(building.upgrade?.targetLevel)||Number(building.level)||1;
  if(label)label.textContent=definition.shortName||definition.name;
  if(levelBadge)levelBadge.textContent=String(displayedLevel);
  node.classList.add("is-built");
  node.classList.toggle("is-upgrading",Boolean(building.upgrade));
  node.setAttribute("aria-label",slot+" numaralı "+definition.name+" seviye "+displayedLevel+(building.upgrade?" yükseltiliyor":""));
  node.dataset.level=String(displayedLevel);
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
  .sort((a,b)=>Date.parse(a[1].upgrade.completesAt)-Date.parse(b[1].upgrade.completesAt));
 tracker.hidden=active.length===0;
 const countLabel=document.querySelector("#building-upgrade-count");
 if(countLabel)countLabel.textContent=active.length+" AKTİF";
 if(!active.length){
  list.replaceChildren();
  refreshBuildingCountdown();
  return;
 }
 list.innerHTML=active.map(([slot,building])=>{
  const definition=BUILDING_TYPES[BUILDING_SLOT_TYPES[slot]]||BUILDING_TYPES.center;
  const started=Date.parse(building.upgrade.startedAt);
  const completes=Date.parse(building.upgrade.completesAt);
  const duration=Math.max(1,completes-started);
  const progress=Math.min(100,Math.max(0,(now-started)/duration*100));
  const remaining=formatUpgradeRemainingAt(building.upgrade.completesAt,now);
  return '<article class="upgrade-card" data-upgrade-slot="'+slot+'">'+
   '<div class="upgrade-card-top"><div><strong>'+definition.name+'</strong><small>Seviye '+building.level+' → '+building.upgrade.targetLevel+'</small></div>'+
   '<b class="upgrade-countdown">'+remaining+'</b></div>'+
   '<div class="upgrade-progress"><span style="width:'+progress.toFixed(2)+'%"></span></div>'+
   '<small class="upgrade-card-foot">'+(progress>=100?'Tamamlanıyor…':'Yükseltme devam ediyor')+' · Alan '+slot+'</small>'+
   '</article>';
 }).join("");
 if(active.some(([,building])=>Date.parse(building.upgrade.completesAt)<=now)&&!upgradeCompletionCheckInFlight){
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
 buildingEmblem.textContent=definition.icon;
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
}
function openBuildingDialog(slot){
 selectedBuildingSlot=Number(slot);
 buildingMessage.textContent="";
 updateBuildingDialog();
 if(typeof buildingDialog.showModal==="function")buildingDialog.showModal();
 else buildingDialog.setAttribute("open","");
}
document.querySelectorAll("[data-building-slot]").forEach(node=>{
 node.addEventListener("click",()=>openBuildingDialog(node.dataset.buildingSlot));
});
buildingClose.addEventListener("click",()=>buildingDialog.close());
setInterval(updateUpgradeTracking,1000);
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
const navButtons=document.querySelectorAll(".bottom-nav button");
function showScreen(screen){
 const isMap=screen==="map";
 villageView.hidden=isMap;
 mapView.hidden=!isMap;
 navButtons.forEach(button=>button.classList.toggle("active",button.dataset.screen===screen));
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

const WORKER_POOL=1800;
const WORKER_STORAGE_KEY="umaykut-worker-state-v2";
const resourceInfo={
 grain:{name:"Tahıl Ovası",type:"TAHIL BÖLGESİ",description:"Tahıl toplamak için işçilerini bu ovaya görevlendir.",counter:"assigned-grain"},
 wood:{name:"Orman",type:"ODUN BÖLGESİ",description:"Odun toplamak için işçilerini ormanlık alana görevlendir.",counter:"assigned-wood"},
 stone:{name:"Taş Ocağı",type:"TAŞ BÖLGESİ",description:"Taş toplamak için işçilerini taş ocağına görevlendir.",counter:"assigned-stone"}
};
const assigned={grain:0,wood:0,stone:0};
let availableWorkers=WORKER_POOL;
let selectedResource=null;
function restoreWorkerState(){
 try{
  const saved=JSON.parse(localStorage.getItem(WORKER_STORAGE_KEY)||"null");
  if(!saved||!saved.assigned)return;
  const values=["grain","wood","stone"].map(key=>saved.assigned[key]);
  if(!values.every(value=>Number.isSafeInteger(value)&&value>=0))return;
  const total=values.reduce((sum,value)=>sum+value,0);
  if(total>WORKER_POOL)return;
  ["grain","wood","stone"].forEach((key,index)=>assigned[key]=values[index]);
  availableWorkers=WORKER_POOL-total;
 }catch{}
}
function saveWorkerState(){
 try{
  localStorage.setItem(WORKER_STORAGE_KEY,JSON.stringify({version:2,workerPool:WORKER_POOL,assigned}));
 }catch{}
 if(gameStateReady) persistGameState().catch(()=>{
  if(workerStatus) workerStatus.textContent="Bağlantı kurulamadı; değişiklik bu cihazda saklandı.";
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
 availableLabel.textContent=formatNumber(availableWorkers);
 assignedTotalLabel.textContent=formatNumber(totalAssigned())+" görevde";
 Object.entries(resourceInfo).forEach(([key,info])=>{
  document.querySelector("#"+info.counter).textContent=formatNumber(assigned[key])+" işçi";
 });
 updateWorkerActions();
}
function updateWorkerActions(){
 if(!selectedResource)return;
 const current=assigned[selectedResource];
 assignButton.disabled=availableWorkers===0;
 recallButton.disabled=current===0;
 workerInput.max=String(Math.max(availableWorkers,current,1));
}
function selectResource(button){
 selectedResource=button.dataset.resource;
 const info=resourceInfo[selectedResource];
 document.querySelectorAll("[data-resource]").forEach(node=>{
  node.setAttribute("aria-pressed",String(node===button));
 });
 mapPrompt.hidden=true;
 resourcePanel.hidden=false;
 resourceType.textContent=info.type;
 resourceName.textContent=info.name;
 resourceDescription.textContent=info.description;
 workerInput.value="1";
 workerStatus.textContent=`Bu bölgede ${formatNumber(assigned[selectedResource])} işçi görevde · ${formatNumber(availableWorkers)} işçi boştadır.`;
 updateWorkerActions();
}
document.querySelectorAll("[data-resource]").forEach(button=>{
 button.addEventListener("click",()=>selectResource(button));
});
function readWorkerCount(){
 const count=Number(workerInput.value);
 if(!Number.isSafeInteger(count)||count<1){
  workerStatus.textContent="Lütfen 1 veya daha fazla tam sayı gir.";
  return null;
 }
 return count;
}
assignButton.addEventListener("click",()=>{
 if(!selectedResource)return;
 const count=readWorkerCount();
 if(count===null)return;
 if(count>availableWorkers){
  workerStatus.textContent=`En fazla ${formatNumber(availableWorkers)} işçi gönderebilirsin.`;
  workerInput.value=String(Math.max(availableWorkers,1));
  return;
 }
 assigned[selectedResource]+=count;
 availableWorkers-=count;
 saveWorkerState();
 updateWorkerSummary();
 workerInput.value="1";
 workerStatus.textContent=`${formatNumber(count)} işçi ${resourceInfo[selectedResource].name} bölgesine gönderildi. ${formatNumber(assigned[selectedResource])} görevde, ${formatNumber(availableWorkers)} boştadır. Hesabına kaydedildi.`;
});
recallButton.addEventListener("click",()=>{
 if(!selectedResource)return;
 const count=readWorkerCount();
 if(count===null)return;
 if(count>assigned[selectedResource]){
  workerStatus.textContent=`Bu bölgede yalnızca ${formatNumber(assigned[selectedResource])} işçi görevde.`;
  workerInput.value=String(Math.max(assigned[selectedResource],1));
  return;
 }
 assigned[selectedResource]-=count;
 availableWorkers+=count;
 saveWorkerState();
 updateWorkerSummary();
 workerInput.value="1";
 workerStatus.textContent=`${formatNumber(count)} işçi ${resourceInfo[selectedResource].name} bölgesinden geri çağrıldı. ${formatNumber(assigned[selectedResource])} görevde, ${formatNumber(availableWorkers)} boştadır. Hesabına kaydedildi.`;
});
restoreWorkerState();
updateWorkerSummary();


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


async function persistGameState(){
 if(!authToken||!gameStateReady)return;
 return authRequest("/api/game/state",{
  method:"PUT",
  token:authToken,
  body:{factionId:shell.dataset.faction,workerAssignments:{...assigned}}
 });
}

async function loadGameState(){
 if(!authToken)return;
 gameStateReady=false;
 try{
  const state=await authRequest("/api/game/state",{token:authToken});
  setServerClock(state.serverNow);
  if(state.factionId) setFaction(state.factionId);
  if(state.resources&&typeof state.resources==="object")gameResources={...DEFAULT_RESOURCES,...state.resources};
  gameBuildings=Object.fromEntries(Object.entries(BUILDING_SLOT_TYPES).map(([slot,type])=>{
   const saved=state.buildings?.[slot]||{};
   return [slot,{type,level:Math.max(1,Number(saved.level)||1),upgrade:saved.upgrade||null}];
  }));
  renderResourceBalances();
  renderBuildingMarkers();
  renderUpgradeTracker();
  if(state.workerStateInitialized){
   ["grain","wood","stone"].forEach(key=>{assigned[key]=Number(state.workerAssignments?.[key]||0);});
   availableWorkers=Math.max(0,Number(state.workerPool||WORKER_POOL)-totalAssigned());
  }else{
   await authRequest("/api/game/state",{
    method:"PUT",token:authToken,
    body:{factionId:shell.dataset.faction,workerAssignments:{...assigned}}
   });
   availableWorkers=Math.max(0,WORKER_POOL-totalAssigned());
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


// Interactive wall marker positioning: the player chooses the exact point on the village image.
const wallPositionMarker=document.querySelector("#wall-position-marker");
const wallPositionToggle=document.querySelector("#wall-position-toggle");
const wallPositionConfirm=document.querySelector("#wall-position-confirm");
const wallPositionStatus=document.querySelector("#wall-position-status");
const wallPositionStage=document.querySelector(".city-stage");
let wallPositionEditing=false;
let wallPositionDraft=null;
const WALL_POSITION_KEY="umaykut-wall-position-draft-v2";
function readWallPosition(){
 try{
  const saved=JSON.parse(localStorage.getItem(WALL_POSITION_KEY)||"null");
  if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
   wallPositionMarker.style.left=saved.x+"%";
   wallPositionMarker.style.top=saved.y+"%";
   return saved;
  }
 }catch{}
 const style=getComputedStyle(wallPositionMarker);
 return {x:parseFloat(style.left)/wallPositionStage.clientWidth*100||50,y:parseFloat(style.top)/wallPositionStage.clientHeight*100||7};
}
function updateWallPositionStatus(prefix=""){
 const p=wallPositionDraft||readWallPosition();
 wallPositionStatus.textContent=prefix+"Sur işareti konumu: X "+p.x.toFixed(1)+"% · Y "+p.y.toFixed(1)+"%. "+(wallPositionEditing?"İşareti görsel üzerinde istediğin noktaya sürükle.":"");
}
function setWallPositionEditing(enabled){
 wallPositionEditing=enabled;
 wallPositionStage.classList.toggle("wall-position-editing",enabled);
 wallPositionMarker.classList.toggle("wall-position-draggable",enabled);
 wallPositionToggle.textContent=enabled?"✋ Konum ayarını bitir":"📍 Sur konumunu belirle";
 wallPositionConfirm.disabled=enabled||!wallPositionDraft;
 updateWallPositionStatus(enabled?"Konum ayarı açık. ":"");
}
function moveWallMarker(event){
 if(!wallPositionEditing||!wallPositionStage)return;
 const rect=wallPositionStage.getBoundingClientRect();
 const x=Math.max(1,Math.min(99,(event.clientX-rect.left)/rect.width*100));
 const y=Math.max(1,Math.min(99,(event.clientY-rect.top)/rect.height*100));
 wallPositionDraft={x:Number(x.toFixed(1)),y:Number(y.toFixed(1))};
 wallPositionMarker.style.left=wallPositionDraft.x+"%";
 wallPositionMarker.style.top=wallPositionDraft.y+"%";
 updateWallPositionStatus();
}
if(wallPositionMarker&&wallPositionToggle&&wallPositionConfirm&&wallPositionStage){
 wallPositionDraft=readWallPosition();
 updateWallPositionStatus();
 wallPositionToggle.addEventListener("click",()=>setWallPositionEditing(!wallPositionEditing));
 wallPositionMarker.addEventListener("pointerdown",event=>{
  if(!wallPositionEditing)return;
  event.preventDefault();
  wallPositionMarker.setPointerCapture(event.pointerId);
  moveWallMarker(event);
 });
 wallPositionMarker.addEventListener("pointermove",event=>{if(wallPositionEditing&&wallPositionMarker.hasPointerCapture(event.pointerId))moveWallMarker(event);});
 wallPositionMarker.addEventListener("pointerup",event=>{
  if(!wallPositionEditing)return;
  if(wallPositionMarker.hasPointerCapture(event.pointerId))wallPositionMarker.releasePointerCapture(event.pointerId);
 });
 wallPositionStage.addEventListener("pointerdown",event=>{
  if(wallPositionEditing&&event.target!==wallPositionMarker)moveWallMarker(event);
 });
 wallPositionConfirm.addEventListener("click",()=>{
  if(!wallPositionDraft)return;
  try{localStorage.setItem(WALL_POSITION_KEY,JSON.stringify(wallPositionDraft));}catch{}
  wallPositionStatus.textContent="Konum taslağın kaydedildi: X "+wallPositionDraft.x.toFixed(1)+"% · Y "+wallPositionDraft.y.toFixed(1)+"%. Bu koordinatları bana gönder; kalıcı oyun konumuna ondan sonra aktaralım.";
  wallPositionConfirm.disabled=true;
 });
}
