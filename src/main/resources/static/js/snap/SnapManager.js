import * as THREE from 'three';
import {getLocalEndpoints, isLinearProfile} from '../model/ProfilePath.js';
import {resolveProfileFeature,findNearestProfileFeature,getSlotOffsetsForFace} from '../model/ProfileFeatureCatalog.js';

/**
 * 基础 DIY 几何吸附。
 *
 * v0.63 的重点不是继续增加“能吸”的类型，而是让吸附稳定、可解释：
 * - 候选有明确优先级；
 * - 当前候选带滞回锁定，鼠标轻微抖动不会在多个面之间跳；
 * - Ctrl 可临时绕过几何吸附；
 * - SceneManager 统一显示“端面贴合 / 槽中心 / 端点对齐”等反馈。
 */
export default class SnapManager {
  constructor(editor) {
    this.editor = editor;
    this.enabled = true;
    this.temporaryDisabled = false;
    this.distance = 35;
    this.releaseDistance = 55;
    this.rotationSnapEnabled = true;
    this.rotationStep = Math.PI / 2;
    this.lastSession = null;
    this.previewLockKey = null;
  }

  isEnabled() {
    return this.enabled && !this.temporaryDisabled;
  }

  setTemporaryDisabled(disabled) {
    this.temporaryDisabled = disabled === true;
    if (this.temporaryDisabled) {
      this.previewLockKey = null;
      this.editor.sceneManager.clearSnapPreview();
      this.editor.sceneManager.hideSnapFeedback?.();
    }
  }

  clearLock() {
    this.previewLockKey = null;
    this.lastSession = null;
  }

  snap(mesh) {
    if (!this.isEnabled() || !mesh) return null;
    const part = mesh.userData?.part;
    if (!part) return null;

    if (this.rotationSnapEnabled && part.type === 'PROFILE' && isLinearProfile(part)) {
      mesh.rotation.x = this.snapAngle(mesh.rotation.x);
      mesh.rotation.y = this.snapAngle(mesh.rotation.y);
      mesh.rotation.z = this.snapAngle(mesh.rotation.z);
      mesh.updateMatrixWorld(true);
    }
    if (part.type !== 'PROFILE' || !isLinearProfile(part)) {
      this.lastSession = null;
      return null;
    }

    const originPosition = mesh.position.clone();
    const candidates = this.sortedCandidates(mesh,this.distance);
    if (!candidates.length) {
      mesh.userData.lastSnap = null;
      this.lastSession = null;
      this.previewLockKey = null;
      this.editor.sceneManager.hideSnapFeedback?.();
      return null;
    }
    const preferred = this.preferredCandidate(candidates) || candidates[0];
    const index = Math.max(0,candidates.indexOf(preferred));
    this.lastSession = {sourceId:part.id,originPosition,candidates,index};
    this.previewLockKey = preferred.key;
    return this.applyCandidate(mesh,index);
  }

  preview(mesh) {
    if (!this.isEnabled() || !mesh || mesh.userData?.part?.type !== 'PROFILE' || !isLinearProfile(mesh.userData.part)) {
      this.editor.sceneManager.clearSnapPreview();
      this.editor.sceneManager.hideSnapFeedback?.();
      return null;
    }
    mesh.updateMatrixWorld(true);
    const normalCandidates = this.sortedCandidates(mesh,this.distance);
    const releaseCandidates = this.previewLockKey ? this.sortedCandidates(mesh,this.releaseDistance) : normalCandidates;
    let candidate = releaseCandidates.find(item => item.key === this.previewLockKey) || normalCandidates[0] || null;
    if (!candidate) {
      this.previewLockKey = null;
      this.editor.sceneManager.clearSnapPreview();
      this.editor.sceneManager.hideSnapFeedback?.();
      return null;
    }
    this.previewLockKey = candidate.key;
    const snap = {...candidate.snap,candidateIndex:1,candidateCount:normalCandidates.length || 1,preview:true};
    this.editor.sceneManager.showSnapPreview(candidate.sourcePoint,candidate.targetPoint,snap);
    this.editor.sceneManager.showSnapFeedback?.({
      status:'valid',
      label:snap.feedbackLabel || snapTypeLabel(snap.type),
      details:this.feedbackDetails(snap)
    });
    return snap;
  }

