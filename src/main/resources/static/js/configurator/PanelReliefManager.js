import * as THREE from 'three';
import PrimitiveGeometryFactory from '../geometry/PrimitiveGeometryFactory.js';
import {panelMaterialContours,panelNotchRectangles} from '../model/PanelShapeModel.js';
import {connectionDesignType} from '../model/ComponentCatalog.js';
import {panelPose,panelObjectIntersection,panelObstacleFootprint} from '../geometry/PanelReliefGeometry.js';
import {contourBounds,expandContour,clipContourToRectangle} from '../model/PanelContourMath.js';
import {assertPanelSlotEngagement} from './PanelSlotPlacement.js';

/** 玩家板材避让：只读扫描 -> 可改缺口预览 -> fresh 检查 -> 一次历史。原板在确认前不变。 */
export default class PanelReliefManager {
  constructor(editor){this.editor=editor;this.active=false;this.previewGroup=null;this.pending=null;this.onChanged=null;}
  isActive(){return this.active;}

  begin(partId,options={}) {
    this.cancel();
    const mesh=this.editor.getMeshByPartId(partId),part=mesh?.userData.part;
    if(part?.type!=='PANEL'||(part.dimensions?.panelShape||'rectangle')!=='rectangle')throw new Error('连接件裁角目前支持矩形板材');
    if(!this.editor.isMeshTransformable(mesh))throw new Error('请先解锁板材或解除安装，再修改轮廓');
    const scale=mesh.getWorldScale(new THREE.Vector3());
    if([scale.x,scale.y,scale.z].some(value=>Math.abs(value-1)>1e-7))throw new Error('请使用板材实际宽高厚度；缩放板材不能按原尺寸自动裁角');
    if(part.machiningItems?.length)throw new Error('板材已有加工，请先处理加工，不能自动覆盖');
    const adaptation=options.fitSlots===true;
    // 先规划成功才占用工具；这一步只创建领域副本，不改已有板材。
    const slotPlan=adaptation?this.editor.panelDoorConfigurator.planSlotRefit(partId):null;
    this.active=true;this.partId=partId;this.originalMesh=mesh;this.originalVisible=mesh.visible;
    this.adaptation=adaptation;this.baseDraft=slotPlan?.draft||null;
    this.signature=JSON.stringify(this.editor.exportProject());
    this.transformEnabled=this.editor.sceneManager.transformControls.enabled;
    this.editor.sceneManager.transformControls.detach();this.editor.sceneManager.transformControls.enabled=false;
    this.editor.profileGripEditor.refresh(true);
    const gap=Number(part.panelSpec?.connectorRelief?.gapMm??1);
    this.emit({ready:false,error:'',gapMm:gap,note:'',adaptation,dimensions:slotPlan?{...slotPlan.draft.dimensions}:null});
    return {gapMm:gap,notches:structuredClone((this.baseDraft||part).dimensions.edgeNotches||[])};
  }

  objects() {
    return panelReliefObjects(this.editor,this.partId);
  }

  /** 按板厚范围内的真实外轮廓与间隙裁边；不把斜边变方框，中央障碍仍不自动挖孔。 */
  scan(gapMm) {
    const part=this.baseDraft||this.part(),gap=validGap(gapMm);
    const opening=part.panelSpec?.placement==='T_SLOT'?this.editor.panelDoorConfigurator.resolveSavedPanelOpening(part):null;
    const {notches,skipped}=scanPanelConnectorRelief(part,this.objects(),gap,{cornerPartIds:opening?.cornerPartIds});
    this.preview(notches,gap,{skipped});
    return {gapMm:gap,notches,skipped};
  }

  part() {
    const part=this.editor.parts.find(p=>p.id===this.partId);
    if(!this.active||!part)throw new Error('板材避让已取消或板材不存在');
    return part;
  }

