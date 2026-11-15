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
  const villagePlayer=$("#villagePlayerName");if(villagePlayer)villagePlayer.textContent=player.username+" Bey";
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
let worldMapScale=0.78,worldMapX=0,worldMapY=0,worldMapDragging=false,worldMapMoved=false,worldMapPointer=null;
function applyWorldMapTransform(){
 const content=$("#worldMapContent");if(!content)return;
 content.style.transform="translate(calc(-50% + "+worldMapX+"px),calc(-50% + "+worldMapY+"px)) scale("+worldMapScale+")";
 const coord=$("#mapCoordinate");if(coord)coord.textContent="BOZKIR · "+Math.round(50-worldMapX/20)+" / "+Math.round(50-worldMapY/20);
}
function setupWorldMapControls(){
 const viewport=$("#worldMapViewport");if(!viewport||viewport.dataset.controlsReady)return;
 viewport.dataset.controlsReady="1";
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 viewport.addEventListener("pointerdown",event=>{
  if(event.target.closest(".map-controls,.resource-node,.world-village"))return;
  worldMapDragging=true;worldMapMoved=false;worldMapPointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:worldMapX,startY:worldMapY};
  viewport.setPointerCapture(event.pointerId);viewport.classList.add("dragging");
 });
 viewport.addEventListener("pointermove",event=>{
  if(!worldMapDragging||!worldMapPointer||event.pointerId!==worldMapPointer.id)return;
  const dx=event.clientX-worldMapPointer.x,dy=event.clientY-worldMapPointer.y;
  if(Math.abs(dx)+Math.abs(dy)>5)worldMapMoved=true;
  if(worldMapMoved){worldMapX=clamp(worldMapPointer.startX+dx,-780,780);worldMapY=clamp(worldMapPointer.startY+dy,-540,540);applyWorldMapTransform();}
 });
 const endDrag=event=>{
  if(!worldMapPointer||event.pointerId!==worldMapPointer.id)return;
  worldMapDragging=false;worldMapPointer=null;viewport.classList.remove("dragging");
  if(worldMapMoved){viewport.classList.add("suppress-map-click");setTimeout(()=>viewport.classList.remove("suppress-map-click"),180);}
 };
 viewport.addEventListener("pointerup",endDrag);viewport.addEventListener("pointercancel",endDrag);
 viewport.addEventListener("wheel",event=>{event.preventDefault();worldMapScale=clamp(worldMapScale+(event.deltaY<0?.08:-.08),.48,1.35);applyWorldMapTransform();},{passive:false});
 $("#mapZoomIn").addEventListener("click",()=>{worldMapScale=clamp(worldMapScale+.12,.48,1.35);applyWorldMapTransform();});
 $("#mapZoomOut").addEventListener("click",()=>{worldMapScale=clamp(worldMapScale-.12,.48,1.35);applyWorldMapTransform();});
 $("#mapRecenter").addEventListener("click",()=>{worldMapScale=.78;worldMapX=0;worldMapY=0;applyWorldMapTransform();});
 viewport.addEventListener("click",event=>{if(viewport.classList.contains("suppress-map-click")){event.preventDefault();event.stopPropagation();}},{capture:true});
 applyWorldMapTransform();
}
async function loadWorldMap(){
  try{
    const data=await api("/api/world");
    const layer=$("#resourceMapNodes");
    if(!layer)return;
    layer.replaceChildren();
    setupWorldMapControls();
    const territory=document.createElement("div");
    territory.className="territory-ring";
    territory.setAttribute("aria-label","Sana ait küçük hâkimiyet alanı");
    layer.append(territory);
    const icons={food:"🌾",wood:"🪵",stone:"🪨",iron:"⛏️",gold:"🪙",horses:"🐎"};
    const names={food:"Tahıl",wood:"Odun",stone:"Taş",iron:"Demir",gold:"Altın",horses:"At"};
    (data.resources||[]).filter(node=>Object.hasOwn(icons,node.resource_type)).forEach(node=>{
      const marker=document.createElement("button");
      marker.type="button";marker.className="resource-node";
      marker.style.left=Number(node.x)+"%";marker.style.top=Number(node.y)+"%";
      marker.title=names[node.resource_type]+" · 6 Puan · İşçi göndermek için dokun";
      marker.setAttribute("aria-label",names[node.resource_type]+" 6 puanlık sana ait kaynak. İşçi göndermek için dokun.");
      const icon=document.createElement("img");icon.src="/assets/resources/"+node.resource_type+".svg";icon.alt=names[node.resource_type];icon.className="resource-art";
      const level=document.createElement("small");level.className="resource-level";level.textContent="6";
      const kind=document.createElement("small");kind.className="resource-kind";kind.textContent=names[node.resource_type];
      marker.append(icon,level,kind);
      marker.addEventListener("click",async()=>{
        try{
          const economy=await api("/api/economy/me");
          villageEconomy=economy;
          const ownNode=economy.nodes.find(item=>item.id===Number(node.id));
          if(ownNode){openWorkerAssignment(ownNode);}
          else{modal("Kaynak bulunamadı","Bu maden sana ait değil veya artık kullanılamıyor.","Anladım");}
        }catch(error){modal("Kaynak bilgisi alınamadı",error.message,"Tamam");}
      });
      layer.append(marker);
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

let activeTraining=null;
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
  }catch(error){$("#unitCatalog").textContent=error.message;}
}
const siegeImages={mancinik:"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgwKCA0MCwwPDg0QFCIWFBISFCkdHxgiMSszMjArLy42PE1CNjlJOi4vQ1xESVBSV1dXNEFfZl5UZU1VV1P/2wBDAQ4PDxQSFCcWFidTNy83U1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1P/wAARCABiAHADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAABAUAAwYCAQf/xAA8EAACAQMDAgMDCQUJAQAAAAABAgMABBEFEiEGMRMiQRRRYRUWMlRxcnORsSQzNUNSByUmQkRTYmOhgf/EABcBAQEBAQAAAAAAAAAAAAAAAAECAAP/xAAZEQEBAQEBAQAAAAAAAAAAAAAAARECMSH/2gAMAwEAAhEDEQA/AFfUujJot3bRwzSSCVSTupfaW/tWoJAZHTKknbWi68cSajY5JGEPb7aTaNubXIz6FDUw0YenUUAi6lbJqfN9Cx/aZeKfFQAdvoa5OFGSe9II/m+n1mWp834x/qZadAhu1WKgxWJD83o/rMte/N1PrMvNP/DFdLHlvgKzM+3TiCQKLmXirF6WRhzcy08hXcxejVXgVOnGbXpOL6zLXY6RgPe7mrSBB76sA+AqbVYzI6Qh9Lyb/wAqq96WitrG4uEu52aNC2G7VrcY9BQetZ+R7vaf5RyDRK2Mn1a7fKNrv58hoPQudcj/AAzRnVYxqFoDz5DQugDGvR/hmuk9TWsK8CqrqJmjG0Zw2TRqpnBPau3QIB8TVUQhuLn2K4HiriMrkGj7WRLqISRng0Tf6Wl/DGrY8rZz8KtttPjtItsf0akhwueDVhXERPvolrf1HrXssaxqiucZPrRrYohh2JRQTFWrH2yKsCZ9KCoC17togJkZHaoY/hU1QfBoPWf4NefhGmRT4Uv1sY0e8/CNS1Y7qls39qf+Bqrp4Ea9Ge+Ymq7qdc6ha+7Ya46c56hjB9ImrtHOtnHGRG7gFtqk4pR8uW+DvfDBsFTTW5E5t2EB2lhj7aws8ElvdulyuGJ9RRavmN5b3sEkSujfHvVvt0AOSwI91Y/p52XUlQtuDHG34V9CW1i2g+EnbtihswsW8ilbKgkD3UPdXkdxdRxjIA9KZ3axW0JcIo+wVTp9mzM1xLGFJ7KRzUs8W7XaMRsxHuq+KVpjzGyAe+jRFGHGEA/+VHQPGVxye2KWYPVup7yz1e5ii2NCrYCgc0VofUsl7epZONpbnJoLqrpyCzmkv1kEiMeUHes3ZtOl3G9qrcHv7qlc8fYXT3DheKWa5H/ct6cfyjR+nu72ETSfSK5OaW9RXB+SLwKMjwjmlLF9WA+3WpPHlNc9Kjf1KhPYxtTD+0BUGoWIUYyhz+dB9GLv6pjX08JjXSOdb5INqHPoeK+f9RF7jU2dFJSNvMRX0e8fwrKWQ8YU1k7G1F1ouoTsOG3c0WL5ONB0qzSyhulhPiEA5zT1RgjPak3SrA6RGpByp2g5prcyiNSCefSsLQd6njXMUPdSaPxgAe4YoAybJY5G7g0wV1kAKnvQzyvR3qHg4rndggD1pBN1a4GjFDyzHGayfS7/ACbqfs0yq3igkbhmtD1dNhIYByWkX9aV63p7Q3dteQnJh4IHurnXXk9u9VaFxGhCkHHaqNVnV9Fu2JBzEfzpbeym8iE68Z9KU6heyrp8sJ7FTmtKLBHXTbtQss/0H9aH6LH+Koz/ANTVd1z/ABCy+4f1qrovnquMD/Zar5c+m26mm8DR5ADywwKr0e1EPS5BHMqZIoXqp/FltYFOdzgEVoYI1jslgx2XaBTWhB0XKDHcxsfoSHApvNa7p8vJhW9KzuiMLTWryPOOSSKJ1jUJECuj+VTk1ia+xJGeZchqugjW3HhlvJ33GsZfdT7xBhyArc0Zc9SpqNiVtydyihsa15RtL44Hb40JJchDikVp1Al3aRqp8yZBBqt71nbn0NFOB9dnM+o2kfqzA/8AtNdRAYPG39NZu4uAdeiJP7umE940tzuY8E4qKuQHBKfAaM/5TilmoNuhm+6aMvwYbttv0W5pdeN+zSk+q4onqr4Z9cj9vs/uH9aG6QmEHUyMx48JhRXXWPlCyGe6H9aSaY23WIypwdhrpPkcq2EsyXvUMYzxGN35Gnt1qqQpy4/Ovnkt9JBqErocFTtqiW+mlOWkJHuzU20yQ21C+8HVWniPEi4P21WuoPdsyScjHNAMslxChVGY59BmmVvYG3WEsrbnbz8dhW1i67tka7ESLtTGcmvdKf2W5k2jy9sURcmW81NY1XZEvZq4uUliZ2hjyzcc+lOt8eEj5QMkMZij9fiaYCR2dVPqaCildiFmHbvR1iRNc7M+baaKxdOwbWZ2B+iaua4bPfigVVhfT55ct2pnBYxrEZbp8ZGQBUnVl5tltrd15fgGluqKLaJkY8suaMtJTMk0QGAvmUmkWrTtNINxPHFVzPrWmOuMz31tvYt5T3OaE07+LL901KlXUurj99L96vFUZTgd6lSpLdaBFGIkIRc/ZR2oKuD5R+VSpQKUpGmPoL391dbFKN5R+VSpWAG5RQn0R+VDwgLIxUYPvFSpQYE04Btf5AOVPejr8AEAAdqlSsQEBPtDfZVVzGhtLglFztPOKlSq5D//2Q==",topcu:"data:image/jpeg;base64,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"};
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
    const button=document.createElement("button");button.type="button";button.className="train-button";button.textContent="ANINDA EĞİT";button.addEventListener("click",()=>beginTraining(unit.id,quantity.value,button));
    card.append(art,heading,meta,count,stats,quantityLabel,quantity,button);container.append(card);
  });
}
async function beginTraining(unitId,quantity,button){
  button.disabled=true;button.textContent="ORDUYA EKLENİYOR…";
  try{
    const result=await api("/api/training/start",{method:"POST",body:JSON.stringify({unitId,quantity:Number(quantity)})});
    activeTraining=null;
    modal("Askerler hazır!",result.message||"Askerlerin anında orduna eklendi.","Harika");
    await openUnits();
    await loadPlayerData();
  }catch(error){modal("Eğitim başlatılamadı",error.message,"Tamam");}
  finally{button.disabled=false;button.textContent="ANINDA EĞİT";}
}
function renderTrainingStatus(){
  const panel=$("#trainingStatus");panel.replaceChildren();
  const title=document.createElement("b");title.textContent="ASKER EĞİTİMİ";panel.append(title);
  const message=document.createElement("p");message.textContent="Bekleme süresi yok! Seçtiğin askerler eğit düğmesine bastığında anında orduna eklenir.";panel.append(message);
}
$("#openUnits").addEventListener("click",openUnits);
$("#backVillageFromUnits").addEventListener("click",()=>show("village"));


