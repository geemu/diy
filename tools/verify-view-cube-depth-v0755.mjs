import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,'src/main/resources/static',file),'utf8');
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const threeUrl=moduleUrl(fs.readFileSync(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js'),'utf8'));
const THREE=await import(threeUrl);
const source=read('js/ui/ViewCube.js');
const {default:ViewCube,VIEW_DIRECTIONS}=await import(moduleUrl(source.replace("from 'three'",`from '${threeUrl}'`)));
const rect={left:0,top:0,width:148,height:148};
const element={style:{},setAttribute(){},getBoundingClientRect(){return rect;},remove(){}};
const listeners=new Map();
const container={style:{},appendChild(){},addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);}};
class Renderer {
  constructor(){this.domElement=element;}
  setPixelRatio(){} setSize(){} setClearColor(){}
  render(scene){scene.updateMatrixWorld(true);}
  dispose(){this.disposed=true;}
}
// 执行真实构造函数，仅用无 GPU 渲染器替代 WebGL；相机、光照、材质及射线仍用项目 Three.js。
const constructor=new Function('THREE','VIEW_DIRECTIONS','window','requestAnimationFrame','container','sceneManager','onSelect',source.match(/\n  constructor\([^\n]*\) \{([\s\S]*?)\n  \}/)[1]);
globalThis.document={createElement(){return {getContext(){return {fillText(){}};}};}};
globalThis.cancelAnimationFrame=()=>{};
const main={camera:new THREE.PerspectiveCamera(38,1,1,50000),orbitControls:{target:new THREE.Vector3(),update(){}}};
main.camera.position.set(0,2000,2000);main.camera.lookAt(0,0,0);
const cube=Object.create(ViewCube.prototype);
let selected=null;
constructor.call(cube,{...THREE,WebGLRenderer:Renderer},VIEW_DIRECTIONS,{devicePixelRatio:1},()=>1,container,main,direction=>{selected=direction;});
assert.ok(cube.camera.isPerspectiveCamera,'导航轻透视不能退回平面投影');
assert.equal(cube.targets.length,26);
assert.equal(cube.scene.children.filter(object=>object.isHemisphereLight||object.isDirectionalLight).length,2);
assert.ok(cube.targets.every(mesh=>mesh.material.isMeshLambertMaterial));
assert.equal(cube.scene.children.filter(object=>object.isLineSegments).length,1);
assert.equal(cube.textures.length,6);
// 上前边仍为 x=0，不为了立体效果伪造右侧面；透视投影形成真正的梯形。
assert.ok(Math.abs(cube.camera.position.x)<1e-10);
const topBackLeft=new THREE.Vector3(-1,1,-1).project(cube.camera);
const topBackRight=new THREE.Vector3(1,1,-1).project(cube.camera);
const topFrontLeft=new THREE.Vector3(-1,1,1).project(cube.camera);
const topFrontRight=new THREE.Vector3(1,1,1).project(cube.camera);
assert.ok(topFrontRight.x-topFrontLeft.x>topBackRight.x-topBackLeft.x,'近边宽于远边，两个面不能再画成两个等宽矩形');
let pickCases=0;
for(const direction of VIEW_DIRECTIONS) {
  main.camera.position.set(direction.x,direction.y,direction.z).normalize().multiplyScalar(3000);
  cube.update();
  const mesh=cube.targets.find(target=>target.userData.direction===direction);
  const projected=mesh.position.clone().project(cube.camera);
  const event={clientX:(projected.x+1)*rect.width/2,clientY:(1-projected.y)*rect.height/2,button:0};
  assert.equal(cube.pick(event),direction,`${direction.label} 的真实区域仍可拾取`);
  cube.press(event);cube.release(event);
  assert.deepEqual(selected.toArray(),[direction.x,direction.y,direction.z]);
  cube.highlight(direction);assert.ok(mesh.material.color.equals(new THREE.Color(0xffa34b)));
  cube.highlight(null);assert.ok(mesh.material.color.equals(mesh.userData.color));pickCases++;
}
cube.dispose();assert.equal(listeners.size,0);assert.ok(cube.renderer.disposed);
delete globalThis.document;delete globalThis.cancelAnimationFrame;

const sceneSource=read('js/core/SceneManager.js');
const setView=new Function('THREE','direction','center','distance','options',sceneSource.match(/\n  setView\([^\n]*\) \{([\s\S]*?)\n  \}/)[1]);
const reset=new Function('THREE',sceneSource.match(/\n  resetInitialView\(\) \{([\s\S]*?)\n  \}/)[1]);
const anchor=new Function('width','height',sceneSource.match(/\n  applyViewportAnchor\([^\n]*\) \{([\s\S]*?)\n  \}/)[1]);
let centerCases=0;
for(const [width,height] of [[1920,904],[1192,904],[664,604],[296,604]]) {
  const camera=new THREE.PerspectiveCamera(38,width/height,1,50000);
  const target=new THREE.Vector3(0,500,0);
  const manager={camera,orbitControls:{target,update(){camera.updateMatrixWorld(true);}}};
  manager.setView=(...args)=>setView.call(manager,THREE,...args);
  reset.call(manager,THREE);
  assert.deepEqual(target.toArray(),[0,0,0]);
  const origin=new THREE.Vector3().project(camera);
  assert.ok(Math.abs(origin.x)<1e-10&&Math.abs(origin.y)<1e-10,'原点必须投影到实际画布中心');
  assert.ok(Math.abs(camera.position.x)<1e-10&&Math.abs(camera.position.y-camera.position.z)<1e-10);
  assert.ok(Math.abs(camera.position.length()-3000)<1e-8);centerCases++;
  const orthographic=new THREE.OrthographicCamera(-1100*width/height,1100*width/height,1100,-1100,-50000,50000);
  orthographic.position.copy(camera.position);orthographic.lookAt(0,0,0);orthographic.updateMatrixWorld(true);
  manager.perspectiveCamera=camera;manager.orthographicCamera=orthographic;
  anchor.call(manager,width,height);
  for(const view of [camera,orthographic]) {
    const projected=new THREE.Vector3().project(view);
    assert.ok(Math.abs(projected.x)<1e-10&&Math.abs((1-projected.y)/2-.47)<1e-10,'实际画布交点须在用户标记附近的 47% 高度');
  }
  assert.deepEqual(target.toArray(),[0,0,0],'投影偏置不能平移原点/旋转中心');
}
const editorSource=read('js/core/Editor.js');
const getCenterAndSize=new Function('THREE',editorSource.match(/\n  getCenterAndSize\(\) \{([\s\S]*?)\n  \}/)[1]);
assert.deepEqual(getCenterAndSize.call({meshes:[]},THREE).center.toArray(),[0,0,0]);
const existingMesh=new THREE.Mesh(new THREE.BoxGeometry(100,200,300));existingMesh.position.set(250,700,-100);
assert.deepEqual(getCenterAndSize.call({meshes:[existingMesh]},THREE).center.toArray(),[250,700,-100],'已有工程必须围绕模型中心，不移动或强制居中原点');
existingMesh.geometry.dispose();existingMesh.material.dispose();
console.log(JSON.stringify({ok:true,version:'0.75.23',pickCases,centerCases,litFaces:true,perspectiveDepth:true,initialUpperFront:true,emptyViewCentered:true,existingModelCenterPreserved:true,renderOnly:true}));
