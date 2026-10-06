import {isLinearProfile} from '../model/ProfilePath.js';

/**
 * Production collision check for straight aluminum profiles.
 *
 * The detector intentionally works on the profile envelope OBB instead of a
 * Three.js render mesh so helpers, machining markers and visual detail cannot
 * create false production collisions. Straight rectangular profile envelopes
 * are tested by the full 15-axis OBB SAT.
 */
export default class PartCollisionDetector {
  constructor(editor) {
    this.editor = editor;
  }

  inspect(options = {}) {
    const toleranceMm = Math.max(0, Number(options.toleranceMm ?? this.editor.projectSettings?.collisionToleranceMm ?? 0.5));
    const profiles = (this.editor.parts || [])
      .filter(part => part?.type === 'PROFILE' && isLinearProfile(part))
      .map(part => ({part, obb:profileObb(part)}))
      .filter(item => item.obb);
    const issues = [];

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const a = profiles[i];
        const b = profiles[j];
        const result = intersectObb(a.obb,b.obb,toleranceMm);
        if (!result.intersects) continue;
        issues.push({
          severity:'ERROR',
          code:'PROFILE_VOLUME_COLLISION',
          subject:`${label(a.part)} ↔ ${label(b.part)}`,
          message:`两根直型材发生体积穿透，最小估算穿透量约 ${round(result.minPenetrationMm)}mm`,
          partIds:[a.part.id,b.part.id],
          details:{minPenetrationMm:round(result.minPenetrationMm),axis:result.axis}
        });
      }
    }

    const curved = (this.editor.parts || []).filter(part => part?.type === 'PROFILE' && !isLinearProfile(part));
    if (curved.length) {
      issues.push({
        severity:'INFO',
        code:'CURVED_PROFILE_COLLISION_SCOPE',
        subject:'碰撞检查范围',
        message:`当前精确 OBB 穿透检查覆盖直型材；${curved.length} 根弯型材暂未参与精确实体碰撞判定`,
        partIds:curved.map(part => part.id)
      });
    }

    return summarize(issues);
  }
}

export function profileObb(part) {
  if (!part || part.type !== 'PROFILE' || !isLinearProfile(part)) return null;
  const section = part.dimensions?.sectionSize || [part.dimensions?.size || 0,part.dimensions?.size || 0];
  const width = Number(section[0] || 0);
  const height = Number(section[1] || 0);
  const length = Number(part.profilePath?.length ?? part.dimensions?.length ?? 0);
  if (![width,height,length].every(value => Number.isFinite(value) && value > 0)) return null;
  const matrix = rotationMatrixXYZ(part.rotation || {});
  return {
    center:vec(part.position),
    axes:[column(matrix,0),column(matrix,1),column(matrix,2)],
    half:[width/2,height/2,length/2]
  };
}

/** Full Separating Axis Theorem for two OBBs. */
export function intersectObb(a,b,toleranceMm = 0.5) {
  const EPS = 1e-8;
  const R = [[],[],[]];
  const AbsR = [[],[],[]];
  for (let i=0;i<3;i++) {
    for (let j=0;j<3;j++) {
      R[i][j] = dot(a.axes[i],b.axes[j]);
      AbsR[i][j] = Math.abs(R[i][j]) + EPS;
    }
  }
  const worldT = sub(b.center,a.center);
  const t = a.axes.map(axis => dot(worldT,axis));
  let minPenetration = Infinity;
  let minAxis = 'UNKNOWN';

  const test = (distance, ra, rb, axis) => {
    const overlap = ra + rb - Math.abs(distance);
    if (overlap <= toleranceMm) return false;
    if (overlap < minPenetration) { minPenetration = overlap; minAxis = axis; }
    return true;
  };

  for (let i=0;i<3;i++) {
    const rb = b.half[0]*AbsR[i][0] + b.half[1]*AbsR[i][1] + b.half[2]*AbsR[i][2];
    if (!test(t[i],a.half[i],rb,`A${i}`)) return {intersects:false,minPenetrationMm:0,axis:`A${i}`};
  }
  for (let j=0;j<3;j++) {
    const ra = a.half[0]*AbsR[0][j] + a.half[1]*AbsR[1][j] + a.half[2]*AbsR[2][j];
    const distance = t[0]*R[0][j] + t[1]*R[1][j] + t[2]*R[2][j];
    if (!test(distance,ra,b.half[j],`B${j}`)) return {intersects:false,minPenetrationMm:0,axis:`B${j}`};
  }

  for (let i=0;i<3;i++) {
    for (let j=0;j<3;j++) {
      const ra = a.half[(i+1)%3]*AbsR[(i+2)%3][j] + a.half[(i+2)%3]*AbsR[(i+1)%3][j];
      const rb = b.half[(j+1)%3]*AbsR[i][(j+2)%3] + b.half[(j+2)%3]*AbsR[i][(j+1)%3];
      const distance = t[(i+2)%3]*R[(i+1)%3][j] - t[(i+1)%3]*R[(i+2)%3][j];
      // Parallel edge cross-products are numerically degenerate; they cannot
      // provide a meaningful penetration depth, so skip depth bookkeeping.
      const axisLengthSq = Math.max(0,1-R[i][j]*R[i][j]);
      if (axisLengthSq < 1e-10) continue;
      const overlap = ra + rb - Math.abs(distance);
      if (overlap <= toleranceMm) return {intersects:false,minPenetrationMm:0,axis:`A${i}xB${j}`};
      const normalizedOverlap = overlap / Math.sqrt(axisLengthSq);
      if (normalizedOverlap < minPenetration) { minPenetration=normalizedOverlap; minAxis=`A${i}xB${j}`; }
    }
  }

  return {intersects:true,minPenetrationMm:Number.isFinite(minPenetration)?minPenetration:0,axis:minAxis};
}

