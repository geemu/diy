import * as THREE from 'three';
import {getLocalFrameAtStation, normalizeProfilePath, isLinearProfile} from '../model/ProfilePath.js';

/**
 * CAD scene annotations.
 * 3D lines remain in model space while DOM labels stay sharp at any zoom level.
 * v0.13 adds baseline chains, machining offset drivers and hierarchy-aware dimension label lanes.
 */
export default class SceneAnnotationManager {
  constructor(editor, sceneManager) {
    this.editor = editor;
    this.sceneManager = sceneManager;
    this.options = {
      showOverall:true,
      showPartDimensions:true,
      showMachiningLabels:true,
      showMachiningDimensions:true,
      showUserDimensions:true
    };
    this.group = new THREE.Group();
    this.group.name = '__scene_annotations__';
    this.sceneManager.scene.add(this.group);
    this.layer = document.createElement('div');
    this.layer.className = 'scene-annotation-layer';
    this.sceneManager.container.appendChild(this.layer);
    this.labels = [];
    this.refreshQueued = false;
    this.dragState = null;
    this.sceneManager.addFrameHandler(() => this.render());
  }

  setOptions(options = {}) {
    this.options = {...this.options,...options};
    this.requestRefresh();
    return {...this.options};
  }

  requestRefresh() {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    requestAnimationFrame(() => {
      this.refreshQueued = false;
      this.refresh();
    });
  }

  refresh() {
    this.clearGraphics();
    if (this.options.showOverall) this.addOverallDimensions();
    if (this.options.showPartDimensions) this.addProfileDimensions();
    if (this.options.showMachiningDimensions) this.addMachiningDimensions();
    if (this.options.showMachiningLabels) this.addMachiningLabels();
    if (this.options.showUserDimensions) this.addUserDimensions();
  }

  clearGraphics() {
    while (this.group.children.length) {
      const child = this.group.children[0];
      this.group.remove(child);
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(material => material.dispose?.());
      else child.material?.dispose?.();
    }
    this.layer.replaceChildren();
    this.labels = [];
  }

  addOverallDimensions() {
    const meshes = this.editor.meshes.filter(mesh => mesh.visible !== false && mesh.userData.part?.type === 'PROFILE');
    if (!meshes.length) return;
    const box = new THREE.Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    box.getSize(size);
    const pad = Math.max(35,Math.min(125,Math.max(size.x,size.y,size.z) * 0.04));

    this.addDimension(
      new THREE.Vector3(box.min.x,box.min.y,box.max.z),
      new THREE.Vector3(box.max.x,box.min.y,box.max.z),
      new THREE.Vector3(0,-pad,pad * 0.18),
      `W: ${round0(size.x)}`,
      'overall'
    );
    this.addDimension(
      new THREE.Vector3(box.max.x,box.min.y,box.min.z),
      new THREE.Vector3(box.max.x,box.min.y,box.max.z),
      new THREE.Vector3(pad,-pad,0),
      `D: ${round0(size.z)}`,
      'overall'
    );
    this.addDimension(
      new THREE.Vector3(box.min.x,box.min.y,box.max.z),
      new THREE.Vector3(box.min.x,box.max.y,box.max.z),
      new THREE.Vector3(-pad,0,pad * 0.18),
      `H: ${round0(size.y)}`,
      'overall'
    );
  }

  addProfileDimensions() {
    for (const mesh of this.editor.meshes) {
      if (mesh.visible === false || mesh.userData.part?.type !== 'PROFILE') continue;
      const part = mesh.userData.part;
      normalizeProfilePath(part);
      if (!isLinearProfile(part)) continue;
      const length = Number(part.dimensions?.length || 0);
      if (!(length > 0)) continue;
      const a = localFrameWorldPoint(mesh,part,0);
      const b = localFrameWorldPoint(mesh,part,length);
      const [sectionWidth] = part.dimensions?.sectionSize || [30,30];
      const offset = localVectorToWorld(mesh,new THREE.Vector3(Number(sectionWidth)/2 + 12,0,0));
      this.addDimension(a,b,offset,formatNumber(length),'part');
    }
  }

