const factions={
 hun:{name:"Hun diyarı",themeColor:"#7b2528"},
 seljuk:{name:"Selçuklu diyarı",themeColor:"#8d6a2d"},
 gokturk:{name:"Göktürk diyarı",themeColor:"#176b83"}
};
const shell=document.querySelector(".game-shell");
const factionLabel=document.querySelector("#realm-faction");
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
 button.addEventListener("click",()=>setFaction(button.dataset.factionChoice));
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
 workerStatus.textContent=`${formatNumber(count)} işçi ${resourceInfo[selectedResource].name} bölgesine gönderildi. ${formatNumber(assigned[selectedResource])} görevde, ${formatNumber(availableWorkers)} boştadır. Bu cihazda kaydedildi.`;
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
 workerStatus.textContent=`${formatNumber(count)} işçi ${resourceInfo[selectedResource].name} bölgesinden geri çağrıldı. ${formatNumber(assigned[selectedResource])} görevde, ${formatNumber(availableWorkers)} boştadır. Bu cihazda kaydedildi.`;
});
restoreWorkerState();
updateWorkerSummary();
