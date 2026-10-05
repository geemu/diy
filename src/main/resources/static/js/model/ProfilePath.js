export function normalizeProfilePath(part) {
  if (!part || part.type !== 'PROFILE') return null;
  if (!part.profilePath) {
    part.profilePath = {type:'LINE', length:Number(part.dimensions?.length || 500)};
  }
  const path = part.profilePath;
  if (path.type === 'ARC') {
    path.radius = Math.max(1, Number(path.radius || 1000));
    path.angleDeg = Math.max(0.1, Math.min(360, Number(path.angleDeg || 90)));
    path.plane = path.plane === 'YZ' ? 'YZ' : 'XZ';
    part.dimensions.length = getDevelopedLength(path);
  } else {
    path.type = 'LINE';
    path.length = Math.max(1, Number(path.length || part.dimensions?.length || 500));
    part.dimensions.length = path.length;
  }
  return path;
}

export function getDevelopedLength(path) {
  if (!path || path.type !== 'ARC') return Number(path?.length || 0);
  return Number(path.radius) * Number(path.angleDeg) * Math.PI / 180;
}

export function getPathMetrics(part) {
  const path = normalizeProfilePath(part);
  if (path.type === 'LINE') {
    return {type:'LINE', developedLength:path.length, chord:path.length, sagitta:0};
  }
  const a = path.angleDeg * Math.PI / 180;
  const chord = 2 * path.radius * Math.sin(a / 2);
  const sagitta = path.radius * (1 - Math.cos(a / 2));
  const [w,h] = part.dimensions.sectionSize;
  const half = path.plane === 'YZ' ? h / 2 : w / 2;
  return {
    type:'ARC', radius:path.radius, angleDeg:path.angleDeg, plane:path.plane,
    developedLength:getDevelopedLength(path), chord, sagitta,
    innerRadius:Math.max(0, path.radius - half), outerRadius:path.radius + half
  };
}

export function getLocalEndpoints(part) {
  const path = normalizeProfilePath(part);
  if (path.type === 'LINE') {
    return {start:[0,0,-path.length/2], end:[0,0,path.length/2]};
  }
  const a = path.angleDeg * Math.PI / 180 / 2;
  const x = path.radius * (1 - Math.cos(a));
  const z = path.radius * Math.sin(a);
  if (path.plane === 'YZ') return {start:[0,x,-z], end:[0,x,z]};
  return {start:[x,0,-z], end:[x,0,z]};
}


export function getLocalFrameAtStation(part, stationMm) {
  const path = normalizeProfilePath(part);
  const length = Number(part.dimensions?.length || getDevelopedLength(path) || 0);
  const station = Math.max(0, Math.min(length, Number(stationMm || 0)));
  if (path.type === 'LINE') {
    return {
      station,
      point:[0,0,-length/2 + station],
      rotation:{axis:'NONE',angleRad:0},
      tangent:[0,0,1]
    };
  }
  const total = Number(path.angleDeg) * Math.PI / 180;
  const theta = -total / 2 + station / Number(path.radius);
  const bulge = Number(path.radius) * (1 - Math.cos(theta));
  const z = Number(path.radius) * Math.sin(theta);
  if (path.plane === 'YZ') {
    return {
      station,
      point:[0,bulge,z],
      rotation:{axis:'X',angleRad:-theta},
      tangent:[0,Math.sin(theta),Math.cos(theta)]
    };
  }
  return {
    station,
    point:[bulge,0,z],
    rotation:{axis:'Y',angleRad:theta},
    tangent:[Math.sin(theta),0,Math.cos(theta)]
  };
}

export function isLinearProfile(part) {
  return normalizeProfilePath(part)?.type === 'LINE';
}

export function getPathLabel(part) {
  const m = getPathMetrics(part);
  return m.type === 'LINE' ? `直线 L=${round(m.developedLength)}mm` : `圆弧 R${round(m.radius)} / ${round(m.angleDeg)}° / ${m.plane}`;
}

function round(value) { return Number(Number(value).toFixed(2)); }
