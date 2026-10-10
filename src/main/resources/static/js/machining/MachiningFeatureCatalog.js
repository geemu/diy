import {getSlotDefinitionsForFace} from '../model/ProfileFeatureCatalog.js';
import {getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';
import {getSectionDefinition} from '../model/ProfileSectionRegistry.js';

const endBoreReferences = new WeakMap();

export const MACHINING_FEATURE_VERSION = 1;

/** 新手打孔的横向默认位置；长度站位不在这里修改，默认值不是永久槽位约束。 */
export function centeredHoleOffset(part,face,hint=0) {
  const slots=getSlotDefinitionsForFace(part,face).filter(slot=>Number.isFinite(Number(slot.offset)));
  if(!slots.length)return 0;
  const value=Number.isFinite(Number(hint))?Number(hint):0;
  return Number(slots.reduce((best,slot)=>Math.abs(Number(slot.offset)-value)<Math.abs(Number(best.offset)-value)?slot:best).offset);
}

/**
 * 加工辅助中线：整体中线加目录中各单元的中心，不等同于开放槽或永久加工约束。
 * 3060长边的目录单元为-15/+15，再加整体0；未知截面只提示已知的整体中心。
 */
export function machiningCenterOffsets(part,face) {
  const definition=getDesignProfileDefinition(part?.designProfile?.profileId);
  const acrossWidth=['FRONT','BACK'].includes(face),faces=acrossWidth?['FRONT','BACK']:['LEFT','RIGHT'];
  const span=Number(part?.dimensions?.sectionSize?.[acrossWidth?0:1]||0);
  const values=[0,...(definition?.slotDefinitions||[]).filter(slot=>faces.includes(slot.face)).map(slot=>Number(slot.offset))];
  return [...new Set(values.filter(value=>Number.isFinite(value)&&Math.abs(value)<=span/2+1e-6))].sort((a,b)=>a-b);
}

/** 只读实际截面中的完整圆孔；矩形空腔、T槽和单元辅助中线不冒充原孔。 */
export function machiningEndBores(part) {
  const section=getSectionDefinition(part?.designProfile?.profileId,part?.designProfile?.faceClosures||[]);
  if(!section)return [];
  let references=endBoreReferences.get(section);
  if(!references) {
    references=(section.holes||[]).map(circularBoreReference).filter(Boolean);
    endBoreReferences.set(section,references);
  }
  return references;
}

function circularBoreReference(ring) {
  const outline=(ring||[]).map(point=>({x:Number(point.x),y:Number(point.y)}));
  if(outline.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))return null;
  if(outline.length>1&&Math.hypot(outline[0].x-outline.at(-1).x,outline[0].y-outline.at(-1).y)<1e-8)outline.pop();
  if(outline.length<8)return null;
  const meanX=outline.reduce((sum,point)=>sum+point.x,0)/outline.length,meanY=outline.reduce((sum,point)=>sum+point.y,0)/outline.length;
  let xx=0,xy=0,yy=0,xr=0,yr=0;
  for(const point of outline) {
    const x=point.x-meanX,y=point.y-meanY,squared=x*x+y*y;
    xx+=x*x;xy+=x*y;yy+=y*y;xr+=x*squared;yr+=y*squared;
  }
  const determinant=xx*yy-xy*xy;
  if(!Number.isFinite(determinant)||determinant<=1e-12)return null;
  const offsetX=meanX+(xr*yy-yr*xy)/(2*determinant),offsetY=meanY+(yr*xx-xr*xy)/(2*determinant);
  const radii=outline.map(point=>Math.hypot(point.x-offsetX,point.y-offsetY)),radius=radii.reduce((sum,value)=>sum+value,0)/radii.length;
  if(!Number.isFinite(radius)||radius<.05||radii.some(value=>Math.abs(value-radius)>Math.max(1e-4,radius*.015)))return null;
  // 要求轮廓按同向走完一圈，拒绝局部圆弧、重复弧和自交近圆多边形。
  let turn=0,direction=0;
  for(let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length];
    const angle=Math.atan2((a.x-offsetX)*(b.y-offsetY)-(a.y-offsetY)*(b.x-offsetX),(a.x-offsetX)*(b.x-offsetX)+(a.y-offsetY)*(b.y-offsetY));
    if(Math.abs(angle)<1e-8||Math.abs(angle)>Math.PI/2+1e-6)return null;
    if(direction&&Math.sign(angle)!==direction)return null;
    direction=Math.sign(angle);turn+=angle;
  }
  if(Math.abs(Math.abs(turn)-Math.PI*2)>1e-5)return null;
  return {offsetX:Math.abs(offsetX)<1e-8?0:offsetX,offsetY:Math.abs(offsetY)<1e-8?0:offsetY,radius,outline,centerLabel:'原有圆孔中心'};
}

export const MachiningFeatureType = Object.freeze({
  THROUGH_HOLE:'THROUGH_HOLE',
  COUNTERSINK:'COUNTERSINK',
  COUNTERBORE:'COUNTERBORE',
  BLIND_HOLE:'BLIND_HOLE',
  TAPPED_HOLE:'TAPPED_HOLE',
  SLOT:'SLOT',
  OBROUND_SLOT:'OBROUND_SLOT',
  MILLING_REGION:'MILLING_REGION',
  END_TAP:'END_TAP',
  END_HOLE:'END_HOLE',
  END_COUNTERBORE:'END_COUNTERBORE',
  END_COUNTERSINK:'END_COUNTERSINK'
});

export const MachiningDatumType = Object.freeze({
  A_END:'A_END',
  B_END:'B_END',
  FACE_CENTER:'FACE_CENTER',
  SLOT_CENTER:'SLOT_CENTER',
  END_FACE:'END_FACE'
});

