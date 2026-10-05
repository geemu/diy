export const MACHINING_FEATURE_VERSION = 1;

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
