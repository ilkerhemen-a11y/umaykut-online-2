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
