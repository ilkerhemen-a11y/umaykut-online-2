const $=s=>document.querySelector(s);
const API="";
let authMode="login", token=localStorage.getItem("umaykut_token"), currentPlayer=null, selectedFactionId=null, factionList=[];
const show=id=>{document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));$("#"+id).classList.add("active");window.scrollTo(0,0);};
function authTab(mode){authMode=mode;$("#loginTab").classList.toggle("selected",mode==="login");$("#registerTab").classList.toggle("selected",mode==="register");$("#authSubmit").textContent=mode==="login"?"Oyuna Giriş":"Hesap Oluştur";$("#password").autocomplete=mode==="login"?"current-password":"new-password";$("#authMessage").textContent="";}
$("#loginTab").onclick=()=>authTab("login");$("#registerTab").onclick=()=>authTab("register");
async function api(path,options={}){const response=await fetch(API+path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...(options.headers||{})}});const data=await response.json().catch(()=>({error:"Sunucu yanıtı okunamadı."}));if(!response.ok)throw new Error(data.error||"İşlem başarısız.");return data;}
async function enterGame(player){
  currentPlayer=player;
  $("#playerName").textContent=player.username.toUpperCase();
  $("#authScreen").classList.add("hidden");
  try{
    const result=await api("/api/faction/me");
    if(!result.faction){await openFactionSelection();return;}
    finishEnteringWorld(result.faction);
  }catch(error){
    $("#authScreen").classList.remove("hidden");
    $("#authMessage").textContent=error.message;
  }
}
function finishEnteringWorld(faction){
  $("#factionScreen").classList.add("hidden");
  $("#playerName").textContent=(currentPlayer?.username||"OYUNCU").toUpperCase()+" · "+faction.name.toLocaleUpperCase("tr-TR");
  $("#world").classList.add("active");
  loadPlayerData();
}
async function openFactionSelection(){
  selectedFactionId=null;
  $("#confirmFaction").disabled=true;
  $("#factionMessage").textContent="Devletini seçmek için bir karta dokun.";
  $("#factionScreen").classList.remove("hidden");
  try{
    const data=await api("/api/factions");
    factionList=data.factions;
    renderFactionCards();
  }catch(error){$("#factionMessage").textContent=error.message;}
}
function renderFactionCards(){
  const container=$("#factionCards");
  container.replaceChildren();
  factionList.forEach(faction=>{
    const card=document.createElement("button");
    card.type="button";
    card.className="faction-card";
    card.dataset.factionId=faction.id;
    card.style.setProperty("--faction-accent",faction.colors[0]);
    const emblem=document.createElement("span");emblem.className="faction-emblem";emblem.textContent=faction.emblem;
    const name=document.createElement("strong");name.textContent=faction.name;
    const style=document.createElement("span");style.className="faction-style";style.textContent=faction.style;
    const desc=document.createElement("span");desc.className="faction-description";desc.textContent=faction.description;
    const motto=document.createElement("em");motto.className="faction-motto";motto.textContent="“"+faction.motto+"”";
    const region=document.createElement("span");region.className="faction-region";region.textContent="Başlangıç yurdu: "+faction.startingRegion;
    const bonuses=document.createElement("span");bonuses.className="faction-bonuses";bonuses.textContent=faction.bonusLabels.join(" · ");
    [emblem,name,style,desc,motto,region,bonuses].forEach(node=>card.append(node));
    card.addEventListener("click",()=>{
      selectedFactionId=faction.id;
      container.querySelectorAll(".faction-card").forEach(item=>item.classList.toggle("selected",item.dataset.factionId===faction.id));
      $("#confirmFaction").disabled=false;
      $("#factionMessage").textContent=faction.name+" seçildi. Onayladığında devletin hesabına kalıcı olarak kaydedilecek.";
      $("#confirmFaction").textContent=faction.name.toLocaleUpperCase("tr-TR")+" OLARAK BAŞLA";
    });
    container.append(card);
  });
}
$("#confirmFaction").addEventListener("click",async()=>{
  if(!selectedFactionId)return;
  const button=$("#confirmFaction");
  button.disabled=true;button.textContent="KAYDEDİLİYOR…";
  try{
    const result=await api("/api/faction/select",{method:"POST",body:JSON.stringify({factionId:selectedFactionId})});
    $("#factionMessage").textContent=result.message;
    finishEnteringWorld(result.faction);
  }catch(error){
    $("#factionMessage").textContent=error.message;
    button.disabled=false;
    button.textContent="DEVLETİMİ SEÇ";
  }
});

