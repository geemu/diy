import * as THREE from 'three';
import FrameOpeningResolver from './FrameOpeningResolver.js';
import {getDesignProfileDefinition,getDefaultDesignProfileId} from '../model/DesignProfileCatalog.js';
import {panelMaterialContours} from '../model/PanelShapeModel.js';
import {panelPose,panelObjectIntersection} from '../geometry/PanelReliefGeometry.js';
import {assertPanelSlotEngagement} from './PanelSlotPlacement.js';
import {panelReliefObjects,scanPanelConnectorRelief,panelReliefBlockers} from './PanelReliefManager.js';

/**
 * Beginner-facing panel and door configurator.
 *
 * Generated entities stay ordinary Project parts/assemblies. The configurator
 * only stores enough provenance to refit them when the host frame changes.
 */
export default class PanelDoorConfigurator {
  constructor(editor) {
    this.editor = editor;
    this.openingResolver = new FrameOpeningResolver(editor);
  }

  createPanelFromSelection(options = {}) {
    return this.commitPanelPlans(this.planPanelsFromSelection(options),options);
  }

  /** 先派生全部板材和错误信息；不先插入一块板再尝试裁剪，也不因某格失败丢掉其他格的预览。 */
  planPanelsFromSelection(options={}){
    const {cells}=this.openingResolver.resolvePanelCells(options.sourcePartIds,options);
    return cells.map(({opening,error},index)=>this.planPanelForOpening(opening,{...options,openingError:error,index}));
  }

  planPanelForOpening(opening,options={}){
    const layout=panelOpeningLayout(opening,options),{width,height,thickness,clearance,normalOffset,position}=layout;
    const panelSpec=panelSpecForOpening(opening,{clearanceMm:clearance,normalOffsetMm:normalOffset});
    const draft={type:'PANEL',dimensions:{width,height,thickness},position,rotation:{...opening.rotation},panelSpec};
    const errors=options.openingError?[options.openingError]:[],objects=panelReliefObjects(this.editor);
    if(opening.panelPlacement==='T_SLOT'){
      const gap=Number(options.connectorGapMm??1);
      const relief=scanPanelConnectorRelief(draft,objects,gap,{cornerPartIds:opening.cornerPartIds,slotEngagement:opening.slotEngagement,allowFailures:true});
      draft.dimensions.edgeNotches=relief.notches;draft.panelSpec.connectorRelief={gapMm:gap};
      errors.push(...relief.errors);
      try{panelMaterialContours(draft);}catch(error){errors.push(error.message);delete draft.dimensions.edgeNotches;}
      // 无有效槽位的红色矩形只是框口示意，不能作为插槽板提交。
      if(opening.slotFit){
        try{assertPanelSlotEngagement(draft,opening);}catch(error){errors.push(error.message);}
      }else if(!errors.length)errors.push('本格四边没有可用的共同 T 槽');
      const blockers=panelReliefBlockers(draft,objects,.001);
      for(const label of blockers){
        errors.push('仍与 '+label+' 相交'+(relief.skipped.includes(label)?'，其轮廓不能形成板边局部缺口':''));
      }
    }else if(opening.panelPlacement){
      try{this.assertProfileClearance(draft);}catch(error){errors.push(error.message);}
    }
    return {draft,opening,errors:[...new Set(errors)],index:options.index??0};
  }

  createPanelForOpening(opening,options={}){
    const plan=this.planPanelForOpening(opening,options);
    if(plan.errors.length)throw new Error(plan.errors[0]);
    return this.insertPlannedPanel(plan,options);
  }

  insertPlannedPanel(plan,options={}){
    const {draft,opening}=plan,{width,height,thickness}=draft.dimensions;
    const mesh = this.editor.addPanel(width,height,thickness,{
      select:options.select !== false,
      captureHistory:false,
      position:draft.position,
      rotation:draft.rotation,
      material:options.material || '亚克力',
      color:options.color,
      shapeDimensions:draft.dimensions,
      panelSpec:draft.panelSpec,
      assemblyId:options.assemblyId ?? opening.assemblyId,
      name:options.name || `框口板 ${Math.round(width)}×${Math.round(height)}`
    });
    return mesh.userData.part;
  }

