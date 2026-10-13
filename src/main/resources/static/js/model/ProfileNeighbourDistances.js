import * as THREE from 'three';
import {isLinearProfile} from './ProfilePath.js';
import {getDesignProfileDefinition} from './DesignProfileCatalog.js';
import {profileSidePlanes} from './ProfileFeatureCatalog.js';
import {profileObb,sweepObbContact} from '../validation/PartCollisionDetector.js';

const AXES=['X','Y','Z'];
const TOLERANCE=.1;

/** 只读邻距：包络仍来自业务截面/本体姿态，不把印字、孔标或选择框当作型材尺寸。 */
export function describeDistanceProfile(mesh){
  const part=mesh?.userData?.part;
  if(part?.type!=='PROFILE'||!isLinearProfile(part)||part.hidden||!isVisible(mesh))return null;
  if(getDesignProfileDefinition(part.designProfile?.profileId)?.shape!=='T_SLOT')return null;
  if(Object.values(part.endCuts||{}).some(c=>Math.abs(Number(c?.angleDeg||0))>1e-7))return null;
  mesh.updateWorldMatrix(true,false);
  const scale=mesh.getWorldScale(new THREE.Vector3()),q=mesh.getWorldQuaternion(new THREE.Quaternion());
  if([scale.x,scale.y,scale.z].some(v=>Math.abs(v-1)>1e-7))return null;
  const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(q));
  if(axes.some(v=>{
    const components=v.toArray().map(Math.abs);
    return Math.max(...components)<1-1e-7||components.filter(value=>value>1e-7).length!==1;
  }))return null;
  const center=mesh.getWorldPosition(new THREE.Vector3()),euler=new THREE.Euler().setFromQuaternion(q,'XYZ');
  const obb=profileObb({...part,position:{...center},rotation:{x:euler.x,y:euler.y,z:euler.z}});
  if(!obb)return null;
  const half=new THREE.Vector3();
  for(let i=0;i<3;i++)for(const key of ['x','y','z'])half[key]+=Math.abs(obb.axes[i][key])*obb.half[i];
  const min=center.clone().sub(half),max=center.clone().add(half);
  if([...min.toArray(),...max.toArray()].some(v=>!Number.isFinite(v)))return null;
  const axis=AXES.reduce((a,b)=>Math.abs(axes[2][a.toLowerCase()])>=Math.abs(axes[2][b.toLowerCase()])?a:b);
  return {mesh,part,axis,center,obb,min,max,planes:profileSidePlanes(mesh)};
}

/** 同框面由实际侧面平面及整面偏差确定，不按相机投影、组件名或“同一层编号”猜测。 */
function commonPlanes(a,b,axis){
  const direction=axisVector(axis),planes=[];
  for(const source of a.planes)for(const target of b.planes){
    const dot=source.normal.dot(target.normal);
    // 平行梁只认同向外表面，排除仅上下叠放而接触的另一层；垂直梁允许框侧两面相向。
    if(dot<.999999&&(a.axis===b.axis||dot>-.999999))continue;
    if(Math.abs(source.normal.dot(direction))>1e-7)continue;
    const deviation=Math.max(...source.corners.map(p=>Math.abs(target.normal.dot(p.clone().sub(target.point)))),
      ...target.corners.map(p=>Math.abs(source.normal.dot(p.clone().sub(source.point)))));
    if(deviation>TOLERANCE)continue;
    const normalAxis=AXES.reduce((x,y)=>Math.abs(source.normal[x.toLowerCase()])>=Math.abs(source.normal[y.toLowerCase()])?x:y);
    planes.push({sourceFace:source.face,targetFace:target.face,normalAxis,normal:source.normal.clone(),sourcePoint:source.point.clone(),targetPoint:target.point.clone()});
  }
  return planes;
}

/** 固定参照与方向的外包络净间距；目标必须在这侧且其余方向投影相交，不取斜向中心距。 */
export function profileDistanceRelation(source,target,axis,sign){
  const a=describeDistanceProfile(source),b=describeDistanceProfile(target);
  return relationFromProfiles(a,b,axis,sign);
}

function relationFromProfiles(a,b,axis,sign){
  if(!a||!b||a.part.id===b.part.id||!AXES.includes(axis)||![1,-1].includes(sign))return null;
  const key=axis.toLowerCase();
  const signedGap=sign===1?b.min[key]-a.max[key]:a.min[key]-b.max[key];
  if(signedGap<-TOLERANCE)return null;
  const planes=commonPlanes(a,b,axis);
  if(!planes.length)return null;
  const contact=sweepObbContact(a.obb,b.obb,axisVector(axis).multiplyScalar(sign));
  if(!contact)return null;
  return {source:a,target:b,axis,sign,signedGap,distanceMm:Math.max(0,contact.distanceMm),planes};
}

/** 各世界方向只取最近的一根，共最多六个邻距；每个输入始终引用明确的目标 ID。 */
export function nearestProfileDistances(source,targets){
  const a=describeDistanceProfile(source);if(!a)return [];
  const candidatesByPart=targets.map(describeDistanceProfile).filter(Boolean),rows=[];
  for(const axis of AXES)for(const sign of [-1,1]){
    const candidates=candidatesByPart.map(b=>relationFromProfiles(a,b,axis,sign)).filter(Boolean)
      .sort((a,b)=>a.distanceMm-b.distanceMm||String(a.target.part.displayId||a.target.part.id).localeCompare(String(b.target.part.displayId||b.target.part.id)));
    if(candidates.length)rows.push(candidates[0]);
  }
  return rows;
}

/** 箭头指包络外面；真实值不受为避让文字而平移的显示线影响。 */
export function distanceRelationPoints(relation,cameraPosition){
  const {source:a,target:b,axis,sign}=relation,key=axis.toLowerCase();
  const plane=[...relation.planes].sort((p,q)=>{
    const score=x=>x.normal.dot(cameraPosition.clone().sub(x.sourcePoint).normalize());
    return score(q)-score(p);
  })[0];
  const n=plane.normalAxis.toLowerCase(),other=['x','y','z'].find(k=>k!==key&&k!==n);
  const along=(Math.max(a.min[other],b.min[other])+Math.min(a.max[other],b.max[other]))/2;
  const start=a.center.clone(),end=b.center.clone();
  start[key]=sign===1?a.max[key]:a.min[key];end[key]=sign===1?b.min[key]:b.max[key];
  start[n]=plane.sourcePoint[n];end[n]=plane.targetPoint[n];start[other]=end[other]=along;
  return {start,end,normal:plane.normal.clone()};
}

export function axisVector(axis){return new THREE.Vector3(axis==='X'?1:0,axis==='Y'?1:0,axis==='Z'?1:0);}
function isVisible(mesh){for(let node=mesh;node;node=node.parent)if(node.visible===false)return false;return true;}