let villageEconomy=null, marketItems=[], constructionWorkers={active:0,max:3,available:3};
let selectedUpgradeBuilding=null, buildingSpeedupsAvailable=0, buildingTimerInterval=null;
const buildingCatalog={center:{name:"Merkez Binası",purpose:"Köyünün kalbi. Tüm şehir gelişimini yönetir."},shelter:{name:"Sığınak",purpose:"Düşman yağmalarına karşı kaynaklarının bir bölümünü korur."},temple:{name:"Tapınak",purpose:"Şehrinin işçi kapasitesini artırır."},school:{name:"Okul",purpose:"Üretime katkı sağlar, klan kapasitesini ve hâkimiyet alanını artırır."},barracks:{name:"Kışla",purpose:"Piyade birliklerinin kilidini açar ve eğitimini sağlar."},archery:{name:"Okçu Ocağı",purpose:"Okçu birliklerinin kilidini açar ve eğitimini sağlar."},stable:{name:"Ahır",purpose:"Süvari birliklerinin kilidini açar ve eğitimini sağlar."},workshop:{name:"Atölye",purpose:"Kuşatma makinelerinin kilidini açar ve üretimini sağlar."},stonemason:{name:"Taşçı",purpose:"Haritadaki taş madenlerinden elde edilen verimi artırır."},lumberjack:{name:"Keresteci",purpose:"Haritadaki odun kaynaklarından elde edilen verimi artırır."},blacksmith:{name:"Demirci",purpose:"Haritadaki demir madenlerinden elde edilen verimi artırır."},mill:{name:"Değirmen",purpose:"Tahıl üretimini destekler."},farm:{name:"Tarla",purpose:"Tahıl üretimini sağlar."},market:{name:"Pazar",purpose:"Altın üretimi ve kaynak takası sağlar."},wall:{name:"Sur",purpose:"Şehrinin savunmasını güçlendirir."}};
const buildingArt={shelter:"shelter",temple:"temple",school:"school",barracks:"barracks",archery:"archery",stable:"stable",workshop:"workshop",stonemason:"stonemason",lumberjack:"lumberjack",blacksmith:"blacksmith",mill:"mill",farm:"farm",market:"market",wall:"wall"};
function formatBuildTime(seconds){const s=Math.max(0,Math.ceil(seconds));return Math.floor(s/60)+" dk "+String(s%60).padStart(2,"0")+" sn";}
function updateBuildingTimer(){
 const el=$("#buildingUpgradeTimer");if(!el||!selectedUpgradeBuilding)return;
 if(!selectedUpgradeBuilding.upgradeFinishesAt){el.textContent="Geliştirme başlatılmadı.";return;}
 const remaining=(new Date(selectedUpgradeBuilding.upgradeFinishesAt).getTime()-Date.now())/1000;
 if(remaining<=0){el.textContent="Geliştirme tamamlandı!";if(!selectedUpgradeBuilding._completionRefresh){selectedUpgradeBuilding._completionRefresh=true;refreshBuildingsAndCity().then(()=>loadPlayerData()).catch(console.error);}return;}
 el.textContent="Kalan süre: "+formatBuildTime(remaining);
}
function openBuildingUpgrade(v){
 selectedUpgradeBuilding=v;
 $("#modalTitle").textContent=v.name+" · Seviye "+v.level+"/10";
 $("#modalText").textContent=(buildingCatalog[v.type]?.purpose||"Şehir binası.")+" İnşaat ekipleri: "+constructionWorkers.active+"/"+constructionWorkers.max+" çalışıyor.";
 $("#modalWorkerField").hidden=true;
 const crew=$("#constructionWorkersDisplay");crew.replaceChildren();for(let i=0;i<3;i++){const worker=document.createElement("span");worker.className="construction-worker"+(i<constructionWorkers.active?" working":"");worker.textContent=i<constructionWorkers.active?"👷":"🧑‍🔧";worker.title=i<constructionWorkers.active?"Yükseltmede çalışıyor":"Boşta";crew.append(worker);}const crewLabel=document.createElement("b");crewLabel.textContent="İnşaat ekipleri "+constructionWorkers.active+"/3";crew.append(crewLabel);
 $("#buildingUpgradeActions").hidden=false;
 $("#modalAction").textContent="Kapat";
 const cost=$("#buildingUpgradeCost"),start=$("#startBuildingUpgrade"),speed=$("#speedUpBuilding");
 if(v.level>=10){
  cost.textContent="Bu bina en yüksek seviye olan 10'a ulaştı.";
  start.disabled=true;start.textContent="Maksimum seviye";
 }else{
  const q=v.nextUpgrade;
  cost.textContent="Sonraki seviye: "+(v.level+1)+" · Gerekli: 🪵 "+q.wood+" odun · 🪨 "+q.stone+" taş · ⚒️ "+q.iron+" demir · ⏱️ "+formatBuildTime(q.durationSeconds);
  start.disabled=!!v.upgradeFinishesAt||constructionWorkers.available<1;start.textContent=v.upgradeFinishesAt?"Geliştirme devam ediyor":(constructionWorkers.available<1?"İşçi ekipleri dolu":"Seviyeyi yükselt");
 }
 speed.disabled=!v.upgradeFinishesAt;
 speed.textContent=buildingSpeedupsAvailable>0?"⏩ 5 dk hızlandır · "+buildingSpeedupsAvailable+" adet":"🏪 Pazar’dan 5 dk hızlandırma al";
 updateBuildingTimer();
 if(buildingTimerInterval)clearInterval(buildingTimerInterval);
 buildingTimerInterval=setInterval(updateBuildingTimer,1000);
 $("#modal").classList.add("open");
}
async function refreshBuildingsAndCity(){
 const data=await api("/api/buildings/me");
 buildingSpeedupsAvailable=data.speedupsAvailable||0;
 constructionWorkers={active:data.activeUpgradeCount||0,max:data.maxConcurrentUpgrades||3,available:data.availableConstructionWorkers||0};
 const layer=$("#villageBuildingsLayer");if(!layer)return;
 layer.replaceChildren();
 (data.buildings||[]).forEach(v=>{
  const m=document.createElement("button");m.type="button";
  m.className="placed-building"+(v.type==="center"?" placed-center":"");
  m.style.left=Number(v.x)+"%";m.style.top=Number(v.y)+"%";
  const i=document.createElement("img");
  i.src=v.type==="center"?"/assets/seljuk-center.svg":"/assets/buildings/"+(buildingArt[v.type]||"shelter")+".svg";
  i.alt=v.name;i.className=v.type==="center"?"keep-art":"building-art";
  const n=document.createElement("b");n.textContent=v.name;
  const l=document.createElement("small");l.textContent="Sv. "+v.level+(v.upgradeFinishesAt?" · ⏳":"");
  m.append(i,n,l);
  m.addEventListener("click",e=>{e.stopPropagation();openBuildingUpgrade(v);});
  layer.append(m);
 });
 if(selectedUpgradeBuilding){
  const latest=data.buildings.find(v=>v.type===selectedUpgradeBuilding.type);
  if(latest){selectedUpgradeBuilding=latest;openBuildingUpgrade(latest);}
 }
}
async function loadVillageBuildings(){try{await refreshBuildingsAndCity();}catch(e){console.error("Köy binaları yüklenemedi:",e);}}
$("#startBuildingUpgrade").addEventListener("click",async()=>{
 if(!selectedUpgradeBuilding)return;
 const button=$("#startBuildingUpgrade");button.disabled=true;
 try{
  await api("/api/buildings/upgrade",{method:"POST",body:JSON.stringify({type:selectedUpgradeBuilding.type})});
  await loadPlayerData();await refreshBuildingsAndCity();
 }catch(e){$("#modalText").textContent=e.message;button.disabled=false;}
});
$("#speedUpBuilding").addEventListener("click",async()=>{
 if(!selectedUpgradeBuilding)return;
 if(buildingSpeedupsAvailable<1){$("#modal").classList.remove("open");if(buildingTimerInterval){clearInterval(buildingTimerInterval);buildingTimerInterval=null;}setActiveNav("navShop");openMarket();return;}
 const button=$("#speedUpBuilding");button.disabled=true;
 try{
  await api("/api/buildings/speed-up",{method:"POST",body:JSON.stringify({type:selectedUpgradeBuilding.type})});
  await loadPlayerData();await refreshBuildingsAndCity();
 }catch(e){$("#modalText").textContent=e.message;button.disabled=false;}
});
window.addEventListener("umaykut2dready",()=>loadVillageBuildings());
function openWorkerAssignment(node){
  const field=$("#modalWorkerField"),input=$("#workerAmount");
  $("#modalTitle").textContent=node.icon+" "+node.name+" kaynağı";
  $("#modalText").textContent="Seviye "+node.level+" · İşçi sınırı "+node.maxWorkers+". Boşta "+villageEconomy.availableWorkers+" işçin var. Göndereceğin toplam işçi sayısını yaz.";
  field.hidden=false;input.max=String(Math.min(node.maxWorkers,node.workersAssigned+villageEconomy.availableWorkers));
  input.value=String(node.workersAssigned);input.focus();
  $("#modalAction").textContent="İŞÇİLERİ GÖNDER";
  $("#modalAction").onclick=async()=>{
    const amount=Number(input.value);
    if(!Number.isSafeInteger(amount)||amount<0||amount>node.maxWorkers){
      $("#modalText").textContent="0 ile "+node.maxWorkers+" arasında geçerli bir sayı gir.";
      return;
    }
    const action=$("#modalAction");action.disabled=true;action.textContent="GÖNDERİLİYOR…";
    try{
      const result=await api("/api/economy/assign",{method:"POST",body:JSON.stringify({nodeId:node.id,workers:amount})});
      $("#modal").classList.remove("open");
      
      await loadEconomy(true);
      await loadPlayerData();
      $("#economyMessage").textContent=result.message;
    }catch(error){$("#modalText").textContent=error.message;}
    finally{action.disabled=false;action.textContent="İŞÇİLERİ GÖNDER";}
  };
  $("#modal").classList.add("open");
}
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
$("#enterVillage").onclick=()=>{show("village");loadVillageBuildings();};$("#goHome").onclick=()=>{show("village");loadVillageBuildings();};$("#myVillage").onclick=()=>{show("village");loadVillageBuildings();};$("#backWorld").onclick=()=>show("world");
function modal(title,desc,action="Tamam"){$("#modalTitle").textContent=title;$("#modalText").textContent=desc;$("#modalWorkerField").hidden=true;$("#buildingUpgradeActions").hidden=true;$("#modalAction").textContent=action;$("#modalAction").onclick=()=>{$("#modal").classList.remove("open");if(buildingTimerInterval){clearInterval(buildingTimerInterval);buildingTimerInterval=null;}};$("#modal").classList.add("open");}
$("#closeModal").onclick=()=>{$("#modal").classList.remove("open");if(buildingTimerInterval){clearInterval(buildingTimerInterval);buildingTimerInterval=null;}};

