import {
  bearerToken, verifySessionToken, sessionTokenHash
} from './auth.js';
import {
  MAX_NEUTRAL_GARRISON, createNeutralClaim, countTroops,
  validateNeutralGarrison, resolveNeutralBattle, expireNeutralClaim
} from './neutral-regions.js';

function json(res,status,payload){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(payload));
}
function parse(value,fallback={}){
  return typeof value==='string'?JSON.parse(value||JSON.stringify(fallback)):(value??fallback);
}
function subtractTroops(available,requested){
  const next={...available};
  for(const [id,count] of Object.entries(requested)){
    if(!Number.isSafeInteger(count)||count<0||Number(available[id]||0)<count)
      throw new RangeError('Gönderilecek asker sayısı köyündeki mevcut askerlerden fazla.');
    next[id]=Number(available[id]||0)-count;
    if(next[id]===0)delete next[id];
  }
  return next;
}
function applyLosses(troops,lossCount){
  const total=countTroops(troops);
  let remaining=Math.min(total,lossCount);
  const losses={};
  const entries=Object.entries(troops);
  for(let i=0;i<entries.length;i++){
    const [id,count]=entries[i];
    const loss=i===entries.length-1?Math.min(count,remaining):Math.min(count,Math.floor(lossCount*count/Math.max(1,total)));
    losses[id]=loss;remaining-=loss;
  }
  for(const [id,count] of entries){
    if(remaining<=0)break;
    const extra=Math.min(count-losses[id],remaining);losses[id]+=extra;remaining-=extra;
  }
  return Object.fromEntries(entries.map(([id,count])=>[id,count-losses[id]]).filter(([,count])=>count>0));
}

