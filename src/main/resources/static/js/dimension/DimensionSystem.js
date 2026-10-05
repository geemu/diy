import {normalizeProfilePath} from '../model/ProfilePath.js';

export const DIMENSION_SYSTEM_VERSION = 2;

export const DimensionType = Object.freeze({
  LINEAR:'LINEAR',
  ANGULAR:'ANGULAR',
  RADIAL:'RADIAL',
  ORDINATE:'ORDINATE'
});

export const DimensionChainMode = Object.freeze({
  SINGLE:'SINGLE',
  BASELINE:'BASELINE',
  CONTINUE:'CONTINUE',
  ORDINATE:'ORDINATE'
});

/**
 * Dimension-domain operations for the online CAD editor.
 *
 * Dimensions reference semantic anchors (part origin/boundary, profile end,
 * machining feature, arc center) instead of frozen world coordinates. The
 * world points are resolved by Editor only when rendering/evaluating.
 */
export default class DimensionSystem {
  constructor(editor) {
    this.editor = editor;
  }

  createPartChain(meshes, options = {}) {
    const candidates = uniqueMeshes(meshes)
      .filter(mesh => mesh?.userData?.part && mesh.visible !== false);
    if (candidates.length < 2) throw new Error('尺寸链至少需要选择两个构件');

    const axis = resolveChainAxis(candidates, options.axis || 'AUTO');
    const mode = normalizeChainMode(options.mode || DimensionChainMode.CONTINUE);
    const clearance = options.clearance === true;
    const sorted = [...candidates].sort((a,b) => worldCoordinate(a,axis) - worldCoordinate(b,axis));
    const chainId = crypto.randomUUID();
    const created = [];

    if (mode === DimensionChainMode.ORDINATE) {
      const datum = sorted[0];
      for (let index=1; index<sorted.length; index++) {
        const target = sorted[index];
        created.push(this.editor.pushGeneratedDimension({
          type:DimensionType.ORDINATE,
          anchorStart:{type:'PART_ORIGIN',partId:datum.userData.part.id},
          anchorEnd:{type:'PART_ORIGIN',partId:target.userData.part.id},
          binding:{type:'PART_AXIS_COORDINATE',sourcePartId:datum.userData.part.id,targetPartId:target.userData.part.id,axis},
          chain:{id:chainId,mode:DimensionChainMode.ORDINATE,locked:true,order:index,axis,datumPartId:datum.userData.part.id},
          layout:{auto:true,axis,lane:index-1,side:-1},
          semantic:'ORDINATE'
        }));
      }
      return created;
    }

    const pairs = [];
    if (mode === DimensionChainMode.BASELINE) {
      for (let index=1; index<sorted.length; index++) pairs.push([sorted[0],sorted[index],index]);
    } else {
      for (let index=1; index<sorted.length; index++) pairs.push([sorted[index-1],sorted[index],index]);
    }

    for (const [source,target,index] of pairs) {
      const sourceId = source.userData.part.id;
      const targetId = target.userData.part.id;
      const binding = clearance
        ? {type:'PART_CLEARANCE',sourcePartId:sourceId,targetPartId:targetId,axis,sourceSide:'MAX',targetSide:'MIN'}
        : {type:'PART_AXIS_DISTANCE',sourcePartId:sourceId,targetPartId:targetId,axis};
      const anchorStart = clearance
        ? {type:'PART_BOUNDARY',partId:sourceId,axis,side:'MAX'}
        : {type:'PART_ORIGIN',partId:sourceId};
      const anchorEnd = clearance
        ? {type:'PART_BOUNDARY',partId:targetId,axis,side:'MIN'}
        : {type:'PART_ORIGIN',partId:targetId};
      created.push(this.editor.pushGeneratedDimension({
        type:DimensionType.LINEAR,
        anchorStart,anchorEnd,binding,
        chain:{id:chainId,mode,locked:true,order:index,axis,datumPartId:sorted[0].userData.part.id,clearance},
        layout:{auto:true,axis,lane:index-1,side:-1},
        semantic:clearance ? 'CLEARANCE' : 'CENTER_SPACING'
      }));
    }
    return created;
  }

  createInternalChain(meshes, options = {}) {
    return this.createPartChain(meshes,{...options,mode:options.mode || DimensionChainMode.CONTINUE,clearance:true});
  }

  createProfileRadiusDimension(partId) {
    const part = this.editor.parts.find(item => item.id === partId);
    if (!part || part.type !== 'PROFILE') throw new Error('请选择弯型材');
    normalizeProfilePath(part);
    if (part.profilePath?.type !== 'ARC') throw new Error('半径尺寸仅适用于弯型材');
    return this.editor.pushGeneratedDimension({
      type:DimensionType.RADIAL,
      anchorStart:{type:'PROFILE_ARC_CENTER',partId},
      anchorEnd:{type:'PROFILE_ARC_STATION',partId,stationRatio:0.5},
      binding:{type:'PROFILE_RADIUS',partId},
      layout:{auto:true,axis:part.profilePath.plane === 'YZ' ? 'Y' : 'X',lane:0,side:1},
      semantic:'BEND_RADIUS'
    });
  }

