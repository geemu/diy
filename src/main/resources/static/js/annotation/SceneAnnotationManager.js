import * as THREE from 'three';
import {getLocalFrameAtStation, normalizeProfilePath, isLinearProfile} from '../model/ProfilePath.js';
import {machiningLocalPose} from '../machining/MachiningManager.js';
import ProfileSurfaceNumber, {machiningSizeInfo} from './ProfileSurfaceNumber.js';

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
      showPartDimensions:false,
      showPartNumbers:true,
      showMachiningLabels:true,
      showMachiningSurface:true,
      showMachiningDimensions:false,
      showUserDimensions:true
    };
    this.group = new THREE.Group();
    this.group.name = '__scene_annotations__';
    this.sceneManager.scene.add(this.group);
    this.surfaceNumbers=new ProfileSurfaceNumber(this.sceneManager.scene);
    this.layer = document.createElement('div');
    this.layer.className = 'scene-annotation-layer';
    this.sceneManager.container.appendChild(this.layer);
    this.labels = [];
    this.machiningMeasurements = [];
    this.machiningLaneGroups = new Map();
    this.refreshQueued = false;
    this.dragState = null;
    this.pointer = null;
    this.hoverRay = new THREE.Raycaster();
    this.pointerSurface = this.sceneManager.renderer?.domElement || this.sceneManager.container;
    this.trackPointer = event => {
      if(event.buttons || event.pointerType==='touch'){this.pointer=null;this.surfaceNumbers.clearHover();return;}
      const rect=this.sceneManager.container.getBoundingClientRect();
      this.pointer={x:event.clientX-rect.left,y:event.clientY-rect.top};
    };
    this.clearPointer = () => {this.pointer=null;this.surfaceNumbers.clearHover();};
    this.pointerSurface.addEventListener('pointermove',this.trackPointer,{passive:true});
    for(const type of ['pointerleave','pointerdown','contextmenu'])this.pointerSurface.addEventListener(type,this.clearPointer,{passive:true});
    this.sceneManager.addFrameHandler(() => this.render());
  }

  setOptions(options = {}) {
    this.options = {...this.options,...options};
    if(this.options.showMachiningDimensions)this.options.showMachiningSurface=false;
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
    this.surfaceNumbers.refresh(this.editor.meshes,this.options.showPartNumbers,{
      showMachiningSurface:this.options.showMachiningSurface&&!this.options.showMachiningDimensions,
      occludingRoots:[...(this.editor.connectionManager?.helperMeshes?.values()||[])]
    });
    if (this.options.showOverall) this.addOverallDimensions();
    this.addProfileDimensions();
    if (this.options.showMachiningDimensions) this.addMachiningDimensions();
    if (this.options.showMachiningLabels||this.options.showMachiningDimensions) this.addMachiningLabels();
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
    this.machiningMeasurements = [];
    this.machiningLaneGroups.clear();
    this.machiningVisibilityState=null;
    this.machiningOccluders=[];
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
    const selected=new Set(this.editor.selectedMeshes||[]);
    for (const mesh of this.editor.meshes) {
      if (mesh.visible === false || mesh.userData.part?.type !== 'PROFILE') continue;
      if(!this.options.showPartDimensions&&!selected.has(mesh)&&this.editor.featureHoverManager?.mesh!==mesh&&this.sceneManager.hoveredObject!==mesh)continue;
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
      const stations = new Map();
      for(const item of part.machiningItems || []) {
        if(String(item.type).startsWith('END_'))continue;
        const station=Number(item.stationS??item.distanceFromStart??0);
        if(!Number.isFinite(station)||station<=.01||station>=length-.01)continue;
        const driven=this.options.showUserDimensions&&(this.editor.userDimensions||[]).some(dimension=>{
          const binding=dimension.binding;
          if(binding?.type!=='MACHINING_STATION'||binding.partId!==part.id||binding.datumEnd==='END')return false;
          const source=(part.machiningItems||[]).find(value=>value.id===binding.machiningId);
          return source&&Math.abs(Number(source.stationS??source.distanceFromStart)-station)<.001;
        });
        if(!driven&&!stations.has(station.toFixed(3)))stations.set(station.toFixed(3),{station,item});
      }
      const start = localFrameWorldPoint(mesh,part,0);
      for (const {station,item} of [...stations.values()].sort((a,b)=>a.station-b.station).slice(0,16)) {
        const end = localFrameWorldPoint(mesh,part,station);
        this.addDimension(start,end,new THREE.Vector3(),formatMachiningMm(station),'machining-dim',null,{mesh,item,type:'STATION',value:station});
      }
    }
  }

  addMachiningLabels() {
    for (const mesh of this.editor.meshes) {
      if (mesh.visible === false || mesh.userData.part?.type !== 'PROFILE') continue;
      const part = mesh.userData.part;
      normalizeProfilePath(part);
      for (const item of part.machiningItems || []) {
        const compound=(part.machiningItems||[]).some(other=>other.linkedHoleId===item.id&&['COUNTERSINK','COUNTERBORE','END_COUNTERSINK','END_COUNTERBORE'].includes(other.type));
        const linked=(part.machiningItems||[]).find(other=>other.id===item.linkedHoleId);
        const through=item.type==='THROUGH_HOLE'?item:linked?.type==='THROUGH_HOLE'?linked:null;
        const illustrated=through&&!mesh.userData.openMachiningHoleIds?.has(through.id);
        const text=(linked?machiningLabel(linked)+' · ':'')+machiningLabel(item)+(illustrated?' · 孔位示意':'');
        const faces=compound?[]:[item.face];
        if(item.type==='THROUGH_HOLE')faces.push({FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'}[item.face]);
        for(const face of faces) {
          const pose=machiningLocalPose(part,item,face);
          const worldPoint=mesh.localToWorld(pose.point.clone());
          if(this.options.showMachiningLabels) {
            const label=this.addLabel(`machining:${part.id}:${item.id}:${face||item.end}`,text,worldPoint,'machining');
            label.mesh=mesh;label.localNormal=pose.normal;label.localPoint=pose.point;
          }
          const dimensioned=this.options.showMachiningDimensions;
          const size=machiningSizeInfo(item,linked);
          if(dimensioned&&size) {
            const callout=this.addLabel(`machining-size:${part.id}:${item.id}:${face||item.end}`,size.text,worldPoint,'machining-size');
            callout.mesh=mesh;callout.localPoint=pose.point;callout.localNormal=pose.normal;callout.radius=size.radius;
            callout.element.title=text;callout.leader=this.addDynamicSegments(2,0x526b80,.9);
          }
        }
      }
    }
  }

  addUserDimensions() {
    for (const dimension of this.editor.userDimensions || []) {
      // 仅改变孔位驱动的显示，不删除绑定或禁用其驱动能力；其他永久尺寸不受影响。
      if(!this.options.showMachiningDimensions&&['MACHINING_STATION','MACHINING_OFFSET'].includes(dimension.binding?.type))continue;
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
      const machiningLayout=this.machiningDimensionContext(dimension);
      const autoOffset = machiningLayout?null:this.getDrivenDimensionAutoOffset(dimension);
      if (autoOffset) offset3d.add(autoOffset);
      const startDim = start.clone().add(offset3d);
      const endDim = end.clone().add(offset3d);
      const drivenValue = Number(this.editor.getUserDimensionValue?.(dimension));
      const value = Number.isFinite(drivenValue) ? drivenValue : start.distanceTo(end);
      dimension.measuredValue = Number(value.toFixed(3));
      const label = dimension.text || formatDrivenValue(dimension,value);
      this.addDimension(start,end,offset3d,label,'user',dimension,machiningLayout);
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

  machiningDimensionContext(dimension) {
    if(!['MACHINING_STATION','MACHINING_OFFSET'].includes(dimension?.binding?.type))return null;
    // 已手工调整整条线的位置继续尊重原世界偏移，不把它重新自动排布。
    if(dimension.layout?.auto===false||(point3(dimension.offsetWorld)?.lengthSq()||0)>1e-8)return null;
    const mesh=this.editor.getMeshByPartId(dimension.binding.partId),item=mesh?.userData?.part?.machiningItems?.find(value=>value.id===dimension.binding.machiningId);
    if(!mesh||!item||String(item.type).startsWith('END_'))return null;
    return {mesh,item,type:dimension.binding.type==='MACHINING_STATION'?'STATION':'OFFSET',value:Number(this.editor.getUserDimensionValue?.(dimension))};
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

  addDimension(start,end,offset,label,kind,dimension = null,machiningLayout = null) {
    if(machiningLayout) {
      const {mesh,item,type,value}=machiningLayout;
      const a=start.clone(),b=end.clone();
      if(type==='STATION'&&mesh.userData.part.profilePath?.type!=='ARC') {
        // 站位值仍来自原轴向语义；引出线指向实际孔位所在的面，而非杆中心。
        const hole=mesh.localToWorld(machiningLocalPose(mesh.userData.part,item).point),shift=hole.clone().sub(b);
        a.add(shift);b.copy(hole);
      }
      const element=this.addLabel(`dimension:${dimension?.id||crypto.randomUUID()}`,label,a.clone().lerp(b,.5),kind,{},dimension);
      element.element.classList.add('machining-distance');
      element.element.style.display='none';
      const record={label:element,mesh,item,type,start:a,end:b,localStart:mesh.worldToLocal(a.clone()),localEnd:mesh.worldToLocal(b.clone()),value:Number.isFinite(value)?Math.abs(value):a.distanceTo(b),lines:this.addDynamicSegments(8,0xe0aa16,.9)};
      element.measurement=record;this.machiningMeasurements.push(record);
      const key=`${mesh.uuid}:${type}:${type==='OFFSET'?item.face:''}`;
      let group=this.machiningLaneGroups.get(key);
      if(!group){group={mesh,type,item,records:[]};this.machiningLaneGroups.set(key,group);}
      group.records.push(record);record.laneGroup=group;
      return;
    }
    const a = start.clone();
    const b = end.clone();
    const oa = a.clone().add(offset);
    const ob = b.clone().add(offset);
    const color = kind === 'overall' ? 0x536b83 : 0xe0aa16;
    const opacity = kind === 'overall' ? .72 : 0.92;
    this.addSegments([[a,oa],[b,ob],[oa,ob]],color,opacity);
    this.addArrowHeads(oa,ob,color);
    const midpoint = oa.clone().lerp(ob,0.5);
    const cssKind = kind === 'overall' ? 'overall' : kind === 'user' ? 'user' : kind === 'machining-dim' ? 'machining-dim' : 'part';
    const screenOffset = dimension?.labelOffsetPx || {x:0,y:-2};
    this.addLabel(`dimension:${dimension?.id || crypto.randomUUID()}`,label,midpoint,cssKind,screenOffset,dimension);
  }

  addDynamicSegments(count,color,opacity) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*6),3));
    const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false}));
    lines.renderOrder=1700;lines.frustumCulled=false;lines.raycast=()=>{};lines.visible=false;
    this.group.add(lines);return lines;
  }

  /** 固定缓冲复用；只改展示顶点，不重建几何或回写世界偏移/尺寸锚点。 */
  updateDynamicSegments(lines,segments) {
    const position=lines.geometry.attributes.position;
    let changed=false;
    for(let i=0;i<position.count;i++) {
      const point=segments[Math.floor(i/2)]?.[i%2],x=Math.fround(point?.x??0),y=Math.fround(point?.y??0),z=Math.fround(point?.z??0);
      if(position.getX(i)!==x||position.getY(i)!==y||position.getZ(i)!==z) {
        position.setXYZ(i,x,y,z);changed=true;
      }
    }
    if(changed)position.needsUpdate=true;
    lines.visible=true;
  }

  screenPoint(point,width,height,camera) {
    const p=point.clone().project(camera);
    return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};
  }

  worldScreenPoint(point,width,height,camera) {
    return new THREE.Vector3(point.x/width*2-1,1-point.y/height*2,point.z).unproject(camera);
  }

  machiningScreenNormal(mesh,type,item,width,height,camera,previous=null) {
    const length=Number(mesh.userData.part.dimensions?.length||1);
    const direction=type==='STATION'?new THREE.Vector3(0,0,length):['FRONT','BACK'].includes(item.face)?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
    const a=this.screenPoint(mesh.localToWorld(new THREE.Vector3()),width,height,camera),b=this.screenPoint(mesh.localToWorld(direction),width,height,camera);
    const span=Math.hypot(b.x-a.x,b.y-a.y);
    let normal=span>1e-5&&Number.isFinite(span)?{x:-(b.y-a.y)/span,y:(b.x-a.x)/span}:{x:0,y:-1};
    if(previous?normal.x*previous.x+normal.y*previous.y<0:Math.abs(normal.y)>.1?normal.y>0:normal.x>0)normal={x:-normal.x,y:-normal.y};
    return normal;
  }

  layoutMachiningMeasurements(width,height,camera) {
    const footprints=new Map();
    for(const group of this.machiningLaneGroups.values()) {
      group.mesh.updateMatrixWorld(true);
      group.normal=this.machiningScreenNormal(group.mesh,group.type,group.item,width,height,camera,group.normal);
      const normal=group.normal;
      if(!footprints.has(group.mesh)) {
        const points=[];
        for(const body of [group.mesh,...group.mesh.children].filter(object=>object.isMesh&&object.geometry)) {
          if(!body.geometry.boundingBox)body.geometry.computeBoundingBox();
          const box=body.geometry.boundingBox;if(!box||box.isEmpty())continue;
          for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
            const p=this.screenPoint(new THREE.Vector3(x,y,z).applyMatrix4(body.matrixWorld),width,height,camera);
            if(screenPointVisible(p))points.push(p);
          }
        }
        footprints.set(group.mesh,points);
      }
      const records=[...group.records].sort((a,b)=>a.value-b.value);
      const boxes=records.map(record=>annotationBoxSize(record.label));
      group.spacing=Math.max(24,Math.abs(normal.x)*(Math.max(...boxes.map(box=>box.width))+10)+Math.abs(normal.y)*(Math.max(...boxes.map(box=>box.height))+8));
      const outline=footprints.get(group.mesh);
      group.edge=outline.length?Math.max(...outline.map(point=>point.x*normal.x+point.y*normal.y)):null;
      group.nextLane=records.length;
      for(let i=0;i<records.length;i++) {
        const record=records[i];record.start.copy(record.localStart).applyMatrix4(record.mesh.matrixWorld);record.end.copy(record.localEnd).applyMatrix4(record.mesh.matrixWorld);
        record.screenStart=this.screenPoint(record.start,width,height,camera);record.screenEnd=this.screenPoint(record.end,width,height,camera);
        record.visible=annotationObjectVisible(record.mesh)&&screenPointVisible(record.screenStart)&&screenPointVisible(record.screenEnd);
        record.lane=i;record.lines.visible=record.visible;
      }
    }
  }

  renderMachiningMeasurement(record,occupied,width,height,camera) {
    const label=record.label;
    if(!record.visible){label.element.style.display='none';record.lines.visible=false;return;}
    const group=record.laneGroup,n=group.normal,a=record.screenStart,b=record.screenEnd,box=annotationBoxSize(label);
    const edge=group.edge??Math.max(a.x*n.x+a.y*n.y,b.x*n.x+b.y*n.y);
    const positions=lane=>{
      const dot=edge+16+lane*group.spacing,move=point=>({x:point.x+n.x*(dot-point.x*n.x-point.y*n.y),y:point.y+n.y*(dot-point.x*n.x-point.y*n.y),z:point.z});
      const start=move(a),end=move(b),midpoint={x:(start.x+end.x)/2,y:(start.y+end.y)/2,z:(start.z+end.z)/2};
      return {start,end,midpoint};
    };
    let placement=positions(record.lane),textPoint={...placement.midpoint};
    if(label.dimension?.manualLabelOffset) {
      textPoint.x+=Number(label.dimension.labelOffsetPx?.x||0);textPoint.y+=Number(label.dimension.labelOffsetPx?.y||0);
    }else {
      for(let attempt=0;attempt<64&&occupied.some(rect=>rectanglesOverlap(rectAround(textPoint.x,textPoint.y,box.width+4,box.height+4),rect));attempt++) {
        placement=positions(group.nextLane++);textPoint={...placement.midpoint};
      }
    }
    occupied.push(rectAround(textPoint.x,textPoint.y,box.width+4,box.height+4));
    const fromScreen=point=>this.worldScreenPoint(point,width,height,camera),segments=[[record.start,fromScreen(placement.start)],[record.end,fromScreen(placement.end)],[fromScreen(placement.start),fromScreen(placement.end)]];
    const dx=placement.end.x-placement.start.x,dy=placement.end.y-placement.start.y,length=Math.hypot(dx,dy);
    if(length>.01) {
      const ux=dx/length,uy=dy/length,arrow=Math.min(6,length/4),spread=arrow*.4;
      for(const [point,sign] of [[placement.start,1],[placement.end,-1]])for(const side of [-1,1])segments.push([fromScreen(point),fromScreen({x:point.x+ux*arrow*sign-uy*spread*side,y:point.y+uy*arrow*sign+ux*spread*side,z:point.z})]);
    }
    if(label.dimension?.manualLabelOffset&&(Math.abs(textPoint.x-placement.midpoint.x)>2||Math.abs(textPoint.y-placement.midpoint.y)>2)) {
      const bounds=rectAround(textPoint.x,textPoint.y,box.width,box.height);
      const end={x:Math.max(bounds.left,Math.min(bounds.right,placement.midpoint.x)),y:Math.max(bounds.top,Math.min(bounds.bottom,placement.midpoint.y)),z:textPoint.z};
      segments.push([fromScreen(placement.midpoint),fromScreen(end)]);
    }
    this.updateDynamicSegments(record.lines,segments);
    label.worldPoint.copy(fromScreen(placement.midpoint));label.element.style.display='';
    label.element.style.transform=`translate(-50%,-50%) translate(${Math.round(textPoint.x)}px,${Math.round(textPoint.y)}px)`;
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
    if(kind==='machining'||kind==='machining-size')element.style.display='none';
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
    const label={element,text,worldPoint:worldPoint.clone(),offsetPx,dimension,kind};
    this.labels.push(label);return label;
  }

  beginLabelDrag(event,dimension,worldPoint) {
    event.preventDefault();
    event.stopPropagation();
    const moveLine = event.shiftKey === true;
    const currentLabel=this.labels.find(label=>label.dimension?.id===dimension.id);
    const sourceLabel = currentLabel?.measurement&&!dimension.manualLabelOffset?{x:0,y:0}:dimension.labelOffsetPx || {x:0,y:0};
    let sourceWorld = point3(dimension.offsetWorld) || new THREE.Vector3();
    if(moveLine&&currentLabel?.measurement) {
      // 将正在显示的自动档位交给原手工世界偏移链，拖动第一帧不跳回旧默认档位。
      const position=currentLabel.measurement.lines.geometry.attributes.position;
      const visibleMidpoint=new THREE.Vector3().fromBufferAttribute(position,4).lerp(new THREE.Vector3().fromBufferAttribute(position,5),.5);
      const start=point3(dimension.start),end=point3(dimension.end);
      if(start&&end)sourceWorld=visibleMidpoint.sub(start.lerp(end,.5)).sub(this.getDrivenDimensionAutoOffset(dimension)||new THREE.Vector3());
    }
    this.dragState = {
      dimension,
      moveLine,
      worldPoint:(currentLabel?.worldPoint||worldPoint).clone(),
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
    this.surfaceNumbers.update();
    const width = Math.max(1,this.sceneManager.container.clientWidth);
    const height = Math.max(1,this.sceneManager.container.clientHeight);
    const camera = this.sceneManager.camera;
    camera.updateMatrixWorld(true);
    const busy=this.dragState||this.sceneManager.transformControls?.dragging||this.editor.isBuilderReviewActive?.()||this.editor.profileDrawTool?.isActive()||
      this.editor.profilePlacementManager?.isActive()||this.editor.wholeStretchManager?.isActive()||
      this.editor.machiningPlacementManager?.isActive()||this.editor.connectionPlacementManager?.isActive()||this.editor.accessoryPlacementManager?.isActive();
    this.surfaceNumbers.updateHover(busy?null:this.pointer,camera,width,height);
    for(const label of this.labels)if(label.localPoint&&label.mesh) {
      label.mesh.updateMatrixWorld(true);label.worldPoint.copy(label.localPoint).applyMatrix4(label.mesh.matrixWorld);
    }
    this.layoutMachiningMeasurements(width,height,camera);
    this.updateMachiningVisibilityState(width,height,camera);
    const machiningHover=this.labels.length?this.nearestMachiningLabel(width,height,camera):null;
    const hoverState=machiningHover?'true':'false';
    if(this.sceneManager.container.dataset.machiningHover!==hoverState)this.sceneManager.container.dataset.machiningHover=hoverState;
    if (!this.labels.length) return;
    const occupied = [];
    const labels = [...this.labels].sort((a,b) => labelPriority(a) - labelPriority(b));
    for (const label of labels) {
      if(label.measurement){this.renderMachiningMeasurement(label.measurement,occupied,width,height,camera);continue;}
      if(label.kind==='machining-size'){this.renderMachiningSize(label,occupied,width,height,camera);continue;}
      if(label.kind==='machining') {
        label.element.style.display=label===machiningHover?'':'none';
        if(label===machiningHover) {
          label.element.style.maxWidth=`${Math.max(32,width-16)}px`;
          const x=Math.max(8,Math.min(width-label.element.offsetWidth-8,this.pointer.x+14));
          const y=Math.max(8,Math.min(height-label.element.offsetHeight-8,this.pointer.y+16));
          label.element.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
        }
        continue;
      }
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

  renderMachiningSize(label,occupied,width,height,camera) {
    const hide=()=>{label.element.style.display='none';label.leader.visible=false;};
    if(!annotationObjectVisible(label.mesh)){hide();return;}
    const normal=label.localNormal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(label.mesh.matrixWorld)).normalize();
    const facing=camera.isPerspectiveCamera?camera.getWorldPosition(new THREE.Vector3()).sub(label.worldPoint):new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
    const center=this.screenPoint(label.worldPoint,width,height,camera);
    if(normal.dot(facing)<=0||!screenPointVisible(center)||center.x<0||center.y<0||center.x>width||center.y>height){hide();return;}
    if(label.surfaceVisible==null) {
      this.hoverRay.setFromCamera(new THREE.Vector2(center.x/width*2-1,1-center.y/height*2),camera);
      const hit=this.hoverRay.intersectObjects(this.machiningOccluders,true).find(value=>value.object.isMesh&&annotationObjectVisible(value.object));
      label.surfaceVisible=!hit||hit.distance>=this.hoverRay.ray.origin.distanceTo(label.worldPoint)-.05;
    }
    if(!label.surfaceVisible){hide();return;}
    const localU=label.localNormal.clone().cross(new THREE.Vector3(0,0,1));
    if(localU.lengthSq()<1e-8)localU.copy(label.localNormal).cross(new THREE.Vector3(0,1,0));
    localU.normalize();const localV=label.localNormal.clone().cross(localU).normalize();
    const rim=[];
    for(let i=0;i<16;i++) {
      const angle=i*Math.PI/8,point=label.localPoint.clone().addScaledVector(localU,Math.cos(angle)*label.radius).addScaledVector(localV,Math.sin(angle)*label.radius);
      const p=this.screenPoint(label.mesh.localToWorld(point),width,height,camera);if(screenPointVisible(p))rim.push(p);
    }
    if(!rim.length){hide();return;}
    const n=this.machiningLaneGroups.get(`${label.mesh.uuid}:STATION:`)?.normal||this.machiningScreenNormal(label.mesh,'STATION',{},width,height,camera,label.calloutNormal),t={x:-n.y,y:n.x};
    label.calloutNormal=n;
    const directions=[{x:-n.x,y:-n.y},{x:-n.x+t.x*.8,y:-n.y+t.y*.8},{x:-n.x-t.x*.8,y:-n.y-t.y*.8},{x:n.x+t.x*.8,y:n.y+t.y*.8},{x:n.x-t.x*.8,y:n.y-t.y*.8},{x:t.x,y:t.y},{x:-t.x,y:-t.y}];
    const box=annotationBoxSize(label);
    let placement=null;
    for(const extra of [0,18,36,54,72]) {
      for(const raw of directions) {
        const span=Math.hypot(raw.x,raw.y),direction={x:raw.x/span,y:raw.y/span};
        const start=rim.reduce((best,point)=>(point.x-center.x)*direction.x+(point.y-center.y)*direction.y>(best.x-center.x)*direction.x+(best.y-center.y)*direction.y?point:best);
        const extent=Math.max(0,(start.x-center.x)*direction.x+(start.y-center.y)*direction.y);
        const radius=extent+12+extra+(Math.abs(direction.x)*box.width+Math.abs(direction.y)*box.height)/2;
        const text={x:center.x+direction.x*radius,y:center.y+direction.y*radius,z:center.z},bounds=rectAround(text.x,text.y,box.width+4,box.height+4);
        if(bounds.left<4||bounds.right>width-4||bounds.top<4||bounds.bottom>height-4||occupied.some(rect=>rectanglesOverlap(bounds,rect)))continue;
        const elbow={x:center.x+direction.x*(extent+8+extra),y:center.y+direction.y*(extent+8+extra),z:center.z};
        const end={x:Math.max(bounds.left,Math.min(bounds.right,elbow.x)),y:Math.max(bounds.top,Math.min(bounds.bottom,elbow.y)),z:center.z};
        placement={text,bounds,start,elbow,end};break;
      }
      if(placement)break;
    }
    // 过密或没有完整可见空间时保留原悬停提示，不把小标注压成另一堆重叠文字。
    if(!placement){hide();return;}
    const fromScreen=point=>this.worldScreenPoint(point,width,height,camera);
    this.updateDynamicSegments(label.leader,[[fromScreen(placement.start),fromScreen(placement.elbow)],[fromScreen(placement.elbow),fromScreen(placement.end)]]);
    occupied.push(placement.bounds);label.element.style.display='';
    label.element.style.transform=`translate(-50%,-50%) translate(${Math.round(placement.text.x)}px,${Math.round(placement.text.y)}px)`;
  }

  /** 静止画面复用孔口遮挡结果，视角/实体几何或可见性变化后才重新射线检查。 */
  updateMachiningVisibilityState(width,height,camera) {
    const labels=this.labels.filter(label=>label.kind==='machining-size');
    if(!labels.length)return;
    this.machiningOccluders=[...this.editor.meshes.filter(mesh=>mesh.visible!==false),...(this.editor.connectionManager?.selectableHelpers?.()||[])];
    const state=[width,height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements];
    for(const root of this.machiningOccluders) {
      root.updateMatrixWorld(true);state.push(root.uuid,annotationObjectVisible(root));
      root.traverse(object=>{
        if(!object.isMesh)return;
        state.push(object.uuid,annotationObjectVisible(object),...object.matrixWorld.elements,object.geometry?.uuid,object.geometry?.attributes?.position?.version,object.geometry?.index?.version);
      });
    }
    if(!this.machiningVisibilityState||state.length!==this.machiningVisibilityState.length||state.some((value,index)=>value!==this.machiningVisibilityState[index])) {
      this.machiningVisibilityState=state;for(const label of labels)label.surfaceVisible=null;
    }
  }

  /** 一次只显示最近的可见孔位；反面、被遮挡或拖动中的孔不能隔着模型弹提示。 */
  nearestMachiningLabel(width,height,camera) {
    if(!this.pointer || this.sceneManager.transformControls?.dragging || this.editor.isBuilderReviewActive?.() || this.editor.machiningPlacementManager?.isActive() || this.editor.profileDrawTool?.isActive())return null;
    const viewDirection=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
    let nearest=null,distance=18*18;
    for(const label of this.labels) {
      if(label.kind!=='machining'||label.mesh.visible===false)continue;
      const normal=label.localNormal.clone().transformDirection(label.mesh.matrixWorld);
      const facing=camera.isPerspectiveCamera?camera.position.clone().sub(label.worldPoint):viewDirection;
      if(normal.dot(facing)<=0)continue;
      const p=label.worldPoint.clone().project(camera);if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;
      const d=((p.x+1)*width/2-this.pointer.x)**2+((1-p.y)*height/2-this.pointer.y)**2;
      if(d<distance){nearest=label;distance=d;}
    }
    if(!nearest)return null;
    const p=nearest.worldPoint.clone().project(camera);
    this.hoverRay.setFromCamera(new THREE.Vector2(p.x,p.y),camera);
    const hits=this.hoverRay.intersectObjects(this.editor.meshes.filter(mesh=>mesh.visible!==false),true);
    if(hits[0]&&hits[0].distance<this.hoverRay.ray.origin.distanceTo(nearest.worldPoint)-2)return null;
    return nearest;
  }

  dispose() {
    this.surfaceNumbers.dispose();
    this.pointerSurface.removeEventListener('pointermove',this.trackPointer);
    for(const type of ['pointerleave','pointerdown','contextmenu'])this.pointerSurface.removeEventListener(type,this.clearPointer);
    this.clearGraphics();
    delete this.sceneManager.container.dataset.machiningHover;
    this.group.removeFromParent();
    this.layer.remove();
  }
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

function annotationObjectVisible(object){for(let current=object;current;current=current.parent)if(current.visible===false)return false;return true;}
function screenPointVisible(point){return Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z)&&point.z>=-1&&point.z<=1;}
function annotationBoxSize(label){return {width:label.element.offsetWidth||Math.max(28,String(label.text||'').length*6+12),height:label.element.offsetHeight||18};}

function machiningLabel(item) {
  if (item.type === 'END_TAP') return `${item.tappingSize || 'M8'} ${item.end === 'END' ? 'B' : 'A'}端攻丝 · 深${formatNumber(item.depth || 0)}`;
  if (item.type === 'TAPPED_HOLE') return `${item.tappingSize || 'M8'} 攻丝 · 深${formatNumber(item.depth || 0)}`;
  if (item.type === 'COUNTERSINK') return `沉头 Ø${formatNumber(item.majorDiameter || item.diameter || 0)} ${formatNumber(item.angleDeg || 90)}°`;
  if (item.type === 'COUNTERBORE') return `沉孔 Ø${formatNumber(item.diameter || 0)} 深${formatNumber(item.depth || 0)}`;
  if (item.type === 'BLIND_HOLE') return `盲孔 Ø${formatNumber(item.diameter || 0)} 深${formatNumber(item.depth || 0)}`;
  if (item.type === 'END_HOLE') return `${item.end==='END'?'B':'A'}端孔 Ø${formatNumber(item.diameter||0)} 深${formatNumber(item.depth||0)}`;
  if (item.type === 'END_COUNTERBORE') return `${item.end==='END'?'B':'A'}端沉孔 Ø${formatNumber(item.diameter||0)} 深${formatNumber(item.depth||0)}`;
  if (item.type === 'END_COUNTERSINK') return `${item.end==='END'?'B':'A'}端沉头 Ø${formatNumber(item.majorDiameter||0)} ${formatNumber(item.angleDeg||90)}°`;
  if (['SLOT','OBROUND_SLOT','MILLING_REGION'].includes(item.type)) return `${item.type==='MILLING_REGION'?'铣削':item.type==='OBROUND_SLOT'?'腰孔':'槽'} ${formatNumber(item.length||0)}×${formatNumber(item.width||0)}`;
  return `Ø${formatNumber(item.diameter || 0)} 通孔`;
}

function projectDirectionOnPlane(direction,normal) {
  const projected = direction.clone().sub(normal.clone().multiplyScalar(direction.dot(normal)));
  return projected.lengthSq() < 1e-8 ? projected : projected.normalize();
}

function formatDrivenValue(dimension,value) {
  const type = dimension?.binding?.type;
  if (type === 'MACHINING_STATION') return formatMachiningMm(value);
  if (type === 'MACHINING_OFFSET') {
    const number = Math.round(Number(value || 0));
    return `${number > 0 ? '+' : ''}${formatMachiningMm(number)}`;
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
  if (label.kind === 'machining-size') return 3;
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
function formatMachiningMm(value) { return String(Math.round(Number(value || 0))); }
function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/,'');
}
