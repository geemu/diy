import {createProjectCoordinateDescriptor} from '../model/ProfileCoordinateSystem.js';
import {normalizeDimensionEntity, DIMENSION_SYSTEM_VERSION} from '../dimension/DimensionSystem.js';
import {panelDimensions,panelMaterialContours} from '../model/PanelShapeModel.js';
import {connectionDesignType} from '../model/ComponentCatalog.js';
import {normalizeHiddenCornerDimensions,angleBracketLayout,flatConnectionPlateLayout} from '../model/ConnectionComponentPorts.js';
import {normalizeDesignAnchor,isCenteredDesignAnchor} from '../model/ConnectionAnchor.js';
import {normalizeSideMount} from '../connection/SideMountConnection.js';
import {normalizeSideSlot} from '../connection/SideSlotConnection.js';
import {validPanelSlotFit} from '../configurator/PanelSlotPlacement.js';
import {normalizeMaterialList} from '../model/MaterialListManager.js';

export const CURRENT_PROJECT_SCHEMA_VERSION = 62;
export const CURRENT_APP_VERSION = '0.75.80';

/** 梁下参考件与内收梁外侧原目录件分开验收，不把改孔规格套到外侧直角上。 */
function sideMountRecordValid(reference,component,face){
  const side=normalizeSideMount(reference),dimensions=component?.dimensions;
  if(!side||!angleBracketLayout(dimensions)||!['ANGLE_BRACKET','CORNER_CUBE','L_BRACKET'].includes(dimensions.geometryKind))return false;
  return side.mode==='OUTER_CORNER'?dimensions.sideMountGeometryVersion==null&&face===side.sourceContactFace:dimensions.sideMountGeometryVersion===1;
}

/**
 * Current-only project schema gate.
 *
 * The project is in active development. Historical schema migration is
 * intentionally not supported: callers must provide the current schema.
 */
export default class ProjectSchema {
  static load(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('工程数据不是有效对象');
    const schemaVersion = Number(input.schemaVersion);
    if (schemaVersion !== CURRENT_PROJECT_SCHEMA_VERSION) {
      throw new Error(`当前版本仅支持 schema v${CURRENT_PROJECT_SCHEMA_VERSION}，该工程为 v${Number.isFinite(schemaVersion) ? schemaVersion : '未知'}；项目当前不维护历史 Schema 兼容`);
    }
    const project = structuredClone(input);
    this.assertArrays(project);
    this.assertCurrentParts(project.parts);
    this.assertCurrentConnections(project.connections);
    this.normalizeCurrent(project);
    return {project,schemaVersion:CURRENT_PROJECT_SCHEMA_VERSION,migrated:false};
  }

  static assertArrays(project) {
    for (const key of ['parts','connections','constraints','assemblies','profileSections','dimensions']) {
      if (!Array.isArray(project[key])) throw new Error(`schema v${CURRENT_PROJECT_SCHEMA_VERSION} 缺少数组字段：${key}`);
    }
  }


  static assertCurrentParts(parts) {
    const allowed = new Set(['PROFILE','SHAFT','PANEL','ACCESSORY']);
    for (const part of parts || []) {
      if (!part || typeof part !== 'object') throw new Error(`schema v${CURRENT_PROJECT_SCHEMA_VERSION} 存在无效构件数据`);
      if (!allowed.has(part.type)) throw new Error(`schema v${CURRENT_PROJECT_SCHEMA_VERSION} 不支持构件类型：${part.type || '空'}`);
      if (!part.id) throw new Error(`schema v${CURRENT_PROJECT_SCHEMA_VERSION} 构件缺少 id`);
      if(part.type==='PANEL'&&part.dimensions?.edgeNotches!=null)panelMaterialContours(part);
      if(part.type==='PANEL'&&part.panelSpec?.openingVersion!=null){
        const spec=part.panelSpec;
        const mode=spec.openingVersion===2&&['ON_FRAME','INSET'].includes(spec.placement)||spec.openingVersion===3&&spec.placement==='T_SLOT'&&validPanelSlotFit(spec);
        if(!mode||!Array.isArray(spec.sourcePartIds)||spec.sourcePartIds.length<4||spec.sourcePartIds.length>64||new Set(spec.sourcePartIds).size!==spec.sourcePartIds.length)throw new Error('框口板材的外框引用、放法或四边槽位无效');
        if(spec.openingVersion===3&&(spec.configurator!=='FRAME_OPENING_PANEL'||spec.sourcePartIds.some(id=>!parts.some(value=>value.id===id&&value.type==='PROFILE'))))throw new Error('四边插槽板材缺少源型材');
      }
      if(part.type==='PANEL'&&part.panelSpec?.slotFit!=null&&part.panelSpec.openingVersion!==3)throw new Error('四边槽位只能属于插槽框口板');
      if(part.type==='PANEL'&&part.dimensions?.panelShape) {
        const expected=panelDimensions(part.dimensions.panelShape,part.dimensions.shapeParameters||{});
        for(const key of ['width','height','thickness'])if(Math.abs(Number(part.dimensions[key])-expected[key])>.01||!Number.isFinite(Number(part.dimensions[key])))throw new Error(`板材 ${part.id} 的 ${key} 与形状参数不一致`);
      }
      if (part.type === 'PROFILE' && !part.designProfile?.profileId) {
        throw new Error(`schema v${CURRENT_PROJECT_SCHEMA_VERSION} 型材 ${part.displayId || part.id} 缺少 designProfile.profileId`);
      }
    }
  }

