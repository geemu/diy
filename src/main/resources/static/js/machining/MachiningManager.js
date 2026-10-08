import * as THREE from 'three';
import {getLocalFrameAtStation, normalizeProfilePath} from '../model/ProfilePath.js';
import {getDesignProfileSlots} from '../model/DesignProfileCatalog.js';
import {isEndMachiningFeature, normalizeMachiningFeature} from './MachiningFeatureCatalog.js';

export default class MachiningManager {
  constructor(editor) { this.editor = editor; }

  ensure(part) { return part.machiningItems || (part.machiningItems = []); }

  add(mesh, item) {
    const part = mesh.userData.part;
    normalizeProfilePath(part);
    const value = {id:crypto.randomUUID(), ...item};
    if (!isEndMachiningFeature(value)) {
      const station = Number(value.stationS ?? value.distanceFromStart ?? 15);
      value.distanceFromStart = station;
      value.stationS = station;
    }
    value.processStage = normalizeProcessStage(value.processStage, part.profilePath?.type === 'ARC');
    normalizeMachiningFeature(value, part);
    this.ensure(part).push(value);
    this.refreshProfile(mesh);
    return value;
  }

  addThroughHole(mesh, options = {}) { return this.add(mesh,{type:'THROUGH_HOLE',face:options.face||'FRONT',stationS:Number(options.stationS??options.distanceFromStart??15),offset:Number(options.offset||0),diameter:Number(options.diameter||9),processStage:options.processStage,featureGroupId:options.featureGroupId||null,referenceDatum:options.referenceDatum,generatedByConnectionId:options.generatedByConnectionId||null}); }
  addCountersink(mesh, options = {}) { return this.add(mesh,{type:'COUNTERSINK',face:options.face||'FRONT',stationS:Number(options.stationS??options.distanceFromStart??15),offset:Number(options.offset||0),majorDiameter:Number(options.majorDiameter??options.diameter??16),angleDeg:Number(options.angleDeg??options.countersinkAngleDeg??90),processStage:options.processStage,featureGroupId:options.featureGroupId||options.linkedHoleId||null,linkedHoleId:options.linkedHoleId||null,referenceDatum:options.referenceDatum,generatedByConnectionId:options.generatedByConnectionId||null}); }
  addCounterbore(mesh, options = {}) { return this.add(mesh,{type:'COUNTERBORE',face:options.face||'FRONT',stationS:Number(options.stationS??options.distanceFromStart??15),offset:Number(options.offset||0),diameter:Number(options.diameter||16),depth:Number(options.depth||5),processStage:options.processStage,featureGroupId:options.featureGroupId||options.linkedHoleId||null,linkedHoleId:options.linkedHoleId||null,referenceDatum:options.referenceDatum,generatedByConnectionId:options.generatedByConnectionId||null}); }
  addBlindHole(mesh, options = {}) { return this.add(mesh,{type:'BLIND_HOLE',face:options.face||'FRONT',stationS:Number(options.stationS??options.distanceFromStart??15),offset:Number(options.offset||0),diameter:Number(options.diameter||8),depth:Number(options.depth||10),processStage:options.processStage,referenceDatum:options.referenceDatum,generatedByConnectionId:options.generatedByConnectionId||null}); }
  addTappedHole(mesh, options = {}) { return this.add(mesh,{type:'TAPPED_HOLE',face:options.face||'FRONT',stationS:Number(options.stationS??options.distanceFromStart??15),offset:Number(options.offset||0),tappingSize:options.tappingSize||'M8',diameter:Number(options.diameter||6.8),depth:Number(options.depth||12),processStage:options.processStage,referenceDatum:options.referenceDatum,generatedByConnectionId:options.generatedByConnectionId||null}); }
  addSlot(mesh, options = {}) { return this.add(mesh,{type:'SLOT',face:options.face||'FRONT',stationS:Number(options.stationS??30),offset:Number(options.offset||0),length:Number(options.length||30),width:Number(options.width||8),depth:Number(options.depth||0),orientation:options.orientation||'ALONG_PROFILE',processStage:options.processStage,referenceDatum:options.referenceDatum||'A_END'}); }
  addObroundSlot(mesh, options = {}) { return this.add(mesh,{type:'OBROUND_SLOT',face:options.face||'FRONT',stationS:Number(options.stationS??30),offset:Number(options.offset||0),length:Number(options.length||30),width:Number(options.width||8),depth:Number(options.depth||0),orientation:options.orientation||'ALONG_PROFILE',processStage:options.processStage,referenceDatum:options.referenceDatum||'A_END'}); }
  addMillingRegion(mesh, options = {}) { return this.add(mesh,{type:'MILLING_REGION',face:options.face||'FRONT',stationS:Number(options.stationS??30),offset:Number(options.offset||0),length:Number(options.length||30),width:Number(options.width||20),depth:Number(options.depth||2),cornerRadius:Number(options.cornerRadius||0),orientation:options.orientation||'ALONG_PROFILE',processStage:options.processStage,referenceDatum:options.referenceDatum||'A_END'}); }

