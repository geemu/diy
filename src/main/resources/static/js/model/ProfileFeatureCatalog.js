import * as THREE from 'three';
import {getDesignProfileDefinition,isProfileFaceClosed} from './DesignProfileCatalog.js';
import {getLocalEndpoints,isLinearProfile} from './ProfilePath.js';

/**
 * Canonical profile feature resolver used by snap, feature picking and draw tools.
 *
 * v0.30 intentionally keeps features derived from the business profile definition
 * instead of Three.js child meshes so imported/rendering geometry may change without
 * breaking assembly/manufacturing references.
 */
export function resolveProfileFeature(mesh, worldPoint, options = {}) {
  const part=mesh?.userData?.part;
  if(!mesh||part?.type!=='PROFILE'||!isLinearProfile(part)||!worldPoint)return null;
  mesh.updateMatrixWorld(true);
  const local=mesh.worldToLocal(worldPoint.clone());
  const length=Math.max(1,Number(part.dimensions?.length||1));
  const [widthRaw,heightRaw]=part.dimensions?.sectionSize||[30,30];
  const width=Number(widthRaw||30),height=Number(heightRaw||30);
  const endTolerance=Number(options.endToleranceMm ?? Math.max(10,Math.min(32,length*0.04)));
  const slotTolerance=Number(options.slotToleranceMm ?? Math.max(4,Math.min(width,height)*0.24));

  const distA=Math.abs(local.z+length/2),distB=Math.abs(local.z-length/2);
  if(Math.min(distA,distB)<=endTolerance){
    const end=distA<=distB?'START':'END';
    const endpoints=getLocalEndpoints(part);
    const point=new THREE.Vector3(...(end==='START'?endpoints.start:endpoints.end));
    return makeFeature(mesh,{type:'PROFILE_END',kind:'ENDPOINT',end,stationS:end==='START'?0:length},mesh.localToWorld(point));
  }

  const stationS=Math.max(0,Math.min(length,local.z+length/2));
  const faces=[
    {face:'RIGHT',distance:Math.abs(local.x-width/2),cross:local.y,span:height,point:new THREE.Vector3(width/2,clamp(local.y,-height/2,height/2),clamp(local.z,-length/2,length/2))},
    {face:'LEFT',distance:Math.abs(local.x+width/2),cross:local.y,span:height,point:new THREE.Vector3(-width/2,clamp(local.y,-height/2,height/2),clamp(local.z,-length/2,length/2))},
    {face:'FRONT',distance:Math.abs(local.y-height/2),cross:local.x,span:width,point:new THREE.Vector3(clamp(local.x,-width/2,width/2),height/2,clamp(local.z,-length/2,length/2))},
    {face:'BACK',distance:Math.abs(local.y+height/2),cross:local.x,span:width,point:new THREE.Vector3(clamp(local.x,-width/2,width/2),-height/2,clamp(local.z,-length/2,length/2))}
  ].sort((a,b)=>a.distance-b.distance);
  const best=faces[0];
  const slots=getSlotDefinitionsForFace(part,best.face);
  if(slots.length){
    let nearest=null;
    for(const slot of slots){
      const distance=Math.abs(best.cross-slot.offset);
      if(!nearest||distance<nearest.distance)nearest={...slot,distance};
    }
    if(nearest&&nearest.distance<=slotTolerance){
      const p=slotLocalPoint(best.face,width,height,local.z,nearest.offset);
      return makeFeature(mesh,{type:'PROFILE_SLOT',kind:'SLOT_CENTER',face:best.face,stationS,slotId:nearest.id,slotIndex:nearest.index,slotOffset:nearest.offset,slotWidth:nearest.width,slotSource:nearest.source},mesh.localToWorld(p));
    }
  }
  return makeFeature(mesh,{type:'PROFILE_FACE',kind:'SIDE_FACE',face:best.face,stationS},mesh.localToWorld(best.point));
}


export function resolveProfileSurfaceFeature(mesh, worldPoint, options = {}) {
  const part=mesh?.userData?.part;
  if(!mesh||part?.type!=='PROFILE'||!isLinearProfile(part)||!worldPoint)return null;
  mesh.updateMatrixWorld(true);
  const local=mesh.worldToLocal(worldPoint.clone());
  const length=Math.max(1,Number(part.dimensions?.length||1));
  const [widthRaw,heightRaw]=part.dimensions?.sectionSize||[30,30];
  const width=Number(widthRaw||30),height=Number(heightRaw||30);
  const slotTolerance=Number(options.slotToleranceMm ?? Math.max(4,Math.min(width,height)*0.24));
  const stationS=Math.max(0,Math.min(length,local.z+length/2));
  const faces=[
    {face:'RIGHT',distance:Math.abs(local.x-width/2),cross:local.y,point:new THREE.Vector3(width/2,clamp(local.y,-height/2,height/2),clamp(local.z,-length/2,length/2))},
    {face:'LEFT',distance:Math.abs(local.x+width/2),cross:local.y,point:new THREE.Vector3(-width/2,clamp(local.y,-height/2,height/2),clamp(local.z,-length/2,length/2))},
    {face:'FRONT',distance:Math.abs(local.y-height/2),cross:local.x,point:new THREE.Vector3(clamp(local.x,-width/2,width/2),height/2,clamp(local.z,-length/2,length/2))},
    {face:'BACK',distance:Math.abs(local.y+height/2),cross:local.x,point:new THREE.Vector3(clamp(local.x,-width/2,width/2),-height/2,clamp(local.z,-length/2,length/2))}
  ].sort((a,b)=>a.distance-b.distance);
  const best=faces[0];
  const slots=getSlotDefinitionsForFace(part,best.face);
  if(slots.length){
    let nearest=null;
    for(const slot of slots){
      const distance=Math.abs(best.cross-slot.offset);
      if(!nearest||distance<nearest.distance)nearest={...slot,distance};
    }
    if(nearest&&nearest.distance<=slotTolerance){
      const point=slotLocalPoint(best.face,width,height,local.z,nearest.offset);
      return makeFeature(mesh,{type:'PROFILE_SLOT',kind:'SLOT_CENTER',face:best.face,stationS,slotId:nearest.id,slotIndex:nearest.index,slotOffset:nearest.offset,slotWidth:nearest.width,slotSource:nearest.source},mesh.localToWorld(point));
    }
  }
  return makeFeature(mesh,{type:'PROFILE_FACE',kind:'SIDE_FACE',face:best.face,stationS},mesh.localToWorld(best.point));
}