  /** 全部格一次提交；复用构图期间的提交屏蔽，不能把半批板材写入草稿或历史。 */
  commitPanelPlans(plans,options={}){
    const invalid=plans.find(p=>p.errors.length);
    if(!plans.length||invalid)throw new Error(invalid?'第 '+(invalid.index+1)+' 块：'+invalid.errors[0]:'没有可适配的框口');
    const e=this.editor,before=e.exportProject(),selection=e.selectedMeshes.map(m=>m.userData.part.id);
    const states=[...e.historyManager.states],index=e.historyManager.index,mutating=e.selectionGraphMutation;
    e.selectionGraphMutation=true;
    try{
      const panels=plans.map(plan=>this.insertPlannedPanel(plan,{...options,select:false}));
      // 包括新板之间在内重新检查实际几何；绝不因预览通过而省掉正式插入后的守卫。
      for(const part of panels.filter(p=>p.panelSpec.placement==='T_SLOT')){
        assertPanelSlotEngagement(part,this.resolveSavedPanelOpening(part));
        const blockers=panelReliefBlockers(part,panelReliefObjects(e,part.id),.001);
        if(blockers.length)throw new Error('新板仍与 '+blockers[0]+' 相交，本批板材未保留');
      }
      if(options.select!==false)e.selectMany(panels.map(p=>e.getMeshByPartId(p.id)));
      e.updateDimensions();e.emitStats();e.historyManager.capture();
      e.selectionGraphMutation=mutating;e.emitProjectChanged();
      return {panels,openings:plans.map(p=>p.opening),panel:panels[0],opening:plans[0].opening};
    }catch(error){
      e.historyManager.states=states;e.historyManager.index=index;e.restoreProject(before);
      e.selectMany(selection.map(id=>e.getMeshByPartId(id)).filter(Boolean));throw error;
    }finally{e.selectionGraphMutation=mutating;}
  }

  resolveSavedPanelOpening(part){
    const options={...part.panelSpec,thickness:part.dimensions.thickness};
    return [2,3].includes(part.panelSpec.openingVersion)?this.openingResolver.resolvePanel(part.panelSpec.sourcePartIds,options):this.openingResolver.resolve(part.panelSpec.sourcePartIds);
  }

  /** 显式把已有框口板改为四边插槽；仅返回新的尺寸/姿态/裁角副本，提交归预览 Manager。 */
  planSlotRefit(partId){
    const part=this.editor.parts.find(value=>value.id===partId);
    if(part?.type!=='PANEL'||part.panelSpec?.configurator!=='FRAME_OPENING_PANEL')throw new Error('当前板材没有完整的框口引用，请重新选外框填板');
    if(!this.editor.isMeshTransformable(this.editor.getMeshByPartId(partId))||part.machiningItems?.length)throw new Error('请先处理板材的锁定、安装或已有加工，再重新适配');
    if(this.editor.constraintManager.constraints.some(c=>c.enabled!==false&&(c.sourcePartId===partId||c.targetPartId===partId))
      ||this.editor.userDimensions.some(d=>JSON.stringify(d).split('"').includes(partId)))throw new Error('板材已有几何约束或尺寸引用，请先处理引用，不能直接改插槽尺寸/位置');
    if(this.editor.parts.some(value=>value.mountReference?.targetPartId===partId&&!value.generatedByConnectionId))throw new Error('板材上仍有安装配件，请先处理其安装关系，再重新适配');
    const options={...part.panelSpec,placement:'T_SLOT',clearanceMm:Math.max(.1,Number(part.panelSpec.clearanceMm??2)),normalOffsetMm:0,thickness:part.dimensions.thickness};
    // 点击重新适配是明确重选槽位；普通加载/整架回改仍尊重保存的局部槽引用。
    delete options.slotFit;
    const opening=this.openingResolver.resolvePanel(part.panelSpec.sourcePartIds,options),layout=panelOpeningLayout(opening,options),draft=structuredClone(part);
    Object.assign(draft.dimensions,{width:layout.width,height:layout.height});
    if(draft.dimensions.shapeParameters)Object.assign(draft.dimensions.shapeParameters,{width:layout.width,height:layout.height});
    draft.position={...layout.position};draft.rotation={...opening.rotation};
    draft.panelSpec=panelSpecForOpening(opening,{...part.panelSpec,clearanceMm:layout.clearance,normalOffsetMm:0});
    const gap=Number(part.panelSpec.connectorRelief?.gapMm??1);
    draft.dimensions.edgeNotches=scanPanelConnectorRelief(draft,panelReliefObjects(this.editor,partId),gap,{cornerPartIds:opening.cornerPartIds,slotEngagement:opening.slotEngagement}).notches;
    panelMaterialContours(draft);
    return {draft,opening};
  }

