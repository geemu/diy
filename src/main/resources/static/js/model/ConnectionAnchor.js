import * as THREE from 'three';
import {getSlotDefinitionsForFace} from './ProfileFeatureCatalog.js';

/** 设计件仅沿源端面的横向移动；局部偏移随宿主，不保存相机或世界坐标。 */
export function normalizeDesignAnchor(value) {
  if(value==null)return {x:0,y:0};
  if(typeof value!=='object'||Array.isArray(value)||!Number.isFinite(value.x)||!Number.isFinite(value.y))return null;
  return {x:Number(value.x),y:Number(value.y)};
}

export function designAnchorKey(value) {
  const offset=normalizeDesignAnchor(value);
  return offset?[offset.x,offset.y].map(number=>(Math.round(number*1000)/1000).toFixed(3)).join(','):'INVALID';
}

export function sameDesignAnchor(first,second) {
  const a=normalizeDesignAnchor(first),b=normalizeDesignAnchor(second);
  return !!a&&!!b&&Math.hypot(a.x-b.x,a.y-b.y)<=.1;
}

/** 制造的中心规则不使用接头去重容差来吞掉显式偏置。 */
export function isCenteredDesignAnchor(value){
  const offset=normalizeDesignAnchor(value);
  return !!offset&&Math.hypot(offset.x,offset.y)<=1e-6;
}

/** 每个候选由实际源槽与第一枚孔推导，其他孔、目标槽及整条腿仍须逐项通过安装校验。 */
export function componentAnchorOffsets(source,face,layout,transform) {
  if(!layout?.sourcePorts?.length||!transform)return [{x:0,y:0}];
  source.updateWorldMatrix(true,false);
  const axis=['FRONT','BACK'].includes(face)?'x':'y',part=source.userData.part;
  const point=new THREE.Vector3(...layout.sourcePorts[0].point).applyQuaternion(transform.quaternion).add(transform.position);
  const across=source.worldToLocal(point)[axis],limit=Number(part.dimensions.sectionSize[axis==='x'?0:1])/2;
  const offsets=[{x:0,y:0}],keys=new Set(['0.000,0.000']);
  for(const slot of getSlotDefinitionsForFace(part,face)){
    const value=Number(slot.offset)-across;
    if(!Number.isFinite(value)||Math.abs(value)>limit+.1)continue;
    const offset={x:0,y:0};offset[axis]=Math.abs(value)<1e-6?0:value;
    const key=designAnchorKey(offset);if(keys.has(key))continue;
    keys.add(key);offsets.push(offset);
  }
  return offsets.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));
}