  plan(notches,gapMm) {
    const part=this.part(),slotPlan=this.adaptation?this.editor.panelDoorConfigurator.planSlotRefit(part.id):null;
    const draft=structuredClone(slotPlan?.draft||part),gap=validGap(gapMm);
    const values=notches.map(n=>({edge:String(n.edge),anchor:String(n.anchor||'START'),
      offsetMm:Number(n.offsetMm),widthMm:Number(n.widthMm),depthMm:Number(n.depthMm),
      ...(n.outline==null?{}:{outline:n.outline.map(p=>({u:Number(p.u),v:Number(p.v)}))})}));
    draft.dimensions.edgeNotches=values;
    panelMaterialContours(draft);
    const slotOpening=slotPlan?.opening||(draft.panelSpec?.placement==='T_SLOT'?this.editor.panelDoorConfigurator.resolveSavedPanelOpening(draft):null);
    if(slotOpening)assertPanelSlotEngagement(draft,slotOpening);
    const blockers=panelReliefBlockers(draft,this.objects(),slotOpening?.panelPlacement==='T_SLOT' ? .001 : Number(this.editor.projectSettings?.collisionToleranceMm??.5));
    return {draft,gapMm:gap,notches:values,blockers,signature:this.signature};
  }

  preview(notches,gapMm,options={}) {
    this.clearPreview();
    try{
      if(JSON.stringify(this.editor.exportProject())!==this.signature)throw new Error('工程已改变，请重新打开板材避让');
      const plan=this.plan(notches,gapMm),ghost=PrimitiveGeometryFactory.create(plan.draft);
      ghost.applyMatrix4(panelPose(plan.draft));ghost.name='__panel_relief_preview__';
      ghost.traverse(child=>{
        if(!child.isMesh)return;
        for(const m of [].concat(child.material||[])){m.color.set(plan.blockers.length?0xe36d66:0xffba4a);m.transparent=true;m.opacity=.72;m.depthWrite=false;}
      });
      this.previewGroup=ghost;this.editor.sceneManager.scene.add(ghost);
      this.originalMesh.visible=false;
      this.editor.sceneManager.setSelections([],null);
      this.editor.interferenceFeedbackManager.clear();
      this.pending=plan;
      const message=plan.blockers.length?'仍与 '+plan.blockers[0]+' 相交，请调整缺口或板材位置':'';
      this.emit({ready:!plan.blockers.length,error:message,notchCount:notches.length,dimensions:this.adaptation?{...plan.draft.dimensions}:null,
        note:options.skipped?.length?'中部障碍不能自动裁角；请调整板材或连接件位置':this.adaptation?'黄色为四边插槽与轮廓裁角预览；确认后一起更新宽高和位置，取消保留原板':'黄色为裁剪后的预览，确认前原板不变'});
      return plan;
    }catch(error){this.pending=null;this.emit({ready:false,error:error.message});this.editor.interferenceFeedbackManager.requestRefresh();throw error;}
  }

  confirm() {
    if(!this.pending)throw new Error('请先预览板材缺口');
    if(JSON.stringify(this.editor.exportProject())!==this.pending.signature)throw new Error('工程已改变，请重新预览板材避让');
    const plan=this.plan(this.pending.notches,this.pending.gapMm);
    if(this.adaptation&&JSON.stringify([plan.draft.dimensions,plan.draft.position,plan.draft.rotation,plan.draft.panelSpec])!==JSON.stringify([this.pending.draft.dimensions,this.pending.draft.position,this.pending.draft.rotation,this.pending.draft.panelSpec]))throw new Error('实际槽口或适配尺寸已改变，请更新预览后再确认');
    if(plan.blockers.length)throw new Error('仍与 '+plan.blockers[0]+' 相交，不能确认裁剪');
    const e=this.editor,before=e.exportProject(),partId=this.partId,adaptation=this.adaptation;
    const historyStates=[...e.historyManager.states],historyIndex=e.historyManager.index;
    this.cancel();
    try{
      const part=e.parts.find(p=>p.id===partId);
      if(adaptation){
        Object.assign(part,{dimensions:structuredClone(plan.draft.dimensions),position:{...plan.draft.position},rotation:{...plan.draft.rotation},panelSpec:structuredClone(plan.draft.panelSpec)});
        // rebuildPartMesh 会先从旧 root 同步姿态；须同步 root，不能让旧梁顶位置覆盖新槽口位置。
        const mesh=e.getMeshByPartId(partId),p=part.position,r=part.rotation;
        mesh.position.set(p.x,p.y,p.z);mesh.rotation.set(r.x,r.y,r.z);mesh.updateMatrixWorld(true);
      }
      if(plan.notches.length)part.dimensions.edgeNotches=structuredClone(plan.notches);else delete part.dimensions.edgeNotches;
      part.panelSpec={...part.panelSpec,connectorRelief:{gapMm:plan.gapMm}};
      e.rebuildPartMesh(partId);e.accessoryMountManager.refreshForTargets([partId]);
      e.interferenceFeedbackManager.refresh({live:false});e.historyManager.capture();e.emitProjectChanged();
      return {part,notchCount:plan.notches.length,adapted:adaptation};
    }catch(error){
      e.historyManager.states=historyStates;e.historyManager.index=historyIndex;e.restoreProject(before);
      e.select(e.getMeshByPartId(partId));throw error;
    }
  }

