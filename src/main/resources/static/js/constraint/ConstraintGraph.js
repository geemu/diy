/**
 * Lightweight directed constraint graph used by the solver and diagnostics.
 * The graph stores active constraints only and keeps propagation semantics explicit:
 * target -> source means the source follows the target.
 */
export default class ConstraintGraph {
  constructor(constraints = []) {
    this.constraints=(constraints || []).filter(item => item?.type==='RIGID_MATE' && item.enabled!==false && item.suppressed!==true);
    this.bySource=new Map();
    this.byTarget=new Map();
    this.undirected=new Map();
    for (const constraint of this.constraints) {
      push(this.bySource,constraint.sourcePartId,constraint);
      push(this.byTarget,constraint.targetPartId,constraint);
      edge(this.undirected,constraint.sourcePartId,constraint.targetPartId);
      edge(this.undirected,constraint.targetPartId,constraint.sourcePartId);
    }
  }

  constraintsForPart(partId) {
    const result=new Map();
    for (const item of this.bySource.get(partId) || []) result.set(item.id,item);
    for (const item of this.byTarget.get(partId) || []) result.set(item.id,item);
    return [...result.values()];
  }

  sourceConstraints(partId) { return [...(this.bySource.get(partId) || [])]; }

  collectAffected(changedIds = []) {
    const affected=new Set((changedIds || []).filter(Boolean));
    const queue=[...affected];
    while (queue.length) {
      const targetId=queue.shift();
      for (const constraint of this.byTarget.get(targetId) || []) {
        if (!affected.has(constraint.sourcePartId)) {
          affected.add(constraint.sourcePartId);
          queue.push(constraint.sourcePartId);
        }
      }
    }
    return affected;
  }

  connectedComponent(seedPartIds = []) {
    const result=new Set((seedPartIds || []).filter(Boolean));
    const queue=[...result];
    while (queue.length) {
      const id=queue.shift();
      for (const next of this.undirected.get(id) || []) if (!result.has(next)) {result.add(next);queue.push(next);}
    }
    return result;
  }
}

function push(map,key,value){if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(value);}
function edge(map,a,b){if(!a||!b)return;if(!map.has(a))map.set(a,new Set());map.get(a).add(b);}