  addMachiningDimensions() {
    for (const mesh of this.editor.meshes) {
      if (mesh.visible === false || mesh.userData.part?.type !== 'PROFILE') continue;
      const part = mesh.userData.part;
      normalizeProfilePath(part);
      const length = Number(part.dimensions?.length || 0);
      if (!(length > 0)) continue;
      const stations = [...new Set((part.machiningItems || [])
        .filter(item => item.type !== 'END_TAP')
        .map(item => Number(item.stationS ?? item.distanceFromStart ?? 0))
        .filter(value => Number.isFinite(value) && value > 0.01 && value < length - 0.01)
        .map(value => Number(value.toFixed(3))))]
        .sort((a,b) => a-b)
        .slice(0,16);
      if (!stations.length) continue;
      const [sectionWidth] = part.dimensions?.sectionSize || [30,30];
      const baseOffset = Number(sectionWidth)/2 + 27;
      const start = localFrameWorldPoint(mesh,part,0);
      for (let index=0; index<stations.length; index++) {
        const station = stations[index];
        const end = localFrameWorldPoint(mesh,part,station);
        const lane = baseOffset + (index % 3) * 10;
        const offset = localVectorToWorld(mesh,new THREE.Vector3(-lane,0,0));
        this.addDimension(start,end,offset,formatNumber(station),'machining-dim');
      }
    }
  }

  addMachiningLabels() {
    for (const mesh of this.editor.meshes) {
      if (mesh.visible === false || mesh.userData.part?.type !== 'PROFILE') continue;
      const part = mesh.userData.part;
      normalizeProfilePath(part);
      for (const item of part.machiningItems || []) {
        const point = machiningWorldPoint(mesh,part,item);
        if (!point) continue;
        const text = machiningLabel(item);
        const offset = item.type === 'END_TAP' ? {x:0,y:-26} : {x:0,y:-18};
        this.addLabel(`machining:${part.id}:${item.id}`,text,point,'machining',offset);
      }
    }
  }

  addUserDimensions() {
    for (const dimension of this.editor.userDimensions || []) {
      if (dimension.binding?.type === 'PROFILE_ARC_ANGLE') {
        this.addArcAngleUserDimension(dimension);
        continue;
      }
      if (dimension.type === 'ANGULAR' || dimension.binding?.type === 'PROFILE_ANGLE') {
        this.addAngularUserDimension(dimension);
        continue;
      }
      let start = this.resolveDimensionAnchor(dimension.anchorStart) || point3(dimension.start);
      let end = this.resolveDimensionAnchor(dimension.anchorEnd) || point3(dimension.end);
      if (!start || !end) continue;

      if (['PART_AXIS_DISTANCE','PART_AXIS_COORDINATE','PART_CLEARANCE'].includes(dimension.binding?.type)) {
        const axis = String(dimension.binding.axis || 'X').toLowerCase();
        const projectedEnd = start.clone();
        projectedEnd[axis] = end[axis];
        end = projectedEnd;
      }

      dimension.start = toPlain(start);
      dimension.end = toPlain(end);
      const offset3d = point3(dimension.offsetWorld) || new THREE.Vector3();
      const autoOffset = this.getDrivenDimensionAutoOffset(dimension);
      if (autoOffset) offset3d.add(autoOffset);
      const startDim = start.clone().add(offset3d);
      const endDim = end.clone().add(offset3d);
      const drivenValue = Number(this.editor.getUserDimensionValue?.(dimension));
      const value = Number.isFinite(drivenValue) ? drivenValue : start.distanceTo(end);
      dimension.measuredValue = Number(value.toFixed(3));
      const label = dimension.text || formatDrivenValue(dimension,value);
      this.addDimension(start,end,offset3d,label,'user',dimension);
      dimension._worldMidpoint = toPlain(startDim.clone().lerp(endDim,0.5));
    }
  }