export function getSlotDefinitionsForFace(part,face){
  const normalizedFace=String(face||'FRONT').toUpperCase();
  if(isProfileFaceClosed(part,normalizedFace))return [];
  const definition=getDesignProfileDefinition(part?.designProfile?.profileId);
  if(!definition)return [];
  const explicit=(definition.slotDefinitions||[]).filter(slot=>slot.face===normalizedFace);
  if(explicit.length||definition.sectionStyle==='CATALOG_REFERENCE')return explicit.map(slot=>({...slot}));
  const [widthRaw,heightRaw]=part?.dimensions?.sectionSize||definition.sectionSize||[30,30];
  const span=['FRONT','BACK'].includes(normalizedFace)?Number(widthRaw||30):Number(heightRaw||30);
  const series=Math.max(1,Number(definition.series||inferSeries(span)||30));
  const count=Math.max(1,Math.round(span/series));
  const offsets=count===1?[0]:Array.from({length:count},(_,i)=>(i-(count-1)/2)*series).filter(value=>Math.abs(value)<=span/2-series*0.25+1e-6);
  return offsets.map((offset,index)=>({id:`${normalizedFace}-S${index+1}`,face:normalizedFace,index,offset,width:Number(part?.designProfile?.slotWidth||definition.slotWidth||0),source:'DESIGN_PROFILE'}));
}

export function getSlotOffsetsForFace(part,face){
  return getSlotDefinitionsForFace(part,face).map(slot=>slot.offset);
}

export function profileFeatureWorldPoint(mesh,feature){
  const part=mesh?.userData?.part;
  if(!mesh||part?.type!=='PROFILE'||!feature)return null;
  mesh.updateMatrixWorld(true);
  const length=Math.max(1,Number(part.dimensions?.length||1));
  const [widthRaw,heightRaw]=part.dimensions?.sectionSize||[30,30];
  const width=Number(widthRaw||30),height=Number(heightRaw||30);
  if(feature.type==='PROFILE_END'){
    const endpoints=getLocalEndpoints(part);
    return mesh.localToWorld(new THREE.Vector3(...(feature.end==='END'?endpoints.end:endpoints.start)));
  }
  const station=Math.max(0,Math.min(length,Number(feature.stationS??length/2)));
  const z=-length/2+station;
  if(feature.type==='PROFILE_SLOT')return mesh.localToWorld(slotLocalPoint(feature.face,width,height,z,Number(feature.slotOffset||0)));
  if(feature.type==='PROFILE_FACE')return mesh.localToWorld(faceLocalPoint(feature.face,width,height,z,Number(feature.faceOffset||0)));
  return mesh.getWorldPosition(new THREE.Vector3());
}

export function findNearestProfileFeature(mesh,worldPoint,options={}){
  const feature=resolveProfileFeature(mesh,worldPoint,options);
  if(!feature)return null;
  feature.distanceMm=feature.worldPoint.distanceTo(worldPoint);
  return feature;
}

export function featureLabel(feature){
  if(!feature)return '';
  if(feature.type==='PROFILE_END')return `${feature.end==='START'?'A':'B'}端点`;
  if(feature.type==='PROFILE_SLOT')return `${faceLabel(feature.face)}槽${Number(feature.slotIndex||0)+1}中心`;
  if(feature.type==='PROFILE_FACE')return `${faceLabel(feature.face)}面`;
  return '连接位置';
}

function faceLabel(face){
  return ({FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'})[String(face||'').toUpperCase()] || '侧面';
}

function makeFeature(mesh,data,worldPoint){
  const part=mesh.userData.part;
  return {...data,partId:part.id,displayId:part.displayId||part.name,worldPoint:worldPoint.clone()};
}

function slotLocalPoint(face,width,height,z,offset){
  if(face==='FRONT')return new THREE.Vector3(offset,height/2,z);
  if(face==='BACK')return new THREE.Vector3(offset,-height/2,z);
  if(face==='RIGHT')return new THREE.Vector3(width/2,offset,z);
  return new THREE.Vector3(-width/2,offset,z);
}

function faceLocalPoint(face,width,height,z,offset){
  if(face==='FRONT')return new THREE.Vector3(offset,height/2,z);
  if(face==='BACK')return new THREE.Vector3(offset,-height/2,z);
  if(face==='RIGHT')return new THREE.Vector3(width/2,offset,z);
  return new THREE.Vector3(-width/2,offset,z);
}

function inferSeries(span){
  for(const value of [20,30,40,45,60,80])if(Math.abs(span/value-Math.round(span/value))<1e-6)return value;
  return Math.min(40,span);
}
function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)));}