  refitPanel(panelOrId) {
    const part = typeof panelOrId === 'string' ? this.editor.parts.find(item => item.id === panelOrId) : panelOrId;
    if (part?.type !== 'PANEL' || part.panelSpec?.configurator !== 'FRAME_OPENING_PANEL') throw new Error('当前板材不是框口自动填板');
    if(part.panelSpec.placement==='T_SLOT')throw new Error('插槽板请先预览重新适配，再确认尺寸和裁角');
    const opening = this.resolveSavedPanelOpening(part);
    const layout=panelOpeningLayout(opening,{...part.panelSpec,thickness:part.dimensions.thickness}),{width,height,position}=layout;
    const draft=structuredClone(part);
    draft.dimensions.width=width;draft.dimensions.height=height;
    if(draft.dimensions.shapeParameters)Object.assign(draft.dimensions.shapeParameters,{width,height});
    draft.position=position;draft.rotation={...opening.rotation};
    panelMaterialContours(draft);
    if(part.panelSpec.openingVersion===2)this.assertProfileClearance(draft);
    part.dimensions.width = width;
    part.dimensions.height = height;
    if(part.dimensions.shapeParameters)Object.assign(part.dimensions.shapeParameters,{width,height});
    part.position = position;
    part.rotation = {...opening.rotation};
    part.panelSpec.openingAxes = {widthAxis:opening.widthAxis,heightAxis:opening.heightAxis,normalAxis:opening.normalAxis};
    this.editor.rebuildPartMesh(part.id);
    this.editor.accessoryMountManager.refreshForTargets([part.id]);
    this.editor.historyManager.capture();
    this.editor.emitProjectChanged();
    return part;
  }

  /** 承托梁不能通过裁连接件来“消失”；先拒绝板体穿梁，再由原裁角预览处理五金。 */
  assertProfileClearance(part){
    const box=new THREE.Box3(new THREE.Vector3(-part.dimensions.width/2,-part.dimensions.height/2,-part.dimensions.thickness/2),new THREE.Vector3(part.dimensions.width/2,part.dimensions.height/2,part.dimensions.thickness/2)).applyMatrix4(panelPose(part));
    for(const mesh of this.editor.meshes){
      const p=mesh.userData.part;if(p.type!=='PROFILE'||p.hidden||mesh.visible===false||!box.intersectsBox(new THREE.Box3().setFromObject(mesh)))continue;
      const relation=panelObjectIntersection(part,mesh,Number(this.editor.projectSettings?.collisionToleranceMm??.5));
      if(!relation||relation.intersects)throw new Error('板材会穿过 '+(p.displayId||p.name)+'，请分格填板或调整承托梁/板材位置；不会裁掉型材');
    }
  }

  createDoorFromSelection(options = {}) {
    const opening = this.openingResolver.resolve(options.sourcePartIds);
    const assemblyId = crypto.randomUUID();
    const result = this.createDoorForOpening(opening,{...options,assemblyId});
    this.editor.historyManager.capture();
    this.editor.emitProjectChanged();
    this.editor.fitView();
    return result;
  }

