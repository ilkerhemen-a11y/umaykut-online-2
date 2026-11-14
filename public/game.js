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
  loadWorldMap();
}
async function loadWorldMap(){
  try{
    const data=await api("/api/world");
    const layer=$("#resourceMapNodes");
    if(!layer)return;
    layer.replaceChildren();
    const icons={food:"🌾",wood:"🌳",stone:"🪨",iron:"⛏️",gold:"🪙"};
    const names={food:"Tahıl",wood:"Odun",stone:"Taş",iron:"Demir",gold:"Altın"};
    (data.resources||[]).forEach(node=>{
      const marker=document.createElement("button");
      marker.type="button";marker.className="resource-node";
      marker.style.left=Number(node.x)+"%";marker.style.top=Number(node.y)+"%";
      marker.title=names[node.resource_type]+" · Seviye "+node.level;
      const icon=document.createElement("span");icon.textContent=icons[node.resource_type]||"📍";
      const label=document.createElement("small");label.textContent=names[node.resource_type]+" · Sv."+node.level;
      marker.append(icon,label);layer.append(marker);
    });
  }catch(error){console.error("Dünya haritası yüklenemedi:",error);}
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
const siegeImages={mancinik:"data:image/jpeg;base64,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",topcu:"data:image/jpeg;base64,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"};
function renderUnits(units){
  const container=$("#unitCatalog");container.replaceChildren();
  const icons=["🪓","🏹","🛡️","⚔️","🐎","🏹","🐎","🪨","💣"];
  units.forEach((unit,index)=>{
    const card=document.createElement("article");card.className="unit-card";
    const art=document.createElement("div");art.className="unit-art";
    if(siegeImages[unit.id]){const image=document.createElement("img");image.src=siegeImages[unit.id];image.alt=unit.role;art.append(image);}
    else art.textContent=icons[index];
    const heading=document.createElement("h3");heading.textContent=unit.role;
    const meta=document.createElement("p");meta.className="unit-meta";meta.textContent=unit.building+" · Seviye "+unit.level;
    const count=document.createElement("p");count.className="unit-count";count.textContent="Ordudaki mevcut: "+Number(unit.quantity).toLocaleString("tr-TR");
    const stats=document.createElement("dl");stats.className="unit-stats";
    [["⚔️","Saldırı",unit.stats.attack],["🛡️","Piyadelere karşı savunma",unit.stats.infantryDefense],["🟣","Atlılara karşı savunma",unit.stats.cavalryDefense],["🏃","Hareket hızı",unit.stats.movementSpeed],["💰","Yağma taşıma kapasitesi",unit.stats.carryCapacity]].forEach(([icon,label,value])=>{const row=document.createElement("div");const dt=document.createElement("dt");dt.textContent=icon+" "+label;const dd=document.createElement("dd");dd.textContent=String(value);row.append(dt,dd);stats.append(row);});
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
  const unitNames={barracks_1:"Piyade",archer:"Okçu",barracks_5:"Kalkanlı",barracks_10:"Elit muhafız",stable_1:"Hafif süvari",stable_5:"Atlı okçu",stable_10:"Ağır süvari",mancinik:"Mancınık",topcu:"Topçu"};
  const message=document.createElement("p");message.textContent=(unitNames[activeTraining.unit_id]||activeTraining.unit_id)+" · "+activeTraining.quantity+" asker hazırlanıyor.";panel.append(message);
  const timer=document.createElement("strong");timer.id="trainingCountdown";timer.className="training-countdown";panel.append(timer);updateTrainingCountdown();
  const note=document.createElement("small");note.textContent="Eğitim sunucu saatine göre ilerler. Tamamlandığında askerler otomatik olarak orduya eklenir.";panel.append(note);
}
$("#openUnits").addEventListener("click",openUnits);
$("#backVillageFromUnits").addEventListener("click",()=>show("village"));


let economyRefreshTimer=null;
async function openEconomy(){
  show("economyScreen");
  await loadEconomy();
  if(economyRefreshTimer)clearInterval(economyRefreshTimer);
  economyRefreshTimer=setInterval(()=>loadEconomy(true),30000);
}
async function loadEconomy(silent=false){
  try{
    const data=await api("/api/economy/me");
    renderEconomy(data);
    const r=data.resources;
    for(const key of ["food","wood","stone","iron","gold","horses"])$("#"+key).textContent=Number(r[key]||0).toLocaleString("tr-TR");
  }catch(error){
    if(!silent)$("#economyMessage").textContent=error.message;
  }
}
function renderEconomy(data){
  const summary=$("#workerSummary");
  summary.replaceChildren();
  const headline=document.createElement("strong");
  headline.textContent=Number(data.availableWorkers).toLocaleString("tr-TR")+" / "+Number(data.workerPool).toLocaleString("tr-TR")+" boşta işçi";
  const detail=document.createElement("span");
  detail.textContent="Atanan: "+Number(data.assignedWorkers).toLocaleString("tr-TR")+" · Merkez seviyesi: "+data.centerLevel+" · Kaynak başına sınır: "+Number(data.maxWorkersPerNode).toLocaleString("tr-TR");
  summary.append(headline,detail);
  const list=$("#resourceNodeList");
  list.replaceChildren();
  data.nodes.forEach(node=>{
    const card=document.createElement("article");card.className="resource-node-card";
    const title=document.createElement("h3");title.textContent=node.icon+" "+node.name;
    const coords=document.createElement("small");coords.textContent="Harita koordinatı: ("+node.x+", "+node.y+")";
    const production=document.createElement("p");
    const perHour=node.workersAssigned*node.yieldPerWorkerHour;
    production.textContent="Mevcut üretim: "+perHour.toLocaleString("tr-TR",{maximumFractionDigits:2})+" / saat · İşçi sınırı: "+node.maxWorkers;
    const label=document.createElement("label");label.textContent="Gönderilecek işçi sayısı";
    const input=document.createElement("input");input.type="number";input.min="0";input.max=String(node.maxWorkers);input.step="1";input.value=String(node.workersAssigned);input.className="worker-input";
    const save=document.createElement("button");save.type="button";save.className="train-button";save.textContent="İŞÇİLERİ GÖNDER";
    save.addEventListener("click",async()=>{
      const amount=Number(input.value);
      if(!Number.isSafeInteger(amount)||amount<0||amount>node.maxWorkers){$("#economyMessage").textContent="Bu kaynak noktası için 0 ile "+node.maxWorkers+" arasında işçi girmelisin.";return;}
      save.disabled=true;save.textContent="KAYDEDİLİYOR…";
      try{
        const result=await api("/api/economy/assign",{method:"POST",body:JSON.stringify({nodeId:node.id,workers:amount})});
        $("#economyMessage").textContent=result.message;
        await loadEconomy(true);
      }catch(error){$("#economyMessage").textContent=error.message;}
      finally{save.disabled=false;save.textContent="İŞÇİLERİ GÖNDER";}
    });
    card.append(title,coords,production,label,input,save);list.append(card);
  });
}
$("#backVillageFromEconomy").addEventListener("click",()=>show("village"));

async function loadPlayerData(){
  try{
    const [city,army]=await Promise.all([api("/api/city/me"),api("/api/army/me")]);
    const c=city.city;
    $("#myVillage b").textContent=c.city_name;
    $("#myVillage small").textContent="Merkez · Sv. "+c.level;
    document.querySelector(".village-title").innerHTML=c.city_name.toUpperCase()+" <small>BOZKIRIN KALBİ</small>";
    document.querySelector("#village .server").textContent=c.city_name.toUpperCase()+" · SEVİYE "+c.level;
    for(const key of ["wood","stone","iron","food","gold","horses"])$("#"+key).textContent=Number(c[key]||0).toLocaleString("tr-TR");
    renderArmy(army);
  }catch(error){console.error("Oyuncu verileri yüklenemedi:",error);}
}
function renderArmy(army){
  const units=army.units||[];
  const summary=$("#armyCarrySummary");
  if(summary)summary.textContent="💰 Toplam yağma taşıma kapasitesi: "+Number(army.totalCarryCapacity||0).toLocaleString("tr-TR");
  const strip=document.querySelector(".army-strip .units");
  strip.replaceChildren();
  const icons=["🪓","🏹","🛡️","⚔️","🐎","🏹","🐎"];
  units.forEach((unit,index)=>{
    const item=document.createElement("div");
    const icon=document.createElement("span");
    if(siegeImages[unit.id]){const image=document.createElement("img");image.src=siegeImages[unit.id];image.alt=unit.role;image.className="army-unit-image";icon.append(image);}
    else icon.textContent=icons[index]||"⚔️";
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
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{if(b.dataset.action==="Üretim"){openEconomy();return;}modal(b.dataset.action,"Bu bölümün oyun sistemi bir sonraki geliştirme aşamasında eklenecek.");});
$("#modalAction").onclick=()=>$("#modal").classList.remove("open");
if(token){api("/api/city/me").then(()=>enterGame({username:"Oyuncu"})).catch(()=>{localStorage.removeItem("umaykut_token");token=null;});}
