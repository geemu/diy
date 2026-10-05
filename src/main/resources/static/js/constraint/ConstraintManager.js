import * as THREE from 'three';
import ConstraintDiagnostics from './ConstraintDiagnostics.js';
import SemanticConstraintSolver from './SemanticConstraintSolver.js';
import ConstraintResiduals from './ConstraintResiduals.js';
import ConstraintConflictAnalyzer from './ConstraintConflictAnalyzer.js';
import ConstraintMobility from './ConstraintMobility.js';
import ConstraintGraph from './ConstraintGraph.js';
import {normalizeConstraintKind} from './ConstraintTypes.js';

/**
 * Directed rigid mate constraints.
 * The source part follows the target part while keeping the captured relative transform.
 */
export default class ConstraintManager {
  constructor(editor) {
    this.editor = editor;
    this.constraints = [];
    this.solving = false;
    this.diagnostics = new ConstraintDiagnostics(editor,this);
    this.semanticSolver = new SemanticConstraintSolver(editor);
    this.residuals = new ConstraintResiduals(editor);
    this.conflictAnalyzer = new ConstraintConflictAnalyzer(editor,this);
    this.mobility = new ConstraintMobility(editor,this);
    this.lastSystemReport = {converged:true,iterations:0,maxPositionMm:0,maxAngleDeg:0,conflictConstraintIds:[]};
  }

  createRigidMateFromLastSnap(sourceMesh, options = {}) {
    if (!sourceMesh?.userData?.part) throw new Error('请选择需要约束的构件');
    const snap = sourceMesh.userData.lastSnap;
    if (!snap?.targetProfileId) throw new Error('当前构件没有有效吸附目标');
    const targetMesh = this.editor.getMeshByPartId(snap.targetProfileId);
    if (!targetMesh?.userData?.part) throw new Error('吸附目标不存在');
    if (targetMesh === sourceMesh) throw new Error('不能对自身建立约束');
    this.diagnostics.assertConstraintAllowed(sourceMesh.userData.part.id,targetMesh.userData.part.id,options.solverMode || 'RIGID_RELATIVE');

    sourceMesh.updateMatrixWorld(true);
    targetMesh.updateMatrixWorld(true);
    const relative = new THREE.Matrix4()
      .copy(targetMesh.matrixWorld)
      .invert()
      .multiply(sourceMesh.matrixWorld);

    const sourcePart = sourceMesh.userData.part;
    const targetPart = targetMesh.userData.part;
    const constraint = {
      id:crypto.randomUUID(),
      type:'RIGID_MATE',
      label:options.label || `${sourcePart.displayId || sourcePart.name} ↔ ${targetPart.displayId || targetPart.name}`,
      sourcePartId:sourcePart.id,
      targetPartId:targetPart.id,
      sourceAnchor:{end:snap.sourceEnd || null},
      targetAnchor:{face:snap.targetFace || null,slot:snap.slot || null},
      relativeMatrix:relative.toArray(),
      enabled:true,
      createdFrom:'SNAP',
      mateKind:normalizeConstraintKind(options.mateKind || 'COINCIDENT'),
      offsetMm:Number(options.offsetMm || 0),
      angleDeg:Number(options.angleDeg ?? 90),
      flipped:options.flipped === true,
      semantic:options.semantic || null,
      solverMode:options.solverMode || 'RIGID_RELATIVE',
      solverVersion:Number(options.solverVersion || 1),
      referenceRelativeQuaternion:options.referenceRelativeQuaternion || captureRelativeQuaternion(sourceMesh,targetMesh)
    };
    this.constraints.push(constraint);
    return constraint;
  }

  solveForChangedParts(partIds = []) {
    if (this.solving || !this.constraints.length) return [];
    const changed = new Set((partIds || []).filter(Boolean));
    if (!changed.size) return [];
    const active = this.constraints.filter(item => item?.type === 'RIGID_MATE' && item.enabled !== false && item.suppressed !== true);
    const graph = new ConstraintGraph(active);
    if (!active.length) return [];
    for (const constraint of active) {constraint.status='PENDING';constraint.lastSolveError=null;}
    const affected = graph.collectAffected([...changed]);
    const applicable = active.filter(item => changed.has(item.sourcePartId) || affected.has(item.targetPartId) || affected.has(item.sourcePartId));
    const applied = new Set();
    this.solving = true;
    let iterations=0;
    try {
      // Deterministic Gauss-Seidel iteration. Partial semantic mates may share a source;
      // each pass reapplies all relations until numeric residuals settle.
      const maxIterations=Math.min(24,Math.max(4,applicable.length*3));
      for (let pass=0;pass<maxIterations;pass++) {
        iterations=pass+1;
        for (const constraint of applicable) {
          try {
            if(this.applyRigidMate(constraint)){constraint.status='SOLVED';applied.add(constraint.sourcePartId);affected.add(constraint.sourcePartId);}
          } catch(error){constraint.status='ERROR';constraint.lastSolveError=error?.message||String(error);}
        }
        const report=this.evaluateSystem(applicable,iterations);
        this.lastSystemReport=report;
        if(report.converged) break;
      }
      const finalReport=this.evaluateSystem(applicable,iterations);
      this.lastSystemReport=finalReport;
      if(!finalReport.converged){
        for(const id of finalReport.conflictConstraintIds){const c=active.find(item=>item.id===id);if(c){c.status='ERROR';c.lastSolveError=`多约束未收敛：位置残差 ${c.residual?.positionMm ?? '-'}mm，角度残差 ${c.residual?.angleDeg ?? '-'}°`;}}
      }
    } finally {this.solving=false;}
    return [...applied];
  }