  getDrivenDimensionAutoOffset(dimension) {
    if (!dimension?.binding) return null;
    if (dimension.type === 'RADIAL' || dimension.binding.type === 'PROFILE_RADIUS') return null;
    if (dimension.binding.type === 'MACHINING_STATION') {
      const mesh = this.editor.getMeshByPartId(dimension.binding.partId);
      const part = mesh?.userData?.part;
      if (!mesh || part?.type !== 'PROFILE') return null;
      const [sectionWidth] = part.dimensions?.sectionSize || [30,30];
      const order = Math.max(0,Number(dimension.chain?.order || 0));
      const base = Number(sectionWidth)/2 + (dimension.chain?.locked ? 36 : 29);
      const lane = base + order * 11;
      return localVectorToWorld(mesh,new THREE.Vector3(-lane,0,0));
    }
    if (dimension.layout?.auto === false) return null;
    const axis = String(dimension.layout?.axis || dimension.chain?.axis || dimension.binding?.axis || '').toUpperCase();
    if (!['X','Y','Z'].includes(axis)) return null;
    const lane = Math.max(0,Number(dimension.layout?.lane ?? dimension.chain?.order ?? 0));
    const side = Number(dimension.layout?.side || -1) >= 0 ? 1 : -1;
    const distance = 32 + lane * 18;
    if (axis === 'X') return new THREE.Vector3(0,side * distance,8 + lane * 2);
    if (axis === 'Y') return new THREE.Vector3(side * distance,0,8 + lane * 2);
    return new THREE.Vector3(side * distance,side * distance * 0.18,0);
  }

