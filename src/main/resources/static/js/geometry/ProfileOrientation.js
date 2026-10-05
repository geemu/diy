import * as THREE from 'three';

/** 绘制平面法向作为截面 local Y，避免非方形截面换方向后翻转、沉入工作平面。 */
export function profileQuaternion(direction, preferredUp = null) {
  const z = direction.clone().normalize();
  if (!preferredUp) return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),z);
  const up = preferredUp.clone().normalize();
  const x = up.clone().cross(z);
  if (x.lengthSq() < 1e-8) return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),z);
  x.normalize();
  const y = z.clone().cross(x).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}

export function workPlaneNormal(plane) {
  return plane === 'XY' ? new THREE.Vector3(0,0,1) : plane === 'YZ' ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
}
