import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_NEUTRAL_GARRISON, MAX_NEUTRAL_CLAIM_HOURS,
  validateNeutralGarrison, createNeutralClaim, resolveNeutralBattle,
  expireNeutralClaim, FACTION_TERRITORY_COLORS
} from '../src/neutral-regions.js';

test('neutral garrison is capped at 100,000 troops', () => {
  assert.deepEqual(validateNeutralGarrison({infantry:60000,cavalry:40000}), {incoming:100000,total:100000,remainingCapacity:0});
  assert.throws(() => validateNeutralGarrison({infantry:100001}), /100.000/);
  assert.equal(MAX_NEUTRAL_GARRISON, 100000);
});

test('first garrison claim lasts at most four hours', () => {
  const now = new Date('2026-11-18T12:00:00.000Z');
  const claim = createNeutralClaim({playerId:'player-1',factionId:'gokturk',now});
  assert.equal(claim.claimedAt, now.toISOString());
  assert.equal(Date.parse(claim.expiresAt)-now.getTime(), 4*60*60*1000);
  assert.throws(() => createNeutralClaim({playerId:'p',factionId:'hun',now,durationHours:5}), /4 saati/);
  assert.equal(MAX_NEUTRAL_CLAIM_HOURS, 4);
});

test('territory colors exist for all playable factions', () => {
  assert.deepEqual(Object.keys(FACTION_TERRITORY_COLORS).sort(), ['gokturk','hun','seljuk']);
});

test('stronger attacking army can win while claim is active', () => {
  const result = resolveNeutralBattle({
    attackingTroops:{infantry:100000},defendingTroops:{},guardTroops:{infantry:5000},
    now:new Date('2026-11-18T13:00:00.000Z'),claimExpiresAt:'2026-11-18T16:00:00.000Z'
  });
  assert.equal(result.winner,'attacker');
  assert.equal(result.canCapture,true);
});

test('claim expires at four hours and cannot be captured afterwards', () => {
  const now = new Date('2026-11-18T16:00:00.000Z');
  assert.equal(expireNeutralClaim({claimExpiresAt:'2026-11-18T16:00:00.000Z',now}),true);
  const result = resolveNeutralBattle({
    attackingTroops:{infantry:100000},defendingTroops:{},guardTroops:{infantry:1000},
    now,claimExpiresAt:'2026-11-18T16:00:00.000Z'
  });
  assert.equal(result.canCapture,false);
});

test('guards must be decisively defeated before a region can be captured', () => {
  const result = resolveNeutralBattle({
    attackingTroops:{infantry:6000},defendingTroops:{},guardTroops:{infantry:5000},
    now:new Date('2026-11-18T13:00:00.000Z'),claimExpiresAt:'2026-11-18T16:00:00.000Z'
  });
  assert.equal(result.victory,false);
  assert.equal(result.canCapture,false);
  assert.ok(result.defendersSurvivors>0);
});

test('a decisive victory removes the defending guards', () => {
  const result = resolveNeutralBattle({
    attackingTroops:{infantry:100000},defendingTroops:{},guardTroops:{infantry:50000},
    now:new Date('2026-11-18T13:00:00.000Z'),claimExpiresAt:'2026-11-18T16:00:00.000Z'
  });
  assert.equal(result.victory,true);
  assert.equal(result.defendersSurvivors,0);
  assert.equal(result.canCapture,true);
});

test('owned regions can be recaptured after the temporary claim window', () => {
  const result = resolveNeutralBattle({
    attackingTroops:{infantry:100000},defendingTroops:{infantry:20000},guardTroops:{},
    now:new Date('2026-11-18T20:00:00.000Z'),ownedRegion:true
  });
  assert.equal(result.victory,true);
  assert.equal(result.canCapture,true);
});
test('owned region capture still requires a decisive victory', () => {
  const result = resolveNeutralBattle({
    attackingTroops:{infantry:10000},defendingTroops:{infantry:20000},guardTroops:{},
    now:new Date('2026-11-18T20:00:00.000Z'),ownedRegion:true
  });
  assert.equal(result.victory,false);
  assert.equal(result.canCapture,false);
});
