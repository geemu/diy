import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

/** 只改变平移手柄/拖动平面的显示锚点；始终控制真实本体，不更改原点或旋转中心。 */
export default class ClickAnchoredTransformControls extends TransformControls {
  constructor(camera,canvas){
    super(camera,canvas);
    this.clickAnchor=null;this.canShowAxisInput=null;this.onAxisInput=null;this.isTransforming=null;this.axisHintKey=null;
    this.axisHintElement=document.createElement('div');this.axisHintElement.className='translation-axis-hint-layer';this.axisHintElement.hidden=true;
    this.axisHintButton=document.createElement('button');this.axisHintButton.type='button';this.axisHintButton.className='translation-axis-hint';
    this.axisHintElement.append(this.axisHintButton);canvas.parentElement.append(this.axisHintElement);
    this.axisHintElement.addEventListener('pointerdown',event=>event.stopPropagation());
    this.axisHintElement.addEventListener('click',event=>{
      event.stopPropagation();
      if(this.axisHintElement.hidden||this.dragging||!this.canShowAxisInput?.())return;
      this.onAxisInput?.(this.axisHintButton.dataset.axis);
    });
    // 轴标记是普通按钮：Enter/Space 点击，Tab 原生导航，不传给临时框选/画布距离切换。
    this.axisHintButton.addEventListener('keydown',event=>{if(['Enter',' ','Tab'].includes(event.key))event.stopPropagation();});
  }

  attach(object){
    if(this.object!==object)this.clearClickAnchor();
    return super.attach(object);
  }
  detach(){this.clearClickAnchor();return super.detach();}
  clearClickAnchor(){this.clickAnchor=null;this.hideAxisHint();}
  hideAxisHint(){if(this.axisHintElement&&!this.axisHintElement.hidden)this.axisHintElement.hidden=true;}

  setClickAnchor(object,worldPoint){
    if(this.dragging||this.isTransforming?.()||this.object!==object||object?.userData.part?.type!=='PROFILE'||!worldPoint?.isVector3)return false;
    if(!worldPoint.toArray().every(Number.isFinite))return false;
    object.updateWorldMatrix(true,false);
    const point=object.worldToLocal(worldPoint.clone());
    if(!point.toArray().every(Number.isFinite))return false;
    this.clickAnchor={object,point,shape:shapeStamp(object)};
    this.axis=null;this.updateMatrixWorld(true);return true;
  }

  anchoredTranslation(){
    const anchor=this.clickAnchor;
    if(!anchor||this.mode!=='translate'||this.object!==anchor.object||!this.object.parent)return false;
    // 形状回改不把旧局部点当作永久面引用；本次真实拖动中绝不重新定位。
    if(!this.dragging&&!this.isTransforming?.()&&anchor.shape!==shapeStamp(this.object)){this.clearClickAnchor();return false;}
    return true;
  }

  updateMatrixWorld(force){
    // 先保留本地 Three 的父级/本体/相机、量化和全部非平移计算。
    super.updateMatrixWorld(force);
    if(this.anchoredTranslation()){
      this.worldPosition.copy(this.object.localToWorld(this.clickAnchor.point.clone()));
      if(!this.camera.isOrthographicCamera)this.eye.copy(this.cameraPosition).sub(this.worldPosition).normalize();
      // 共享 worldPosition 只重定位显示件、拾取件和拖动平面；object.position 未改。
      this._gizmo.updateMatrixWorld(force);this._plane.updateMatrixWorld(force);
    }
    this.updateAxisHint();
  }

  pointerDown(pointer){
    const wasDragging=this.dragging,anchored=this.anchoredTranslation();
    super.pointerDown(pointer);
    if(!wasDragging&&this.dragging&&anchored){
      const offset=this.object.localToWorld(this.clickAnchor.point.clone()).sub(this.worldPositionStart);
      // 原 pointStart/pointEnd 用本体原点；同量平移两者基准后，位移差与原算法完全一致。
      this.worldPositionStart.add(offset);this.pointStart.sub(offset);
    }
  }

  updateAxisHint(){
    const layer=this.axisHintElement;
    if(!layer?.isConnected)return;
    if(!this.visible||!this.enabled||this.mode!=='translate'||this.dragging||!this.canShowAxisInput?.()){
      this.hideAxisHint();return;
    }
    const object=this.object;
    if(!object||object.userData.part?.type!=='PROFILE'){this.hideAxisHint();return;}
    const projected=this.worldPosition.clone().project(this.camera),container=this.domElement.parentElement;
    const width=container.clientWidth,height=container.clientHeight;
    if(!projected.toArray().every(Number.isFinite)||projected.z< -1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1||width<64||height<64){this.hideAxisHint();return;}
    const rows=['X','Y','Z'].map((axis,index)=>{
      const direction=new THREE.Vector3().setComponent(index,1);
      if(this.space==='local')direction.applyQuaternion(this.worldQuaternion);
      return {axis,alignment:Math.abs(direction.dot(this.eye))};
    }).sort((a,b)=>b.alignment-a.alignment);
    const axis=rows[0].axis;
    if(rows[0].alignment<.95||!this['show'+axis]){this.hideAxisHint();return;}
    const button=this.axisHintButton,left=Math.max(4,Math.min(width-28,(projected.x+1)*width/2+16)),top=Math.max(4,Math.min(height-28,(1-projected.y)*height/2-30));
    const key=[axis,this.space,left,top].join(',');
    if(layer.hidden||key!==this.axisHintKey){
      button.dataset.axis=axis;button.textContent=axis;
      button.title=`${axis} 轴接近视线方向 · 点击输入带正负号的移动量（mm）`;
      button.setAttribute('aria-label',`${this.space==='local'?'局部':'世界'} ${axis} 轴移动距离`);
      button.style.left=left+'px';button.style.top=top+'px';this.axisHintKey=key;
    }
    layer.hidden=false;
  }

  disposeAnchorInput(){this.clearClickAnchor();this.canShowAxisInput=null;this.onAxisInput=null;this.isTransforming=null;this.axisHintElement.remove();}
  dispose(){this.disposeAnchorInput();super.dispose();}
}

function shapeStamp(object){
  const part=object.userData.part;
  return JSON.stringify([part.dimensions,part.profilePath,part.endCuts,part.designProfile]);
}
