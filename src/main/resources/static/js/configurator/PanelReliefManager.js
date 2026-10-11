import * as THREE from 'three';
import PrimitiveGeometryFactory from '../geometry/PrimitiveGeometryFactory.js';
import {panelMaterialContours,panelNotchRectangles} from '../model/PanelShapeModel.js';
import {connectionDesignType} from '../model/ComponentCatalog.js';
import {panelPose,panelObjectIntersection,panelObstacleFootprint} from '../geometry/PanelReliefGeometry.js';

/** 玩家板材避让：只读扫描 -> 可改缺口预览 -> fresh 检查 -> 一次历史。原板在确认前不变。 */
export default class PanelReliefManager {
  constructor(editor){this.editor=editor;this.active=false;this.previewGroup=null;this.pending=null;this.onChanged=null;}
  isActive(){return this.active;}

  begin(partId) {
    this.cancel();
    const mesh=this.editor.getMeshByPartId(partId),part=mesh?.userData.part;
    if(part?.type!=='PANEL'||(part.dimensions?.panelShape||'rectangle')!=='rectangle')throw new Error('连接件裁角目前支持矩形板材');
    if(!this.editor.isMeshTransformable(mesh))throw new Error('请先解锁板材或解除安装，再修改轮廓');
    if(part.machiningItems?.length)throw new Error('板材已有加工，请先处理加工，不能自动覆盖');
    this.active=true;this.partId=partId;this.originalMesh=mesh;this.originalVisible=mesh.visible;
    this.signature=JSON.stringify(this.editor.exportProject());
    this.transformEnabled=this.editor.sceneManager.transformControls.enabled;
    this.editor.sceneManager.transformControls.detach();this.editor.sceneManager.transformControls.enabled=false;
    this.editor.profileGripEditor.refresh(true);
    const gap=Number(part.panelSpec?.connectorRelief?.gapMm??1);
    this.emit({ready:false,error:'',gapMm:gap});
    return {gapMm:gap,notches:structuredClone(part.dimensions.edgeNotches||[])};
  }

  objects() {
    const e=this.editor,objects=[];
    for(const mesh of e.meshes){
      const part=mesh.userData.part;
      if(part.id===this.partId||part.hidden||!visible(mesh))continue;
      objects.push({mesh,label:part.displayId||part.name||'构件',
        connector:part.type==='ACCESSORY'&&(!!part.generatedByConnectionId||!!connectionDesignType(part))});
    }
    for(const c of e.connectionManager.connections){
      const helper=e.connectionManager.helperMeshes.get(c.id);
      if(!c.designComponent||c.manufacturingRuleId||!helper||!visible(helper))continue;
      objects.push({mesh:helper,label:(c.manufacturingCode||'连接件')+' '+(c.designComponent.label||''),connector:true});
    }
    return objects;
  }

  /** 矩形缺口包住实体在板厚范围内的投影；中央障碍不自动挖孔或切断整块板。 */
  scan(gapMm) {
    const part=this.part(),gap=validGap(gapMm),base=structuredClone(part);
    delete base.dimensions.edgeNotches;
    const box=panelBox(base),notches=[],skipped=[];
    for(const item of this.objects()){
      if(!item.connector||!box.intersectsBox(new THREE.Box3().setFromObject(item.mesh)))continue;
      const relation=panelObjectIntersection(base,item.mesh,0);
      if(!relation?.intersects)continue;
      const footprint=panelObstacleFootprint(base,item.mesh);
      const notch=footprint&&notchForFootprint(base,footprint,gap);
      if(notch)notches.push(notch);else skipped.push(item.label);
    }
    const merged=mergeNotches(notches);
    this.preview(merged,gap,{skipped});
    return {gapMm:gap,notches:merged,skipped};
  }

  part() {
    const part=this.editor.parts.find(p=>p.id===this.partId);
    if(!this.active||!part)throw new Error('板材避让已取消或板材不存在');
    return part;
  }