  addEndTap(mesh, options = {}) { return this.add(mesh,{type:'END_TAP',end:options.end==='END'?'END':'START',tappingSize:options.tappingSize||'M8',depth:Number(options.depth||12),offsetX:Number(options.offsetX||0),offsetY:Number(options.offsetY||0),processStage:options.processStage,generatedByConnectionId:options.generatedByConnectionId||null}); }
  addEndHole(mesh, options = {}) { return this.add(mesh,{type:'END_HOLE',end:options.end==='END'?'END':'START',diameter:Number(options.diameter||8),depth:Number(options.depth||12),offsetX:Number(options.offsetX||0),offsetY:Number(options.offsetY||0),processStage:options.processStage}); }
  addEndCounterbore(mesh, options = {}) { return this.add(mesh,{type:'END_COUNTERBORE',end:options.end==='END'?'END':'START',diameter:Number(options.diameter||14),depth:Number(options.depth||5),offsetX:Number(options.offsetX||0),offsetY:Number(options.offsetY||0),processStage:options.processStage}); }
  addEndCountersink(mesh, options = {}) { return this.add(mesh,{type:'END_COUNTERSINK',end:options.end==='END'?'END':'START',majorDiameter:Number(options.majorDiameter||14),angleDeg:Number(options.angleDeg||90),offsetX:Number(options.offsetX||0),offsetY:Number(options.offsetY||0),processStage:options.processStage}); }

  addHoleGroup(mesh, options = {}) {
    const featureGroupId = crypto.randomUUID();
    const through = this.addThroughHole(mesh,{...options,featureGroupId});
    const secondaryType = options.secondaryType || 'COUNTERSINK';
    let secondary;
    if (secondaryType === 'COUNTERBORE') secondary = this.addCounterbore(mesh,{...options,featureGroupId,linkedHoleId:through.id,diameter:Number(options.majorDiameter||16),depth:Number(options.secondaryDepth||5)});
    else secondary = this.addCountersink(mesh,{...options,featureGroupId,linkedHoleId:through.id,majorDiameter:Number(options.majorDiameter||16),angleDeg:Number(options.angleDeg||90)});
    through.featureGroupId = featureGroupId;
    secondary.featureGroupId = featureGroupId;
    this.refreshProfile(mesh);
    return {featureGroupId,items:[through,secondary]};
  }

  setReferenceDatum(mesh, id, datum) {
    const part = mesh.userData.part;
    const item = this.ensure(part).find(value => value.id === id);
    if (!item) throw new Error('加工特征不存在');
    item.referenceDatum = datum;
    if (datum !== 'SLOT_CENTER') {
      delete item.slotId;
      if (item.reference) item.reference.slotId = null;
    }
    if (datum === 'SLOT_CENTER' && !isEndMachiningFeature(item)) {
      const slots = getDesignProfileSlots(part.designProfile?.profileId, item.face);
      if (slots.length) {
        const nearest = slots.reduce((best, slot) => Math.abs(Number(slot.offset)-Number(item.offset||0)) < Math.abs(Number(best.offset)-Number(item.offset||0)) ? slot : best, slots[0]);
        item.offset = Number(nearest.offset || 0);
        item.slotId = nearest.id;
      }
    }
    normalizeMachiningFeature(item, part);
    this.refreshProfile(mesh);
    return item;
  }

