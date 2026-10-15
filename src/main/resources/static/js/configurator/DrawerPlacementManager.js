import * as THREE from 'three';
import PrimitiveGeometryFactory from '../geometry/PrimitiveGeometryFactory.js';
import {resolveDrawerOpening} from './DrawerOpeningPlacement.js';
import {drawerSelectionCells,planDrawerSelection} from './DrawerSelectionPlanner.js';

/** 抽屉框口定位：临时幽灵预览 -> fresh同源复算 -> 原Editor整组事务。 */
export default class DrawerPlacementManager {
  constructor(editor) { this.editor=editor;this.active=false;this.previewGroup=null;this.pending=null;this.focusIndex=-1;this.onChanged=null; }
  isActive() { return this.active; }

  selectedIds() {
    const ids=this.editor.panelDoorConfigurator.openingResolver.selectedProfileIds();
    if(ids.length<4||ids.length>64)throw new Error('请选择完整外框，可连同中间梁、多层框口一起选（4～64根型材）');
    return ids;
  }

  suggest(options={}) {
    if (!this.active) this.editor.assertCanAddDrawerGroup();
    else this.assertCurrent();
    const selection=drawerSelectionCells(this.editor,this.active?this.sourcePartIds:this.selectedIds(),options);
    return selection.cells.map(cell=>resolveDrawerOpening(this.editor,cell.opening.boundaryPartIds,options,cell.opening).available);
  }

  begin(options={}) {
    this.editor.assertCanAddDrawerGroup();
    const ids = this.selectedIds();
    drawerSelectionCells(this.editor,ids,options);
    this.sourcePartIds=ids;this.signature=JSON.stringify(this.editor.exportProject());this.active=true;
    const e=this.editor;
    this.transformEnabled=e.sceneManager.transformControls.enabled;
    e.sceneManager.transformControls.detach();e.sceneManager.transformControls.enabled=false;e.profileGripEditor.refresh(true);
    return this.preview(options);
  }

  preview(options={}) {
    this.clearPreview();this.focusIndex=-1;
    if (!this.active) throw new Error('抽屉预览已取消，请重新选择框口');
    try {
      this.assertCurrent();
      const batch=planDrawerSelection(this.editor,this.sourcePartIds,options),group=new THREE.Group(),owners=new Map(),allMeshes=[];
      group.name='__drawer_opening_preview__';this.previewGroup=group;
      const addConflict=conflict=>{
        if(!conflict)return;
        const other=conflict.other.displayId||conflict.other.name||'现有构件';
        const check=conflict.relation.materialChecked?'板材材料检查':'安装包络检查';
        const message=`${conflict.part.name} 与 ${other} 冲突（${check}）；整批不会生成`;
        owners.get(conflict.part.id)?.errors.push(message);owners.get(conflict.other.id)?.errors.push(message);
      };
      for(const plan of batch.plans) {
        const child=new THREE.Group();child.userData.planIndex=plan.index;group.add(child);
        const members=plan.layout?.members||[{type:'PANEL',name:'未适配框口示意',dimensions:{width:plan.sourceOpening.width,height:plan.sourceOpening.height,thickness:1},position:plan.sourceOpening.center,rotation:plan.sourceOpening.rotation}];
        const meshes=members.map(member=>{
          const part={...member,id:crypto.randomUUID(),hidden:false,locked:false};
          const mesh=this.editor.createPartMesh(part);child.add(mesh);owners.set(part.id,plan);return mesh;
        });
        child.updateMatrixWorld(true);
        if(plan.layout) {addConflict(this.editor.interferenceFeedbackManager.findInsertionInterference(meshes));allMeshes.push(...meshes);}
      }
      group.updateMatrixWorld(true);
      // 单框口检查后，再查尚无错误的各框口之间；有错误的一格不能阻止其它格的预览。
      addConflict(this.editor.interferenceFeedbackManager.findInsertionInterference(allMeshes.filter(mesh=>!owners.get(mesh.userData.part.id).errors.length)));
      for(const plan of batch.plans)plan.errors=[...new Set(plan.errors)];
      this.pending={...batch,options:structuredClone(options)};this.tint();
      this.editor.sceneManager.scene.add(group);this.editor.interferenceFeedbackManager.clear();
      const rows=batch.plans.map(plan=>({index:plan.index,label:plan.label,ready:!!plan.layout&&!plan.errors.length,error:plan.errors.join('；'),
        width:plan.layout?.parameters.width??plan.sourceOpening.width,height:plan.layout?.parameters.height??plan.sourceOpening.height,
        depth:plan.layout?.parameters.depth??null,count:plan.layout?.parameters.count||0,dividerCount:plan.dividerCount||0,
        reusedCount:plan.reusedPartIds?.length||0,notchCount:plan.notchCount||0,sourceDisplayIds:plan.sourceOpening.sourceDisplayIds}));
      const invalid=rows.filter(row=>!row.ready).length;
      this.emit({ready:rows.length>0&&!invalid,error:invalid?`${invalid} 个框口尚未适配，请查看各框口原因`:'',rows,frameCount:rows.length,count:batch.count,dividerCount:batch.dividerCount,focusIndex:-1,
        note:'与板材共用真实框口分格和连接件轮廓避让；每个框口按上下层数×左右排数生成。黄色为可适配预览，红色为错误示意。确认前工程不变。'
          +(batch.unusedPartIds.length?` 另有 ${batch.unusedPartIds.length} 根所选型材不属于当前朝向正面的四边，仅作为其他方向/内部构件参与检查。`:'')});
      return this.pending;
    } catch (error) {
      this.clearPreview();this.emit({ready:false,error:error.message,rows:[],frameCount:0,count:0,dividerCount:0,focusIndex:-1,note:'请调整左侧参数后更新预览，或取消并重新选择框架区域。'});return null;
    }
  }