  addAngularUserDimension(dimension) {
    const binding = dimension.binding;
    if (!binding?.sourcePartId || !binding?.targetPartId) return;
    const sourceMesh = this.editor.getMeshByPartId(binding.sourcePartId);
    const targetMesh = this.editor.getMeshByPartId(binding.targetPartId);
    if (!sourceMesh || !targetMesh) return;
    const center = sourceMesh.getWorldPosition(new THREE.Vector3());
    const sourceDirection = new THREE.Vector3(0,0,1).applyQuaternion(sourceMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const targetDirection = new THREE.Vector3(0,0,1).applyQuaternion(targetMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const axis = binding.axis === 'X' ? new THREE.Vector3(1,0,0) : binding.axis === 'Z' ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0);
    const sourceProjected = projectDirectionOnPlane(sourceDirection,axis);
    const targetProjected = projectDirectionOnPlane(targetDirection,axis);
    if (sourceProjected.lengthSq() < 1e-8 || targetProjected.lengthSq() < 1e-8) return;
    const signed = Math.atan2(sourceProjected.clone().cross(targetProjected).dot(axis),THREE.MathUtils.clamp(sourceProjected.dot(targetProjected),-1,1));
    const radius = 58;
    const p0 = center.clone().addScaledVector(sourceProjected,radius);
    const segments = [[center,p0]];
    const steps = Math.max(8,Math.ceil(Math.abs(signed) / (Math.PI / 24)));
    let previous = p0;
    for (let index=1; index<=steps; index++) {
      const quaternion = new THREE.Quaternion().setFromAxisAngle(axis,signed * index / steps);
      const currentDirection = sourceProjected.clone().applyQuaternion(quaternion);
      const current = center.clone().addScaledVector(currentDirection,radius);
      segments.push([previous,current]);
      previous = current;
    }
    segments.push([center,previous]);
    this.addSegments(segments,0xe0aa16,0.95);
    const middleDirection = sourceProjected.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis,signed/2));
    const labelPoint = center.clone().addScaledVector(middleDirection,radius + 13);
    const value = Number(this.editor.getUserDimensionValue?.(dimension));
    dimension.measuredValue = Number.isFinite(value) ? Number(value.toFixed(3)) : Number(THREE.MathUtils.radToDeg(Math.abs(signed)).toFixed(3));
    this.addLabel(`dimension:${dimension.id}`,dimension.text || `${formatNumber(dimension.measuredValue)}°`,labelPoint,'user angular',{x:0,y:-2},dimension);
    dimension._worldMidpoint = toPlain(labelPoint);
  }

  addArcAngleUserDimension(dimension) {
    const partId = dimension.binding?.partId;
    const mesh = this.editor.getMeshByPartId(partId);
    const part = mesh?.userData?.part;
    if (!mesh || part?.profilePath?.type !== 'ARC') return;
    const center = this.editor.resolveDimensionAnchorWorld({type:'PROFILE_ARC_CENTER',partId});
    const start = this.editor.resolveDimensionAnchorWorld({type:'PROFILE_END',partId,end:'START'});
    const end = this.editor.resolveDimensionAnchorWorld({type:'PROFILE_END',partId,end:'END'});
    if (!center || !start || !end) return;
    const startDirection = start.clone().sub(center).normalize();
    const endDirection = end.clone().sub(center).normalize();
    const localNormal = part.profilePath.plane === 'YZ' ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const normal = localNormal.applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
    let signed = Math.atan2(startDirection.clone().cross(endDirection).dot(normal),THREE.MathUtils.clamp(startDirection.dot(endDirection),-1,1));
    const targetAngle = THREE.MathUtils.degToRad(Number(part.profilePath.angleDeg || 0));
    if (Math.abs(Math.abs(signed) - targetAngle) > 1e-3 && targetAngle > Math.PI) signed = signed < 0 ? -(Math.PI * 2 - Math.abs(signed)) : Math.PI * 2 - Math.abs(signed);
    const radius = Math.min(90,Math.max(45,Number(part.profilePath.radius || 0) * 0.18));
    const p0 = center.clone().addScaledVector(startDirection,radius);
    const segments = [[center,p0]];
    const steps = Math.max(10,Math.ceil(Math.abs(signed) / (Math.PI / 30)));
    let previous = p0;
    for (let index=1; index<=steps; index++) {
      const currentDirection = startDirection.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(normal,signed * index / steps));
      const current = center.clone().addScaledVector(currentDirection,radius);
      segments.push([previous,current]);
      previous = current;
    }
    segments.push([center,previous]);
    this.addSegments(segments,0xe0aa16,0.95);
    const middleDirection = startDirection.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(normal,signed/2));
    const labelPoint = center.clone().addScaledVector(middleDirection,radius + 14);
    const value = Number(this.editor.getUserDimensionValue?.(dimension));
    dimension.measuredValue = Number.isFinite(value) ? Number(value.toFixed(3)) : Number(part.profilePath.angleDeg || 0);
    this.addLabel(`dimension:${dimension.id}`,dimension.text || `${formatNumber(dimension.measuredValue)}°`,labelPoint,'user angular',{x:0,y:-2},dimension);
    dimension._worldMidpoint = toPlain(labelPoint);
  }

  resolveDimensionAnchor(anchor) {
    if (!anchor || typeof anchor !== 'object') return null;
    const delegated = this.editor.resolveDimensionAnchorWorld?.(anchor);
    if (delegated) return delegated;
    if (anchor.type === 'WORLD') return point3(anchor.point);
    const mesh = this.editor.getMeshByPartId(anchor.partId);
    if (!mesh) return null;
    if (anchor.type === 'LOCAL_POINT') {
      const local = point3(anchor.local);
      if (!local) return null;
      return mesh.localToWorld(local);
    }
    return null;
  }

  addDimension(start,end,offset,label,kind,dimension = null) {
    const a = start.clone();
    const b = end.clone();
    const oa = a.clone().add(offset);
    const ob = b.clone().add(offset);
    const color = kind === 'overall' ? 0x28dc66 : 0xe0aa16;
    const opacity = kind === 'overall' ? 1 : 0.92;
    this.addSegments([[a,oa],[b,ob],[oa,ob]],color,opacity);
    this.addArrowHeads(oa,ob,color);
    const midpoint = oa.clone().lerp(ob,0.5);
    const cssKind = kind === 'overall' ? 'overall' : kind === 'user' ? 'user' : kind === 'machining-dim' ? 'machining-dim' : 'part';
    const screenOffset = dimension?.labelOffsetPx || {x:0,y:-2};
    this.addLabel(`dimension:${dimension?.id || crypto.randomUUID()}`,label,midpoint,cssKind,screenOffset,dimension);
  }

  addSegments(segments,color,opacity = 1) {
    const points = [];
    for (const segment of segments) points.push(segment[0],segment[1]);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false});
    const lines = new THREE.LineSegments(geometry,material);
    lines.renderOrder = 1400;
    this.group.add(lines);
  }

  addArrowHeads(start,end,color) {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 0.01) return;
    direction.normalize();
    let perpendicular = direction.clone().cross(new THREE.Vector3(0,1,0));
    if (perpendicular.lengthSq() < 0.01) perpendicular = direction.clone().cross(new THREE.Vector3(1,0,0));
    perpendicular.normalize();
    const arrowLength = Math.min(11,Math.max(5,length * 0.04));
    const arrowWidth = arrowLength * 0.42;
    const atStart = start.clone().addScaledVector(direction,arrowLength);
    const atEnd = end.clone().addScaledVector(direction,-arrowLength);
    this.addSegments([
      [start,atStart.clone().addScaledVector(perpendicular,arrowWidth)],
      [start,atStart.clone().addScaledVector(perpendicular,-arrowWidth)],
      [end,atEnd.clone().addScaledVector(perpendicular,arrowWidth)],
      [end,atEnd.clone().addScaledVector(perpendicular,-arrowWidth)]
    ],color,0.95);
  }

  addLabel(id,text,worldPoint,kind,offsetPx = {x:0,y:0},dimension = null) {
    const element = document.createElement('div');
    element.className = `scene-annotation-label ${kind}`;
    element.textContent = text;
    element.dataset.annotationId = id;
    if (dimension) {
      element.classList.add('draggable');
      if (dimension.binding) element.classList.add('driven');
      if (dimension.chain?.locked) element.classList.add('baseline-chain');
      if (dimension.binding?.type === 'MACHINING_OFFSET') element.classList.add('offset-driver');
      element.title = dimension.chain?.locked
        ? '基准链已锁定到 A/B 语义基准；拖动文字不会改变基准，Shift+拖动只调整尺寸线显示位置'
        : '拖动文字；按住 Shift 拖动可移动整条尺寸线；双击删除';
      element.addEventListener('pointerdown',event => this.beginLabelDrag(event,dimension,worldPoint));
      element.addEventListener('dblclick',event => {
        event.preventDefault();
        event.stopPropagation();
        this.editor.removeUserDimension(dimension.id);
      });
    }
    this.layer.appendChild(element);
    this.labels.push({element,text,worldPoint:worldPoint.clone(),offsetPx,dimension,kind});
  }

  beginLabelDrag(event,dimension,worldPoint) {
    event.preventDefault();
    event.stopPropagation();
    const moveLine = event.shiftKey === true;
    const sourceLabel = dimension.labelOffsetPx || {x:0,y:0};
    const sourceWorld = point3(dimension.offsetWorld) || new THREE.Vector3();
    this.dragState = {
      dimension,
      moveLine,
      worldPoint:worldPoint.clone(),
      startX:event.clientX,
      startY:event.clientY,
      sourceX:Number(sourceLabel.x || 0),
      sourceY:Number(sourceLabel.y || 0),
      sourceWorld
    };
    const move = moveEvent => {
      if (!this.dragState) return;
      const dx = moveEvent.clientX - this.dragState.startX;
      const dy = moveEvent.clientY - this.dragState.startY;
      if (this.dragState.moveLine) {
        const delta = this.screenDeltaToWorld(dx,dy,this.dragState.worldPoint);
        const next = this.dragState.sourceWorld.clone().add(delta);
        dimension.offsetWorld = toPlain(next);
        this.requestRefresh();
      } else {
        dimension.labelOffsetPx = {x:this.dragState.sourceX + dx,y:this.dragState.sourceY + dy};
        dimension.manualLabelOffset = true;
      }
    };
    const up = () => {
      document.removeEventListener('pointermove',move,true);
      document.removeEventListener('pointerup',up,true);
      if (!this.dragState) return;
      this.dragState = null;
      this.editor.historyManager.capture();
      this.editor.emitUserDimensions();
      this.editor.emitProjectChanged();
    };
    document.addEventListener('pointermove',move,true);
    document.addEventListener('pointerup',up,true);
  }

  screenDeltaToWorld(dx,dy,worldPoint) {
    const camera = this.sceneManager.camera;
    const height = Math.max(1,this.sceneManager.container.clientHeight);
    const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    let worldPerPixel = 1;
    if (camera.isPerspectiveCamera) {
      const distance = Math.max(1,camera.position.distanceTo(worldPoint));
      worldPerPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / height;
    } else if (camera.isOrthographicCamera) {
      worldPerPixel = Math.abs(camera.top - camera.bottom) / Math.max(0.001,camera.zoom) / height;
    }
    return right.multiplyScalar(dx * worldPerPixel).add(up.multiplyScalar(-dy * worldPerPixel));
  }

  render() {
    if (!this.labels.length) return;
    const width = Math.max(1,this.sceneManager.container.clientWidth);
    const height = Math.max(1,this.sceneManager.container.clientHeight);
    const camera = this.sceneManager.camera;
    const occupied = [];
    const labels = [...this.labels].sort((a,b) => labelPriority(a) - labelPriority(b));
    for (const label of labels) {
      const projected = label.worldPoint.clone().project(camera);
      if (projected.z < -1.1 || projected.z > 1.1) {
        label.element.style.display = 'none';
        continue;
      }
      const baseX = (projected.x + 1) * 0.5 * width + Number(label.dimension?.labelOffsetPx?.x ?? label.offsetPx.x ?? 0);
      const baseY = (1 - projected.y) * 0.5 * height + Number(label.dimension?.labelOffsetPx?.y ?? label.offsetPx.y ?? 0);
      let x = baseX;
      let y = baseY;
      const estimatedWidth = Math.max(34,Math.min(205,String(label.text || '').length * 8 + 16));
      const estimatedHeight = label.kind === 'machining' ? 34 : 21;
      if (label.dimension?.manualLabelOffset) {
        occupied.push(rectAround(x,y,estimatedWidth,estimatedHeight));
      } else {
        const candidates = labelLaneCandidates(label);
        let placed = false;
        for (const deltaY of candidates) {
          const candidate = rectAround(x,baseY + deltaY,estimatedWidth,estimatedHeight);
          const collides = occupied.some(rect => rectanglesOverlap(candidate,rect));
          if (!collides) {
            y = baseY + deltaY;
            occupied.push(candidate);
            placed = true;
            break;
          }
        }
        if (!placed) {
          const fallback = candidates[candidates.length - 1] || 0;
          y = baseY + fallback;
          occupied.push(rectAround(x,y,estimatedWidth,estimatedHeight));
        }
      }
      label.element.style.display = '';
      label.element.style.transform = `translate(-50%,-50%) translate(${Math.round(x)}px,${Math.round(y)}px)`;
    }
  }

  dispose() {
    this.clearGraphics();
    this.group.removeFromParent();
    this.layer.remove();
  }
}