  updateMany(mesh, ids = [], patch = {}) {
    const part = mesh?.userData?.part;
    if (!part || part.type !== 'PROFILE') throw new Error('请选择型材');
    const selected = new Set(ids);
    let count = 0;
    for (const item of this.ensure(part)) {
      if (!selected.has(item.id)) continue;
      if (item.generatedByConnectionId) continue;
      Object.assign(item, structuredClone(patch));
      normalizeMachiningFeature(item, part);
      count++;
    }
    this.refreshProfile(mesh);
    return count;
  }

  removeItem(mesh, id) { const part=mesh.userData.part; part.machiningItems=this.ensure(part).filter(item=>item.id!==id && item.linkedHoleId!==id); this.refreshProfile(mesh); }
  removeGeneratedByConnection(connectionId) { for(const mesh of this.editor.meshes){const part=mesh.userData.part;if(part?.type!=='PROFILE')continue;part.machiningItems=this.ensure(part).filter(item=>item.generatedByConnectionId!==connectionId);this.refreshProfile(mesh);} }

  normalizeFeatures(mesh) {
    const part = mesh.userData.part;
    normalizeProfilePath(part);
    for (const item of this.ensure(part)) {
      if (!isEndMachiningFeature(item)) {
        const station = Number(item.stationS ?? item.distanceFromStart ?? 0);
        item.stationS = station;
        item.distanceFromStart = station;
      }
      item.processStage = normalizeProcessStage(item.processStage, part.profilePath?.type === 'ARC');
      normalizeMachiningFeature(item, part);
    }
  }

  refreshProfile(mesh) {
    let group=mesh.userData.machiningGroup;
    if(group){mesh.remove(group);group.traverse(object=>{if(object.geometry)object.geometry.dispose();if(object.material)object.material.dispose();});}
    group=new THREE.Group(); group.name='__machining__'; mesh.add(group); mesh.userData.machiningGroup=group;
    const part=mesh.userData.part; normalizeProfilePath(part); const length=Number(part.dimensions.length); const [width,height]=part.dimensions.sectionSize;
    for(const item of this.ensure(part)) {
      normalizeMachiningFeature(item,part);
      if(isEndMachiningFeature(item)) {
        addHoleAppearance(group,item,part.machiningItems,machiningLocalPose(part,item));continue;
      }
      const station=Number(item.stationS??item.distanceFromStart??0); item.stationS=station; item.distanceFromStart=station; item.processStage=normalizeProcessStage(item.processStage,part.profilePath?.type==='ARC');
      const frame=getLocalFrameAtStation(part,station); const frameQuaternion=frameRotationQuaternion(frame.rotation); const offset=Number(item.offset||0); const epsilon=.7; const local=faceLocalPoint(item.face,width,height,offset,epsilon).applyQuaternion(frameQuaternion); const center=new THREE.Vector3(...frame.point).add(local); const normal=faceLocalNormal(item.face).applyQuaternion(frameQuaternion).normalize();
      if(['SLOT','OBROUND_SLOT','MILLING_REGION'].includes(item.type)) {
        const lengthMm=Math.max(4,Number(item.length||20)), widthMm=Math.max(3,Number(item.width||8));
        const plane=new THREE.Mesh(new THREE.PlaneGeometry(item.orientation==='CROSS_PROFILE'?widthMm:lengthMm,item.orientation==='CROSS_PROFILE'?lengthMm:widthMm),new THREE.MeshBasicMaterial({color:item.type==='MILLING_REGION'?0x8e6c3a:0x16a085,wireframe:true,side:THREE.DoubleSide}));
        plane.position.copy(center); plane.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal); group.add(plane); continue;
      }
      const compound=part.machiningItems.some(other=>other.linkedHoleId===item.id&&['COUNTERSINK','COUNTERBORE'].includes(other.type));
      if(!compound)addHoleAppearance(group,item,part.machiningItems,machiningLocalPose(part,item));
      // 通孔的出口也要能辨认；孔组入口由沉头/沉孔展示，避免两层标记相互闪烁。
      if(item.type==='THROUGH_HOLE')addHoleAppearance(group,item,part.machiningItems,machiningLocalPose(part,item,oppositeFace[item.face]));
    }
    this.editor.annotationManager?.requestRefresh();
  }
}

