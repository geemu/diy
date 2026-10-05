import * as THREE from 'three';
import FrameOpeningResolver from './FrameOpeningResolver.js';
import {getDesignProfileDefinition,getDefaultDesignProfileId} from '../model/DesignProfileCatalog.js';

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
    const opening = this.openingResolver.resolve(options.sourcePartIds);
    const panel = this.createPanelForOpening(opening,options);
    this.editor.historyManager.capture();
    this.editor.emitProjectChanged();
    return {panel,opening};
  }

  createPanelForOpening(opening, options = {}) {
    const clearance = Math.max(0,Number(options.clearanceMm ?? 2));
    const thickness = Math.max(0.5,Number(options.thickness ?? 5));
    const width = opening.width - clearance * 2;
    const height = opening.height - clearance * 2;
    if (!(width > 1) || !(height > 1)) throw new Error('扣除板材间隙后没有可用净尺寸');
    const normalOffset = Number(options.normalOffsetMm || 0);
    const position = addScaled(opening.center,opening.basis.normal,normalOffset);
    const mesh = this.editor.addPanel(width,height,thickness,{
      select:options.select !== false,
      captureHistory:false,
      position,
      rotation:opening.rotation,
      material:options.material || '亚克力',
      color:options.color,
      assemblyId:options.assemblyId ?? opening.assemblyId,
      name:options.name || `框口板 ${Math.round(width)}×${Math.round(height)}`
    });
    mesh.userData.part.panelSpec = {
      ...(mesh.userData.part.panelSpec || {}),
      configurator:'FRAME_OPENING_PANEL',
      sourcePartIds:[...opening.sourcePartIds],
      clearanceMm:clearance,
      normalOffsetMm:normalOffset,
      generated:true,
      openingAxes:{widthAxis:opening.widthAxis,heightAxis:opening.heightAxis,normalAxis:opening.normalAxis}
    };
    return mesh.userData.part;
  }

  refitPanel(panelOrId) {
    const part = typeof panelOrId === 'string' ? this.editor.parts.find(item => item.id === panelOrId) : panelOrId;
    if (part?.type !== 'PANEL' || part.panelSpec?.configurator !== 'FRAME_OPENING_PANEL') throw new Error('当前板材不是框口自动填板');
    const opening = this.openingResolver.resolve(part.panelSpec.sourcePartIds);
    const clearance = Math.max(0,Number(part.panelSpec.clearanceMm ?? 2));
    const width = opening.width - clearance * 2;
    const height = opening.height - clearance * 2;
    if (!(width > 1) || !(height > 1)) throw new Error('重新适配后板材净尺寸无效');
    part.dimensions.width = width;
    part.dimensions.height = height;
    part.position = addScaled(opening.center,opening.basis.normal,Number(part.panelSpec.normalOffsetMm || 0));
    part.rotation = {...opening.rotation};
    part.panelSpec.openingAxes = {widthAxis:opening.widthAxis,heightAxis:opening.heightAxis,normalAxis:opening.normalAxis};
    this.editor.rebuildPartMesh(part.id);
    this.editor.accessoryMountManager.refreshForTargets([part.id]);
    this.editor.historyManager.capture();
    this.editor.emitProjectChanged();
    return part;
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
