const buildings=[
 {id:1,name:"Merkez Binası",icon:"🏰",x:50,y:49,level:1,description:"Yurdunun kalbi. Şehrinin gelişimini ve diğer yapıların erişimini belirler.",center:true},
 {id:2,name:"Tapınak",icon:"🕌",x:37,y:36,level:1,description:"İnanç ve şehir kültürünün merkezi."},
 {id:3,name:"Okul",icon:"📚",x:63,y:36,level:1,description:"Bilgi, eğitim ve araştırmaların merkezi."},
 {id:4,name:"Kışla",icon:"⚔️",x:76,y:46,level:1,description:"Piyade birliklerinin yetiştirildiği yapı."},
 {id:5,name:"Okçu Ocağı",icon:"🏹",x:76,y:58,level:1,description:"Okçu birliklerinin eğitim alanı."},
 {id:6,name:"Ahır",icon:"🐎",x:66,y:65,level:1,description:"Atların ve süvari birliklerinin merkezi."},
 {id:7,name:"Atölye",icon:"⚒️",x:50,y:70,level:1,description:"Ustalık ve üretim faaliyetlerinin yürütüldüğü yapı."},
 {id:8,name:"Pazar",icon:"🏪",x:34,y:64,level:1,description:"Ticaret ve kaynak alışverişinin merkezi."},
 {id:9,name:"Demirci",icon:"⚒️",x:24,y:51,level:1,description:"Demir işleme ve ekipman üretim merkezi."},
 {id:10,name:"Sığınak",icon:"🛡️",x:25,y:40,level:1,description:"Şehrin güvenliği için korunaklı yapı."}
];
const factions={
 hun:{name:"Hun diyarı",mapAlt:"Kırmızı kubbeli ve kırmızı sancaklı Hun şehri",themeColor:"#7b2528"},
 seljuk:{name:"Selçuklu diyarı",mapAlt:"Altın kubbeli ve altın sancaklı Selçuklu şehri",themeColor:"#8d6a2d"},
 gokturk:{name:"Göktürk diyarı",mapAlt:"Mavi kubbeli ve mavi sancaklı Göktürk şehri",themeColor:"#176b83"}
};
const shell=document.querySelector(".game-shell");
const factionLabel=document.querySelector("#realm-faction");
const cityArt=document.querySelector(".city-art");
function setFaction(key){
 const faction=factions[key] ? key : "seljuk";
 shell.dataset.faction=faction;
 factionLabel.textContent=factions[faction].name;
 cityArt.alt=factions[faction].mapAlt;
 document.querySelector('meta[name="theme-color"]').content=factions[faction].themeColor;
 document.querySelectorAll("[data-faction-choice]").forEach(button=>{
  const active=button.dataset.factionChoice===faction;
  button.setAttribute("aria-pressed",String(active));
  button.classList.toggle("selected",active);
 });
 try{localStorage.setItem("umaykut-faction",faction);}catch{}
}
document.querySelectorAll("[data-faction-choice]").forEach(button=>{
 button.addEventListener("click",()=>setFaction(button.dataset.factionChoice));
});
let savedFaction="seljuk";
try{savedFaction=localStorage.getItem("umaykut-faction")||"seljuk";}catch{}
setFaction(savedFaction);

const points=document.querySelector("#building-points");
const dialog=document.querySelector("#building-dialog");
let selected=null;
for(const building of buildings){
 const button=document.createElement("button");
 button.type="button";
 button.className="building-point"+(building.center?" center":"");
 button.style.left=building.x+"%";
 button.style.top=building.y+"%";
 button.textContent=String(building.id);
 button.setAttribute("aria-label",`${building.id} numaralı ${building.name}, seviye ${building.level}`);
 button.addEventListener("click",()=>openBuilding(building));
 points.append(button);
}
function openBuilding(building){
 selected=building;
 document.querySelector("#dialog-emblem").textContent=building.icon;
 document.querySelector("#dialog-number").textContent="BİNA "+building.id;
 document.querySelector("#dialog-title").textContent=building.name;
 document.querySelector("#dialog-description").textContent=building.description;
 document.querySelector("#dialog-level").textContent=building.level+" / 10";
 document.querySelector("#dialog-progress").style.width=(building.level*10)+"%";
 dialog.showModal();
}
document.querySelector("#upgrade-preview").addEventListener("click",()=>{
 if(!selected)return;
 const note=document.querySelector(".prototype-note");
 note.textContent=selected.level===10?"Bu bina en yüksek seviyede.":"Yükseltme ve kaynak maliyetleri oyun servisleri eklendiğinde etkinleştirilecek.";
});
document.querySelectorAll(".bottom-nav button").forEach(button=>{
 button.addEventListener("click",()=>{
  document.querySelectorAll(".bottom-nav button").forEach(item=>item.classList.remove("active"));
  button.classList.add("active");
  if(button.textContent.trim()!=="Köy") {
   const note=document.querySelector(".map-hint");
   note.textContent=button.textContent.trim()+" bölümü sonraki geliştirme aşamasında açılacak";
  } else document.querySelector(".map-hint").textContent="Bir binaya dokunarak ayrıntılarını görüntüle";
 });
});
