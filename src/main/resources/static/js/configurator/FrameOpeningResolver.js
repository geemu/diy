import * as THREE from 'three';

const AXIS_NAMES = ['X','Y','Z'];

/**
 * Resolve a rectangular opening from four axis-aligned linear profile members.
 *
 * The resolver intentionally works from business profile roots instead of child
 * geometry. It is aimed at DIY workflows: select the four members surrounding an
 * opening, then let Panel/Door configurators consume one stable descriptor.
 */
export default class FrameOpeningResolver {
  constructor(editor) {
    this.editor = editor;
  }

  resolve(partIds = null, options = {}) {
    const ids = partIds?.length ? [...new Set(partIds)] : this.selectedProfileIds();
    if (ids.length !== 4) throw new Error('框口配置需要选择 4 根围成矩形的直线型材');
    const meshes = ids.map(id => this.editor.getMeshByPartId(id)).filter(Boolean);
    if (meshes.length !== 4 || meshes.some(mesh => mesh.userData?.part?.type !== 'PROFILE' || mesh.userData?.part?.profilePath?.type === 'ARC')) {
      throw new Error('框口配置仅支持 4 根直线型材');
    }

    const tolerance = Math.max(0.01, Number(options.axisToleranceMm ?? 0.1));
    const members = meshes.map(mesh => this.describeMember(mesh));
    const grouped = new Map();
    for (const member of members) {
      if (!grouped.has(member.axis)) grouped.set(member.axis, []);
      grouped.get(member.axis).push(member);
    }
    const directions = [...grouped.keys()];
    if (directions.length !== 2 || directions.some(axis => grouped.get(axis).length !== 2)) {
      throw new Error('所选型材必须由两组互相垂直的平行边组成');
    }

    const normalAxis = AXIS_NAMES.find(axis => !directions.includes(axis));
    const normalValues = members.map(item => item.center[normalAxis.toLowerCase()]);
    if (Math.max(...normalValues) - Math.min(...normalValues) > tolerance) {
      throw new Error('所选 4 根型材不在同一框口平面');
    }

    const preferred = preferredPanelAxes(normalAxis);
    if (!directions.includes(preferred.widthAxis) || !directions.includes(preferred.heightAxis)) {
      throw new Error('当前框口方向暂不支持自动配置');
    }

    const widthBounds = this.innerBounds(grouped.get(preferred.heightAxis), preferred.widthAxis);
    const heightBounds = this.innerBounds(grouped.get(preferred.widthAxis), preferred.heightAxis);
    const width = widthBounds.max - widthBounds.min;
    const height = heightBounds.max - heightBounds.min;
    if (!(width > 1) || !(height > 1)) throw new Error('框口净尺寸无效，请检查型材位置和截面尺寸');

    // 四条中心线的间距不能证明闭合：每条实体边必须覆盖净开口，四角也必须接触。
    for (const member of grouped.get(preferred.widthAxis)) this.assertCovers(member,preferred.widthAxis,widthBounds,tolerance);
    for (const member of grouped.get(preferred.heightAxis)) this.assertCovers(member,preferred.heightAxis,heightBounds,tolerance);
    for (const horizontal of grouped.get(preferred.widthAxis)) for (const vertical of grouped.get(preferred.heightAxis)) {
      if (AXIS_NAMES.some(axis => horizontal.box.max[axis.toLowerCase()] < vertical.box.min[axis.toLowerCase()] - tolerance || vertical.box.max[axis.toLowerCase()] < horizontal.box.min[axis.toLowerCase()] - tolerance)) {
        throw new Error('所选型材没有形成闭合框口：角部仍有间隙，请先吸附四个角');
      }
    }

    const center = {x:0,y:0,z:0};
    center[preferred.widthAxis.toLowerCase()] = (widthBounds.min + widthBounds.max) / 2;
    center[preferred.heightAxis.toLowerCase()] = (heightBounds.min + heightBounds.max) / 2;
    center[normalAxis.toLowerCase()] = normalValues.reduce((sum,value) => sum + value, 0) / normalValues.length;

    const basis = makePanelBasis(preferred.widthAxis, preferred.heightAxis);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.width,basis.height,basis.normal));
    const euler = new THREE.Euler().setFromQuaternion(quaternion,'XYZ');
    const assemblyIds = [...new Set(members.map(item => item.part.assemblyId).filter(Boolean))];

    return {
      sourcePartIds:members.map(item => item.part.id),
      sourceDisplayIds:members.map(item => item.part.displayId || item.part.id),
      widthAxis:preferred.widthAxis,
      heightAxis:preferred.heightAxis,
      normalAxis,
      width:Number(width.toFixed(4)),
      height:Number(height.toFixed(4)),
      center,
      rotation:{x:euler.x,y:euler.y,z:euler.z},
      basis:{
        width:{x:basis.width.x,y:basis.width.y,z:basis.width.z},
        height:{x:basis.height.x,y:basis.height.y,z:basis.height.z},
        normal:{x:basis.normal.x,y:basis.normal.y,z:basis.normal.z}
      },
      bounds:{width:widthBounds,height:heightBounds},
      assemblyId:assemblyIds.length === 1 ? assemblyIds[0] : null
    };
  }

  selectedProfileIds() {
    const meshes = this.editor.selectedMeshes?.length ? this.editor.selectedMeshes : (this.editor.selected ? [this.editor.selected] : []);
    return meshes.filter(mesh => mesh.userData?.part?.type === 'PROFILE').map(mesh => mesh.userData.part.id);
  }

  describeMember(mesh) {
    mesh.updateMatrixWorld(true);
    const part = mesh.userData.part;
    const center = mesh.getWorldPosition(new THREE.Vector3());
    const quaternion = mesh.getWorldQuaternion(new THREE.Quaternion());
    const direction = new THREE.Vector3(0,0,1).applyQuaternion(quaternion).normalize();
    const axis = dominantAxis(direction);
    if (Math.abs(direction[axis.toLowerCase()]) < 1 - 1e-7) throw new Error('框口填板目前支持沿画布方向的矩形框；斜框请使用自由添加');
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    return {mesh,part,axis,center,size,box};
  }

  assertCovers(member,axis,bounds,tolerance) {
    const key=axis.toLowerCase();
    if(member.box.min[key]>bounds.min+tolerance || member.box.max[key]<bounds.max-tolerance)throw new Error('所选型材没有围成框口：有边过短或偏离角部，请先检查四条边');
  }

  innerBounds(pair, coordinateAxis) {
    const key = coordinateAxis.toLowerCase();
    const sorted = [...pair].sort((a,b) => a.center[key] - b.center[key]);
    const low = sorted[0];
    const high = sorted[1];
    const lowThickness = Math.max(0.1, Number(low.size[key] || 0));
    const highThickness = Math.max(0.1, Number(high.size[key] || 0));
    return {
      min:low.center[key] + lowThickness / 2,
      max:high.center[key] - highThickness / 2
    };
  }
}

function dominantAxis(vector) {
  const values = {X:Math.abs(vector.x),Y:Math.abs(vector.y),Z:Math.abs(vector.z)};
  return [...AXIS_NAMES].sort((a,b) => values[b] - values[a])[0];
}

function preferredPanelAxes(normalAxis) {
  if (normalAxis === 'Z') return {widthAxis:'X',heightAxis:'Y'};
  if (normalAxis === 'Y') return {widthAxis:'X',heightAxis:'Z'};
  return {widthAxis:'Z',heightAxis:'Y'};
}

function axisVector(axis) {
  if (axis === 'X') return new THREE.Vector3(1,0,0);
  if (axis === 'Y') return new THREE.Vector3(0,1,0);
  return new THREE.Vector3(0,0,1);
}

function makePanelBasis(widthAxis,heightAxis) {
  const width = axisVector(widthAxis);
  const height = axisVector(heightAxis);
  const normal = new THREE.Vector3().crossVectors(width,height).normalize();
  return {width,height,normal};
}
