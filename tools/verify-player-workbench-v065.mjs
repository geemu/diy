import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const staticRoot=path.join(root,'src/main/resources/static');
const vendor=path.join(root,'target/classes/static/vendor/three/build/three.module.min.js');
assert.ok(fs.existsSync(vendor),'先执行 Maven resources，以获取项目实际使用的本地 Three.js');
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const threeUrl=moduleUrl(fs.readFileSync(vendor,'utf8'));
const THREE=await import(threeUrl);
async function load(relative) {
  const source=fs.readFileSync(path.join(staticRoot,relative),'utf8').replace("from 'three'",`from '${threeUrl}'`);
  return import(moduleUrl(source));
}
const {default:ViewCube,VIEW_DIRECTIONS}=await load('js/ui/ViewCube.js');
assert.equal(VIEW_DIRECTIONS.length,26);
assert.equal(new Set(VIEW_DIRECTIONS.map(v=>`${v.x},${v.y},${v.z}`)).size,26);
for(const [kind,count] of [['面',6],['边',12],['角',8]])assert.equal(VIEW_DIRECTIONS.filter(v=>v.kind===kind).length,count);
for(const v of VIEW_DIRECTIONS)assert.ok(VIEW_DIRECTIONS.some(w=>w.x===-v.x&&w.y===-v.y&&w.z===-v.z),'每个视角必须具有对应的反向视角');

// 直接调用真实拖动实现，并投影可见面上的点，不能只检查相机角度的正负。
let cubeDragCases=0;
for(const theta of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const phi of [Math.PI/3,Math.PI/2,Math.PI*2/3])for(const [dx,dy] of [[18,0],[-18,0],[0,18],[0,-18]]) {
  const camera=new THREE.PerspectiveCamera(38,1,1,50000),target=new THREE.Vector3(40,100,-70);
  camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(2800,phi,theta)));
  const orbitControls={target,update(){camera.lookAt(target);camera.updateMatrixWorld(true);}};
  orbitControls.update();
  const frontPoint=target.clone().add(camera.position.clone().sub(target).normalize().multiplyScalar(400));
  const before=frontPoint.clone().project(camera),distance=camera.position.distanceTo(target);
  const state={down:{x:0,y:0,lastX:0,lastY:0,dragged:false},main:{camera,orbitControls,cameraTween:{}},highlight(){}};
  ViewCube.prototype.handleMove.call(state,{clientX:dx,clientY:dy});
  const after=frontPoint.clone().project(camera);
  if(dx)assert.ok((after.x-before.x)*dx>0,'左右拖动：可见面应跟随鼠标');
  if(dy)assert.ok(-(after.y-before.y)*dy>0,'上下拖动：屏幕 Y 与鼠标同向');
  assert.ok(Math.abs(camera.position.distanceTo(target)-distance)<1e-8,'导航拖动不改变缩放距离');
  assert.deepEqual(target.toArray(),[40,100,-70],'导航拖动不移动观察中心');
  assert.equal(state.main.cameraTween,null);cubeDragCases++;
}

const {profileQuaternion,workPlaneNormal}=await load('js/geometry/ProfileOrientation.js');
// 非方形截面沿不同方向绘制时，外表面始终落在同一工作平面，不能随方向翻转。
for(const plane of ['XZ','XY','YZ']) {
  const normal=workPlaneNormal(plane);
  const u=plane==='YZ'?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
  const v=normal.clone().cross(u).normalize();
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5,.63]) {
    const direction=u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle));
    const quaternion=profileQuaternion(direction,normal);
    assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(quaternion).distanceTo(normal)<1e-8);
    assert.ok(new THREE.Vector3(0,0,1).applyQuaternion(quaternion).distanceTo(direction)<1e-8);
    const center=normal.clone().multiplyScalar(20);
    let min=Infinity;
    for(const x of [-10,10])for(const y of [-20,20])for(const z of [-500,500]) {
      min=Math.min(min,new THREE.Vector3(x,y,z).applyQuaternion(quaternion).add(center).dot(normal));
    }
    assert.ok(Math.abs(min)<1e-7,`${plane} 工作平面底面应为 0，得到 ${min}`);
  }
}
console.log(JSON.stringify({ok:true,version:'0.75.7',viewDirections:26,faces:6,edges:12,corners:8,cubeDragCases,rectangularSectionGroundingCases:15}));