  clearPreview() {
    if(this.previewGroup){this.previewGroup.removeFromParent();PrimitiveGeometryFactory.dispose(this.previewGroup);this.previewGroup=null;}
    if(this.originalMesh&&this.editor.getMeshByPartId(this.partId)===this.originalMesh)this.originalMesh.visible=this.originalVisible;
    if(this.active)this.editor.sceneManager.setSelections(this.editor.selectedMeshes,this.editor.selected);
    this.pending=null;
  }
  cancel() {
    this.clearPreview();if(!this.active)return;
    this.active=false;this.emit({active:false,ready:false,error:'',adaptation:false,dimensions:null});
    const e=this.editor;e.sceneManager.transformControls.enabled=this.transformEnabled;
    if(e.isSelectionTransformable())e.sceneManager.transformControls.attach(e.selected);
    e.profileGripEditor.refresh(true);e.interferenceFeedbackManager.requestRefresh();
    this.originalMesh=null;this.baseDraft=null;this.adaptation=false;
  }
  emit(state){this.onChanged?.({active:this.active,partId:this.partId,...state});}
}

/** 创建、旧板预览及 fresh 提交共用真实对象清单；不把预览网格或板材自身当障碍。 */
export function panelReliefObjects(editor,excludedPartId=null){
  const objects=[];
  for(const mesh of editor.meshes){
    const part=mesh.userData.part;
    if(part.id===excludedPartId||part.hidden||!visible(mesh))continue;
    objects.push({mesh,label:part.displayId||part.name||'构件',connector:part.type==='ACCESSORY'&&(!!part.generatedByConnectionId||!!connectionDesignType(part))});
  }
  for(const c of editor.connectionManager.connections){
    const helper=editor.connectionManager.helperMeshes.get(c.id);
    if(!c.designComponent||c.manufacturingRuleId||!helper||!visible(helper))continue;
    objects.push({mesh:helper,label:(c.manufacturingCode||'连接件')+' '+(c.designComponent.label||''),connector:true});
  }
  return objects;
}

export function scanPanelConnectorRelief(part,objects,gapMm,options={}){
  const gap=validGap(gapMm),base=structuredClone(part);delete base.dimensions.edgeNotches;
  const box=panelBox(base),notches=[],skipped=[];
  for(const item of objects){
    const cornerPost=options.cornerPartIds?.includes(item.mesh.userData.part?.id);
    if((!item.connector&&!cornerPost)||!box.intersectsBox(new THREE.Box3().setFromObject(item.mesh)))continue;
    if(!panelObjectIntersection(base,item.mesh,0)?.intersects)continue;
    const footprint=panelObstacleFootprint(base,item.mesh),cuts=footprint?notchesForFootprint(base,footprint,gap):[];
    // cornerPartIds 只含同时贴合两条外边的垂直柱；内部柱/整条承托梁永不进入自动裁角清单。
    if(cuts.length)notches.push(...cuts);else skipped.push(item.label);
  }
  return {gapMm:gap,notches,skipped};
}

