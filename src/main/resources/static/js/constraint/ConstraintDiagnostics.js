import {normalizeConstraintKind, semanticDofReductionForKind} from './ConstraintTypes.js';
/**
 * Lightweight constraint diagnostics and DOF accounting.
 *
 * This is intentionally deterministic and conservative: it detects obvious
 * over-constraints/conflicts before edits are applied, and reports rigid-body
 * / parametric degrees of freedom without pretending to be a full nonlinear CAD solver.
 */
export default class ConstraintDiagnostics {
  constructor(editor,constraintManager) {
    this.editor = editor;
    this.constraintManager = constraintManager;
  }

  diagnose(dimensions = this.editor.userDimensions || []) {
    const errors = [];
    const warnings = [];
    const infos = [];
    const parts = (this.editor.parts || []).filter(part => part && !part.generatedByConnectionId);
    const partById = new Map(parts.map(part => [part.id,part]));
    const enabledRigid = (this.constraintManager.constraints || []).filter(item => item?.enabled !== false && item?.suppressed !== true && item?.type === 'RIGID_MATE');

    const uf = new UnionFind(parts.map(part => part.id));
    const rigidParentCount = new Map();
    const rigidEdges = [];
    for (const constraint of enabledRigid) {
      if (!partById.has(constraint.sourcePartId) || !partById.has(constraint.targetPartId)) continue;
      rigidParentCount.set(constraint.sourcePartId,(rigidParentCount.get(constraint.sourcePartId) || 0) + 1);
      if (constraint.solverMode !== 'SEMANTIC') {
        const alreadyConnected = uf.find(constraint.sourcePartId) === uf.find(constraint.targetPartId);
        if (alreadyConnected) warnings.push(issue('REDUNDANT_RIGID_MATE','WARNING',constraint.label || constraint.id,'固定相对矩阵约束形成重复闭环，可能互相覆盖'));
        else uf.union(constraint.sourcePartId,constraint.targetPartId);
        rigidEdges.push([constraint.sourcePartId,constraint.targetPartId]);
      }
    }

    for (const [sourcePartId,count] of rigidParentCount.entries()) {
      if (count > 1) {
        const part = partById.get(sourcePartId);
        const parents=enabledRigid.filter(item=>item.sourcePartId===sourcePartId);
        const hasFrozen=parents.some(item=>item.solverMode!=='SEMANTIC');
        if(hasFrozen) errors.push(issue('MULTIPLE_RIGID_PARENTS','ERROR',part?.displayId || sourcePartId,`同一构件同时被 ${count} 个约束控制，且包含固定相对矩阵约束，求解结果会互相覆盖`));
        else warnings.push(issue('MULTI_SEMANTIC_CONSTRAINTS','WARNING',part?.displayId || sourcePartId,`同一构件由 ${count} 个语义约束联立控制，将使用迭代残差检查`));
      }
    }

    const systemReport=this.constraintManager.lastSystemReport;
    if(systemReport && systemReport.converged===false){
      errors.push(issue('SEMANTIC_SYSTEM_NOT_CONVERGED','ERROR','装配约束系统',`多约束联立未收敛：最大位置残差 ${round(systemReport.maxPositionMm)}mm，最大角度残差 ${round(systemReport.maxAngleDeg)}°`));
      for(const id of systemReport.conflictSetIds||systemReport.conflictConstraintIds||[]){const c=enabledRigid.find(item=>item.id===id);if(c) warnings.push(issue('CONFLICT_CANDIDATE','WARNING',c.label||c.id,'该约束属于当前冲突关联集，可通过抑制建议逐步定位最小冲突'));}
    }

    const directedCycle = findDirectedCycle(enabledRigid.filter(item=>item.solverMode!=='SEMANTIC'));
    if (directedCycle.length) {
      errors.push(issue('RIGID_MATE_CYCLE','ERROR','刚性约束',`检测到有向约束环：${directedCycle.join(' → ')}`));
    }

    const componentMap = new Map();
    for (const part of parts) {
      const root = uf.find(part.id);
      if (!componentMap.has(root)) componentMap.set(root,{root,parts:[],locked:false,rigidBodyDof:6});
      const component = componentMap.get(root);
      component.parts.push(part.id);
      if (part.locked === true) component.locked = true;
    }
    for (const component of componentMap.values()) component.rigidBodyDof = component.locked ? 0 : 6;

    const controlMap = new Map();
    let crossComponentScalarConstraints = 0;
    for (const dimension of dimensions || []) {
      const binding = dimension?.binding;
      if (!binding) continue;
      const bindingValidation = this.validateBindingReferences(binding,partById);
      if (bindingValidation) {
        errors.push(bindingValidation);
        continue;
      }
      const key = drivingKey(binding);
      if (key) {
        const list = controlMap.get(key) || [];
        list.push(dimension);
        controlMap.set(key,list);
      }

      const pair = bindingPartPair(binding);
      if (pair) {
        const [sourcePartId,targetPartId] = pair;
        const sourceRoot = uf.find(sourcePartId);
        const targetRoot = uf.find(targetPartId);
        const targetPart = partById.get(targetPartId);
        if (targetPart?.locked === true) {
          errors.push(issue('DRIVER_TARGET_LOCKED','ERROR',targetPart.displayId || targetPartId,'驱动尺寸试图移动/旋转已锁定构件'));
        }
        if (sourceRoot === targetRoot && sourceRoot !== undefined) {
          errors.push(issue('RIGID_MATE_DRIVER_CONFLICT','ERROR',dimension.text || dimension.id || '驱动尺寸','该驱动尺寸控制的两个构件已由刚性约束固定相对姿态，继续驱动会与刚性关系冲突'));
        } else {
          crossComponentScalarConstraints += 1;
        }
      }
    }

    for (const [key,list] of controlMap.entries()) {
      if (list.length <= 1) continue;
      const values = list.map(item => Number(item.drivingValue)).filter(Number.isFinite);
      const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
      if (spread > 0.001) {
        errors.push(issue('CONFLICTING_DRIVEN_DIMENSION','ERROR',key,`同一自由度被多个驱动尺寸赋予不同目标值：${values.map(value => round(value)).join(' / ')}`));
      } else {
        warnings.push(issue('REDUNDANT_DRIVEN_DIMENSION','WARNING',key,`同一自由度存在 ${list.length} 个重复驱动尺寸`));
      }
    }

    const totalRigidBodyDof = parts.length * 6;
    const semanticConstraintDofReduction = enabledRigid.reduce((sum,item) => sum + semanticDofReduction(item),0);
    const semanticConstraintCount = enabledRigid.filter(item => item.solverMode === 'SEMANTIC').length;
    let remainingRigidBodyDof = 0;
    for (const part of parts) {
      if (part.locked === true) continue;
      remainingRigidBodyDof += typeof this.constraintManager.getMobility==='function' ? this.constraintManager.getMobility(part.id).totalDof : 6;
    }
    remainingRigidBodyDof = Math.max(0,remainingRigidBodyDof - crossComponentScalarConstraints);
    const constrainedRigidBodyDof = Math.max(0,totalRigidBodyDof - remainingRigidBodyDof);

    const totalParametricDof = countParametricDof(parts);
    const controlledParametricKeys = new Set();
    for (const dimension of dimensions || []) {
      const key = parametricDrivingKey(dimension?.binding);
      if (key) controlledParametricKeys.add(key);
    }
    const controlledParametricDof = controlledParametricKeys.size;
    const remainingParametricDof = Math.max(0,totalParametricDof - controlledParametricDof);

    for (const component of componentMap.values()) {
      if (component.locked) infos.push(issue('ANCHORED_RIGID_COMPONENT','INFO',component.parts.join(','),'该刚性组件含锁定构件，组件整体刚体自由度为 0'));
    }

    return {
      ok:errors.length === 0,
      errors,warnings,infos,
      summary:{
        partCount:parts.length,
        rigidConstraintCount:enabledRigid.length,
        drivenDimensionCount:(dimensions || []).filter(item => item?.binding).length,
        totalRigidBodyDof,constrainedRigidBodyDof,remainingRigidBodyDof,
        totalParametricDof,controlledParametricDof,remainingParametricDof,
        componentCount:componentMap.size,semanticConstraintCount,semanticConstraintDofReduction,solverConverged:systemReport?.converged!==false,solverIterations:systemReport?.iterations||0,maxPositionResidualMm:systemReport?.maxPositionMm||0,maxAngleResidualDeg:systemReport?.maxAngleDeg||0,conflictCandidateCount:systemReport?.conflictSetIds?.length||systemReport?.conflictConstraintIds?.length||0,minimalConflictSetCount:systemReport?.minimalConflictSetIds?.length||0,minimalConflictSearchPerformed:systemReport?.minimalConflictSearchPerformed===true,conflictRecommendation:systemReport?.recommendation||null
      },
      components:[...componentMap.values()].map(component => ({...component,parts:[...component.parts]}))
    };
  }