const oppositeFace={FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'};

/** 仅展示坐标：沿用 stationS/face/offset 与弯曲局部标架，端孔尊重 X/Y 偏移。 */
export function machiningLocalPose(part,item,face=item.face) {
  const length=Number(part.dimensions.length),[width,height]=part.dimensions.sectionSize;
  const end=isEndMachiningFeature(item),station=end?(item.end==='END'?length:0):Number(item.stationS??item.distanceFromStart??0);
  const frame=getLocalFrameAtStation(part,station),rotation=frameRotationQuaternion(frame.rotation);
  const normal=end?new THREE.Vector3(...frame.tangent).normalize().multiplyScalar(item.end==='END'?1:-1):faceLocalNormal(face).applyQuaternion(rotation).normalize();
  const offset=end?new THREE.Vector3(Number(item.offsetX||0),Number(item.offsetY||0),0):faceLocalPoint(face,width,height,Number(item.offset||0),0);
  return {point:new THREE.Vector3(...frame.point).add(offset.applyQuaternion(rotation)).addScaledVector(normal,.03),normal};
}

/** 深色孔口及金属边缘是加工示意，不改原截面，也不冒充实体布尔贯穿。 */
function addHoleAppearance(group,item,items,pose) {
  const linked=items.find(other=>other.id===item.linkedHoleId),tapping=Number.parseFloat(String(item.tappingSize||'').replace(/^M/i,''));
  const outer=Math.max(.1,Number(item.type.includes('COUNTERSINK')?(item.majorDiameter||item.diameter||14):(item.diameter||tapping||8))/2);
  const inner=linked?Math.min(outer,Math.max(.1,Number(linked.diameter||8)/2)):outer*.9;
  const marker=new THREE.Group();marker.name='__machining_hole__';marker.userData.machiningId=item.id;
  marker.userData.appearanceOnly=true;marker.position.copy(pose.point);marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),pose.normal);
  // 在透明的选中/吸附着色之后画孔口，但仍检查实体深度，不能透过其他构件。
  const dark=new THREE.Mesh(new THREE.CircleGeometry(inner,40),new THREE.MeshBasicMaterial({color:0x10151b,side:THREE.FrontSide,toneMapped:false,transparent:true,opacity:1,depthTest:true,depthWrite:true}));
  dark.name='__hole_aperture__';dark.renderOrder=1600;dark.raycast=()=>{};marker.add(dark);
  const rim=new THREE.Mesh(new THREE.RingGeometry(inner,outer,40),new THREE.MeshStandardMaterial({color:item.type.includes('COUNTERBORE')?0x64707a:0x9ca6af,metalness:.6,roughness:.42,side:THREE.FrontSide,transparent:true,opacity:1,depthTest:true,depthWrite:true}));
  rim.name='__hole_rim__';rim.renderOrder=1601;rim.position.z=.01;rim.raycast=()=>{};marker.add(rim);group.add(marker);
}

function normalizeProcessStage(value,isArc){if(!isArc)return'STRAIGHT';return value==='BEND_AFTER'?'BEND_AFTER':'BEND_BEFORE';}
function frameRotationQuaternion(rotation){const q=new THREE.Quaternion();if(rotation?.axis==='X')q.setFromAxisAngle(new THREE.Vector3(1,0,0),Number(rotation.angleRad||0));else if(rotation?.axis==='Y')q.setFromAxisAngle(new THREE.Vector3(0,1,0),Number(rotation.angleRad||0));return q;}
function faceLocalPoint(face,width,height,offset,epsilon){if(face==='FRONT')return new THREE.Vector3(offset,height/2+epsilon,0);if(face==='BACK')return new THREE.Vector3(offset,-height/2-epsilon,0);if(face==='RIGHT')return new THREE.Vector3(width/2+epsilon,offset,0);return new THREE.Vector3(-width/2-epsilon,offset,0);}
function faceLocalNormal(face){if(face==='FRONT')return new THREE.Vector3(0,1,0);if(face==='BACK')return new THREE.Vector3(0,-1,0);if(face==='RIGHT')return new THREE.Vector3(1,0,0);return new THREE.Vector3(-1,0,0);}
