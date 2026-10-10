import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const js=path.join(root,'src/main/resources/static/js');
const vendor=path.join(root,'target/classes/static/vendor/three');
const threeUrl=pathToFileURL(path.join(vendor,'build/three.module.min.js')).href;
const THREE=await import(threeUrl);
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {TransformControls}=await import(dataUrl(fs.readFileSync(path.join(vendor,'examples/jsm/controls/TransformControls.js'),'utf8').replace("from 'three'",`from '${threeUrl}'`)));
const sceneSource=fs.readFileSync(path.join(js,'core/SceneManager.js'),'utf8');
const compact=new Function('THREE',sceneSource.match(/\n  compactTranslationGizmo\(\) \{([\s\S]*?)\n  \}/)[1]);
const dom={style:{},addEventListener(){},removeEventListener(){}};
let moveCases=0;
// 使用实际 WebJar 的拾取/拖动算法，不伪造轴向位移。只改变手柄展示，移动仍是有符号的。
for(const space of ['world','local'])for(const axis of ['X','Y','Z'])for(const sign of [-1,1]) {
  const camera=new THREE.PerspectiveCamera(38,1.4,1,50000);
  camera.position.set(1200,850,1400);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const controls=new TransformControls(camera,dom),object=new THREE.Object3D(),scene=new THREE.Scene();
  object.rotation.set(.2,.3,.1);scene.add(object);scene.add(controls);controls.attach(object);controls.setSpace(space);
  const gizmo=controls.children.find(c=>c.gizmo),rotationCount=gizmo.gizmo.rotate.children.length;
  compact.call({transformControls:controls},THREE);scene.updateMatrixWorld(true);
  assert.equal(gizmo.gizmo.translate.children.length,10,'仅删除三支反向箭头，其余平面和中心柄保留');
  assert.equal(gizmo.picker.translate.children.length,7,'不能残留三支反向箭头的隐形点击区');
  assert.equal(gizmo.gizmo.rotate.children.length,rotationCount,'旋转工具不受影响');
  const picker=gizmo.picker.translate.children.find(h=>h.name===axis);
  picker.geometry.computeBoundingBox();
  const point=picker.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(picker.matrixWorld);
  const before=object.position.clone();
  const direction=new THREE.Vector3(axis==='X'?1:0,axis==='Y'?1:0,axis==='Z'?1:0);
  if(space==='local')direction.applyQuaternion(object.quaternion);
  const start=point.clone().project(camera),end=point.clone().addScaledVector(direction,sign*60).project(camera);
  controls.pointerHover({x:start.x,y:start.y,button:0});assert.equal(controls.axis,axis,'正轴箭头真实射线应拾取对应轴');
  scene.updateMatrixWorld(true); // 模拟鼠标 hover 后的渲染帧，让轴对应的拖动平面更新。
  controls.pointerDown({x:start.x,y:start.y,button:0});assert.equal(controls.dragging,true);
  controls.pointerMove({x:end.x,y:end.y,button:-1});controls.pointerUp({button:0});
  const actual=object.position.clone().sub(before),expected=direction.multiplyScalar(sign*60);
  assert.ok(actual.distanceTo(expected)<1e-6,`${space} ${axis} ${sign} 同轴正反移动：${actual.toArray()} / ${expected.toArray()}`);
  controls.dispose();moveCases++;
}
const {applyProfileSurfaceShading}=await import(dataUrl(fs.readFileSync(path.join(js,'geometry/ProfileSurfaceAppearance.js'),'utf8').replace("from 'three'",`from '${threeUrl}'`)));
const {buildDesignProfileSection}=await import(pathToFileURL(path.join(js,'model/DesignProfileSection.js')).href);
const section=buildDesignProfileSection({width:40,height:40,series:40,slotWidth:8,slotDefinitions:[{face:'FRONT',offset:0},{face:'BACK',offset:0},{face:'LEFT',offset:0},{face:'RIGHT',offset:0}]});
const shape=new THREE.Shape(section.outer.map(p=>new THREE.Vector2(p.x,p.y)));
for(const ring of section.holes)shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(p.x,p.y))));
const geometry=new THREE.ExtrudeGeometry(shape,{depth:800,bevelEnabled:false,steps:1});
const positions=geometry.attributes.position.array.slice(),normals=geometry.attributes.normal.array.slice();
const savedSection=JSON.stringify(section);applyProfileSurfaceShading(geometry,section);
assert.deepEqual(geometry.attributes.position.array,positions);assert.deepEqual(geometry.attributes.normal.array,normals);
assert.equal(JSON.stringify(section),savedSection,'展示暗部不能修改截面事实');
const colors=geometry.attributes.color;assert.equal(colors.count,geometry.attributes.position.count);
let cavityVertices=0,endVertices=0;
for(let i=0;i<colors.count;i++){
  const value=colors.getX(i);assert.ok(value>=.49&&value<=1.000001);
  if(value<.7)cavityVertices++;
  if(Math.abs(geometry.attributes.normal.getZ(i))>.9){assert.equal(value,1);endVertices++;}
}
assert.ok(cavityVertices>0&&endVertices>0);
// 凸圆弧外表面不能被矩形包围盒误判成凹槽。
const circle=Array.from({length:32},(_,i)=>({x:20*Math.cos(i*Math.PI/16),y:20*Math.sin(i*Math.PI/16)}));
const round=new THREE.ExtrudeGeometry(new THREE.Shape(circle.map(p=>new THREE.Vector2(p.x,p.y))),{depth:100,bevelEnabled:false});
applyProfileSurfaceShading(round,{outer:circle});assert.ok([...round.attributes.color.array].every(v=>v>.99999));
const html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
const pom=fs.readFileSync(path.join(root,'pom.xml'),'utf8');
assert.ok(sceneSource.includes('pmrem.fromScene(room,.04)')&&sceneSource.includes('room.dispose();pmrem.dispose()'));
assert.ok(html.includes('three/addons/environments/RoomEnvironment.js')&&pom.includes('environments/RoomEnvironment.js'));
assert.ok(fs.existsSync(path.join(vendor,'examples/jsm/environments/RoomEnvironment.js')),'环境模块必须在构建期本地交付');
geometry.dispose();round.dispose();
console.log(JSON.stringify({ok:true,version:'0.75.56',moveCases,arrows:3,negativePickers:false,cavityVertices,endVertices,geometryUnchanged:true,localEnvironment:true}));
