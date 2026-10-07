import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {getLocalEndpoints,isLinearProfile} from '../model/ProfilePath.js';
import {profileQuaternion} from '../geometry/ProfileOrientation.js';

/** 区域整体拉伸：先圈定端点区域，再移动区域；截面从不使用 scale 变形。 */
export default class WholeStretchManager {
  constructor(editor){
    this.editor=editor;this.active=false;this.phase='RANGE';this.onChanged=null;
    const scene=editor.sceneManager;
    this.proxy=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x2f9bbd,transparent:true,opacity:.08,depthWrite:false}));
    this.proxy.name='__whole_stretch_range__';this.proxy.visible=false;scene.scene.add(this.proxy);
    this.outline=new THREE.BoxHelper(this.proxy,0x2f9bbd);this.outline.visible=false;scene.scene.add(this.outline);
    this.controls=new TransformControls(scene.camera,scene.renderer.domElement);this.controls.enabled=false;this.controls.setSize(.65);scene.scene.add(this.controls);
    this.controls.addEventListener('dragging-changed',event=>{scene.orbitControls.enabled=!event.value;});
    this.controls.addEventListener('mouseDown',()=>{if(this.phase==='MOVE'){this.before=editor.exportProject();this.origin=this.proxy.position.clone();this.originals=this.ids.map(id=>{const mesh=editor.getMeshByPartId(id);return {mesh,part:structuredClone(mesh.userData.part),position:mesh.position.clone(),quaternion:mesh.quaternion.clone()};});}});
    this.controls.addEventListener('objectChange',()=>{this.outline.update();if(this.phase==='MOVE'){try{this.preview();}catch(error){this.failure=error.message;}}this.emit();});
    this.controls.addEventListener('mouseUp',()=>{if(this.phase==='MOVE')this.commit();else this.emit();});
  }
  isActive(){return this.active;}
  begin(){
    const e=this.editor,meshes=[...e.selectedMeshes];
    if(!meshes.length)throw new Error('先选择需要整体拉伸的构件');
    if(meshes.some(mesh=>!e.isMeshTransformable(mesh)))throw new Error('选择中有锁定/安装构件，请先解除');
    if(meshes.some(mesh=>mesh.userData.part.type==='PROFILE'&&!isLinearProfile(mesh.userData.part)))throw new Error('整体拉伸暂不支持弯型材，请先排除弯型材');
    if(meshes.some(mesh=>(mesh.userData.part.machiningItems||[]).length||e.constraintManager.listForPart(mesh.userData.part.id).some(c=>c.enabled&&!c.suppressed)))throw new Error('选择中有加工或有效约束，请先解除，避免改变基准');
    if(meshes.some(mesh=>e.assemblyManager.get(mesh.userData.part.assemblyId)?.parameters))throw new Error('参数化组件请使用对应的框架尺寸入口，以免原参数重建覆盖拉伸');
    this.cancel();this.ids=meshes.map(mesh=>mesh.userData.part.id);const box=new THREE.Box3();meshes.forEach(mesh=>box.union(new THREE.Box3().setFromObject(mesh)));
    this.proxy.position.copy(box.getCenter(new THREE.Vector3()));this.proxy.scale.copy(box.getSize(new THREE.Vector3())).max(new THREE.Vector3(1,1,1));this.proxy.updateMatrixWorld(true);
    this.active=true;this.phase='RANGE';this.proxy.visible=true;this.outline.visible=true;this.outline.update();this.controls.setTranslationSnap(e.movementStepMm||null);
    e.sceneManager.transformControls.detach();e.sceneManager.transformControls.enabled=false;this.controls.camera=e.sceneManager.camera;this.controls.setMode('scale');this.controls.enabled=true;this.controls.attach(this.proxy);e.profileGripEditor.refresh(true);this.emit();
  }
  setRangeMode(mode){if(this.active&&this.phase==='RANGE')this.controls.setMode(mode==='translate'?'translate':'scale');}
  confirm(){
    if(!this.active||this.phase!=='RANGE')return false;
    this.region=new THREE.Box3().setFromObject(this.proxy).expandByScalar(.01);this.phase='MOVE';this.controls.setMode('translate');this.emit();return true;
  }
  preview(){
    if(!this.before||!this.originals)return;
    this.failure=null;const e=this.editor,delta=this.proxy.position.clone().sub(this.origin);
    const plans=this.originals.map(row=>{
      const part=row.part;
      if(part.type!=='PROFILE')return {...row,position:row.position.clone().add(this.region.containsPoint(row.position)?delta:new THREE.Vector3()),quaternion:row.quaternion,length:null};
      const ends=getLocalEndpoints(part),a=new THREE.Vector3(...ends.start).applyQuaternion(row.quaternion).add(row.position),b=new THREE.Vector3(...ends.end).applyQuaternion(row.quaternion).add(row.position);
      if(this.region.containsPoint(a))a.add(delta);if(this.region.containsPoint(b))b.add(delta);
      const length=a.distanceTo(b);if(length<10)throw new Error('拉伸后型材长度不能小于 10 mm');
      const direction=b.clone().sub(a).normalize(),up=new THREE.Vector3(0,1,0).applyQuaternion(row.quaternion);
      return {...row,position:a.clone().add(b).multiplyScalar(.5),quaternion:profileQuaternion(direction,up),length};
    });
    for(const plan of plans){
      const mesh=plan.mesh;mesh.position.copy(plan.position);mesh.quaternion.copy(plan.quaternion);
      if(plan.length!==null&&Math.abs(mesh.userData.part.dimensions.length-plan.length)>1e-8){mesh.userData.part.dimensions.length=plan.length;mesh.userData.part.profilePath={type:'LINE',length:plan.length};e.rebuildLinearProfileVisual(mesh);}
      mesh.updateMatrixWorld(true);e.syncPartFromMesh(mesh);
    }
    e.accessoryMountManager.refreshForTargets(this.ids);e.updateDimensions();e.interferenceFeedbackManager.preview(this.ids);
  }
  commit(){
    if(!this.before)return;
    if(this.failure){const message=this.failure;this.restorePreview();this.editor.onInteractionError?.(message);return;}
    const e=this.editor;e.connectionManager.updateConnectionsForProfiles(this.ids);e.accessoryMountManager.refreshForTargets(this.ids);e.interferenceFeedbackManager.refresh({focusIds:new Set(this.ids),live:false});
    e.updateDimensions();e.emitStats();e.historyManager.capture();e.emitProjectChanged();e.onSelectionChanged?.(e.selected,[...e.selectedMeshes]);this.before=null;this.originals=null;this.region=new THREE.Box3().setFromObject(this.proxy).expandByScalar(.01);this.emit();
  }
  restorePreview(){
    if(!this.originals)return;
    const e=this.editor;for(const row of this.originals){Object.assign(row.mesh.userData.part,structuredClone(row.part));row.mesh.position.copy(row.position);row.mesh.quaternion.copy(row.quaternion);if(row.part.type==='PROFILE')e.rebuildLinearProfileVisual(row.mesh);row.mesh.updateMatrixWorld(true);}
    this.proxy.position.copy(this.origin);this.proxy.updateMatrixWorld(true);this.outline.update();this.before=null;this.originals=null;this.failure=null;e.accessoryMountManager.refreshForTargets(this.ids);e.updateDimensions();e.interferenceFeedbackManager.requestRefresh();
  }
  cancel(){
    if(!this.active)return;this.restorePreview();this.active=false;this.controls.dragging=false;this.controls.enabled=false;this.controls.detach();this.proxy.visible=false;this.outline.visible=false;
    const s=this.editor.sceneManager;s.transformControls.enabled=true;s.orbitControls.enabled=!s.marqueeMode&&!s.lassoMode;
    if(this.editor.isMeshTransformable(this.editor.selected))s.transformControls.attach(this.editor.selected);this.editor.profileGripEditor.refresh(true);this.emit();
  }
  emit(){this.onChanged?.({active:this.active,phase:this.phase,message:this.failure||(this.phase==='RANGE'?'拖动调整包围范围，Enter 确认；范围内端点随区域移动':'拖动箭头移动范围；一端在范围内拉长，两端在范围内整体移动；Esc 退出')});}
  dispose(){this.cancel();this.controls.dispose();const scene=this.editor.sceneManager.scene;scene.remove(this.controls,this.proxy,this.outline);this.proxy.geometry.dispose();this.proxy.material.dispose();this.outline.geometry.dispose();this.outline.material.dispose();}
}
