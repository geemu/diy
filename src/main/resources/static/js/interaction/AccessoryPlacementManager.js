import * as THREE from 'three';
import {hardwareDimensions} from '../model/HardwareCatalog.js';
import {getLocalEndpoints} from '../model/ProfilePath.js';

/**
 * 玩家式配件放置器。
 *
 * 统一流程：选择配件 -> 鼠标靠近可安装位置 -> Ghost 预览 -> 单击安装。
 * mountReference 仍由 AccessoryMountManager 作为唯一安装事实来源；本类只负责交互编排。
 */
export default class AccessoryPlacementManager {
  constructor(editor) {
    this.editor = editor;
    this.definition = null;
    this.hover = null;
    this.seed = null;
    this.onChanged = null;
    this.previewGroup = new THREE.Group();
    this.previewGroup.name = '__accessory_placement_preview__';
    this.previewGroup.renderOrder = 1500;
    this.editor.sceneManager.scene.add(this.previewGroup);
  }

  isActive() { return !!this.definition; }

  begin(definition, options = {}) {
    if (!definition) throw new Error('请选择需要放置的配件');
    this.definition = structuredClone(definition);
    this.hover = null;
    this.seed = normalizeSeed(options.seed);
    this.clearPreview();
    if (this.seed?.partId) this.hover = this.resolveSeed(this.seed);
    this.renderPreview();
    this.emit(this.statusText(),false);
    return this.hover;
  }

  cancel() {
    const active = this.isActive();
    this.definition = null;
    this.hover = null;
    this.seed = null;
    this.clearPreview();
    if (active) this.emit('已退出配件放置');
  }

  handlePointerMove(event) {
    if (!this.isActive()) return false;
    this.seed = null;
    this.hover = this.resolveEvent(event);
    this.renderPreview();
    this.emit(this.statusText(),false);
    return true;
  }

  handleClick(event) {
    if (!this.isActive()) return false;
    const target = this.seed ? this.resolveSeed(this.seed) : this.resolveEvent(event);
    this.seed = null;
    if (!target) {
      this.hover = null;
      this.renderPreview();
      this.emit(this.requiredTargetMessage());
      return true;
    }
    this.hover = target;
    this.renderPreview();
    if (!target.valid) {
      this.emit(target.reason || '当前位置不能安装该配件');
      return true;
    }
    try {
      const definition = structuredClone(this.definition);
      const mesh = this.editor.mountHardware(definition.id,target.targetPart.id,{
        definition,
        end:target.end || undefined,
        side:target.side || undefined
      });
      this.editor.interferenceFeedbackManager.requestRefresh();
      this.emit(`已安装：${definition.label || definition.model || '配件'}`);
      this.hover = null;
      this.clearPreview();
      return mesh;
    } catch (error) {
      this.emit(error?.message || '配件安装失败');
      return true;
    }
  }

  resolveEvent(event) {
    const targetType = mountTarget(this.definition);
    const meshes = this.targetMeshes(targetType);
    const hit = this.editor.sceneManager.pickHit(event,meshes);
    if (!hit?.object || !hit?.point) return null;
    return this.resolveTarget(hit.object,hit.point,targetType);
  }

  resolveSeed(seed) {
    const mesh = this.editor.getMeshByPartId(seed?.partId);
    if (!mesh) return null;
    const targetType = mountTarget(this.definition);
    if (!this.isTargetMesh(mesh,targetType)) return null;
    const point = seed.worldPoint ? new THREE.Vector3(seed.worldPoint.x,seed.worldPoint.y,seed.worldPoint.z) : null;
    return this.resolveTarget(mesh,point,targetType,{end:seed.end,side:seed.side});
  }

