import * as THREE from 'three';
import {isLinearProfile,getLocalEndpoints} from '../model/ProfilePath.js';
import {profileQuaternion} from '../geometry/ProfileOrientation.js';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import PrimitiveGeometryFactory from '../geometry/PrimitiveGeometryFactory.js';
import SnapManager from '../snap/SnapManager.js';
import {profileObb} from '../validation/PartCollisionDetector.js';

/** 对齐只规划真实坐标和长度；预览不移动工程，确认才走一次可撤销事务。 */
export default class QuickAlignmentManager {
  constructor(editor){this.editor=editor;this.active=false;this.previewGroup=null;this.pending=null;}
  isActive(){return this.active;}
  begin(){
    if(this.editor.selectedMeshes.length<2)throw new Error('请先 Shift 多选至少两个构件');
    this.cancel();this.active=true;
    const s=this.editor.sceneManager;s.transformControls?.detach();if(s.transformControls)s.transformControls.enabled=false;
    this.editor.profileGripEditor?.refresh(true);return this;
  }
  plan(kind,options={}){
    if(typeof options==='string')options={axis:options};
    const e=this.editor,meshes=[...e.selectedMeshes];
    if(meshes.length<2)throw new Error('请先 Shift 多选至少两个构件');
    const anchor=options.referenceId?meshes.find(mesh=>mesh.userData.part.id===options.referenceId):meshes[meshes.length-1];
    if(!anchor)throw new Error('对齐基准不在当前选择中，请重新选择');
    meshes.forEach(mesh=>mesh.updateMatrixWorld(true));
    const axes=kind==='CENTER'?(options.axes||[options.axis||'X']):[options.axis||'X'];
    if(!axes.length||axes.some(axis=>!['X','Y','Z'].includes(axis)))throw new Error('至少选择一个 X/Y/Z 对齐方向');
    const plans=meshes.map(mesh=>({mesh,position:mesh.position.clone(),quaternion:mesh.quaternion.clone(),length:null}));
    const referenceDirection=new THREE.Vector3(0,0,1).applyQuaternion(anchor.quaternion).normalize();
    const parallel=()=>{if(meshes.some(mesh=>Math.abs(referenceDirection.dot(new THREE.Vector3(0,0,1).applyQuaternion(mesh.quaternion)))<.99999))throw new Error('请选择轴线平行的构件；垂直接头请使用直角贴合');};
    const linear=()=>{if(meshes.some(mesh=>mesh.userData.part.type!=='PROFILE'||!isLinearProfile(mesh.userData.part)))throw new Error('此操作只适用于直线型材');};
    if(kind==='CENTER'){
      parallel();const target=new THREE.Box3().setFromObject(anchor).getCenter(new THREE.Vector3());
      for(const plan of plans){const center=new THREE.Box3().setFromObject(plan.mesh).getCenter(new THREE.Vector3());for(const axis of axes)plan.position[axis.toLowerCase()]+=target[axis.toLowerCase()]-center[axis.toLowerCase()];}
    }else if(['DISTRIBUTE','GOLDEN'].includes(kind)){
      if(meshes.length<3)throw new Error('排列至少需要三个构件');
      const coordinate=axes[0].toLowerCase(),rows=plans.map(plan=>({plan,value:new THREE.Box3().setFromObject(plan.mesh).getCenter(new THREE.Vector3())[coordinate]})).sort((a,b)=>a.value-b.value);
      const start=rows[0].value,end=rows[rows.length-1].value,count=rows.length-1;
      rows.forEach(({plan,value},index)=>{const fraction=kind==='GOLDEN'?(index===0?0:(Math.pow(1.61803398875,index)-1)/(Math.pow(1.61803398875,count)-1)):index/count;plan.position[coordinate]+=start+(end-start)*fraction-value;});
    }else if(['END','LENGTH'].includes(kind)){
      linear();parallel();
      const endpoints=mesh=>{const local=getLocalEndpoints(mesh.userData.part);return [mesh.localToWorld(new THREE.Vector3(...local.start)),mesh.localToWorld(new THREE.Vector3(...local.end))];};
      const reference=endpoints(anchor),sortedReference=[...reference].sort((a,b)=>a.dot(referenceDirection)-b.dot(referenceDirection));
      const low=sortedReference[0].dot(referenceDirection),high=sortedReference[1].dot(referenceDirection);
      for(const plan of plans){
        if(plan.mesh===anchor)continue;
        const ends=endpoints(plan.mesh),sorted=[...ends].sort((a,b)=>a.dot(referenceDirection)-b.dot(referenceDirection));
        if(kind==='END'){
          const end=options.end||'NEAREST';let delta;
          if(['START','END'].includes(end)){const index=end==='START'?0:1;delta=reference[index].clone().sub(ends[index]).dot(referenceDirection);}
          else if(end==='NEAREST'){const a=low-sorted[0].dot(referenceDirection),b=high-sorted[1].dot(referenceDirection);delta=Math.abs(a)<=Math.abs(b)?a:b;}
          else throw new Error('请选择 A 端或 B 端');
          plan.position.addScaledVector(referenceDirection,delta);
        }else{
          plan.length=high-low;plan.position.addScaledVector(referenceDirection,(low+high-sorted[0].dot(referenceDirection)-sorted[1].dot(referenceDirection))/2);
        }
      }
    }else if(kind==='PERPENDICULAR'){
      linear();if(meshes.length!==2)throw new Error('直角贴合请只选择两根型材');
      if(meshes.some(mesh=>mesh.userData.part.endCuts?.START?.angleDeg||mesh.userData.part.endCuts?.END?.angleDeg))throw new Error('斜切端面请用精确配合，不能按平直端面自动直角贴合');
      const face=options.targetFace||'FRONT',end=options.end||'START',percent=Number(options.stationPercent??50);
      if(!['FRONT','BACK','RIGHT','LEFT'].includes(face)||!['START','END'].includes(end)||!Number.isFinite(percent)||percent<0||percent>100)throw new Error('请选择接触面、A/B 端和 0–100% 的位置');
      const plan=plans.find(row=>row.mesh!==anchor),source=plan.mesh,normal=e.snapManager.faceNormal(anchor,face);
      plan.quaternion.copy(profileQuaternion(normal.clone().multiplyScalar(end==='START'?1:-1),referenceDirection));
      const virtual=new THREE.Group();virtual.userData.part=source.userData.part;virtual.quaternion.copy(plan.quaternion);
      const targetLength=Number(anchor.userData.part.dimensions.length),[w,h]=anchor.userData.part.dimensions.sectionSize;
      const local=new THREE.Vector3(face==='RIGHT'?w/2:face==='LEFT'?-w/2:0,face==='FRONT'?h/2:face==='BACK'?-h/2:0,(percent/100-.5)*targetLength);
      const endpoint=new THREE.Vector3(0,0,(end==='START'?-1:1)*Number(source.userData.part.dimensions.length)/2).applyQuaternion(plan.quaternion);
      virtual.position.copy(anchor.localToWorld(local)).sub(endpoint);virtual.updateMatrixWorld(true);
      // 共用完整端面投影的边界落位逻辑，不能只把中心点贴到立杆上。
      const snap=new SnapManager({meshes:[anchor]});
      const half=snap.endpointHalfSpans(virtual,anchor),tangent=['FRONT','BACK'].includes(face)?'x':'y',extent=tangent==='x'?w/2:h/2;
      if(half.z>targetLength/2+.1||half[tangent]>extent+.1)throw new Error('基准接触面容不下完整截面，请换接触面、截面或使用手动配合');
      const candidate=snap.collectFaceCandidates(virtual,snap.endpoints(virtual),50000).find(row=>row.snap.sourceEnd===end&&row.snap.targetFace===face);
      if(!candidate)throw new Error('无法确定直角端面贴合位置');
      plan.position.copy(virtual.position).add(candidate.delta);
    }else throw new Error('未知对齐命令');
    if(plans.some(plan=>plan.mesh!==anchor&&e.constraintManager.listForPart(plan.mesh.userData.part.id).some(c=>c.enabled&&!c.suppressed)))throw new Error('选择中有有效几何约束，请先解除约束再快速对齐');
    const changed=plans.filter(plan=>plan.position.distanceTo(plan.mesh.position)>1e-6||plan.quaternion.angleTo(plan.mesh.quaternion)>1e-6||(plan.length!==null&&Math.abs(plan.length-Number(plan.mesh.userData.part.dimensions.length))>1e-6));
    for(const plan of changed){
      const part=plan.mesh.userData.part;
      if(!e.isMeshTransformable(plan.mesh))throw new Error('需要移动的构件已锁定或已安装，请先解除；固定基准可以保持锁定');
      if(e.constraintManager.listForPart(part.id).some(c=>c.enabled&&!c.suppressed))throw new Error('选择中有有效几何约束，请先解除约束再快速对齐');
      if(e.assemblyManager?.get(part.assemblyId)?.parameters)throw new Error('参数化框架请使用框架尺寸入口；单独对齐会破坏重建参数');
      if(plan.length!==null&&Math.abs(plan.length-Number(part.dimensions.length))>1e-6&&((part.machiningItems||[]).length||(part.endCuts?.START?.angleDeg||part.endCuts?.END?.angleDeg)))throw new Error('已加工/斜切型材请通过长度属性编辑，避免改变加工基准');
    }
    return {kind,options:{...options},plans,changed,anchor};
  }
  preview(kind,options={}){
    this.clearPreview();
    const signature=JSON.stringify(this.editor.exportProject()),plan=this.plan(kind,options),ids=plan.plans.map(row=>row.mesh.userData.part.id);
    const group=new THREE.Group();group.name='__alignment_preview__';this.previewGroup=group;
    const items=[];
    for(const row of plan.changed){
      const part=structuredClone(row.mesh.userData.part),rotation=new THREE.Euler().setFromQuaternion(row.quaternion,'XYZ');
      part.position={x:row.position.x,y:row.position.y,z:row.position.z};part.rotation={x:rotation.x,y:rotation.y,z:rotation.z};
      if(row.length!==null){part.dimensions.length=row.length;part.profilePath={type:'LINE',length:row.length};}
      const ghost=part.type==='PROFILE'?ProfileGeometryFactory.create(part):PrimitiveGeometryFactory.create(part);
      ghost.position.copy(row.position);ghost.quaternion.copy(row.quaternion);ghost.updateMatrixWorld(true);
      const item={part,obb:profileObb(part),box:new THREE.Box3().setFromObject(ghost),ghost};items.push(item);group.add(ghost);
    }
    const movingIds=new Set(items.map(item=>item.part.id)),targets=this.editor.meshes.filter(mesh=>!movingIds.has(mesh.userData.part.id)&&mesh.visible!==false&&!mesh.userData.part.hidden).map(mesh=>({part:mesh.userData.part,obb:profileObb(mesh.userData.part),box:new THREE.Box3().setFromObject(mesh)}));
    const collisions=[];
    for(let index=0;index<items.length;index++)for(const target of [...targets,...items.slice(index+1)]){
      const item=items[index],feedback=this.editor.interferenceFeedbackManager;
      // 随动安装件在确认时由安装管理器刷新，不将宿主自己的配件当作静态障碍。
      if(movingIds.has(target.part.mountReference?.targetPartId)||feedback?.isIntentionalContact?.(item.part,target.part))continue;
      if(feedback?.classify?.(item,target)?.kind==='INTERFERENCE')collisions.push({partIds:[item.part.id,target.part.id],message:label(item.part)+' 与 '+label(target.part)+' 干涉'});
    }
    const red=new Set(collisions.flatMap(row=>row.partIds));
    for(const item of items)item.ghost.traverse(object=>{if(object.material)for(const material of [].concat(object.material)){material.color?.setHex(red.has(item.part.id)?0xe54848:0x36bdc8);material.transparent=true;material.opacity=.55;material.depthWrite=false;}});
    this.editor.sceneManager.scene.add(group);
    this.pending={...plan,signature,ids};
    return {ready:true,changedCount:plan.changed.length,reference:label(plan.anchor.userData.part),collisions:collisions.map(row=>row.message),rows:plan.changed.map(row=>({id:row.mesh.userData.part.id,label:label(row.mesh.userData.part),delta:row.position.clone().sub(row.mesh.position).toArray().map(round),length:row.length===null?null:round(row.length),rotated:row.quaternion.angleTo(row.mesh.quaternion)>1e-6})),message:plan.changed.length?'青色为目标位置，红色表示干涉；原构件保持不动':'当前已经对齐，不会新增撤销记录'};
  }
  confirm(){
    const pending=this.pending;if(!pending)throw new Error('请先预览对齐结果');
    if(JSON.stringify(this.editor.exportProject())!==pending.signature||this.editor.selectedMeshes.map(mesh=>mesh.userData.part.id).join('|')!==pending.ids.join('|')){this.clearPreview();throw new Error('构件或选择已变化，请重新预览');}
    const count=this.execute(pending.kind,pending.options);this.cancel();return count;
  }
  execute(kind,options='X'){
    const e=this.editor,plan=this.plan(kind,options);if(!plan.changed.length)return 0;
    const before=e.exportProject(),ids=plan.changed.map(row=>row.mesh.userData.part.id),selectedIds=plan.plans.map(row=>row.mesh.userData.part.id);
    try{
      for(const row of plan.changed){
        row.mesh.position.copy(row.position);row.mesh.quaternion.copy(row.quaternion);e.syncPartFromMesh(row.mesh);
        if(row.length!==null){const part=row.mesh.userData.part;part.dimensions.length=row.length;part.profilePath={type:'LINE',length:row.length};e.rebuildLinearProfileVisual(row.mesh);}
        delete row.mesh.userData.lastSnap;row.mesh.updateMatrixWorld(true);
      }
      e.snapManager?.clearLock?.();e.sceneManager.clearSnapPreview?.();e.sceneManager.hideSnapFeedback?.();
      e.connectionManager.updateConnectionsForProfiles(ids);e.accessoryMountManager.refreshForTargets(ids);
      e.interferenceFeedbackManager.refresh({focusIds:new Set(ids),live:false});e.sceneManager.setSelections(e.selectedMeshes,e.selected);
      e.updateDimensions();e.emitStats();e.historyManager.capture();e.emitProjectChanged();e.onSelectionChanged?.(e.selected,[...e.selectedMeshes]);
    }catch(error){e.restoreProject(before);e.selectMany(selectedIds.map(id=>e.getMeshByPartId(id)).filter(Boolean));throw error;}
    return plan.changed.length;
  }
  clearPreview(){if(this.previewGroup){this.editor.sceneManager.scene.remove(this.previewGroup);ProfileGeometryFactory.disposeObject(this.previewGroup);this.previewGroup=null;}this.pending=null;}
  cancel(){
    this.clearPreview();if(!this.active)return;this.active=false;
    const e=this.editor,s=e.sceneManager;if(s.transformControls){s.transformControls.enabled=true;if(e.isMeshTransformable(e.selected))s.transformControls.attach(e.selected);}
    e.profileGripEditor?.refresh(true);
  }
}
function label(part){return part.displayId||part.name||part.id;}
function round(value){return Number(value.toFixed(3));}
