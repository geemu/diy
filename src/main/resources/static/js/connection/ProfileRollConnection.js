import * as THREE from 'three';
import {isLinearProfile} from '../model/ProfilePath.js';
import {normalizeDesignAnchor} from '../model/ConnectionAnchor.js';

const normals={FRONT:new THREE.Vector3(0,1,0),BACK:new THREE.Vector3(0,-1,0),LEFT:new THREE.Vector3(-1,0,0),RIGHT:new THREE.Vector3(1,0,0)};
const across=face=>['FRONT','BACK'].includes(face)?'x':'y';
const clean=value=>Math.abs(value)<1e-6?0:Number(value.toFixed(9));

/** 仅明确的原地横梁截面整90°转动；不在加载、平移、倾斜或普通转架时猜新的安装侧。 */
export function profileQuarterRolls(editor,beforeTransforms,profileIds=[]) {
  const result=new Map();if(!beforeTransforms)return result;
  for(const id of profileIds) {
    const mesh=editor.getMeshByPartId(id),before=beforeTransforms.get(id);
    if(!before||mesh?.userData?.part?.type!=='PROFILE'||!isLinearProfile(mesh.userData.part))continue;
    mesh.updateWorldMatrix(true,false);const after=mesh.matrixWorld;
    if([before,after].some(matrix=>matrix.determinant()<0||new THREE.Vector3().setFromMatrixScale(matrix).toArray().some(value=>Math.abs(value-1)>1e-5)))continue;
    if(new THREE.Vector3().setFromMatrixPosition(before).distanceTo(new THREE.Vector3().setFromMatrixPosition(after))>1e-5)continue;
    const axis=new THREE.Vector3(0,0,1).transformDirection(before),nextAxis=new THREE.Vector3(0,0,1).transformDirection(after);
    if(Math.abs(axis.y)>1e-5||axis.dot(nextAxis)<.9999999999)continue;
    const change=before.clone().invert().multiply(after),angle=Math.atan2(change.elements[1],change.elements[0]),turns=Math.round(angle/(Math.PI/2));
    if(!turns||Math.abs(angle-turns*Math.PI/2)>1e-5)continue;
    const inverse=after.clone().invert(),localChange=new THREE.Matrix3().setFromMatrix4(inverse.clone().multiply(before)),faces={};
    for(const [face,normal] of Object.entries(normals)) {
      const wanted=normal.clone().applyMatrix3(localChange).normalize();
      faces[face]=Object.keys(normals).find(key=>normals[key].dot(wanted)>.9999999999);
    }
    if(Object.values(faces).some(face=>!face))continue;
    result.set(id,{faces,localChange});
  }
  return result;
}

function offsetAfterRoll(value,face,roll) {
  if(!roll)return value;
  const point=new THREE.Vector3();point[across(face)]=value;point.applyMatrix3(roll.localChange);
  return clean(point[across(roll.faces[face])]);
}

/** 世界安装侧、站位和槽横向意图保持，只有宿主局部面 / 坐标重映射；零件尺寸不改。 */
function localReferences(record,sourceRoll,targetRoll,sourceFace) {
  const result={};
  if(sourceRoll&&sourceFace)result.sourceMountFace=sourceRoll.faces[sourceFace];
  if(targetRoll&&record.targetFace)result.targetFace=targetRoll.faces[record.targetFace];
  if(sourceRoll&&record.designAnchorOffset!=null) {
    const offset=normalizeDesignAnchor(record.designAnchorOffset);
    if(!offset)return null;
    const point=new THREE.Vector3(offset.x,offset.y,0).applyMatrix3(sourceRoll.localChange);
    result.designAnchorOffset={x:clean(point.x),y:clean(point.y)};
  }
  if(record.sideMount) {
    const reference=record.sideMount;
    result.sideMount={...reference,
      sourceContactFace:sourceRoll?.faces[reference.sourceContactFace]||reference.sourceContactFace,
      sourceSlotOffset:offsetAfterRoll(reference.sourceSlotOffset,sourceFace,sourceRoll)};
    if(reference.targetContactFace)result.sideMount.targetContactFace=targetRoll?.faces[reference.targetContactFace]||reference.targetContactFace;
  }
  if(record.sideSlot) {
    const reference=record.sideSlot;
    result.sideSlot={sourceFace:sourceRoll?.faces[reference.sourceFace]||reference.sourceFace,
      sourceSlotOffset:offsetAfterRoll(reference.sourceSlotOffset,reference.sourceFace,sourceRoll),
      targetSlotOffset:offsetAfterRoll(reference.targetSlotOffset,record.targetFace,targetRoll)};
  }
  return result;
}

export function rolledConnectionReferences(connection,sourceRoll,targetRoll,mountFaces) {
  if(!sourceRoll&&!targetRoll)return null;
  if(connection.manufacturingRuleId||!connection.designComponent||mountFaces.length!==1)return null;
  const kind=connection.designComponent.dimensions?.geometryKind;
  if(!['ANGLE_BRACKET','CORNER_CUBE','L_BRACKET','HIDDEN_CORNER','FLAT_PLATE'].includes(kind))return null;
  if(kind==='FLAT_PLATE'&&connection.jointKind!=='SIDE_SLOT')return null;
  if(!normals[mountFaces[0]]||!normals[connection.targetFace])return null;
  const face=mountFaces[0],result=localReferences(connection,sourceRoll,targetRoll,face);
  if(!result)return null;
  const nextFace=result.sourceMountFace||face;
  Object.assign(result,{sourceMountFace:nextFace,designComponentMountFace:nextFace,designComponentMountFaces:[nextFace]});
  if(connection.designComponentVariants) {
    result.designComponentVariants={};
    for(const [type,variant] of Object.entries(connection.designComponentVariants)) {
      const mapped=localReferences({...variant,targetFace:connection.targetFace},sourceRoll,targetRoll,variant.sourceMountFace);
      if(!mapped)return null;
      delete mapped.targetFace;
      result.designComponentVariants[type]={...variant,...mapped};
    }
  }
  return result;
}
