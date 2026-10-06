import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import InfiniteGround from './InfiniteGround.js';

export default class SceneManager {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe0f2fe);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clickHandler = null;
    this.pointerMoveHandler = null;
    this.contextMenuHandler = null;
    this.selectionHelpers = [];
    this.hoverHelper = null;
    this.hoveredObject = null;
    this.hoverLabel = null;
    this.cameraTween = null;
    this.measurementGroup = null;
    this.projection = 'perspective';
    this.gridVisible = true;
    this.pointerDownPosition = null;
    this.marqueeHandler = null;
    this.marqueeMode = false;
    this.marqueeStart = null;
    this.marqueeOverlay = null;
    // 自由套索与矩形框选互斥；两者都只负责收集屏幕区域，最终选中规则由 Editor 决定。
    this.lassoMode = false;
    this.lassoHandler = null;
    this.lassoPoints = [];
    this.lassoOverlay = null;
    this.frameHandlers = [];
    this.transformFeedback = null;
    this.snapFeedback = null;
    this.init();
  }

  init() {
    const width = this.container.clientWidth || 1000;
    const height = this.container.clientHeight || 700;

    this.perspectiveCamera = new THREE.PerspectiveCamera(38, width / height, 1, 50000);
    this.perspectiveCamera.position.set(1800, 1450, 1800);

    const frustum = 2200;
    this.orthographicCamera = new THREE.OrthographicCamera(
      -frustum * width / height / 2,
      frustum * width / height / 2,
      frustum / 2,
      -frustum / 2,
      -50000,
      50000
    );
    this.orthographicCamera.position.copy(this.perspectiveCamera.position);
    this.camera = this.perspectiveCamera;

    this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);
    this.hoverLabel = document.createElement('div');
    this.hoverLabel.className = 'scene-hover-label';
    this.hoverLabel.style.display = 'none';
    this.container.appendChild(this.hoverLabel);
    this.transformFeedback = document.createElement('div');
    this.transformFeedback.className = 'transform-feedback';
    this.transformFeedback.style.display = 'none';
    this.container.appendChild(this.transformFeedback);
    this.snapFeedback = document.createElement('div');
    this.snapFeedback.className = 'scene-snap-feedback';
    this.snapFeedback.style.display = 'none';
    this.container.appendChild(this.snapFeedback);

    // 本地生成柔光棚反射，给金属提供明暗环境，不依赖 HDR 图片或网络资源。
    const room=new RoomEnvironment();
    const pmrem=new THREE.PMREMGenerator(this.renderer);
    this.studioEnvironment=pmrem.fromScene(room,.04);
    this.scene.environment=this.studioEnvironment.texture;
    room.dispose();pmrem.dispose();
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x7a8290, .75);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(1400, 2600, 1500);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdde7ff, 0.65);
    fill.position.set(-1200, 900, -800);
    this.scene.add(fill);

    // 解析式无限地面无固定网格边界；保留 grid.visible 接口，只控制线条而非地面。
    this.infiniteGround=new InfiniteGround();
    this.ground=this.infiniteGround.mesh;
    this.grid=new THREE.Group();this.grid.name='__presentation_grid_state__';
    this.ground.onBeforeRender=(_renderer,_scene,camera)=>this.infiniteGround.update(camera,this.grid.visible);
    this.scene.add(this.ground);
    this.scene.add(this.grid);

    this.axes = new THREE.AxesHelper(220);
    this.axes.visible = false;
    this.scene.add(this.axes);

    this.selectionHelper = null;

    const snapGeometry = new THREE.SphereGeometry(7, 20, 20);
    const snapMaterial = new THREE.MeshBasicMaterial({color:0x27b36a, depthTest:false});
    this.snapMarker = new THREE.Mesh(snapGeometry, snapMaterial);
    this.snapMarker.visible = false;
    this.snapMarker.renderOrder = 1001;
    this.scene.add(this.snapMarker);
    this.snapPreviewGroup = new THREE.Group();
    this.snapPreviewGroup.name = '__snap_preview__';
    this.snapPreviewGroup.renderOrder = 1500;
    this.scene.add(this.snapPreviewGroup);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.minDistance = 40;
    this.orbitControls.maxDistance = 40000;

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.compactTranslationGizmo();
    this.transformControls.setSize(0.8);
    this.scene.add(this.transformControls);
    this.transformControls.addEventListener('dragging-changed', event => {
      this.orbitControls.enabled = !event.value && !this.marqueeMode && !this.lassoMode;
    });

    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', event => {
      this.skipContextMenu=false;
      this.cameraTween = null;
      if (this.marqueeMode && event.button === 0 && !this.transformControls.dragging) {
        event.preventDefault();
        event.stopPropagation();
        this.beginMarquee(event);
        return;
      }
      if (this.lassoMode && event.button === 0 && !this.transformControls.dragging) {
        event.preventDefault();
        event.stopPropagation();
        this.beginLasso(event);
        return;
      }
      this.pointerDownPosition = {x:event.clientX, y:event.clientY};
    });
    this.renderer.domElement.addEventListener('pointermove', event => {
      if (this.marqueeStart) this.updateMarquee(event);
      if (this.lassoPoints.length) this.updateLasso(event);
      if (this.pointerMoveHandler && !this.transformControls.dragging) this.pointerMoveHandler(event);
    });
    this.renderer.domElement.addEventListener('pointerup', event => {
      // 右键只用于结束工具或平移/菜单，不能被当作左键提交几何。
      if(event.button!==0){
        const down=this.pointerDownPosition;
        this.pointerDownPosition=null;
        if(event.button===2&&down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<=4&&this.secondaryClickHandler?.(event)===true)this.skipContextMenu=true;
        return;
      }
      if (this.marqueeStart) {
        event.preventDefault();
        event.stopPropagation();
        this.endMarquee(event);
        return;
      }
      if (this.lassoPoints.length) {
        event.preventDefault();
        event.stopPropagation();
        this.endLasso(event);
        return;
      }
      if (!this.pointerDownPosition) return;
      const dx = event.clientX - this.pointerDownPosition.x;
      const dy = event.clientY - this.pointerDownPosition.y;
      this.pointerDownPosition = null;
      if (Math.hypot(dx, dy) <= 4 && this.clickHandler) this.clickHandler(event);
    });
    this.renderer.domElement.addEventListener('contextmenu', event => {
      event.preventDefault();
      if(this.skipContextMenu){this.skipContextMenu=false;return;}
      if (this.contextMenuHandler) this.contextMenuHandler(event);
    });

    this.resetInitialView();
    this.animate();
  }

  /** 初始化从上前边看向搭建区；三维复位和其他命名视角仍保持原有语义。 */
  resetInitialView() {
    // 空白工作台围绕世界原点观察，使四象限轴交点位于实际画布中心，而非偏向底部。
    this.setView(new THREE.Vector3(0,1,1),new THREE.Vector3(0,0,0),3000,{immediate:true});
  }

  /** 仅裁掉负轴显示件及拾取件；正轴柄仍使用原 TransformControls 双向拖动事务。 */
  compactTranslationGizmo() {
    const gizmo=this.transformControls.children.find(child=>child.gizmo?.translate&&child.picker?.translate);
    if(!gizmo)throw new Error('本地移动工具缺少平移手柄');
    for(const group of [gizmo.gizmo.translate,gizmo.picker.translate]) {
      for(const handle of [...group.children]) {
        if(!['X','Y','Z'].includes(handle.name))continue;
        // WebJar 将手柄局部偏移烘焙进几何，不能用 object.position 判断正负。
        handle.geometry.computeBoundingBox();
        const center=handle.geometry.boundingBox.getCenter(new THREE.Vector3());
        if(center[handle.name.toLowerCase()]<0) {
          group.remove(handle);handle.geometry.dispose();
        }
      }
    }
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.perspectiveCamera.aspect = width / height;
    this.perspectiveCamera.updateProjectionMatrix();
    // 正交缩放只由 camera.zoom 应用一次，调整窗口不能再重复除以 zoom。
    const vertical = 2200;
    this.orthographicCamera.left = -vertical * width / height / 2;
    this.orthographicCamera.right = vertical * width / height / 2;
    this.orthographicCamera.top = vertical / 2;
    this.orthographicCamera.bottom = -vertical / 2;
    this.orthographicCamera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setMarqueeMode(enabled) {
    this.marqueeMode = enabled === true;
    if (!this.transformControls.dragging) this.orbitControls.enabled = !this.marqueeMode;
    this.renderer.domElement.style.cursor = this.marqueeMode || this.lassoMode ? 'crosshair' : '';
    if (!this.marqueeMode) this.cancelMarquee();
  }

  /**
   * 开关自由套索。套索和矩形框选必须互斥，避免两个 pointer 状态机同时接管画布。
   */
  setLassoMode(enabled) {
    this.lassoMode = enabled === true;
    if (this.lassoMode && this.marqueeMode) this.setMarqueeMode(false);
    if (!this.transformControls.dragging) this.orbitControls.enabled = !this.lassoMode && !this.marqueeMode;
    this.renderer.domElement.style.cursor = this.lassoMode || this.marqueeMode ? 'crosshair' : '';
    if (!this.lassoMode) this.cancelLasso();
  }

  beginLasso(event) {
    this.pointerDownPosition = null;
    this.lassoPoints = [{x:event.clientX,y:event.clientY}];
    if (!this.lassoOverlay) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.classList.add('scene-lasso');
      svg.style.display = 'none';
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.classList.add('scene-lasso-path');
      svg.appendChild(path);
      document.body.appendChild(svg);
      this.lassoOverlay = svg;
    }
    this.lassoOverlay.style.display = 'block';
    this.updateLasso(event);
  }

  updateLasso(event) {
    if (!this.lassoPoints.length || !this.lassoOverlay) return;
    const last = this.lassoPoints[this.lassoPoints.length - 1];
    if (Math.hypot(event.clientX-last.x,event.clientY-last.y) >= 4) this.lassoPoints.push({x:event.clientX,y:event.clientY});
    const path = this.lassoOverlay.querySelector('path');
    if (!path) return;
    const points = this.lassoPoints;
    const d = points.map((point,index) => `${index===0?'M':'L'} ${point.x} ${point.y}`).join(' ') + (points.length > 2 ? ' Z' : '');
    path.setAttribute('d',d);
  }

  endLasso(event) {
    if (!this.lassoPoints.length) return;
    const points = [...this.lassoPoints,{x:event.clientX,y:event.clientY}];
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    this.cancelLasso();
    if (points.length < 4) {
      this.clickHandler?.(event);
      return;
    }
    this.lassoHandler?.({points,additive});
  }

  cancelLasso() {
    this.lassoPoints = [];
    if (this.lassoOverlay) this.lassoOverlay.style.display = 'none';
  }

  beginMarquee(event) {
    this.marqueeStart = {x:event.clientX,y:event.clientY,additive:event.ctrlKey || event.metaKey || event.shiftKey};
    this.pointerDownPosition = null;
    if (!this.marqueeOverlay) {
      const overlay = document.createElement('div');
      overlay.className = 'scene-marquee';
      overlay.style.display = 'none';
      document.body.appendChild(overlay);
      this.marqueeOverlay = overlay;
    }
    this.updateMarquee(event);
  }

  updateMarquee(event) {
    if (!this.marqueeStart || !this.marqueeOverlay) return;
    const left = Math.min(this.marqueeStart.x,event.clientX);
    const top = Math.min(this.marqueeStart.y,event.clientY);
    const width = Math.abs(event.clientX-this.marqueeStart.x);
    const height = Math.abs(event.clientY-this.marqueeStart.y);
    Object.assign(this.marqueeOverlay.style,{display:'block',left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});
    this.marqueeOverlay.classList.toggle('crossing',event.clientX < this.marqueeStart.x);
  }

  endMarquee(event) {
    if (!this.marqueeStart) return;
    const start = this.marqueeStart;
    const end = {x:event.clientX,y:event.clientY};
    this.cancelMarquee();
    if (Math.hypot(end.x-start.x,end.y-start.y) < 6) {
      if (this.clickHandler) this.clickHandler(event);
      return;
    }
    if (this.marqueeHandler) this.marqueeHandler({start,end,additive:start.additive});
  }

  cancelMarquee() {
    this.marqueeStart = null;
    if (this.marqueeOverlay) this.marqueeOverlay.style.display = 'none';
  }

  pickInScreenRect(start, end, roots = []) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const selection = {
      left:Math.min(start.x,end.x),right:Math.max(start.x,end.x),
      top:Math.min(start.y,end.y),bottom:Math.max(start.y,end.y)
    };
    const crossing = end.x < start.x;
    const result = [];
    for (const root of roots) {
      if (!root || root.visible === false) continue;
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) continue;
      const corners = [
        [box.min.x,box.min.y,box.min.z],[box.max.x,box.min.y,box.min.z],[box.min.x,box.max.y,box.min.z],[box.max.x,box.max.y,box.min.z],
        [box.min.x,box.min.y,box.max.z],[box.max.x,box.min.y,box.max.z],[box.min.x,box.max.y,box.max.z],[box.max.x,box.max.y,box.max.z]
      ];
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,visiblePoint=false;
      for (const value of corners) {
        const p = new THREE.Vector3(...value).project(this.camera);
        if (p.z < -1.2 || p.z > 1.2) continue;
        const sx = rect.left + (p.x + 1) * 0.5 * rect.width;
        const sy = rect.top + (1 - p.y) * 0.5 * rect.height;
        left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);visiblePoint=true;
      }
      if (!visiblePoint) continue;
      const overlap = !(right < selection.left || left > selection.right || bottom < selection.top || top > selection.bottom);
      const contained = left >= selection.left && right <= selection.right && top >= selection.top && bottom <= selection.bottom;
      if ((crossing && overlap) || (!crossing && contained)) result.push(root);
    }
    return result;
  }

  /**
   * 自由套索命中测试。
   * 这里使用构件世界包围盒的中心与 8 个角点投影到屏幕空间；只要有代表点落入套索即视为命中。
   * 该算法用于交互选择，不参与制造几何或碰撞判断。
   */
  pickInScreenPolygon(points = [], roots = []) {
    if (!Array.isArray(points) || points.length < 3) return [];
    const rect = this.renderer.domElement.getBoundingClientRect();
    const result = [];
    for (const root of roots) {
      if (!root || root.visible === false) continue;
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) continue;
      const center = box.getCenter(new THREE.Vector3());
      const samples = [center,
        new THREE.Vector3(box.min.x,box.min.y,box.min.z),new THREE.Vector3(box.max.x,box.min.y,box.min.z),
        new THREE.Vector3(box.min.x,box.max.y,box.min.z),new THREE.Vector3(box.max.x,box.max.y,box.min.z),
        new THREE.Vector3(box.min.x,box.min.y,box.max.z),new THREE.Vector3(box.max.x,box.min.y,box.max.z),
        new THREE.Vector3(box.min.x,box.max.y,box.max.z),new THREE.Vector3(box.max.x,box.max.y,box.max.z)];
      const hit = samples.some(sample => {
        const projected = sample.clone().project(this.camera);
        if (projected.z < -1.2 || projected.z > 1.2) return false;
        const screen = {x:rect.left+(projected.x+1)*0.5*rect.width,y:rect.top+(1-projected.y)*0.5*rect.height};
        return pointInPolygon(screen,points);
      });
      if (hit) result.push(root);
    }
    return result;
  }

  worldPointOnPlane(event, normal, pointOnPlane = new THREE.Vector3()) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const n = (normal || new THREE.Vector3(0,1,0)).clone().normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, pointOnPlane || new THREE.Vector3());
    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, point) ? point : null;
  }

  worldPointOnGround(event, groundY = 0) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -Number(groundY || 0));
    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, point) ? point : null;
  }

  raycast(event, roots) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(roots, true);
  }

  resolveRoot(object) {
    if (!object) return null;
    if (object.userData.profileRoot) return object.userData.profileRoot;
    let current = object;
    while (current && !current.userData.part) current = current.parent;
    return current || null;
  }

  pick(event, roots) {
    const hits = this.raycast(event, roots);
    if (!hits.length) return null;
    return this.resolveRoot(hits[0].object);
  }

  /** 返回同一射线下按距离排序且去重后的业务根对象，用于 Alt 穿透循环选择。 */
  pickRoots(event, roots) {
    const result = [];
    const seen = new Set();
    for (const hit of this.raycast(event, roots)) {
      const root = this.resolveRoot(hit.object);
      if (!root || seen.has(root.uuid)) continue;
      seen.add(root.uuid);
      result.push(root);
    }
    return result;
  }

  pickHit(event, roots) {
    const hits = this.raycast(event, roots);
    if (!hits.length) {
      const ground = this.worldPointOnGround(event,0);
      return ground ? {object:null, point:ground, face:null} : null;
    }
    return {
      object:this.resolveRoot(hits[0].object),
      point:hits[0].point.clone(),
      face:hits[0].face || null
    };
  }

  setHover(object,event=null,label='') {
    if (this.hoveredObject === object) {
      if (object && event) this.positionHoverLabel(event,label);
      return;
    }
    this.clearHover();
    if (!object) return;
    this.hoveredObject = object;
    const helper = new THREE.BoxHelper(object,0x7aa7ff);
    helper.material.depthTest=false;helper.material.transparent=true;helper.material.opacity=.72;helper.renderOrder=998;
    this.hoverHelper=helper;this.scene.add(helper);
    this.renderer.domElement.style.cursor='pointer';
    if(event)this.positionHoverLabel(event,label);
  }

  positionHoverLabel(event,label='') {
    if(!this.hoverLabel||!event)return;
    const rect=this.container.getBoundingClientRect();
    this.hoverLabel.textContent=label||this.hoveredObject?.userData?.part?.displayId||'构件';
    this.hoverLabel.style.left=`${event.clientX-rect.left}px`;
    this.hoverLabel.style.top=`${event.clientY-rect.top}px`;
    this.hoverLabel.style.display='block';
  }

  clearHover() {
    if(this.hoverHelper){this.scene.remove(this.hoverHelper);this.hoverHelper.geometry?.dispose?.();this.hoverHelper.material?.dispose?.();}
    this.hoverHelper=null;this.hoveredObject=null;
    if(this.hoverLabel)this.hoverLabel.style.display='none';
    if(!this.marqueeMode && !this.lassoMode)this.renderer.domElement.style.cursor='';
  }

  clearSelectionHelpers() {
    for (const helper of this.selectionHelpers) {
      this.scene.remove(helper);
      helper.geometry?.dispose?.();
      helper.material?.dispose?.();
    }
    this.selectionHelpers = [];
    this.selectionHelper = null;
  }

  setSelection(object) {
    this.setSelections(object ? [object] : [], object || null);
  }

  setSelections(objects = [], primary = null) {
    this.clearSelectionHelpers();
    const unique = [...new Set((objects || []).filter(Boolean))];
    for (const object of unique) {
      const isPrimary = object === primary;
      const helper = new THREE.BoxHelper(object, isPrimary ? 0x2f78ff : 0x5ca8ff);
      helper.material.depthTest = false;
      helper.material.transparent = true;
      helper.material.opacity = isPrimary ? 0.95 : 0.55;
      helper.renderOrder = 1000;
      this.selectionHelpers.push(helper);
      this.scene.add(helper);
    }
    this.selectionHelper = this.selectionHelpers[0] || null;
  }

  refreshSelection() {
    for (const helper of this.selectionHelpers) helper?.update?.();
  }

  clearMeasurement() {
    if (!this.measurementGroup) return;
    this.scene.remove(this.measurementGroup);
    this.measurementGroup.traverse(object => {
      object.geometry?.dispose?.();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material.dispose?.();
      }
    });
    this.measurementGroup = null;
  }

  showMeasurement(start, end) {
    this.clearMeasurement();
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({color:0xff8b2c,depthTest:false});
    const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(),end.clone()]);
    const line = new THREE.Line(geometry,material);
    line.renderOrder = 1002;
    group.add(line);
    const markerGeometry = new THREE.SphereGeometry(5,14,14);
    const markerMaterial = new THREE.MeshBasicMaterial({color:0xff8b2c,depthTest:false});
    for (const point of [start,end]) {
      const marker = new THREE.Mesh(markerGeometry.clone(),markerMaterial.clone());
      marker.position.copy(point);
      marker.renderOrder = 1003;
      group.add(marker);
    }
    this.measurementGroup = group;
    this.scene.add(group);
  }

  hideSnapPoint() {
    clearTimeout(this.snapTimer);
    this.snapMarker.visible = false;
  }

  showSnapPoint(point) {
    this.snapMarker.position.copy(point);
    this.snapMarker.visible = true;
    clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => {
      this.snapMarker.visible = false;
    }, 700);
  }


  clearSnapPreview() {
    if (!this.snapPreviewGroup) return;
    while (this.snapPreviewGroup.children.length) {
      const child = this.snapPreviewGroup.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  showSnapPreview(sourcePoint,targetPoint,snap = {}) {
    this.clearSnapPreview();
    if (!sourcePoint || !targetPoint) return;
    const material = new THREE.LineBasicMaterial({color:0x22b36d,transparent:true,opacity:0.95,depthTest:false});
    const geometry = new THREE.BufferGeometry().setFromPoints([sourcePoint,targetPoint]);
    const line = new THREE.Line(geometry,material);
    line.renderOrder = 1501;
    this.snapPreviewGroup.add(line);

    for (const point of [sourcePoint,targetPoint]) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(6,14,14),new THREE.MeshBasicMaterial({color:0x22b36d,transparent:true,opacity:0.92,depthTest:false}));
      marker.position.copy(point);
      marker.renderOrder = 1502;
      this.snapPreviewGroup.add(marker);
    }
    const targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(10,1.5,8,32),
      new THREE.MeshBasicMaterial({color:0x8cffbd,transparent:true,opacity:0.92,depthTest:false})
    );
    targetRing.position.copy(targetPoint);
    targetRing.lookAt(this.camera.position);
    targetRing.renderOrder = 1503;
    targetRing.userData.snap = snap;
    this.snapPreviewGroup.add(targetRing);
  }

  setGridVisible(visible) {
    this.gridVisible = visible !== false;
    this.grid.visible = this.gridVisible;
  }

  setProjection(type) {
    const targetType = type === 'orthographic' ? 'orthographic' : 'perspective';
    if (targetType === this.projection) return;
    const oldCamera = this.camera;
    const newCamera = targetType === 'orthographic' ? this.orthographicCamera : this.perspectiveCamera;
    newCamera.position.copy(oldCamera.position);
    newCamera.quaternion.copy(oldCamera.quaternion);
    if (targetType === 'orthographic') {
      const distance = Math.max(100, oldCamera.position.distanceTo(this.orbitControls.target));
      newCamera.zoom = Math.max(0.12, 1600 / distance);
      newCamera.updateProjectionMatrix();
    }
    this.camera = newCamera;
    this.projection = targetType;
    const target = this.orbitControls.target.clone();
    this.orbitControls.dispose();
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.target.copy(target);
    this.transformControls.camera = this.camera;
    this.resize();
  }

  setView(direction, center = new THREE.Vector3(), distance = 2500, options={}) {
    const c=center.clone();const d=Math.max(200,distance);const targetPosition=new THREE.Vector3();
    if(direction?.isVector3){
      const vector=direction.clone().normalize();
      if(vector.lengthSq()<1e-8)throw new Error('视角方向不能为空');
      targetPosition.copy(c).addScaledVector(vector,d);
      // 纯上下视角增加微小 Z 分量，保持 OrbitControls 的 Y-up 方位稳定。
      if(Math.abs(vector.y)>.9999)targetPosition.z+=.001;
    }
    else if(direction==='front')targetPosition.set(c.x,c.y,c.z+d);
    else if(direction==='back')targetPosition.set(c.x,c.y,c.z-d);
    else if(direction==='left')targetPosition.set(c.x-d,c.y,c.z);
    else if(direction==='right')targetPosition.set(c.x+d,c.y,c.z);
    else if(direction==='top')targetPosition.set(c.x,c.y+d,c.z+.001);
    else if(direction==='bottom')targetPosition.set(c.x,c.y-d,c.z+.001);
    else targetPosition.set(c.x+d*.78,c.y+d*.62,c.z+d*.78);
    if(options.immediate===true){this.camera.position.copy(targetPosition);this.orbitControls.target.copy(c);this.camera.lookAt(c);this.orbitControls.update();this.cameraTween=null;return;}
    this.cameraTween={started:performance.now(),duration:Number(options.durationMs||260),fromPosition:this.camera.position.clone(),toPosition:targetPosition,fromTarget:this.orbitControls.target.clone(),toTarget:c};
  }

  updateCameraTween(now=performance.now()){
    const tween=this.cameraTween;if(!tween)return;
    const raw=Math.min(1,Math.max(0,(now-tween.started)/Math.max(1,tween.duration)));
    const t=1-Math.pow(1-raw,3);
    this.camera.position.lerpVectors(tween.fromPosition,tween.toPosition,t);
    this.orbitControls.target.lerpVectors(tween.fromTarget,tween.toTarget,t);
    this.camera.lookAt(this.orbitControls.target);
    if(raw>=1)this.cameraTween=null;
  }

  /** TransformControls 坐标空间。local 跟随构件自身方向，world 使用工程全局 XYZ。 */
  setTransformSpace(space = 'world') {
    const value = space === 'local' ? 'local' : 'world';
    this.transformControls.setSpace(value);
    return value;
  }

  setTransformSize(size = 0.88) {
    const value = Math.max(0.55, Math.min(1.4, Number(size) || 0.88));
    this.transformControls.setSize(value);
    return value;
  }

  /** 平移步长。0 表示自由移动；TransformControls 自身负责拖动时量化。 */
  setTranslationSnap(stepMm = 0) {
    const step = Math.max(0, Number(stepMm) || 0);
    this.transformControls.setTranslationSnap(step > 0 ? step : null);
    return step;
  }

  /** 旋转步长。0 表示自由旋转。 */
  setRotationSnap(stepDeg = 0) {
    const step = Math.max(0, Number(stepDeg) || 0);
    this.transformControls.setRotationSnap(step > 0 ? THREE.MathUtils.degToRad(step) : null);
    return step;
  }

  showTransformFeedback(payload = {}) {
    if (!this.transformFeedback) return;
    const axis = String(payload.axis || '').replace('XYZ','自由');
    const mode = payload.mode === 'rotate' ? '旋转' : '移动';
    const values = payload.mode === 'rotate'
      ? [`X ${roundDeg(payload.rotation?.x)}°`,`Y ${roundDeg(payload.rotation?.y)}°`,`Z ${roundDeg(payload.rotation?.z)}°`]
      : [`X ${roundMm(payload.delta?.x)} mm`,`Y ${roundMm(payload.delta?.y)} mm`,`Z ${roundMm(payload.delta?.z)} mm`];
    this.transformFeedback.innerHTML = `<strong>${mode}${axis ? ` · ${axis}` : ''}</strong><span>${values.join('　')}</span>${payload.scopeLabel ? `<em>${payload.scopeLabel}</em>` : ''}`;
    this.transformFeedback.style.display = 'flex';
  }

  hideTransformFeedback() {
    if (this.transformFeedback) this.transformFeedback.style.display = 'none';
  }

  showSnapFeedback(payload = {}) {
    if (!this.snapFeedback) return;
    const status = payload.status === 'blocked' ? 'blocked' : payload.status === 'near' ? 'near' : payload.status === 'neutral' ? 'neutral' : 'valid';
    this.snapFeedback.className = `scene-snap-feedback ${status}`;
    const details = Array.isArray(payload.details) ? payload.details.filter(Boolean) : [];
    this.snapFeedback.innerHTML = `<strong>${payload.label || '几何吸附'}</strong>${details.length ? `<span>${details.join(' · ')}</span>` : ''}`;
    this.snapFeedback.style.display = 'flex';
  }

  hideSnapFeedback() {
    if (this.snapFeedback) this.snapFeedback.style.display = 'none';
  }

  capturePng(filename = 'design.png') {
    this.renderer.render(this.scene, this.camera);
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.renderer.domElement.toDataURL('image/png');
    link.click();
  }

  addFrameHandler(handler) {
    if (typeof handler === 'function' && !this.frameHandlers.includes(handler)) this.frameHandlers.push(handler);
    return () => { this.frameHandlers = this.frameHandlers.filter(item => item !== handler); };
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.updateCameraTween();
    this.orbitControls.update();
    this.refreshSelection();
    this.hoverHelper?.update?.();
    this.renderer.render(this.scene, this.camera);
    for (const handler of this.frameHandlers) handler();
  }
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    const intersects=((a.y>point.y)!==(b.y>point.y)) && point.x < (b.x-a.x)*(point.y-a.y)/((b.y-a.y)||1e-9)+a.x;
    if (intersects) inside=!inside;
  }
  return inside;
}

function roundMm(value){const number=Number(value||0);return Math.abs(number)<0.0005?'0':Number(number.toFixed(1)).toString();}
function roundDeg(value){const number=THREE.MathUtils.radToDeg(Number(value||0));return Math.abs(number)<0.005?'0':Number(number.toFixed(1)).toString();}
