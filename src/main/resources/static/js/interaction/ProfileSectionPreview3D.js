import * as THREE from 'three';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import {getSectionBounds} from '../model/ProfileSectionRegistry.js';
import {catalogPresentation} from './CatalogPresentation.js';

/**
 * Profile Catalog 2.0 截面 3D 预览。
 *
 * 预览只渲染当前 Section Model，不创建 Project Part，也不写入 Editor/Scene。这样可以保证型材目录编辑
 * 与工程业务模型完全隔离，避免预览对象进入撤销栈、BOM 或制造数据。
 */
export default class ProfileSectionPreview3D {
  constructor(canvas) {
    this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(32,1,0.1,5000);
    this.root=new THREE.Group();
    this.root.rotation.set(-0.48,0.62,-0.08);
    this.scene.add(this.root);
    this.hemisphere=new THREE.HemisphereLight(0xffffff,0x78828f,1.8);
    this.scene.add(this.hemisphere);
    const keyLight=new THREE.DirectionalLight(0xffffff,2.1);
    keyLight.position.set(2,3,4);
    this.scene.add(keyLight);
    const rimLight=new THREE.DirectionalLight(0xc6ddff,1.8);
    rimLight.position.set(-4,2,-3);
    this.scene.add(rimLight);
    this.keyLight=keyLight;
    this.rimLight=rimLight;
    this.mesh=null;
    this.resize();
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
  }

  setSection(section,options={}) {
    this.clearMesh();
    this.setLighting(true);
    this.camera.near=.1;
    this.camera.far=5000;
    this.camera.updateProjectionMatrix();
    if(!section?.outer?.length) {
      this.render();
      return;
    }
    const bounds=getSectionBounds(section);
    const span=Math.max(bounds.width,bounds.height,10);
    const material=new THREE.MeshLambertMaterial({color:0x808080,side:THREE.DoubleSide});
    const lengthRatio=Math.max(1,Number(options.lengthRatio)||1.5);
    const length=options.presentation==='catalog'?Number(options.lengthMm)||100:span*lengthRatio;
    this.mesh=ProfileGeometryFactory.createSectionMesh(section,length,material);
    this.mesh.userData.part={type:'PROFILE',dimensions:{length,profileId:options.profileId}};
    ProfileGeometryFactory.addCadEdges(this.mesh);
    this.root.add(this.mesh);
    if(options.presentation==='catalog') {
      // 目录卡须同时看到截面和长槽，避免相机沿挤出轴看成一小块端面。
      this.root.rotation.set(...catalogPresentation(this.mesh.userData.part).rotation);
      this.catalogObject=true;
      this.fitCatalogObject();
    } else {
      this.root.rotation.set(-0.48,0.62,-0.08);
      const fitScale=Math.max(1,lengthRatio/2.2);
      this.camera.position.set(span*2.6*fitScale,span*2.1*fitScale,span*3.4*fitScale);
    }
    this.camera.lookAt(0,0,0);
    this.render();
  }

  resize() {
    const width=Math.max(220,Math.round(this.canvas?.clientWidth||320));
    const height=Math.max(160,Math.round(this.canvas?.clientHeight||220));
    this.renderer.setSize(width,height,false);
    this.camera.aspect=width/height;
    this.camera.updateProjectionMatrix();
    if(this.catalogObject)this.fitCatalogObject();
    this.render();
  }