  collectAffected(changed,active){
    return new ConstraintGraph(active).collectAffected([...changed]);
  }

  evaluateSystem(constraints,iterations=0){
    let maxPositionMm=0,maxAngleDeg=0;const ranked=[];
    for(const c of constraints){
      if(c.solverMode!=='SEMANTIC'||c.status==='ERROR'&&c.lastSolveError&&!c.residual)continue;
      const residual=this.residuals.evaluate(c);c.residual=residual;
      maxPositionMm=Math.max(maxPositionMm,Number.isFinite(residual.positionMm)?residual.positionMm:1e9);
      maxAngleDeg=Math.max(maxAngleDeg,Number.isFinite(residual.angleDeg)?residual.angleDeg:1e9);
      ranked.push([residual.score,c.id]);
    }
    const converged=maxPositionMm<=0.05&&maxAngleDeg<=0.05;
    ranked.sort((a,b)=>b[0]-a[0]);
    const conflictConstraintIds=converged?[]:ranked.filter(([score])=>score>1).slice(0,Math.max(1,Math.min(6,ranked.length))).map(([,id])=>id);
    const base={converged,iterations,maxPositionMm:Number(maxPositionMm.toFixed(6)),maxAngleDeg:Number(maxAngleDeg.toFixed(6)),conflictConstraintIds};
    const conflictAnalysis=this.conflictAnalyzer.analyze(constraints,base);
    return {...base,...conflictAnalysis};
  }

  applyRigidMate(constraint) {
    if (constraint.solverMode === 'SEMANTIC' && constraint.semantic?.sourceFeature && constraint.semantic?.targetFeature) {
      return this.semanticSolver.apply(constraint);
    }
    const source = this.editor.getMeshByPartId(constraint.sourcePartId);
    const target = this.editor.getMeshByPartId(constraint.targetPartId);
    if (!source || !target || !Array.isArray(constraint.relativeMatrix) || constraint.relativeMatrix.length !== 16) return false;

    target.updateMatrixWorld(true);
    const relative = new THREE.Matrix4().fromArray(constraint.relativeMatrix);
    const world = new THREE.Matrix4().multiplyMatrices(target.matrixWorld, relative);
    const local = world.clone();
    if (source.parent) {
      source.parent.updateMatrixWorld(true);
      local.premultiply(source.parent.matrixWorld.clone().invert());
    }
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    local.decompose(position, quaternion, scale);
    source.position.copy(position);
    source.quaternion.copy(quaternion);
    source.scale.copy(scale);
    source.updateMatrixWorld(true);
    this.editor.syncPartFromMesh(source);
    return true;
  }


  getMobility(partId) { return this.mobility.describe(partId); }

  diagnose(dimensions = this.editor.userDimensions || []) {
    return this.diagnostics.diagnose(dimensions);
  }

  assertBindingAllowed(binding,ignoreDimensionId = null) {
    return this.diagnostics.assertBindingAllowed(binding,ignoreDimensionId);
  }

  areRigidlyConnected(sourcePartId,targetPartId) {
    return this.diagnostics.areRigidlyConnected(sourcePartId,targetPartId);
  }

  setSuppressed(id, suppressed = true) {
    const constraint = this.constraints.find(item => item.id === id);
    if (!constraint) return null;
    constraint.suppressed = suppressed === true;
    constraint.status = constraint.suppressed ? 'SUPPRESSED' : 'PENDING';
    constraint.lastSolveError = null;
    if (!constraint.suppressed) this.solveForChangedParts([constraint.targetPartId]);
    return constraint;
  }

  toggleSuppressed(id) {
    const constraint = this.constraints.find(item => item.id === id);
    if (!constraint) return null;
    return this.setSuppressed(id, constraint.suppressed !== true);
  }

  remove(id) {
    this.constraints = this.constraints.filter(item => item.id !== id);
  }

  removeForPart(partId) {
    this.constraints = this.constraints.filter(item => item.sourcePartId !== partId && item.targetPartId !== partId);
  }

  listForPart(partId) {
    return this.constraints.filter(item => item.sourcePartId === partId || item.targetPartId === partId);
  }

  load(list = []) {
    this.constraints = structuredClone(Array.isArray(list) ? list : [])
      .filter(item => item && item.type === 'RIGID_MATE')
      .map(item => ({...item,enabled:item.enabled !== false,suppressed:item.suppressed === true,status:item.suppressed === true ? 'SUPPRESSED' : (item.status || 'SOLVED'),solverVersion:Number(item.solverVersion || 1),solverMode:item.solverMode || 'RIGID_RELATIVE',residual:item.residual || null,mateKind:normalizeConstraintKind(item.mateKind || 'COINCIDENT'),offsetMm:Number(item.offsetMm || 0),angleDeg:Number(item.angleDeg ?? 90),flipped:item.flipped === true,semantic:item.semantic || null,referenceRelativeQuaternion:Array.isArray(item.referenceRelativeQuaternion)?item.referenceRelativeQuaternion:null}));
  }

  export() {
    return structuredClone(this.constraints);
  }

  clear() {
    this.constraints = [];
  }
}

function captureRelativeQuaternion(source,target){
  if(!source||!target)return null;
  source.updateMatrixWorld(true);target.updateMatrixWorld(true);
  const sourceQ=source.getWorldQuaternion(new THREE.Quaternion());
  const targetQ=target.getWorldQuaternion(new THREE.Quaternion());
  return targetQ.clone().invert().multiply(sourceQ).normalize().toArray();
}
