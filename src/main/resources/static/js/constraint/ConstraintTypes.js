export const ConstraintKind = Object.freeze({
  COINCIDENT:'COINCIDENT',
  DISTANCE:'DISTANCE',
  ANGLE:'ANGLE',
  SLOT_CENTER:'SLOT_CENTER',
  AXIS_NORMAL:'AXIS_NORMAL',
  END_COINCIDENT:'END_COINCIDENT',
  SLOT_TO_SLOT:'SLOT_TO_SLOT',
  PARALLEL:'PARALLEL',
  PERPENDICULAR:'PERPENDICULAR',
  COAXIAL:'COAXIAL',
  COPLANAR:'COPLANAR',
  SLIDER:'SLIDER',
  REVOLUTE:'REVOLUTE',
  CYLINDRICAL:'CYLINDRICAL'
});

const ALIASES = Object.freeze({
  CONCENTRIC:'COAXIAL',
  CYLINDER:'CYLINDRICAL',
  HINGE:'REVOLUTE',
  PRISMATIC:'SLIDER'
});

export function normalizeConstraintKind(value, fallback='COINCIDENT') {
  const raw=String(value || fallback).trim().toUpperCase();
  return ALIASES[raw] || raw;
}

export function constraintKindLabel(value) {
  const kind=normalizeConstraintKind(value);
  return ({
    COINCIDENT:'面贴合',DISTANCE:'距离',ANGLE:'角度',SLOT_CENTER:'槽中心',AXIS_NORMAL:'端面垂直',
    END_COINCIDENT:'端面对接',SLOT_TO_SLOT:'槽对槽',PARALLEL:'平行',PERPENDICULAR:'垂直',
    COAXIAL:'同轴',COPLANAR:'共面',SLIDER:'滑块副',REVOLUTE:'转轴副',CYLINDRICAL:'圆柱副'
  })[kind] || kind;
}

export function isKinematicJointKind(value) {
  return ['SLIDER','REVOLUTE','CYLINDRICAL'].includes(normalizeConstraintKind(value));
}

export function semanticDofReductionForKind(value) {
  const kind=normalizeConstraintKind(value);
  if (kind==='PARALLEL') return 2;
  if (kind==='PERPENDICULAR' || kind==='ANGLE') return 1;
  if (kind==='COAXIAL' || kind==='CYLINDRICAL') return 4;
  if (kind==='COPLANAR') return 3;
  if (kind==='SLIDER' || kind==='REVOLUTE') return 5;
  if (['SLOT_TO_SLOT','END_COINCIDENT','COINCIDENT','DISTANCE','SLOT_CENTER','AXIS_NORMAL'].includes(kind)) return 5;
  return 6;
}
