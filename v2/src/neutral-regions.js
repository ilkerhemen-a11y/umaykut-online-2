export const MAX_NEUTRAL_GARRISON = 100000;
export const MAX_NEUTRAL_CLAIM_HOURS = 4;
export const NEUTRAL_GUARD_TIERS = Object.freeze([5000,10000,20000,35000,50000]);
export const FACTION_TERRITORY_COLORS = Object.freeze({
  gokturk: '#2587b8',
  hun: '#b94343',
  seljuk: '#d4a83e'
});

export function countTroops(troops) {
  if (!troops || typeof troops !== 'object' || Array.isArray(troops)) throw new TypeError('Asker listesi geçersiz.');
  return Object.entries(troops).reduce((total, [id, value]) => {
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(id) || !Number.isSafeInteger(value) || value < 0) {
      throw new TypeError('Asker sayıları sıfır veya pozitif tam sayı olmalı.');
    }
    return total + value;
  }, 0);
}

export function validateNeutralGarrison(troops, currentCount = 0) {
  const incoming = countTroops(troops);
  if (!Number.isSafeInteger(currentCount) || currentCount < 0 || currentCount > MAX_NEUTRAL_GARRISON) {
    throw new TypeError('Mevcut garnizon kapasitesi geçersiz.');
  }
  if (currentCount + incoming > MAX_NEUTRAL_GARRISON) {
    throw new RangeError('Tarafsız köy garnizon kapasitesi 100.000 asker.');
  }
  return { incoming, total: currentCount + incoming, remainingCapacity: MAX_NEUTRAL_GARRISON - currentCount - incoming };
}

export function createNeutralClaim({ playerId, factionId, now = new Date(), durationHours = 4 }) {
  if (typeof playerId !== 'string' || !playerId) throw new TypeError('Oyuncu gerekli.');
  if (!Object.hasOwn(FACTION_TERRITORY_COLORS, factionId)) throw new TypeError('Geçerli bir devlet seçilmeli.');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('Başlangıç zamanı geçersiz.');
  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > MAX_NEUTRAL_CLAIM_HOURS) {
    throw new RangeError('Hâkimiyet süresi 4 saati aşamaz.');
  }
  return {
    claimedByPlayerId: playerId,
    factionId,
    claimedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + durationHours * 3600000).toISOString()
  };
}

export function resolveNeutralBattle({ attackingTroops, defendingTroops, guardTroops = {}, now = new Date(), claimExpiresAt, ownedRegion = false }) {
  const attack = countTroops(attackingTroops);
  const defense = countTroops(defendingTroops) + countTroops(guardTroops);
  const victory = attack > 0 && attack >= Math.max(1, Math.ceil(defense * 1.25));
  const attackerLosses = victory
    ? Math.min(Math.max(0, attack - 1), Math.ceil(defense * 0.3))
    : Math.min(attack, Math.ceil(attack * 0.65));
  const defenderLosses = victory
    ? defense
    : Math.min(defense, Math.ceil(attack * 0.45));
  const attackerSurvivors = attack - attackerLosses;
  const defendersSurvivors = defense - defenderLosses;
  const inWindow = Boolean(claimExpiresAt && Date.parse(claimExpiresAt) > now.getTime());
  return {
    winner: victory ? 'attacker' : 'defender',
    victory,
    attackerLosses,
    attackerSurvivors,
    defenderLosses,
    defendersSurvivors,
    canCapture: Boolean(victory && (inWindow || ownedRegion))
  };
}

export function expireNeutralClaim({ claimExpiresAt, now = new Date() }) {
  if (!claimExpiresAt || !Number.isFinite(Date.parse(claimExpiresAt))) return true;
  return now.getTime() >= Date.parse(claimExpiresAt);
}
