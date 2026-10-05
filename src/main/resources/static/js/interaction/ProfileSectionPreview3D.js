import * as THREE from 'three';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import {getSectionBounds} from '../model/ProfileSectionRegistry.js';

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
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x78828f,1.8));
    const keyLight=new THREE.DirectionalLight(0xffffff,2.1);
    keyLight.position.set(2,3,4);
    this.scene.add(keyLight);
    const rimLight=new THREE.DirectionalLight(0xc6ddff,1.8);
    rimLight.position.set(-4,2,-3);
    this.scene.add(rimLight);
    this.mesh=null;
    this.resize();
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
  }

  setSection(section,options={}) {
    this.clearMesh();
    this.camera.near=.1;
    this.camera.far=5000;
    this.camera.updateProjectionMatrix();
    if(!section?.outer?.length) {
      this.render();
      return;
    }
    const bounds=getSectionBounds(section);
    const span=Math.max(bounds.width,bounds.height,10);
    const material=new THREE.MeshStandardMaterial({color:0xcfd5dc,metalness:0.55,roughness:0.28,side:THREE.DoubleSide});
    const lengthRatio=Math.max(1,Number(options.lengthRatio)||1.5);
    this.mesh=ProfileGeometryFactory.createSectionMesh(section,span*lengthRatio,material);
    ProfileGeometryFactory.addCadEdges(this.mesh);
    this.root.add(this.mesh);
    if(options.presentation==='catalog') {
      // 目录卡须同时看到截面和长槽，避免相机沿挤出轴看成一小块端面。
      this.root.rotation.set(0,0,0);
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
    this.root.rotation.set(0,0,0);
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
    this.mesh.position.sub(center);
    const radius=Math.max(1,box.getSize(new THREE.Vector3()).length()/2);
    const halfFov=THREE.MathUtils.degToRad(this.camera.fov/2);
    const limitingFov=Math.min(halfFov,Math.atan(Math.tan(halfFov)*this.camera.aspect));
    const distance=radius/Math.sin(limitingFov)*1.12;
    this.camera.position.copy(new THREE.Vector3(5,4,6).normalize().multiplyScalar(distance));
    this.camera.near=Math.max(.1,distance-radius*2);
    this.camera.far=distance+radius*4;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0,0,0);
  }

  render() {
    this.renderer.render(this.scene,this.camera);
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
