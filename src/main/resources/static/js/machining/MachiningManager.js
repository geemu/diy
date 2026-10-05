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
        const station=item.end==='END'?length:0; const frame=getLocalFrameAtStation(part,station); const center=new THREE.Vector3(...frame.point); const tangent=new THREE.Vector3(...frame.tangent).normalize().multiplyScalar(item.end==='END'?1:-1);
        const size=Math.max(4,Number(item.type==='END_COUNTERSINK'?(item.majorDiameter||12):(item.diameter||8))/2);
        const ring=new THREE.Mesh(new THREE.RingGeometry(Math.max(.8,size-1),size,24),new THREE.MeshBasicMaterial({color:item.type==='END_TAP'?0x8e44ad:0x2c3e50,side:THREE.DoubleSide}));
        ring.position.copy(center).addScaledVector(tangent,.7); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent); group.add(ring); continue;
      }
      const station=Number(item.stationS??item.distanceFromStart??0); item.stationS=station; item.distanceFromStart=station; item.processStage=normalizeProcessStage(item.processStage,part.profilePath?.type==='ARC');
      const frame=getLocalFrameAtStation(part,station); const frameQuaternion=frameRotationQuaternion(frame.rotation); const offset=Number(item.offset||0); const epsilon=.7; const local=faceLocalPoint(item.face,width,height,offset,epsilon).applyQuaternion(frameQuaternion); const center=new THREE.Vector3(...frame.point).add(local); const normal=faceLocalNormal(item.face).applyQuaternion(frameQuaternion).normalize();
      if(['SLOT','OBROUND_SLOT','MILLING_REGION'].includes(item.type)) {
        const lengthMm=Math.max(4,Number(item.length||20)), widthMm=Math.max(3,Number(item.width||8));
        const plane=new THREE.Mesh(new THREE.PlaneGeometry(item.orientation==='CROSS_PROFILE'?widthMm:lengthMm,item.orientation==='CROSS_PROFILE'?lengthMm:widthMm),new THREE.MeshBasicMaterial({color:item.type==='MILLING_REGION'?0x8e6c3a:0x16a085,wireframe:true,side:THREE.DoubleSide}));
        plane.position.copy(center); plane.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal); group.add(plane); continue;
      }
      const radius=Math.max(Number(item.type==='COUNTERSINK'?(item.majorDiameter??item.diameter??8):(item.diameter||8))/2,2); const ring=new THREE.Mesh(new THREE.RingGeometry(Math.max(.8,radius-1),radius,24),new THREE.MeshBasicMaterial({color:item.processStage==='BEND_AFTER'?0x16a085:item.type==='COUNTERSINK'?0xe67e22:item.type==='COUNTERBORE'?0x2980b9:0xc0392b,side:THREE.DoubleSide})); ring.position.copy(center); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal); group.add(ring);
    }
    this.editor.annotationManager?.requestRefresh();
  }
}

function normalizeProcessStage(value,isArc){if(!isArc)return'STRAIGHT';return value==='BEND_AFTER'?'BEND_AFTER':'BEND_BEFORE';}
function frameRotationQuaternion(rotation){const q=new THREE.Quaternion();if(rotation?.axis==='X')q.setFromAxisAngle(new THREE.Vector3(1,0,0),Number(rotation.angleRad||0));else if(rotation?.axis==='Y')q.setFromAxisAngle(new THREE.Vector3(0,1,0),Number(rotation.angleRad||0));return q;}
function faceLocalPoint(face,width,height,offset,epsilon){if(face==='FRONT')return new THREE.Vector3(offset,height/2+epsilon,0);if(face==='BACK')return new THREE.Vector3(offset,-height/2-epsilon,0);if(face==='RIGHT')return new THREE.Vector3(width/2+epsilon,offset,0);return new THREE.Vector3(-width/2-epsilon,offset,0);}
function faceLocalNormal(face){if(face==='FRONT')return new THREE.Vector3(0,1,0);if(face==='BACK')return new THREE.Vector3(0,-1,0);if(face==='RIGHT')return new THREE.Vector3(1,0,0);return new THREE.Vector3(-1,0,0);}