let trainingPoll=null,trainingClock=null,activeTraining=null;
async function openUnits(){
  show("unitsScreen");
  $("#unitCatalog").textContent="Askerler yükleniyor…";
  try{
    const [catalog,army,training]=await Promise.all([api("/api/units/me"),api("/api/army/me"),api("/api/training/me")]);
    $("#unitsFactionTitle").textContent=catalog.factionName.toLocaleUpperCase("tr-TR");
    const counts=new Map(army.units.map(unit=>[unit.id,unit.quantity]));
    renderUnits(catalog.units.map(unit=>({...unit,quantity:counts.get(unit.id)||0})));
    activeTraining=training.activeTraining;
    renderTrainingStatus();
    if(trainingPoll)clearInterval(trainingPoll);
    if(trainingClock)clearInterval(trainingClock);
    trainingPoll=setInterval(refreshTraining,5000);
    trainingClock=setInterval(updateTrainingCountdown,1000);
  }catch(error){$("#unitCatalog").textContent=error.message;}
}
function renderUnits(units){
  const container=$("#unitCatalog");container.replaceChildren();
  const icons=["🪓","🏹","🛡️","⚔️","🐎","🏹","🐎"];
  units.forEach((unit,index)=>{
    const card=document.createElement("article");card.className="unit-card";
    const art=document.createElement("div");art.className="unit-art";art.textContent=icons[index];
    const heading=document.createElement("h3");heading.textContent=unit.role;
    const meta=document.createElement("p");meta.className="unit-meta";meta.textContent=unit.building+" · Seviye "+unit.level;
    const count=document.createElement("p");count.className="unit-count";count.textContent="Ordudaki mevcut: "+Number(unit.quantity).toLocaleString("tr-TR");
    const stats=document.createElement("dl");stats.className="unit-stats";
    [["⚔️","Saldırı",unit.stats.attack],["🛡️","Savunma",unit.stats.defense],["🟣","Özel savunma",unit.stats.specialDefense],["🏃","Hız",unit.stats.speed],["🌾","Yiyecek maliyeti",unit.stats.foodCost]].forEach(([icon,label,value])=>{const row=document.createElement("div");const dt=document.createElement("dt");dt.textContent=icon+" "+label;const dd=document.createElement("dd");dd.textContent=String(value);row.append(dt,dd);stats.append(row);});
    const quantityLabel=document.createElement("label");quantityLabel.className="training-quantity-label";quantityLabel.textContent="Eğitilecek asker";
    const quantity=document.createElement("input");quantity.type="number";quantity.min="1";quantity.max="100";quantity.value="1";quantity.className="training-quantity";quantity.setAttribute("aria-label",unit.role+" eğitim adedi");
    const button=document.createElement("button");button.type="button";button.className="train-button";button.textContent="EĞİTİME BAŞLA";button.addEventListener("click",()=>beginTraining(unit.id,quantity.value,button));
    card.append(art,heading,meta,count,stats,quantityLabel,quantity,button);container.append(card);
  });
}
async function beginTraining(unitId,quantity,button){
  button.disabled=true;button.textContent="BAŞLATILIYOR…";
  try{
    const result=await api("/api/training/start",{method:"POST",body:JSON.stringify({unitId,quantity:Number(quantity)})});
    activeTraining=result.activeTraining;renderTrainingStatus();
    await loadPlayerData();
  }catch(error){modal("Eğitim başlatılamadı",error.message,"Tamam");}
  finally{button.disabled=false;button.textContent="EĞİTİME BAŞLA";}
}
async function refreshTraining(){
  try{
    const previous=activeTraining?.id;
    const result=await api("/api/training/me");
    activeTraining=result.activeTraining;
    renderTrainingStatus();
    if(previous&&!activeTraining)await loadPlayerData();
  }catch(error){console.error("Eğitim durumu alınamadı:",error);}
}
function updateTrainingCountdown(){
  const countdown=$("#trainingCountdown");
  if(!countdown||!activeTraining)return;
  const remaining=Math.max(0,Math.ceil((new Date(activeTraining.finishes_at).getTime()-Date.now())/1000));
  const minutes=Math.floor(remaining/60),seconds=remaining%60;
  countdown.textContent=minutes+":"+String(seconds).padStart(2,"0");
}
function renderTrainingStatus(){
  const panel=$("#trainingStatus");panel.replaceChildren();
  const title=document.createElement("b");title.textContent="ASKER EĞİTİMİ";panel.append(title);
  if(!activeTraining){
    const message=document.createElement("p");message.textContent="Şu anda aktif eğitim yok. Bir asker seçerek eğitime başlayabilirsin.";panel.append(message);return;
  }
  const unitNames={barracks_1:"Piyade",archer:"Okçu",barracks_5:"Kalkanlı",barracks_10:"Elit muhafız",stable_1:"Hafif süvari",stable_5:"Atlı okçu",stable_10:"Ağır süvari"};
  const message=document.createElement("p");message.textContent=(unitNames[activeTraining.unit_id]||activeTraining.unit_id)+" · "+activeTraining.quantity+" asker hazırlanıyor.";panel.append(message);
  const timer=document.createElement("strong");timer.id="trainingCountdown";timer.className="training-countdown";panel.append(timer);updateTrainingCountdown();
  const note=document.createElement("small");note.textContent="Eğitim sunucu saatine göre ilerler. Tamamlandığında askerler otomatik olarak orduya eklenir.";panel.append(note);
}
$("#openUnits").addEventListener("click",openUnits);
$("#backVillageFromUnits").addEventListener("click",()=>show("village"));