  createDoorForOpening(opening, options = {}) {
    const assemblyId = options.assemblyId || crypto.randomUUID();
    const frameCatalogId = options.frameCatalogId || getDefaultDesignProfileId('2020');
    const definition = getDesignProfileDefinition(frameCatalogId);
    if (!definition) throw new Error('门框型材型号不存在');
    const gap = Math.max(0,Number(options.gapMm ?? 3));
    const panelGap = Math.max(0,Number(options.panelGapMm ?? 2));
    const panelThickness = Math.max(0.5,Number(options.panelThickness ?? 5));
    const doorWidth = opening.width - gap * 2;
    const doorHeight = opening.height - gap * 2;
    const frameSize = Math.max(...definition.sectionSize.map(Number));
    if (doorWidth <= frameSize * 2 + panelGap * 2 || doorHeight <= frameSize * 2 + panelGap * 2) throw new Error('框口过小，无法容纳当前门框型材');

    const center = {...opening.center};
    const widthVec = toVector(opening.basis.width);
    const heightVec = toVector(opening.basis.height);
    const normalVec = toVector(opening.basis.normal);
    const widthRotation = rotationForDirection(widthVec);
    const heightRotation = rotationForDirection(heightVec);
    const common = {select:false,captureHistory:false,assemblyId};
    const createdProfiles = [];

    const stileOffset = (doorWidth - frameSize) / 2;
    const railOffset = (doorHeight - frameSize) / 2;
    createdProfiles.push(this.addDoorProfile(frameCatalogId,doorHeight,addVectors(center,widthVec.clone().multiplyScalar(-stileOffset)),heightRotation,'DOOR_LEFT','门左立柱',common,assemblyId));
    createdProfiles.push(this.addDoorProfile(frameCatalogId,doorHeight,addVectors(center,widthVec.clone().multiplyScalar(stileOffset)),heightRotation,'DOOR_RIGHT','门右立柱',common,assemblyId));
    createdProfiles.push(this.addDoorProfile(frameCatalogId,Math.max(10,doorWidth - frameSize * 2),addVectors(center,heightVec.clone().multiplyScalar(railOffset)),widthRotation,'DOOR_TOP','门上横梁',common,assemblyId));
    createdProfiles.push(this.addDoorProfile(frameCatalogId,Math.max(10,doorWidth - frameSize * 2),addVectors(center,heightVec.clone().multiplyScalar(-railOffset)),widthRotation,'DOOR_BOTTOM','门下横梁',common,assemblyId));

    const panelWidth = doorWidth - frameSize * 2 - panelGap * 2;
    const panelHeight = doorHeight - frameSize * 2 - panelGap * 2;
    const panelMesh = this.editor.addPanel(panelWidth,panelHeight,panelThickness,{
      ...common,
      position:addScaled(center,opening.basis.normal,Number(options.panelOffsetMm || 0)),
      rotation:opening.rotation,
      material:options.panelMaterial || '亚克力',
      name:`门芯板 ${Math.round(panelWidth)}×${Math.round(panelHeight)}`
    });
    tagConfiguratorPart(panelMesh.userData.part,assemblyId,'DOOR_PANEL');

    const hardware = [];
    const hingeSide = options.hingeSide === 'RIGHT' ? 'RIGHT' : 'LEFT';
    if (options.includeHinges !== false) {
      const sideSign = hingeSide === 'LEFT' ? -1 : 1;
      const hingeU = sideSign * Math.max(0,doorWidth / 2 - frameSize / 2);
      for (const ratio of [-0.28,0.28]) {
        const position = addVectors(center,widthVec.clone().multiplyScalar(hingeU),heightVec.clone().multiplyScalar(doorHeight * ratio),normalVec.clone().multiplyScalar(panelThickness / 2 + 2));
        const hinge = this.editor.addHardware('HINGE_GENERIC_40',{...common,position,rotation:opening.rotation,name:'门铰链'});
        tagConfiguratorPart(hinge.userData.part,assemblyId,'DOOR_HINGE');
        hardware.push(hinge.userData.part);
      }
    }
    if (options.includeHandle !== false) {
      const handleSign = hingeSide === 'LEFT' ? 1 : -1;
      const handleU = handleSign * Math.max(0,doorWidth / 2 - frameSize * 1.4);
      const position = addVectors(center,widthVec.clone().multiplyScalar(handleU),normalVec.clone().multiplyScalar(panelThickness / 2 + 12));
      const handle = this.editor.addHardware('HANDLE_GENERIC_120',{...common,position,rotation:opening.rotation,name:'门拉手'});
      tagConfiguratorPart(handle.userData.part,assemblyId,'DOOR_HANDLE');
      hardware.push(handle.userData.part);
    }

    this.editor.assemblyManager.reconcile();
    const assembly = this.editor.assemblyManager.get(assemblyId);
    if (assembly) {
      assembly.name = String(options.name || '配置门组件');
      assembly.kind = 'DOOR';
      assembly.configurator = 'DOOR_CONFIGURATOR';
      assembly.parameters = {
        sourcePartIds:[...opening.sourcePartIds],
        frameCatalogId,
        gapMm:gap,
        panelGapMm:panelGap,
        panelThickness,
        panelMaterial:options.panelMaterial || '亚克力',
        panelOffsetMm:Number(options.panelOffsetMm || 0),
        hingeSide,
        includeHinges:options.includeHinges !== false,
        includeHandle:options.includeHandle !== false
      };
    }

    const autoConnection = this.editor.autoConnectionEnabled
      ? this.editor.autoConnectionResolver.connectProfileSet(createdProfiles.map(part => part.id),{source:'DOOR_CONFIGURATOR'})
      : {createdCount:0,created:[]};
    this.editor.updateDimensions();
    this.editor.emitStats();
    return {assemblyId,opening,profiles:createdProfiles,panel:panelMesh.userData.part,hardware,autoConnection};
  }

