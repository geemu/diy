import * as THREE from 'three';
import {isLinearProfile} from '../model/ProfilePath.js';
import {profileSeries} from '../model/DesignProfileCatalog.js';
import {endCut} from '../model/ProfileEndContact.js';
import {getSlotDefinitionsForFace} from '../model/ProfileFeatureCatalog.js';
import {getFaceSurfaceOffset} from '../model/ProfileCoordinateSystem.js';
import {slotWorldNormal,slotWorldPoint,matchNearestSlot,slotReference} from '../model/SlotMatcher.js';
import {flatConnectionPlateLayout} from '../model/ConnectionComponentPorts.js';

const faces=['FRONT','BACK','LEFT','RIGHT'];
const axisWorld=mesh=>new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld);

/** 共面侧槽是独立关系：原梁端角码 / 梁下侧贴仍保留。偏移均为各宿主截面局部坐标。 */
export function normalizeSideSlot(value) {
  if(!value||!faces.includes(value.sourceFace)||![value.sourceSlotOffset,value.targetSlotOffset].every(Number.isFinite))return null;
  return {sourceFace:value.sourceFace,sourceSlotOffset:value.sourceSlotOffset,targetSlotOffset:value.targetSlotOffset};
}
export function sideSlotKey(sourceId,targetId,end,targetFace,reference) {
  return ['SIDE_SLOT',sourceId,targetId,end,targetFace,reference?.sourceFace,reference?.sourceSlotOffset,reference?.targetSlotOffset].join('|');
}

/** 只适配水平直梁 / 竖直柱的方切、未缩放姿态；不把错台面或悬空板件当共面连接。 */
function supportedPair(source,target) {
  const sp=source?.userData?.part,tp=target?.userData?.part;
  if(source===target||sp?.type!=='PROFILE'||tp?.type!=='PROFILE'||!isLinearProfile(sp)||!isLinearProfile(tp))return false;
  if([sp,tp].some(part=>!Array.isArray(part.dimensions?.sectionSize)||part.dimensions.sectionSize.length!==2||![...part.dimensions.sectionSize,part.dimensions.length].every(value=>Number.isFinite(value)&&value>0)))return false;
  source.updateMatrixWorld(true);target.updateMatrixWorld(true);
  if([source,target].some(mesh=>mesh.matrixWorld.determinant()<0||new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).toArray().some(value=>Math.abs(value-1)>.00001)))return false;
  if([sp,tp].some(part=>['START','END'].some(end=>Math.abs(endCut(part,end).tangent)>.00001)))return false;
  return Math.abs(axisWorld(source).y)<.00001&&Math.abs(axisWorld(target).y)>.99999;
}

/** 板的两孔分居真实梁端与柱槽；板厚全部在材料外侧，不用目标中心重置源端定位。 */
export function sideSlotTransform(connection,source,target) {
  const reference=normalizeSideSlot(connection.sideSlot),layout=flatConnectionPlateLayout(connection.designComponent?.dimensions);
  if(!reference||!layout||!supportedPair(source,target)||!faces.includes(connection.targetFace))return null;
  const part=source.userData.part,normal=slotWorldNormal(source,reference.sourceFace),targetNormal=slotWorldNormal(target,connection.targetFace);
  if(normal.dot(targetNormal)<.99999||Math.abs(normal.y)>.00001)return null;
  const slot=getSlotDefinitionsForFace(part,reference.sourceFace).find(value=>Math.abs(value.offset-reference.sourceSlotOffset)<.00001);
  if(!slot)return null;
  const end=connection.sourceEnd==='END'?'END':'START',stationS=end==='END'?Number(part.dimensions.length):0;
  const position=slotWorldPoint(source,{...slot,stationS}).addScaledVector(normal,layout.thickness/2);
  const y=axisWorld(source).multiplyScalar(end==='END'?1:-1),z=normal,x=y.clone().cross(z).normalize();
  return {position,quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))};
}

/** 每半块板必须完整落在对应宿主侧面内，包含端边与柱的真实宽度；孔口落槽不能代替支撑。 */
function halfPlateSupported(mesh,face,transform,layout,from,to) {
  const part=mesh.userData.part,plane=getFaceSurfaceOffset(part.dimensions.sectionSize,face),across=plane.axis==='x'?'y':'x';
  const half=Number(part.dimensions.sectionSize[across==='x'?0:1])/2,length=Number(part.dimensions.length);
  for(const x of [-layout.width/2,layout.width/2])for(const y of [from,to]) {
    const point=mesh.worldToLocal(new THREE.Vector3(x,y,-layout.thickness/2).applyQuaternion(transform.quaternion).add(transform.position));
    if(Math.abs(point[plane.axis]-plane.value)>.10001||Math.abs(point[across])>half+.10001||Math.abs(point.z)>length/2+.10001)return false;
  }
  return true;
}