document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{if(b.dataset.action==="Üretim"){openEconomy();return;}modal(b.dataset.action,"Bu bölümün oyun sistemi bir sonraki geliştirme aşamasında eklenecek.");});
$("#modalAction").onclick=()=>$("#modal").classList.remove("open");
if(token){api("/api/city/me").then(()=>enterGame({username:"Oyuncu"})).catch(()=>{localStorage.removeItem("umaykut_token");token=null;});}

function setActiveNav(id){document.querySelectorAll(".bottom-nav button").forEach(button=>button.classList.toggle("active",button.id===id));}
$("#navVillage").addEventListener("click",()=>{setActiveNav("navVillage");show("village");loadVillageBuildings();});
$("#navTroops").addEventListener("click",()=>{setActiveNav("navTroops");openUnits();});

$("#navQuests").addEventListener("click",()=>{setActiveNav("navQuests");show("world");});
$("#navShop").addEventListener("click",()=>{setActiveNav("navShop");openMarket();});
async function openMarket(){show("shopScreen");const list=$("#marketItemList");list.textContent="Pazar tezgâhları hazırlanıyor…";try{const data=await api("/api/market/me");$("#marketGold").textContent=Number(data.gold).toLocaleString("tr-TR")+" altın";$("#marketInventory").textContent="⏩ 5 dk hızlandırma: "+data.speedupsAvailable+" adet";list.replaceChildren();data.items.forEach(item=>{const card=document.createElement("article");card.className="market-item";const icon=document.createElement("div");icon.className="market-item-icon";icon.textContent=item.icon;const info=document.createElement("div");info.className="market-item-info";const title=document.createElement("b");title.textContent=item.name;const desc=document.createElement("small");desc.textContent=item.description;const price=document.createElement("strong");price.textContent="🪙 "+item.price+" altın";const buy=document.createElement("button");buy.className="gold-button";buy.textContent="Satın al";buy.addEventListener("click",()=>purchaseMarketItem(item.code,buy));info.append(title,desc,price);card.append(icon,info,buy);list.append(card);});}catch(e){list.textContent=e.message;}}
async function purchaseMarketItem(code,button){button.disabled=true;try{const result=await api("/api/market/buy",{method:"POST",body:JSON.stringify({code})});await loadPlayerData();await openMarket();$("#marketInventory").textContent=result.message+" · "+$("#marketInventory").textContent;}catch(e){modal("Satın alma başarısız",e.message,"Tamam");button.disabled=false;}}
$("#backVillageFromShop").addEventListener("click",()=>{setActiveNav("navVillage");show("village");});