  assertBindingAllowed(binding,ignoreDimensionId = null) {
    if (!binding) return true;
    const parts = (this.editor.parts || []).filter(Boolean);
    const partById = new Map(parts.map(part => [part.id,part]));
    const referenceError = this.validateBindingReferences(binding,partById);
    if (referenceError) throw new Error(referenceError.message);

    const pair = bindingPartPair(binding);
    if (pair) {
      const [sourcePartId,targetPartId] = pair;
      const target = partById.get(targetPartId);
      if (target?.locked === true) throw new Error('目标构件已锁定，不能建立会移动/旋转该构件的驱动尺寸');
      if (this.areRigidlyConnected(sourcePartId,targetPartId)) throw new Error('这两个构件已经通过刚性约束固定相对姿态，不能再建立间距/角度驱动尺寸');
    }

    const key = drivingKey(binding);
    if (key) {
      const duplicate = (this.editor.userDimensions || []).find(item => item?.id !== ignoreDimensionId && drivingKey(item?.binding) === key);
      if (duplicate) throw new Error('该自由度已经存在驱动尺寸，请修改现有尺寸或先删除现有驱动');
    }
    return true;
  }

  assertConstraintAllowed(sourcePartId,targetPartId,solverMode='RIGID_RELATIVE') {
    if (solverMode !== 'SEMANTIC') return this.assertRigidMateAllowed(sourcePartId,targetPartId);
    if (!sourcePartId || !targetPartId) return true;
    const frozenConflict=(this.constraintManager.constraints || []).find(item => item?.enabled!==false && item?.suppressed!==true && item?.type==='RIGID_MATE' && item?.solverMode!=='SEMANTIC' && samePair([item.sourcePartId,item.targetPartId],[sourcePartId,targetPartId]));
    if (frozenConflict) throw new Error('这两个构件之间存在历史固定相对矩阵约束，请先抑制或删除后再建立联立语义约束');
    return true;
  }

