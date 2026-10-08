import * as THREE from 'three';

/** 26 个独立拾取区域：6 面、12 边、8 角；方向与主场景的世界 XYZ 一致。 */
export const VIEW_DIRECTIONS = [];
for (let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++) {
  const count=Math.abs(x)+Math.abs(y)+Math.abs(z);
  if(!count)continue;
  VIEW_DIRECTIONS.push({x,y,z,kind:count===1?'面':count===2?'边':'角',label:[y>0?'上':y<0?'下':'',z>0?'前':z<0?'后':'',x>0?'右':x<0?'左':''].join('')});
}

export default class ViewCube {
  constructor(container,sceneManager,onSelect) {
    this.container=container;
    this.main=sceneManager;
    this.onSelect=onSelect;
    this.scene=new THREE.Scene();
    // 导航使用轻透视，让上前两个面呈现梯形透视；朝向仍逐帧严格跟随主相机。
    this.camera=new THREE.PerspectiveCamera(38,1,.1,30);
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.setSize(148,148);
    this.renderer.setClearColor(0x000000,0);
    // 真实受光的面产生明暗层次；不能为了露出第三个面而偷偷偏转主场景的上前视角。
    this.scene.add(new THREE.HemisphereLight(0xffffff,0xb4c1d2,1.35));
    const key=new THREE.DirectionalLight(0xffffff,1.6);
    key.position.set(-3,7,2);this.scene.add(key);
    this.renderer.domElement.setAttribute('aria-label','视角正方体：点击面、边或角切换视角，拖动旋转查看其他方向');
    container.appendChild(this.renderer.domElement);
    this.targets=[];
    this.textures=[];
    for(const direction of VIEW_DIRECTIONS) {
      const dimensions=[direction.x,direction.y,direction.z].map(value=>value===0?1.28:.34);
      const geometry=new THREE.BoxGeometry(...dimensions);
      const material=new THREE.MeshLambertMaterial({color:direction.kind==='面'?0xd9e3ee:0x8297af});
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(direction.x*.82,direction.y*.82,direction.z*.82);
      mesh.userData.direction=direction;
      mesh.userData.color=material.color.clone();
      this.targets.push(mesh);this.scene.add(mesh);
      if(direction.kind==='面')this.addLabel(direction);
    }
    // 外轮廓只用于展示，不进入 26 个射线目标，也不挡住面、边和角的拾取。
    const outlineSource=new THREE.BoxGeometry(1.986,1.986,1.986);
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(outlineSource),new THREE.LineBasicMaterial({color:0x61758e,transparent:true,opacity:.6}));
    outlineSource.dispose();this.scene.add(outline);
    this.raycaster=new THREE.Raycaster();
    this.pointer=new THREE.Vector2();
    this.hover=null;
    this.down=null;
    this.move=event=>this.handleMove(event);
    this.press=event=>{if(event.button!==0)return;this.down={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,dragged:false};container.setPointerCapture?.(event.pointerId);};
    this.release=event=>{
      if(!this.down)return;
      const dragged=this.down.dragged;this.down=null;
      if(!dragged){const hit=this.pick(event);if(hit)this.onSelect(new THREE.Vector3(hit.x,hit.y,hit.z));}
    };
    this.leave=()=>{if(!this.down)this.highlight(null);};
    this.cancel=()=>{this.down=null;this.highlight(null);};
    container.addEventListener('pointermove',this.move);
    container.addEventListener('pointerdown',this.press);
    container.addEventListener('pointerup',this.release);
    container.addEventListener('pointercancel',this.cancel);
    container.addEventListener('pointerleave',this.leave);
    this.frame=()=>{this.update();this.frameId=requestAnimationFrame(this.frame);};
    this.frame();
  }

  addLabel(direction) {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const context=canvas.getContext('2d');context.font='bold 62px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillStyle='#25384f';context.fillText(direction.label,64,67);
    const texture=new THREE.CanvasTexture(canvas);this.textures.push(texture);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.66,.66),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    const normal=new THREE.Vector3(direction.x,direction.y,direction.z);
    mesh.position.copy(normal).multiplyScalar(1.001);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    this.scene.add(mesh);
  }

  update() {
    const vector=this.main.camera.position.clone().sub(this.main.orbitControls.target).normalize();
    this.camera.position.copy(vector).multiplyScalar(6);
    this.camera.up.copy(this.main.camera.up);
    this.camera.lookAt(0,0,0);
    this.camera.updateMatrixWorld(true);
    this.renderer.render(this.scene,this.camera);
  }

  pick(event) {
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.raycaster.intersectObjects(this.targets,false)[0]?.object.userData.direction||null;
  }

  highlight(direction) {
    this.hover=direction;
    for(const mesh of this.targets)mesh.material.color.copy(mesh.userData.direction===direction?new THREE.Color(0xffa34b):mesh.userData.color);
    this.container.title=direction?`${direction.label}视角 · ${direction.kind}`:'拖动正方体查看其他面；点击面、边或角切换视角';
    this.container.style.cursor=direction?'pointer':'grab';
  }

  handleMove(event) {
    if(this.down) {
      const dx=event.clientX-this.down.lastX,dy=event.clientY-this.down.lastY;
      if(Math.hypot(event.clientX-this.down.x,event.clientY-this.down.y)>4)this.down.dragged=true;
      this.down.lastX=event.clientX;this.down.lastY=event.clientY;
      if(this.down.dragged) {
        this.main.cameraTween=null;
        const offset=this.main.camera.position.clone().sub(this.main.orbitControls.target);
        const spherical=new THREE.Spherical().setFromVector3(offset);
        // 拖动的是眼前的正方体：面上的点应沿鼠标方向移动，相机绕目标朝相反方向运动。
        // 屏幕 Y 向下为正，而球坐标 phi 增大是相机向下；此处需减去 dy，不能加。
        spherical.theta-=dx*.012;spherical.phi=Math.max(.001,Math.min(Math.PI-.001,spherical.phi-dy*.012));
        this.main.camera.position.copy(this.main.orbitControls.target).add(new THREE.Vector3().setFromSpherical(spherical));
        this.main.orbitControls.update();
        this.highlight(null);
        return;
      }
    }
    this.highlight(this.pick(event));
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.container.removeEventListener('pointermove',this.move);this.container.removeEventListener('pointerdown',this.press);this.container.removeEventListener('pointerup',this.release);this.container.removeEventListener('pointerleave',this.leave);this.container.removeEventListener('pointercancel',this.cancel);
    this.scene.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
    this.textures.forEach(texture=>texture.dispose());this.renderer.dispose();this.renderer.domElement.remove();
  }
}
