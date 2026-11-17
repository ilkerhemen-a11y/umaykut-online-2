const factions={
 hun:{name:"Hun diyarı",mapAlt:"Hun diyarı köy görünümü",themeColor:"#7b2528"},
 seljuk:{name:"Selçuklu diyarı",mapAlt:"Selçuklu diyarı köy görünümü",themeColor:"#8d6a2d"},
 gokturk:{name:"Göktürk diyarı",mapAlt:"Göktürk diyarı köy görünümü",themeColor:"#176b83"}
};
const shell=document.querySelector(".game-shell");
const factionLabel=document.querySelector("#realm-faction");
function setFaction(key){
 const faction=factions[key] ? key : "seljuk";
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

document.querySelectorAll(".bottom-nav button").forEach(button=>{
 button.addEventListener("click",()=>{
  document.querySelectorAll(".bottom-nav button").forEach(item=>item.classList.remove("active"));
  button.classList.add("active");
 });
});