  assertRigidMateAllowed(sourcePartId,targetPartId) {
    if (!sourcePartId || !targetPartId) return true;
    if (this.areRigidlyConnected(sourcePartId,targetPartId)) throw new Error('这两个构件已经属于同一刚性约束组件');
    const conflicting = (this.editor.userDimensions || []).find(dimension => {
      const pair = bindingPartPair(dimension?.binding);
      if (!pair) return false;
      return samePair(pair,[sourcePartId,targetPartId]);
    });
    if (conflicting) throw new Error('这两个构件之间已存在间距/角度驱动尺寸，请先删除驱动尺寸再建立刚性约束');
    return true;
  }

  areRigidlyConnected(a,b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const graph = new Map();
    for (const constraint of this.constraintManager.constraints || []) {
      if (constraint?.enabled === false || constraint?.suppressed === true || constraint?.type !== 'RIGID_MATE') continue;
      const fullyRigid=constraint.solverMode!=='SEMANTIC' || this.constraintManager.getMobility(constraint.sourcePartId).totalDof===0;
      if(!fullyRigid) continue;
      addEdge(graph,constraint.sourcePartId,constraint.targetPartId);
      addEdge(graph,constraint.targetPartId,constraint.sourcePartId);
    }
    const queue = [a];
    const visited = new Set([a]);
    while (queue.length) {
      const current = queue.shift();
      for (const next of graph.get(current) || []) {
        if (next === b) return true;
        if (!visited.has(next)) {visited.add(next);queue.push(next);}
      }
    }
    return false;
  }

  validateBindingReferences(binding,partById) {
    const type = String(binding?.type || '').toUpperCase();
    if (['PROFILE_LENGTH','PROFILE_RADIUS','PROFILE_ARC_ANGLE','MACHINING_STATION','MACHINING_OFFSET'].includes(type)) {
      const part = partById.get(binding.partId);
      if (!part) return issue('DRIVER_PART_MISSING','ERROR',binding.partId || '未知构件','驱动尺寸引用的构件不存在');
      if (!['PROFILE_LENGTH','PROFILE_RADIUS','PROFILE_ARC_ANGLE'].includes(type)) {
        const machining = part.machiningItems?.find(item => item.id === binding.machiningId);
        if (!machining) return issue('DRIVER_MACHINING_MISSING','ERROR',part.displayId || part.id,'驱动尺寸引用的加工项不存在');
      }
      return null;
    }
    const pair = bindingPartPair(binding);
    if (pair && (!partById.has(pair[0]) || !partById.has(pair[1]))) {
      return issue('DRIVER_PART_PAIR_MISSING','ERROR',binding.type || '驱动尺寸','驱动尺寸引用的源/目标构件不存在');
    }
    return null;
  }
}