function machiningWorldPoint(mesh,part,item) {
  const length = Number(part.dimensions?.length || 0);
  const [width,height] = part.dimensions?.sectionSize || [30,30];
  if (item.type === 'END_TAP') {
    const station = item.end === 'END' ? length : 0;
    return mesh.localToWorld(new THREE.Vector3(...getLocalFrameAtStation(part,station).point));
  }
  const station = Number(item.stationS ?? item.distanceFromStart ?? 0);
  const frame = getLocalFrameAtStation(part,station);
  const quaternion = frameRotationQuaternion(frame.rotation);
  const local = faceLocalPoint(item.face,width,height,Number(item.offset || 0),1.2).applyQuaternion(quaternion);
  return mesh.localToWorld(new THREE.Vector3(...frame.point).add(local));
}

function localFrameWorldPoint(mesh,part,station) {
  const frame = getLocalFrameAtStation(part,station);
  return mesh.localToWorld(new THREE.Vector3(...frame.point));
}

function localVectorToWorld(mesh,vector) {
  const origin = mesh.localToWorld(new THREE.Vector3(0,0,0));
  const point = mesh.localToWorld(vector.clone());
  return point.sub(origin);
}

function frameRotationQuaternion(rotation) {
  const quaternion = new THREE.Quaternion();
  if (rotation?.axis === 'X') quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Number(rotation.angleRad || 0));
  else if (rotation?.axis === 'Y') quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Number(rotation.angleRad || 0));
  return quaternion;
}

