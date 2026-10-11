import * as THREE from 'three';
import {isLinearProfile} from '../model/ProfilePath.js';
import {endCut} from '../model/ProfileEndContact.js';
import {getSlotDefinitionsForFace} from '../model/ProfileFeatureCatalog.js';
import {getFaceSurfaceOffset} from '../model/ProfileCoordinateSystem.js';
import {slotWorldNormal,slotWorldPoint} from '../model/SlotMatcher.js';
import {angleBracketLayout} from '../model/ConnectionComponentPorts.js';

const faces=['FRONT','BACK','LEFT','RIGHT'];
const axisOf=face=>['FRONT','BACK'].includes(face)?1:0;
const axisWorld=mesh=>new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld);

/** 梁侧安装保存宿主局部站位与槽偏移，不保存世界姿态，也不占用梁端的另一条连接。 */
export function normalizeSideMount(value){
  if(!value||!faces.includes(value.sourceContactFace)||!Number.isFinite(value.sourceStationS)||value.sourceStationS<0||!Number.isFinite(value.sourceSlotOffset))return null;
  return {sourceContactFace:value.sourceContactFace,sourceStationS:value.sourceStationS,sourceSlotOffset:value.sourceSlotOffset};
}

export function sideMountKey(sourceId,targetId,targetFace,reference){
  return ['SIDE_MOUNT',sourceId,targetId,targetFace,reference?.sourceContactFace].join('|');
}

/** 只识别水平直梁与竖直柱的真实侧面贴合；斜切、缩放和未知安装面不凭包围盒猜可装。 */
export function sideMountContacts(source,target){
  const sp=source?.userData?.part,tp=target?.userData?.part;
  if(source===target||sp?.type!=='PROFILE'||tp?.type!=='PROFILE'||!isLinearProfile(sp)||!isLinearProfile(tp))return [];
  source.updateMatrixWorld(true);target.updateMatrixWorld(true);
  if([source,target].some(mesh=>new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).toArray().some(value=>Math.abs(value-1)>.00001)||mesh.matrixWorld.determinant()<0))return [];
  if([sp,tp].some(part=>['START','END'].some(end=>Math.abs(endCut(part,end).tangent)>.00001)))return [];
  const up=new THREE.Vector3(0,1,0),sa=axisWorld(source),ta=axisWorld(target);
  if(Math.abs(sa.dot(up))>.00001||Math.abs(ta.dot(up))<.99999)return [];
  const result=[];
  for(const targetFace of faces){
    const normal=slotWorldNormal(target,targetFace);
    if(Math.abs(normal.dot(sa))>.00001||!getSlotDefinitionsForFace(tp,targetFace).length)continue;
    const sourceContactFace=faces.find(face=>slotWorldNormal(source,face).dot(normal)<-.99999);
    if(!sourceContactFace)continue;
    const surface=getFaceSurfaceOffset(sp.dimensions.sectionSize,sourceContactFace),local=new THREE.Vector3();
    local[surface.axis]=surface.value;
    const world=source.localToWorld(local),onTarget=target.worldToLocal(world.clone()),targetSurface=getFaceSurfaceOffset(tp.dimensions.sectionSize,targetFace);
    if(Math.abs(onTarget[targetSurface.axis]-targetSurface.value)>.10001||Math.abs(onTarget.z)>tp.dimensions.length/2+.1)continue;
    const across=targetSurface.axis==='x'?'y':'x',half=tp.dimensions.sectionSize[across==='x'?0:1]/2,stations=[];
    for(const offset of [-half,half]){
      const point=onTarget.clone();point[targetSurface.axis]=targetSurface.value;point[across]=offset;
      stations.push(source.worldToLocal(target.localToWorld(point)).z+sp.dimensions.length/2);
    }
    const minimum=Math.max(0,Math.min(...stations)),maximum=Math.min(sp.dimensions.length,Math.max(...stations));
    if(maximum-minimum>.1)result.push({targetFace,sourceContactFace,minimum,maximum,sourceStationS:(minimum+maximum)/2});
  }
  return result;
}

