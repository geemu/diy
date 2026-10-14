import * as THREE from 'three';
import SnapManager from '../snap/SnapManager.js';
import {isLinearProfile} from '../model/ProfilePath.js';
import {profileSeries,isProfileFaceClosed} from '../model/DesignProfileCatalog.js';
import {profileFeatureWorldPoint,resolveProfileSurfaceFeature} from '../model/ProfileFeatureCatalog.js';
import {ConnectionComponentOptions,connectionSpecs,connectionComponent,connectionDesignType} from '../model/ComponentCatalog.js';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import {profileObb} from '../validation/PartCollisionDetector.js';
import {connectorGhost,connectorEnvelope,envelopesOverlap} from './ConnectionPlacementManager.js';
import {connectionSupportPlanes,automaticConnectionChoice,emptyEndSlotChoice,isExpectedConnectionSkip} from './ConnectionAutoPolicy.js';
import {profileEndContact} from '../model/ProfileEndContact.js';
import {designAnchorKey} from '../model/ConnectionAnchor.js';
import {slotWorldNormal} from '../model/SlotMatcher.js';
import {sideMountJoints,sideMountContexts,sideMountKey,hiddenSideMountReason} from './SideMountConnection.js';
import {sideSlotContexts,sideSlotKey} from './SideSlotConnection.js';
import {flatConnectionPlateLayout} from '../model/ConnectionComponentPorts.js';

