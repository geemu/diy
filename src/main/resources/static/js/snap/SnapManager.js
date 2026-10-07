import * as THREE from 'three';
import {getLocalEndpoints, isLinearProfile} from '../model/ProfilePath.js';
import {resolveProfileFeature,findNearestProfileFeature,getSlotOffsetsForFace} from '../model/ProfileFeatureCatalog.js';
import {profileObb,intersectObb} from '../validation/PartCollisionDetector.js';

/**
 * 基础 DIY 几何吸附。
 *
 * v0.63 的重点不是继续增加“能吸”的类型，而是让吸附稳定、可解释：
 * - 优先选择改动最小的真实贴面位置，槽中心不能覆盖已经齐平的端面；
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
    this.surfaceAlignDistance = 3;
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
    this.blockedCandidate=null;
  }

  snap(mesh) {
    if (!this.isEnabled() || !mesh) return null;
    const part = mesh.userData?.part;
    if (!part) return null;

    // 平移吸附不得在松手时把已有斜杆/滚转角偷偷取整；旋转步长由 TransformControls 负责。
    if (part.type !== 'PROFILE' || !isLinearProfile(part)) {
      this.lastSession = null;
      return null;
    }

    const originPosition = mesh.position.clone();
    const candidates = this.previewCandidates(mesh);
    if (!candidates.length) {
      mesh.userData.lastSnap = null;
      this.lastSession = null;
      this.previewLockKey = null;
      this.editor.sceneManager.hideSnapFeedback?.();
      return null;
    }
    const preferred = this.preferredCandidate(candidates);
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
    const candidates = this.previewCandidates(mesh);
    const candidate = this.preferredCandidate(candidates);
    if (!candidate) {
      this.previewLockKey = null;
      this.editor.sceneManager.clearSnapPreview();
      if(this.blockedCandidate)this.editor.sceneManager.showSnapFeedback?.({status:'blocked',label:'吸附位置不可用',details:[this.blockedCandidate.message]});
      else this.editor.sceneManager.hideSnapFeedback?.();
      return null;
    }
    this.previewLockKey = candidate.key;
    const snap = {...candidate.snap,candidateIndex:candidates.indexOf(candidate)+1,candidateCount:candidates.length,preview:true};
    this.editor.sceneManager.showSnapPreview(candidate.sourcePoint,candidate.targetPoint,snap);
    this.editor.sceneManager.showSnapSurface?.(this.editor.getMeshByPartId(snap.targetProfileId),snap);
    const alignmentLabel=this.editor.sceneManager.showCoplanarPreview?.(mesh,this.editor.getMeshByPartId(snap.targetProfileId),candidate.delta);
    this.editor.sceneManager.showSnapFeedback?.({
      status:'valid',
      label:`松手贴合 · ${snap.feedbackLabel || snapTypeLabel(snap.type)}`,
      details:[...this.feedbackDetails(snap),...(alignmentLabel?[alignmentLabel]:[])]
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

  /** 方向贴合只允许提交当前指定目标的零间隙端面候选，不重新跳向附近的槽中心。 */
  snapToTarget(mesh,targetPartId){
    mesh.updateMatrixWorld(true);
    const candidate=this.collectCandidates(mesh,0.1).find(row=>row.snap.targetProfileId===targetPartId&&row.snap.type==='END_TO_FACE'&&!this.candidateCollision(mesh,row));
    if(!candidate){mesh.userData.lastSnap=null;return null;}
    this.lastSession={sourceId:mesh.userData.part.id,originPosition:mesh.position.clone(),candidates:[candidate],index:0};
    return this.applyCandidate(mesh,0);
  }

  applyCandidate(source,index) {
    const session = this.lastSession;
    if (!session) return null;
    const candidate = session.candidates[index];
    // 切换候选或松手时重新检查；一帧以前的合法候选不能绕过新障碍。
    const collision=this.candidateCollision(source,candidate,session.originPosition);
    if(collision){
      source.userData.lastSnap=null;
      this.editor.sceneManager.clearSnapPreview();
      this.editor.sceneManager.showSnapFeedback?.({status:'blocked',label:'吸附位置不可用',details:[collision.message]});
      return null;
    }
    source.position.copy(session.originPosition).add(candidate.delta);
    source.updateMatrixWorld(true);
    const snap = {
      ...candidate.snap,
      candidateIndex:index + 1,
      candidateCount:session.candidates.length
    };
    source.userData.lastSnap = snap;
    // 已提交时由真实接触面的蓝色反馈说明关系，不再在接头上叠球体和圆环。
    this.editor.sceneManager.showSnapFeedback?.({status:'valid',label:`已贴合 · ${snap.feedbackLabel || snapTypeLabel(snap.type)}`,details:this.feedbackDetails(snap)});
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
    this.blockedCandidate=null;
    return this.collectCandidates(source,maxDistance).sort(compareCandidates).filter(candidate=>{
      const collision=this.candidateCollision(source,candidate);
      if(collision&&!this.blockedCandidate)this.blockedCandidate=collision;
      return !collision;
    });
  }

  /** 候选落位用原干涉分类器预判，包含第三根障碍和整体移动随动件；只读虚拟位置。 */
  candidateCollision(source,candidate,originPosition=source.position){
    const manager=this.editor.interferenceFeedbackManager;
    const moving=source===this.editor.selected?this.editor.currentTransformMeshes?.()||[source]:[source];
    const meshes=moving.includes(source)?[...new Set([...moving,...(source===this.editor.selected&&!this.editor.transformSelectionSnapshot?this.editor.transformFollowersForScope?.(source)||[]:[])])]:[source];
    const movingSet=new Set(meshes);
    const delta=originPosition.clone().add(candidate.delta).sub(source.position);
    const item=(mesh,offset)=>{
      mesh.updateWorldMatrix(true,true);
      const position=mesh.getWorldPosition(new THREE.Vector3()).add(offset);
      const rotation=new THREE.Euler().setFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()),'XYZ');
      const part={...mesh.userData.part,position:{x:position.x,y:position.y,z:position.z},rotation:{x:rotation.x,y:rotation.y,z:rotation.z}};
      return {part,obb:profileObb(part),box:new THREE.Box3().setFromObject(mesh).translate(offset)};
    };
    const zero=new THREE.Vector3();
    const targets=(this.editor.meshes||[]).filter(mesh=>!movingSet.has(mesh)&&mesh.visible!==false&&!mesh.userData?.part?.hidden&&['PROFILE','PANEL','SHAFT','ACCESSORY'].includes(mesh.userData?.part?.type)).map(mesh=>item(mesh,zero));
    for(const mesh of meshes){
      if(!mesh?.userData?.part)continue;
      const a=item(mesh,delta);
      for(const b of targets){
        if(manager?.isIntentionalContact(a.part,b.part))continue;
        const relation=manager?.classify(a,b)||(a.obb&&b.obb?{kind:intersectObb(a.obb,b.obb,Number(this.editor.projectSettings?.collisionToleranceMm??0.5)).intersects?'INTERFERENCE':'SEPARATE'}:{kind:'SEPARATE'});
        if(relation.kind==='INTERFERENCE')return {message:`${a.part.displayId||a.part.name||'构件'} 与 ${b.part.displayId||b.part.name||'目标'} 干涉${relation.penetrationMm?` ${Number(relation.penetrationMm.toFixed(2))} mm`:''}`,partIds:[a.part.id,b.part.id]};
      }
    }
    return null;
  }

  preferredCandidate(candidates) {
    const best=candidates[0]||null;
    const locked=candidates.find(item=>item.key===this.previewLockKey);
    // 小抖动保留同一特征；用户明显朝更近的面移动时允许切换，不能永远锁住旧槽。
    return locked&&(!best||locked.score<=best.score+2)?locked:best;
  }

  /** 预览和提交共用捕获/释放范围；新候选不得借锁定扩大捕获半径。 */
  previewCandidates(mesh){
    const candidates=this.sortedCandidates(mesh,this.distance);
    if(!this.previewLockKey)return candidates;
    const locked=this.sortedCandidates(mesh,this.releaseDistance).find(item=>item.key===this.previewLockKey);
    if(locked&&!candidates.some(item=>item.key===locked.key))candidates.push(locked);
    return candidates.sort(compareCandidates);
  }

  /** 约束求解后再次确认三维接头，不把松手前的绿色提示沿用到已经被移动的位置。 */
  isSnapSatisfied(mesh,snap){
    if(!mesh||!snap)return false;
    return this.collectCandidates(mesh,0.1).some(candidate=>sameFeature(candidate.snap,snap)&&candidate.delta.length()<=0.1);
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
          // 源端朝外的法向必须与目标面相对；绝对值会把伸入目标内部的反面当成可贴合。
          const alignment = -axis.dot(this.faceNormal(target,item.face));
          if (alignment < 0.999999) continue;
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
        // 按整个端面在目标坐标中的投影范围落位，不只把中心点塞进侧面边界。
        const half=this.endpointHalfSpans(source,target);
        const aligned=(value,extent,span)=>{
          const limit=Math.abs(extent-span);
          const fitted=clamp(value,-limit,limit);
          if(maxDistance>0.1&&Math.abs(Math.abs(fitted)-limit)<=this.surfaceAlignDistance)return fitted<0?-limit:limit;
          return fitted;
        };
        const points = [
          {face:'FRONT',point:new THREE.Vector3(aligned(local.x,width/2,half.x),height/2,aligned(local.z,length/2,half.z))},
          {face:'BACK',point:new THREE.Vector3(aligned(local.x,width/2,half.x),-height/2,aligned(local.z,length/2,half.z))},
          {face:'RIGHT',point:new THREE.Vector3(width/2,aligned(local.y,height/2,half.y),aligned(local.z,length/2,half.z))},
          {face:'LEFT',point:new THREE.Vector3(-width/2,aligned(local.y,height/2,half.y),aligned(local.z,length/2,half.z))}
        ];
        for (const item of points) {
          const worldPoint = target.localToWorld(item.point.clone());
          const distance = sourcePoint.distanceTo(worldPoint);
          if (distance > maxDistance) continue;
          const alignment = -axis.dot(this.faceNormal(target,item.face));
          if (alignment < 0.999999) continue;
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
          const sourceEnd=sourceName==='start'?'START':'END';
          const targetEnd=targetName==='start'?'START':'END';
          if(-this.sourceAxis(source,sourceEnd).dot(this.sourceAxis(target,targetEnd))<0.999999)continue;
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
    if(snap.preview){
      const corrections=Object.entries(snap.offsetMm||{}).filter(([,value])=>Math.abs(value)>=0.005).map(([axis,value])=>`${axis.toUpperCase()} ${value>0?'+':''}${Number(value.toFixed(2))} mm`);
      items.push(corrections.length?`将移动 ${corrections.join(' / ')}`:'当前位置已贴面');
    }else items.push('接头间隙 0 mm');
    return items;
  }

  candidate(sourcePoint,targetPoint,priority,score,snap) {
    const delta=targetPoint.clone().sub(sourcePoint);
    return {priority,score,snap:{...snap,offsetMm:{x:delta.x,y:delta.y,z:delta.z}},sourcePoint:sourcePoint.clone(),targetPoint:targetPoint.clone(),delta};
  }

  /** 截面两轴投到目标坐标中，得到端面在三个方向的半跨度；与相机/屏幕投影无关。 */
  endpointHalfSpans(source,target){
    const [width,height]=source.userData.part.dimensions.sectionSize;
    const inverse=target.getWorldQuaternion(new THREE.Quaternion()).invert();
    const quaternion=source.getWorldQuaternion(new THREE.Quaternion());
    const x=new THREE.Vector3(1,0,0).applyQuaternion(quaternion).applyQuaternion(inverse);
    const y=new THREE.Vector3(0,1,0).applyQuaternion(quaternion).applyQuaternion(inverse);
    return new THREE.Vector3(...['x','y','z'].map(axis=>Math.abs(x[axis])*width/2+Math.abs(y[axis])*height/2));
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
  // 锁定的是同一面/槽，不是不断改变的轴向站位；沿着侧面拖动不能每 0.1 mm 丢锁。
  return [snap.type,snap.targetProfileId,snap.sourceEnd,snap.targetFace || snap.targetEnd || '',snap.slotIndex ?? ''].join('|');
}

function sameFeature(a,b){return a.type===b.type&&a.targetProfileId===b.targetProfileId&&a.sourceEnd===b.sourceEnd&&a.targetFace===b.targetFace&&a.targetEnd===b.targetEnd&&a.slotIndex===b.slotIndex;}
function compareCandidates(a,b){return Math.abs(a.score-b.score)<1e-6?a.priority-b.priority:a.score-b.score;}

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
