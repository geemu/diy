import * as THREE from 'three';
import SnapManager from '../snap/SnapManager.js';
import {isLinearProfile} from '../model/ProfilePath.js';
import {profileSeries,isProfileFaceClosed} from '../model/DesignProfileCatalog.js';
import {profileFeatureWorldPoint,resolveProfileSurfaceFeature} from '../model/ProfileFeatureCatalog.js';
import {ConnectionComponentOptions,connectionSpecs,connectionComponent,connectionDesignType} from '../model/ComponentCatalog.js';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import {connectorGhost,connectorEnvelope,envelopesOverlap} from './ConnectionPlacementManager.js';

// 目录与已有安装映射共用，不用 UI 再维护一个只有三项的清单。
export const BatchConnectionComponentOptions=ConnectionComponentOptions.filter(option=>connectionSpecs(option.value).some(spec=>!spec.disabled&&connectionDesignType(connectionComponent({type:option.value,spec:spec.value}))));
const autoTypes=['ANGLE_BRACKET','CORNER_CUBE','L_BRACKET','HEAVY_CORNER','INNER_BRACKET','FLAT_PLATE','L_PLATE','T_PLATE','CROSS_PLATE'];
const oppositeFace={FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'};

/** 只读接头扫描 -> 共用目录几何预览 -> 一次提交。双侧组件共用一个接头关系，不是假制造认证。 */
export default class ConnectionBatchManager {
  constructor(editor){this.editor=editor;this.active=false;this.rows=[];this.previewGroup=null;this.onChanged=null;}
  isActive(){return this.active;}
  begin(options={}){
    this.cancel();this.active=true;this.options={type:'AUTO',spec:'AUTO',sides:'BOTH',supplement:true,profileIds:null,...options};this.excludedIds=new Set();
    const s=this.editor.sceneManager;s.transformControls.detach();s.transformControls.enabled=false;this.editor.profileGripEditor.refresh(true);
    try{return this.scan();}catch(error){this.cancel();throw error;}
  }
  scan(options={}){
    this.options={...this.options,...options};this.excludedIds.clear();this.clearPreview();
    const e=this.editor,allowed=this.options.profileIds?new Set(this.options.profileIds):null;
    const profiles=e.meshes.filter(mesh=>mesh.visible!==false&&!mesh.userData.part.hidden&&mesh.userData.part.type==='PROFILE'&&isLinearProfile(mesh.userData.part)&&(!allowed||allowed.has(mesh.userData.part.id)));
    if(profiles.length<2)throw new Error('扫描范围内至少需要两根可见直线型材');
    this.signature=JSON.stringify(e.exportProject());this.profileCount=profiles.length;this.rows=[];
    // 移动工具会排除所选对象；扫描使用独立只读作用域，不移动任何型材。
    const snap=new SnapManager({meshes:profiles}),byPair=new Map(),cache=new Map(),touchingEnds=new Set(),byId=new Map(profiles.map(mesh=>[mesh.userData.part.id,mesh]));
    for(const source of profiles)for(const candidate of snap.collectCandidates(source)){
      if(!candidate.snap.targetFace)continue;
      const target=byId.get(candidate.snap.targetProfileId);if(!target)continue;
      const touch=candidate.delta.length()<=.10001;
      // 先排除越界的邻域候选，再生成目录几何，避免密集框架为无关位置重复造预览。
      if(!touch&&!insideTargetFace(source,target,candidate.snap))continue;
      const directKey=[source.userData.part.id,candidate.snap.sourceEnd,target.userData.part.id,candidate.snap.targetFace].join('|');
      if(!cache.has(directKey))cache.set(directKey,this.solutionsFor(source,target,candidate.snap));
      const solutions=cache.get(directKey),checked=solutions.find(solution=>solution.checked?.valid)?.checked||solutions[0]?.checked;
      const old=e.autoConnectionResolver.findConnectionBetween(source.userData.part.id,target.userData.part.id);
      if(touch)touchingEnds.add(source.userData.part.id+'|'+candidate.snap.sourceEnd);
      const proposal={source,target,candidate,solutions,checked,old,touch,gap:Number(checked?.item?.geometry?.contactGapMm??candidate.delta.length()),
        key:[source.userData.part.id,target.userData.part.id].sort().join('|'),
        matchesOld:!!old&&old.sourceProfileId===source.userData.part.id&&old.sourceEnd===candidate.snap.sourceEnd&&old.targetFace===candidate.snap.targetFace,
        interior:e.autoConnectionResolver.targetInteriorDistance(target,candidate.targetPoint)};
      const previous=byPair.get(proposal.key);if(!previous||compare(proposal,previous)<0)byPair.set(proposal.key,proposal);
    }
    this.freeEndCount=profiles.length*2-touchingEnds.size;
    this.rows=[...byPair.values()].sort(compare).map(proposal=>({...proposal,id:proposal.key,sourceLabel:label(proposal.source),targetLabel:label(proposal.target),end:proposal.candidate.snap.sourceEnd,face:proposal.candidate.snap.targetFace}));
    // 脱离吸附邻域的失效旧关系也要报告，不能因为找不到新候选就从审阅中消失。
    for(const old of e.connectionManager.connections) {
      if(old.status!=='INVALID'||this.rows.some(row=>row.old?.id===old.id))continue;
      const source=byId.get(old.sourceProfileId),target=byId.get(old.targetProfileId);if(!source||!target)continue;
      this.rows.push({id:old.id,source,target,old,touch:false,solutions:[],sourceLabel:label(source),targetLabel:label(target),end:old.sourceEnd,face:old.targetFace});
    }
    return this.plan();
  }
  componentDefinitions(source){
    const series=Number(profileSeries(source.userData.part)),height=Number(source.userData.part.dimensions.sectionSize[1]);
    const types=this.options.type==='AUTO'?autoTypes:[this.options.type],result=[];
    for(const type of types){
      const choices=connectionSpecs(type).filter(option=>!option.disabled&&(this.options.type==='AUTO'||this.options.spec==='AUTO'||this.options.spec==null||option.value===this.options.spec))
        .map(option=>connectionComponent({type,spec:option.value})).filter(item=>Number(item.dimensions.size)===series&&connectionDesignType(item));
      choices.sort((a,b)=>Number(b.dimensions.height===height)-Number(a.dimensions.height===height)||a.dimensions.holeCount-b.dimensions.holeCount);
      // 同系列不只有一种角码尺寸；大规格腿宽不足时继续检查较小规格，而非漏掉整个接头。
      result.push(...choices);
    }
    return result;
  }
  solutionsFor(source,target,snap){
    const result=[],base=this.context(source,target,snap),defaultFace=base?.designCandidates?.find(item=>item.geometry)?.geometry?.sourceMountFace;
    const faces=[...new Set([defaultFace,'FRONT','BACK','LEFT','RIGHT'])].filter(face=>face&&!isProfileFaceClosed(source.userData.part,face));
    const contexts=new Map(faces.map(face=>[face,this.context(source,target,snap,face)]));
    for(const definition of this.componentDefinitions(source))for(const mountFace of faces){
      const checked=this.editor.connectionPlacementManager.evaluateCandidate(contexts.get(mountFace),{mode:connectionDesignType(definition),componentDefinition:definition});
      let envelope=null;
      if(checked?.valid){const ghost=connectorGhost(checked.item.type,checked.transform.position,0xffbc35,definition,checked.transform);envelope=connectorEnvelope(ghost);ProfileGeometryFactory.disposeObject(ghost);}
      result.push({definition,checked,mountFace,envelope});
    }
    return result;
  }
  context(source,target,snap,sourceMountFace=null){
    const a={mesh:source,feature:{type:'PROFILE_END',end:snap.sourceEnd},point:profileFeatureWorldPoint(source,{type:'PROFILE_END',end:snap.sourceEnd})};
    const feature={...(resolveProfileSurfaceFeature(target,a.point)||{}),type:'PROFILE_FACE',face:snap.targetFace};
    const b={mesh:target,feature,point:profileFeatureWorldPoint(target,feature)||a.point.clone()};
    const list=[];this.editor.connectionPlacementManager.pushJointCandidate(list,a,b,a.point,{sourceMountFace});return list[0];
  }
  reservedEnvelopes(){
    const e=this.editor,result=[];
    for(const connection of e.connectionManager.connections.filter(row=>row.designComponent&&!row.manufacturingRuleId)){
      const helper=e.connectionManager.helperMeshes.get(connection.id);
      if(helper&&helper.visible!==false)for(const child of helper.children)result.push({envelope:connectorEnvelope(child),label:'已有 '+(connection.manufacturingCode||connection.id)+' 连接件'});
    }
    return result;
  }
  plan(){
    const e=this.editor,usedEnds=new Set(),reserved=this.reservedEnvelopes(),tolerance=Number(e.projectSettings.collisionToleranceMm??.5);
    for(const row of this.rows){
      const {source,target,old}=row;row.status='SKIPPED';row.preserved=false;row.placements=[];row.enabled=false;
      row.supplement=false;
      if(old&&(old.status==='INVALID'||old.validation?.ok===false||(old.designComponent&&!old.manufacturingRuleId&&!e.connectionManager.helperMeshes.get(old.id)?.children.length))){row.status='INVALID_EXISTING';row.message='已有连接已失效：'+(old.validation?.errors?.[0]?.message||'连接件缺少有效安装实体')+'；请定位检查，原记录保留';}
      else if(!row.touch){row.status='NEEDS_ALIGNMENT';row.message='附近但尚未贴合：间距 '+round(row.candidate.delta.length())+' mm，请先吸附型材';}
      else if(old?.designComponent&&!old.manufacturingRuleId){
        row.preserved=true;row.message='已有有效设计连接件，保持不变';
        const faces=old.designComponentMountFaces?.length?old.designComponentMountFaces:[old.designComponentMountFace||old.sourceMountFace];
        const selectedDefinition=this.options.type!=='AUTO'&&this.options.spec!=='AUTO'?connectionComponent({type:this.options.type,spec:this.options.spec}):null;
        if(this.options.supplement!==false&&this.options.sides!=='SINGLE'&&faces.length===1&&old.designType==='ANGLE_BRACKET'&&(this.options.type==='AUTO'||old.designComponent.dimensions.geometryKind===this.options.type)&&(!selectedDefinition||selectedDefinition.id===old.designComponent.id)&&!old.manufacturingRuleId&&old.autoGenerated&&!old.userOverridden&&row.matchesOld&&e.isMeshTransformable(source)&&e.isMeshTransformable(target)) {
          const face=oppositeFace[faces[0]],context=this.context(source,target,row.candidate.snap,face);
          const checked=e.connectionPlacementManager.evaluateCandidate(context,{mode:old.designType,componentDefinition:old.designComponent});
          if(checked?.valid&&Number(checked.item.geometry.contactGapMm)<=.1) {
            const ghost=connectorGhost(checked.item.type,checked.transform.position,0xffbc35,old.designComponent,checked.transform),envelope=connectorEnvelope(ghost);ProfileGeometryFactory.disposeObject(ghost);
            if(!reserved.some(other=>envelopesOverlap(envelope,other.envelope,tolerance))) {
              const id=row.id+'|'+face,enabled=!this.excludedIds.has(id);
              row.status='READY';row.supplement=true;row.placements=[{id,enabled,mountFace:face,definition:old.designComponent,checked,envelope}];row.enabled=enabled;
              if(enabled)reserved.push({envelope,label:row.sourceLabel+' → '+row.targetLabel+' 补侧'});
            } else row.message+='；另一侧安装空间被占用，未补件';
          } else row.message+='；另一侧不可安装：'+(checked?.message||'没有合法安装面');
        }
      }
      else if(old?.manufacturingRuleId){row.preserved=true;row.message='已配置制造方案，保持原五金与加工';}
      else if(old&&(!old.autoGenerated||old.userOverridden)){row.preserved=true;row.message='手工或已修改连接，保持不变';}
      else if(old&&!row.matchesOld)row.message='原连接位置与当前接头不符，请先在连接页处理';
      else if(!row.solutions.length)row.message='所选类型 / 规格没有适配当前系列的自动安装规则，请换规格或手动添加';
      else if(!e.isMeshTransformable(source)||!e.isMeshTransformable(target))row.message='接头包含锁定构件，先解锁再生成';
      else if(usedEnds.has(source.userData.part.id+'|'+row.end))row.message='同一端部已有优先接头，请手工选择剩余位置';
      else{
        const legal=row.solutions.filter(solution=>solution.checked?.valid&&Number(solution.checked.item.geometry?.contactGapMm)<=.1);
        const first=legal.find(item=>!reserved.some(other=>envelopesOverlap(item.envelope,other.envelope,tolerance)));
        if(!first){
          const blocked=legal[0]&&reserved.find(other=>envelopesOverlap(legal[0].envelope,other.envelope,tolerance));
          const reasons=[...new Set(row.solutions.map(item=>item.checked?.message).filter(Boolean))].slice(0,2);
          row.message=blocked?'连接件安装包络与 '+blocked.label+' 重叠，请改用其他连接方式':reasons.join('；')||'当前位置没有合法安装面，请调整接头或连接件';
        }else{
          // 同一接头选一个目录型号；仅直角类放互为反面的两侧，不能把三通/平板当作四个角码。
          const second=this.options.sides!=='SINGLE'&&first.checked.item.type==='ANGLE_BRACKET'
            ?legal.find(item=>item.definition.id===first.definition.id&&item.mountFace===oppositeFace[first.mountFace]&&!reserved.some(other=>envelopesOverlap(item.envelope,other.envelope,tolerance))&&!envelopesOverlap(item.envelope,first.envelope,tolerance)):null;
          row.status='READY';row.definition=first.definition;row.checked=first.checked;
          for(const solution of [first,second].filter(Boolean)){
            const id=row.id+'|'+solution.mountFace,enabled=!this.excludedIds.has(id);
            row.placements.push({...solution,id,enabled});
            if(enabled)reserved.push({envelope:solution.envelope,label:row.sourceLabel+' → '+row.targetLabel+' '+faceLabel(solution.mountFace)});
          }
          row.enabled=row.placements.some(item=>item.enabled);
          if(row.enabled)usedEnds.add(source.userData.part.id+'|'+row.end);
        }
      }
    }
    this.renderPreview();return this.emit();
  }
  toggle(id,enabled){
    const row=this.rows.find(row=>row.id===id||row.placements.some(item=>item.id===id));
    if(row?.status==='READY')for(const placement of row.placements.filter(item=>row.id===id||item.id===id)){if(enabled)this.excludedIds.delete(placement.id);else this.excludedIds.add(placement.id);}
    return this.plan();
  }
  confirm(){
    const e=this.editor,chosen=this.rows.filter(row=>row.status==='READY'&&row.placements.some(item=>item.enabled));
    if(!chosen.length)throw new Error('请先勾选可生成的接头');
    if(JSON.stringify(e.exportProject())!==this.signature)throw new Error('工程已变化，请重新扫描；不会使用旧预览生成连接件');
    const reserved=this.reservedEnvelopes();
    // 重验每一个实际安装面，再一次提交；不能刷新后把两侧都挤回默认面。
    for(const row of chosen)for(const placement of row.placements.filter(item=>item.enabled)){
      const fresh=e.connectionPlacementManager.evaluateCandidate(this.context(row.source,row.target,row.candidate.snap,placement.mountFace),{mode:placement.checked.item.type,componentDefinition:placement.definition});
      if(!fresh?.valid||Number(fresh.item.geometry.contactGapMm)>.1)throw new Error(row.sourceLabel+' → '+row.targetLabel+' 已变化，请重新扫描');
      const ghost=connectorGhost(fresh.item.type,fresh.transform.position,0xffbc35,placement.definition,fresh.transform),envelope=connectorEnvelope(ghost);ProfileGeometryFactory.disposeObject(ghost);
      if(reserved.some(other=>envelopesOverlap(envelope,other.envelope,Number(e.projectSettings.collisionToleranceMm??.5))))throw new Error('所选连接件的安装空间冲突，请重新扫描');
      reserved.push({envelope});
    }
    const before=e.exportProject(),selectedIds=e.selectedMeshes.map(mesh=>mesh.userData.part.id),created=[];
    let createdCount=0;
    try{
      for(const row of chosen){
        const placements=row.placements.filter(item=>item.enabled),first=placements[0];
        const connection=row.supplement?e.connectionManager.addDesignComponentMountFace(row.old,first.mountFace):e.connectionManager.installDesignComponent(row.source,row.target,{sourceEnd:row.end,targetFace:row.face,sourceMountFace:first.mountFace,sourceMountFaces:placements.map(item=>item.mountFace),designType:first.checked.item.type,componentDefinition:first.definition});
        if(connection.status==='INVALID')throw new Error('接头重建失败，请重新扫描');
        if(!row.supplement){e.autoConnectionResolver.markAutomatic(connection,'COMPONENT_SCAN',row.candidate.snap,first.checked.item);connection.userOverridden=false;}created.push(connection);createdCount+=placements.length;
      }
      e.updateDimensions();e.interferenceFeedbackManager.refresh({live:false});e.emitStats();e.historyManager.capture();e.emitProjectChanged();
    }catch(error){e.restoreProject(before);e.selectMany(selectedIds.map(id=>e.getMeshByPartId(id)).filter(Boolean));this.cancel();throw error;}
    this.cancel();return {createdCount,connectionCount:created.length,connections:created};
  }
  renderPreview(){
    this.clearPreview();const group=new THREE.Group();group.name='__connection_batch_preview__';this.previewGroup=group;
    for(const row of this.rows.filter(row=>row.status==='READY'))for(const placement of row.placements.filter(item=>item.enabled))group.add(connectorGhost(placement.checked.item.type,placement.checked.transform.position,0xffbc35,placement.definition,placement.checked.transform));
    this.editor.sceneManager.scene.add(group);
  }
  emit(){
    const selected=this.rows.flatMap(row=>row.placements||[]).filter(item=>item.enabled);
    const state={active:this.active,profileCount:this.profileCount||0,contactCount:this.rows.filter(row=>row.touch).length,readyCount:selected.length,
      existingCount:this.rows.filter(row=>row.preserved).length,blockedCount:this.rows.filter(row=>(row.touch&&row.status==='SKIPPED'&&!row.preserved)||row.status==='INVALID_EXISTING').length,invalidCount:this.rows.filter(row=>row.status==='INVALID_EXISTING').length,
      uncheckedCount:this.rows.flatMap(row=>row.placements||[]).filter(item=>!item.enabled).length,nearbyCount:this.rows.filter(row=>row.status==='NEEDS_ALIGNMENT').length,
      skippedCount:this.rows.filter(row=>row.status!=='READY').length,freeEndCount:this.freeEndCount||0,
      rows:this.rows.flatMap(row=>{
        const base={jointId:row.id,sourceId:row.source.userData.part.id,targetId:row.target.userData.part.id,connectionId:row.old?.id||null,sourceLabel:row.sourceLabel,targetLabel:row.targetLabel,end:row.end,face:row.face,status:row.status,preserved:row.preserved};
        return row.status==='READY'?row.placements.map(item=>({...base,id:item.id,enabled:item.enabled,mountFace:item.mountFace,componentLabel:item.definition.label,message:(row.supplement?'仅补另一侧，保留原件 · ':'')+item.definition.label+' · '+faceLabel(item.mountFace)+'安装 · 自动定位与转向'}))
          :[{...base,id:row.id,enabled:false,message:humanMessage(row.message)}];
      })};
    this.onChanged?.(state);return state;
  }
  clearPreview(){if(this.previewGroup){this.editor.sceneManager.scene.remove(this.previewGroup);ProfileGeometryFactory.disposeObject(this.previewGroup);this.previewGroup=null;}}
  cancel(){
    this.clearPreview();if(!this.active)return;this.active=false;this.rows=[];
    const e=this.editor,s=e.sceneManager;s.transformControls.enabled=true;if(e.isMeshTransformable(e.selected))s.transformControls.attach(e.selected);e.profileGripEditor.refresh(true);this.emit();
  }
}
function insideTargetFace(source,target,snap){
  const point=profileFeatureWorldPoint(source,{type:'PROFILE_END',end:snap.sourceEnd});target.updateMatrixWorld(true);target.worldToLocal(point);
  const [width,height]=target.userData.part.dimensions.sectionSize,length=target.userData.part.dimensions.length;
  return Math.abs(point.z)<=length/2+.1&&(['FRONT','BACK'].includes(snap.targetFace)?Math.abs(point.x)<=width/2+.1:Math.abs(point.y)<=height/2+.1);
}
function label(mesh){const part=mesh.userData.part;return part.displayId||part.name||part.id;}
function faceLabel(face){return ({FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'})[face]||face;}
function humanMessage(message){return message.replace(/\b(FRONT|BACK|LEFT|RIGHT)\b/g,faceLabel);}
function round(value){return Number(value.toFixed(3));}
function compare(a,b){
  const touch=Number(b.touch)-Number(a.touch);if(touch)return touch;
  if(a.old||b.old){const old=Number(b.matchesOld)-Number(a.matchesOld);if(old)return old;}
  const valid=Number(b.checked?.valid&&b.gap<=.1)-Number(a.checked?.valid&&a.gap<=.1);if(valid)return valid;
  return b.interior-a.interior||a.candidate.score-b.candidate.score;
}
