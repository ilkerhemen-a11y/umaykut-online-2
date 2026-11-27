const VILLAGE_ART_BY_FACTION = Object.freeze({
  gokturk: Object.freeze({
    src: "/assets/IMG-20261117-WA0073.jpg",
    alt: "Göktürk köy görünümü."
  }),
  hun: Object.freeze({
    src: "/assets/IMG-20261117-WA7162.jpg",
    alt: "Hun köy görünümü."
  }),
  seljuk: Object.freeze({
    src: "/assets/IMG-20261117-WA0581.jpg",
    alt: "Selçuklu köy görünümü."
  })
});

export function getVillageFactionArt(factionId) {
  return VILLAGE_ART_BY_FACTION[factionId] ?? VILLAGE_ART_BY_FACTION.gokturk;
}

export function applyVillageFactionArt(image, factionId) {
  if (!image || typeof image.setAttribute !== "function") return false;
  const knownFaction = Object.prototype.hasOwnProperty.call(VILLAGE_ART_BY_FACTION, factionId);
  const faction = knownFaction ? factionId : "gokturk";
  const art = getVillageFactionArt(faction);
  image.setAttribute("src", art.src);
  image.setAttribute("alt", art.alt);
  if (image.dataset) image.dataset.faction = faction;
  return true;
}