  resolveTarget(mesh,worldPoint,targetType,preferred = {}) {
    const targetPart = mesh?.userData?.part;
    if (!targetPart) return null;
    let transform = null;
    let end = preferred.end || null;
    let side = preferred.side || null;

    if (['PROFILE_END','PROFILE_BOTTOM'].includes(targetType)) {
      if (targetPart.type !== 'PROFILE') return null;
      if (!end) end = targetType === 'PROFILE_BOTTOM' ? this.bottomEnd(mesh) : this.nearestProfileEnd(mesh,worldPoint);
      transform = this.editor.accessoryMountManager.resolveProfileEnd(this.definition,mesh,{targetType,end});
    } else if (targetType === 'PANEL_SIDE') {
      if (targetPart.type !== 'PANEL') return null;
      if (!side) side = this.panelSide(mesh,worldPoint);
      transform = this.editor.accessoryMountManager.resolvePanelSide(this.definition,mesh,{side});
    } else {
      return {targetMesh:mesh,targetPart,valid:false,reason:'该配件还没有配置可吸附的安装位置'};
    }
    if (!transform) return {targetMesh:mesh,targetPart,valid:false,reason:'无法计算该配件的安装位置'};

    const compatibility = this.validateCompatibility(targetPart);
    if (!compatibility.valid) {
      return {targetMesh:mesh,targetPart,targetType,end,side,transform,valid:false,reason:compatibility.reason};
    }
    const collision = this.previewCollision(transform,targetPart.id);
    return {
      targetMesh:mesh,
      targetPart,
      targetType,
      end,
      side,
      transform,
      valid:!collision.blocked,
      collision,
      reason:collision.blocked ? `该位置与 ${collision.label} 发生干涉` : ''
    };
  }

  validateCompatibility(targetPart) {
    const rule = this.definition?.mountRule || {};
    const nominal = String(rule.profileNominal || '').trim();
    if (nominal && targetPart?.type === 'PROFILE') {
      const designNominal = String(targetPart.designProfile?.nominal || targetPart.designProfile?.name || '').replace(/[^0-9]/g,'');
      if (designNominal && !designNominal.startsWith(nominal)) {
        return {valid:false,reason:`该配件适配 ${nominal} 截面，当前型材截面不匹配`};
      }
    }
    return {valid:true,reason:''};
  }