function faceLocalPoint(face,width,height,offset,epsilon) {
  if (face === 'FRONT') return new THREE.Vector3(offset,height/2 + epsilon,0);
  if (face === 'BACK') return new THREE.Vector3(offset,-height/2 - epsilon,0);
  if (face === 'RIGHT') return new THREE.Vector3(width/2 + epsilon,offset,0);
  return new THREE.Vector3(-width/2 - epsilon,offset,0);
}

function machiningLabel(item) {
  if (item.type === 'END_TAP') return `${item.tappingSize || 'M8'} ${item.end === 'END' ? 'B' : 'A'}孔`;
  if (item.type === 'TAPPED_HOLE') return `${item.tappingSize || 'M8'} 螺纹孔`;
  if (item.type === 'COUNTERSINK') return `CSK Ø${formatNumber(item.majorDiameter || item.diameter || 0)} ${formatNumber(item.angleDeg || 90)}°`;
  if (item.type === 'COUNTERBORE') return `CBORE Ø${formatNumber(item.diameter || 0)}×${formatNumber(item.depth || 0)}`;
  if (item.type === 'BLIND_HOLE') return `盲孔 Ø${formatNumber(item.diameter || 0)} 深${formatNumber(item.depth || 0)}`;
  return `Ø${formatNumber(item.diameter || 0)} 通孔`;
}

