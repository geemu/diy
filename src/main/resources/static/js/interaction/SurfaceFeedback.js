import * as THREE from 'three';
import {profileFaceLocalNormal} from '../model/ProfileFeatureCatalog.js';

/** 只读展示层：从真实三角面取色，不填平孔/槽，不把提示网格加入工程构件。 */
export function createSurfaceFeedback(root, options = {}) {
  if (!root) return null;
  root.updateWorldMatrix(true,true);
  const inverse = root.matrixWorld.clone().invert();
  const positions = [];
  const feature = options.feature;
  const face = feature?.face || feature?.targetFace;
  const end = feature?.end || feature?.targetEnd;
  const normal = face ? profileFaceLocalNormal(face) : end ? new THREE.Vector3(0,0,end === 'START' ? -1 : 1) : null;
  if (feature && !normal) return null;
  const planes = [];
  if (options.clipObb) {
    const obb = options.clipObb;
    const center = new THREE.Vector3(obb.center.x,obb.center.y,obb.center.z);
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [-1,1]) {
        const n = new THREE.Vector3(obb.axes[axis].x,obb.axes[axis].y,obb.axes[axis].z).multiplyScalar(sign);
        const p = center.clone().addScaledVector(n,obb.half[axis] + (options.marginMm || 0));
        planes.push(new THREE.Plane().setFromNormalAndCoplanarPoint(n,p).applyMatrix4(inverse));
      }
    }
  }
  // 端面和侧面只着色外侧平面，不能把内部孔壁误认为吸附目标面。
  const dimensions = root.userData?.part?.dimensions;
  const size = dimensions?.sectionSize;
  const boundary = normal && size ? Math.abs(normal.x)*size[0]/2 + Math.abs(normal.y)*size[1]/2 + Math.abs(normal.z)*Number(dimensions.length)/2 : null;
  root.traverse(object => {
    if (!object.isMesh || !object.visible || !object.geometry?.attributes.position || object.userData?.surfaceFeedback) return;
    // 加工标签/孔指示器不是原始实体表面，不能被当作新的贴合面。
    for (let ancestor = object; ancestor && ancestor !== root; ancestor = ancestor.parent) {
      if (ancestor.name?.startsWith('__')) return;
    }
    const geometry = object.geometry;
    const attribute = geometry.attributes.position;
    const matrix = inverse.clone().multiply(object.matrixWorld);
    const index = geometry.index;
    const count = index ? index.count : attribute.count;
    for (let i = 0; i < count; i += 3) {
      let triangle = [0,1,2].map(offset => new THREE.Vector3().fromBufferAttribute(attribute,index ? index.getX(i+offset) : i+offset).applyMatrix4(matrix));
      if (normal) {
        const n = triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize();
        if (n.dot(normal) < 0.98) continue;
        if (boundary !== null && triangle.some(point => Math.abs(point.dot(normal)-boundary) > 0.1)) continue;
      }
      for (const plane of planes) triangle = clipPolygon(triangle,plane);
      for (let j = 1; j < triangle.length-1; j++) {
        for (const point of [triangle[0],triangle[j],triangle[j+1]]) positions.push(point.x,point.y,point.z);
      }
    }
  });
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({color:options.color ?? 0x25c778,opacity:options.opacity ?? 0.34,transparent:true,side:THREE.DoubleSide,depthWrite:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:false});
  const helper = new THREE.Mesh(geometry,material);
  helper.name = '__surface_feedback__';
  helper.userData.surfaceFeedback = true;
  helper.renderOrder = options.renderOrder ?? 1504;
  helper.matrixAutoUpdate = false;
  helper.raycast = () => {};
  helper.update = () => {root.updateWorldMatrix(true,false);helper.matrix.copy(root.matrixWorld);helper.matrixWorldNeedsUpdate=true;};
  helper.update();
  return helper;
}

/** 接触色带只裁剪已判定贴合的构件；扩展量是视觉提示宽度，不是干涉/装配容差。 */
function clipPolygon(points,plane) {
  if (!points.length) return points;
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],b = points[(i+1)%points.length];
    const da = plane.distanceToPoint(a),db = plane.distanceToPoint(b);
    if (da <= 0.00001) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) result.push(a.clone().lerp(b,da/(da-db)));
  }
  return result;
}

/** 提示资源归展示层所有；遍历释放嵌套节点并正确解除 parent。 */
export function disposeFeedback(object) {
  object?.removeFromParent();
  const geometries = new Set(),materials = new Set();
  object?.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) if (material) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

/** 长度/截面/加工重建会替换实体几何；不能让选中色块停留在编辑前的形状。 */
export function surfaceGeometryKey(root) {
  const keys=[];
  root.updateWorldMatrix(true,true);
  root.traverse(object=>{if(object.isMesh)keys.push(`${object.geometry?.uuid}:${object.geometry?.attributes.position?.version}:${object.visible}:${object===root?'':object.matrix.elements.join(',')}`);});
  return keys.join('|');
}