  plan(notches,gapMm) {
    const part=this.part(),draft=structuredClone(part),gap=validGap(gapMm);
    const values=notches.map(n=>({edge:String(n.edge),anchor:String(n.anchor||'START'),
      offsetMm:Number(n.offsetMm),widthMm:Number(n.widthMm),depthMm:Number(n.depthMm)}));
    draft.dimensions.edgeNotches=values;
    panelMaterialContours(draft);
    const box=panelBox(draft),blockers=[];
    for(const item of this.objects()){
      if(!box.intersectsBox(new THREE.Box3().setFromObject(item.mesh)))continue;
      const relation=panelObjectIntersection(draft,item.mesh,Number(this.editor.projectSettings?.collisionToleranceMm??.5));
      if(relation?.intersects||!relation)blockers.push(item.label);
    }
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
      this.emit({ready:!plan.blockers.length,error:message,notchCount:notches.length,
        note:options.skipped?.length?'中部障碍不能自动裁角；请调整板材或连接件位置':'黄色为裁剪后的预览，确认前原板不变'});
      return plan;
    }catch(error){this.pending=null;this.emit({ready:false,error:error.message});this.editor.interferenceFeedbackManager.requestRefresh();throw error;}
  }

  confirm() {
    if(!this.pending)throw new Error('请先预览板材缺口');
    if(JSON.stringify(this.editor.exportProject())!==this.pending.signature)throw new Error('工程已改变，请重新预览板材避让');
    const plan=this.plan(this.pending.notches,this.pending.gapMm);
    if(plan.blockers.length)throw new Error('仍与 '+plan.blockers[0]+' 相交，不能确认裁剪');
    const e=this.editor,before=e.exportProject(),partId=this.partId;
    const historyStates=[...e.historyManager.states],historyIndex=e.historyManager.index;
    this.cancel();
    try{
      const part=e.parts.find(p=>p.id===partId);
      if(plan.notches.length)part.dimensions.edgeNotches=structuredClone(plan.notches);else delete part.dimensions.edgeNotches;
      part.panelSpec={...part.panelSpec,connectorRelief:{gapMm:plan.gapMm}};
      e.rebuildPartMesh(partId);e.accessoryMountManager.refreshForTargets([partId]);
      e.interferenceFeedbackManager.refresh({live:false});e.historyManager.capture();e.emitProjectChanged();
      return {part,notchCount:plan.notches.length};
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
    this.active=false;this.emit({active:false,ready:false,error:''});
    const e=this.editor;e.sceneManager.transformControls.enabled=this.transformEnabled;
    if(e.isSelectionTransformable())e.sceneManager.transformControls.attach(e.selected);
    e.profileGripEditor.refresh(true);e.interferenceFeedbackManager.requestRefresh();
    this.originalMesh=null;
  }
  emit(state){this.onChanged?.({active:this.active,partId:this.partId,...state});}
}

function validGap(value){const gap=Number(value);if(!Number.isFinite(gap)||gap<0||gap>20)throw new Error('避让间隙应为0至20mm');return gap;}
function visible(mesh){for(let node=mesh;node;node=node.parent)if(node.visible===false)return false;return true;}
function panelBox(part){
  const d=part.dimensions,matrix=panelPose(part),points=[];
  for(const x of [-d.width/2,d.width/2])for(const y of [-d.height/2,d.height/2])for(const z of [-d.thickness/2,d.thickness/2])points.push(new THREE.Vector3(x,y,z).applyMatrix4(matrix));
  return new THREE.Box3().setFromPoints(points);
}
function notchForFootprint(part,footprint,gap) {
  const w=Number(part.dimensions.width),h=Number(part.dimensions.height);
  const r={minX:Math.max(-w/2,footprint.minX-gap),maxX:Math.min(w/2,footprint.maxX+gap),
    minY:Math.max(-h/2,footprint.minY-gap),maxY:Math.min(h/2,footprint.maxY+gap)};
  const sides=[['LEFT',r.minX+w/2],['RIGHT',w/2-r.maxX],['BOTTOM',r.minY+h/2],['TOP',h/2-r.maxY]].sort((a,b)=>a[1]-b[1]);
  if(sides[0][1]>Math.max(2,gap))return null;
  const edge=sides[0][0],vertical=['LEFT','RIGHT'].includes(edge),length=vertical?h:w;
  const start=(vertical?r.minY:r.minX)+length/2,end=(vertical?r.maxY:r.maxX)+length/2;
  const anchor=start<=length-end?'START':'END',offset=anchor==='START'?start:length-end;
  const depth={LEFT:r.maxX+w/2,RIGHT:w/2-r.minX,BOTTOM:r.maxY+h/2,TOP:h/2-r.minY}[edge];
  if(end-start<.00001||depth<.00001)return null;
  const offsetMm=Math.floor(Math.max(0,offset)*10)/10;
  const endMm=Math.min(length,Math.ceil((offset+end-start)*10)/10);
  return {edge,anchor,offsetMm,widthMm:Number((endMm-offsetMm).toFixed(6)),depthMm:Math.ceil(depth*10)/10};
}
function mergeNotches(notches) {
  const result=[];
  for(const notch of notches){
    const existing=result.find(n=>n.edge===notch.edge&&n.anchor===notch.anchor&&n.offsetMm<=notch.offsetMm+notch.widthMm+.01&&notch.offsetMm<=n.offsetMm+n.widthMm+.01);
    if(!existing){result.push({...notch});continue;}
    const end=Math.max(existing.offsetMm+existing.widthMm,notch.offsetMm+notch.widthMm);
    existing.offsetMm=Math.min(existing.offsetMm,notch.offsetMm);existing.widthMm=end-existing.offsetMm;existing.depthMm=Math.max(existing.depthMm,notch.depthMm);
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