export function panelReliefBlockers(part,objects,tolerance=.5){
  const box=panelBox(part),blockers=[];
  for(const item of objects){
    if(!box.intersectsBox(new THREE.Box3().setFromObject(item.mesh)))continue;
    const relation=panelObjectIntersection(part,item.mesh,tolerance);
    if(!relation||relation.intersects)blockers.push(item.label);
  }
  return blockers;
}

function validGap(value){const gap=Number(value);if(!Number.isFinite(gap)||gap<0||gap>20)throw new Error('避让间隙应为0至20mm');return gap;}
function visible(mesh){for(let node=mesh;node;node=node.parent)if(node.visible===false)return false;return true;}
function panelBox(part){
  const d=part.dimensions,matrix=panelPose(part),points=[];
  for(const x of [-d.width/2,d.width/2])for(const y of [-d.height/2,d.height/2])for(const z of [-d.thickness/2,d.thickness/2])points.push(new THREE.Vector3(x,y,z).applyMatrix4(matrix));
  return new THREE.Box3().setFromPoints(points);
}
function notchesForFootprint(part,footprint,gap) {
  const w=Number(part.dimensions.width),h=Number(part.dimensions.height);
  const result=[],expanded=footprint.outlines.flatMap(ring=>expandContour(ring,gap));
  for(const ring of expanded.flatMap(r=>clipContourToRectangle(r,w/2,h/2))){
    const r=contourBounds(ring);
    const sides=[['LEFT',r.minX+w/2],['RIGHT',w/2-r.maxX],['BOTTOM',r.minY+h/2],['TOP',h/2-r.maxY]].sort((a,b)=>a[1]-b[1]);
    const edge=sides[0][0],vertical=['LEFT','RIGHT'].includes(edge),span=vertical?h:w;
    if(sides[0][1]>.00001)continue;
    const along=p=>vertical?p.y:p.x,depth=p=>({LEFT:p.x+w/2,RIGHT:w/2-p.x,BOTTOM:p.y+h/2,TOP:h/2-p.y}[edge]);
    if(!ring.some((p,i)=>depth(p)<.00001&&depth(ring[(i+1)%ring.length])<.00001&&Math.abs(along(p)-along(ring[(i+1)%ring.length]))>.00001))continue;
    const start=(vertical?r.minY:r.minX)+span/2,end=(vertical?r.maxY:r.maxX)+span/2;
    const anchor=start<=span-end?'START':'END',offset=anchor==='START'?start:span-end;
    const offsetMm=Math.floor(Math.max(0,offset)*10)/10,endMm=Math.min(span,Math.ceil((offset+end-start)*10)/10);
    const outline=ring.map(p=>({u:Math.max(0,(anchor==='START'?along(p)+span/2:span/2-along(p))-offsetMm),v:Math.max(0,depth(p))}));
    result.push({edge,anchor,offsetMm,widthMm:endMm-offsetMm,depthMm:Math.ceil(Math.max(...outline.map(p=>p.v))*10)/10,outline});
  }
  return result;
}

/** 缺口名称仅用于表单，位置方向仍以板材局部坐标保存。 */
export function panelNotchLabel(part,notch) {
  if(!part)return '缺口';
  const r=panelNotchRectangles(part,[notch])[0],w=part.dimensions.width/2,h=part.dimensions.height/2;
  const left=Math.abs(r.minX+w)<.01,right=Math.abs(r.maxX-w)<.01,bottom=Math.abs(r.minY+h)<.01,top=Math.abs(r.maxY-h)<.01;
  if((left||right)&&(bottom||top))return (left?'左':'右')+(bottom?'下':'上')+'裁角';
  return ({LEFT:'左边',RIGHT:'右边',TOP:'上边',BOTTOM:'下边'})[notch.edge]+'缺口';
}
