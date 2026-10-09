import * as THREE from 'three';
import SnapManager from '../snap/SnapManager.js';
import {isLinearProfile} from '../model/ProfilePath.js';
import {profileSeries,isProfileFaceClosed} from '../model/DesignProfileCatalog.js';
import {profileFeatureWorldPoint,resolveProfileSurfaceFeature} from '../model/ProfileFeatureCatalog.js';
import {ConnectionComponentOptions,connectionSpecs,connectionComponent,connectionDesignType} from '../model/ComponentCatalog.js';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import {profileObb} from '../validation/PartCollisionDetector.js';
import {connectorGhost,connectorEnvelope,envelopesOverlap} from './ConnectionPlacementManager.js';
import {connectionSupportPlanes,automaticConnectionChoice} from './ConnectionAutoPolicy.js';

// 目录与已有安装映射共用，不用 UI 再维护一个只有三项的清单。
export const BatchConnectionComponentOptions=ConnectionComponentOptions.filter(option=>connectionSpecs(option.value).some(spec=>!spec.disabled&&connectionDesignType(connectionComponent({type:option.value,spec:spec.value}))));
const autoTypes=['CORNER_CUBE','HIDDEN_CORNER'];
const oppositeFace={FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'};

/** 只读接头扫描 -> 共用目录几何预览 -> 一次提交；每个设计组件独立保存，不是假制造认证。 */
export default class ConnectionBatchManager {
  constructor(editor){this.editor=editor;this.active=false;this.busy=false;this.rows=[];this.previewGroup=null;this.previewMeshes=new Map();this.onChanged=null;this.runRevision=0;}
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
    const snap=new SnapManager({meshes:profiles}),byPair=new Map(),cache=new Map(),touchingEnds=new Set(),byId=new Map(profiles.map(mesh=>[mesh.userData.part.id,mesh])),bounds=new Map(),oldPairs=new Map();
    for(const old of e.connectionManager.connections)if(old.jointKind!=='SIDE_CORNER'){
      const key=[old.sourceProfileId,old.targetProfileId].sort().join('|');if(!oldPairs.has(key))oldPairs.set(key,old);
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
      for(const candidate of snap.collectCandidates(source)){
        if(!candidate.snap.targetFace)continue;
        const target=byId.get(candidate.snap.targetProfileId);if(!target)continue;
        const touch=candidate.delta.length()<=.10001;
        // 先排除越界的邻域候选，再生成目录几何，避免密集框架为无关位置重复造预览。
        if(!touch&&!insideTargetFace(source,target,candidate.snap))continue;
        const directKey=[source.userData.part.id,candidate.snap.sourceEnd,target.userData.part.id,candidate.snap.targetFace].join('|');
        const old=oldPairs.get(pairKey(source,target));
        if(!cache.has(directKey))cache.set(directKey,touch&&!preserveConnection(old)?(yield* this.solutionSteps(source,target,candidate.snap)):[]);
        const solutions=cache.get(directKey),checked=solutions.find(solution=>solution.checked?.valid)?.checked||solutions[0]?.checked;
        if(touch)touchingEnds.add(source.userData.part.id+'|'+candidate.snap.sourceEnd);
        const proposal={source,target,candidate,solutions,checked,old,touch,gap:Number(checked?.item?.geometry?.contactGapMm??candidate.delta.length()),
          key:[source.userData.part.id,target.userData.part.id].sort().join('|'),
          matchesOld:!!old&&old.sourceProfileId===source.userData.part.id&&old.sourceEnd===candidate.snap.sourceEnd&&old.targetFace===candidate.snap.targetFace,
          interior:e.autoConnectionResolver.targetInteriorDistance(target,candidate.targetPoint)};
        const previous=byPair.get(proposal.key);if(!previous||compare(proposal,previous)<0)byPair.set(proposal.key,proposal);
        yield;
      }
    }
    const corners=yield* this.sideCornerSteps(profiles),cornerPairs=new Set(corners.map(row=>pairKey(row.source,row.target)));
    this.freeEndCount=profiles.length*2-touchingEnds.size;
    // 侧面内角真实贴合时，不再同时给同一对梁报端中心的虚假间距；已有普通关系仍保留审阅。
    const proposals=[...byPair.values()].filter(row=>row.touch||row.old||!cornerPairs.has(row.key));
    this.rows=[...proposals,...corners].sort(compare).map(proposal=>({...proposal,id:proposal.key,sourceLabel:label(proposal.source),targetLabel:label(proposal.target),end:proposal.candidate.snap.sourceEnd,face:proposal.candidate.snap.targetFace}));
    // 失效旧关系和本次所选类型未覆盖的已有内角仍报告，不能从审阅中消失或被误当缺件。
    for(const old of e.connectionManager.connections) {
      if((old.status!=='INVALID'&&old.jointKind!=='SIDE_CORNER')||this.rows.some(row=>row.old?.id===old.id))continue;
      const source=byId.get(old.sourceProfileId),target=byId.get(old.targetProfileId);if(!source||!target)continue;
      const gap=Number(old.validation?.contactGapMm??Infinity),touch=old.status!=='INVALID'&&old.validation?.ok===true&&gap<=.1;
      const candidate={delta:new THREE.Vector3(Number.isFinite(gap)?gap:0,0,0),snap:{sourceEnd:old.sourceEnd,targetFace:old.targetFace,jointKind:old.jointKind}};
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
        const contact=placement.resolveJointContact({mesh:source,point},target,face);
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
            const retained=preserveConnection(old)?e.connectionManager.recommendDesignFor(source,target,{sourceEnd:end,targetFace:snap.targetFace,sourceMountFace:mountFace,componentDefinition:old.designComponent}).find(item=>item.geometry?.jointKind==='SIDE_CORNER'):null;
            const solutions=preserveConnection(old)?(retained?[{checked:{item:retained,valid:retained.valid}}]:[]):(yield* this.solutionSteps(source,target,snap,definitions)).filter(item=>item.checked?.item.geometry?.jointKind==='SIDE_CORNER');if(!solutions.length)continue;
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
    const result=[],base=this.context(source,target,snap),defaultFace=base?.designCandidates?.find(item=>item.geometry)?.geometry?.sourceMountFace;
    const faces=(requestedFaces||(snap.jointKind==='SIDE_CORNER'?[snap.sourceMountFace]:[...new Set([defaultFace,'FRONT','BACK','LEFT','RIGHT'])])).filter(face=>face&&!isProfileFaceClosed(source.userData.part,face));
    const contexts=new Map(faces.map(face=>[face,this.context(source,target,snap,face,false)]));
    for(const definition of definitions)for(const mountFace of faces){
      const checked=this.editor.connectionPlacementManager.evaluateCandidate(contexts.get(mountFace),{mode:connectionDesignType(definition),componentDefinition:definition,preserveExisting:false,evaluationCache:this.evaluationCache});
      result.push({definition,checked,mountFace,envelope:checked?.valid?checked.envelope:null});yield;
    }
    return result;
  }
  context(source,target,snap,sourceMountFace=null,recommend=true){
    const a={mesh:source,feature:{type:'PROFILE_END',end:snap.sourceEnd},point:profileFeatureWorldPoint(source,{type:'PROFILE_END',end:snap.sourceEnd})};
    if(snap.jointKind==='SIDE_CORNER'){
      const context=this.editor.connectionPlacementManager.resolveJointContact(a,target,sourceMountFace||snap.sourceMountFace);
      return context?.target.feature.face===snap.targetFace?context:null;
    }
    const feature={...(resolveProfileSurfaceFeature(target,a.point)||{}),type:'PROFILE_FACE',face:snap.targetFace};
    const b={mesh:target,feature,point:profileFeatureWorldPoint(target,feature)||a.point.clone()};
    if(!recommend)return {source:a,target:b,sourceMountFace};
    const list=[];this.editor.connectionPlacementManager.pushJointCandidate(list,a,b,a.point,{sourceMountFace});return list[0];
  }
  /** 自动模式逐安装侧选型；指定目录类型仍只按原安装守卫，不私自换成推荐型号。 */
  legalChoices(row,solutions){
    const planes=row.supportPlanes??(row.supportPlanes=connectionSupportPlanes(row.source,row.target));
    const joint=this.editor.connectionManager.connectionsAtJoint(row.source.userData.part.id,row.target.userData.part.id,row.end,row.face);
    const legal=[];
    for(const solution of solutions){
      if(!solution.checked?.valid||Number(solution.checked.item.geometry?.contactGapMm)>.1)continue;
      if(joint.some(connection=>connection.designComponent&&this.editor.connectionManager.mountFaces(connection).includes(solution.mountFace)))continue;
      const policy=this.options.type==='AUTO'?automaticConnectionChoice(solution,row.source,planes):{valid:true,score:0};
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
  plan(){return this.active&&!this.busy?this.run(this.planSteps(),'正在更新预览'):null;}
  *planSteps(){
    if(this.signature!==JSON.stringify(this.editor.exportProject()))throw new Error('工程已变化，请重新扫描连接件');
    const e=this.editor,usedEnds=new Set(),reserved=[...(this.existingEnvelopes||this.reservedEnvelopes())],tolerance=Number(e.projectSettings.collisionToleranceMm??.5);
    for(let index=0;index<this.rows.length;index++){
      const row=this.rows[index];this.progressStep('正在检查安装空间',75+15*index/this.rows.length,index,this.rows.length);yield;
      const {source,target,old}=row;row.status='SKIPPED';row.preserved=false;row.placements=[];row.enabled=false;
      row.supplement=false;row.blockedSideCount=0;
      if(old&&(old.status==='INVALID'||old.validation?.ok===false||(old.designComponent&&!old.manufacturingRuleId&&!e.connectionManager.helperMeshes.get(old.id)?.children.length))){row.status='INVALID_EXISTING';row.message='已有连接已失效：'+(old.validation?.errors?.[0]?.message||'连接件缺少有效安装实体')+'；请定位检查，原记录保留';}
      else if(!row.touch){row.status='NEEDS_ALIGNMENT';row.message='附近但尚未贴合：间距 '+round(row.candidate.delta.length())+' mm，请先吸附型材';}
      else if(old?.designComponent&&!old.manufacturingRuleId){
        row.preserved=true;row.message='已有有效设计连接件，保持不变';
        const faces=old.designComponentMountFaces?.length?old.designComponentMountFaces:[old.designComponentMountFace||old.sourceMountFace];
        const selectedDefinition=this.options.type!=='AUTO'&&this.options.spec!=='AUTO'?connectionComponent({type:this.options.type,spec:this.options.spec}):null;
        if(this.options.supplement!==false&&this.options.sides!=='SINGLE'&&faces.length===1&&(old.designType==='ANGLE_BRACKET'||(this.options.type==='AUTO'&&old.designComponent.dimensions.geometryKind==='HIDDEN_CORNER'))&&(this.options.type==='AUTO'||old.designComponent.dimensions.geometryKind===this.options.type)&&(!selectedDefinition||selectedDefinition.id===old.designComponent.id)&&!old.manufacturingRuleId&&old.autoGenerated&&!old.userOverridden&&row.matchesOld&&e.isMeshTransformable(source)&&e.isMeshTransformable(target)) {
          const face=oppositeFace[faces[0]],joint=e.connectionManager.connectionsAtJoint(source.userData.part.id,target.userData.part.id,row.end,row.face);
          if(!joint.some(connection=>connection.designComponent&&e.connectionManager.mountFaces(connection).includes(face))){
            const definitions=this.options.type==='AUTO'?this.componentDefinitions(source):[old.designComponent];
            const solutions=yield* this.solutionSteps(source,target,row.candidate.snap,definitions,[face]);
            const choice=this.legalChoices(row,solutions).find(item=>!reserved.some(other=>envelopesOverlap(item.envelope,other.envelope,tolerance)));
            if(choice){
              const id=row.id+'|'+face,enabled=!this.excludedIds.has(id);
              row.status='READY';row.supplement=true;row.placements=[{...choice,id,enabled}];row.enabled=enabled;
              if(enabled)reserved.push({envelope:choice.envelope,label:row.sourceLabel+' → '+row.targetLabel+' 补侧'});
            }else{row.blockedSideCount=1;row.message+='；另一侧没有兼容且不影响承托面的安装位置，未补件';}
          }
        }
      }
      else if(old?.manufacturingRuleId){row.preserved=true;row.message='已配置制造方案，保持原五金与加工';}
      else if(old&&(!old.autoGenerated||old.userOverridden)){row.preserved=true;row.message='手工或已修改连接，保持不变';}
      else if(old&&row.jointKind==='SIDE_CORNER'&&old.jointKind!=='SIDE_CORNER'){row.preserved=true;row.message='这个位置已有端面连接，保留原关系，请在连接页检查';}
      else if(old&&!row.matchesOld)row.message='原连接位置与当前接头不符，请先在连接页处理';
      else if(!row.solutions.length)row.message='所选类型 / 规格没有适配当前系列的自动安装规则，请换规格或手动添加';
      else if(!e.isMeshTransformable(source)||!e.isMeshTransformable(target))row.message='接头包含锁定构件，先解锁再生成';
      else if(row.jointKind!=='SIDE_CORNER'&&usedEnds.has(source.userData.part.id+'|'+row.end))row.message='同一端部已有优先接头，请手工选择剩余位置';
      else{
        const legal=this.legalChoices(row,row.solutions);
        const first=legal.find(item=>!reserved.some(other=>envelopesOverlap(item.envelope,other.envelope,tolerance)));
        if(!first){
          const blocked=legal[0]&&reserved.find(other=>envelopesOverlap(legal[0].envelope,other.envelope,tolerance));
          const reasons=[...new Set(row.solutions.map(item=>item.policy?.message||item.checked?.message).filter(Boolean))].slice(0,2);
          row.message=blocked?'连接件安装包络与 '+blocked.label+' 重叠，请改用其他连接方式':reasons.join('；')||'当前位置没有合法安装面，请调整接头或连接件';
        }else{
          // 自动模式允许梁下角码 + 另一侧隐藏件；明确指定类型仍保持同型号相反侧。
          const paired=this.options.sides!=='SINGLE'&&(this.options.type==='AUTO'||first.checked.item.type==='ANGLE_BRACKET');
          const second=paired?legal.find(item=>(this.options.type==='AUTO'||item.definition.id===first.definition.id)&&item.mountFace===oppositeFace[first.mountFace]&&!reserved.some(other=>envelopesOverlap(item.envelope,other.envelope,tolerance))&&!envelopesOverlap(item.envelope,first.envelope,tolerance)):null;
          if(paired&&!second)row.blockedSideCount=1;
          row.status='READY';row.definition=first.definition;row.checked=first.checked;
          for(const solution of [first,second].filter(Boolean)){
            const id=row.id+'|'+solution.mountFace,enabled=!this.excludedIds.has(id);
            row.placements.push({...solution,id,enabled});
            if(enabled)reserved.push({envelope:solution.envelope,label:row.sourceLabel+' → '+row.targetLabel+' '+faceLabel(solution.mountFace)});
          }
          row.enabled=row.placements.some(item=>item.enabled);
          if(row.enabled&&row.jointKind!=='SIDE_CORNER')usedEnds.add(source.userData.part.id+'|'+row.end);
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
    // 重验每一个实际安装面，再一次提交；不能刷新后把两侧都挤回默认面。
    for(const row of chosen)for(const placement of row.placements.filter(item=>item.enabled)){
      const fresh=e.connectionPlacementManager.evaluateCandidate(this.context(row.source,row.target,row.candidate.snap,placement.mountFace,false),{mode:placement.checked.item.type,componentDefinition:placement.definition,preserveExisting:true});
      if(!fresh?.valid||Number(fresh.item.geometry.contactGapMm)>.1||(row.jointKind==='SIDE_CORNER'&&fresh.item.geometry.jointKind!=='SIDE_CORNER'))throw new Error(row.sourceLabel+' → '+row.targetLabel+' 已变化，请重新扫描');
      const envelope=fresh.envelope;
      if(this.options.type==='AUTO'&&!automaticConnectionChoice({...placement,checked:fresh,envelope},row.source,connectionSupportPlanes(row.source,row.target)).valid)throw new Error('当前层承托面已变化，请重新扫描');
      if(reserved.some(other=>envelopesOverlap(envelope,other.envelope,Number(e.projectSettings.collisionToleranceMm??.5))))throw new Error('所选连接件的安装空间冲突，请重新扫描');
      reserved.push({envelope});
    }
    const before=e.exportProject(),selectedIds=e.selectedMeshes.map(mesh=>mesh.userData.part.id),created=[];
    let createdCount=0;
    try{
      for(const row of chosen){
        for(const placement of row.placements.filter(item=>item.enabled)){
          const connection=e.connectionManager.installDesignComponent(row.source,row.target,{sourceEnd:row.end,targetFace:row.face,sourceMountFace:placement.mountFace,sourceMountFaces:[placement.mountFace],designType:placement.checked.item.type,componentDefinition:placement.definition,preserveExisting:true});
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
        return row.status==='READY'?row.placements.map(item=>({...base,id:item.id,enabled:item.enabled,mountFace:item.mountFace,componentLabel:item.definition.label,message:(row.supplement?'仅补另一侧，保留原件 · ':'')+(row.jointKind==='SIDE_CORNER'?'两梁内角 · ':'')+item.definition.label+' · '+faceLabel(item.mountFace)+'安装 · 自动定位与转向'}))
          :[{...base,id:row.id,enabled:false,message:humanMessage(row.message)}];
      })};
    this.onChanged?.(state);return state;
  }
  clearPreview(){if(this.previewGroup){this.editor.sceneManager.scene.remove(this.previewGroup);ProfileGeometryFactory.disposeObject(this.previewGroup);this.previewGroup=null;}this.previewMeshes.clear();}
  cancel(){
    this.runRevision++;this.currentJob?.return();this.currentJob=null;this.busy=false;this.progressStep('',0,0,0);this.evaluationCache=null;this.definitionCache=null;this.existingEnvelopes=null;
    this.clearPreview();if(!this.active)return;this.active=false;this.rows=[];this.profileCount=0;this.freeEndCount=0;
    const e=this.editor,s=e.sceneManager;s.transformControls.enabled=true;if(e.isMeshTransformable(e.selected))s.transformControls.attach(e.selected);e.profileGripEditor.refresh(true);this.emit();
  }
}
function drain(job){let step;do{step=job.next();}while(!step.done);return step.value;}
function preserveConnection(old){return !!old&&(old.status==='INVALID'||old.validation?.ok===false||old.designComponent||old.manufacturingRuleId||!old.autoGenerated||old.userOverridden);}
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
function sameDirection(connection,source,target,snap){return connection.sourceProfileId===source.userData.part.id&&connection.targetProfileId===target.userData.part.id&&connection.sourceEnd===snap.sourceEnd&&connection.targetFace===snap.targetFace;}
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