  createProfileArcAngleDimension(partId) {
    const part = this.editor.parts.find(item => item.id === partId);
    if (!part || part.type !== 'PROFILE') throw new Error('请选择弯型材');
    normalizeProfilePath(part);
    if (part.profilePath?.type !== 'ARC') throw new Error('圆弧角尺寸仅适用于弯型材');
    return this.editor.pushGeneratedDimension({
      type:DimensionType.ANGULAR,
      anchorStart:{type:'PROFILE_END',partId,end:'START'},
      anchorEnd:{type:'PROFILE_END',partId,end:'END'},
      binding:{type:'PROFILE_ARC_ANGLE',partId},
      layout:{auto:true,lane:0,side:1},
      semantic:'BEND_ANGLE'
    });
  }
}

export function normalizeDimensionEntity(value) {
  if (!value || typeof value !== 'object') throw new Error('尺寸实体无效');
  const dimension = structuredClone(value);
  dimension.id = String(dimension.id || crypto.randomUUID());
  dimension.type = normalizeDimensionType(dimension.type);
  dimension.start = normalizeVector(dimension.start);
  dimension.end = normalizeVector(dimension.end);
  dimension.anchorStart = normalizeDimensionAnchor(dimension.anchorStart);
  dimension.anchorEnd = normalizeDimensionAnchor(dimension.anchorEnd);
  dimension.binding = normalizeDimensionBinding(dimension.binding);
  dimension.offsetWorld = normalizeVector(dimension.offsetWorld);
  dimension.labelOffsetPx = {x:Number(dimension.labelOffsetPx?.x || 0),y:Number(dimension.labelOffsetPx?.y ?? -16)};
  dimension.drivingValue = Number.isFinite(Number(dimension.drivingValue)) ? Number(dimension.drivingValue) : null;
  dimension.text = dimension.text === null || dimension.text === undefined ? null : String(dimension.text);
  dimension.semantic = dimension.semantic ? String(dimension.semantic) : null;
  dimension.chain = normalizeDimensionChain(dimension.chain);
  dimension.layout = normalizeDimensionLayout(dimension.layout);
  dimension.createdAt = dimension.createdAt || new Date().toISOString();
  return dimension;
}

export function normalizeDimensionType(value) {
  const type = String(value || DimensionType.LINEAR).toUpperCase();
  return Object.values(DimensionType).includes(type) ? type : DimensionType.LINEAR;
}

export function normalizeChainMode(value) {
  const mode = String(value || DimensionChainMode.SINGLE).toUpperCase();
  return Object.values(DimensionChainMode).includes(mode) ? mode : DimensionChainMode.SINGLE;
}

export function normalizeDimensionAnchor(anchor) {
  if (!anchor || typeof anchor !== 'object') return null;
  const type = String(anchor.type || '').toUpperCase();
  if (type === 'WORLD') return {type,point:normalizeVector(anchor.point)};
  if (type === 'PART_ORIGIN' && anchor.partId) return {type,partId:String(anchor.partId)};
  if (type === 'PART_BOUNDARY' && anchor.partId) return {type,partId:String(anchor.partId),axis:normalizeAxis(anchor.axis),side:String(anchor.side || 'MAX').toUpperCase() === 'MIN' ? 'MIN' : 'MAX'};
  if (type === 'PROFILE_END' && anchor.partId) return {type,partId:String(anchor.partId),end:String(anchor.end || 'START').toUpperCase() === 'END' ? 'END' : 'START'};
  if (type === 'PROFILE_ARC_CENTER' && anchor.partId) return {type,partId:String(anchor.partId)};
  if (type === 'PROFILE_ARC_STATION' && anchor.partId) return {type,partId:String(anchor.partId),stationRatio:clamp01(anchor.stationRatio ?? 0.5)};
  if (type === 'LOCAL_POINT' && anchor.partId) return {type,partId:String(anchor.partId),local:normalizeVector(anchor.local)};
  if (['MACHINING_POINT','MACHINING_STATION_POINT','MACHINING_FACE_CENTER'].includes(type) && anchor.partId && anchor.machiningId) {
    return {type,partId:String(anchor.partId),machiningId:String(anchor.machiningId)};
  }
  if (type === 'PROFILE_SLOT_CENTER' && anchor.partId) {
    return {type,partId:String(anchor.partId),face:normalizeFace(anchor.face),stationS:Number(anchor.stationS || 0),slotId:anchor.slotId ? String(anchor.slotId) : null};
  }
  return null;
}