  cycleCandidate(mesh, direction = 1) {
    const session = this.lastSession;
    if (!mesh || !session || session.sourceId !== mesh.userData?.part?.id || session.candidates.length < 2) return null;
    const count = session.candidates.length;
    session.index = (session.index + (direction < 0 ? -1 : 1) + count) % count;
    const candidate = session.candidates[session.index];
    this.previewLockKey = candidate.key;
    return this.applyCandidate(mesh,session.index);
  }

  applyCandidate(source,index) {
    const session = this.lastSession;
    if (!session) return null;
    const candidate = session.candidates[index];
    source.position.copy(session.originPosition).add(candidate.delta);
    source.updateMatrixWorld(true);
    const snap = {
      ...candidate.snap,
      candidateIndex:index + 1,
      candidateCount:session.candidates.length
    };
    source.userData.lastSnap = snap;
    this.editor.sceneManager.showSnapPoint(candidate.targetPoint);
    this.editor.sceneManager.showSnapFeedback?.({status:'valid',label:snap.feedbackLabel || snapTypeLabel(snap.type),details:this.feedbackDetails(snap)});
    return snap;
  }

  resolveFeatureAtPoint(mesh, worldPoint, options = {}) {
    return resolveProfileFeature(mesh,worldPoint,options);
  }

  findFeatureNearWorldPoint(worldPoint, options = {}) {
    if (!this.isEnabled() && options.ignoreEnabled !== true) return null;
    const maxDistance=Number(options.maxDistanceMm ?? this.distance);
    let best=null;
    for(const mesh of this.editor.meshes){
      if(mesh.visible===false||mesh.userData?.part?.type!=='PROFILE'||!isLinearProfile(mesh.userData.part))continue;
      if(options.excludePartId && mesh.userData?.part?.id===options.excludePartId)continue;
      const feature=findNearestProfileFeature(mesh,worldPoint,options);
      if(!feature||feature.distanceMm>maxDistance)continue;
      const priority=feature.type==='PROFILE_END'?0:feature.type==='PROFILE_SLOT'?1:2;
      if(!best||priority<best.priority||(priority===best.priority&&feature.distanceMm<best.feature.distanceMm))best={feature,priority};
    }
    return best?.feature||null;
  }

  sortedCandidates(source,maxDistance=this.distance) {
    return this.collectCandidates(source,maxDistance).sort((a,b) => a.priority - b.priority || a.score - b.score);
  }

  preferredCandidate(candidates) {
    if (!this.previewLockKey) return null;
    return candidates.find(item => item.key === this.previewLockKey) || null;
  }

  collectCandidates(source,maxDistance=this.distance) {
    source.updateMatrixWorld(true);
    const sourceEndpoints = this.endpoints(source);
    return dedupe([
      ...this.collectSlotCandidates(source,sourceEndpoints,maxDistance),
      ...this.collectFaceCandidates(source,sourceEndpoints,maxDistance),
      ...this.collectEndpointCandidates(source,sourceEndpoints,maxDistance)
    ]).map(item => ({...item,key:candidateKey(item)}));
  }

