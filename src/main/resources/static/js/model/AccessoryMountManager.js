import * as THREE from 'three';
import {getLocalEndpoints} from './ProfilePath.js';

/**
 * 标准配件安装关系管理。
 *
 * <p>mountReference 是业务事实，Three.js Transform 只是它的可视化结果。
 * 当宿主构件移动、旋转或尺寸变化时，本类根据 mountReference 重新计算配件 Transform，
 * 避免“看起来装上了，但宿主变化后配件留在原地”。</p>
 */
export default class AccessoryMountManager {
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * 刷新指定宿主构件上的全部配件。
   * @param {string[]} targetPartIds 宿主构件 ID
   * @return {number} 已刷新配件数量
   */
  refreshForTargets(targetPartIds = []) {
    const ids = new Set((targetPartIds || []).filter(Boolean));
    if (!ids.size) return 0;
    let count = 0;
    for (const mesh of this.editor.meshes) {
      const reference = mesh?.userData?.part?.mountReference;
      if (!reference?.targetPartId || !ids.has(reference.targetPartId)) continue;
      if (this.refreshAccessory(mesh)) count++;
    }
    return count;
  }

  /**
   * 工程加载后恢复全部安装关系。
   * @return {number} 已刷新配件数量
   */
  refreshAll() {
    let count = 0;
    for (const mesh of this.editor.meshes) {
      if (this.refreshAccessory(mesh)) count++;
    }
    return count;
  }

  /**
   * 根据当前 mountReference 重新定位一个标准配件。
   * @param {THREE.Object3D} accessoryMesh 配件根对象
   * @return {boolean} 是否完成刷新
   */
  refreshAccessory(accessoryMesh) {
    const part = accessoryMesh?.userData?.part;
    const reference = part?.mountReference;
    if (part?.type !== 'ACCESSORY' || !reference?.targetPartId) return false;

    const targetMesh = this.editor.getMeshByPartId(reference.targetPartId);
    if (!targetMesh?.userData?.part) return false;

    const targetType = String(reference.targetType || part.mountRule?.target || '').toUpperCase();
    let transform = null;
    if (['PROFILE_END','PROFILE_BOTTOM'].includes(targetType)) {
      transform = this.resolveProfileEnd(part,targetMesh,{targetType,end:reference.end});
    } else if (targetType === 'PANEL_SIDE') {
      transform = this.resolvePanelSide(part,targetMesh,{side:reference.side});
    } else if(targetType==='SHAFT_AXIS') {
      transform=this.resolveShaftAxis(part,targetMesh,{stationS:reference.stationS});
    }
    if (!transform) return false;

    this.applyTransform(accessoryMesh,transform);
    this.editor.syncPartFromMesh(accessoryMesh);
    return true;
  }

  /**
   * 计算端盖、脚杯、脚轮在型材端部的安装 Transform。
   * source 可以是目录 definition，也可以是已经创建的 ACCESSORY Part。
   */
  resolveProfileEnd(source,targetMesh,options = {}) {
    const targetPart = targetMesh?.userData?.part;
    if (targetPart?.type !== 'PROFILE') return null;

    const endpoints = getLocalEndpoints(targetPart);
    const start = targetMesh.localToWorld(new THREE.Vector3(...endpoints.start));
    const end = targetMesh.localToWorld(new THREE.Vector3(...endpoints.end));
    const direction = this.profileWorldDirection(targetMesh);

    let endName = options.end === 'START' || options.end === 'END' ? options.end : null;
    if (!endName && options.targetType === 'PROFILE_BOTTOM') endName = start.y <= end.y ? 'START' : 'END';
    if (!endName) endName = 'END';

    const point = endName === 'START' ? start : end;
    const inward = direction.clone().multiplyScalar(endName === 'START' ? 1 : -1).normalize();
    const outward = inward.clone().multiplyScalar(-1);
    const accessoryType = source?.accessoryType;

    let quaternion;
    const position = point.clone();
    if (accessoryType === 'END_CAP') {
      quaternion = targetMesh.getWorldQuaternion(new THREE.Quaternion());
      const thickness = Number(source?.dimensions?.thickness ?? source?.thickness ?? 6);
      position.add(outward.multiplyScalar(thickness / 2));
    } else {
      // 脚杯/脚轮的局部 +Y 是安装杆方向，需要始终朝向型材内部。
      quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),inward);
    }

    return {
      position:this.toPlainPoint(position),
      rotation:this.toPlainEuler(quaternion),
      mountReference:{
        targetPartId:targetPart.id,
        targetType:options.targetType || source?.mountRule?.target || 'PROFILE_END',
        end:endName
      }
    };
  }

  /**
   * 计算抽屉滑轨在板材侧面的安装 Transform。
   */
  resolvePanelSide(source,targetMesh,options = {}) {
    const targetPart = targetMesh?.userData?.part;
    if (targetPart?.type !== 'PANEL') return null;

    const width = Number(source?.dimensions?.width ?? source?.width ?? 12);
    const thickness = Number(targetPart.dimensions?.thickness || 18);
    const side = options.side === 'BACK' ? 'BACK' : 'FRONT';
    const localPosition = new THREE.Vector3(0,0,(thickness / 2 + width / 2) * (side === 'BACK' ? -1 : 1));
    const position = targetMesh.localToWorld(localPosition);
    const targetQuaternion = targetMesh.getWorldQuaternion(new THREE.Quaternion());
    // 滑轨几何长度沿局部 Z，安装到板材后转到板材局部 X 方向。
    const rotateToPanelAxis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI / 2);
    const quaternion = targetQuaternion.clone().multiply(rotateToPanelAxis);

    return {
      position:this.toPlainPoint(position),
      rotation:this.toPlainEuler(quaternion),
      mountReference:{
        targetPartId:targetPart.id,
        targetType:'PANEL_SIDE',
        side
      }
    };
  }

  /** 固定夹沿光轴中心线安装；位置保存为从 A 端量起的站位，随宿主姿态更新。 */
  resolveShaftAxis(source,targetMesh,options={}) {
    const part=targetMesh?.userData?.part;if(part?.type!=='SHAFT')return null;
    const length=Number(part.dimensions.length),stationS=Math.max(0,Math.min(length,Number(options.stationS??length/2)));
    const d=source.dimensions||source,offset=d.geometryKind==='SHAFT_LIMIT_RING'?0:Number(d.diameter||part.dimensions.diameter)*1.2;
    const position=targetMesh.localToWorld(new THREE.Vector3(0,offset,stationS-length/2));
    const quaternion=targetMesh.getWorldQuaternion(new THREE.Quaternion());
    return {position:this.toPlainPoint(position),rotation:this.toPlainEuler(quaternion),mountReference:{targetType:'SHAFT_AXIS',targetPartId:part.id,stationS}};
  }

  applyTransform(mesh,transform) {
    mesh.position.set(transform.position.x,transform.position.y,transform.position.z);
    mesh.rotation.set(transform.rotation.x,transform.rotation.y,transform.rotation.z);
    mesh.updateMatrixWorld(true);
  }

  profileWorldDirection(mesh) {
    const quaternion = mesh.getWorldQuaternion(new THREE.Quaternion());
    return new THREE.Vector3(0,0,1).applyQuaternion(quaternion).normalize();
  }

  toPlainPoint(vector) {
    return {x:Number(vector.x),y:Number(vector.y),z:Number(vector.z)};
  }

  toPlainEuler(quaternion) {
    const euler = new THREE.Euler().setFromQuaternion(quaternion,'XYZ');
    return {x:euler.x,y:euler.y,z:euler.z};
  }
}