  /** 组件库复用工程几何工厂，但预览对象永远不进入 Editor/Project。 */
  setObject(object) {
    this.clearMesh();
    this.catalogObject=true;
    this.mesh=object;
    const style=catalogPresentation(object?.userData?.part);
    this.setLighting(true);
    // 哑光技术展示保留真实材料配色，不把强金属高光当成轮廓细节。
    const converted=new Map();
    object?.traverse(child=>{
      if(!child.isMesh||!child.material?.isMeshStandardMaterial)return;
      const previous=child.material;
      if(!converted.has(previous))converted.set(previous,new THREE.MeshLambertMaterial({color:previous.color,side:previous.side,transparent:previous.transparent,opacity:previous.opacity,vertexColors:previous.vertexColors}));
      child.material=converted.get(previous);
    });
    for(const material of converted.keys())material.dispose();
    object?.traverse(child=>{
      if(child.isMesh&&!child.material?.isMeshBasicMaterial)ProfileGeometryFactory.addCadEdges(child);
    });
    // 长条连接片在预览中横向呈现；这只是展示姿态，不修改构件参数或安装坐标。
    this.root.rotation.set(...style.rotation);
    this.keyLight.position.set(Math.sign(style.direction[0])*3,6,Math.sign(style.direction[2])*4);
    this.rimLight.position.set(-Math.sign(style.direction[0])*4,2,-Math.sign(style.direction[2])*3);
    // 板材正面保持参考页的蓝灰色，不因朝向背光变成深灰。
    if(object?.userData?.part?.type==='PANEL')this.keyLight.intensity=2.5;
    if(object)this.root.add(object);
    this.fitCatalogObject();
    this.render();
  }

  fitCatalogObject() {
    if(!this.mesh)return;
    this.mesh.position.set(0,0,0);
    this.root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(this.mesh);
    const center=box.getCenter(new THREE.Vector3());
    this.mesh.position.sub(this.root.worldToLocal(center.clone()));
    const radius=Math.max(1,box.getSize(new THREE.Vector3()).length()/2);
    const halfFov=THREE.MathUtils.degToRad(this.camera.fov/2);
    const style=catalogPresentation(this.mesh.userData?.part);
    const direction=new THREE.Vector3(...style.direction).normalize();
    // 小型夹具在出料口保留空白，不应与长型材一样撑满卡片；缩放只影响预览相机。
    const margin=style.margin;
    const right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right).normalize();
    const centered=box.clone().translate(center.clone().negate());
    // 按相机空间的八个边界点适配，长型材不再因包围球而缩成一小块。
    let distance=Math.max(radius*1.1,style.referenceSpan/2/Math.tan(halfFov)*margin);
    for(const x of [centered.min.x,centered.max.x])for(const y of [centered.min.y,centered.max.y])for(const z of [centered.min.z,centered.max.z]){
      const point=new THREE.Vector3(x,y,z),depth=point.dot(direction);
      distance=Math.max(distance,depth+Math.abs(point.dot(right))/Math.tan(halfFov)/this.camera.aspect*margin,depth+Math.abs(point.dot(up))/Math.tan(halfFov)*margin);
    }
    this.camera.position.copy(direction.multiplyScalar(distance));
    this.camera.near=Math.max(.1,distance-radius*2);
    this.camera.far=distance+radius*4;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0,0,0);
  }

  render() {
    this.renderer.render(this.scene,this.camera);
  }

  /** 灰色夹具用中性柔光，避免强金属高光把顶面照成白色；切回型材时恢复其原有灯光。 */
  setLighting(neutral) {
    this.hemisphere.color.set(0xffffff);this.hemisphere.groundColor.set(neutral?0x808080:0x78828f);
    this.hemisphere.intensity=neutral?3:1.8;
    this.keyLight.intensity=neutral?.8:2.1;
    this.keyLight.position.set(neutral?-3:2,neutral?6:3,neutral?-4:4);
    this.rimLight.color.set(neutral?0xffffff:0xc6ddff);this.rimLight.intensity=neutral?.6:1.8;
    this.rimLight.position.set(-4,2,-3);
  }

  clearMesh() {
    this.catalogObject=false;
    if(!this.mesh)return;
    this.root.remove(this.mesh);
    ProfileGeometryFactory.disposeObject(this.mesh);
    this.mesh=null;
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.clearMesh();
    this.renderer.dispose();
    // 创建/修改使用 v-show：仍在页面中的 canvas 会被复用，强制丢失会把下一次预览一并杀掉。
    if(!this.canvas.isConnected)this.renderer.forceContextLoss();
  }
}