  collectSlotCandidates(source, sourceEndpoints,maxDistance) {
    const output = [];
    const slotDistance = Math.min(maxDistance,24);
    for (const target of this.targets(source)) {
      target.updateMatrixWorld(true);
      const targetPart = target.userData.part;
      const length = Number(targetPart.dimensions?.length || 0);
      const [widthRaw,heightRaw] = targetPart.dimensions?.sectionSize || [30,30];
      const width = Number(widthRaw || 30);
      const height = Number(heightRaw || 30);
      for (const [sourceName, sourcePoint] of Object.entries(sourceEndpoints)) {
        const sourceEnd = sourceName === 'start' ? 'START' : 'END';
        const axis = this.sourceAxis(source,sourceEnd);
        const local = target.worldToLocal(sourcePoint.clone());
        const station = clamp(local.z,-length/2,length/2);
        const points = [];
        for(const face of ['FRONT','BACK','RIGHT','LEFT']){
          const offsets=getSlotOffsetsForFace(targetPart,face);
          offsets.forEach((offset,slotIndex)=>{
            const point=face==='FRONT'?new THREE.Vector3(offset,height/2,station):face==='BACK'?new THREE.Vector3(offset,-height/2,station):face==='RIGHT'?new THREE.Vector3(width/2,offset,station):new THREE.Vector3(-width/2,offset,station);
            points.push({face,point,slotOffset:offset,slotIndex});
          });
        }
        for (const item of points) {
          const worldPoint = target.localToWorld(item.point.clone());
          const distance = sourcePoint.distanceTo(worldPoint);
          if (distance > slotDistance) continue;
          const alignment = Math.abs(axis.dot(this.faceNormal(target,item.face)));
          if (alignment < 0.86) continue;
          output.push(this.candidate(sourcePoint,worldPoint,0,distance + (1-alignment)*14,{
            type:'END_TO_SLOT',feedbackLabel:'槽中心对齐',targetProfileId:targetPart.id,targetDisplayId:targetPart.displayId,sourceEnd,targetFace:item.face,slot:'CENTER',slotIndex:item.slotIndex,slotOffset:item.slotOffset,distance:Number(distance.toFixed(3)),alignment:Number(alignment.toFixed(3))
          }));
        }
      }
    }
    return output;
  }

  collectFaceCandidates(source, sourceEndpoints,maxDistance) {
    const output = [];
    for (const target of this.targets(source)) {
      target.updateMatrixWorld(true);
      const targetPart = target.userData.part;
      const length = Number(targetPart.dimensions?.length || 0);
      const [widthRaw,heightRaw] = targetPart.dimensions?.sectionSize || [30,30];
      const width = Number(widthRaw || 30);
      const height = Number(heightRaw || 30);
      for (const [sourceName, sourcePoint] of Object.entries(sourceEndpoints)) {
        const sourceEnd = sourceName === 'start' ? 'START' : 'END';
        const axis = this.sourceAxis(source,sourceEnd);
        const local = target.worldToLocal(sourcePoint.clone());
        const points = [
          {face:'FRONT',point:new THREE.Vector3(clamp(local.x,-width/2,width/2),height/2,clamp(local.z,-length/2,length/2))},
          {face:'BACK',point:new THREE.Vector3(clamp(local.x,-width/2,width/2),-height/2,clamp(local.z,-length/2,length/2))},
          {face:'RIGHT',point:new THREE.Vector3(width/2,clamp(local.y,-height/2,height/2),clamp(local.z,-length/2,length/2))},
          {face:'LEFT',point:new THREE.Vector3(-width/2,clamp(local.y,-height/2,height/2),clamp(local.z,-length/2,length/2))}
        ];
        for (const item of points) {
          const worldPoint = target.localToWorld(item.point.clone());
          const distance = sourcePoint.distanceTo(worldPoint);
          if (distance > maxDistance) continue;
          const alignment = Math.abs(axis.dot(this.faceNormal(target,item.face)));
          if (alignment < 0.82) continue;
          output.push(this.candidate(sourcePoint,worldPoint,1,distance + (1-alignment)*20,{
            type:'END_TO_FACE',feedbackLabel:'端面贴合',targetProfileId:targetPart.id,targetDisplayId:targetPart.displayId,sourceEnd,targetFace:item.face,distance:Number(distance.toFixed(3)),alignment:Number(alignment.toFixed(3))
          }));
        }
      }
    }
    return output;
  }

