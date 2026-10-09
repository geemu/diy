import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href,cache=new Map();
function moduleUrl(file){
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl);
const {default:Axis}=await import(moduleUrl(path.join(js,'interaction/AxisClearanceManager.js')));
const manager=Object.create(Axis.prototype),selected=new THREE.Group(),camera=new THREE.PerspectiveCamera(40,1.5,1,100000);
let moved=null,focused=0;
manager.editor={selected,movementStepMm:5,transformSpace:'world',sceneManager:{camera,transformControls:{mode:'translate'}},isMeshTransformable:m=>!!m,
  moveSelectionByDistance(axis,distance){moved={axis,distance};}};
manager.update=()=>{};manager.focusDistance=()=>{focused++;return true;};
for(const space of ['world','local'])for(const position of [[0,800,800],[700,500,800],[-700,500,-800],[0,1000,0]]){
  camera.position.set(...position);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  selected.rotation.set(.2,.7,-.1);selected.updateMatrixWorld(true);manager.editor.transformSpace=space;
  const q=camera.getWorldQuaternion(new THREE.Quaternion()),right=new THREE.Vector3(1,0,0).applyQuaternion(q),up=new THREE.Vector3(0,1,0).applyQuaternion(q);
  const axes=[];
  for(const [key,screen,sign] of [['ArrowRight',right,1],['ArrowLeft',right,-1],['ArrowUp',up,1],['ArrowDown',up,-1]]){
    assert.equal(manager.handleKey({key}),true);assert.equal(Math.abs(moved.distance),5);
    const delta=new THREE.Vector3(moved.axis==='X'?1:0,moved.axis==='Y'?1:0,moved.axis==='Z'?1:0).multiplyScalar(moved.distance);
    if(space==='local')delta.applyQuaternion(selected.quaternion);
    assert.ok(delta.dot(screen)*sign>0,'方向键移动投影必须顺着画面方向');axes.push(moved.axis);
  }
  assert.notEqual(axes[0],axes[2],'水平与竖直键使用不同操作轴');
  manager.handleKey({key:'PageUp'});assert.ok(!axes.includes(moved.axis),'前后移动使用剩余轴');
}
manager.handleKey({key:'ArrowRight',shiftKey:true});assert.equal(Math.abs(moved.distance),50);
manager.editor.movementStepMm=0;manager.handleKey({key:'ArrowRight'});assert.equal(Math.abs(moved.distance),1);
assert.equal(manager.handleKey({key:'Tab'}),true);assert.equal(focused,1);
assert.equal(manager.handleKey({key:'ArrowRight',ctrlKey:true}),false);
manager.editor.transformSelectionSnapshot={};assert.equal(manager.handleKey({key:'ArrowRight'}),false);
manager.editor.transformSelectionSnapshot=null;manager.editor.sceneManager.transformControls.mode='rotate';assert.equal(manager.handleKey({key:'Tab'}),false);

// 执行当前 Editor 原始方法，确认数字与方向键仍通过完整鼠标事务，而不是直接同步 Part。
const source=fs.readFileSync(path.join(js,'core/Editor.js'),'utf8');
const start=source.indexOf('  moveSelectionToSurface('),end=source.indexOf('  applyConstrainedPrimaryTransform()',start);
const methods=new Function('THREE',`return {${source.slice(start,end).trim().replace(/\n  }\r?\n(?=\r?\n|  \w)/g,'\n  },\n')}}`)(THREE);
const part=new THREE.Group();part.position.set(10,20,30);let captures=0,cancelled=0,events=[];
const e={...methods,selected:part,selectedMeshes:[part],meshes:[part],transformSpace:'world',isMeshTransformable:()=>true,
  accessoryMountManager:{refreshForTargets(){}},updateDimensions(){},emitStats(){},emitProjectChanged(){},interferenceFeedbackManager:{requestRefresh(){}},
  restoreTransformSnapshot(snapshot){cancelled++;part.position.copy(snapshot.primaryPosition);},sceneManager:{clearSnapPreview(){},hideSnapFeedback(){},hideTransformFeedback(){}}};
e.sceneManager.transformControls={dragging:false,dispatchEvent(event){events.push(event.type);if(event.type==='mouseDown')e.transformSelectionSnapshot={primaryPosition:part.position.clone()};if(event.type==='mouseUp'){captures++;e.transformSelectionSnapshot=null;}}};
e.moveSelectionByDistance('X',12.5);assert.deepEqual(part.position.toArray(),[22.5,20,30]);assert.equal(captures,1);assert.deepEqual(events,['mouseDown','objectChange','mouseUp']);
events=[];e.transformSelectionSnapshot={primaryPosition:part.position.clone()};part.position.x+=7;e.sceneManager.transformControls.dragging=true;
e.moveSelectionByDistance('X',80);assert.deepEqual(part.position.toArray(),[102.5,20,30]);assert.deepEqual(events,['objectChange','mouseUp']);assert.equal(captures,2);assert.equal(e.sceneManager.transformControls.dragging,false);
e.transformSelectionSnapshot={primaryPosition:part.position.clone()};part.position.y+=100;e.cancelPrecisionMove();assert.deepEqual(part.position.toArray(),[102.5,20,30]);assert.equal(captures,2);assert.equal(cancelled,1);
assert.throws(()=>e.moveSelectionByDistance('X',NaN),/无效/);
e.transformSpace='local';part.rotation.z=Math.PI/2;e.moveSelectionByDistance('X',10);assert.ok(part.position.distanceTo(new THREE.Vector3(102.5,30,30))<1e-6);
e.isMeshTransformable=()=>false;assert.throws(()=>e.moveSelectionByDistance('X',5),/锁定/);
const app=fs.readFileSync(path.join(js,'app.js'),'utf8');assert.ok(app.includes('target.isContentEditable'));assert.ok(app.indexOf("event.key==='Tab'&&connectionPlacementState.active")<app.indexOf('axisClearanceManager.handleKey(event)'));
console.log(JSON.stringify({ok:true,version:'0.75.34',screenDirections:true,worldAndLocal:true,stepAndShift:true,tabContext:true,transaction:true,dragTotal:true,cancelNoHistory:true,lockedGuard:true}));
