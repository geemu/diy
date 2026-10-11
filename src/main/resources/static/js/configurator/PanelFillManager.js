import * as THREE from 'three';
import PrimitiveGeometryFactory from '../geometry/PrimitiveGeometryFactory.js';
import {panelPose,panelObjectIntersection} from '../geometry/PanelReliefGeometry.js';

/** 新框口填板：只读分格/裁角预览 -> fresh 重算 -> 整批一次提交。幽灵板不进入工程或拾取清单。 */
export default class PanelFillManager {
  constructor(editor){this.editor=editor;this.active=false;this.previewGroup=null;this.pending=null;this.onChanged=null;}
  isActive(){return this.active;}

  begin(options={}){
    this.cancel();
    const e=this.editor;
    this.sourcePartIds=[...new Set(options.sourcePartIds||e.panelDoorConfigurator.openingResolver.selectedProfileIds())];
    if(this.sourcePartIds.length<4||this.sourcePartIds.length>64)throw new Error('请选择当前框面的四条边，可连同中间分隔梁一起选');
    this.signature=JSON.stringify(e.exportProject());this.active=true;this.focusIndex=-1;
    this.transformEnabled=e.sceneManager.transformControls.enabled;
    e.sceneManager.transformControls.detach();e.sceneManager.transformControls.enabled=false;
    e.profileGripEditor.refresh(true);
    this.emit({ready:false,error:'',note:'先按实际框口计算分格与裁角；预览不修改工程。',rows:[],panelCount:0,focusIndex:-1});
    this.preview(options);
  }

  preview(options={}){
    this.clearPreview();this.focusIndex=-1;
    if(!this.active)throw new Error('填板预览已取消，请重新选择框口');
    try{
      if(JSON.stringify(this.editor.exportProject())!==this.signature)throw new Error('工程已改变，请取消后重新选择框口');
      const effective={...options,sourcePartIds:[...this.sourcePartIds]},plans=this.editor.panelDoorConfigurator.planPanelsFromSelection(effective);
      const group=new THREE.Group();group.name='__panel_fill_preview__';this.previewGroup=group;
      const meshes=plans.map((plan,index)=>{
        const ghost=PrimitiveGeometryFactory.create(plan.draft);ghost.applyMatrix4(panelPose(plan.draft));
        ghost.name='__panel_fill_cell_'+index;group.add(ghost);return ghost;
      });
      group.updateMatrixWorld(true);
      // 同批板也必须互不穿透；预览错误只变红，不往工程放入一部分“成功板”。
      for(let i=0;i<plans.length;i++)for(let j=i+1;j<plans.length;j++){
        const a=new THREE.Box3().setFromObject(meshes[i]),b=new THREE.Box3().setFromObject(meshes[j]);
        if(!a.intersectsBox(b))continue;
        if(panelObjectIntersection(plans[i].draft,meshes[j],.001)?.intersects){
          plans[i].errors.push('与第 '+(j+1)+' 块板相交');plans[j].errors.push('与第 '+(i+1)+' 块板相交');
        }
      }
      this.pending={plans,options:effective,signature:this.signature};
      this.editor.sceneManager.scene.add(group);this.editor.interferenceFeedbackManager.clear();this.tint();
      const invalid=plans.filter(p=>p.errors.length);
      const rows=plans.map((p,index)=>({index,width:p.draft.dimensions.width,height:p.draft.dimensions.height,
        notchCount:p.draft.dimensions.edgeNotches?.length||0,ready:!p.errors.length,error:p.errors.join('；'),sourceDisplayIds:p.opening.sourceDisplayIds}));
      this.emit({ready:plans.length>0&&!invalid.length,error:invalid.length?invalid.length+' 块尚不能适配；请查看下方每块原因':'',
        rows,panelCount:plans.length,focusIndex:this.focusIndex,note:'黄色为可适配板，红色为冲突或未适配框口示意；确认前不创建板材。点击下方一块可突出对应预览。'});
      return this.pending;
    }catch(error){this.clearPreview();this.emit({ready:false,error:error.message,rows:[],panelCount:0,focusIndex:-1});return null;}
  }

  focus(index){this.focusIndex=Number(index);this.tint();this.emit({focusIndex:this.focusIndex});}
  tint(){
    this.previewGroup?.children.forEach((ghost,index)=>ghost.traverse(child=>{
      if(!child.isMesh)return;
      for(const material of [].concat(child.material||[])){
        material.color.set(this.pending?.plans[index]?.errors.length?0xe36d66:0xffba4a);
        material.transparent=true;material.opacity=(this.focusIndex<0||this.focusIndex===index)? .72 : .25;
        material.depthWrite=false;
      }
    }));
  }

  invalidate(){this.clearPreview();this.focusIndex=-1;this.emit({ready:false,error:'参数已改变，请更新分格和裁角预览',rows:[],panelCount:0,focusIndex:-1});}

  confirm(){
    const e=this.editor,plan=this.pending;
    if(!this.active||!plan||plan.plans.some(p=>p.errors.length))throw new Error('请先得到全部可适配的板材预览，再确认');
    if(JSON.stringify(e.exportProject())!==plan.signature)throw new Error('工程已改变，请取消后重新选择框口');
    const fresh=e.panelDoorConfigurator.planPanelsFromSelection(plan.options);
    if(fresh.some(p=>p.errors.length))throw new Error('实际框口或连接件已改变，请更新预览后再确认');
    const identity=plans=>JSON.stringify(plans.map(p=>[p.draft,p.opening.sourcePartIds]));
    if(identity(fresh)!==identity(plan.plans))throw new Error('实际槽位、板材尺寸或裁剪轮廓已改变，请更新预览后再确认');
    this.cancel();
    return e.panelDoorConfigurator.commitPanelPlans(fresh,plan.options);
  }

  clearPreview(){
    if(this.previewGroup){this.previewGroup.removeFromParent();PrimitiveGeometryFactory.dispose(this.previewGroup);this.previewGroup=null;}
    this.pending=null;
  }
  cancel(){
    this.clearPreview();if(!this.active)return;
    this.active=false;this.emit({active:false,ready:false,error:'',rows:[],panelCount:0,focusIndex:-1});
    const e=this.editor;e.sceneManager.transformControls.enabled=this.transformEnabled;
    if(e.isSelectionTransformable())e.sceneManager.transformControls.attach(e.selected);
    e.profileGripEditor.refresh(true);e.interferenceFeedbackManager.requestRefresh();
  }
  emit(state){this.onChanged?.({active:this.active,...state});}
}
