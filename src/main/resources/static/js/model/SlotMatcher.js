import * as THREE from 'three';
import {getSlotDefinitionsForFace} from './ProfileFeatureCatalog.js';
import {localZToStation} from './ProfileCoordinateSystem.js';
import {profileSlotWidth} from './DesignProfileCatalog.js';

/**
 * Resolves catalog-defined profile slots for connectors and fasteners.
 * Connection code must never assume "slot offset = 0"; it should ask this
 * module for the nearest catalog slot and persist the returned slotId.
 */
export function matchNearestSlot(mesh, face, worldPointOrLocalOffset, options = {}) {
  const part=mesh?.userData?.part;
  if(!mesh || part?.type!=='PROFILE') return null;
  const normalizedFace=normalizeFace(face);
  const slots=getSlotDefinitionsForFace(part,normalizedFace);
  if(!slots.length)return null;
  mesh.updateMatrixWorld(true);
  let localOffset=0;
  let stationS=Number(options.stationS ?? Number(part.dimensions?.length||0)/2);
  if(worldPointOrLocalOffset?.isVector3){
    const local=mesh.worldToLocal(worldPointOrLocalOffset.clone());
    localOffset=faceOffset(local,normalizedFace);
    stationS=localZToStation(Number(part.dimensions?.length||0),local.z);
  } else {
    localOffset=Number(worldPointOrLocalOffset||0);
  }
  let nearest=null;
  for(const slot of slots){
    const errorMm=Math.abs(localOffset-Number(slot.offset||0));
    if(!nearest || errorMm<nearest.errorMm) nearest={...slot,errorMm};
  }
  if(!nearest)return null;
  const toleranceMm=Number(options.toleranceMm ?? Math.max(3,Number(nearest.width||profileSlotWidth(part)||8)/2+1));
  return {
    ...nearest,
    face:normalizedFace,
    stationS:round2(stationS),
    actualOffset:round2(localOffset),
    offset:round2(nearest.offset),
    errorMm:round2(nearest.errorMm),
    toleranceMm:round2(toleranceMm),
    matched:nearest.errorMm<=toleranceMm,
    worldPoint:slotWorldPoint(mesh,{face:normalizedFace,stationS,offset:nearest.offset})
  };
}

export function slotWorldPoint(mesh, slot) {
  const part=mesh?.userData?.part;
  if(!mesh || part?.type!=='PROFILE' || !slot)return new THREE.Vector3();
  mesh.updateMatrixWorld(true);
  const length=Number(part.dimensions?.length||0);
  const [widthRaw,heightRaw]=part.dimensions?.sectionSize||[30,30];
  const width=Number(widthRaw||30),height=Number(heightRaw||30);
  const stationS=Math.max(0,Math.min(length,Number(slot.stationS??length/2)));
  const z=-length/2+stationS;
  const offset=Number(slot.offset||0);
  const face=normalizeFace(slot.face);
  const local=face==='FRONT' ? new THREE.Vector3(offset,height/2,z)
    : face==='BACK' ? new THREE.Vector3(offset,-height/2,z)
      : face==='RIGHT' ? new THREE.Vector3(width/2,offset,z)
        : new THREE.Vector3(-width/2,offset,z);
  return mesh.localToWorld(local);
}

export function slotWorldNormal(mesh, face) {
  const local=face==='FRONT' ? new THREE.Vector3(0,1,0)
    : face==='BACK' ? new THREE.Vector3(0,-1,0)
      : face==='RIGHT' ? new THREE.Vector3(1,0,0)
        : new THREE.Vector3(-1,0,0);
  mesh.updateMatrixWorld(true);
  return local.transformDirection(mesh.matrixWorld).normalize();
}

export function slotReference(slot) {
  if(!slot)return null;
  return {
    slotId:slot.id,
    face:slot.face,
    index:Number(slot.index||0),
    offset:round2(slot.offset||0),
    stationS:round2(slot.stationS||0),
    width:round2(slot.width||0),
    source:slot.source||'CATALOG'
  };
}

function faceOffset(local,face){return face==='FRONT'||face==='BACK'?Number(local.x):Number(local.y);}
function normalizeFace(face){const value=String(face||'FRONT').toUpperCase();return ['FRONT','BACK','LEFT','RIGHT'].includes(value)?value:'FRONT';}
function round2(value){return Number(Number(value||0).toFixed(2));}