async function loadPlayerData(){
  try{
    const [city,army]=await Promise.all([api("/api/city/me"),api("/api/army/me")]);
    const c=city.city;
    $("#myVillage b").textContent=c.city_name;
    $("#myVillage small").textContent="Merkez · Sv. "+c.level;
    document.querySelector(".village-title").innerHTML=c.city_name.toUpperCase()+" <small>BOZKIRIN KALBİ</small>";
    document.querySelector("#village .server").textContent=c.city_name.toUpperCase()+" · SEVİYE "+c.level;
    for(const key of ["wood","stone","iron","food"])$("#"+key).textContent=Number(c[key]).toLocaleString("tr-TR");
    renderArmy(army.units);
  }catch(error){console.error("Oyuncu verileri yüklenemedi:",error);}
}
function renderArmy(units){
  const strip=document.querySelector(".army-strip .units");
  strip.replaceChildren();
  const icons=["🪓","🏹","🛡️","⚔️","🐎","🏹","🐎"];
  units.forEach((unit,index)=>{
    const item=document.createElement("div");
    const icon=document.createElement("span");icon.textContent=icons[index]||"⚔️";
    const name=document.createElement("small");name.textContent=unit.role;
    const quantity=document.createElement("b");quantity.textContent=Number(unit.quantity).toLocaleString("tr-TR");
    item.append(icon,name,quantity);strip.append(item);
  });
}
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();const username=$("#username").value.trim(),password=$("#password").value;$("#authSubmit").disabled=true;$("#authMessage").textContent="Sunucuya bağlanılıyor…";try{const data=await api(authMode==="login"?"/api/auth/login":"/api/auth/register",{method:"POST",body:JSON.stringify({username,password})});token=data.token;localStorage.setItem("umaykut_token",token);await enterGame(data.player);}catch(error){$("#authMessage").textContent=error.message;}finally{$("#authSubmit").disabled=false;}});
$("#enterVillage").onclick=()=>show("village");$("#goHome").onclick=()=>show("village");$("#myVillage").onclick=()=>show("village");$("#backWorld").onclick=()=>show("world");
function modal(title,desc,action="Geliştirme bilgisi"){$("#modalTitle").textContent=title;$("#modalText").textContent=desc;$("#modalAction").textContent=action;$("#modal").classList.add("open");}
$("#closeModal").onclick=()=>$("#modal").classList.remove("open");
document.querySelectorAll("[data-building]").forEach(b=>b.onclick=()=>{if(b.dataset.building==="Kışla"||b.dataset.building==="Ahır"){openUnits();return;}modal(b.dataset.building,"Bu yapı köy ekonomisine ve savunmasına katkı sağlar. Gerçek yükseltme sistemi sıradaki aşamada bağlanacak.","Yakında aktif");});
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>modal(b.dataset.action,"Bu bölümün oyun sistemi bir sonraki geliştirme aşamasında eklenecek."));
$("#modalAction").onclick=()=>$("#modal").classList.remove("open");
if(token){api("/api/city/me").then(()=>enterGame({username:"Oyuncu"})).catch(()=>{localStorage.removeItem("umaykut_token");token=null;});}
