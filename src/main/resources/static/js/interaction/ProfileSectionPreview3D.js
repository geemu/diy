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
    this.mesh=null;
    this.resize();
  }

  setSection(section) {
    this.clearMesh();
    if(!section?.outer?.length) {
      this.render();
      return;
    }
    const bounds=getSectionBounds(section);
    const span=Math.max(bounds.width,bounds.height,10);
    const material=new THREE.MeshStandardMaterial({color:0xcfd5dc,metalness:0.55,roughness:0.28,side:THREE.DoubleSide});
    this.mesh=ProfileGeometryFactory.createSectionMesh(section,span*1.5,material);
    ProfileGeometryFactory.addCadEdges(this.mesh);
    this.root.add(this.mesh);
    this.camera.position.set(span*2.6,span*2.1,span*3.4);
    this.camera.lookAt(0,0,0);
    this.render();
  }

  resize() {
    const width=Math.max(220,Math.round(this.canvas?.clientWidth||320));
    const height=Math.max(160,Math.round(this.canvas?.clientHeight||220));
    this.renderer.setSize(width,height,false);
    this.camera.aspect=width/height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() {
    this.renderer.render(this.scene,this.camera);
  }

  clearMesh() {
    if(!this.mesh)return;
    this.root.remove(this.mesh);
    ProfileGeometryFactory.disposeObject(this.mesh);
    this.mesh=null;
  }

  dispose() {
    this.clearMesh();
    this.renderer.dispose();
  }
}
