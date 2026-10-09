import {createProjectCoordinateDescriptor} from '../model/ProfileCoordinateSystem.js';
import {normalizeDimensionEntity, DIMENSION_SYSTEM_VERSION} from '../dimension/DimensionSystem.js';
import {panelDimensions} from '../model/PanelShapeModel.js';

export const CURRENT_PROJECT_SCHEMA_VERSION = 62;
export const CURRENT_APP_VERSION = '0.75.32';

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
      if(connection.jointKind!=null&&(connection.jointKind!=='SIDE_CORNER'||connection.designType!=='ANGLE_BRACKET'||!connection.designComponent||connection.manufacturingRuleId))throw new Error(`连接 ${connection.id} 的侧面内角只支持未配置制造方案的目录角码`);
      const faces=connection.designComponentMountFaces;
      const validFaces=['FRONT','BACK','LEFT','RIGHT'],opposite={FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'};
      if(connection.designComponentMountFace!=null&&!validFaces.includes(connection.designComponentMountFace))throw new Error(`连接 ${connection.id} 的主安装面无效`);
      if(faces!=null&&(!Array.isArray(faces)||faces.length>2||faces.some(face=>!validFaces.includes(face))||new Set(faces).size!==faces.length))throw new Error(`连接 ${connection.id} 的安装面列表无效`);
      if(faces?.length===2&&(connection.designType!=='ANGLE_BRACKET'||opposite[faces[0]]!==faces[1]))throw new Error(`连接 ${connection.id} 的双侧安装面必须互为反面`);
      if(faces?.length&&connection.designComponentMountFace!=null&&connection.designComponentMountFace!==faces[0])throw new Error(`连接 ${connection.id} 的主安装面与列表不一致`);
    }
  }

  static normalizeCurrent(project) {
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
      annotations:{showOverall:true,showPartDimensions:true,showPartNumbers:true,showMachiningLabels:true,showMachiningDimensions:false,showUserDimensions:true},
      ...(project.editorState || {})
    };
    project.editorState.drawingDefaults = {catalogId:'DESIGN-3030',faceClosures:[],plane:'XZ',orthogonal:true,gridSnap:true,gridStepMm:10,fixedLengthMm:0,continueDrawing:false,boxWidthMm:1000,boxDepthMm:600,boxHeightMm:1000,...(project.editorState.drawingDefaults || {})};
    project.editorState.drawingDefaults.continueDrawing = project.editorState.drawingDefaults.continueDrawing === true;
    project.editorState.annotations = {showOverall:true,showPartDimensions:true,showPartNumbers:true,showMachiningLabels:true,showMachiningDimensions:false,showUserDimensions:true,...(project.editorState.annotations || {})};
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