export function pointInObbCoordinates(point,obb) {
  const delta=sub(vec(point),obb.center);
  return obb.axes.map(axis => dot(delta,axis));
}

/**
 * 沿单位方向平移至另一型材包络的首次接触距离，单位 mm。
 * 对全部 SAT 轴求允许平移区间的交集；横向错开的杆件不会被当作前方目标。
 * 这是表面间隙，不是中心距离，也不把外包络内的孔槽冒充精确实体。
 */
export function sweepObbContact(a,b,direction){
  if(!a||!b||!direction)return null;
  const length=Math.hypot(direction.x,direction.y,direction.z);
  if(!Number.isFinite(length)||length<1e-9)return null;
  const u=scale(direction,1/length),axes=[...a.axes,...b.axes];
  for(const x of a.axes)for(const y of b.axes){
    const n={x:x.y*y.z-x.z*y.y,y:x.z*y.x-x.x*y.z,z:x.x*y.y-x.y*y.x};
    const size=Math.hypot(n.x,n.y,n.z);if(size>1e-7)axes.push(scale(n,1/size));
  }
  let entry=-Infinity,exit=Infinity;
  const delta=sub(b.center,a.center);
  for(const n of axes){
    const radius=a.half.reduce((sum,h,i)=>sum+h*Math.abs(dot(a.axes[i],n)),0)+b.half.reduce((sum,h,i)=>sum+h*Math.abs(dot(b.axes[i],n)),0);
    const offset=dot(delta,n),speed=dot(u,n);
    if(Math.abs(speed)<1e-9){if(Math.abs(offset)>radius+1e-6)return null;continue;}
    const t1=(offset-radius)/speed,t2=(offset+radius)/speed;
    entry=Math.max(entry,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
    if(entry>exit+1e-6)return null;
  }
  if(exit<-1e-6||!Number.isFinite(entry))return null;
  // 已经贴合且朝远离方向移动时，不能把身后的零距离目标误称为前方障碍。
  if(exit<=1e-6&&entry<-1e-6)return null;
  return {distanceMm:Math.max(0,entry),overlapping:entry<-1e-6&&exit>1e-6};
}

export function profileEndpointWorld(part,end) {
  const obb=profileObb(part);
  if(!obb)return null;
  const sign=end==='START'?-1:1;
  return add(obb.center,scale(obb.axes[2],sign*obb.half[2]));
}

export function distancePointToObbSurface(point,obb,margin = 0) {
  const local=pointInObbCoordinates(point,obb);
  const half=obb.half;
  const insideOther=(axis)=>Math.abs(local[axis])<=half[axis]+margin;
  let best=null;
  for(let axis=0;axis<3;axis++){
    const other=[0,1,2].filter(value=>value!==axis);
    if(!insideOther(other[0])||!insideOther(other[1]))continue;
    for(const sign of [-1,1]){
      const signed=local[axis]-sign*half[axis];
      const distance=Math.abs(signed);
      if(!best||distance<best.distanceMm)best={distanceMm:distance,axis,sign,signedDistanceMm:signed,local};
    }
  }
  return best;
}

function rotationMatrixXYZ(rotation) {
  const x=Number(rotation.x||0), y=Number(rotation.y||0), z=Number(rotation.z||0);
  const a=Math.cos(x), b=Math.sin(x), c=Math.cos(y), d=Math.sin(y), e=Math.cos(z), f=Math.sin(z);
  // THREE.Euler order XYZ, equivalent to makeRotationFromEuler implementation.
  return [
    [c*e, -c*f, d],
    [a*f+b*d*e, a*e-b*d*f, -b*c],
    [b*f-a*d*e, b*e+a*d*f, a*c]
  ];
}
function column(m,index){return {x:m[0][index],y:m[1][index],z:m[2][index]};}
function vec(value){return {x:Number(value?.x||0),y:Number(value?.y||0),z:Number(value?.z||0)};}
function add(a,b){return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z};}
function sub(a,b){return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};}
function scale(a,s){return {x:a.x*s,y:a.y*s,z:a.z*s};}
function dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
function label(part){return part.displayId||part.name||part.id||'型材';}
function round(value){return Number(Number(value).toFixed(3));}
function summarize(issues){return {ok:!issues.some(item=>item.severity==='ERROR'),issues,errors:issues.filter(item=>item.severity==='ERROR'),warnings:issues.filter(item=>item.severity==='WARNING'),infos:issues.filter(item=>item.severity==='INFO')};}