export function drivingKey(binding) {
  if (!binding) return null;
  const type = String(binding.type || '').toUpperCase();
  if (type === 'PROFILE_LENGTH') return `PROFILE:${binding.partId}:LENGTH`;
  if (type === 'PROFILE_RADIUS') return `PROFILE:${binding.partId}:RADIUS`;
  if (type === 'PROFILE_ARC_ANGLE') return `PROFILE:${binding.partId}:ARC_ANGLE`;
  if (type === 'MACHINING_STATION') return `MACHINING:${binding.partId}:${binding.machiningId}:STATION`;
  if (type === 'MACHINING_OFFSET') return `MACHINING:${binding.partId}:${binding.machiningId}:OFFSET`;
  if (type === 'PART_AXIS_DISTANCE') return `PAIR:${binding.sourcePartId}:${binding.targetPartId}:AXIS:${String(binding.axis || 'X').toUpperCase()}`;
  if (type === 'PART_AXIS_COORDINATE') return `PAIR:${binding.sourcePartId}:${binding.targetPartId}:ORDINATE:${String(binding.axis || 'X').toUpperCase()}`;
  if (type === 'PART_CLEARANCE') return `PAIR:${binding.sourcePartId}:${binding.targetPartId}:CLEARANCE:${String(binding.axis || 'X').toUpperCase()}`;
  if (type === 'SLOT_CENTER_DISTANCE') return `PAIR:${binding.sourcePartId}:${binding.targetPartId}:SLOT:${binding.sourceFace}:${binding.targetFace}`;
  if (type === 'PROFILE_ANGLE') return `PAIR:${binding.sourcePartId}:${binding.targetPartId}:ANGLE:${String(binding.axis || 'Y').toUpperCase()}`;
  return null;
}

function parametricDrivingKey(binding) {
  const type = String(binding?.type || '').toUpperCase();
  return ['PROFILE_LENGTH','PROFILE_RADIUS','PROFILE_ARC_ANGLE','MACHINING_STATION','MACHINING_OFFSET'].includes(type) ? drivingKey(binding) : null;
}

function bindingPartPair(binding) {
  const type = String(binding?.type || '').toUpperCase();
  if (!['PART_AXIS_DISTANCE','PART_AXIS_COORDINATE','PART_CLEARANCE','SLOT_CENTER_DISTANCE','PROFILE_ANGLE'].includes(type)) return null;
  if (!binding.sourcePartId || !binding.targetPartId) return null;
  return [String(binding.sourcePartId),String(binding.targetPartId)];
}

function samePair(a,b) {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

function countParametricDof(parts) {
  let count = 0;
  for (const part of parts) {
    if (part.type !== 'PROFILE') continue;
    if (part.profilePath?.type === 'ARC') count += 2; // radius + angle
    else count += 1; // length
    for (const item of part.machiningItems || []) {
      if (item.generatedByConnectionId || item.type === 'END_TAP') continue;
      count += 2; // stationS + face offset
    }
  }
  return count;
}

function findDirectedCycle(constraints) {
  const graph = new Map();
  for (const item of constraints || []) {
    if (!item?.sourcePartId || !item?.targetPartId) continue;
    if (!graph.has(item.targetPartId)) graph.set(item.targetPartId,[]);
    graph.get(item.targetPartId).push(item.sourcePartId);
  }
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  let result = [];
  const dfs = node => {
    if (visiting.has(node)) {
      const index = stack.indexOf(node);
      result = [...stack.slice(index),node];
      return true;
    }
    if (visited.has(node)) return false;
    visiting.add(node);stack.push(node);
    for (const next of graph.get(node) || []) if (dfs(next)) return true;
    stack.pop();visiting.delete(node);visited.add(node);
    return false;
  };
  for (const node of graph.keys()) if (dfs(node)) break;
  return result;
}

function addEdge(graph,a,b) {
  if (!a || !b) return;
  if (!graph.has(a)) graph.set(a,new Set());
  graph.get(a).add(b);
}

function issue(code,level,subject,message) {return {code,level,subject,message};}
function round(value) {return Number(Number(value).toFixed(3));}

class UnionFind {
  constructor(items = []) {this.parent = new Map(items.map(item => [item,item]));}
  find(item) {
    if (!this.parent.has(item)) return undefined;
    let root = item;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    let current = item;
    while (this.parent.get(current) !== current) {
      const next = this.parent.get(current);
      this.parent.set(current,root);
      current = next;
    }
    return root;
  }
  union(a,b) {
    const ra = this.find(a); const rb = this.find(b);
    if (ra === undefined || rb === undefined || ra === rb) return false;
    this.parent.set(ra,rb);
    return true;
  }
}


function semanticDofReduction(constraint) {
  if (constraint?.solverMode !== 'SEMANTIC') return 6;
  return semanticDofReductionForKind(normalizeConstraintKind(constraint.mateKind));
}