// 目录与已有安装映射共用，不用 UI 再维护一个只有三项的清单。
export const BatchConnectionComponentOptions=ConnectionComponentOptions.filter(option=>connectionSpecs(option.value).some(spec=>!spec.disabled&&connectionDesignType(connectionComponent({type:option.value,spec:spec.value}))));
// 结果分类只说明本次扫描的安装状态，不作装配/承载认证，也不写入工程。
export const ConnectionReportCategories=[
  {id:'UNINSTALLED',label:'完全未安装',shortLabel:'完全未安装',description:'本次扫描识别到、尚未安装连接件的接头，包含尚未贴合和所选类型未适配的位置。'},
  {id:'PARTIAL',label:'已安装但另一侧未适配',shortLabel:'另一侧未适配',description:'这些接头已有连接件，只是另一安装侧未能补件，不等于整个接头未安装。'},
  {id:'INVALID',label:'已有连接失效',shortLabel:'已有连接失效',description:'已有连接记录失效，需要定位检查；本次保留原件，没有自动替换。'}
];
const autoTypes=['ANGLE_BRACKET','CORNER_CUBE','HIDDEN_CORNER'];
const oppositeFace={FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'};

/** 按结构化失败类型聚合；端距/编号留在详情，不用变化的错误文字拆出重复分组。 */
export function connectionFailureGroup(code='INSTALLATION_INVALID'){
  if(code==='SUPPORT_PLANE_UNKNOWN')return {id:'SUPPORT_PLANE_UNKNOWN',label:'承托面无法确认'};
  if(/SUPPORT_PLANE/.test(code))return {id:'SUPPORT_PLANE',label:'承托面被凸出的连接件占用 / 无法确认'};
  if(/FOOTPRINT|END_OUT_OF_RANGE/.test(code))return {id:'END_SUPPORT',label:'端部长度 / 安装支撑面不足'};
  if(/AXIS|DIRECTION|ORIENTATION/.test(code))return {id:'SLOT_DIRECTION',label:'槽向 / 安装方向不满足'};
  if(/CAVITY_INTERFERENCE|SECTION_OUT_OF_BOUNDS/.test(code))return {id:'SLOT_CAVITY',label:'槽腔不能容纳连接件轮廓'};
  if(/PORT_NOT_ALIGNED|SLOT_NOT_ALIGNED|SLOT_MISMATCH|ANCHOR_INVALID/.test(code))return {id:'HOLE_SLOT',label:'孔位 / 槽位未匹配'};
  if(/OCCUPIED|HOST_INTERFERENCE/.test(code))return {id:'INSTALLATION_SPACE',label:'安装空间被构件或其他连接件占用'};
  if(code==='JOINT_NOT_CONTACT')return {id:'NOT_CONTACT',label:'型材尚未贴合'};
  if(/LOCKED|PROTECTED/.test(code))return {id:'PROTECTED',label:'构件锁定 / 已配置制造方案'};
  if(/EXISTING_|DANGLING/.test(code))return {id:'EXISTING_INVALID',label:'已有连接记录失效 / 缺少安装实体'};
  if(/UNSUPPORTED|NOT_SUPPORTED|MISMATCH|UNKNOWN|MISSING|REFERENCE_REQUIRED/.test(code))return {id:'UNSUPPORTED',label:'当前型号 / 接法尚无适配安装规则'};
  return {id:'OTHER',label:'其他安装条件不满足'};
}

/** 只读接头扫描 -> 共用目录几何预览 -> 一次提交；每个设计组件独立保存，不是假制造认证。 */
export default class ConnectionBatchManager {
  constructor(editor){this.editor=editor;this.active=false;this.busy=false;this.rows=[];this.previewGroup=null;this.previewMeshes=new Map();this.diagnosticGroup=null;this.onChanged=null;this.runRevision=0;}
  isActive(){return this.active;}
  begin(options={}, {interactive=false,scanImmediately=true}={}){
    this.cancel();this.active=true;this.options={type:'AUTO',spec:'AUTO',sides:'BOTH',supplement:true,profileIds:null,...options};this.excludedIds=new Set();
    this.interactive=interactive;
    const s=this.editor.sceneManager;s.transformControls.detach();s.transformControls.enabled=false;this.editor.profileGripEditor.refresh(true);
    return scanImmediately?this.scan():this.emit();
  }
  scan(options={}){
    if(!this.active)return null;
    this.options={...this.options,...options};this.excludedIds.clear();this.rows=[];this.profileCount=0;this.freeEndCount=0;
    this.definitionCache=new Map();this.evaluationCache={componentBounds:new Map(),bodyEnvelopes:new Map()};this.existingEnvelopes=null;
    return this.run(this.scanSteps());
  }
  *scanSteps(){
    this.clearPreview();
    const e=this.editor,allowed=this.options.profileIds?new Set(this.options.profileIds):null;
    const profiles=e.meshes.filter(mesh=>mesh.visible!==false&&!mesh.userData.part.hidden&&mesh.userData.part.type==='PROFILE'&&isLinearProfile(mesh.userData.part)&&(!allowed||allowed.has(mesh.userData.part.id)));
    if(profiles.length<2)throw new Error('扫描范围内至少需要两根可见直线型材');
    this.signature=JSON.stringify(e.exportProject());this.profileCount=profiles.length;this.rows=[];
    // 移动工具会排除所选对象；扫描使用独立只读作用域，不移动任何型材。
    const snap=new SnapManager({meshes:profiles}),byJoint=new Map(),cache=new Map(),touchingEnds=new Set(),byId=new Map(profiles.map(mesh=>[mesh.userData.part.id,mesh])),bounds=new Map(),oldJoints=new Map();
    for(const old of e.connectionManager.connections)if(!['SIDE_CORNER','SIDE_MOUNT','SIDE_SLOT'].includes(old.jointKind)){
      const key=jointKey(old.sourceProfileId,old.targetProfileId,old.sourceEnd,old.targetFace);if(!oldJoints.has(key))oldJoints.set(key,old);
    }
    for(let index=0;index<e.meshes.length;index++){
      const mesh=e.meshes[index];this.progressStep('正在准备扫描',5*index/e.meshes.length,index,e.meshes.length);
      const part=mesh.userData?.part;
      if(part&&!part.hidden&&mesh.visible!==false)this.evaluationCache.bodyEnvelopes.set(mesh,profileObb(part)||connectorEnvelope(mesh));
      yield;
    }
    for(let index=0;index<profiles.length;index++){
      const mesh=profiles[index];this.progressStep('正在准备扫描',5+5*index/profiles.length,index,profiles.length);
      mesh.updateMatrixWorld(true);const [w,h]=mesh.userData.part.dimensions.sectionSize,l=mesh.userData.part.dimensions.length;
      bounds.set(mesh,new THREE.Box3(new THREE.Vector3(-w/2,-h/2,-l/2),new THREE.Vector3(w/2,h/2,l/2)).applyMatrix4(mesh.matrixWorld));yield;
    }
    this.existingEnvelopes=yield* this.reservedEnvelopeSteps();
    for(let index=0;index<profiles.length;index++){
      const source=profiles[index],ends=Object.values(snap.endpoints(source)),size=source.userData.part.dimensions.sectionSize;
      // 包络只做保守邻域筛选；真实面、孔槽和足迹仍交给原安装规则。
      const reach=snap.distance+(size[0]+size[1])/2*source.matrixWorld.getMaxScaleOnAxis();
      snap.editor.meshes=profiles.filter(target=>target===source||ends.some(point=>bounds.get(target).distanceToPoint(point)<=reach));
      this.progressStep('正在识别端面接头',10+35*index/profiles.length,index,profiles.length);yield;
      const candidates=snap.collectCandidates(source);
      // 扫描是补件而不是移动吸附：实际端面已经接触时，不因吸附候选还想横移到整体中心而漏掉多槽搭接。
      for(const end of ['START','END'])for(const target of snap.editor.meshes){
        if(source===target)continue;
        const feature={type:'PROFILE_END',end},point=profileFeatureWorldPoint(source,feature);
        const context=e.connectionPlacementManager.resolveJointContact({mesh:source,feature,point},target);
        if(!context)continue;
        const contact=profileEndContact(source,target,{sourceEnd:end,targetFace:context.target.feature.face,requireFootprint:false});
        if(contact.ok)candidates.push({delta:new THREE.Vector3(),targetPoint:context.target.point,score:0,snap:{type:'END_TO_FACE',sourceEnd:end,targetFace:context.target.feature.face,targetProfileId:target.userData.part.id}});
        yield;
      }
      for(const candidate of candidates){
        if(!candidate.snap.targetFace)continue;
        const target=byId.get(candidate.snap.targetProfileId);if(!target)continue;
        const touch=candidate.delta.length()<=.10001;
        // 先排除越界的邻域候选，再生成目录几何，避免密集框架为无关位置重复造预览。
        if(!touch&&!insideTargetFace(source,target,candidate.snap))continue;
        const directKey=jointKey(source.userData.part.id,target.userData.part.id,candidate.snap.sourceEnd,candidate.snap.targetFace);
        const old=oldJoints.get(directKey);
        if(touch&&!cache.has(directKey))cache.set(directKey,!old?.manufacturingRuleId&&old?.status!=='INVALID'&&old?.validation?.ok!==false?(yield* this.solutionSteps(source,target,candidate.snap)):[]);
        const solutions=cache.get(directKey)||[],checked=solutions.find(solution=>solution.checked?.valid)?.checked||solutions[0]?.checked;
        if(touch)touchingEnds.add(source.userData.part.id+'|'+candidate.snap.sourceEnd);
        const proposal={source,target,candidate,solutions,checked,old,touch,gap:Number(checked?.item?.geometry?.contactGapMm??candidate.delta.length()),
          key:directKey,
          matchesOld:!!old&&old.sourceProfileId===source.userData.part.id&&old.sourceEnd===candidate.snap.sourceEnd&&old.targetFace===candidate.snap.targetFace,
          interior:e.autoConnectionResolver.targetInteriorDistance(target,candidate.targetPoint)};
        const previous=byJoint.get(proposal.key);if(!previous||compare(proposal,previous)<0)byJoint.set(proposal.key,proposal);
        yield;
      }
    }
    const corners=yield* this.sideCornerSteps(profiles),sides=yield* this.sideMountSteps(profiles),sideSlots=yield* this.sideSlotSteps(profiles),cornerPairs=new Set(corners.map(row=>pairKey(row.source,row.target)));
    this.freeEndCount=profiles.length*2-touchingEnds.size;
    // 侧面内角真实贴合时，不再同时给同一对梁报端中心的虚假间距；已有普通关系仍保留审阅。
    const proposals=[...byJoint.values()].filter(row=>!(row.checked?.item?.geometry?.jointKind==='SIDE_CORNER'&&cornerPairs.has(pairKey(row.source,row.target)))&&(row.touch||row.old||!cornerPairs.has(pairKey(row.source,row.target))));
    this.rows=[...proposals,...corners,...sides,...sideSlots].sort(compare).map(proposal=>({...proposal,id:proposal.key,sourceLabel:label(proposal.source),targetLabel:label(proposal.target),end:proposal.candidate.snap.sourceEnd,face:proposal.candidate.snap.targetFace}));
    // 失效旧关系和本次所选类型未覆盖的已有内角仍报告，不能从审阅中消失或被误当缺件。
    for(const old of e.connectionManager.connections) {
      if((old.status!=='INVALID'&&!['SIDE_CORNER','SIDE_MOUNT','SIDE_SLOT'].includes(old.jointKind))||this.rows.some(row=>row.old?.id===old.id))continue;
      const source=byId.get(old.sourceProfileId),target=byId.get(old.targetProfileId);if(!source||!target)continue;
      const gap=Number(old.validation?.contactGapMm??Infinity),touch=old.status!=='INVALID'&&old.validation?.ok===true&&gap<=.1;
      const candidate={delta:new THREE.Vector3(Number.isFinite(gap)?gap:0,0,0),snap:{sourceEnd:old.sourceEnd,targetFace:old.targetFace,jointKind:old.jointKind,sideMount:old.sideMount,sideSlot:old.sideSlot}};
      this.rows.push({id:old.id,source,target,old,touch,gap,candidate,jointKind:old.jointKind,matchesOld:true,solutions:[],sourceLabel:label(source),targetLabel:label(target),end:old.sourceEnd,face:old.targetFace});
      yield;
    }
    yield* this.planSteps();
  }
  /** 两根梁的端中心可在对方端边外；按共用侧面角点扫描，不能把它混成未贴合的端面候选。 */
  sideCornerProposals(profiles){
    return drain(this.sideCornerSteps(profiles));
  }
  *sideCornerSteps(profiles){
    const e=this.editor,placement=e.connectionPlacementManager,byCorner=new Map(),existingCorners=new Map(),byId=new Map(profiles.map(mesh=>[mesh.userData.part.id,mesh]));
    for(const old of e.connectionManager.connections.filter(row=>row.jointKind==='SIDE_CORNER')){
      yield;
      const source=byId.get(old.sourceProfileId),target=byId.get(old.targetProfileId);if(!source||!target)continue;
      const point=profileFeatureWorldPoint(source,{type:'PROFILE_END',end:old.sourceEnd});
      for(const face of old.designComponentMountFaces?.length?old.designComponentMountFaces:[old.designComponentMountFace||old.sourceMountFace]){
        const contact=placement.resolveJointContact({mesh:source,point,feature:{type:'PROFILE_END',end:old.sourceEnd}},target,face);
        if(contact)existingCorners.set(sideCornerKey(source,target,contact.contactPoint),old);
      }
    }
    for(let index=0;index<profiles.length;index++){
      const source=profiles[index];this.progressStep('正在识别两梁内角',45+30*index/profiles.length,index,profiles.length);yield;
      const definitions=this.componentDefinitions(source).filter(item=>['ANGLE_BRACKET','INTERNAL_CONNECTOR'].includes(connectionDesignType(item)));if(!definitions.length)continue;
      const faces=['FRONT','BACK','LEFT','RIGHT'].filter(face=>!isProfileFaceClosed(source.userData.part,face));
      for(const end of ['START','END']){
        const feature={type:'PROFILE_END',end},point=profileFeatureWorldPoint(source,feature),anchor={mesh:source,feature,point};
        for(const target of profiles){
          yield;
          if(source===target)continue;
          // 只排除不可能触及端边的远处目标；是否为侧面内角仍以共用安装几何的 jointKind 为准。
          target.updateMatrixWorld(true);const local=target.worldToLocal(point.clone()),part=target.userData.part;
          const reach=Math.max(...source.userData.part.dimensions.sectionSize)/2+12.01;
          if(Math.abs(local.z)<=part.dimensions.length/2+.01||Math.abs(local.z)>part.dimensions.length/2+reach||Math.abs(local.x)>part.dimensions.sectionSize[0]/2+reach||Math.abs(local.y)>part.dimensions.sectionSize[1]/2+reach)continue;
          for(const mountFace of faces){
            const context=placement.resolveJointContact(anchor,target,mountFace);if(!context)continue;
            const snap={type:'PROFILE_FACE',sourceEnd:end,targetProfileId:target.userData.part.id,targetFace:context.target.feature.face,sourceMountFace:mountFace,jointKind:'SIDE_CORNER'};
            const key=sideCornerKey(source,target,context.contactPoint);
            const old=e.connectionManager.connections.find(row=>sameDirection(row,source,target,snap))||existingCorners.get(key);
            const retained=preserveConnection(old)?e.connectionManager.recommendDesignFor(source,target,{sourceEnd:end,targetFace:snap.targetFace,sourceMountFace:mountFace,designAnchorOffset:old.designAnchorOffset,componentDefinition:old.designComponent}).find(item=>item.geometry?.jointKind==='SIDE_CORNER'):null;
            const solutions=old?.manufacturingRuleId||old?.status==='INVALID'||old?.validation?.ok===false?(retained?[{checked:{item:retained,valid:retained.valid}}]:[]):(yield* this.solutionSteps(source,target,snap,definitions)).filter(item=>item.checked?.item.geometry?.jointKind==='SIDE_CORNER');if(!solutions.length)continue;
            const checked=solutions.find(item=>item.checked.valid)?.checked||solutions[0].checked;
            const gap=Number(checked.item.geometry.contactGapMm);
            const proposal={source,target,candidate:{snap,delta:new THREE.Vector3(gap,0,0),targetPoint:context.target.point,score:0},solutions,checked,old,
              touch:gap<=.1,gap,key,jointKind:'SIDE_CORNER',
              matchesOld:!!old&&sameDirection(old,source,target,snap),interior:e.autoConnectionResolver.targetInteriorDistance(target,context.target.point)};
            const previous=byCorner.get(key);if(!previous||compare(proposal,previous)<0)byCorner.set(key,proposal);
          }
        }
      }
    }
    return [...byCorner.values()];
  }
  /** 沿柱面的水平梁独立扫描侧贴面；一处物理接触按安装侧占位，不抢占原梁端 / 两梁内角。 */
  *sideMountSteps(profiles){
    const result=[],manager=this.editor.connectionManager;
    for(let index=0;index<profiles.length;index++){
      const source=profiles[index];this.progressStep('正在识别梁侧贴柱',65+10*index/profiles.length,index,profiles.length);yield;
      const definitions=this.componentDefinitions(source).filter(definition=>['ANGLE_BRACKET','CORNER_CUBE','L_BRACKET','HIDDEN_CORNER'].includes(definition.dimensions.geometryKind));
      if(!definitions.length)continue;
      for(const target of profiles){
        yield;
        for(const contact of sideMountJoints(source,target)){
          const sideMount=contact.sideMount;
          const snap={type:'PROFILE_FACE',sourceEnd:contact.sourceStationS<source.userData.part.dimensions.length/2?'START':'END',targetProfileId:target.userData.part.id,targetFace:contact.targetFace,jointKind:'SIDE_MOUNT',sideMount};
          const old=manager.connectionsAtJoint(source.userData.part.id,target.userData.part.id,snap.sourceEnd,snap.targetFace,undefined,snap)[0];
          const solutions=old?.manufacturingRuleId||old?.status==='INVALID'||old?.validation?.ok===false?[]:(yield* this.solutionSteps(source,target,snap,definitions));
          const checked=solutions.find(solution=>solution.checked?.valid)?.checked||solutions[0]?.checked;
          result.push({source,target,candidate:{snap,delta:new THREE.Vector3(),score:0},solutions,checked,old,touch:true,gap:0,
            key:sideMountKey(source.userData.part.id,target.userData.part.id,contact.targetFace,sideMount),jointKind:'SIDE_MOUNT',matchesOld:!!old,interior:contact.maximum-contact.minimum});
          yield;
        }
      }
    }
    return result;
  }
  /** 共面梁 / 柱外侧槽用实际两孔板，独立于旧端面和梁下角码；不以平板兜底直角面。 */
  *sideSlotSteps(profiles){
    const rows=new Map(),manager=this.editor.connectionManager,placement=this.editor.connectionPlacementManager;
    for(let index=0;index<profiles.length;index++){
      const source=profiles[index];this.progressStep('正在识别共面侧槽',73+2*index/profiles.length,index,profiles.length);yield;
      const definitions=this.sideSlotDefinitions(source);if(!definitions.length)continue;
      for(const target of profiles){
        yield;
        for(const definition of definitions)for(const context of sideSlotContexts(source,target,definition)){
          const snap={type:'PROFILE_FACE',sourceEnd:context.source.feature.end,targetProfileId:target.userData.part.id,targetFace:context.target.feature.face,jointKind:'SIDE_SLOT',sideSlot:context.sideSlot};
          const key=sideSlotKey(source.userData.part.id,target.userData.part.id,snap.sourceEnd,snap.targetFace,snap.sideSlot);
          let row=rows.get(key);
          if(!row){
            const old=manager.connectionsAtJoint(source.userData.part.id,target.userData.part.id,snap.sourceEnd,snap.targetFace,undefined,snap)[0];
            row={source,target,candidate:{snap,delta:new THREE.Vector3(),score:0},solutions:[],old,touch:true,gap:0,key,jointKind:'SIDE_SLOT',matchesOld:!!old,interior:0};rows.set(key,row);
          }
          if(!row.old?.manufacturingRuleId&&row.old?.status!=='INVALID'&&row.old?.validation?.ok!==false){
            const checked=placement.evaluateCandidate(context,{mode:'CONNECTION_PLATE',componentDefinition:definition,preserveExisting:false,evaluationCache:this.evaluationCache});
            row.solutions.push({definition,checked,mountFace:context.sourceMountFace,sideSlot:context.sideSlot,designAnchorOffset:context.designAnchorOffset,envelope:checked?.valid?checked.envelope:null});
            if(!row.checked||(!row.checked.valid&&checked?.valid))row.checked=checked;
          }
          yield;
        }
      }
    }
    return [...rows.values()];
  }
  sideSlotDefinitions(source){
    // 用户要内收侧梁的外侧角，不把正面共面一字板当自动补件的替代位置；显式选板仍可安装。
    return this.options.type==='AUTO'?[]:this.componentDefinitions(source).filter(definition=>flatConnectionPlateLayout(definition.dimensions));
  }
  componentDefinitions(source){
    const series=Number(profileSeries(source.userData.part)),height=Number(source.userData.part.dimensions.sectionSize[1]);
    const key=[series,height,this.options.type,this.options.spec].join('|');if(this.definitionCache?.has(key))return this.definitionCache.get(key);
    const types=this.options.type==='AUTO'?autoTypes:[this.options.type],result=[];
    for(const type of types){
      const choices=connectionSpecs(type).filter(option=>!option.disabled&&(this.options.type==='AUTO'||this.options.spec==='AUTO'||this.options.spec==null||option.value===this.options.spec))
        .map(option=>connectionComponent({type,spec:option.value})).filter(item=>Number(item.dimensions.size)===series&&connectionDesignType(item));
      choices.sort((a,b)=>Number(b.dimensions.height===height)-Number(a.dimensions.height===height)||a.dimensions.holeCount-b.dimensions.holeCount);
      // 同系列不只有一种角码尺寸；大规格腿宽不足时继续检查较小规格，而非漏掉整个接头。
      result.push(...choices);
    }
    this.definitionCache?.set(key,result);return result;
  }
  solutionsFor(source,target,snap,definitions=this.componentDefinitions(source)){
    return drain(this.solutionSteps(source,target,snap,definitions));
  }
  *solutionSteps(source,target,snap,definitions=this.componentDefinitions(source),requestedFaces=null){
    if(snap.jointKind==='SIDE_SLOT'){
      const result=[];
      for(const definition of definitions)for(const context of sideSlotContexts(source,target,definition,{sourceEnd:snap.sourceEnd,targetFace:snap.targetFace,sideSlot:snap.sideSlot})){
        if(requestedFaces&&!requestedFaces.includes(context.sourceMountFace))continue;
        const checked=this.editor.connectionPlacementManager.evaluateCandidate(context,{mode:'CONNECTION_PLATE',componentDefinition:definition,preserveExisting:false,evaluationCache:this.evaluationCache});
        result.push({definition,checked,mountFace:context.sourceMountFace,sideSlot:context.sideSlot,designAnchorOffset:context.designAnchorOffset,envelope:checked?.valid?checked.envelope:null});yield;
      }
      return result;
    }
    if(snap.jointKind==='SIDE_MOUNT'){
      const result=[];
      for(const definition of definitions){
        if(definition.dimensions.geometryKind==='HIDDEN_CORNER'){
          // 记录真实侧贴接头为什么不支持槽内件，而不是直接滤掉后报“无安装规则”。
          const contactFace=snap.sideMount.sourceContactFace;
          const faces=snap.sideMount.mode==='OUTER_CORNER'?[contactFace]:['FRONT','BACK'].includes(contactFace)?['LEFT','RIGHT']:['FRONT','BACK'];
          for(const mountFace of faces.filter(face=>!requestedFaces||requestedFaces.includes(face))){
            const message=hiddenSideMountReason(source,target,{targetFace:snap.targetFace,sourceMountFace:mountFace,sideMount:snap.sideMount});
            result.push({definition,mountFace,sideMount:snap.sideMount,checked:{valid:false,message,failureCode:'HIDDEN_SIDE_MOUNT_UNSUPPORTED'},envelope:null});yield;
          }
          continue;
        }
        for(const context of sideMountContexts(source,target,definition,{targetFace:snap.targetFace})){
          if(sideMountKey(source.userData.part.id,target.userData.part.id,snap.targetFace,context.sideMount)!==sideMountKey(source.userData.part.id,target.userData.part.id,snap.targetFace,snap.sideMount)||(requestedFaces&&!requestedFaces.includes(context.sourceMountFace)))continue;
          const checked=this.editor.connectionPlacementManager.evaluateCandidate(context,{mode:connectionDesignType(definition),componentDefinition:context.componentDefinition,preserveExisting:false,evaluationCache:this.evaluationCache});
          result.push({definition:context.componentDefinition,checked,mountFace:context.sourceMountFace,sideMount:context.sideMount,designAnchorOffset:context.designAnchorOffset,envelope:checked?.valid?checked.envelope:null});yield;
        }
      }
      return result;
    }
    const result=[],base=this.context(source,target,snap),defaultFace=base?.designCandidates?.find(item=>item.geometry)?.geometry?.sourceMountFace;
    const faces=(requestedFaces||(snap.jointKind==='SIDE_CORNER'?[snap.sourceMountFace]:[...new Set([defaultFace,'FRONT','BACK','LEFT','RIGHT'])])).filter(face=>face&&!isProfileFaceClosed(source.userData.part,face));
    const contexts=new Map(faces.map(face=>[face,this.context(source,target,snap,face,false)]));
    for(const definition of definitions)for(const mountFace of faces){
      const context=contexts.get(mountFace);if(!context)continue;
      for(const anchored of this.editor.connectionPlacementManager.anchorContexts(context,definition)){
        const checked=this.editor.connectionPlacementManager.evaluateCandidate(anchored,{mode:connectionDesignType(definition),componentDefinition:definition,preserveExisting:false,evaluationCache:this.evaluationCache});
        result.push({definition,checked,mountFace,designAnchorOffset:anchored.designAnchorOffset,envelope:checked?.valid?checked.envelope:null});yield;
      }
    }
    return result;
  }
  context(source,target,snap,sourceMountFace=null,recommend=true,designAnchorOffset=undefined){
    const a={mesh:source,feature:{type:'PROFILE_END',end:snap.sourceEnd},point:profileFeatureWorldPoint(source,{type:'PROFILE_END',end:snap.sourceEnd})};
    if(snap.jointKind==='SIDE_CORNER'){
      const context=this.editor.connectionPlacementManager.resolveJointContact(a,target,sourceMountFace||snap.sourceMountFace);
      return context?.target.feature.face===snap.targetFace?{...context,designAnchorOffset}:null;
    }
    const feature={...(resolveProfileSurfaceFeature(target,a.point)||{}),type:'PROFILE_FACE',face:snap.targetFace};
    const b={mesh:target,feature,point:profileFeatureWorldPoint(target,feature)||a.point.clone()};
    if(!recommend)return {source:a,target:b,sourceMountFace,designAnchorOffset};
    const list=[];this.editor.connectionPlacementManager.pushJointCandidate(list,a,b,a.point,{sourceMountFace,designAnchorOffset});return list[0];
  }
  /** 自动模式逐安装侧选型；指定目录类型仍只按原安装守卫，不私自换成推荐型号。 */
  legalChoices(row,solutions){
    const planes=row.supportPlanes??(row.supportPlanes=connectionSupportPlanes(row.source,row.target));
    const existing=this.editor.connectionManager.connectionsAtJoint(row.source.userData.part.id,row.target.userData.part.id,row.end,row.face,undefined,row.candidate.snap);
    const installedSlots=new Set(existing.map(connection=>hiddenSlotPair(connection.designComponent,connection.validation)?.key).filter(Boolean));
    const legal=[];
    for(const solution of solutions){
      const emptyEnd=emptyEndSlotChoice(solution,row.source,row.target);
      if(emptyEnd){solution.policy=emptyEnd;continue;}
      if(!solution.checked?.valid||Number(solution.checked.item.geometry?.contactGapMm)>.1)continue;
      const slots=hiddenSlotPair(solution.definition,solution.checked.item.geometry);
      // 槽内件按真实匹配的两槽去重；不同锚点也不能在同一组槽重复安装。
      if(solution.definition.dimensions.geometryKind==='HIDDEN_CORNER'&&(!slots||installedSlots.has(slots.key)))continue;
      const joint=this.editor.connectionManager.connectionsAtJoint(row.source.userData.part.id,row.target.userData.part.id,row.end,row.face,solution.designAnchorOffset,{jointKind:row.jointKind,sideMount:solution.sideMount,sideSlot:solution.sideSlot});
      if(joint.some(connection=>connection.designComponent&&this.editor.connectionManager.mountFaces(connection).includes(solution.mountFace)))continue;
      const policy=this.options.type==='AUTO'?automaticConnectionChoice(solution,row.source,planes,row.target):{valid:true,score:0};
      solution.policy=policy;if(policy.valid)legal.push(solution);
    }
    return legal.sort((a,b)=>a.policy.score-b.policy.score);
  }
  reservedEnvelopes(){
    return drain(this.reservedEnvelopeSteps());
  }
  *reservedEnvelopeSteps(){
    const e=this.editor,result=[];
    for(const connection of e.connectionManager.connections.filter(row=>row.designComponent&&!row.manufacturingRuleId)){
      const helper=e.connectionManager.helperMeshes.get(connection.id);
      if(helper&&helper.visible!==false)for(const child of helper.children){result.push({envelope:connectorEnvelope(child),label:'已有 '+(connection.manufacturingCode||connection.id)+' 连接件'});yield;}
    }
    return result;
  }
  /** 已有下侧件不代表上槽已装；先找缺失上面，再逐槽检查，不把其余侧面加满。 */
  missingUpperFace(row,existing){
    if(this.options.type!=='AUTO'||this.options.sides==='SINGLE'||singleMountSide(row))return null;
    const faces=new Set(existing.flatMap(connection=>this.editor.connectionManager.mountFaces(connection)));
    const lower=[...faces].find(face=>slotWorldNormal(row.source,face).y<-.99999),upper=lower&&oppositeFace[lower];
    return upper&&!faces.has(upper)&&!isProfileFaceClosed(row.source.userData.part,upper)?upper:null;
  }
  /** 已选 / 已装隐藏件的同一面逐槽补齐；不因总件数或一个面已装就吞掉另一条槽，也不把其他面加满。 */
  selectHiddenSlots(row,legal,selected,existing,reserved,tolerance){
    if(this.options.sides==='SINGLE'||singleMountSide(row)||['SIDE_MOUNT','SIDE_SLOT'].includes(row.jointKind))return selected;
    if(existing.some(connection=>connection.manufacturingRuleId||connection.status==='INVALID'||connection.validation?.ok===false||
      (connection.designComponent&&!this.editor.connectionManager.helperMeshes.get(connection.id)?.children.length)))return selected;
    const faces=new Set(),occupied=new Set(),result=[...selected];
    for(const connection of existing){
      if(connection.designComponent?.dimensions?.geometryKind!=='HIDDEN_CORNER')continue;
      for(const face of this.editor.connectionManager.mountFaces(connection))faces.add(face);
      const slots=hiddenSlotPair(connection.designComponent,connection.validation);if(slots)occupied.add(slots.key);
    }
    for(const solution of selected){
      const slots=hiddenSlotPair(solution.definition,solution.checked.item.geometry);
      if(slots){faces.add(solution.mountFace);occupied.add(slots.key);}
    }
    for(const solution of legal){
      const slots=hiddenSlotPair(solution.definition,solution.checked.item.geometry);
      if(!slots||!faces.has(solution.mountFace)||occupied.has(slots.key))continue;
      if(this.options.type!=='AUTO'&&selected.length&&solution.definition.id!==selected[0].definition.id)continue;
      if(reserved.some(other=>envelopesOverlap(solution.envelope,other.envelope,tolerance))||result.some(other=>envelopesOverlap(solution.envelope,other.envelope,tolerance)))continue;
      result.push(solution);occupied.add(slots.key);
    }
    return result;
  }
  /** 保留具体类型、候选姿态和原因副本；只有确有安装姿态才允许展示红色候选，不新建连接。 */
  unavailableSideReasons(row,reserved,tolerance,{faces=null,excludedFaces=[]}={}){
    const relevant=row.solutions.filter(solution=>!excludedFaces.includes(solution.mountFace)&&(!faces||faces.includes(solution.mountFace)));
    // 端齐平朝外零槽长适用于批量选型；承托面留平仍只用于AUTO。正槽长不足或其他真实失败不吞掉。
    const expectedSkip=solution=>{
      const emptyEnd=emptyEndSlotChoice(solution,row.source,row.target);if(emptyEnd)solution.policy=emptyEnd;
      return solution.policy?.expectedSkip===true&&(solution.policy.code==='SLOT_END_NO_AVAILABLE_LENGTH'||this.options.type==='AUTO'&&solution.policy.code==='SUPPORT_PLANE_OBSTRUCTED');
    };
    const candidates=relevant.filter(solution=>!expectedSkip(solution));
    row.policySkippedOnly=relevant.length>0&&candidates.length===0;
    const preferHidden=faces?.some(face=>slotWorldNormal(row.source,face).y>.99999);
    const priority=solution=>solution.checked?.valid?0:solution.checked?.transform?1:2;
    const preferred=solution=>solution.definition?.dimensions?.geometryKind===(preferHidden?'HIDDEN_CORNER':row.jointKind==='SIDE_MOUNT'?'ANGLE_BRACKET':'HIDDEN_CORNER');
    candidates.sort((a,b)=>priority(a)-priority(b)||Number(preferred(b))-Number(preferred(a)));
    const failures=[],keys=new Set();
    for(const solution of candidates){
      const geometry=solution.checked?.item?.geometry;
      const hiddenError=geometry?.componentPorts?.errors?.find(error=>error.code?.startsWith('HIDDEN_COMPONENT_'));
      let code=hiddenError?.code||solution.policy?.code||solution.checked?.failureCode||'INSTALLATION_INVALID';
      let reason=hiddenError?.message||solution.policy?.message||solution.checked?.message;
      if(solution.checked?.valid){
        if(solution.policy?.valid!==false){
          const occupied=reserved.find(other=>envelopesOverlap(solution.envelope,other.envelope,tolerance));
          if(!occupied)continue;
          code='INSTALLATION_SPACE_OCCUPIED';reason='安装空间与 '+occupied.label+' 重叠，不能补件';
        }
      }
      if(reason){
        const label=solution.definition?.dimensions?.geometryKind==='HIDDEN_CORNER'?'内置角槽件':solution.definition?.label||'连接件';
        const normal=solution.mountFace&&slotWorldNormal(row.source,solution.mountFace);
        const side=normal?.y>.99999?'上侧':normal?.y<-.99999?'下侧':faceLabel(solution.mountFace);
        const message=side+' '+label+'：'+reason;
        const key=[solution.definition?.dimensions?.geometryKind,solution.mountFace,code].join('|');
        if(!keys.has(key)){keys.add(key);failures.push({code,message:humanMessage(message),componentLabel:label,mountFace:solution.mountFace,preview:diagnosticPreview(solution)});}
      }
      if(failures.length>=3)break;
    }
    row.failureDetails=failures.length?failures:row.policySkippedOnly?[]:[{code:'INSTALLATION_RULE_UNSUPPORTED',message:'所选类型没有适配该空闲安装侧的候选；不会替换已有件或强行生成',preview:null}];
    return row.failureDetails.map(failure=>failure.message);
  }
  plan(){return this.active&&!this.busy?this.run(this.planSteps(),'正在更新预览'):null;}
  *planSteps(){
    if(this.signature!==JSON.stringify(this.editor.exportProject()))throw new Error('工程已变化，请重新扫描连接件');
    const e=this.editor,reserved=[...(this.existingEnvelopes||this.reservedEnvelopes())],tolerance=Number(e.projectSettings.collisionToleranceMm??.5);
    for(let index=0;index<this.rows.length;index++){
      const row=this.rows[index];this.progressStep('正在检查安装空间',75+15*index/this.rows.length,index,this.rows.length);yield;
      const {source,target,old}=row;row.status='SKIPPED';row.preserved=false;row.placements=[];row.enabled=false;
      row.supplement=false;row.blockedSideCount=0;row.sideFailures=[];row.failureDetails=[];row.policySkippedOnly=false;
      if(old&&(old.status==='INVALID'||old.validation?.ok===false||(old.designComponent&&!old.manufacturingRuleId&&!e.connectionManager.helperMeshes.get(old.id)?.children.length))){row.status='INVALID_EXISTING';row.message='已有连接已失效：'+(old.validation?.errors?.[0]?.message||'连接件缺少有效安装实体')+'；请定位检查，原记录保留';}
      else if(!row.touch){row.status='NEEDS_ALIGNMENT';row.message='附近但尚未贴合：间距 '+round(row.candidate.delta.length())+' mm，请先吸附型材';}
      else if(old?.designComponent&&!old.manufacturingRuleId){
        row.preserved=true;row.message='已有有效设计连接件，保持不变';
        const existing=e.connectionManager.connectionsAtJoint(source.userData.part.id,target.userData.part.id,row.end,row.face,undefined,row.candidate.snap).filter(connection=>connection.designComponent);
        const missingUpper=this.missingUpperFace(row,existing);
        // 保留手工件也能补独立的空闲侧；不修改原件的型号、编号、安装面或人工状态。
        if(!singleMountSide(row)&&this.options.supplement!==false&&this.options.sides!=='SINGLE'&&row.matchesOld&&e.isMeshTransformable(source)&&e.isMeshTransformable(target)){
          const legal=this.legalChoices(row,row.solutions),available=item=>!reserved.some(other=>envelopesOverlap(item.envelope,other.envelope,tolerance));
          const upper=missingUpper&&legal.find(item=>item.mountFace===missingUpper&&item.definition.dimensions.geometryKind==='HIDDEN_CORNER'&&available(item));
          const choice=upper||(existing.length<2?legal.find(available):null);
          const selected=this.selectHiddenSlots(row,legal,choice?[choice]:[],existing,reserved,tolerance);
          if(selected.length){
            row.status='READY';row.supplement=true;
            for(const solution of selected){
              const id=row.id+'|'+solution.mountFace+'|'+designAnchorKey(solution.designAnchorOffset),enabled=!this.excludedIds.has(id);
              row.placements.push({...solution,id,enabled});
              if(enabled)reserved.push({envelope:solution.envelope,label:row.sourceLabel+' → '+row.targetLabel+' 补空闲安装位'});
            }
            row.enabled=row.placements.some(item=>item.enabled);
          }else if(existing.length<2||missingUpper){
            const occupiedFaces=existing.flatMap(connection=>e.connectionManager.mountFaces(connection));
            const oppositeFaces=[...new Set(occupiedFaces.map(face=>oppositeFace[face]).filter(face=>face&&!occupiedFaces.includes(face)))];
            // 端齐平朝外侧无需补件时，只审阅真正待补的相反侧，不把其他无关槽向当替代失败。
            const emptyEnd=oppositeFaces.some(face=>row.solutions.some(solution=>solution.mountFace===face&&emptyEndSlotChoice(solution,source,target)));
            row.sideFailures=this.unavailableSideReasons(row,reserved,tolerance,{faces:missingUpper?[missingUpper]:emptyEnd?oppositeFaces:null,excludedFaces:occupiedFaces});
            row.blockedSideCount=row.sideFailures.length?1:0;
            if(row.sideFailures.length)row.message+='；'+row.sideFailures.join('；');
          }
        }
      }
      else if(old?.manufacturingRuleId){row.preserved=true;row.message='已配置制造方案，保持原五金与加工';}
      else if(old&&(!old.autoGenerated||old.userOverridden)){row.preserved=true;row.message='手工或已修改连接，保持不变';}
      else if(old&&row.jointKind==='SIDE_CORNER'&&old.jointKind!=='SIDE_CORNER'){row.preserved=true;row.message='这个位置已有端面连接，保留原关系，请在连接页检查';}
      else if(old&&!row.matchesOld)row.message='原连接位置与当前接头不符，请先在连接页处理';
      else if(!row.solutions.length)row.message='所选类型 / 规格没有适配当前系列的自动安装规则，请换规格或手动添加';
      else if(!e.isMeshTransformable(source)||!e.isMeshTransformable(target))row.message='接头包含锁定构件，先解锁再生成';
      else{
        const legal=this.legalChoices(row,row.solutions);
        const first=legal.find(item=>!reserved.some(other=>envelopesOverlap(item.envelope,other.envelope,tolerance)));
        if(!first){
          const blocked=legal[0]&&reserved.find(other=>envelopesOverlap(legal[0].envelope,other.envelope,tolerance));
          const reasons=this.unavailableSideReasons(row,reserved,tolerance);
          row.message=blocked?'连接件安装包络与 '+blocked.label+' 重叠，请改用其他连接方式':reasons.join('；')||(row.policySkippedOnly?'该接头尚未安装连接件；无需安装的端部方向 / 承托面候选已按规则跳过，请选择其他允许的连接方式':'当前位置没有合法安装面，请调整接头或连接件');
        }else{
          // 外置件仍走原相反侧选型；隐藏件再按已选安装面的各组真实槽位补齐。
          const paired=!singleMountSide(row)&&this.options.sides!=='SINGLE'&&(this.options.type==='AUTO'||first.checked.item.type==='ANGLE_BRACKET');
          const alternatives=paired?legal.filter(item=>(this.options.type==='AUTO'||item.definition.id===first.definition.id)&&item.mountFace!==first.mountFace&&!reserved.some(other=>envelopesOverlap(item.envelope,other.envelope,tolerance))&&!envelopesOverlap(item.envelope,first.envelope,tolerance)):[];
          const second=alternatives.find(item=>item.mountFace===oppositeFace[first.mountFace])||alternatives[0]||null;
          if(paired&&!second){
            row.sideFailures=this.unavailableSideReasons(row,[...reserved,{envelope:first.envelope,label:'本次另一侧连接件'}],tolerance,{faces:[oppositeFace[first.mountFace]],excludedFaces:[first.mountFace]});
            row.blockedSideCount=row.sideFailures.length?1:0;
          }
          row.status='READY';row.definition=first.definition;row.checked=first.checked;
          const selected=this.selectHiddenSlots(row,legal,[first,second].filter(Boolean),[],reserved,tolerance);
          for(const solution of selected){
            const id=row.id+'|'+solution.mountFace+'|'+designAnchorKey(solution.designAnchorOffset),enabled=!this.excludedIds.has(id);
            row.placements.push({...solution,id,enabled});
            if(enabled)reserved.push({envelope:solution.envelope,label:row.sourceLabel+' → '+row.targetLabel+' '+faceLabel(solution.mountFace)});
          }
          row.enabled=row.placements.some(item=>item.enabled);
        }
      }
    }
    yield* this.previewSteps();
  }
  toggle(id,enabled){
    if(!this.active||this.busy)return null;
    const row=this.rows.find(row=>row.id===id||row.placements.some(item=>item.id===id));
    if(row?.status==='READY')for(const placement of row.placements.filter(item=>row.id===id||item.id===id)){if(enabled)this.excludedIds.delete(placement.id);else this.excludedIds.add(placement.id);}
    return this.plan();
  }
  confirm(){
    if(!this.active||this.busy)throw new Error('请等待扫描和预览完成后再生成连接件');
    const e=this.editor,chosen=this.rows.filter(row=>row.status==='READY'&&row.placements.some(item=>item.enabled));
    if(!chosen.length)throw new Error('请先勾选可生成的接头');
    if(JSON.stringify(e.exportProject())!==this.signature)throw new Error('工程已变化，请重新扫描；不会使用旧预览生成连接件');
    const reserved=this.reservedEnvelopes();
    const slotPairs=new Map();
    for(const row of chosen){
      const existing=e.connectionManager.connectionsAtJoint(row.source.userData.part.id,row.target.userData.part.id,row.end,row.face,undefined,row.candidate.snap);
      slotPairs.set(row.id,new Set(existing.map(connection=>hiddenSlotPair(connection.designComponent,connection.validation)?.key).filter(Boolean)));
    }
    // 重验每个实际面和槽对，再一次提交；不能把多槽件挤回默认锚点或重复占同一组槽。
    for(const row of chosen)for(const placement of row.placements.filter(item=>item.enabled)){
      const context=row.jointKind==='SIDE_SLOT'?sideSlotContexts(row.source,row.target,placement.definition,{sourceEnd:row.end,targetFace:row.face,sourceMountFace:placement.mountFace,sideSlot:placement.sideSlot})[0]:row.jointKind==='SIDE_MOUNT'?sideMountContexts(row.source,row.target,placement.definition,{targetFace:row.face,sourceMountFace:placement.mountFace,sideMount:placement.sideMount})[0]:this.context(row.source,row.target,row.candidate.snap,placement.mountFace,false,placement.designAnchorOffset);
      const fresh=e.connectionPlacementManager.evaluateCandidate(context,{mode:placement.checked.item.type,componentDefinition:placement.definition,preserveExisting:true});
      if(!fresh?.valid||Number(fresh.item.geometry.contactGapMm)>.1||(['SIDE_CORNER','SIDE_MOUNT','SIDE_SLOT'].includes(row.jointKind)&&fresh.item.geometry.jointKind!==row.jointKind))throw new Error(row.sourceLabel+' → '+row.targetLabel+' 已变化，请重新扫描');
      if(placement.definition.dimensions.geometryKind==='HIDDEN_CORNER'){
        const planned=hiddenSlotPair(placement.definition,placement.checked.item.geometry),current=hiddenSlotPair(placement.definition,fresh.item.geometry),occupied=slotPairs.get(row.id);
        if(!current||current.key!==planned?.key||occupied.has(current.key))throw new Error('内置连接件的槽位已变化或已占用，请重新扫描');
        occupied.add(current.key);
      }
      const envelope=fresh.envelope;
      if(this.options.type==='AUTO'&&!automaticConnectionChoice({...placement,checked:fresh,envelope},row.source,connectionSupportPlanes(row.source,row.target),row.target).valid)throw new Error('当前层承托面已变化，请重新扫描');
      if(reserved.some(other=>envelopesOverlap(envelope,other.envelope,Number(e.projectSettings.collisionToleranceMm??.5))))throw new Error('所选连接件的安装空间冲突，请重新扫描');
      reserved.push({envelope});
    }
    const before=e.exportProject(),selectedIds=e.selectedMeshes.map(mesh=>mesh.userData.part.id),created=[];
    let createdCount=0;
    try{
      for(const row of chosen){
        for(const placement of row.placements.filter(item=>item.enabled)){
          const connection=e.connectionManager.installDesignComponent(row.source,row.target,{sourceEnd:placement.checked.source.feature.end,targetFace:row.face,sourceMountFace:placement.mountFace,sourceMountFaces:[placement.mountFace],designAnchorOffset:placement.designAnchorOffset,jointKind:row.jointKind,sideMount:placement.sideMount,sideSlot:placement.sideSlot,designType:placement.checked.item.type,componentDefinition:placement.definition,preserveExisting:true});
          if(connection.status==='INVALID')throw new Error('接头重建失败，请重新扫描');
          e.autoConnectionResolver.markAutomatic(connection,'COMPONENT_SCAN',row.candidate.snap,placement.checked.item);connection.userOverridden=false;
          created.push(connection);createdCount++;
        }
      }
      e.updateDimensions();e.interferenceFeedbackManager.refresh({live:false});e.emitStats();e.historyManager.capture();e.emitProjectChanged();
    }catch(error){e.restoreProject(before);e.selectMany(selectedIds.map(id=>e.getMeshByPartId(id)).filter(Boolean));this.cancel();throw error;}
    this.cancel();return {createdCount,connectionCount:created.length,connections:created};
  }
  renderPreview(){
    drain(this.previewSteps());
  }
  *previewSteps(){
    if(!this.previewGroup){const group=new THREE.Group();group.name='__connection_batch_preview__';this.previewGroup=group;this.editor.sceneManager.scene.add(group);}
    const placements=this.rows.filter(row=>row.status==='READY').flatMap(row=>row.placements.filter(item=>item.enabled)),wanted=new Set(placements.map(item=>item.id));
    for(const [id,entry] of this.previewMeshes)if(!wanted.has(id)){this.previewGroup.remove(entry.mesh);ProfileGeometryFactory.disposeObject(entry.mesh);this.previewMeshes.delete(id);yield;}
    for(let index=0;index<placements.length;index++){
      const placement=placements[index],transform=placement.checked.transform;
      this.progressStep('正在准备连接件预览',90+10*index/placements.length,index,placements.length);yield;
      const signature=JSON.stringify([placement.definition.accessoryType,placement.definition.dimensions,transform.position.toArray(),transform.quaternion.toArray()]);
      const existing=this.previewMeshes.get(placement.id);if(existing?.signature===signature)continue;
      if(existing){this.previewGroup.remove(existing.mesh);ProfileGeometryFactory.disposeObject(existing.mesh);}
      const mesh=connectorGhost(placement.checked.item.type,transform.position,0xffbc35,placement.definition,transform);
      this.previewGroup.add(mesh);this.previewMeshes.set(placement.id,{mesh,signature});yield;
    }
  }
  progressStep(phase,progress,processed,total){this.phase=phase;this.progress=Math.round(progress);this.processedCount=processed;this.totalCount=total;}
  /** UI 分帧和同步调用共用同一生成器；同步入口保留已有内部工具的调用约定。 */
  run(job,phase='正在准备扫描'){
    this.currentJob?.return();const revision=++this.runRevision;this.currentJob=job;this.busy=true;this.progressStep(phase,0,0,0);this.emit();
    const current=()=>this.active&&revision===this.runRevision;
    const finish=()=>{
      if(!current())return null;
      if(this.signature!==JSON.stringify(this.editor.exportProject()))throw new Error('扫描期间工程已变化，请重新扫描');
      this.currentJob=null;this.busy=false;this.progressStep('扫描完成',100,this.totalCount,this.totalCount);return this.emit();
    };
    const failed=error=>{if(!current())return null;this.cancel();throw error;};
    if(!this.interactive){try{drain(job);return finish();}catch(error){return failed(error);}}
    return (async()=>{
      try{
        // 先让面板和“正在扫描”真正绘制，再开始几何计算；每轮让出浏览器事件循环。
        await yieldToBrowser();
        while(current()){
          const start=performance.now();let count=0;
          do{if(!current())return null;if(job.next().done)return finish();count++;}while(count<512&&performance.now()-start<8);
          this.emit();await yieldToBrowser();
        }
        return null;
      }catch(error){return failed(error);}
    })();
  }
  emit(){
    // 分段中的行尚未完成空间排序，不能把半成品数量和勾选入口当成可提交结果。
    const rows=this.busy?[]:this.rows,selected=rows.flatMap(row=>row.placements||[]).filter(item=>item.enabled);
    const state={active:this.active,busy:this.busy,phase:this.phase||'',progress:this.progress||0,processedCount:this.processedCount||0,totalCount:this.totalCount||0,profileCount:this.profileCount||0,contactCount:rows.filter(row=>row.touch).length,readyCount:selected.length,
      existingCount:rows.filter(row=>row.preserved).length,blockedCount:rows.filter(row=>(row.touch&&row.status==='SKIPPED'&&!row.preserved)||row.status==='INVALID_EXISTING').length,invalidCount:rows.filter(row=>row.status==='INVALID_EXISTING').length,
      blockedSideCount:rows.reduce((sum,row)=>sum+Number(row.blockedSideCount||0),0),
      uncheckedCount:rows.flatMap(row=>row.placements||[]).filter(item=>!item.enabled).length,nearbyCount:rows.filter(row=>row.status==='NEEDS_ALIGNMENT').length,
      skippedCount:rows.filter(row=>row.status!=='READY').length,freeEndCount:this.freeEndCount||0,
      rows:rows.flatMap(row=>{
        const base={jointId:row.id,sourceId:row.source.userData.part.id,targetId:row.target.userData.part.id,connectionId:row.old?.id||null,sourceLabel:row.sourceLabel,targetLabel:row.targetLabel,end:row.end,face:row.face,jointKind:row.jointKind||'END_TO_FACE',status:row.status,preserved:row.preserved};
        return row.status==='READY'?row.placements.map(item=>{
          const slots=hiddenSlotPair(item.definition,item.checked.item.geometry),slotLabel=slots?' · 源槽'+(slots.source.index+1)+' → 目标槽'+(slots.target.index+1):'';
          return {...base,id:item.id,enabled:item.enabled,mountFace:item.mountFace,componentLabel:item.definition.label,message:(row.supplement?'仅补空闲安装位，保留原件 · ':'')+(row.jointKind==='SIDE_CORNER'?'两梁内角 · ':'')+item.definition.label+' · '+faceLabel(item.mountFace)+'安装'+slotLabel+' · 自动定位与转向'};
        })
          :[{...base,id:row.id,enabled:false,message:humanMessage(row.message)}];
      })};
    this.onChanged?.(state);return state;
  }
  clearPreview(){if(this.previewGroup){this.editor.sceneManager.scene.remove(this.previewGroup);ProfileGeometryFactory.disposeObject(this.previewGroup);this.previewGroup=null;}this.previewMeshes.clear();}
  /** 本次扫描快照；正常留平行仅供实际安装/失效再分类，不能直接当缺另一侧问题。 */
  diagnostics(){
    if(this.busy)return [];
    const issues=this.rows.filter(row=>row.status==='INVALID_EXISTING'||row.status==='NEEDS_ALIGNMENT'||
      (row.touch&&row.status==='SKIPPED'&&!row.preserved)||row.blockedSideCount>0||row.policySkippedOnly).map(row=>{
      let point=row.candidate.targetPoint||row.checked?.target?.point||row.checked?.source?.point;
      if(!point&&row.candidate.snap.sideMount){
        const reference=row.candidate.snap.sideMount;
        point=profileFeatureWorldPoint(row.source,{type:'PROFILE_FACE',face:reference.sourceContactFace,
          stationS:reference.sourceStationS,faceOffset:reference.sourceSlotOffset||0});
      }
      const partial=row.blockedSideCount>0;
      const code=row.status==='INVALID_EXISTING'?row.old?.validation?.errors?.[0]?.code||'EXISTING_COMPONENT_MISSING':row.status==='NEEDS_ALIGNMENT'?'JOINT_NOT_CONTACT':
        !this.editor.isMeshTransformable(row.source)||!this.editor.isMeshTransformable(row.target)?'HOST_LOCKED':!row.solutions.length||row.policySkippedOnly?'INSTALLATION_RULE_UNSUPPORTED':'INSTALLATION_INVALID';
      const failures=row.failureDetails.length?structuredClone(row.failureDetails):[{code,message:humanMessage(row.message||'没有合法安装方案'),preview:null}];
      return {id:row.id,sourceId:row.source.userData.part.id,targetId:row.target.userData.part.id,
        sourceLabel:row.sourceLabel,targetLabel:row.targetLabel,end:row.end,face:row.face,
        sourceEnd:row.end,targetFace:row.face,scanStatus:row.status,blockedSide:partial,
        jointKind:row.jointKind||row.candidate.snap.jointKind||null,
        sideMount:structuredClone(row.candidate.snap.sideMount||null),sideSlot:structuredClone(row.candidate.snap.sideSlot||null),
        failures,policySkippedOnly:row.policySkippedOnly===true,
        title:row.status==='INVALID_EXISTING'?'已有连接失效':row.status==='NEEDS_ALIGNMENT'?'尚未贴合':partial?'另一侧未适配':'未能安装',
        reason:humanMessage(partial?(row.sideFailures?.length?row.sideFailures.join('；'):row.message||'没有合法安装方案'):row.message||'没有合法安装方案'),
        point:point&&[point.x,point.y,point.z].every(Number.isFinite)?{x:point.x,y:point.y,z:point.z}:null};
    });
    return this.classifyDiagnostics(issues);
  }
  /** 按实际已保存安装记录分类；提交完成后再调用，不能把“本次可以生成”误当已经安装。 */
  classifyDiagnostics(rows){
    const partIds=new Set(this.editor.parts.map(part=>part.id));
    return rows.map(row=>{
      const related=this.editor.connectionManager.connectionsAtJoint(row.sourceId,row.targetId,row.sourceEnd,row.targetFace,undefined,row);
      const invalidConnections=related.filter(connection=>connection.status==='INVALID'||connection.validation?.ok===false||
        (connection.designComponent&&!connection.manufacturingRuleId&&!this.editor.connectionManager.helperMeshes.get(connection.id)?.children.length));
      const invalid=row.scanStatus==='INVALID_EXISTING'||invalidConnections.length>0;
      const installed=related.filter(connection=>connection.status!=='INVALID'&&connection.validation?.ok!==false&&
        (connection.designComponent||connection.generatedHardwareIds?.some(id=>partIds.has(id))));
      const category=invalid?'INVALID':installed.length?'PARTIAL':'UNINSTALLED';
      let failures=category==='INVALID'?(row.failures||[]):(row.failures||[]).filter(failure=>!isExpectedConnectionSkip(failure.code));
      const policySkippedOnly=row.policySkippedOnly===true||category!=='INVALID'&&row.failures?.length>0&&!failures.length;
      // 提交后再次读实际安装：正常留平不当缺另一侧；完全未装和失效原件仍须处理。
      if(category==='PARTIAL'&&policySkippedOnly)return null;
      let reason=row.reason||row.message||'没有合法安装方案';
      if(category==='INVALID'&&row.policySkippedOnly){
        const error=invalidConnections[0]?.validation?.errors?.[0];
        reason=humanMessage(error?.message||'已有连接缺少有效安装实体，请检查原件；正常安装规则跳过不能掩盖失效记录');
        failures=[{code:error?.code||'EXISTING_COMPONENT_MISSING',message:reason,preview:null}];
      }else if(category==='UNINSTALLED'&&policySkippedOnly){
        reason='该接头尚未安装连接件；无需安装的端部方向 / 承托面候选已按规则跳过，需要其他允许的连接方式';
        failures=[{code:'INSTALLATION_RULE_UNSUPPORTED',message:reason,preview:null}];
      }else if(row.failures?.length>failures.length&&failures.length)reason=failures.map(failure=>failure.message).join('；');
      const title=category==='INVALID'?'已有连接失效':category==='PARTIAL'?'已安装，但另一侧未适配':row.scanStatus==='NEEDS_ALIGNMENT'?'尚未贴合':'完全未安装';
      const message=category==='PARTIAL'?'该接头已有连接件；未补另一侧的原因：'+reason:
        category==='UNINSTALLED'&&row.blockedSide&&!policySkippedOnly?'该接头尚未安装连接件；另一侧候选也未适配：'+reason:reason;
      return {...row,category,title,message,failures,policySkippedOnly,invalidConnectionIds:invalidConnections.map(connection=>connection.id),installedConnectionCount:installed.length};
    }).filter(Boolean);
  }
  /** 只读定位：失效原件走原连接选择；未生成候选用临时红色副本/点标，不把有效角码当失败对象。 */
  showDiagnostic(row,failure=row.failures?.[0]){
    this.clearDiagnosticPreview();
    if(row.category!=='INVALID'&&isExpectedConnectionSkip(failure?.code))return '该方向已按端部槽长 / 承托面留平规则跳过，无需处理。';
    if(row.category==='INVALID'){
      for(const id of row.invalidConnectionIds||[]){
        const connection=this.editor.connectionManager.connections.find(value=>value.id===id);
        const visible=connection&&this.editor.connectionSelectionMeshes(connection).some(root=>{
          let hasGeometry=false;root.traverse(child=>{if(child.isMesh&&child.visible!==false&&child.geometry)hasGeometry=true;});return hasGeometry;
        });
        if(visible&&this.editor.selectConnection(id))return '已高亮失效连接件；原件未修改，可到“修改”检查或替换。';
      }
    }
    this.editor.select(null);
    const group=new THREE.Group();group.name='__connection_issue_preview__';
    try{
      const preview=row.category==='INVALID'?null:failure?.preview;
      if(preview){
        const transform={position:new THREE.Vector3().fromArray(preview.position),quaternion:new THREE.Quaternion().fromArray(preview.quaternion)};
        group.add(connectorGhost(preview.mode,transform.position,0xd9534f,preview.definition,transform));
      }
      const point=row.point||preview&&{x:preview.position[0],y:preview.position[1],z:preview.position[2]};
      if(point){
        const marker=new THREE.Mesh(new THREE.SphereGeometry(3,12,8),new THREE.MeshBasicMaterial({color:0xd9534f,transparent:true,opacity:.9,depthTest:false,depthWrite:false}));
        marker.position.set(point.x,point.y,point.z);marker.renderOrder=1400;group.add(marker);
      }
      if(!group.children.length){ProfileGeometryFactory.disposeObject(group);return '当前没有可显示的配件或安装点，只能查看原因；请重新扫描。';}
      this.editor.sceneManager.scene.add(group);this.diagnosticGroup=group;
      return row.category==='INVALID'?'失效记录没有可见安装实体，已标记原接头位置；没有选中旁边的有效件。':preview?'红色为未生成的候选及接头位置，仅供查看；不是已经安装的配件。':'已标记未适配接头位置；当前没有可确认姿态的候选实体。';
    }catch(error){ProfileGeometryFactory.disposeObject(group);throw error;}
  }
  clearDiagnosticPreview(){
    if(!this.diagnosticGroup)return;
    this.editor.sceneManager.scene.remove(this.diagnosticGroup);ProfileGeometryFactory.disposeObject(this.diagnosticGroup);this.diagnosticGroup=null;
  }
  cancel(){
    this.runRevision++;this.currentJob?.return();this.currentJob=null;this.busy=false;this.progressStep('',0,0,0);this.evaluationCache=null;this.definitionCache=null;this.existingEnvelopes=null;
    this.clearDiagnosticPreview();this.clearPreview();if(!this.active)return;this.active=false;this.rows=[];this.profileCount=0;this.freeEndCount=0;
    const e=this.editor,s=e.sceneManager;s.transformControls.enabled=true;if(e.isMeshTransformable(e.selected))s.transformControls.attach(e.selected);e.profileGripEditor.refresh(true);this.emit();
  }
}
/** 只使用原孔槽校验已匹配的单腿槽对，不由锚点、截图或世界坐标猜一个可安装的槽。 */
function hiddenSlotPair(component,geometry){
  const ports=geometry?.componentPorts;
  if(component?.dimensions?.geometryKind!=='HIDDEN_CORNER'||ports?.ok!==true||ports.sourceSlots?.length!==1||ports.targetSlots?.length!==1)return null;
  const source=ports.sourceSlots[0],target=ports.targetSlots[0];
  if(source?.matched!==true||target?.matched!==true||!source.slotId||!target.slotId||!source.face||!target.face)return null;
  return {source,target,key:JSON.stringify([source.face,source.slotId,target.face,target.slotId])};
}
function diagnosticPreview(solution){
  const transform=solution.checked?.transform,definition=solution.definition;
  if(!transform||!definition)return null;
  const position=transform.position.toArray(),quaternion=transform.quaternion.toArray();
  if(![...position,...quaternion].every(Number.isFinite)||quaternion.reduce((sum,value)=>sum+value*value,0)<1e-12)return null;
  return {mode:solution.checked.item.type,definition:structuredClone(definition),position,quaternion};
}
function drain(job){let step;do{step=job.next();}while(!step.done);return step.value;}
function preserveConnection(old){return !!old&&(old.status==='INVALID'||old.validation?.ok===false||old.designComponent||old.manufacturingRuleId||!old.autoGenerated||old.userOverridden);}
// 外侧角只有保存的一个真实安装面；不能把该面已装一件报成“另一侧缺隐藏件”。
function singleMountSide(row){return row.jointKind==='SIDE_SLOT'||(row.jointKind==='SIDE_MOUNT'&&row.candidate.snap.sideMount?.mode==='OUTER_CORNER');}
function yieldToBrowser(){
  return new Promise(resolve=>{
    let frame=null;const done=()=>{clearTimeout(timer);if(frame!==null)cancelAnimationFrame(frame);resolve();};
    const timer=setTimeout(done,32);
    if(typeof requestAnimationFrame==='function'&&typeof document!=='undefined'&&document.visibilityState==='visible')frame=requestAnimationFrame(()=>setTimeout(done,0));
    else {clearTimeout(timer);setTimeout(resolve,0);}
  });
}
function insideTargetFace(source,target,snap){
  const point=profileFeatureWorldPoint(source,{type:'PROFILE_END',end:snap.sourceEnd});target.updateMatrixWorld(true);target.worldToLocal(point);
  const [width,height]=target.userData.part.dimensions.sectionSize,length=target.userData.part.dimensions.length;
  return Math.abs(point.z)<=length/2+.1&&(['FRONT','BACK'].includes(snap.targetFace)?Math.abs(point.x)<=width/2+.1:Math.abs(point.y)<=height/2+.1);
}
function pairKey(source,target){return [source.userData.part.id,target.userData.part.id].sort().join('|');}
function jointKey(sourceId,targetId,end,face){return [sourceId,end,targetId,face].join('|');}
function sameDirection(connection,source,target,snap){return !['SIDE_MOUNT','SIDE_SLOT'].includes(connection.jointKind)&&connection.sourceProfileId===source.userData.part.id&&connection.targetProfileId===target.userData.part.id&&connection.sourceEnd===snap.sourceEnd&&connection.targetFace===snap.targetFace;}
// 用两梁材料面交点而非含厚度偏移的角码中心去重，换规格或反向识别仍是同一物理内角。
function sideCornerKey(source,target,point){return 'SIDE_CORNER|'+pairKey(source,target)+'|'+point.toArray().map(value=>(Math.round(value*1000)/1000).toFixed(3)).join('|');}
function label(mesh){const part=mesh.userData.part;return part.displayId||part.name||part.id;}
function faceLabel(face){return ({FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'})[face]||face;}
function humanMessage(message){return message.replace(/\b(FRONT|BACK|LEFT|RIGHT)\b/g,faceLabel);}
function round(value){return Number(value.toFixed(3));}
function compare(a,b){
  const touch=Number(b.touch)-Number(a.touch);if(touch)return touch;
  if(a.old||b.old){const old=Number(b.matchesOld)-Number(a.matchesOld);if(old)return old;}
  const valid=Number(!!b.checked?.valid&&b.gap<=.1)-Number(!!a.checked?.valid&&a.gap<=.1);if(valid)return valid;
  return Number(b.interior||0)-Number(a.interior||0)||Number(a.candidate?.score||0)-Number(b.candidate?.score||0);
}
