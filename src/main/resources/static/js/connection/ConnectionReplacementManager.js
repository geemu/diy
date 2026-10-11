import PrimitiveGeometryFactory from '../geometry/PrimitiveGeometryFactory.js';

/** 更换独立一件目录组件。预览不改原关系，fresh 确认继续走原 ConnectionManager 的安装守卫。 */
export default class ConnectionReplacementManager {
  constructor(editor){this.editor=editor;this.active=false;this.previewGroup=null;this.pending=null;this.onChanged=null;}
  isActive(){return this.active;}
  begin(connectionId) {
    this.cancel();
    const e=this.editor,c=e.connectionManager.resolveConnection(connectionId);
    if(!c)throw new Error('连接件已不存在');
    if(c.manufacturingRuleId)throw new Error('该件已有制造配置，请先解除制造配置，再更换设计组件');
    this.active=true;this.connectionId=c.id;this.signature=JSON.stringify(e.exportProject());
    this.transformEnabled=e.sceneManager.transformControls.enabled;
    e.sceneManager.transformControls.detach();e.sceneManager.transformControls.enabled=false;e.profileGripEditor.refresh(true);
    const choices=e.connectionManager.getCatalogSwitchChoices(c);
    const kind=choices.find(choice=>choice.kind===c.designComponent?.dimensions?.geometryKind)
      ||choices.find(choice=>choice.kind==='INTENT_'+c.designType)
      ||choices.find(choice=>choice.designType===c.designType)||choices[0];
    this.emit({ready:false,error:''});
    return {choices,kind:kind?.kind||'',spec:this.preferredSpec(kind,c)};
  }
  preferredSpec(choice,connection=this.editor.connectionManager.resolveConnection(this.connectionId)) {
    if(!choice?.specs.length)return '';
    const remembered=connection.designComponentVariants?.[choice.designType]?.designComponent;
    return (choice.specs.find(spec=>spec.definition.id===connection.designComponent?.id)
      ||choice.specs.find(spec=>spec.definition.id===remembered?.id)||choice.specs[0]).value;
  }
  selection(kind,spec) {
    const e=this.editor,c=e.connectionManager.resolveConnection(this.connectionId);
    if(!this.active||!c)throw new Error('更换连接件已取消');
    const choice=e.connectionManager.getCatalogSwitchChoices(c).find(item=>item.kind===kind);
    if(!choice)throw new Error('该类型没有适配当前型材系列的安装规则');
    const component=choice.specs.length?choice.specs.find(item=>item.value===String(spec)):null;
    if(choice.specs.length&&!component)throw new Error('请选择对应连接件规格');
    const source=e.getMeshByPartId(c.sourceProfileId),target=e.getMeshByPartId(c.targetProfileId);
    if(!source||!target)throw new Error('源或目标型材已不存在，请先处理失效连接');
    const option=e.connectionManager.designSwitchCandidate(c,source,target,choice.designType,{componentDefinition:component?.definition||null});
    if(!option?.valid)throw new Error(option?.error||'这个型号不能安装在当前侧');
    return {connection:c,source,target,designType:choice.designType,componentDefinition:option.componentDefinition||component?.definition||null,option,kind,spec};
  }
  preview(kind,spec) {
    this.clearPreview();
    try{
      if(JSON.stringify(this.editor.exportProject())!==this.signature)throw new Error('工程已改变，请重新打开更换连接件');
      const plan=this.selection(kind,spec),c=plan.connection,option=plan.option;
      const descriptor={...c,designType:plan.designType,type:plan.designType,designComponent:plan.componentDefinition,
        sourceMountFace:option.sourceMountFace,designComponentMountFace:option.sourceMountFace,
        designComponentMountFaces:[option.sourceMountFace],designAnchorOffset:option.designAnchorOffset,validation:option.geometry,sideMount:option.sideMount||c.sideMount};
      const group=this.editor.connectionManager.createDesignHelper(descriptor,plan.source,plan.target,{preview:true});
      group.name='__connection_replacement_preview__';
      group.traverse(child=>{
        if(!child.isMesh)return;
        for(const m of [].concat(child.material||[])){m.color.set(0xffba4a);m.transparent=true;m.opacity=.72;m.depthWrite=false;}
      });
      this.previewGroup=group;this.editor.sceneManager.scene.add(group);
      const original=this.editor.connectionManager.helperMeshes.get(this.connectionId);
      if(original){this.originalHelper=original;this.originalVisible=original.visible;original.visible=false;}
      this.pending={kind,spec,signature:this.signature};
      this.editor.sceneManager.setSelections([],null);
      this.emit({ready:true,error:'',note:plan.componentDefinition?'黄色为新连接件预览，确认只更换这一件':'连接方式示意，实际五金与加工仍需制造配置'});
      return plan;
    }catch(error){this.emit({ready:false,error:error.message});throw error;}
  }
  confirm() {
    if(!this.pending)throw new Error('请先预览连接件');
    if(JSON.stringify(this.editor.exportProject())!==this.pending.signature)throw new Error('工程已改变，请重新预览连接件');
    const plan=this.selection(this.pending.kind,this.pending.spec),e=this.editor;
    this.cancel();
    const result=e.connectionManager.switchDesignType(plan.connection,plan.designType,{componentDefinition:plan.componentDefinition,userOverride:true});
    if(result.changed){e.emitStats();e.historyManager.capture();e.emitProjectChanged();}
    e.refreshConnectionSelection?.();e.interferenceFeedbackManager.requestRefresh();
    return result;
  }
  clearPreview() {
    if(this.previewGroup){this.previewGroup.removeFromParent();PrimitiveGeometryFactory.dispose(this.previewGroup);this.previewGroup=null;}
    if(this.originalHelper&&this.editor.connectionManager.helperMeshes.get(this.connectionId)===this.originalHelper)this.originalHelper.visible=this.originalVisible;
    this.originalHelper=null;this.pending=null;
    if(this.active)this.editor.refreshConnectionSelection?.();
  }
  cancel() {
    this.clearPreview();if(!this.active)return;
    this.active=false;this.emit({active:false,ready:false,error:''});
    const e=this.editor;e.sceneManager.transformControls.enabled=this.transformEnabled;
    if(e.isSelectionTransformable())e.sceneManager.transformControls.attach(e.selected);
    e.profileGripEditor.refresh(true);e.refreshConnectionSelection?.();
  }
  emit(state){this.onChanged?.({active:this.active,connectionId:this.connectionId,...state});}
}