/** 梁侧参考规格显式派生腿深和孔站位。保持原目录件不变，不把改孔后的设计件称作采购同型号。 */
export function sideMountComponent(definition,source,sourceMountFace,reference){
  const layout=angleBracketLayout(definition?.dimensions),part=source.userData.part,side=normalizeSideMount(reference);
  if(!layout||!side||!['ANGLE_BRACKET','CORNER_CUBE','L_BRACKET'].includes(definition.dimensions.geometryKind)||axisOf(sourceMountFace)===axisOf(side.sourceContactFace))return null;
  if(definition.dimensions.sideMountGeometryVersion===1)return definition;
  const span=Number(part.dimensions.sectionSize[axisOf(side.sourceContactFace)]),surface=getFaceSurfaceOffset(part.dimensions.sectionSize,side.sourceContactFace);
  const distance=span/2-Math.sign(surface.value)*side.sourceSlotOffset;
  const depth=Math.min(layout.depth,span-layout.thickness/2),station=distance-layout.thickness/2;
  if(station<layout.radius+1||station>depth-layout.radius-1||depth<=layout.thickness)return null;
  const result=structuredClone(definition);
  result.dimensions={...result.dimensions,sideMountGeometryVersion:1,depth,sourceHoleStation:station,targetHoleStation:layout.height/2};
  result.id=definition.id+'-SIDE-'+[depth,station].map(value=>value.toFixed(3)).join('-');
  result.label=result.model=definition.label+' · 梁侧安装参考';
  result.note='梁侧贴柱的参数化设计参考，腿深和孔位按实际梁槽派生；不是原目录采购尺寸，制造前须核对实物。';
  return result;
}

/** 同一局部定位用于 Ghost、确认与加载重建；横腿跨梁宽，立腿沿柱高。 */
export function sideMountTransform(connection,source,target){
  const side=normalizeSideMount(connection.sideMount),face=connection.sourceMountFace;
  if(!side||!faces.includes(face)||axisOf(face)===axisOf(side.sourceContactFace))return null;
  const part=source.userData.part,position=new THREE.Vector3(0,0,side.sourceStationS-part.dimensions.length/2);
  for(const value of [side.sourceContactFace,face]){const plane=getFaceSurfaceOffset(part.dimensions.sectionSize,value);position[plane.axis]=plane.value;}
  source.localToWorld(position);
  const y=slotWorldNormal(source,face),z=slotWorldNormal(target,connection.targetFace),x=y.clone().cross(z);
  if(x.lengthSq()<.99998)return null;
  x.normalize();y.copy(z).cross(x).normalize();
  position.addScaledVector(z,Number(connection.designComponent?.dimensions?.thickness||4)/2);
  return {position,quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))};
}