  static assertCurrentConnections(connections) {
    const allowed=new Set(['ANGLE_BRACKET','INTERNAL_CONNECTOR','ANCHOR_CONNECTOR','CONNECTION_PLATE','END_SCREW']);
    for(const connection of connections || []) {
      if(!connection?.id)throw new Error(`schema v${CURRENT_PROJECT_SCHEMA_VERSION} 连接缺少 id`);
      if(!allowed.has(connection.designType))throw new Error(`schema v${CURRENT_PROJECT_SCHEMA_VERSION} 连接 ${connection.id} 缺少有效 designType`);
      if(!connection.sourceProfileId || !connection.targetProfileId)throw new Error(`schema v${CURRENT_PROJECT_SCHEMA_VERSION} 连接 ${connection.id} 缺少源/目标型材`);
      if(connection.designAnchorOffset!=null&&(!normalizeDesignAnchor(connection.designAnchorOffset)||(!isCenteredDesignAnchor(connection.designAnchorOffset)&&(!connection.designComponent||connection.manufacturingRuleId))))throw new Error(`连接 ${connection.id} 的多槽局部定位无效或绑定了未适配的制造方案`);
      if(connection.designComponent?.dimensions?.geometryKind==='HIDDEN_CORNER'&&(connectionDesignType(connection.designComponent)!==connection.designType||connection.manufacturingRuleId))throw new Error(`连接 ${connection.id} 的隐藏角槽件尺寸/方式无效，或绑定了尚未支持的制造方案`);
      if(connection.jointKind==='SIDE_SLOT'){
        const reference=normalizeSideSlot(connection.sideSlot);
        if(connection.designType!=='CONNECTION_PLATE'||!reference||!flatConnectionPlateLayout(connection.designComponent?.dimensions)||!['START','END'].includes(connection.sourceEnd)||!['FRONT','BACK','LEFT','RIGHT'].includes(connection.targetFace)||connection.sourceMountFace!==reference.sourceFace||connection.manufacturingRuleId||!isCenteredDesignAnchor(connection.designAnchorOffset)||connection.sideMount!=null||connection.designComponent.dimensions.sideMountGeometryVersion!=null)throw new Error(`连接 ${connection.id} 的共面侧槽 / 两孔连接板定位无效，或绑定了未适配制造方案`);
      }else if(connection.jointKind==='SIDE_MOUNT'){
        if(connection.designType!=='ANGLE_BRACKET'||!sideMountRecordValid(connection.sideMount,connection.designComponent,connection.sourceMountFace)||connection.manufacturingRuleId||!isCenteredDesignAnchor(connection.designAnchorOffset))throw new Error(`连接 ${connection.id} 的梁侧安装定位 / 规格无效，或绑定了未适配制造方案`);
        if(connection.sideMount.mode==='OUTER_CORNER'&&(!['START','END'].includes(connection.sourceEnd)||!['FRONT','BACK','LEFT','RIGHT'].includes(connection.targetFace)||connection.sideSlot!=null))throw new Error(`连接 ${connection.id} 的内收梁外侧定位不完整`);
      }else{
        if(connection.sideMount!=null||connection.designComponent?.dimensions?.sideMountGeometryVersion!=null)throw new Error(`连接 ${connection.id} 的梁侧定位必须属于梁侧安装关系`);
        if(connection.jointKind!=null&&(connection.jointKind!=='SIDE_CORNER'||!(connection.designType==='ANGLE_BRACKET'||(connection.designType==='INTERNAL_CONNECTOR'&&connection.designComponent?.dimensions?.geometryKind==='HIDDEN_CORNER'))||!connection.designComponent||connection.manufacturingRuleId))throw new Error(`连接 ${connection.id} 的侧面内角只支持未配置制造方案的目录角码或槽内角槽件`);
      }
      if(connection.jointKind!=='SIDE_SLOT'&&connection.sideSlot!=null)throw new Error(`连接 ${connection.id} 的侧槽定位必须属于共面侧槽关系`);
      const faces=connection.designComponentMountFaces;
      const validFaces=['FRONT','BACK','LEFT','RIGHT'],opposite={FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'};
      if(connection.designComponentMountFace!=null&&!validFaces.includes(connection.designComponentMountFace))throw new Error(`连接 ${connection.id} 的主安装面无效`);
      if(faces!=null&&(!Array.isArray(faces)||faces.length>2||faces.some(face=>!validFaces.includes(face))||new Set(faces).size!==faces.length))throw new Error(`连接 ${connection.id} 的安装面列表无效`);
      if(faces?.length===2&&(connection.designType!=='ANGLE_BRACKET'||opposite[faces[0]]!==faces[1]))throw new Error(`连接 ${connection.id} 的双侧安装面必须互为反面`);
      if(faces?.length&&connection.designComponentMountFace!=null&&connection.designComponentMountFace!==faces[0])throw new Error(`连接 ${connection.id} 的主安装面与列表不一致`);
      if(connection.jointKind==='SIDE_SLOT'&&[connection.designComponentMountFace,...(faces||[])].filter(Boolean).some(face=>face!==connection.sideSlot.sourceFace))throw new Error(`连接 ${connection.id} 的侧槽安装面与局部定位不一致`);
      if(connection.sideMount?.mode==='OUTER_CORNER'&&[connection.designComponentMountFace,...(faces||[])].filter(Boolean).some(face=>face!==connection.sideMount.sourceContactFace))throw new Error(`连接 ${connection.id} 的内收梁外侧安装面与局部定位不一致`);
      const variants=connection.designComponentVariants;
      if(variants!=null){
        if(typeof variants!=='object'||Array.isArray(variants))throw new Error(`连接 ${connection.id} 的型号记录无效`);
        for(const [type,variant] of Object.entries(variants)){
          if(!allowed.has(type)||!variant?.designComponent?.id||connectionDesignType(variant.designComponent,{savedRecord:true})!==type||!validFaces.includes(variant.sourceMountFace))throw new Error(`连接 ${connection.id} 的 ${type} 型号记录无效`);
          if(variant.designAnchorOffset!=null&&!normalizeDesignAnchor(variant.designAnchorOffset))throw new Error(`连接 ${connection.id} 的 ${type} 局部定位无效`);
          if((variant.sideMount!=null||variant.designComponent.dimensions.sideMountGeometryVersion!=null)&&(type!=='ANGLE_BRACKET'||!sideMountRecordValid(variant.sideMount,variant.designComponent,variant.sourceMountFace)))throw new Error(`连接 ${connection.id} 的 ${type} 梁侧型号定位无效`);
          if(variant.sideSlot!=null&&(!normalizeSideSlot(variant.sideSlot)||type!=='CONNECTION_PLATE'||!flatConnectionPlateLayout(variant.designComponent.dimensions)||variant.sourceMountFace!==variant.sideSlot.sourceFace||variant.sideMount!=null||!isCenteredDesignAnchor(variant.designAnchorOffset)))throw new Error(`连接 ${connection.id} 的 ${type} 共面侧槽型号定位无效`);
        }
      }
    }
  }

  static normalizeCurrent(project) {
    project.materialList=normalizeMaterialList(project.materialList);
    // 更正当前模型的已知简化内置件，保留构件/连接ID、颜色、安装侧和其他件；不回写用户原文件。
    for(const part of project.parts)if(part.dimensions?.geometryKind==='HIDDEN_CORNER')part.dimensions=normalizeHiddenCornerDimensions(part.dimensions);
    for(const connection of project.connections){
      for(const component of [connection.designComponent,...Object.values(connection.designComponentVariants||{}).map(variant=>variant.designComponent)]){
        if(component?.dimensions?.geometryKind==='HIDDEN_CORNER')component.dimensions=normalizeHiddenCornerDimensions(component.dimensions);
      }
    }
    project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
    project.metadata = {
      ...(project.metadata || {}),
      version:CURRENT_APP_VERSION,
      schemaVersion:CURRENT_PROJECT_SCHEMA_VERSION,
      generator:project.metadata?.generator || 'DIY Web'
    };
    project.coordinateSystem = {...createProjectCoordinateDescriptor(),...(project.coordinateSystem || {})};
    const manufacturing = project.manufacturing || {};
    project.manufacturing = {
      unit:'mm',
      strictExport:manufacturing.strictExport !== false,
      minimumEndDistanceMm:Number(manufacturing.minimumEndDistanceMm ?? 8),
      duplicatePositionToleranceMm:Number(manufacturing.duplicatePositionToleranceMm ?? 0.05),
      collisionToleranceMm:Number(manufacturing.collisionToleranceMm ?? 0.5),
      contactToleranceMm:Number(manufacturing.contactToleranceMm ?? 1)
    };
    project.editorState = {
      autosaveEnabled:true,
      profileDrawToolVersion:7,
      featureSnapVersion:3,
      assemblySystemVersion:2,
      assemblyExplodedViewVersion:1,
      assemblyDiagnosticsVersion:1,
      connectorSystemVersion:3,
      slotCatalogVersion:1,
      hardwareBomVersion:2,
      bomReportVersion:1,
      productionInspectionVersion:1,
      profileCollisionCheckVersion:2,
      connectionCompletenessCheckVersion:1,
      profileCatalogVersion:1,
      accessoryCatalogVersion:2,
      accessoryMountingVersion:2,
      placementSystemVersion:1,
      manufacturingIdentityVersion:1,
      assemblyInstructionVersion:2,
      taggedDrawingVersion:1,
      connectionInstallationDiagramVersion:4,
      contourFrameVersion:5,
      assemblyPlaybackVersion:2,
      interactionPolishVersion:5,
      contourRelationVisualizationVersion:2,
      assemblyGuideDocumentVersion:2,
      cadInteractionVersion:3,
      cadInteraction:{transformSpace:'world',workPlane:'XZ',workPlaneVisible:true,movementStepMm:5,rotationStepDeg:15,moveScope:'SINGLE'},
      autoConnectorRecommendation:true,
      autoConnectionSystemVersion:2,
      connectionQuickChangeVersion:1,
      panelDoorConfiguratorVersion:1,
      profileReplacementVersion:1,
      designModelVersion:1,
      manufacturingConfigurationVersion:1,
      connectionAnchorVersion:1,
      connectionPlacementVersion:2,
      machiningPlacementVersion:1,
      autoConnectionEnabled:true,
      machiningFeatureSystemVersion:1,
      machiningReferenceVersion:1,
      machiningCollisionCheckVersion:1,
      machiningRectangularPatternVersion:1,
      dimensionSystemVersion:DIMENSION_SYSTEM_VERSION,
      engineeringDrawingSystemVersion:2,
      engineeringDrawingDxfVersion:1,
      profileGripEditingVersion:1,
      profileGripDefaults:{enabled:true,minLengthMm:10,gridSnap:true,gridStepMm:10,featureSnap:true,featureSnapDistanceMm:28,axisSnapToleranceMm:3},
      engineeringDrawing:{projectName:'未命名工程',revision:'A',paper:'A3',sideView:'RIGHT'},
      drawingDefaults:{catalogId:'DESIGN-3030',faceClosures:[],plane:'XZ',orthogonal:true,gridSnap:true,gridStepMm:10,fixedLengthMm:0,continueDrawing:false,boxWidthMm:1000,boxDepthMm:600,boxHeightMm:1000},
      annotations:{showOverall:true,showRackLayers:true,showPartDimensions:true,showPartNumbers:true,showMachiningLabels:true,showMachiningSurface:true,showMachiningDimensions:false,showUserDimensions:true},
      ...(project.editorState || {})
    };
    project.editorState.drawingDefaults = {catalogId:'DESIGN-3030',faceClosures:[],plane:'XZ',orthogonal:true,gridSnap:true,gridStepMm:10,fixedLengthMm:0,continueDrawing:false,boxWidthMm:1000,boxDepthMm:600,boxHeightMm:1000,...(project.editorState.drawingDefaults || {})};
    project.editorState.drawingDefaults.continueDrawing = project.editorState.drawingDefaults.continueDrawing === true;
    const annotations=project.editorState.annotations||{};
    const hasMachiningDisplayPreference=typeof annotations.showMachiningSurface==='boolean';
    project.editorState.annotations = {showOverall:true,showRackLayers:true,showPartDimensions:true,showPartNumbers:true,showMachiningLabels:true,showMachiningSurface:true,showMachiningDimensions:false,showUserDimensions:true,...annotations};
    // 旧Schema62展示副本首次默认贴面；已有尺寸与驱动保留，之后尊重显式显示选择。
    if(!hasMachiningDisplayPreference)project.editorState.annotations.showMachiningDimensions=false;
    if(project.editorState.annotations.showMachiningDimensions)project.editorState.annotations.showMachiningSurface=false;
    project.editorState.dimensionSystemVersion = DIMENSION_SYSTEM_VERSION;
    project.editorState.engineeringDrawingSystemVersion = 2;
    project.editorState.engineeringDrawingDxfVersion = 1;
    project.editorState.hardwareBomVersion = 2;
    project.editorState.bomReportVersion = 1;
    project.editorState.profileCatalogVersion = 1;
    project.editorState.accessoryCatalogVersion = 2;
    project.editorState.accessoryMountingVersion = 2;
    project.editorState.placementSystemVersion = 1;
    project.editorState.manufacturingIdentityVersion = 1;
    project.editorState.assemblyInstructionVersion = 2;
    project.editorState.taggedDrawingVersion = 1;
    project.editorState.connectionInstallationDiagramVersion = 4;
    project.editorState.contourFrameVersion = 5;
    project.editorState.assemblyPlaybackVersion = 2;
    project.editorState.interactionPolishVersion = 5;
    project.editorState.contourRelationVisualizationVersion = 2;
    project.editorState.assemblyGuideDocumentVersion = 2;
    project.editorState.cadInteractionVersion = 3;
    project.editorState.cadInteraction = {transformSpace:'world',workPlane:'XZ',workPlaneVisible:true,movementStepMm:5,rotationStepDeg:15,moveScope:'SINGLE',...(project.editorState.cadInteraction || {})};
    project.editorState.autoConnectionSystemVersion = 2;
    project.editorState.connectionQuickChangeVersion = 1;
    project.editorState.panelDoorConfiguratorVersion = 1;
    project.editorState.profileReplacementVersion = 1;
    project.editorState.designModelVersion = 1;
    project.editorState.manufacturingConfigurationVersion = 1;
    project.editorState.connectionAnchorVersion = 1;
    project.editorState.connectionPlacementVersion = 2;
    project.editorState.machiningPlacementVersion = 1;
    // 工作台不再分模式，展示偏好不应成为工程的业务事实。
    delete project.editorState.workbenchMode;
    project.editorState.autoConnectionEnabled = project.editorState.autoConnectionEnabled !== false;
    project.editorState.profileDrawToolVersion = 7;
    project.editorState.featureSnapVersion = 3;
    project.editorState.profileCollisionCheckVersion = 2;
    project.editorState.profileGripEditingVersion = 1;
    project.editorState.profileGripDefaults = {enabled:true,minLengthMm:10,gridSnap:true,gridStepMm:10,featureSnap:true,featureSnapDistanceMm:28,...(project.editorState.profileGripDefaults || {})};
    project.editorState.engineeringDrawing = {projectName:'未命名工程',revision:'A',paper:'A3',sideView:'RIGHT',...(project.editorState.engineeringDrawing || {})};
    project.dimensions = project.dimensions.map(normalizeDimensionEntity);
  }
}
