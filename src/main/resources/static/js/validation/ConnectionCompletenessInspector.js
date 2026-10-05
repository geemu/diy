import {isLinearProfile} from '../model/ProfilePath.js';
import {profileObb,profileEndpointWorld,distancePointToObbSurface} from './PartCollisionDetector.js';

/**
 * Finds geometric endpoint contacts that have not been represented by a
 * connection or an enabled constraint. It is deliberately a WARNING: touching
 * geometry may be intentional, but production review should not silently miss
 * a structural joint.
 */
export default class ConnectionCompletenessInspector {
  constructor(editor){this.editor=editor;}

  inspect(options={}){
    const toleranceMm=Math.max(0.05,Number(options.toleranceMm??this.editor.projectSettings?.contactToleranceMm??1));
    const profiles=(this.editor.parts||[]).filter(part=>part?.type==='PROFILE'&&isLinearProfile(part));
    const obbs=new Map(profiles.map(part=>[part.id,profileObb(part)]).filter(([,obb])=>obb));
    const represented=this.representedPairs();
    const seen=new Set();
    const issues=[];

    for(const source of profiles){
      for(const end of ['START','END']){
        const point=profileEndpointWorld(source,end);
        if(!point)continue;
        let best=null;
        for(const target of profiles){
          if(target.id===source.id)continue;
          const key=pairKey(source.id,target.id);
          if(represented.has(key))continue;
          const obb=obbs.get(target.id);if(!obb)continue;
          const hit=distancePointToObbSurface(point,obb,toleranceMm);
          if(!hit||hit.distanceMm>toleranceMm)continue;
          // Ignore an endpoint merely lying close to the extension of another
          // profile end: the contact point must be within the target face span.
          if(!best||hit.distanceMm<best.hit.distanceMm)best={target,hit};
        }
        if(!best)continue;
        const key=`${source.id}:${end}:${best.target.id}`;
        if(seen.has(key))continue;
        seen.add(key);
        issues.push({
          severity:'WARNING',
          code:'GEOMETRIC_CONTACT_WITHOUT_CONNECTION',
          subject:`${label(source)} ${end==='START'?'A端':'B端'} ↔ ${label(best.target)}`,
          message:`端点与另一构件几何接触（约 ${round(best.hit.distanceMm)}mm），但未找到连接件或启用约束；请确认是否遗漏装配关系`,
          partIds:[source.id,best.target.id],
          details:{sourceEnd:end,targetAxis:best.hit.axis,targetFaceSign:best.hit.sign,distanceMm:round(best.hit.distanceMm)}
        });
      }
    }
    return summarize(issues);
  }

  representedPairs(){
    const pairs=new Set();
    for(const connection of this.editor.connectionManager?.connections||[]){
      if(connection?.status==='INVALID')continue;
      if(connection?.sourceProfileId&&connection?.targetProfileId)pairs.add(pairKey(connection.sourceProfileId,connection.targetProfileId));
    }
    for(const constraint of this.editor.constraintManager?.constraints||[]){
      if(constraint?.enabled===false||constraint?.suppressed===true)continue;
      if(constraint?.sourcePartId&&constraint?.targetPartId)pairs.add(pairKey(constraint.sourcePartId,constraint.targetPartId));
    }
    return pairs;
  }
}

function pairKey(a,b){return [String(a),String(b)].sort().join('::');}
function label(part){return part.displayId||part.name||part.id||'型材';}
function round(value){return Number(Number(value).toFixed(3));}
function summarize(issues){return {ok:true,issues,errors:[],warnings:issues,infos:[]};}
