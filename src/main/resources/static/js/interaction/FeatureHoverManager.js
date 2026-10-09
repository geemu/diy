import * as THREE from 'three';
import {resolveProfileFeature, featureLabel} from '../model/ProfileFeatureCatalog.js';

/**
 * 型材 Feature 级预高亮管理器。
 *
 * 设计目的：
 * 1. 鼠标经过时先告诉用户“即将选择的是端点 / 侧面 / 槽中心”，再执行点击；
 * 2. 只引用 ProfileFeatureCatalog 的统一特征解析结果，禁止在交互层重新估算槽中心；
 * 3. 高亮对象仅用于显示，不写入 Project JSON，也不能成为制造数据来源。
 */
export default class FeatureHoverManager {
  constructor(editor) {
    this.editor = editor;
    this.sceneManager = editor.sceneManager;
    this.group = new THREE.Group();
    this.group.name = '__feature_hover__';
    this.group.renderOrder = 1200;
    this.sceneManager.scene.add(this.group);
    this.feature = null;
    this.mesh = null;
    this.enabled = true;
    this.onChanged = null;
  }

  /** 是否允许普通 hover。绘制、测量、框选等独占交互状态下由 Editor 统一关闭。 */
  setEnabled(enabled) {
    this.enabled = enabled !== false;
    if (!this.enabled) this.clear();
  }

  /**
   * 根据当前鼠标命中的真实表面解析 Feature，并绘制轻量高亮。
   * hit.point 是 Raycaster 命中的世界坐标，因此不会使用屏幕近似点猜测特征。
   */
  update(event,hit) {
    if (!this.enabled) return this.clear();
    if(hit===undefined)hit=this.editor.pickInteractionHit(event);
    const mesh = hit?.object;
    const part = mesh?.userData?.part;
    if (!mesh || part?.type !== 'PROFILE' || !hit?.point) return this.clear();

    const feature = resolveProfileFeature(mesh, hit.point, {
      endToleranceMm:Math.max(10, Math.min(28, Number(part.dimensions?.length || 0) * 0.035)),
      slotToleranceMm:5
    });
    if (!feature) return this.clear();

    const signature = `${feature.partId}|${feature.type}|${feature.end || ''}|${feature.face || ''}|${feature.slotId || ''}`;
    const previousSignature = this.feature?._signature;
    feature._signature = signature;
    this.mesh = mesh;
    this.feature = feature;
    this.renderFeature(mesh, feature);

    // Feature Hover 与整构件 Box Hover 互斥，避免画面同时出现两套预高亮。
    this.sceneManager.clearHover();
    const partLabel = part.displayId || part.name || '型材';
    const label = `${partLabel} · ${featureLabel(feature)}`;
    this.sceneManager.positionHoverLabel(event, label);
    this.sceneManager.renderer.domElement.style.cursor = 'crosshair';
    if (previousSignature !== signature) this.onChanged?.(this.exportFeature());
    return feature;
  }

  /** 绘制端点、槽中心或面的提示符；所有图元都是 presentation-only。 */
  renderFeature(mesh, feature) {
    this.clearGraphics();
    const color = feature.type === 'PROFILE_END' ? 0x28c76f : feature.type === 'PROFILE_SLOT' ? 0x4d8dff : 0xffb020;
    const point = feature.worldPoint.clone();

    const marker = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),
      new THREE.PointsMaterial({color,size:5,sizeAttenuation:false,depthTest:false,depthWrite:false})
    );
    marker.position.copy(point);
    marker.renderOrder = 1202;
    this.group.add(marker);

    if (feature.type === 'PROFILE_SLOT') {
      // 槽中心沿型材本地 Z 轴延伸，帮助用户识别“槽线”而不是普通面上的一点。
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
      this.addLine(point.clone().addScaledVector(axis, -42), point.clone().addScaledVector(axis, 42), color, 1201);
    } else if (feature.type === 'PROFILE_FACE') {
      // 面特征用短法向标记。法向取型材局部面方向并转换到世界坐标。
      const normal = localFaceNormal(feature.face).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
      this.addLine(point, point.clone().addScaledVector(normal, 32), color, 1201);
    }
  }

  addLine(start, end, color, renderOrder) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({color, depthTest:false, transparent:true, opacity:0.94});
    const line = new THREE.Line(geometry, material);
    line.renderOrder = renderOrder;
    this.group.add(line);
  }

  clearGraphics() {
    while (this.group.children.length) {
      const child = this.group.children[0];
      child.removeFromParent();
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(material => material.dispose?.());
      else child.material?.dispose?.();
    }
  }

  clear() {
    const hadFeature = !!this.feature;
    this.clearGraphics();
    this.feature = null;
    this.mesh = null;
    if (this.sceneManager.hoverLabel) this.sceneManager.hoverLabel.style.display = 'none';
    if (!this.sceneManager.marqueeMode && !this.sceneManager.lassoMode) this.sceneManager.renderer.domElement.style.cursor = '';
    if (hadFeature) this.onChanged?.(null);
    return null;
  }

  exportFeature() {
    if (!this.feature) return null;
    const {worldPoint, _signature, ...rest} = this.feature;
    return {...rest, worldPoint:{x:worldPoint.x, y:worldPoint.y, z:worldPoint.z}};
  }
}

function localFaceNormal(face) {
  if (face === 'RIGHT') return new THREE.Vector3(1, 0, 0);
  if (face === 'LEFT') return new THREE.Vector3(-1, 0, 0);
  if (face === 'FRONT') return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, -1, 0);
}
