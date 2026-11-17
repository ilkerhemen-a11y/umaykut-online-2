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

const resourceInfo={
 grain:{name:"Tahıl Ovası",type:"TAHIL BÖLGESİ",description:"Tahıl toplamak için işçilerini bu ovaya görevlendir.",counter:"assigned-grain"},
 wood:{name:"Orman",type:"ODUN BÖLGESİ",description:"Odun toplamak için işçilerini ormanlık alana görevlendir.",counter:"assigned-wood"},
 stone:{name:"Taş Ocağı",type:"TAŞ BÖLGESİ",description:"Taş toplamak için işçilerini taş ocağına görevlendir.",counter:"assigned-stone"}
};
const assigned={grain:0,wood:0,stone:0};
let availableWorkers=1800;
let selectedResource=null;
const availableLabel=document.querySelector("#workers-available");
const resourcePanel=document.querySelector("#resource-selection");
const mapPrompt=document.querySelector("#map-prompt");
const resourceType=document.querySelector("#resource-type");
const resourceName=document.querySelector("#resource-name");
const resourceDescription=document.querySelector("#resource-description");
const workerInput=document.querySelector("#worker-count");
const workerStatus=document.querySelector("#worker-status");
const assignButton=document.querySelector("#assign-workers");
function formatNumber(value){return new Intl.NumberFormat("tr-TR").format(value);}
function updateWorkerSummary(){
 availableLabel.textContent=formatNumber(availableWorkers);
 workerInput.max=String(availableWorkers);
}
document.querySelectorAll("[data-resource]").forEach(button=>{
 button.addEventListener("click",()=>{
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
  workerInput.value="0";
  workerInput.max=String(availableWorkers);
  workerStatus.textContent=`Boştaki işçi: ${formatNumber(availableWorkers)} · Bu bir arayüz önizlemesidir.`;
 });
});
assignButton.addEventListener("click",()=>{
 if(!selectedResource)return;
 const count=Math.floor(Number(workerInput.value));
 if(!Number.isFinite(count)||count<1){
  workerStatus.textContent="Lütfen 1 veya daha fazla işçi sayısı gir.";
  return;
 }
 if(count>availableWorkers){
  workerStatus.textContent=`En fazla ${formatNumber(availableWorkers)} işçi gönderebilirsin.`;
  workerInput.value=String(availableWorkers);
  return;
 }
 assigned[selectedResource]+=count;
 availableWorkers-=count;
 const info=resourceInfo[selectedResource];
 document.querySelector("#"+info.counter).textContent=formatNumber(assigned[selectedResource])+" işçi";
 updateWorkerSummary();
 workerInput.value="0";
 workerStatus.textContent=`Önizleme: ${formatNumber(count)} işçi ${info.name} bölgesine ayrıldı. Kalan işçi: ${formatNumber(availableWorkers)}.`;
});
updateWorkerSummary();
