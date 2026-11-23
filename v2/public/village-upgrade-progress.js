export function calculateVillageUpgradeProgress(upgrade,now=Date.now()){
 if(!upgrade||typeof upgrade!=="object")return 0;
 const startedAt=Date.parse(upgrade.startedAt);
 const completesAt=Date.parse(upgrade.completesAt);
 const current=Number(now);
 if(!Number.isFinite(startedAt)||!Number.isFinite(completesAt)||!Number.isFinite(current)||completesAt<=startedAt)return 0;
 return Math.min(100,Math.max(0,((current-startedAt)/(completesAt-startedAt))*100));
}