export function normalizeDimensionBinding(binding) {
  if (!binding || typeof binding !== 'object') return null;
  const type = String(binding.type || '').toUpperCase();
  if (['PROFILE_LENGTH','PROFILE_RADIUS','PROFILE_ARC_ANGLE'].includes(type) && binding.partId) return {type,partId:String(binding.partId)};
  if (['MACHINING_STATION','MACHINING_OFFSET'].includes(type) && binding.partId && binding.machiningId) {
    const normalized = {type,partId:String(binding.partId),machiningId:String(binding.machiningId)};
    if (type === 'MACHINING_STATION') normalized.datumEnd = String(binding.datumEnd || 'START').toUpperCase() === 'END' ? 'END' : 'START';
    return normalized;
  }
  if (['PART_AXIS_DISTANCE','PART_AXIS_COORDINATE','PART_CLEARANCE'].includes(type) && binding.sourcePartId && binding.targetPartId) {
    const normalized = {type,sourcePartId:String(binding.sourcePartId),targetPartId:String(binding.targetPartId),axis:normalizeAxis(binding.axis)};
    if (type === 'PART_CLEARANCE') {
      normalized.sourceSide = String(binding.sourceSide || 'MAX').toUpperCase() === 'MIN' ? 'MIN' : 'MAX';
      normalized.targetSide = String(binding.targetSide || 'MIN').toUpperCase() === 'MAX' ? 'MAX' : 'MIN';
    }
    return normalized;
  }
  if (type === 'SLOT_CENTER_DISTANCE' && binding.sourcePartId && binding.targetPartId) {
    return {type,sourcePartId:String(binding.sourcePartId),targetPartId:String(binding.targetPartId),sourceFace:normalizeFace(binding.sourceFace),targetFace:normalizeFace(binding.targetFace),sourceStationS:Number(binding.sourceStationS || 0),targetStationS:Number(binding.targetStationS || 0),sourceSlotId:binding.sourceSlotId ? String(binding.sourceSlotId) : null,targetSlotId:binding.targetSlotId ? String(binding.targetSlotId) : null};
  }
  if (type === 'PROFILE_ANGLE' && binding.sourcePartId && binding.targetPartId) {
    return {type,sourcePartId:String(binding.sourcePartId),targetPartId:String(binding.targetPartId),axis:normalizeAxis(binding.axis || 'Y')};
  }
  throw new Error(`不支持的尺寸驱动类型：${type || 'EMPTY'}`);
}

export function normalizeDimensionChain(chain) {
  if (!chain || typeof chain !== 'object') return null;
  return {
    id:String(chain.id || crypto.randomUUID()),
    mode:normalizeChainMode(chain.mode),
    locked:chain.locked !== false,
    order:Math.max(0,Number(chain.order || 0)),
    axis:chain.axis ? normalizeAxis(chain.axis) : null,
    datumPartId:chain.datumPartId ? String(chain.datumPartId) : null,
    clearance:chain.clearance === true,
    baselineEnd:String(chain.baselineEnd || 'START').toUpperCase() === 'END' ? 'END' : 'START'
  };
}

export function normalizeDimensionLayout(layout) {
  if (!layout || typeof layout !== 'object') return {auto:true,axis:null,lane:0,side:-1};
  return {auto:layout.auto !== false,axis:layout.axis ? normalizeAxis(layout.axis) : null,lane:Math.max(0,Number(layout.lane || 0)),side:Number(layout.side || -1) >= 0 ? 1 : -1};
}

function uniqueMeshes(meshes) {
  return [...new Set(Array.isArray(meshes) ? meshes : [])];
}

function resolveChainAxis(meshes, requested) {
  const normalized = String(requested || 'AUTO').toUpperCase();
  if (['X','Y','Z'].includes(normalized)) return normalized;
  const ranges = ['X','Y','Z'].map(axis => {
    const values = meshes.map(mesh => worldCoordinate(mesh,axis));
    return {axis,range:Math.max(...values) - Math.min(...values)};
  }).sort((a,b) => b.range - a.range);
  return ranges[0]?.axis || 'Y';
}

function worldCoordinate(mesh,axis) {
  const key = String(axis || 'Y').toLowerCase();
  return Number(mesh?.position?.[key] ?? mesh?.userData?.part?.position?.[key] ?? 0);
}

function normalizeAxis(axis) {
  const value = String(axis || 'X').toUpperCase();
  return ['X','Y','Z'].includes(value) ? value : 'X';
}

function normalizeVector(value) {
  return {x:Number(value?.x || 0),y:Number(value?.y || 0),z:Number(value?.z || 0)};
}

function normalizeFace(face) {
  const value = String(face || 'FRONT').toUpperCase();
  return ['FRONT','BACK','LEFT','RIGHT'].includes(value) ? value : 'FRONT';
}

function clamp01(value) {
  return Math.min(1,Math.max(0,Number(value || 0)));
}
