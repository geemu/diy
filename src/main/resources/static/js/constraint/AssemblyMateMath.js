import * as THREE from 'three';
import {getLocalEndpoints} from '../model/ProfilePath.js';

export const MATE_KINDS = Object.freeze({
  COINCIDENT:'COINCIDENT', DISTANCE:'DISTANCE', SLOT_CENTER:'SLOT_CENTER', AXIS_NORMAL:'AXIS_NORMAL',
  END_COINCIDENT:'END_COINCIDENT', SLOT_TO_SLOT:'SLOT_TO_SLOT', PARALLEL:'PARALLEL', PERPENDICULAR:'PERPENDICULAR', COAXIAL:'COAXIAL', COPLANAR:'COPLANAR',
  ANGLE:'ANGLE', SLIDER:'SLIDER', REVOLUTE:'REVOLUTE', CYLINDRICAL:'CYLINDRICAL'
});

export function featureWorldPoint(editor, feature) {
  const mesh = editor.getMeshByPartId(feature?.partId);
  if (!mesh) return null;
  mesh.updateMatrixWorld(true);
  const part = mesh.userData.part;
  const length = Number(part.dimensions?.length || 0);
  const [wRaw,hRaw] = part.dimensions?.sectionSize || [30,30];
  const w=Number(wRaw||30), h=Number(hRaw||30), s=Math.max(0,Math.min(length,Number(feature.stationS ?? length/2)));
  if (feature.type === 'PROFILE_END') {
    const ends=getLocalEndpoints(part); return mesh.localToWorld(new THREE.Vector3(...(feature.end==='END'?ends.end:ends.start)));
  }
  const z=-length/2+s;
  if (feature.type === 'PROFILE_SLOT') {
    const slotOffset=Number(feature.slotOffset||0);
    if (feature.face==='FRONT') return mesh.localToWorld(new THREE.Vector3(slotOffset,h/2,z));
    if (feature.face==='BACK') return mesh.localToWorld(new THREE.Vector3(slotOffset,-h/2,z));
    if (feature.face==='RIGHT') return mesh.localToWorld(new THREE.Vector3(w/2,slotOffset,z));
    return mesh.localToWorld(new THREE.Vector3(-w/2,slotOffset,z));
  }
  if (feature.type === 'PROFILE_FACE') {
    if (feature.face==='FRONT') return mesh.localToWorld(new THREE.Vector3(0,h/2,z));
    if (feature.face==='BACK') return mesh.localToWorld(new THREE.Vector3(0,-h/2,z));
    if (feature.face==='RIGHT') return mesh.localToWorld(new THREE.Vector3(w/2,0,z));
    return mesh.localToWorld(new THREE.Vector3(-w/2,0,z));
  }
  return mesh.getWorldPosition(new THREE.Vector3());
}

export function profileAxis(mesh) { mesh.updateMatrixWorld(true); return new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld).normalize(); }
export function endAxis(mesh,end) { return profileAxis(mesh).multiplyScalar(end==='START'?-1:1); }

export function alignVector(mesh,fromWorld,toWorld) {
  const a=fromWorld.clone().normalize(), b=toWorld.clone().normalize();
  if (a.lengthSq()<1e-8 || b.lengthSq()<1e-8) return;
  mesh.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(a,b)).normalize(); mesh.updateMatrixWorld(true);
}

export function translateFeatureTo(editor,sourceMesh,sourceFeature,targetPoint) {
  const p=featureWorldPoint(editor,sourceFeature); if (!p) return;
  sourceMesh.position.add(targetPoint.clone().sub(p)); sourceMesh.updateMatrixWorld(true);
}