  collectEndpointCandidates(source, sourceEndpoints,maxDistance) {
    const output = [];
    for (const target of this.targets(source)) {
      target.updateMatrixWorld(true);
      const targetEndpoints = this.endpoints(target);
      for (const [sourceName,sourcePoint] of Object.entries(sourceEndpoints)) {
        for (const [targetName,targetPoint] of Object.entries(targetEndpoints)) {
          const distance = sourcePoint.distanceTo(targetPoint);
          if (distance > maxDistance) continue;
          output.push(this.candidate(sourcePoint,targetPoint,2,distance,{
            type:'END_TO_END',feedbackLabel:'端点对齐',targetProfileId:target.userData.part.id,targetDisplayId:target.userData.part.displayId,sourceEnd:sourceName === 'start' ? 'START' : 'END',targetEnd:targetName === 'start' ? 'START' : 'END',targetFace:null,distance:Number(distance.toFixed(3))
          }));
        }
      }
    }
    return output;
  }

  feedbackDetails(snap) {
    const items=[];
    if(snap.targetDisplayId)items.push(snap.targetDisplayId);
    if(snap.targetFace)items.push(faceLabel(snap.targetFace));
    if(snap.alignment>=0.96)items.push('垂直');
    if(Number.isFinite(Number(snap.distance)))items.push(`${Number(snap.distance).toFixed(1)} mm`);
    return items;
  }

  candidate(sourcePoint,targetPoint,priority,score,snap) {
    return {priority,score,snap,sourcePoint:sourcePoint.clone(),targetPoint:targetPoint.clone(),delta:targetPoint.clone().sub(sourcePoint)};
  }

  targets(source) {
    const moving=new Set((this.editor.currentTransformMeshes?.()||[]).map(mesh=>mesh?.userData?.part?.id).filter(Boolean));
    moving.add(source?.userData?.part?.id);
    return this.editor.meshes.filter(target => {
      if (target === source || target.visible === false) return false;
      const part = target.userData?.part;
      if(moving.has(part?.id))return false;
      return part?.type === 'PROFILE' && isLinearProfile(part);
    });
  }

  snapAngle(value) {
    return Math.round(value / this.rotationStep) * this.rotationStep;
  }

  endpoints(mesh) {
    const endpoints = getLocalEndpoints(mesh.userData.part);
    return {
      start:mesh.localToWorld(new THREE.Vector3(...endpoints.start)),
      end:mesh.localToWorld(new THREE.Vector3(...endpoints.end))
    };
  }

  sourceAxis(mesh, sourceEnd) {
    const direction = new THREE.Vector3(0,0,sourceEnd === 'START' ? -1 : 1);
    direction.transformDirection(mesh.matrixWorld);
    return direction.normalize();
  }

  faceNormal(target, face) {
    const normal = new THREE.Vector3();
    if (face === 'FRONT') normal.set(0,1,0);
    else if (face === 'BACK') normal.set(0,-1,0);
    else if (face === 'RIGHT') normal.set(1,0,0);
    else normal.set(-1,0,0);
    normal.transformDirection(target.matrixWorld);
    return normal.normalize();
  }
}

function clamp(value,min,max) {
  return Math.max(min,Math.min(max,Number(value)));
}

function candidateKey(item) {
  const snap=item.snap;
  return [snap.type,snap.targetProfileId,snap.sourceEnd,snap.targetFace || snap.targetEnd || '',snap.slotIndex ?? '',Math.round(item.targetPoint.x*10),Math.round(item.targetPoint.y*10),Math.round(item.targetPoint.z*10)].join('|');
}

function dedupe(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key=candidateKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function snapTypeLabel(type){
  if(type==='END_TO_SLOT')return '槽中心对齐';
  if(type==='END_TO_FACE')return '端面贴合';
  if(type==='END_TO_END')return '端点对齐';
  return '几何吸附';
}

function faceLabel(face){
  if(face==='FRONT')return '前面';
  if(face==='BACK')return '后面';
  if(face==='LEFT')return '左面';
  if(face==='RIGHT')return '右面';
  return String(face||'');
}