  assertCurrent() {
    if (JSON.stringify(this.editor.exportProject()) !== this.signature) throw new Error('工程已改变，请取消后重新选择抽屉框口');
  }

  invalidate() {
    if (!this.active) return;
    this.clearPreview();this.focusIndex=-1;this.emit({ready:false,error:'参数已改变，请更新抽屉安装预览',rows:[],frameCount:0,count:0,dividerCount:0,focusIndex:-1});
  }

  confirm() {
    const plan=this.pending;
    if (!this.active || !plan || plan.plans.some(value=>!value.layout||value.errors.length)) throw new Error('请先得到全部框口可适配且无干涉的抽屉预览，再确认');
    this.assertCurrent();
    const fresh=planDrawerSelection(this.editor,this.sourcePartIds,plan.options);
    const identity=batch=>JSON.stringify(batch.plans.map(value=>[value.opening,value.sourceOpening,value.layout,value.reusedPartIds]));
    if (fresh.plans.some(value=>value.errors.length) || identity(fresh)!==identity(plan)) {
      this.invalidate();throw new Error('实际框口、安装位置或抽屉尺寸已改变，请更新预览');
    }
    // 先撤临时层再提交；Editor还会重新做全部材料/包络检查，不能用预览替代最终守卫。
    this.cancel();
    return this.editor.commitDrawerPlans(fresh.plans,plan.options);
  }

  focus(index) {this.focusIndex=Number(index);this.tint();this.emit({focusIndex:this.focusIndex});}
  tint() {
    this.previewGroup?.children.forEach((group,index)=>group.traverse(child=>{
      if(!child.isMesh)return;
      for(const material of [].concat(child.material||[])) {
        material.color.set(this.pending?.plans[index]?.errors.length?0xe36d66:0xffba4a);
        material.transparent=true;material.opacity=(this.focusIndex<0||this.focusIndex===index) ? .6 : .2;material.depthWrite=false;
      }
    }));
  }

  clearPreview() {
    if (this.previewGroup) { this.previewGroup.removeFromParent();PrimitiveGeometryFactory.dispose(this.previewGroup);this.previewGroup=null; }
    this.pending=null;
  }

  cancel() {
    this.clearPreview();
    const wasActive=this.active;this.active=false;
    this.focusIndex=-1;this.emit({ready:false,error:'',rows:[],frameCount:0,count:0,dividerCount:0,focusIndex:-1,note:''});
    if (!wasActive) return;
    const e=this.editor;e.sceneManager.transformControls.enabled=this.transformEnabled;
    if (e.isSelectionTransformable()) e.sceneManager.transformControls.attach(e.selected);
    e.profileGripEditor.refresh(true);e.interferenceFeedbackManager.requestRefresh();
  }

  emit(state) { this.onChanged?.({active:this.active,...state}); }
}
