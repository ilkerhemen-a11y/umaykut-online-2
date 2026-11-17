const factions={
 hun:{name:"Hun diyarı",themeColor:"#7b2528"},
 seljuk:{name:"Selçuklu diyarı",themeColor:"#8d6a2d"},
 gokturk:{name:"Göktürk diyarı",themeColor:"#176b83"}
};
const shell=document.querySelector(".game-shell");
const factionLabel=document.querySelector("#realm-faction");
let gameStateReady=false;
function setFaction(key){
 const faction=factions[key] ? key : "gokturk";
 shell.dataset.faction=faction;
 factionLabel.textContent=factions[faction].name;
 document.querySelector('meta[name="theme-color"]').content=factions[faction].themeColor;
 document.querySelectorAll("[data-faction-choice]").forEach(button=>{
  const active=button.dataset.factionChoice===faction;
  button.setAttribute("aria-pressed",String(active));
  button.classList.toggle("selected",active);
 });
 try{localStorage.setItem("umaykut-faction-v2",faction);}catch{}
}
document.querySelectorAll("[data-faction-choice]").forEach(button=>{
 button.addEventListener("click",()=>{
  setFaction(button.dataset.factionChoice);
  if(gameStateReady) persistGameState().catch(()=>{});
 });
});
let savedFaction="gokturk";
try{savedFaction=localStorage.getItem("umaykut-faction-v2")||"gokturk";}catch{}
setFaction(savedFaction);