const FACE_TYPES = new Set(['FRONT','BACK','LEFT','RIGHT']);
const END_TYPES = new Set(['END_TAP','END_HOLE','END_COUNTERBORE','END_COUNTERSINK']);
const SLOT_TYPES = new Set(['SLOT','OBROUND_SLOT']);

export function isEndMachiningFeature(itemOrType) {
  const type = typeof itemOrType === 'string' ? itemOrType : itemOrType?.type;
  return END_TYPES.has(String(type || '').toUpperCase());
}

export function isSlotMachiningFeature(itemOrType) {
  const type = typeof itemOrType === 'string' ? itemOrType : itemOrType?.type;
  return SLOT_TYPES.has(String(type || '').toUpperCase());
}

export function normalizeMachiningFeature(item, part = null) {
  if (!item || typeof item !== 'object') return item;
  item.type = String(item.type || '').toUpperCase();
  item.featureVersion = MACHINING_FEATURE_VERSION;
  item.featureType = item.type;
  if (!item.featureGroupId && item.linkedHoleId) item.featureGroupId = String(item.linkedHoleId);

  if (isEndMachiningFeature(item)) {
    item.end = String(item.end || 'START').toUpperCase() === 'END' ? 'END' : 'START';
    item.offsetX = Number(item.offsetX || 0);
    item.offsetY = Number(item.offsetY || 0);
    item.referenceDatum = 'END_FACE';
    item.reference = {
      datum:'END_FACE',
      end:item.end,
      offsetX:item.offsetX,
      offsetY:item.offsetY
    };
    return item;
  }

  item.face = FACE_TYPES.has(String(item.face || '').toUpperCase()) ? String(item.face).toUpperCase() : 'FRONT';
  const station = Number(item.stationS ?? item.distanceFromStart ?? 0);
  item.stationS = Number.isFinite(station) ? station : 0;
  item.distanceFromStart = item.stationS;
  item.offset = Number(item.offset || 0);

  if (isSlotMachiningFeature(item)) {
    item.length = Math.max(0, Number(item.length ?? item.slotLength ?? 30));
    item.width = Math.max(0, Number(item.width ?? item.slotWidth ?? 8));
    item.orientation = String(item.orientation || 'ALONG_PROFILE').toUpperCase() === 'CROSS_PROFILE' ? 'CROSS_PROFILE' : 'ALONG_PROFILE';
    item.depth = Number(item.depth || 0);
  }
  if (item.type === 'MILLING_REGION') {
    item.length = Math.max(0, Number(item.length ?? 30));
    item.width = Math.max(0, Number(item.width ?? 20));
    item.depth = Math.max(0, Number(item.depth ?? 2));
    item.cornerRadius = Math.max(0, Number(item.cornerRadius || 0));
    item.orientation = String(item.orientation || 'ALONG_PROFILE').toUpperCase() === 'CROSS_PROFILE' ? 'CROSS_PROFILE' : 'ALONG_PROFILE';
  }

  const datum = normalizeDatum(item.referenceDatum || item.reference?.datum || 'A_END');
  item.referenceDatum = datum;
  item.reference = {
    datum,
    face:item.face,
    stationS:item.stationS,
    offset:item.offset,
    slotId:datum === 'SLOT_CENTER' ? (item.reference?.slotId || item.slotId || null) : null
  };
  if (datum !== 'SLOT_CENTER') delete item.slotId;
  if (part?.profilePath?.type === 'ARC') item.reference.pathType = 'ARC';
  return item;
}

export function normalizeDatum(value) {
  const datum = String(value || 'A_END').toUpperCase();
  return Object.values(MachiningDatumType).includes(datum) ? datum : 'A_END';
}

export function featureFootprint(item) {
  if (!item || isEndMachiningFeature(item)) return null;
  const type = String(item.type || '').toUpperCase();
  let stationHalf = 0;
  let offsetHalf = 0;
  if (type === 'SLOT' || type === 'OBROUND_SLOT' || type === 'MILLING_REGION') {
    const length = Math.max(0, Number(item.length || 0));
    const width = Math.max(0, Number(item.width || 0));
    if (item.orientation === 'CROSS_PROFILE') {
      stationHalf = width / 2;
      offsetHalf = length / 2;
    } else {
      stationHalf = length / 2;
      offsetHalf = width / 2;
    }
  } else {
    const diameter = effectiveDiameter(item);
    stationHalf = diameter / 2;
    offsetHalf = diameter / 2;
  }
  return {
    station:Number(item.stationS ?? item.distanceFromStart ?? 0),
    offset:Number(item.offset || 0),
    stationHalf,
    offsetHalf
  };
}

export function effectiveDiameter(item) {
  if (!item) return 0;
  if (item.type === 'COUNTERSINK' || item.type === 'END_COUNTERSINK') return Number(item.majorDiameter ?? item.diameter ?? 0);
  return Number(item.diameter || 0);
}

export function machiningFeatureLabel(itemOrType) {
  const item = typeof itemOrType === 'string' ? {type:itemOrType} : (itemOrType || {});
  const names = {
    THROUGH_HOLE:'通孔',COUNTERSINK:'沉头',COUNTERBORE:'沉孔',BLIND_HOLE:'盲孔',TAPPED_HOLE:'螺纹孔',
    SLOT:'槽加工',OBROUND_SLOT:'腰孔',MILLING_REGION:'铣削区域',END_TAP:'端面攻丝',END_HOLE:'端面孔',
    END_COUNTERBORE:'端面沉孔',END_COUNTERSINK:'端面沉头'
  };
  return names[item.type] || item.type || '加工特征';
}
