import * as THREE from 'three';
import {slotWorldNormal} from '../model/SlotMatcher.js';
import {profileSidePlanes} from '../model/ProfileFeatureCatalog.js';
import {getSectionDefinition} from '../model/ProfileSectionRegistry.js';

/** 自动选型只看当前接头的真实承托面；每层梁独立，不取整架最高点或镜头上下。 */
export function connectionSupportPlanes(source,target) {
  const result=[],up=new THREE.Vector3(0,1,0);
  for(const mesh of [source,target]){
    mesh.updateMatrixWorld(true);
    if(Math.abs(new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld).dot(up))>.00001)continue;
    const plane=profileSidePlanes(mesh).find(value=>value.normal.dot(up)>.99999);
    if(!plane){result.unknownSupport=true;continue;}
    const part=mesh.userData.part,section=getSectionDefinition(part.designProfile?.profileId,part.designProfile?.faceClosures||[]);
    const coordinate=p=>['FRONT','BACK'].includes(plane.face)?p.y:p.x;
    const boundary=(['FRONT','BACK'].includes(plane.face)?part.dimensions.sectionSize[1]:part.dimensions.sectionSize[0])/2*(['BACK','LEFT'].includes(plane.face)?-1:1);
    // 圆弧轮廓最高点不是一整块放物面；必须确有位于边界上的材料直边。
    const materialPlane=section?.outer?.some((a,index)=>{const b=section.outer[(index+1)%section.outer.length];return Math.abs(coordinate(a)-boundary)<.00001&&Math.abs(coordinate(b)-boundary)<.00001&&Math.hypot(a.x-b.x,a.y-b.y)>.1;});
    if(materialPlane)result.push({height:plane.point.y});else result.unknownSupport=true;
  }
  return result;
}

/** 已通过孔槽/实际空腔/支撑/空间校验后才选型；不可安装不是低评分的备用选项。 */
export function automaticConnectionChoice(solution,source,planes) {
  const kind=solution.definition.dimensions.geometryKind;
  if(!solution.checked?.valid||!solution.envelope)return {valid:false,message:solution.checked?.message||'当前位置没有合法安装面'};
  if(kind==='HIDDEN_CORNER')return {valid:true,score:60};
  if(kind!=='CORNER_CUBE')return {valid:false,message:'自动模式只使用普通角码或槽内隐藏件'};
  if(planes.unknownSupport)return {valid:false,message:'当前截面没有可确认的水平承托面，未自动放置外置角码'};
  const envelope=solution.envelope;
  const top=envelope.center.y+envelope.axes.reduce((sum,axis,index)=>sum+Math.abs(axis.y)*envelope.half[index],0);
  if(planes.some(plane=>top>plane.height+.10001))return {valid:false,message:'角码会凸出当前层的梁上表面；该侧仅使用能装入槽内的隐藏件'};
  const normal=slotWorldNormal(source,solution.mountFace);
  return {valid:true,score:normal.y<-.99999?0:30};
}
