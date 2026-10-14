import * as THREE from 'three';
import {slotWorldNormal} from '../model/SlotMatcher.js';
import {profileSidePlanes,getSlotDefinitionsForFace} from '../model/ProfileFeatureCatalog.js';
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
export function automaticConnectionChoice(solution,source,planes,target=null) {
  const emptyEnd=emptyEndSlotChoice(solution,source,target);if(emptyEnd)return emptyEnd;
  const kind=solution.definition.dimensions.geometryKind;
  if(!solution.checked?.valid||!solution.envelope)return {valid:false,code:solution.checked?.failureCode||'INSTALLATION_INVALID',message:solution.checked?.message||'当前位置没有合法安装面'};
  if(kind==='HIDDEN_CORNER')return {valid:true,score:60};
  if(!['CORNER_CUBE','ANGLE_BRACKET'].includes(kind))return {valid:false,code:'AUTO_COMPONENT_UNSUPPORTED',message:'自动模式仅尝试已适配安装规则的角码、90°直角件和内置角槽件'};
  if(planes.unknownSupport)return {valid:false,code:'SUPPORT_PLANE_UNKNOWN',message:'当前截面没有可确认的水平承托面，未自动放置外置连接件'};
  const envelope=solution.envelope;
  const top=envelope.center.y+envelope.axes.reduce((sum,axis,index)=>sum+Math.abs(axis.y)*envelope.half[index],0);
  if(planes.some(plane=>top>plane.height+.10001))return {valid:false,code:'SUPPORT_PLANE_OBSTRUCTED',expectedSkip:true,message:'外置连接件会凸出当前层的梁上表面；已按承托面留平规则跳过'};
  const normal=slotWorldNormal(source,solution.mountFace);
  const score=normal.y<-.99999?0:30;
  // 侧贴/外侧角优先真实通过校验的直角件；普通梁端仍保留原角码顺序，失败时继续尝试其他合法规格。
  const sideMount=solution.checked.item?.geometry?.jointKind==='SIDE_MOUNT';
  return {valid:true,score:score+(kind==='ANGLE_BRACKET'?(sideMount?-10:10):0)};
}

/** 顶 / 底柱端朝外没有槽段是无需安装，不是腿长不足；只读原真实安装交线，不猜整架上下或放宽安装。 */
export function emptyEndSlotChoice(solution,source,target){
  const checked=solution.checked,geometry=checked?.item?.geometry,transform=checked?.transform;
  const kind=solution.definition?.dimensions?.geometryKind,face=checked?.target?.feature?.face;
  if(checked?.valid!==false||!transform||!geometry?.componentPorts||!source||!target||!face||!solution.mountFace||
    !['HIDDEN_CORNER','CORNER_CUBE','ANGLE_BRACKET'].includes(kind)||solution.sideMount||solution.sideSlot||['SIDE_MOUNT','SIDE_SLOT'].includes(geometry.jointKind))return null;
  const endErrors=new Set(['HIDDEN_COMPONENT_END_OUT_OF_RANGE','COMPONENT_PORT_NOT_ALIGNED','COMPONENT_FOOTPRINT_OUT_OF_RANGE','PROFILE_END_OUT_OF_SUPPORT']);
  // 真实穿透、未贴合、错误方向、未知截面等优先；不能用一个零槽长条件盖住其他失败。
  if(!endErrors.has(checked.failureCode)||(geometry.errors||[]).some(error=>!endErrors.has(error.code)))return null;
  source.updateMatrixWorld(true);target.updateMatrixWorld(true);
  const sourceAxis=new THREE.Vector3(0,0,1).transformDirection(source.matrixWorld),targetAxis=new THREE.Vector3(0,0,1).transformDirection(target.matrixWorld);
  const direction=slotWorldNormal(source,solution.mountFace),alignment=direction.dot(targetAxis);
  if(Math.abs(sourceAxis.y)>.00001||Math.abs(targetAxis.y)<.99999||Math.abs(alignment)<.99999)return null;
  const sourcePart=source.userData.part,targetPart=target.userData.part,length=Number(targetPart.dimensions?.length);
  if(!Number.isFinite(length)||length<=0)return null;
  const origin=target.worldToLocal(transform.position.clone()),available=alignment>0?length/2-origin.z:origin.z+length/2;
  // 与槽内脚端部边界共用0.0001mm数值容差；仍有正槽长但不足的方向继续报告，不把越界安装点当正常端齐平。
  if(!Number.isFinite(available)||Math.abs(available)>.0001)return null;
  for(const mesh of [source,target]){
    const part=mesh.userData.part,scale=mesh.getWorldScale(new THREE.Vector3());
    if([scale.x,scale.y,scale.z].some(value=>Math.abs(value-1)>.00001)||['START','END'].some(end=>Math.abs(Number(part.endCuts?.[end]?.angleDeg||0))>.001))return null;
    if(!getSectionDefinition(part.designProfile?.profileId,part.designProfile?.faceClosures||[])?.outer?.length)return null;
  }
  if(!getSlotDefinitionsForFace(sourcePart,solution.mountFace).length||!getSlotDefinitionsForFace(targetPart,face).length)return null;
  return {valid:false,code:'SLOT_END_NO_AVAILABLE_LENGTH',expectedSkip:true,message:'立柱端齐平处朝外没有可用槽段，已按端部槽长规则跳过该安装方向'};
}

/** 报告只过滤这两类明确正常政策，不把普通端距不足 / 未知条件当跳过。 */
export function isExpectedConnectionSkip(code){
  return code==='SUPPORT_PLANE_OBSTRUCTED'||code==='SLOT_END_NO_AVAILABLE_LENGTH';
}