  previewCollision(transform,targetPartId) {
    const ghost = this.createGhostMesh(transform,0x2ab673,0.32);
    if (!ghost) return {blocked:false,label:''};
    ghost.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ghost);
    const tolerance = Math.max(0.25,Number(this.editor.projectSettings?.collisionToleranceMm ?? 0.5));
    let result={blocked:false,label:''};
    for (const mesh of this.editor.meshes || []) {
      const part = mesh?.userData?.part;
      if (!part || part.id === targetPartId || part.hidden || mesh.visible === false) continue;
      if (!['PROFILE','PANEL','SHAFT','ACCESSORY'].includes(part.type)) continue;
      const other = new THREE.Box3().setFromObject(mesh);
      if (other.isEmpty()) continue;
      const overlapX = Math.min(box.max.x,other.max.x)-Math.max(box.min.x,other.min.x);
      const overlapY = Math.min(box.max.y,other.max.y)-Math.max(box.min.y,other.min.y);
      const overlapZ = Math.min(box.max.z,other.max.z)-Math.max(box.min.z,other.min.z);
      if (overlapX > tolerance && overlapY > tolerance && overlapZ > tolerance) {
        result={blocked:true,label:part.displayId || part.name || '其他构件'};
        break;
      }
    }
    disposeObject(ghost);
    return result;
  }

  renderPreview() {
    this.clearPreview();
    if (!this.hover?.transform || !this.definition) return;
    const valid = this.hover.valid !== false;
    const color = valid ? 0x24b36b : 0xe54848;
    const ghost = this.createGhostMesh(this.hover.transform,color,valid ? 0.52 : 0.42);
    if (ghost) this.previewGroup.add(ghost);
    const point = this.mountPoint(this.hover.transform);
    if (point) this.previewGroup.add(marker(point,color,7));
  }

  createGhostMesh(transform,color,opacity) {
    if (!this.definition || !transform) return null;
    const part = {
      id:'__preview_accessory__',
      displayId:'',
      name:this.definition.label || '配件预览',
      type:'ACCESSORY',
      accessoryType:this.definition.accessoryType || 'ACCESSORY',
      dimensions:{...hardwareDimensions(this.definition)},
      position:{...transform.position},
      rotation:{...transform.rotation},
      color:'#ffffff',
      hidden:false,
      locked:true
    };
    const mesh = this.editor.createPartMesh(part);
    mesh.traverse(child => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const mapped = materials.map(material => {
        const next = material?.clone?.() || new THREE.MeshBasicMaterial();
        next.color?.setHex?.(color);
        next.transparent = true;
        next.opacity = opacity;
        next.depthTest = false;
        next.depthWrite = false;
        return next;
      });
      child.material = Array.isArray(child.material) ? mapped : mapped[0];
      child.renderOrder = 1501;
    });
    mesh.userData.__placementPreview = true;
    return mesh;
  }

  mountPoint(transform) {
    if (!transform?.position) return null;
    return new THREE.Vector3(Number(transform.position.x||0),Number(transform.position.y||0),Number(transform.position.z||0));
  }

  nearestProfileEnd(mesh,worldPoint) {
    const part = mesh?.userData?.part;
    const endpoints = getLocalEndpoints(part);
    const start = mesh.localToWorld(new THREE.Vector3(...endpoints.start));
    const end = mesh.localToWorld(new THREE.Vector3(...endpoints.end));
    if (!worldPoint) return 'END';
    return start.distanceTo(worldPoint) <= end.distanceTo(worldPoint) ? 'START' : 'END';
  }

  bottomEnd(mesh) {
    const endpoints = getLocalEndpoints(mesh?.userData?.part);
    const start = mesh.localToWorld(new THREE.Vector3(...endpoints.start));
    const end = mesh.localToWorld(new THREE.Vector3(...endpoints.end));
    return start.y <= end.y ? 'START' : 'END';
  }

  panelSide(mesh,worldPoint) {
    if (!worldPoint) return 'FRONT';
    const local = mesh.worldToLocal(worldPoint.clone());
    return local.z < 0 ? 'BACK' : 'FRONT';
  }

  targetMeshes(targetType) {
    return (this.editor.meshes || []).filter(mesh => mesh.visible !== false && this.isTargetMesh(mesh,targetType));
  }

  isTargetMesh(mesh,targetType) {
    const type = mesh?.userData?.part?.type;
    if (['PROFILE_END','PROFILE_BOTTOM'].includes(targetType)) return type === 'PROFILE';
    if (targetType === 'PANEL_SIDE') return type === 'PANEL';
    return false;
  }

  requiredTargetMessage() {
    const target = mountTarget(this.definition);
    if (['PROFILE_END','PROFILE_BOTTOM'].includes(target)) return '请把鼠标移到型材端部附近';
    if (target === 'PANEL_SIDE') return '请把鼠标移到板材需要安装的侧面';
    return '该配件暂不支持吸附安装';
  }

  statusText() {
    if (!this.definition) return '';
    if (!this.hover) return `${this.definition.label || '配件'}：${this.requiredTargetMessage()}，单击安装`;
    if (!this.hover.valid) return `不可安装：${this.hover.reason || '当前位置无效'}`;
    const location = this.hover.end ? (this.hover.end === 'START' ? 'A端' : 'B端') : (this.hover.side === 'BACK' ? '背面' : this.hover.side === 'FRONT' ? '正面' : '当前位置');
    return `可安装：${this.definition.label || '配件'} → ${this.hover.targetPart.displayId || this.hover.targetPart.name} ${location}`;
  }

  clearPreview() {
    while (this.previewGroup.children.length) {
      const child = this.previewGroup.children.pop();
      disposeObject(child);
    }
  }

  emit(message,notify=true) {
    this.onChanged?.({
      active:this.isActive(),
      definitionId:this.definition?.id || null,
      label:this.definition?.label || '',
      valid:this.hover?.valid ?? null,
      message,
      notify
    });
  }
}

function mountTarget(definition) {
  let target = String(definition?.mountRule?.target || '').toUpperCase();
  if (definition?.accessoryType === 'LEVELING_FOOT' && target === 'PROFILE_END') target = 'PROFILE_BOTTOM';
  return target;
}

function normalizeSeed(seed) {
  if (!seed?.partId) return null;
  return {
    partId:seed.partId,
    worldPoint:seed.worldPoint ? {x:Number(seed.worldPoint.x||0),y:Number(seed.worldPoint.y||0),z:Number(seed.worldPoint.z||0)} : null,
    end:seed.end || null,
    side:seed.side || null
  };
}

function marker(point,color,size) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size,16,16),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,depthTest:false,depthWrite:false})
  );
  mesh.position.copy(point);
  mesh.renderOrder = 1502;
  return mesh;
}

function disposeObject(object) {
  object?.traverse?.(child => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach(material=>material?.dispose?.());
    else child.material?.dispose?.();
  });
}
