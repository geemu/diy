import * as THREE from 'three';
import {hardwareDimensions} from '../model/HardwareCatalog.js';
import {getLocalEndpoints} from '../model/ProfilePath.js';
import {workPlaneNormal} from '../geometry/ProfileOrientation.js';

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
      const mesh = target.free ? this.editor.addCatalogComponent(definition,{...target.transform}) : this.editor.mountHardware(definition.id,target.targetPart.id,{
        definition,
        end:target.end || undefined,
        side:target.side || undefined,
        stationS:target.stationS
      });
      this.editor.interferenceFeedbackManager.requestRefresh();
      this.emit(`已安装：${definition.label || definition.model || '配件'}`);
      this.cancel();
      return mesh;
    } catch (error) {
      this.emit(error?.message || '配件安装失败');
      return true;
    }
  }

  resolveEvent(event) {
    const targetType = mountTarget(this.definition);
    if(targetType==='FREE')return this.resolveFree(event);
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

  /** 自由添加仍是 hover -> click；截面最低点落在当前工作面，不把构件中心埋在网格里。 */
  resolveFree(event) {
    const plane=this.editor.workPlaneVisualizer?.plane||'XZ',normal=workPlaneNormal(plane);
    // 连接目录自由摆放优先取前方可见表面，空白处才取工作面；这不是接头安装关系。
    const roots=this.definition.category==='连接件'?[...this.editor.meshes.filter(mesh=>mesh.visible!==false&&!mesh.userData?.part?.hidden),...(this.editor.connectionManager?.selectableHelpers?.()||[])]:[];
    const hit=roots.length?this.editor.sceneManager.pickHit(event,roots):null;
    const surface=hit?.object&&hit.surfaceNormal;
    if(surface)normal.copy(hit.surfaceNormal);
    const point=surface?hit.point.clone():this.editor.sceneManager.worldPointOnPlane(event,normal);
    if(!point)return null;
    const rotation=this.definition.partSpec?.type==='PANEL'&&!['sphere','cylinder','cone','torus'].includes(this.definition.dimensions?.panelShape)
      ?(plane==='XZ'?{x:-Math.PI/2,y:0,z:0}:plane==='YZ'?{x:0,y:Math.PI/2,z:0}:{x:0,y:0,z:0}):{x:0,y:0,z:0};
    if(surface){
      const euler=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal));
      Object.assign(rotation,{x:euler.x,y:euler.y,z:euler.z});
    }
    const transform={position:{x:0,y:0,z:0},rotation};
    const ghost=this.createGhostMesh(transform,0x24b36b,.5),box=new THREE.Box3().setFromObject(ghost);
    let support=Infinity;
    if(surface){
      const vertex=new THREE.Vector3();
      ghost.traverse(child=>{const positions=child.isMesh&&child.geometry?.attributes.position;if(positions)for(let index=0;index<positions.count;index++)support=Math.min(support,vertex.fromBufferAttribute(positions,index).applyMatrix4(child.matrixWorld).dot(normal));});
    }else for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])support=Math.min(support,new THREE.Vector3(x,y,z).dot(normal));
    point.addScaledVector(normal,-support);disposeObject(ghost);
    transform.position={x:point.x,y:point.y,z:point.z};
    const collision=this.previewCollision(transform,surface?hit.object.userData.part?.id:null);
    return {free:true,targetPart:surface?(hit.object.userData.part||{displayId:'连接件表面'}):{displayId:'工作面'},transform,valid:!collision.blocked,reason:collision.blocked?`与 ${collision.label} 干涉`:''};
  }

  resolveTarget(mesh,worldPoint,targetType,preferred = {}) {
    const targetPart = mesh?.userData?.part;
    if (!targetPart) return null;
    let transform = null;
    let end = preferred.end || null;
    let side = preferred.side || null;
    let stationS;

    if (['PROFILE_END','PROFILE_BOTTOM'].includes(targetType)) {
      if (targetPart.type !== 'PROFILE') return null;
      if (!end) end = targetType === 'PROFILE_BOTTOM' ? this.bottomEnd(mesh) : this.nearestProfileEnd(mesh,worldPoint);
      transform = this.editor.accessoryMountManager.resolveProfileEnd(this.definition,mesh,{targetType,end});
    } else if (targetType === 'PANEL_SIDE') {
      if (targetPart.type !== 'PANEL') return null;
      if (!side) side = this.panelSide(mesh,worldPoint);
      transform = this.editor.accessoryMountManager.resolvePanelSide(this.definition,mesh,{side});
    } else if(targetType==='SHAFT_AXIS') {
      if(targetPart.type!=='SHAFT')return null;
      const local=worldPoint?mesh.worldToLocal(worldPoint.clone()):new THREE.Vector3();
      stationS=local.z+Number(targetPart.dimensions.length)/2;
      transform=this.editor.accessoryMountManager.resolveShaftAxis(this.definition,mesh,{stationS});
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
      stationS,
      transform,
      valid:!collision.blocked,
      collision,
      reason:collision.blocked ? `该位置与 ${collision.label} 发生干涉` : ''
    };
  }

  validateCompatibility(targetPart) {
    const rule = this.definition?.mountRule || {};
    if(rule.target==='SHAFT_AXIS'&&Math.abs(Number(rule.diameter)-Number(targetPart.dimensions?.diameter))>.01)return {valid:false,reason:'固定夹孔径与光轴直径不匹配'};
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
      ...(this.definition.partSpec||{}),
      type:this.definition.partSpec?.type||'ACCESSORY',
      accessoryType:this.definition.accessoryType || 'ACCESSORY',
      dimensions:{...(this.definition.partSpec?.dimensions||hardwareDimensions(this.definition))},
      position:{...transform.position},
      rotation:{...transform.rotation},
      color:'#ffffff',
      hidden:false,
      locked:true
    };
    const mesh = this.editor.createPartMesh(part);
    const originalMaterials=new Set();
    mesh.traverse(child => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const mapped = materials.map(material => {
        if(material)originalMaterials.add(material);
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
    originalMaterials.forEach(material=>material.dispose());
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
    if(targetType==='SHAFT_AXIS')return type==='SHAFT';
    return false;
  }

  requiredTargetMessage() {
    const target = mountTarget(this.definition);
    if (['PROFILE_END','PROFILE_BOTTOM'].includes(target)) return '请把鼠标移到型材端部附近';
    if (target === 'PANEL_SIDE') return '请把鼠标移到板材需要安装的侧面';
    if(target==='SHAFT_AXIS')return '请把鼠标移到相同孔径的光轴上';
    if(target==='FREE')return '在工作面上选择位置';
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