/** 孔心、孔轴、开放槽、同面与完整足迹共用检查；不放宽既有 0.15mm 孔 / 0.1mm 面容差。 */
export function sideSlotGeometry(source,target,options={}) {
  const reference=normalizeSideSlot(options.sideSlot),definition=options.componentDefinition,layout=flatConnectionPlateLayout(definition?.dimensions),errors=[],warnings=[];
  const fail=(code,message)=>errors.push({code,message});
  const result={ok:false,errors,warnings,sourceMountFace:reference?.sourceFace,sourceSlot:null,targetSlot:null,componentPorts:null,contactGapMm:0,angleErrorDeg:0,jointKind:'SIDE_SLOT',sideSlot:reference};
  if(!reference||!layout||!supportedPair(source,target)||!faces.includes(options.targetFace)) {fail('SIDE_SLOT_UNSUPPORTED','侧槽共面安装目前支持两孔一字连接板、水平方切梁与竖直柱');return result;}
  if(Number(profileSeries(source.userData.part))!==layout.size||Number(profileSeries(target.userData.part))!==layout.size)fail('SIDE_SLOT_SERIES_MISMATCH','连接板与两根宿主的型材系列不匹配');
  if(options.sourceMountFace&&options.sourceMountFace!==reference.sourceFace)fail('SIDE_SLOT_FACE_MISMATCH','连接板的源安装面与保存侧槽定位不一致');
  const transform=sideSlotTransform({sourceEnd:options.sourceEnd,targetFace:options.targetFace,sideSlot:reference,designComponent:definition},source,target);
  if(!transform){fail('SIDE_SLOT_NOT_COPLANAR','这两个侧面不是同向平齐面，或源槽已封闭；不能用平板跨过错台安装');return result;}
  const normal=new THREE.Vector3(0,0,1).applyQuaternion(transform.quaternion),sourceSlots=[],targetSlots=[];
  for(const [mesh,face,ports,slots,offset,label] of [[source,reference.sourceFace,layout.sourcePorts,sourceSlots,reference.sourceSlotOffset,'梁'],[target,options.targetFace,layout.targetPorts,targetSlots,reference.targetSlotOffset,'立柱']]) {
    for(const port of ports) {
      const point=new THREE.Vector3(...port.point).applyQuaternion(transform.quaternion).add(transform.position),match=matchNearestSlot(mesh,face,point,{toleranceMm:.15});
      const gap=match?Math.abs(point.clone().sub(match.worldPoint).dot(slotWorldNormal(mesh,face))):Infinity;
      result.contactGapMm=Math.max(result.contactGapMm,gap);
      if(!match?.matched||Math.abs(match.offset-offset)>.00001||match.stationS<-.1||match.stationS>Number(mesh.userData.part.dimensions.length)+.1||gap>.10001||normal.dot(slotWorldNormal(mesh,face))<.99999)fail('SIDE_SLOT_PORT_NOT_ALIGNED',`${label}的连接板孔未对准保存的开放侧槽 / 安装面`);
      if(match)slots.push({...slotReference(match),holeId:port.id,errorMm:match.errorMm,matched:match.matched});
    }
  }
  if(!halfPlateSupported(source,reference.sourceFace,transform,layout,-layout.size,0)||!halfPlateSupported(target,options.targetFace,transform,layout,0,layout.size))fail('SIDE_SLOT_FOOTPRINT_OUT_OF_RANGE','连接板两端没有完整安装面支撑，或梁端与柱面有间隙 / 错台');
  result.sourceSlot=sourceSlots[0]||null;result.targetSlot=targetSlots[0]||null;
  result.componentPorts={ok:!errors.length,errors:[...errors],sourceSlots,targetSlots};result.ok=!errors.length;
  return result;
}

/** 按实际开放侧槽枚举，既供手动附近 / 两点使用，也供批量与 fresh 确认使用。 */
export function sideSlotContexts(source,target,definition,options={}) {
  if(!flatConnectionPlateLayout(definition?.dimensions)||!supportedPair(source,target))return [];
  const sp=source.userData.part,tp=target.userData.part,result=[];
  for(const end of options.sourceEnd?[options.sourceEnd]:['START','END'])for(const sourceFace of faces) {
    if(options.sourceMountFace&&sourceFace!==options.sourceMountFace)continue;
    for(const targetFace of faces) {
      if(options.targetFace&&targetFace!==options.targetFace)continue;
      if(slotWorldNormal(source,sourceFace).dot(slotWorldNormal(target,targetFace))<.99999||Math.abs(slotWorldNormal(source,sourceFace).y)>.00001)continue;
      for(const sourceSlot of getSlotDefinitionsForFace(sp,sourceFace))for(const targetSlot of getSlotDefinitionsForFace(tp,targetFace)) {
        const sideSlot={sourceFace,sourceSlotOffset:sourceSlot.offset,targetSlotOffset:targetSlot.offset};
        if(options.sideSlot&&JSON.stringify(normalizeSideSlot(options.sideSlot))!==JSON.stringify(sideSlot))continue;
        const geometry=sideSlotGeometry(source,target,{sourceEnd:end,targetFace,sourceMountFace:sourceFace,sideSlot,componentDefinition:definition});
        if(!geometry.ok)continue;
        const sourceFeature={type:'PROFILE_FACE',end,face:sourceFace,stationS:geometry.sourceSlot.stationS},targetFeature={type:'PROFILE_FACE',face:targetFace,stationS:geometry.targetSlot.stationS};
        result.push({source:{mesh:source,feature:sourceFeature,point:slotWorldPoint(source,geometry.sourceSlot),displayId:sp.displayId||sp.name},
          target:{mesh:target,feature:targetFeature,point:slotWorldPoint(target,geometry.targetSlot),displayId:tp.displayId||tp.name},sourceMountFace:sourceFace,sideSlot,jointKind:'SIDE_SLOT',designAnchorOffset:{x:0,y:0},componentDefinition:definition});
      }
    }
  }
  return result;
}
