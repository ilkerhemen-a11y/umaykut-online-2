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
let gameWall={level:1,upgrade:null};
let wallServerEffects={defensePercent:5,shelterCapacity:{gold:500,wood:500,food:500,stone:500,iron:500}};
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
setInterval(()=>{updateUpgradeTracking();updateWallUpgradeCountdown();},1000);
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
function armyNumber(value){return new Intl.NumberFormat("tr-TR").format(Number(value)||0);}
function renderArmySummary(){
 if(!armyState)return;
 document.querySelector("#army-total-units").textContent=armyNumber(armyState.totalUnits);
 document.querySelector("#army-total-power").textContent=armyNumber(armyState.armyPower);
 document.querySelector("#army-faction-name").textContent=armyState.factionName;
 const strip=document.querySelector("#army-units");
 if(strip){
  strip.replaceChildren();
  armyState.catalog.forEach(unit=>{
   const card=document.createElement("button");card.type="button";card.className="army-strip-unit";card.dataset.openUnit=unit.id;
   const icon=document.createElement("span"),count=document.createElement("b"),name=document.createElement("small");
   icon.textContent=unit.icon;count.textContent=armyNumber(armyState.troops[unit.id]||0);name.textContent=unit.name;
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
  const emblem=document.createElement("span");emblem.className="army-unit-emblem";emblem.textContent=unit.icon;
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
 const emblem=document.createElement("div");emblem.className="army-detail-emblem";emblem.textContent=unit.icon;
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
 const amount=document.createElement("input");amount.type="number";amount.min="1";amount.max="100";amount.value="1";amount.inputMode="numeric";amount.id="army-selected-amount";amount.setAttribute("aria-label",unit.name+" yetiştirilecek asker sayısı");
 const button=document.createElement("button");button.type="button";button.textContent=unit.unlocked?"Bu askeri yetiştir":"Birlik kilitli";button.disabled=!unit.unlocked;button.dataset.recruitUnit=unit.id;button.dataset.amountInput="army-selected-amount";
 controls.append(amount,button);content.append(controls);
}
function renderArmyQueue(){
 if(!armyState)return;
 armyQueueNode.replaceChildren();
 if(!armyState.trainingQueue.length){const p=document.createElement("p");p.textContent="Askerler yetiştirildiğinde doğrudan orduna katılır.";armyQueueNode.append(p);return;}
 armyState.trainingQueue.forEach(job=>{
  const item=document.createElement("div");item.className="army-queue-item";
  const title=document.createElement("strong");title.textContent=job.name+" × "+armyNumber(job.amount);
  const time=document.createElement("small");const remainingMs=Date.parse(job.completesAt)-getServerNow();const remaining=Math.max(0,Math.ceil(remainingMs/1000));const hours=Math.floor(remaining/3600),minutes=Math.floor((remaining%3600)/60),seconds=remaining%60;time.textContent=remainingMs<=0?"Tamamlanıyor…":"Yetiştiriliyor · "+(hours?hours+" sa ":"")+(minutes?minutes+" dk ":"")+seconds+" sn kaldı";
  item.append(title,time);armyQueueNode.append(item);
 });
}
async function loadArmyState(){
 if(!authToken)return;
 try{
  armyState=await authRequest("/api/game/army",{token:authToken});
  if(armyState.resources){gameResources={...gameResources,...armyState.resources};renderResourceBalances();}
  renderArmySummary();renderArmyCatalog();renderArmyQueue();
 }catch(error){
  if(armyMessageNode)armyMessageNode.textContent=error.message||"Ordu bilgileri yüklenemedi.";
 }
}
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
 if(!Number.isSafeInteger(amount)||amount<1||amount>100){armyMessageNode.textContent="Bir seferde 1 ile 100 arasında asker seçebilirsin.";return;}
 button.disabled=true;armyMessageNode.textContent="Askerler orduya katılıyor…";
 try{
  const result=await authRequest("/api/game/army/recruit",{method:"POST",token:authToken,body:{unitId:button.dataset.recruitUnit,amount}});
  armyState=result;gameResources={...gameResources,...result.resources};renderResourceBalances();
  renderArmySummary();renderArmyCatalog();renderArmyQueue();
  if(selectedArmyUnitId)renderArmyUnitDetail(selectedArmyUnitId);
  armyMessageNode.textContent=amount+" asker eğitim kuyruğuna eklendi. Kaynaklar hesabından düşüldü.";
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
let mapZoom=0.82;
const MAP_ZOOM_MIN=0.55,MAP_ZOOM_MAX=1.6,MAP_ZOOM_STEP=0.15;
function applyMapZoom(nextZoom,preserveCenter=true){
 if(!mapWorldCanvas||!mapViewport)return;
 const oldWidth=mapWorldCanvas.clientWidth||1800,oldHeight=mapWorldCanvas.clientHeight||1200;
 const centerX=mapViewport.scrollLeft+mapViewport.clientWidth/2;
 const centerY=mapViewport.scrollTop+mapViewport.clientHeight/2;
 const ratioX=centerX/oldWidth,ratioY=centerY/oldHeight;
 mapZoom=Math.max(MAP_ZOOM_MIN,Math.min(MAP_ZOOM_MAX,Math.round(nextZoom*100)/100));
 const mobile=window.matchMedia("(max-width: 420px)").matches;
 const baseWidth=mobile?1500:1800,baseHeight=mobile?1000:1200;
 mapWorldCanvas.style.width=Math.round(baseWidth*mapZoom)+"px";
 mapWorldCanvas.style.height=Math.round(baseHeight*mapZoom)+"px";
 const label=document.querySelector("#map-zoom-level");
 if(label)label.textContent=Math.round(mapZoom*100)+"%";
 if(preserveCenter){
  requestAnimationFrame(()=>{
   mapViewport.scrollLeft=Math.max(0,ratioX*mapWorldCanvas.clientWidth-mapViewport.clientWidth/2);
   mapViewport.scrollTop=Math.max(0,ratioY*mapWorldCanvas.clientHeight-mapViewport.clientHeight/2);
  });
 }
}
document.querySelector("#map-zoom-in")?.addEventListener("click",()=>applyMapZoom(mapZoom+MAP_ZOOM_STEP));
document.querySelector("#map-zoom-out")?.addEventListener("click",()=>applyMapZoom(mapZoom-MAP_ZOOM_STEP));
document.querySelector("#map-zoom-reset")?.addEventListener("click",()=>{
 applyMapZoom(0.82,false);
 if(mapViewport&&mapWorldCanvas){
  const own=mapWorldCanvas.querySelector(".map-own-city");
  const x=own?parseFloat(own.style.left||"50"):50,y=own?parseFloat(own.style.top||"50"):50;
  requestAnimationFrame(()=>{
   mapViewport.scrollLeft=Math.max(0,x/100*mapWorldCanvas.clientWidth-mapViewport.clientWidth/2);
   mapViewport.scrollTop=Math.max(0,y/100*mapWorldCanvas.clientHeight-mapViewport.clientHeight/2);
  });
 }
});
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
 neutralRegionMode=owned?"owned":mine?"challenge":rival?"attack":"garrison";
 neutralRegionTroopSection.hidden=owned||mine;
 fillNeutralTroopChoices();
 neutralRegionAction.hidden=owned;
 neutralRegionAction.disabled=false;
 neutralRegionAction.textContent=mine?"⚔️ Muhafızlara saldır ve fethet":rival?"⚔️ Rakip garnizona saldır":"🏕️ İlk garnizonu kur · 4 saat başlat";
 neutralRegionMessage.textContent=owned?"Bu bölge şu anda fethedilmiş durumda.":mine?"Garnizondaki tüm askerler muhafızlara karşı savaşa katılacak.":rival?"Göndereceğin ordu, muhafızlar ve mevcut garnizona karşı savaşacak.":"İlk gönderdiğin birlikler garnizon olur. Dört saat içinde muhafızları yenmelisin.";
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
 mapWorldCanvas.querySelectorAll(".dynamic-world-marker").forEach(marker=>marker.remove());
 const mineTypes={
  iron:{icon:"⛏️",name:"Demir Madeni"},
  stone:{icon:"🪨",name:"Taş Madeni"},
  gold:{icon:"🪙",name:"Altın Madeni"}
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
 (data.resourceNodes||[]).forEach(node=>{
  const type=mineTypes[node.resource_type];if(!type)return;
  const marker=document.createElement("button");marker.type="button";
  marker.className="map-point map-mine-point dynamic-world-marker";
  marker.dataset.worldMine=String(node.id);
  marker.style.left=Number(node.world_x)+"%";marker.style.top=Number(node.world_y)+"%";
  marker.setAttribute("aria-label",type.name+", verim "+node.yield_level+" / 9");
  const icon=document.createElement("span");icon.textContent=type.icon;
  const name=document.createElement("small");name.textContent=type.name+" #"+node.id;
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
  const node=(window.__umaykutWorldNodes||[]).find(item=>String(item.id)===mine.dataset.worldMine);
  if(node){
   const labels={iron:"Demir Madeni",stone:"Taş Madeni",gold:"Altın Madeni"};
   mapPrompt.hidden=false;resourcePanel.hidden=true;
   mapPrompt.textContent=labels[node.resource_type]+" · Verim seviyesi "+node.yield_level+"/9. Bu maden ortak dünyada keşfedildi.";
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
neutralRegionAction.addEventListener("click",async()=>{
 if(!selectedNeutralRegion||neutralRegionMode==="owned")return;
 let troops={};
 if(neutralRegionMode!=="challenge"){
  neutralRegionUnitList.querySelectorAll("[data-neutral-unit]").forEach(input=>{
   const amount=Number(input.value);
   if(Number.isSafeInteger(amount)&&amount>0)troops[input.dataset.neutralUnit]=amount;
  });
  if(!Object.keys(troops).length){neutralRegionMessage.textContent="En az bir asker seçmelisin.";return;}
 }
 const endpoint=neutralRegionMode==="garrison"?"garrison":neutralRegionMode==="challenge"?"challenge":"attack";
 neutralRegionAction.disabled=true;
 neutralRegionMessage.textContent=endpoint==="garrison"?"İlk garnizon kuruluyor…":endpoint==="challenge"?"Muhafızlarla savaş başlıyor…":"Rakip garnizona saldırı gönderiliyor…";
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
  neutralRegionAction.disabled=false;
 }
});

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
