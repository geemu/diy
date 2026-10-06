import * as THREE from 'three';
import {profileObb} from '../validation/PartCollisionDetector.js';

/** 地面为 Y=0；按真实底面计算带符号距离，不按中心点，不阻止进入平面以下。 */
export function lowestSurfaceY(mesh){
  const part=mesh?.userData?.part;
  if(!part)return Infinity;
  const position=mesh.getWorldPosition(new THREE.Vector3());
  const rotation=new THREE.Euler().setFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()),'XYZ');
  const obb=profileObb({...part,position,rotation});
  if(obb)return obb.center.y-obb.half.reduce((sum,half,index)=>sum+half*Math.abs(obb.axes[index].y),0);
  mesh.updateMatrixWorld(true);
  let minimum=Infinity;
  mesh.traverse(node=>{
    if(!node.geometry||node.userData?.presentationOnly||node.userData?.isHelper)return;
    for(let ancestor=node;ancestor&&ancestor!==mesh;ancestor=ancestor.parent)if(ancestor.name?.startsWith('__'))return;
    node.geometry.computeBoundingBox();
    if(node.geometry.boundingBox)minimum=Math.min(minimum,node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld).min.y);
  });
  return minimum;
}

export function groundClearance(meshes){return Math.min(...meshes.map(lowestSurfaceY));}
