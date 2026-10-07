import * as THREE from 'three';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import {getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';
import {profileQuaternion,workPlaneNormal} from '../geometry/ProfileOrientation.js';

/** 固定长度型材预放置。预览不进入工程，正式落位仍由 Editor / Snap / Connection 提交。 */
export default class ProfilePlacementManager {
  constructor(editor){this.editor=editor;this.ghost=null;this.options=null;this.orientation=0;this.event=null;this.onChanged=null;}
  isActive(){return !!this.ghost;}
  begin(catalogId,length,options={}){
    const definition=getDesignProfileDefinition(catalogId);
    if(!definition)throw new Error('未知型材');
    if(!Number.isFinite(Number(length))||Number(length)<10)throw new Error('长度必须至少为 10 mm');
    this.cancel();
    this.options={catalogId,length:Number(length),faceClosures:[...(options.faceClosures||definition.defaultFaceClosures||[])]};
    const part={id:'__profile_placement__',type:'PROFILE',name:definition.name,color:'#d9d9d9',position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},dimensions:{length:Number(length),sectionSize:[...definition.sectionSize]},designProfile:{profileId:definition.id,faceClosures:this.options.faceClosures},profilePath:{type:'LINE',length:Number(length)}};
    this.ghost=ProfileGeometryFactory.create(part);this.ghost.name='__profile_placement__';this.ghost.visible=false;
    this.ghost.traverse(child=>{if(child.material){child.material.transparent=true;child.material.opacity=.65;child.material.depthWrite=false;}});
    this.editor.sceneManager.scene.add(this.ghost);
    this.orientation=0;this.editor.sceneManager.transformControls.detach();this.editor.profileGripEditor.refresh(true);this.emit();
  }
  cycle(direction=1){if(!this.ghost)return;this.orientation=(this.orientation+(direction<0?2:1))%3;this.editor.snapManager.clearLock();if(this.event)this.handlePointerMove(this.event);else this.emit();}
  handlePointerMove(event){
    if(!this.ghost)return false;this.event={clientX:event.clientX,clientY:event.clientY};
    const scene=this.editor.sceneManager,plane=this.editor.workPlaneVisualizer?.plane||'XZ';
    const normal=workPlaneNormal(plane),hit=scene.pickHit(event,this.editor.selectableMeshes());
    const point=hit?.object?hit.point.clone():scene.worldPointOnPlane(event,normal);
    if(!point){this.ghost.visible=false;return true;}
    const directions=[new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0)];
    this.ghost.quaternion.copy(profileQuaternion(directions[this.orientation]));this.ghost.position.set(0,0,0);this.ghost.updateMatrixWorld(true);
    if(!hit?.object){const box=new THREE.Box3().setFromObject(this.ghost);const axis=plane==='XZ'?'y':plane==='XY'?'z':'x';point[axis]-=box.min[axis];}
    this.ghost.position.copy(point);this.ghost.visible=true;this.ghost.updateMatrixWorld(true);
    const snap=this.editor.snapManager.snap(this.ghost);
    this.editor.snapManager.preview(this.ghost);
    const collision=this.editor.snapManager.candidateCollision(this.ghost,{delta:new THREE.Vector3()});
    this.ghost.traverse(child=>{if(child.isMesh)child.material.color.set(collision?'#e54848':'#d9d9d9');});
    this.emit(collision?.message||null,snap);return true;
  }
  handleClick(event){
    if(!this.ghost)return false;this.handlePointerMove(event);if(!this.ghost.visible)return true;
    const mesh=this.ghost,position=mesh.position,rotation=mesh.rotation;
    // 重查正式几何，允许干涉落位但不能伪造吸附/自动连接成功。
    const result=this.editor.placeProfileWithSnap(this.options.catalogId,this.options.length,{faceClosures:this.options.faceClosures,position:{x:position.x,y:position.y,z:position.z},rotation:{x:rotation.x,y:rotation.y,z:rotation.z}});
    this.editor.interferenceFeedbackManager.requestRefresh();this.editor.sceneManager.transformControls.detach();this.editor.profileGripEditor.refresh(true);
    this.editor.snapManager.clearLock();this.emit('已添加型材；继续点击添加，Esc 退出');return result;
  }
  cancel(){
    if(!this.ghost)return;this.editor.sceneManager.scene.remove(this.ghost);ProfileGeometryFactory.disposeObject(this.ghost);
    this.ghost=null;this.options=null;this.event=null;this.editor.snapManager.clearLock();this.editor.sceneManager.clearSnapPreview();this.editor.sceneManager.hideSnapFeedback?.();
    if(this.editor.isMeshTransformable(this.editor.selected))this.editor.sceneManager.transformControls.attach(this.editor.selected);
    this.editor.profileGripEditor.refresh(true);this.emit();
  }
  emit(message=null,snap=null){this.onChanged?.({active:this.isActive(),orientation:['Z','X','Y'][this.orientation],message:message||'点击画布添加型材 · Tab 切换方向 · Esc 退出',snap});}
}