function projectDirectionOnPlane(direction,normal) {
  const projected = direction.clone().sub(normal.clone().multiplyScalar(direction.dot(normal)));
  return projected.lengthSq() < 1e-8 ? projected : projected.normalize();
}

function formatDrivenValue(dimension,value) {
  const type = dimension?.binding?.type;
  if (type === 'MACHINING_OFFSET') {
    const number = Number(value || 0);
    return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
  }
  if (type === 'PROFILE_RADIUS' || dimension?.type === 'RADIAL') return `R${formatNumber(value)}`;
  if (type === 'PART_AXIS_COORDINATE' || dimension?.type === 'ORDINATE') return `${String(dimension?.binding?.axis || dimension?.chain?.axis || 'X').toUpperCase()}=${formatNumber(value)}`;
  if (type === 'PROFILE_ARC_ANGLE' || type === 'PROFILE_ANGLE' || dimension?.type === 'ANGULAR') return `${formatNumber(value)}°`;
  return formatNumber(value);
}

function labelPriority(label) {
  if (label.dimension?.manualLabelOffset) return 0;
  if (label.kind === 'overall') return 1;
  if (label.dimension?.chain?.locked) return 2;
  if (label.kind === 'user' || String(label.kind || '').includes('angular')) return 3;
  if (label.kind === 'machining-dim') return 4;
  if (label.kind === 'part') return 5;
  if (label.kind === 'machining') return 6;
  return 7;
}

function labelLaneCandidates(label) {
  const order = Math.max(0,Number(label.dimension?.chain?.order || 0));
  if (label.dimension?.chain?.locked) {
    const preferred = order * 3;
    return [preferred,preferred + 17,preferred - 17,preferred + 34,preferred - 34,preferred + 51,preferred - 51];
  }
  if (label.kind === 'overall') return [0,20,-20,40,-40,60,-60];
  if (label.kind === 'machining') return [0,22,-22,44,-44,66,-66,88,-88];
  if (label.kind === 'machining-dim') return [0,16,-16,32,-32,48,-48,64,-64];
  return [0,18,-18,36,-36,54,-54,72,-72,90,-90,108,-108];
}

function rectAround(x,y,width,height) {
  return {left:x-width/2,right:x+width/2,top:y-height/2,bottom:y+height/2};
}

function rectanglesOverlap(a,b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function point3(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x); const y = Number(value.y); const z = Number(value.z);
  if (![x,y,z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x,y,z);
}

function toPlain(point) { return {x:Number(point.x),y:Number(point.y),z:Number(point.z)}; }
function round0(value) { return Math.round(Number(value || 0)); }
function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/,'');
}