export async function handleNeutralRegionRequest({req,res,url,pool,sessionSecret}){
  const path=url.pathname;
  if(!path.startsWith('/api/game/neutral-regions'))return false;
  if(!pool)return json(res,503,{error:'Tarafsız bölge servisi henüz yapılandırılmadı.'}),true;
  if(!sessionSecret||sessionSecret.length<32)return json(res,503,{error:'Oturum güvenlik ayarı eksik.'}),true;
  const token=bearerToken(req),session=verifySessionToken(token,sessionSecret);
  if(!session)return json(res,401,{error:'Oturum geçersiz veya süresi dolmuş.'}),true;
  const valid=await pool.query(
    'SELECT 1 FROM umaykut_v2.player_sessions WHERE player_id=$1 AND token_hash=$2 AND expires_at>NOW()',
    [session.id,sessionTokenHash(token)]
  );
  if(!valid.rowCount)return json(res,401,{error:'Oyuncu oturumu bulunamadı.'}),true;

  if(req.method==='GET'&&path==='/api/game/neutral-regions'){
    const result=await pool.query(
      `SELECT id,region_name,world_x,world_y,guard_troops,owner_player_id,owner_faction_id,
              claimed_by_player_id,claimed_at,claim_expires_at,garrison_troops,garrison_count,
              (claim_expires_at<=NOW()) AS claim_expired
       FROM umaykut_v2.world_neutral_regions ORDER BY id`
    );
    return json(res,200,{regions:result.rows,capacity:MAX_NEUTRAL_GARRISON,serverNow:new Date().toISOString()}),true;
  }
  if(req.method!=='POST'||!['/api/game/neutral-regions/garrison','/api/game/neutral-regions/attack'].includes(path)){
    res.setHeader('allow','GET, POST');
    return json(res,405,{error:'Yöntem desteklenmiyor.'}),true;
  }

  let input;
  try{input=await (async()=>{let body='';for await(const chunk of req){body+=chunk;if(body.length>8192)throw new Error('İstek çok büyük.');}return JSON.parse(body||'{}');})();}catch{return json(res,400,{error:'Geçersiz istek verisi.'}),true;}
  const regionId=Number(input.regionId);
  const troops=input.troops;
  if(!Number.isSafeInteger(regionId)||regionId<1||!troops||typeof troops!=='object'||Array.isArray(troops))
    return json(res,400,{error:'Bölge ve asker bilgileri gerekli.'}),true;

  const client=await pool.connect();let tx=false;
  try{
    await client.query('BEGIN');tx=true;
    const regionResult=await client.query('SELECT * FROM umaykut_v2.world_neutral_regions WHERE id=$1 FOR UPDATE',[regionId]);
    if(!regionResult.rowCount){await client.query('ROLLBACK');tx=false;return json(res,404,{error:'Tarafsız köy bulunamadı.'}),true;}
    const region=regionResult.rows[0];
    const playerResult=await client.query(
      'SELECT faction_id,troops FROM umaykut_v2.player_game_state WHERE player_id=$1 FOR UPDATE',[session.id]
    );
    if(!playerResult.rowCount){await client.query('ROLLBACK');tx=false;return json(res,404,{error:'Oyuncu ordusu bulunamadı.'}),true;}
    const player=playerResult.rows[0],factionId=player.faction_id;
    if(!['gokturk','hun','seljuk'].includes(factionId)){await client.query('ROLLBACK');tx=false;return json(res,409,{error:'Önce Göktürk, Hun veya Selçuklu devletini seçmelisin.'}),true;}
    const ownTroops=parse(player.troops);
    const amount=countTroops(troops);
    if(amount<1){await client.query('ROLLBACK');tx=false;return json(res,400,{error:'En az bir asker göndermelisin.'}),true;}
    const nextOwn=subtractTroops(ownTroops,troops);

    if(path.endsWith('/garrison')){
      const expired=region.claimed_by_player_id&&expireNeutralClaim({claimExpiresAt:region.claim_expires_at});
      if(region.claimed_by_player_id&&!expired&&region.claimed_by_player_id!==session.id){
        await client.query('ROLLBACK');tx=false;
        return json(res,409,{error:'Bu bölge için ilk garnizon başka bir oyuncuya ait. Bölgeyi saldırıyla ele geçirebilirsin.',claimedBy:region.claimed_by_player_id}),true;
      }
      const current=expired?0:Number(region.garrison_count||0);
      const capacity=validateNeutralGarrison(troops,current);
      const combined=expired?{...troops}:{...parse(region.garrison_troops)};
      if(!expired)for(const [id,count] of Object.entries(troops))combined[id]=Number(combined[id]||0)+count;
      const claim=(!region.claimed_by_player_id||expired)?createNeutralClaim({playerId:session.id,factionId}):null;
      await client.query(
        `UPDATE umaykut_v2.world_neutral_regions SET
          claimed_by_player_id=$2,claimed_at=COALESCE($3,claimed_at),claim_expires_at=COALESCE($4,claim_expires_at),
          garrison_troops=$5::jsonb,garrison_count=$6,updated_at=NOW()
         WHERE id=$1`,
        [regionId,session.id,claim?.claimedAt||null,claim?.expiresAt||null,JSON.stringify(combined),capacity.total]
      );
      await client.query('UPDATE umaykut_v2.player_game_state SET troops=$2::jsonb,updated_at=NOW() WHERE player_id=$1',[session.id,JSON.stringify(nextOwn)]);
      await client.query('COMMIT');tx=false;
      return json(res,200,{success:true,message:claim?'İlk garnizon kuruldu; dört saatlik hâkimiyet süresi başladı.':'Garnizona asker takviyesi yapıldı.',claimExpiresAt:claim?.expiresAt||region.claim_expires_at,garrisonCount:capacity.total,remainingCapacity:capacity.remainingCapacity}),true;
    }

    if(!region.claimed_by_player_id||expireNeutralClaim({claimExpiresAt:region.claim_expires_at})){
      await client.query('ROLLBACK');tx=false;
      return json(res,409,{error:'Bölgede aktif bir hâkimiyet mücadelesi yok veya dört saatlik süre sona ermiş.'}),true;
    }
    if(region.claimed_by_player_id===session.id){
      await client.query('ROLLBACK');tx=false;
      return json(res,409,{error:'Kendi garnizonuna saldıramazsın.'}),true;
    }
    const battle=resolveNeutralBattle({
      attackingTroops:troops,
      defendingTroops:parse(region.garrison_troops),
      guardTroops:parse(region.guard_troops),
      claimExpiresAt:region.claim_expires_at
    });
    const defenderStacks={...parse(region.garrison_troops),...Object.fromEntries(Object.entries(parse(region.guard_troops)).map(([id,n])=>['guard_'+id,n]))};
    const defenderAfter=applyLosses(defenderStacks,battle.defenderLosses);
    const garrisonAfter=Object.fromEntries(Object.entries(defenderAfter).filter(([id])=>!id.startsWith('guard_')));
    const guardsAfter=Object.fromEntries(Object.entries(defenderAfter).filter(([id])=>id.startsWith('guard_')).map(([id,n])=>[id.slice(6),n]));
    await client.query('UPDATE umaykut_v2.player_game_state SET troops=$2::jsonb,updated_at=NOW() WHERE player_id=$1',[session.id,JSON.stringify(nextOwn)]);
    if(battle.canCapture){
      await client.query(
        `UPDATE umaykut_v2.world_neutral_regions SET owner_player_id=$2,owner_faction_id=$3,
          claimed_by_player_id=NULL,claimed_at=NULL,claim_expires_at=NULL,
          garrison_troops=$4::jsonb,garrison_count=$5,guard_troops=$6::jsonb,updated_at=NOW() WHERE id=$1`,
        [regionId,session.id,factionId,JSON.stringify({}),battle.attackerSurvivors,JSON.stringify(guardsAfter)]
      );
      await client.query('COMMIT');tx=false;
      return json(res,200,{success:true,victory:true,captured:true,ownerFactionId:factionId,attackerSurvivors:battle.attackerSurvivors,attackerLosses:battle.attackerLosses,defenderLosses:battle.defenderLosses,message:'Bölge fethedildi; devletinin rengiyle haritaya işlendi.'}),true;
    }
    await client.query(
      'UPDATE umaykut_v2.world_neutral_regions SET garrison_troops=$2::jsonb,garrison_count=$3,guard_troops=$4::jsonb,updated_at=NOW() WHERE id=$1',
      [regionId,JSON.stringify(garrisonAfter),countTroops(garrisonAfter),JSON.stringify(guardsAfter)]
    );
    await client.query('COMMIT');tx=false;
    return json(res,200,{success:true,victory:false,captured:false,attackerSurvivors:battle.attackerSurvivors,attackerLosses:battle.attackerLosses,defenderLosses:battle.defenderLosses,message:'Saldırı başarısız oldu; bölge hâkimiyeti devam ediyor.'}),true;
  }catch(error){
    if(tx){try{await client.query('ROLLBACK');}catch{}}
    const status=error instanceof RangeError||error instanceof TypeError?400:500;
    return json(res,status,{error:status===400?error.message:'Tarafsız bölge işlemi tamamlanamadı.'}),true;
  }finally{client.release();}
}
