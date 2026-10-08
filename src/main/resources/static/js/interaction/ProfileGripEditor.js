import * as THREE from 'three';
import {getLocalEndpoints,isLinearProfile,normalizeProfilePath} from '../model/ProfilePath.js';
import {featureLabel} from '../model/ProfileFeatureCatalog.js';
import {clampGripLength,remapMachiningStations} from './ProfileGripMath.js';

/**
 * CAD-style A/B endpoint length grips for linear profiles.
 *
 * Business semantics:
 * - dragging A keeps B fixed in world space;
 * - dragging B keeps A fixed in world space;
 * - only profile length changes, never scale;
 * - machining stations keep their declared A_END / B_END datum meaning;
 * - source endpoint constraints block the corresponding grip;
 * - feature/grid snapping affect only the scalar length along the profile axis.
 */
export default class ProfileGripEditor {
  constructor(editor,options={}) {
    this.editor=editor;
    this.sceneManager=editor.sceneManager;
    this.options={enabled:true,minLengthMm:10,gridSnap:true,gridStepMm:10,featureSnap:true,featureSnapDistanceMm:28,axisSnapToleranceMm:3,...options};
    this.onStateChanged=null;
    this.onEditRequested=null;
    this.drag=null;
    this.hoverEnd=null;
    this.typedBuffer='';
    this.handles={START:this.createHandle('START'),END:this.createHandle('END')};
    this.sceneManager.scene.add(this.handles.START,this.handles.END);
    this.handles.START.visible=false;this.handles.END.visible=false;
    this.canvas=this.sceneManager.renderer.domElement;
    this.canvas.addEventListener('pointerdown',event=>this.handlePointerDown(event));
    this.canvas.addEventListener('pointermove',event=>this.handlePointerMove(event));
    this.canvas.addEventListener('pointerup',event=>this.handlePointerUp(event));
    this.canvas.addEventListener('pointercancel',event=>this.handlePointerUp(event));
    this.canvas.addEventListener('dblclick',event=>this.handleDoubleClick(event));
    this.canvas.addEventListener('pointerleave',()=>{if(!this.drag){this.hoverEnd=null;this.setVisible(false);this.canvas.style.cursor='';}});
    window.addEventListener('keydown',event=>this.handleKeyDown(event));
    this.sceneManager.addFrameHandler?.(()=>this.refresh());
  }

  configure(options={}) { Object.assign(this.options,options||{}); this.refresh(true); }