/** 按目标真实槽枚举梁长站位，按源槽派生实际孔；多孔能否同时落槽仍交给逐孔校验。 */
export function sideMountContexts(source,target,definition,options={}){
  const layout=angleBracketLayout(definition?.dimensions);if(!layout)return [];
  const part=source.userData.part,contacts=sideMountContacts(source,target),result=[],keys=new Set();
  for(const contact of contacts){
    if(options.targetFace&&options.targetFace!==contact.targetFace)continue;
    if(options.sideMount&&options.sideMount.sourceContactFace!==contact.sourceContactFace)continue;
    for(const face of faces){
      if((options.sourceMountFace&&face!==options.sourceMountFace)||axisOf(face)===axisOf(contact.sourceContactFace))continue;
      const slots=getSlotDefinitionsForFace(part,face);
      for(const slot of slots){
        if(options.sideMount&&Math.abs(slot.offset-options.sideMount.sourceSlotOffset)>.00001)continue;
        const reference={sourceContactFace:contact.sourceContactFace,sourceStationS:contact.sourceStationS,sourceSlotOffset:slot.offset};
        if(options.sideMount)Object.assign(reference,options.sideMount);
        const componentDefinition=sideMountComponent(definition,source,face,reference);if(!componentDefinition)continue;
        const descriptor={sideMount:reference,sourceMountFace:face,targetFace:contact.targetFace,designComponent:componentDefinition};
        const transform=sideMountTransform(descriptor,source,target);if(!transform)continue;
        const actualLayout=angleBracketLayout(componentDefinition.dimensions),x=new THREE.Vector3(1,0,0).applyQuaternion(transform.quaternion);
        const targetLocal=target.worldToLocal(transform.position.clone()),targetLength=target.userData.part.dimensions.length;
        const candidates=options.sideMount?[options.sideMount.sourceStationS]:getSlotDefinitionsForFace(target.userData.part,contact.targetFace).map(targetSlot=>{
          const point=slotWorldPoint(target,{...targetSlot,stationS:targetLocal.z+targetLength/2}).addScaledVector(x,-actualLayout.targetPorts[0].point[0]);
          return source.worldToLocal(point).z+part.dimensions.length/2;
        });
        for(const station of candidates){
          if(station<contact.minimum-.1||station>contact.maximum+.1)continue;
          const sideMount={...reference,sourceStationS:station},sourceEnd=station<part.dimensions.length/2?'START':'END';
          const local=new THREE.Vector3(0,0,station-part.dimensions.length/2),plane=getFaceSurfaceOffset(part.dimensions.sectionSize,contact.sourceContactFace);local[plane.axis]=plane.value;
          const point=source.localToWorld(local),targetPoint=target.worldToLocal(point.clone()),tp=getFaceSurfaceOffset(target.userData.part.dimensions.sectionSize,contact.targetFace);targetPoint[tp.axis]=tp.value;
          const feature={type:'PROFILE_FACE',face:contact.targetFace,stationS:targetPoint.z+targetLength/2};
          const key=[contact.targetFace,contact.sourceContactFace,face,station.toFixed(5),slot.offset].join('|');
          if(keys.has(key))continue;keys.add(key);
          result.push({source:{mesh:source,feature:{type:'PROFILE_FACE',face:contact.sourceContactFace,end:sourceEnd,stationS:station},point,displayId:part.displayId||part.name},target:{mesh:target,feature,point:target.localToWorld(targetPoint),displayId:target.userData.part.displayId||target.userData.part.name},sourceMountFace:face,jointKind:'SIDE_MOUNT',sideMount,designAnchorOffset:{x:0,y:0},componentDefinition});
        }
      }
    }
  }
  return result;
}

/** 梁侧规则只替代错误的端轴/完整端面假设；接触、真实槽、支撑和空间的严格检查保持。 */
export function sideMountContactErrors(source,target,options){
  const side=normalizeSideMount(options.sideMount),errors=[];
  const contact=side&&sideMountContacts(source,target).find(value=>value.targetFace===options.targetFace&&value.sourceContactFace===side.sourceContactFace);
  if(!contact||side.sourceStationS<contact.minimum-.1||side.sourceStationS>contact.maximum+.1)errors.push({code:'SIDE_MOUNT_CONTACT_INVALID',message:'梁侧与柱面未真实贴合、局部站位越界，或当前斜切/缩放/姿态不支持'});
  if(!side||!faces.includes(options.sourceMountFace)||axisOf(options.sourceMountFace)===axisOf(side.sourceContactFace)||options.componentDefinition?.dimensions?.sideMountGeometryVersion!==1||!['ANGLE_BRACKET','CORNER_CUBE','L_BRACKET'].includes(options.componentDefinition?.dimensions?.geometryKind))errors.push({code:'SIDE_MOUNT_MODEL_UNSUPPORTED',message:'请选择已适配梁侧孔位的90度直角件或角码参考规格'});
  return errors;
}