const DEFAULT_RESOURCES={gold:1650,wood:6900,food:9350,stone:7480,iron:8040,horses:100};
const BUILDING_TYPES={
 center:{name:"Merkez Binası",icon:"🏰",description:"Yurdunun kalbi. Diğer yapıların gelişimini yönetir."},
 barracks:{name:"Kışla",icon:"⚔️",description:"Piyade ve savunma birliklerinin yetiştirileceği yapı."},
 lumberyard:{name:"Oduncu Ocağı",icon:"🪵",description:"Odun üretimini geliştirecek yapı."},
 quarry:{name:"Taş Ocağı",icon:"🪨",description:"Taş üretimini geliştirecek yapı."},
 ironmine:{name:"Demir Madeni",icon:"⛏️",description:"Demir üretimini geliştirecek yapı."},
 farm:{name:"Çiftlik",icon:"🌾",description:"Yiyecek üretimini geliştirecek yapı."},
 stable:{name:"Ahır",icon:"🐎",description:"Atlı birlikler için gerekli altyapı."},
 market:{name:"Pazar",icon:"🏪",description:"Kaynak ve ticaret işlemlerinin merkezi."},
 warehouse:{name:"Depo",icon:"📦",description:"Kaynaklarını saklamak için kullanılan yapı."}
};
const BUILDING_SLOT_TYPES={
 "1":"center","2":"barracks","3":"stable","4":"lumberyard",
 "5":"farm","6":"quarry","7":"ironmine","8":"market","9":"warehouse"
};
const BUILDING_BASE_COST={wood:30,stone:20,iron:5};
const MAX_BUILDING_LEVEL=10;
let gameResources={...DEFAULT_RESOURCES};
let gameBuildings={"1":{type:"center",level:1}};
function renderResourceBalances(){
 for(const key of Object.keys(DEFAULT_RESOURCES)){
  const node=document.querySelector("#resource-"+key);
  if(node)node.textContent=formatNumber(Number(gameResources[key]??0));
 }
}
function renderBuildingMarkers(){
 document.querySelectorAll("[data-building-slot]").forEach(node=>{
  const slot=node.dataset.buildingSlot;
  const building=gameBuildings[slot];
  const type=building?.type||BUILDING_SLOT_TYPES[slot]||"barracks";
  const definition=BUILDING_TYPES[type]||BUILDING_TYPES.center;
  const label=node.querySelector(".building-label");
  if(label)label.textContent=definition.shortName||definition.name;
  node.classList.toggle("is-built",Boolean(building));
  node.setAttribute("aria-label",slot+" numaralı "+definition.name+(building?" seviye "+building.level:" planlanan bina"));
  if(building)node.dataset.level=String(building.level);
  else delete node.dataset.level;
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
const buildingTypeField=document.querySelector("#building-type-field");
const buildingTypeSelect=document.querySelector("#building-type");
const buildingCostTitle=document.querySelector("#building-cost-title");
const buildingCostWood=document.querySelector("#building-cost-wood");
const buildingCostStone=document.querySelector("#building-cost-stone");
const buildingCostIron=document.querySelector("#building-cost-iron");
const buildingMessage=document.querySelector("#building-message");
const buildingAction=document.querySelector("#building-action");
let selectedBuildingSlot=1;
function buildingCostFor(targetLevel){
 return Object.fromEntries(Object.entries(BUILDING_BASE_COST).map(([key,value])=>[key,value*targetLevel]));
}
function updateBuildingDialog(){
 const slot=String(selectedBuildingSlot);
 const building=gameBuildings[slot]||null;
 const definition=building?BUILDING_TYPES[building.type]:null;
 const targetLevel=building?building.level+1:1;
 const atMaximum=Boolean(building&&building.level>=MAX_BUILDING_LEVEL);
 const selectedType=building?building.type:buildingTypeSelect.value;
 const selectedDefinition=BUILDING_TYPES[selectedType]||BUILDING_TYPES.barracks;
 const cost=buildingCostFor(targetLevel);
 buildingEmblem.textContent=(definition||selectedDefinition).icon;
 buildingEyebrow.textContent="İNŞA ALANI "+slot;
 buildingTitle.textContent=definition?definition.name:(slot==="1"?"Merkez Binası":"Yeni Bina İnşa Et");
 buildingDescription.textContent=definition?definition.description:(slot==="1"?"Merkez binası oyun başlangıcında hazırdır.":"Bu alana yerleşecek yapıyı seç.");
 buildingLevel.textContent=building?building.level+" / "+MAX_BUILDING_LEVEL:"Boş alan";
 buildingLevelFill.style.width=(building?building.level/MAX_BUILDING_LEVEL*100:0)+"%";
 buildingTypeField.hidden=Boolean(building)||slot==="1";
 buildingCostTitle.textContent=atMaximum?"En yüksek seviyeye ulaşıldı":(building?"Seviye "+targetLevel+" yükseltme maliyeti":"İnşa maliyeti");
 buildingCostWood.textContent=formatNumber(cost.wood);
 buildingCostStone.textContent=formatNumber(cost.stone);
 buildingCostIron.textContent=formatNumber(cost.iron);
 const enough=Object.entries(cost).every(([key,value])=>Number(gameResources[key]||0)>=value);
 if(atMaximum){
  buildingMessage.textContent="Bu bina en yüksek seviye olan 10'a ulaştı.";
 }else if(!enough){
  const missing=Object.entries(cost).filter(([key,value])=>Number(gameResources[key]||0)<value).map(([key,value])=>{
   const labels={wood:"odun",stone:"taş",iron:"demir"};
   return labels[key]+" "+formatNumber(value-Number(gameResources[key]||0));
  });
  buildingMessage.textContent="Eksik kaynak: "+missing.join(", ");
 }else{
  buildingMessage.textContent=building?"Bir sonraki seviye için gerekli kaynaklar hazır.":"Bu yapıyı inşa etmek için gerekli kaynaklar hazır.";
 }
 buildingAction.textContent=atMaximum?"Maksimum Seviye":(building?"Seviye "+targetLevel+" Yükselt":"İnşa Et");
 buildingAction.disabled=atMaximum||!enough||!authToken;
}
function openBuildingDialog(slot){
 selectedBuildingSlot=Number(slot);
 if(!gameBuildings[String(selectedBuildingSlot)]){
  buildingTypeSelect.value=BUILDING_SLOT_TYPES[String(selectedBuildingSlot)]||"barracks";
 }
 buildingMessage.textContent="";
 updateBuildingDialog();
 if(typeof buildingDialog.showModal==="function")buildingDialog.showModal();
 else buildingDialog.setAttribute("open","");
}
document.querySelectorAll("[data-building-slot]").forEach(node=>{
 node.addEventListener("click",()=>openBuildingDialog(node.dataset.buildingSlot));
});
buildingClose.addEventListener("click",()=>buildingDialog.close());
buildingTypeSelect.addEventListener("change",updateBuildingDialog);
buildingAction.addEventListener("click",async()=>{
 const slot=String(selectedBuildingSlot);
 const existing=gameBuildings[slot];
 const body={action:existing?"upgrade":"construct",slot:selectedBuildingSlot};
 if(!existing)body.type=buildingTypeSelect.value;
 buildingAction.disabled=true;
 buildingMessage.textContent="İşlem gerçekleştiriliyor…";
 try{
  const result=await authRequest("/api/game/buildings",{method:"POST",token:authToken,body});
  gameResources=result.resources;
  gameBuildings=result.buildings;
  renderResourceBalances();
  renderBuildingMarkers();
  const definition=BUILDING_TYPES[result.building.type]||BUILDING_TYPES.center;
  buildingMessage.textContent=definition.name+" "+result.building.level+". seviyeye ulaştı. Kaynakların hesabına kaydedildi.";
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
  if(state.factionId) setFaction(state.factionId);
  else setFaction(savedFaction);
  if(state.resources&&typeof state.resources==="object")gameResources={...DEFAULT_RESOURCES,...state.resources};
  if(state.buildings&&typeof state.buildings==="object")gameBuildings=state.buildings;
  renderResourceBalances();
  renderBuildingMarkers();
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
 }catch(error){
  gameStateReady=false;
  restoreWorkerState();
  updateWorkerSummary();
  if(workerStatus)workerStatus.textContent="Sunucu eşitlemesi yapılamadı; yerel kayıt korunuyor.";
 }
}

function enterGame(player,token){
 authToken=token||authToken;
 try{if(authToken)localStorage.setItem(AUTH_TOKEN_KEY,authToken);}catch{}
 const username=player?.username||"Oyuncu";
 const displayName=document.querySelector("#player-display-name");
 const realmName=document.querySelector("#realm-player-name");
 if(displayName)displayName.textContent=username+" Bey";
 if(realmName)realmName.textContent=username.toLocaleUpperCase("tr-TR")+"’İN YURDU";
 authScreen.hidden=true;
 gameShell.removeAttribute("inert");
 loadGameState();
 gameShell.removeAttribute("aria-hidden");
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
  enterGame(data.player,data.token);
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
  enterGame(data.player,savedToken);
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
setAuthMode("login");
restoreAccountSession();