  refitDoor(assemblyOrId) {
    const assembly = typeof assemblyOrId === 'string' ? this.editor.assemblyManager.get(assemblyOrId) : assemblyOrId;
    if (!assembly || assembly.configurator !== 'DOOR_CONFIGURATOR') throw new Error('当前组件不是配置门组件');
    const parameters = structuredClone(assembly.parameters || {});
    const opening = this.openingResolver.resolve(parameters.sourcePartIds);
    const generated = this.editor.parts.filter(part => part.configuratorId === assembly.id);
    if(generated.some(part=>part.type==='PANEL'&&part.dimensions.edgeNotches?.length))throw new Error('门芯板已有裁角，请先处理裁剪轮廓；不会重建门组件覆盖原板');
    const ids = new Set(generated.map(part => part.id));
    for (const connection of [...this.editor.connectionManager.connections]) {
      if (ids.has(connection.sourceProfileId) || ids.has(connection.targetProfileId)) this.editor.connectionManager.removeConnection(connection.id);
    }
    for (const part of generated) {
      this.editor.constraintManager.removeForPart(part.id);
      this.editor.removePartByIdSilently(part.id);
    }
    const result = this.createDoorForOpening(opening,{...parameters,assemblyId:assembly.id,name:assembly.name});
    this.editor.assemblyManager.refreshPartVisibility();
    this.editor.historyManager.capture();
    this.editor.emitProjectChanged();
    return result;
  }

  addDoorProfile(catalogId,length,position,rotation,role,name,common,assemblyId) {
    const mesh = this.editor.addProfile(catalogId,length,{...common,position,rotation,name});
    tagConfiguratorPart(mesh.userData.part,assemblyId,role);
    return mesh.userData.part;
  }
}

/** 四边插槽用已求出的实际外尺寸；旧板的净框口/梁顶规则仅在显式保存的旧放法中保留。 */
export function panelOpeningLayout(opening,options={}){
  const clearance=Number(options.clearanceMm??2),thickness=Number(options.thickness??5),normalOffset=Number(options.normalOffsetMm??0);
  if(![clearance,thickness,normalOffset].every(Number.isFinite)||clearance<0||thickness<.5)throw new Error('板材间隙和偏移应为有效毫米数，厚度至少0.5mm');
  if(opening.panelPlacement==='T_SLOT'&&normalOffset!==0)throw new Error('四边插槽不支持法向偏移');
  const width=opening.width-(opening.panelPlacement==='T_SLOT'?0:clearance*2),height=opening.height-(opening.panelPlacement==='T_SLOT'?0:clearance*2);
  if(width<=1||height<=1)throw new Error('扣除板材间隙后没有可用净尺寸');
  const center={...opening.center};
  if(opening.panelPlacement==='ON_FRAME')center.y=opening.supportFaceMm+thickness/2;
  return {width,height,thickness,clearance,normalOffset,position:addScaled(center,opening.basis.normal,normalOffset)};
}

export function panelSpecForOpening(opening,previous={}){
  const spec={...previous,configurator:'FRAME_OPENING_PANEL',sourcePartIds:[...opening.sourcePartIds],generated:true,
    openingAxes:{widthAxis:opening.widthAxis,heightAxis:opening.heightAxis,normalAxis:opening.normalAxis}};
  if(opening.panelPlacement){spec.openingVersion=opening.panelPlacement==='T_SLOT'?3:2;spec.placement=opening.panelPlacement;}
  if(opening.slotFit)spec.slotFit=structuredClone(opening.slotFit);else delete spec.slotFit;
  return spec;
}

function tagConfiguratorPart(part,configuratorId,role) {
  part.configuratorId = configuratorId;
  part.configuratorRole = role;
}

function rotationForDirection(direction) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),direction.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q,'XYZ');
  return {x:e.x,y:e.y,z:e.z};
}

function toVector(value) {
  return new THREE.Vector3(Number(value?.x || 0),Number(value?.y || 0),Number(value?.z || 0));
}

function addScaled(point,vector,scale) {
  return {
    x:Number(point.x || 0) + Number(vector.x || 0) * scale,
    y:Number(point.y || 0) + Number(vector.y || 0) * scale,
    z:Number(point.z || 0) + Number(vector.z || 0) * scale
  };
}

function addVectors(point,...vectors) {
  const out = new THREE.Vector3(Number(point.x || 0),Number(point.y || 0),Number(point.z || 0));
  for (const vector of vectors) out.add(vector);
  return {x:out.x,y:out.y,z:out.z};
}
