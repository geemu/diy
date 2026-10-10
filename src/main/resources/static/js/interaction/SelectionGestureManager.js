import * as THREE from 'three';

/** Shift 临时追加框选 / 直接移动 / 拖拽复制；只调度原选择与 TransformControls 事务。 */
export default class SelectionGestureManager {
  constructor(editor){
    this.editor=editor;this.drag=null;this.marqueeGesture=null;this.space=false;this.restoreSpaceMarquee=false;
    this.canvas=editor.sceneManager.renderer.domElement;
    this.down=event=>this.pointerDown(event);this.move=event=>this.pointerMove(event);this.up=event=>this.pointerUp(event);
    this.cancel=()=>this.cancelDrag();this.blur=()=>{this.cancelDrag();this.setSpace(false);};
    this.lostCapture=event=>{if(this.drag?.pointerId===event.pointerId||this.marqueeGesture?.pointerId===event.pointerId)this.cancelDrag();};
    this.canvas.addEventListener('pointerdown',this.down,true);
    this.canvas.addEventListener('pointermove',this.move,true);
    this.canvas.addEventListener('pointerup',this.up,true);
    this.canvas.addEventListener('pointercancel',this.cancel,true);
    this.canvas.addEventListener('lostpointercapture',this.lostCapture,true);
    window.addEventListener('blur',this.blur);
  }
  available(){const e=this.editor;return !e.isBuilderReviewActive?.()&&!e.wholeStretchManager.isActive()&&!e.profileDrawTool.isActive()&&!e.profilePlacementManager.isActive()&&!e.connectionPlacementManager.isActive()&&!e.accessoryPlacementManager.isActive()&&!e.machiningPlacementManager.isActive()&&!e.measureMode&&!e.dimensionMode&&!e.featureSelectionManager.enabled&&!e.profileGripEditor.drag&&!e.contourFrameManager?.active&&!e.sceneManager.lassoMode;}
  setSpace(enabled){
    if(enabled&&(!this.available()||this.marqueeGesture||this.drag||this.editor.sceneManager.transformControls.dragging))return false;
    if(this.space===enabled)return true;
    if(enabled&&!this.restoreSpaceMarquee)this.previousMarquee=this.editor.sceneManager.marqueeMode;
    if(enabled)this.restoreSpaceMarquee=false;
    this.space=enabled;
    if(enabled)this.editor.setMarqueeMode(true);
    else if(this.editor.sceneManager.marqueeStart)this.restoreSpaceMarquee=true;
    else this.restoreSpaceMode();
    return true;
  }
  restoreSpaceMode(){this.editor.setMarqueeMode(this.previousMarquee===true);this.previousMarquee=undefined;this.restoreSpaceMarquee=false;}
  pointerDown(event){
    const e=this.editor,s=e.sceneManager,controls=s.transformControls;
    const copy=event.ctrlKey||event.metaKey||event.altKey;
    if(event.button!==0||!this.available()||this.drag||this.marqueeGesture||controls.dragging)return;
    // Shift 在按下时决定本次手势；从型材或空白起拖都不交给相机、端点或移动 Gizmo。
    if(event.shiftKey&&!this.space&&!s.marqueeMode){this.beginShiftMarquee(event);return;}
    if(this.space||s.marqueeMode||controls.mode!=='translate'||(!copy&&controls.axis)||event.shiftKey)return;
    const hit=e.pickInteractionHit(event);
    if(e.connectionForMesh(hit?.object))return;
    if(!hit?.object||!e.isMeshTransformable(hit.object))return;
    if(!copy&&!e.selectedMeshes.includes(hit.object))return;
    if(e.selectedMeshes.includes(hit.object)&&!e.isSelectionTransformable())return;
    event.preventDefault();event.stopImmediatePropagation();
    this.canvas.setPointerCapture(event.pointerId);
    // 点击不产生副本和历史；越过阈值后才启动事务。
    this.drag={pointerId:event.pointerId,down:{clientX:event.clientX,clientY:event.clientY},hit:hit.object,copy,started:false,point:hit.point.clone(),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(s.camera.getWorldDirection(new THREE.Vector3()),hit.point)};
    s.orbitControls.enabled=false;controls.enabled=false;controls.axis=null;e.axisClearanceManager.hide();s.pointerDownPosition=null;
  }
  beginShiftMarquee(event){
    const e=this.editor,s=e.sceneManager;
    event.preventDefault();event.stopImmediatePropagation();
    this.marqueeGesture={pointerId:event.pointerId,ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,transformEnabled:s.transformControls.enabled,orbitEnabled:s.orbitControls.enabled};
    this.canvas.setPointerCapture(event.pointerId);
    s.cameraTween=null;s.pointerDownPosition=null;s.transformControls.enabled=false;s.transformControls.axis=null;
    e.axisClearanceManager.hide();e.featureHoverManager.clear();s.clearHover();
    e.setMarqueeMode(true);s.beginMarquee(event);
  }
  finishShiftMarquee(){
    const gesture=this.marqueeGesture;if(!gesture)return;
    this.marqueeGesture=null;
    const e=this.editor,s=e.sceneManager;
    s.cancelMarquee();e.setMarqueeMode(false);s.pointerDownPosition=null;
    s.transformControls.enabled=gesture.transformEnabled;
    s.orbitControls.enabled=gesture.orbitEnabled&&!s.marqueeMode&&!s.lassoMode;
    if(this.canvas.hasPointerCapture(gesture.pointerId))this.canvas.releasePointerCapture(gesture.pointerId);
    e.profileGripEditor.refresh(true);
  }
  pointerMove(event){
    if(this.marqueeGesture){
      if(event.pointerId!==this.marqueeGesture.pointerId)return;
      event.preventDefault();event.stopImmediatePropagation();this.editor.sceneManager.updateMarquee(event);return;
    }
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
    const gesture=this.marqueeGesture;
    if(gesture){
      if(event.pointerId!==gesture.pointerId||event.button!==0)return;
      event.preventDefault();event.stopImmediatePropagation();
      // 松手前放开 Shift 也保持按下时的追加语义；小于框选阈值仍走原单击选择。
      try{this.editor.sceneManager.endMarquee({clientX:event.clientX,clientY:event.clientY,button:0,shiftKey:true,ctrlKey:gesture.ctrlKey,metaKey:gesture.metaKey,altKey:gesture.altKey});}
      finally{this.finishShiftMarquee();}
      return;
    }
    const drag=this.drag;
    if(!drag){if(this.restoreSpaceMarquee&&this.editor.sceneManager.marqueeStart)setTimeout(()=>{if(this.restoreSpaceMarquee&&!this.space&&!this.editor.sceneManager.marqueeStart)this.restoreSpaceMode();},0);return;}
    if(event.pointerId!==drag.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    this.release();
    if(drag.started)this.editor.sceneManager.transformControls.dispatchEvent({type:'mouseUp'});
    else this.editor.sceneManager.clickHandler?.(event);
  }
  cancelDrag(){
    if(this.marqueeGesture){this.finishShiftMarquee();return true;}
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
  reset(){this.finishShiftMarquee();this.release();this.editor.sceneManager.cancelMarquee();this.setSpace(false);if(this.restoreSpaceMarquee)this.restoreSpaceMode();}
  dispose(){this.reset();this.canvas.removeEventListener('pointerdown',this.down,true);this.canvas.removeEventListener('pointermove',this.move,true);this.canvas.removeEventListener('pointerup',this.up,true);this.canvas.removeEventListener('pointercancel',this.cancel,true);this.canvas.removeEventListener('lostpointercapture',this.lostCapture,true);window.removeEventListener('blur',this.blur);}
}
