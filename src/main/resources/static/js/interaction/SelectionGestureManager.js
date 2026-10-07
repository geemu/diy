import * as THREE from 'three';

/** 鼠标直接移动 / 修饰键拖拽复制；使用原 TransformControls 事务，不另存场景事实。 */
export default class SelectionGestureManager {
  constructor(editor){
    this.editor=editor;this.drag=null;this.space=false;
    this.canvas=editor.sceneManager.renderer.domElement;
    this.down=event=>this.pointerDown(event);this.move=event=>this.pointerMove(event);this.up=event=>this.pointerUp(event);
    this.cancel=()=>this.cancelDrag();this.blur=()=>{this.cancelDrag();this.setSpace(false);};
    this.canvas.addEventListener('pointerdown',this.down,true);
    this.canvas.addEventListener('pointermove',this.move,true);
    this.canvas.addEventListener('pointerup',this.up,true);
    this.canvas.addEventListener('pointercancel',this.cancel,true);
    window.addEventListener('blur',this.blur);
  }
  available(){const e=this.editor;return !e.wholeStretchManager.isActive()&&!e.profileDrawTool.isActive()&&!e.profilePlacementManager.isActive()&&!e.connectionPlacementManager.isActive()&&!e.accessoryPlacementManager.isActive()&&!e.machiningPlacementManager.isActive()&&!e.measureMode&&!e.dimensionMode&&!e.featureSelectionManager.enabled&&!e.profileGripEditor.drag&&!e.sceneManager.lassoMode;}
  setSpace(enabled){
    if(enabled&&!this.available())return false;
    if(this.space===enabled)return true;
    if(enabled)this.previousMarquee=this.editor.sceneManager.marqueeMode;
    this.space=enabled;
    if(enabled)this.editor.setMarqueeMode(true);
    else if(!this.editor.sceneManager.marqueeStart)this.editor.setMarqueeMode(this.previousMarquee===true);
    return true;
  }
  pointerDown(event){
    const e=this.editor,s=e.sceneManager,controls=s.transformControls;
    const copy=event.ctrlKey||event.metaKey||event.altKey;
    if(event.button!==0||!this.available()||this.space||s.marqueeMode||controls.mode!=='translate'||controls.dragging||(!copy&&controls.axis)||event.shiftKey)return;
    const hit=s.pickHit(event,e.selectableMeshes());
    if(!hit?.object||!e.isMeshTransformable(hit.object))return;
    if(!copy&&!e.selectedMeshes.includes(hit.object))return;
    event.preventDefault();event.stopImmediatePropagation();
    this.canvas.setPointerCapture(event.pointerId);
    // 点击不产生副本和历史；越过阈值后才启动事务。
    this.drag={pointerId:event.pointerId,down:{clientX:event.clientX,clientY:event.clientY},hit:hit.object,copy,started:false,point:hit.point.clone(),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(s.camera.getWorldDirection(new THREE.Vector3()),hit.point)};
    s.orbitControls.enabled=false;controls.enabled=false;controls.axis=null;e.axisClearanceManager.hide();s.pointerDownPosition=null;
  }
  pointerMove(event){
    const drag=this.drag;if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!drag.started&&Math.hypot(event.clientX-drag.down.clientX,event.clientY-drag.down.clientY)<=4)return;
    const e=this.editor,s=e.sceneManager;
    if(!drag.started){
      drag.originalSelection=e.selectedMeshes.map(mesh=>mesh.userData.part.id);
      drag.before=e.exportProject();
      if(!e.selectedMeshes.includes(drag.hit))e.select(drag.hit);
      if(drag.copy)e.copySelectedForDrag();
      s.transformControls.dispatchEvent({type:'mouseDown'});drag.started=true;
    }
    const point=s.worldPointOnPlane(event,drag.plane.normal,drag.point);if(!point)return;
    const delta=point.sub(drag.point),step=e.movementStepMm;
    if(step>0){delta.x=Math.round(delta.x/step)*step;delta.y=Math.round(delta.y/step)*step;delta.z=Math.round(delta.z/step)*step;}
    e.selected.position.copy(e.transformSelectionSnapshot.primaryPosition).add(delta);e.selected.updateMatrixWorld(true);
    s.transformControls.dispatchEvent({type:'objectChange'});
  }
  pointerUp(event){
    const drag=this.drag;
    if(!drag){if(!this.space&&this.editor.sceneManager.marqueeStart)setTimeout(()=>{if(!this.space&&!this.editor.sceneManager.marqueeStart)this.editor.setMarqueeMode(this.previousMarquee===true);},0);return;}
    if(event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    this.release();
    if(drag.started)this.editor.sceneManager.transformControls.dispatchEvent({type:'mouseUp'});
    else this.editor.sceneManager.clickHandler?.(event);
  }
  cancelDrag(){
    const drag=this.drag;if(!drag){if(this.editor.sceneManager.marqueeStart){this.reset();return true;}return false;}this.release();
    if(drag.started){
      this.editor.transformSelectionSnapshot=null;
      this.editor.restoreProject(drag.before);
      this.editor.selectMany(drag.originalSelection.map(id=>this.editor.getMeshByPartId(id)).filter(Boolean));
      this.editor.sceneManager.hideTransformFeedback?.();
    }
    return true;
  }
  release(){
    const drag=this.drag;this.drag=null;
    if(drag&&this.canvas.hasPointerCapture(drag.pointerId))this.canvas.releasePointerCapture(drag.pointerId);
    const s=this.editor.sceneManager;s.transformControls.enabled=true;s.orbitControls.enabled=!s.marqueeMode&&!s.lassoMode;s.pointerDownPosition=null;
  }
  reset(){this.release();this.editor.sceneManager.cancelMarquee();this.setSpace(false);}
  dispose(){this.reset();this.canvas.removeEventListener('pointerdown',this.down,true);this.canvas.removeEventListener('pointermove',this.move,true);this.canvas.removeEventListener('pointerup',this.up,true);this.canvas.removeEventListener('pointercancel',this.cancel,true);window.removeEventListener('blur',this.blur);}
}