  createHandle(end) {
    // 以像素大小定义轻量箭头，缩放相机后仍保持约13px，不再用巨大球体遮住端面。
    const handle=new THREE.Group();handle.userData.profileGrip=true;handle.userData.gripEnd=end;
    const material=new THREE.MeshBasicMaterial({color:end==='START'?0x2f78ff:0x24a36a,depthTest:false,depthWrite:false,toneMapped:false});
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,7,6),material);
    const head=new THREE.Mesh(new THREE.ConeGeometry(2.5,5,8),material);
    stem.position.y=4.5;head.position.y=10.5;
    for(const mesh of [stem,head]){mesh.renderOrder=1300;mesh.userData.helper=true;handle.add(mesh);}
    return handle;
  }

  selectedMesh() {
    const mesh=this.editor.selected;
    if(!this.options.enabled||!mesh||this.editor.selectedMeshes.length!==1)return null;
    if(this.editor.isBuilderReviewActive?.())return null;
    if(this.sceneManager.marqueeMode||this.editor.featureSelectionManager?.enabled||this.editor.measureMode||this.editor.dimensionMode)return null;
    const part=mesh.userData?.part;
    if(part?.type!=='PROFILE'||!isLinearProfile(part))return null;
    if(!this.editor.isMeshTransformable(mesh))return null;
    if(this.editor.profileDrawTool?.isActive())return null;
    if(this.editor.profilePlacementManager?.isActive())return null;
    if(this.editor.wholeStretchManager?.isActive())return null;
    // 放置端盖/连接/加工时，端点是安装目标，不是拉伸手柄；不能抢走确认点击。
    if(this.editor.accessoryPlacementManager?.isActive()||this.editor.connectionPlacementManager?.isActive()||this.editor.machiningPlacementManager?.isActive())return null;
    return mesh;
  }

  refresh(force=false) {
    if(this.drag&&!force)return;
    const mesh=this.selectedMesh();
    if(!mesh){this.hoverEnd=null;this.setVisible(false);return;}
    if(this.activePartId!==mesh.userData.part.id){this.activePartId=mesh.userData.part.id;this.hoverEnd=null;}
    mesh.updateMatrixWorld(true);
    const ends=getLocalEndpoints(mesh.userData.part);
    this.handles.START.position.copy(mesh.localToWorld(new THREE.Vector3(...ends.start)));
    this.handles.END.position.copy(mesh.localToWorld(new THREE.Vector3(...ends.end)));
    const direction=this.handles.END.position.clone().sub(this.handles.START.position).normalize();
    this.handles.START.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().negate());
    this.handles.END.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
    this.refreshHandleStyles(mesh.userData.part.id);
  }

  /** 视觉尺寸固定为屏幕像素；不可将这个比例写回型材或工程尺寸。 */
  worldPerPixel(point){
    const camera=this.sceneManager.camera,height=Math.max(1,this.canvas.getBoundingClientRect().height);
    if(camera.isOrthographicCamera)return (camera.top-camera.bottom)/camera.zoom/height;
    const depth=point.clone().sub(camera.getWorldPosition(new THREE.Vector3())).dot(camera.getWorldDirection(new THREE.Vector3()));
    return Math.max(.001,2*Math.max(camera.near,depth)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom/height);
  }

  setVisible(visible){this.handles.START.visible=visible;this.handles.END.visible=visible;}

  refreshHandleStyles(partId){
    for(const end of ['START','END']){
      const handle=this.handles[end];
      const blocked=this.isEndDrivenByConstraint(partId,end);
      const hovered=this.hoverEnd===end;
      const dragging=this.drag?.end===end;
      const color=blocked?0xd04a4a:(end==='START'?0x2f78ff:0x24a36a);
      for(const child of handle.children)child.material.color.setHex(dragging&&!blocked?0xf4a62a:color);
      handle.scale.setScalar(this.worldPerPixel(handle.position));
      handle.visible=hovered||dragging;
      handle.userData.blocked=blocked;
    }
  }

  pickHandle(event){
    if(!this.selectedMesh()||this.sceneManager.transformControls.dragging)return null;
    this.refresh(true);
    const rect=this.canvas.getBoundingClientRect();
    let best=null,bestDistance=18;
    for(const handle of Object.values(this.handles)){
      const point=handle.position.clone().project(this.sceneManager.camera);
      if(point.z<-1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1)continue;
      const distance=Math.hypot(event.clientX-rect.left-(point.x+1)*rect.width/2,event.clientY-rect.top-(1-point.y)*rect.height/2);
      if(distance<bestDistance){best=handle;bestDistance=distance;}
    }
    return best;
  }

  handlePointerDown(event){
    if(event.button!==0||this.drag||!this.selectedMesh())return;
    const handle=this.pickHandle(event);
    if(!handle)return;
    event.preventDefault();event.stopPropagation();
    this.sceneManager.pointerDownPosition=null;
    const mesh=this.selectedMesh();
    if(!mesh)return;
    const end=handle.userData.gripEnd;
    if(this.isEndDrivenByConstraint(mesh.userData.part.id,end)){
      this.emitState({active:false,blocked:true,end,message:`${end==='START'?'A':'B'}端已有连接/约束，不能直接拉伸`});
      return;
    }
    mesh.updateMatrixWorld(true);
    const part=mesh.userData.part;
    normalizeProfilePath(part);
    const endpoints=getLocalEndpoints(part);
    const start=mesh.localToWorld(new THREE.Vector3(...endpoints.start));
    const finish=mesh.localToWorld(new THREE.Vector3(...endpoints.end));
    const worldAxis=finish.clone().sub(start).normalize();
    const fixedPoint=(end==='END'?start:finish).clone();
    const dragAxis=worldAxis.clone().multiplyScalar(end==='END'?1:-1);
    this.drag={
      pointerId:event.pointerId,
      mesh,end,partId:part.id,
      oldLength:Number(part.dimensions.length),
      originalPosition:mesh.position.clone(),
      originalQuaternion:mesh.quaternion.clone(),
      originalPath:structuredClone(part.profilePath),
      originalMachining:structuredClone(part.machiningItems||[]),
      fixedPoint,dragAxis,worldAxis,
      currentLength:Number(part.dimensions.length),
      snappedFeature:null
    };
    this.typedBuffer='';
    this.sceneManager.transformControls.detach();
    this.sceneManager.orbitControls.enabled=false;
    try{this.canvas.setPointerCapture(event.pointerId);}catch(_){/* no-op */}
    this.emitDragState();
    this.refreshHandleStyles(part.id);
  }

  handlePointerMove(event){
    if(this.drag){
      event.preventDefault();
      const raw=this.pointOnDragPlane(event,this.drag);
      if(!raw)return;
      const scalar=raw.clone().sub(this.drag.fixedPoint).dot(this.drag.dragAxis);
      this.applyCandidateLength(Math.max(this.options.minLengthMm,scalar),{allowFeatureSnap:true});
      return;
    }
    const handle=this.pickHandle(event);
    const next=handle?.userData?.gripEnd||null;
    if(next!==this.hoverEnd){
      this.hoverEnd=next;
      const mesh=this.selectedMesh();
      if(mesh)this.refreshHandleStyles(mesh.userData.part.id);
      this.canvas.style.cursor=next?(this.handles[next].userData.blocked?'not-allowed':'ew-resize'):'';
    }
    if(next)this.canvas.style.cursor=this.handles[next].userData.blocked?'not-allowed':'ew-resize';
  }

  handlePointerUp(event){
    if(!this.drag||event.pointerId!==this.drag.pointerId)return;
    event.preventDefault();event.stopPropagation();
    this.commitDrag();
  }

  handleDoubleClick(event){
    const handle=this.pickHandle(event);
    if(!handle)return;
    event.preventDefault();event.stopPropagation();
    const mesh=this.selectedMesh();
    if(!mesh)return;
    const end=handle.userData.gripEnd;
    if(this.isEndDrivenByConstraint(mesh.userData.part.id,end)){
      this.emitState({active:false,blocked:true,end,message:`${end==='START'?'A':'B'}端已有连接/约束，不能直接拉伸`});
      return;
    }
    this.onEditRequested?.({partId:mesh.userData.part.id,end});
  }

  beginProgrammatic(mesh,end){
    mesh.updateMatrixWorld(true);
    const part=mesh.userData.part;normalizeProfilePath(part);
    const endpoints=getLocalEndpoints(part);
    const start=mesh.localToWorld(new THREE.Vector3(...endpoints.start));
    const finish=mesh.localToWorld(new THREE.Vector3(...endpoints.end));
    const worldAxis=finish.clone().sub(start).normalize();
    this.drag={pointerId:null,mesh,end,partId:part.id,oldLength:Number(part.dimensions.length),originalPosition:mesh.position.clone(),originalQuaternion:mesh.quaternion.clone(),originalPath:structuredClone(part.profilePath),originalMachining:structuredClone(part.machiningItems||[]),fixedPoint:(end==='END'?start:finish).clone(),dragAxis:worldAxis.clone().multiplyScalar(end==='END'?1:-1),worldAxis,currentLength:Number(part.dimensions.length),snappedFeature:null};
    this.typedBuffer='';
    this.sceneManager.transformControls.detach();
    this.sceneManager.orbitControls.enabled=false;
  }

  handleKeyDown(event){
    if(!this.drag)return;
    if(event.key==='Escape'){
      event.preventDefault();this.cancelDrag();return;
    }
    if(event.key==='Enter'){
      if(this.typedBuffer){
        const value=Number(this.typedBuffer);
        if(Number.isFinite(value)&&value>=this.options.minLengthMm)this.applyCandidateLength(value,{allowFeatureSnap:false,gridSnap:false});
      }
      event.preventDefault();this.commitDrag();return;
    }
    if(event.key==='Backspace'){
      event.preventDefault();this.typedBuffer=this.typedBuffer.slice(0,-1);this.applyTypedBuffer();return;
    }
    if(/^[0-9.]$/.test(event.key)){
      if(event.key==='.'&&this.typedBuffer.includes('.'))return;
      event.preventDefault();this.typedBuffer+=event.key;this.applyTypedBuffer();
    }
  }

  applyTypedBuffer(){
    const value=Number(this.typedBuffer);
    if(Number.isFinite(value)&&value>=this.options.minLengthMm)this.applyCandidateLength(value,{allowFeatureSnap:false,gridSnap:false});
    else this.emitDragState();
  }

  pointOnDragPlane(event,drag){
    const cameraDirection=this.sceneManager.camera.getWorldDirection(new THREE.Vector3()).normalize();
    let normal=cameraDirection.clone().addScaledVector(drag.dragAxis,-cameraDirection.dot(drag.dragAxis));
    if(normal.lengthSq()<1e-8){
      const seed=Math.abs(drag.dragAxis.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
      normal=new THREE.Vector3().crossVectors(drag.dragAxis,seed).normalize();
    }else normal.normalize();
    return this.sceneManager.worldPointOnPlane(event,normal,drag.fixedPoint);
  }

  applyCandidateLength(inputLength,options={}){
    const drag=this.drag;if(!drag)return;
    let length=clampGripLength(inputLength,this.options.minLengthMm);
    let snappedFeature=null;
    const gridSnap=options.gridSnap!==false&&this.options.gridSnap===true&&!this.typedBuffer;
    if(gridSnap){
      const step=Math.max(.1,Number(this.options.gridStepMm)||10);
      length=Math.max(this.options.minLengthMm,Math.round(length/step)*step);
    }
    if(options.allowFeatureSnap!==false&&this.options.featureSnap===true&&!this.typedBuffer){
      const rawEnd=drag.fixedPoint.clone().addScaledVector(drag.dragAxis,length);
      const feature=this.editor.snapManager.findFeatureNearWorldPoint(rawEnd,{maxDistanceMm:Number(this.options.featureSnapDistanceMm||28),excludePartId:drag.partId});
      if(feature?.worldPoint){
        const vector=feature.worldPoint.clone().sub(drag.fixedPoint);
        const along=vector.dot(drag.dragAxis);
        const radial=vector.clone().addScaledVector(drag.dragAxis,-along).length();
        if(along>=this.options.minLengthMm&&radial<=Number(this.options.axisSnapToleranceMm||3)){
          length=along;snappedFeature=feature;
          this.sceneManager.showSnapPoint(feature.worldPoint);
        }
      }
    }
    drag.snappedFeature=snappedFeature;
    drag.currentLength=length;
    this.applyLengthGeometry(drag,length);
    this.emitDragState();
  }

  applyLengthGeometry(drag,newLength){
    const mesh=drag.mesh,part=mesh.userData.part;
    part.profilePath={...structuredClone(drag.originalPath),type:'LINE',length:Number(newLength)};
    part.dimensions.length=Number(newLength);
    part.machiningItems=remapMachiningStations(drag.originalMachining,drag.oldLength,newLength);
    const centerWorld=drag.fixedPoint.clone().addScaledVector(drag.dragAxis,newLength/2);
    const centerLocal=centerWorld.clone();
    if(mesh.parent){mesh.parent.updateMatrixWorld(true);mesh.parent.worldToLocal(centerLocal);}
    mesh.position.copy(centerLocal);
    mesh.quaternion.copy(drag.originalQuaternion);
    mesh.updateMatrixWorld(true);
    this.editor.syncPartFromMesh(mesh);
    this.editor.rebuildLinearProfileVisual(mesh);
    this.editor.accessoryMountManager?.refreshForTargets([drag.partId]);
    this.editor.updateDimensions();
    this.editor.annotationManager?.requestRefresh();
    this.editor.sceneManager.refreshSelection();
    this.refresh(true);
  }


  commitDrag(){
    const drag=this.drag;if(!drag)return;
    const mesh=drag.mesh;
    try{if(drag.pointerId!==null)this.canvas.releasePointerCapture(drag.pointerId);}catch(_){/* no-op */}
    this.drag=null;this.typedBuffer='';
    this.sceneManager.orbitControls.enabled=!this.sceneManager.marqueeMode;
    this.editor.syncPartFromMesh(mesh);
    if(drag.snappedFeature){
      const feature=drag.snappedFeature;
      mesh.userData.lastSnap={
        type:feature.type==='PROFILE_SLOT'?'END_TO_SLOT':feature.type==='PROFILE_FACE'?'END_TO_FACE':'END_TO_END',
        targetProfileId:feature.partId,
        sourceEnd:drag.end,
        targetFace:feature.face||null,
        targetEnd:feature.end||null,
        slot:feature.type==='PROFILE_SLOT'?'CENTER':null,
        slotId:feature.slotId||null,
        distance:0,
        fromProfileGrip:true
      };
      if(this.editor.onSnapChanged)this.editor.onSnapChanged(mesh.userData.lastSnap);
    }else mesh.userData.lastSnap=null;
    const constrained=this.editor.constraintManager.solveForChangedParts([drag.partId]);
    this.editor.accessoryMountManager?.refreshForTargets([drag.partId,...constrained]);
    for(const partId of new Set([drag.partId,...constrained])){
      const changed=this.editor.getMeshByPartId(partId);
      if(changed?.userData?.part?.type==='PROFILE')this.editor.connectionManager.updateConnectionsForProfile(partId);
    }
    let autoConnectionResult=null;
    if(this.editor.autoConnectionEnabled && mesh.userData.lastSnap?.targetFace){
      autoConnectionResult=this.editor.autoConnectionResolver.connectFromSnap(mesh,{source:'PROFILE_GRIP'});
    }
    this.editor.machiningManager.refreshProfile(mesh);
    this.editor.updateDimensions();this.editor.emitStats();
    this.editor.historyManager.capture();this.editor.emitProjectChanged();
    if(autoConnectionResult?.status==='CREATED'&&this.editor.onAutoConnectionChanged)this.editor.onAutoConnectionChanged(autoConnectionResult);
    if(this.editor.isMeshTransformable(mesh))this.sceneManager.transformControls.attach(mesh);
    this.sceneManager.setSelections(this.editor.selectedMeshes,this.editor.selected);
    this.sceneManager.snapMarker.visible=false;
    if(this.editor.onSelectionChanged)this.editor.onSelectionChanged(this.editor.selected,[...this.editor.selectedMeshes]);
    this.emitState({active:false,committed:true,end:drag.end,lengthMm:Number(mesh.userData.part.dimensions.length),snappedFeature:drag.snappedFeature?this.publicFeature(drag.snappedFeature):null});
    this.refresh(true);
  }

  cancelDrag(){
    const drag=this.drag;if(!drag)return;
    const mesh=drag.mesh,part=mesh.userData.part;
    try{if(drag.pointerId!==null)this.canvas.releasePointerCapture(drag.pointerId);}catch(_){/* no-op */}
    part.profilePath=structuredClone(drag.originalPath);part.dimensions.length=drag.oldLength;part.machiningItems=structuredClone(drag.originalMachining);
    mesh.position.copy(drag.originalPosition);mesh.quaternion.copy(drag.originalQuaternion);mesh.updateMatrixWorld(true);
    this.editor.syncPartFromMesh(mesh);this.editor.rebuildLinearProfileVisual(mesh);
    this.editor.accessoryMountManager?.refreshForTargets([drag.partId]);
    this.drag=null;this.typedBuffer='';this.sceneManager.orbitControls.enabled=!this.sceneManager.marqueeMode;
    if(this.editor.isMeshTransformable(mesh))this.sceneManager.transformControls.attach(mesh);
    this.editor.updateDimensions();this.editor.annotationManager?.requestRefresh();this.sceneManager.snapMarker.visible=false;
    this.emitState({active:false,cancelled:true});this.refresh(true);
  }

  isEndDrivenByConstraint(partId,end){
    const constrained=(this.editor.constraintManager?.constraints||[]).some(c=>{
      if(c?.enabled===false||c?.suppressed===true||c?.sourcePartId!==partId)return false;
      const feature=c.semantic?.sourceFeature;
      if(feature?.type==='PROFILE_END')return feature.end===end;
      if(c.sourceAnchor?.end)return c.sourceAnchor.end===end;
      return false;
    });
    if(constrained)return true;
    return (this.editor.connectionManager?.connections||[]).some(connection=>connection?.sourceProfileId===partId&&connection?.sourceEnd===end);
  }

  emitDragState(){
    const drag=this.drag;if(!drag)return;
    this.emitState({active:true,end:drag.end,lengthMm:drag.currentLength,typed:this.typedBuffer,snappedFeature:drag.snappedFeature?this.publicFeature(drag.snappedFeature):null,message:this.typedBuffer?'Enter 确认 · Esc 取消':'拖动改变长度 · 可直接键入精确长度 · Enter 确认 · Esc 取消'});
  }

  publicFeature(feature){return {type:feature.type,kind:feature.kind,partId:feature.partId,end:feature.end||null,face:feature.face||null,slotId:feature.slotId||null,label:featureLabel(feature)};}
  emitState(state){if(this.onStateChanged)this.onStateChanged(state||{});}
}

function round(value,digits=3){const f=10**digits;return Math.round(Number(value)*f)/f;}
