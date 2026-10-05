export const PROFILE_COORDINATE_SYSTEM_VERSION = 1;

export const ProfileCoordinateSystem = Object.freeze({
  version: PROFILE_COORDINATE_SYSTEM_VERSION,
  unit: 'mm',
  lengthAxis: 'Z',
  sectionWidthAxis: 'X',
  sectionHeightAxis: 'Y',
  start: Object.freeze({code: 'START', drawingName: 'A', sign: -1}),
  end: Object.freeze({code: 'END', drawingName: 'B', sign: 1}),
  faces: Object.freeze({
    FRONT: Object.freeze({normalAxis: 'Y', normalSign: 1, offsetAxis: 'X'}),
    BACK: Object.freeze({normalAxis: 'Y', normalSign: -1, offsetAxis: 'X'}),
    RIGHT: Object.freeze({normalAxis: 'X', normalSign: 1, offsetAxis: 'Y'}),
    LEFT: Object.freeze({normalAxis: 'X', normalSign: -1, offsetAxis: 'Y'})
  })
});

export const PROFILE_FACE_CODES = Object.freeze(Object.keys(ProfileCoordinateSystem.faces));
export const PROFILE_END_CODES = Object.freeze(['START','END']);

export function stationToLocalZ(length, station) {
  return -Number(length) / 2 + Number(station);
}

export function localZToStation(length, localZ) {
  return Number(localZ) + Number(length) / 2;
}

export function endToLocalZ(length, end) {
  return end === 'END' ? Number(length) / 2 : -Number(length) / 2;
}

export function getFaceOffset(localPoint, face) {
  if (face === 'FRONT' || face === 'BACK') return Number(localPoint.x);
  if (face === 'LEFT' || face === 'RIGHT') return Number(localPoint.y);
  throw new Error(`未知型材面：${face}`);
}

export function getFaceHalfSpan(sectionSize, face) {
  const width = Number(sectionSize?.[0] || 0);
  const height = Number(sectionSize?.[1] || 0);
  if (face === 'FRONT' || face === 'BACK') return width / 2;
  if (face === 'LEFT' || face === 'RIGHT') return height / 2;
  return 0;
}

export function getFaceSurfaceOffset(sectionSize, face) {
  const width = Number(sectionSize?.[0] || 0);
  const height = Number(sectionSize?.[1] || 0);
  if (face === 'FRONT') return {axis:'y', value:height / 2};
  if (face === 'BACK') return {axis:'y', value:-height / 2};
  if (face === 'RIGHT') return {axis:'x', value:width / 2};
  if (face === 'LEFT') return {axis:'x', value:-width / 2};
  return null;
}

export function isProfileFace(face) {
  return PROFILE_FACE_CODES.includes(face);
}

export function isProfileEnd(end) {
  return PROFILE_END_CODES.includes(end);
}

export function createProjectCoordinateDescriptor() {
  return {
    version: PROFILE_COORDINATE_SYSTEM_VERSION,
    unit: 'mm',
    lengthAxis: 'Z',
    sectionWidthAxis: 'X',
    sectionHeightAxis: 'Y',
    profileLocalAxes: {
      X: '截面宽度方向',
      Y: '截面高度方向',
      Z: '型材长度方向 A→B'
    },
    ends: {
      START: 'A端 / local Z-',
      END: 'B端 / local Z+'
    },
    faces: {
      FRONT: 'local Y+',
      BACK: 'local Y-',
      RIGHT: 'local X+',
      LEFT: 'local X-'
    },
    machining: {
      stationField: 'distanceFromStart',
      stationMeaning: '从A端沿型材中心线量取的距离',
      offsetMeaning: '在加工面内，以截面中心线为0的偏移'
    }
  };
}
