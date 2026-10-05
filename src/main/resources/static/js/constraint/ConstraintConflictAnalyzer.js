/**
 * Constraint conflict analysis.
 * v0.26 adds a bounded deletion-based irreducible conflict search (IIS-like).
 * It numerically probes semantic subsets while restoring all part transforms afterwards.
 * The result is called `minimalConflictSetIds`, not a mathematical MUS: floating-point
 * geometric solvers can be path dependent, so the UI explicitly reports it as a bounded
 * irreducible conflict set.
 */
export default class ConstraintConflictAnalyzer {
  constructor(editor, manager) { this.editor=editor; this.manager=manager; }

  analyze(constraints=this.manager.constraints||[], systemReport=this.manager.lastSystemReport||{}) {
    const active=constraints.filter(c=>c?.type==='RIGID_MATE'&&c.enabled!==false&&c.suppressed!==true);
    const byId=new Map(active.map(c=>[c.id,c]));
    const seeds=(systemReport.conflictConstraintIds||[]).filter(id=>byId.has(id));
    const conflictSet=this.expandConflictSet(seeds,active);
    const ranked=conflictSet.map(c=>({constraint:c,score:this.score(c,active)})).sort((a,b)=>b.score-a.score||String(a.constraint.id).localeCompare(String(b.constraint.id)));
    const minimal=this.findBoundedIrreducibleSet(conflictSet);
    const recommendationPool=minimal.length?minimal:conflictSet;
    const recommendationRanked=recommendationPool.map(c=>({constraint:c,score:this.score(c,active)})).sort((a,b)=>b.score-a.score||String(a.constraint.id).localeCompare(String(b.constraint.id)));
    const recommendation=recommendationRanked[0]?this.toRecommendation(recommendationRanked[0],recommendationRanked):null;
    return {
      hasConflict:systemReport.converged===false,
      conflictSetIds:ranked.map(x=>x.constraint.id),
      conflictSetSize:ranked.length,
      minimalConflictSetIds:minimal.map(c=>c.id),
      minimalConflictSetSize:minimal.length,
      minimalConflictSearchPerformed:conflictSet.length>1&&conflictSet.length<=8,
      recommendation,
      alternatives:recommendationRanked.slice(1,4).map(x=>this.toRecommendation(x,recommendationRanked))
    };
  }

  /**
   * Bounded deletion filter. A constraint is removed when the remaining subset is still
   * numerically inconsistent. The final set is irreducible under single deletion for the
   * current deterministic initial pose. Search is intentionally capped at 8 constraints.
   */
  findBoundedIrreducibleSet(conflictSet){
    if(conflictSet.length<2||conflictSet.length>8)return [];
    const semantic=conflictSet.filter(c=>c.solverMode==='SEMANTIC'&&c.semantic?.sourceFeature&&c.semantic?.targetFeature);
    if(semantic.length<2)return [];
    let current=[...semantic];
    if(this.probeConverged(current))return [];
    let index=0;
    while(index<current.length&&current.length>1){
      const candidate=current.filter((_,i)=>i!==index);
      if(candidate.length&&this.probeConverged(candidate)===false) current=candidate;
      else index++;
    }
    return current;
  }

  probeConverged(subset){
    const partIds=new Set();
    for(const c of subset){partIds.add(c.sourcePartId);partIds.add(c.targetPartId);}
    const snapshots=[];
    for(const id of partIds){const mesh=this.editor.getMeshByPartId(id);if(mesh)snapshots.push({mesh,position:mesh.position.clone(),quaternion:mesh.quaternion.clone(),scale:mesh.scale.clone()});}
    try{
      const maxIterations=Math.min(24,Math.max(6,subset.length*4));
      for(let pass=0;pass<maxIterations;pass++) for(const c of subset) this.manager.semanticSolver.apply(c);
      let maxPosition=0,maxAngle=0;
      for(const c of subset){const r=this.manager.residuals.evaluate(c);maxPosition=Math.max(maxPosition,finiteOrHuge(r.positionMm));maxAngle=Math.max(maxAngle,finiteOrHuge(r.angleDeg));}
      return maxPosition<=0.05&&maxAngle<=0.05;
    }catch(_error){return false;}
    finally{
      for(const s of snapshots){s.mesh.position.copy(s.position);s.mesh.quaternion.copy(s.quaternion);s.mesh.scale.copy(s.scale);s.mesh.updateMatrixWorld(true);this.editor.syncPartFromMesh(s.mesh);}
    }
  }

  expandConflictSet(seedIds,active){
    if(!seedIds.length)return [];
    const seed=new Set(seedIds), partIds=new Set();
    for(const c of active)if(seed.has(c.id)){partIds.add(c.sourcePartId);partIds.add(c.targetPartId);}
    let changed=true;
    while(changed){changed=false;for(const c of active){if(partIds.has(c.sourcePartId)||partIds.has(c.targetPartId)){const before=partIds.size;partIds.add(c.sourcePartId);partIds.add(c.targetPartId);if(partIds.size!==before)changed=true;}}}
    return active.filter(c=>seed.has(c.id)||(partIds.has(c.sourcePartId)&&partIds.has(c.targetPartId)));
  }

  score(c,active){
    const r=c.residual||{};let score=Number(r.score||0);
    const sameSource=active.filter(x=>x.sourcePartId===c.sourcePartId).length;
    if(sameSource>1)score+=sameSource*0.75;
    if(c.solverMode!=='SEMANTIC')score+=2;if(c.status==='ERROR')score+=2;if(this.isRedundantEdge(c,active))score+=1.5;
    return Number(score.toFixed(6));
  }

  isRedundantEdge(candidate,active){
    const graph=new Map();const add=(a,b)=>{if(!graph.has(a))graph.set(a,new Set());graph.get(a).add(b);};
    for(const c of active){if(c.id===candidate.id)continue;add(c.sourcePartId,c.targetPartId);add(c.targetPartId,c.sourcePartId);}
    const q=[candidate.sourcePartId],seen=new Set(q);while(q.length){const cur=q.shift();for(const n of graph.get(cur)||[]){if(n===candidate.targetPartId)return true;if(!seen.has(n)){seen.add(n);q.push(n);}}}return false;
  }

  toRecommendation(entry,ranked){
    const c=entry.constraint,r=c.residual||{},reasons=[];
    if(c.status==='ERROR')reasons.push('当前求解状态为 ERROR');
    if(Number(r.positionMm)>0.05)reasons.push(`位置残差 ${round(r.positionMm)}mm`);
    if(Number(r.angleDeg)>0.05)reasons.push(`角度残差 ${round(r.angleDeg)}°`);
    if(c.solverMode!=='SEMANTIC')reasons.push('固定相对矩阵会限制联立求解');
    if(this.isRedundantEdge(c,ranked.map(x=>x.constraint)))reasons.push('位于冗余约束闭环');
    return {constraintId:c.id,label:c.label||c.id,score:entry.score,action:'SUPPRESS',reason:reasons.join('；')||'该约束在当前冲突集中的残差权重最高'};
  }
}
function finiteOrHuge(v){const n=Number(v);return Number.isFinite(n)?n:1e9;}
function round(v){return Number(Number(v||0).toFixed(4));}
