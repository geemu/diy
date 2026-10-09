import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const vendor=path.join(root,'target/classes/static/vendor/three'),threeUrl=pathToFileURL(path.join(vendor,'build/three.module.min.js')).href,cache=new Map();
function moduleUrl(file){
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('three/addons/')?moduleUrl(path.join(vendor,'examples/jsm',spec.slice(13))):spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl);
const {default:Factory}=await import(moduleUrl(path.join(js,'geometry/ProfileGeometryFactory.js')));
const {default:SnapManager}=await import(moduleUrl(path.join(js,'snap/SnapManager.js')));
const {default:Interference}=await import(moduleUrl(path.join(js,'interaction/InterferenceFeedbackManager.js')));
const {default:SceneManager}=await import(moduleUrl(path.join(js,'core/SceneManager.js')));
const {default:FeatureHover}=await import(moduleUrl(path.join(js,'interaction/FeatureHoverManager.js')));
const {lowestSurfaceY}=await import(moduleUrl(path.join(js,'interaction/GroundClearance.js')));
const {compareProfileTopPlanes}=await import(moduleUrl(path.join(js,'interaction/CoplanarSurfaceFeedback.js')));
function make(id,position,rotation,length=500,size=[20,40]){
  const part={id,displayId:id,type:'PROFILE',designProfile:{profileId:size[1]===40?'DESIGN-2040':'DESIGN-2020',faceClosures:[]},dimensions:{sectionSize:size,length},profilePath:{type:'LINE',length},position:{x:position[0],y:position[1],z:position[2]},rotation:{x:rotation[0],y:rotation[1],z:rotation[2]}};
  const mesh=Factory.create(part);mesh.position.fromArray(position);mesh.rotation.set(...rotation);return mesh;
}
function editorFor(meshes){
  const scene=new THREE.Scene();scene.add(...meshes);let feedback=null;
  const editor={meshes,selected:meshes[0],selectedMeshes:[meshes[0]],projectSettings:{collisionToleranceMm:.5,contactToleranceMm:1},connectionManager:{connections:[]},
    sceneManager:{scene,clearSnapPreview(){},hideSnapFeedback(){},showSnapPreview(){},showSnapSurface(){},showCoplanarPreview(){},showSnapFeedback(value){feedback=value;}},
    currentTransformMeshes(){return this.selectedMeshes;},getMeshByPartId(id){return meshes.find(m=>m.userData.part.id===id);}};
  editor.interferenceFeedbackManager=new Interference(editor);editor.snapManager=new SnapManager(editor);
  return {editor,snap:editor.snapManager,feedback:()=>feedback};
}
// 用户三根 2040 接头的几何尺寸，去除原文件身份信息；不读取或改写用户工程。
const source=make('beam',[-150,10,593.384851],[0,Math.PI/2,0]);
const post=make('post',[-400,250,570],[-Math.PI/2,0,Math.PI/2]);
const target=make('rail',[-410,20,832.539908],[0,0,0]);
const {editor,snap,feedback}=editorFor([source,post,target]);
const original=JSON.stringify(editor.meshes.map(m=>m.userData.part));
assert.ok(Math.abs(lowestSurfaceY(source)+10)<1e-6,'原文件横梁底面确实为 -10 mm');
source.position.y=19.31;
const preview=snap.preview(source);
assert.equal(preview.type,'END_TO_FACE','近处整面贴合不能被 9.31 mm 的下槽候选抢走');
assert.equal(preview.targetProfileId,'rail');
assert.ok(Math.abs(preview.offsetMm.y-.69)<1e-8);
assert.ok(feedback().label.startsWith('松手贴合'));
assert.ok(feedback().details.join(' ').includes('Y +0.69 mm'));
const expected=source.position.clone().add(new THREE.Vector3(...Object.values(preview.offsetMm)));
const result=snap.snap(source);
assert.equal(result.type,preview.type);assert.equal(result.targetProfileId,preview.targetProfileId);
assert.ok(source.position.distanceTo(expected)<1e-8,'预览和松手使用完全相同的三维补偿');
assert.ok(Math.abs(lowestSurfaceY(source))<1e-8,'依据目标侧面足迹齐平，不再掉到 -10 mm');
assert.ok(compareProfileTopPlanes(source,target).aligned);
assert.ok(snap.isSnapSatisfied(source,result));
assert.ok(feedback().details.includes('接头间隙 0 mm'));
assert.equal(JSON.stringify(editor.meshes.map(m=>m.userData.part)),original,'候选与 Mesh 吸附本身不旁路写入 Project');
source.position.x+=.3;assert.equal(snap.isSnapSatisfied(source,result),false,'约束移离面后不能保持吸附成功');source.position.x-=.3;
// 平移斜杆不改变角度；点相近而端面不相对，也不能冒充整面贴合。
source.rotation.y=Math.PI/2-.03;const quaternion=source.quaternion.clone();snap.clearLock();snap.snap(source);
assert.ok(source.quaternion.angleTo(quaternion)<1e-7);
assert.equal(snap.collectFaceCandidates(source,snap.endpoints(source),35).length,0);
assert.equal(snap.collectSlotCandidates(source,snap.endpoints(source),35).length,0);
source.rotation.y=Math.PI/2;
// 沿目标长边移动仍锁定同一面；明显移近另一槽则能解除旧锁。
source.position.set(-150,19.31,700);snap.clearLock();snap.preview(source);const faceKey=snap.previewLockKey;
source.position.z+=.53;snap.preview(source);assert.equal(snap.previewLockKey,faceKey);
const locked=snap.collectCandidates(source).find(c=>c.snap.type==='END_TO_SLOT');
snap.previewLockKey=locked.key;assert.equal(snap.preview(source).type,'END_TO_FACE');
// 释放半径以内已经显示的候选，松手不能换用较小半径而消失/跳到别的接头。
const small=make('small',[120,20,0],[0,Math.PI/2,0],200),wall=make('wall',[0,20,0],[0,0,0],300);
const hysteresis=editorFor([small,wall]).snap;
assert.equal(hysteresis.preview(small).type,'END_TO_FACE');small.position.x=150;
const farPreview=hysteresis.preview(small);assert.ok(farPreview,'40 mm 仍在同特征释放半径内');
const farExpected=small.position.clone().add(new THREE.Vector3(...Object.values(farPreview.offsetMm)));
assert.ok(hysteresis.snap(small));assert.ok(small.position.distanceTo(farExpected)<1e-8);
// 新障碍出现后重查，只能取消吸附，不能把对象跳到另一个未预览位置。
small.position.x=120;hysteresis.clearLock();assert.ok(hysteresis.preview(small));
const obstacle=make('obstacle',[180,20,0],[0,Math.PI/2,0],40);hysteresis.editor.meshes.push(obstacle);
const beforeCollision=small.position.clone();assert.equal(hysteresis.snap(small),null);assert.ok(small.position.equals(beforeCollision));
// 允许主动进地下：孤立构件没有任何地面硬限位。
const underground=make('underground',[600,-100,0],[0,0,0]);const free=editorFor([underground]).snap;
const negative=underground.position.clone();assert.equal(free.snap(underground),null);assert.ok(underground.position.equals(negative));assert.equal(lowestSurfaceY(underground),-120);
// 真实 SceneManager 方法生成固定屏幕尺寸 Points；不再包含 Sphere/Torus。
const scene=Object.create(SceneManager.prototype);scene.snapPreviewGroup=new THREE.Group();
scene.snapMarker=new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),new THREE.PointsMaterial({size:5,sizeAttenuation:false}));scene.snapMarker.visible=false;
scene.showSnapPoint(new THREE.Vector3(10,20,30));assert.equal(scene.snapMarker.visible,true);
scene.showSnapPreview(new THREE.Vector3(),new THREE.Vector3(10,0,0));assert.equal(scene.snapMarker.visible,false);
assert.equal(scene.snapPreviewGroup.children.length,2);
const points=scene.snapPreviewGroup.children.find(m=>m.isPoints);assert.equal(points.material.size,5);assert.equal(points.material.sizeAttenuation,false);
assert.equal(points.geometry.getAttribute('position').count,2);assert.ok(scene.snapPreviewGroup.children.every(m=>!m.isMesh));
let disposed=0;for(const child of scene.snapPreviewGroup.children)child.geometry.addEventListener('dispose',()=>disposed++);
scene.clearSnapPreview();assert.equal(scene.snapPreviewGroup.children.length,0);assert.equal(disposed,2);
const hover=new FeatureHover(editor);hover.renderFeature(source,{type:'PROFILE_END',worldPoint:source.position.clone()});
assert.equal(hover.group.children[0].isPoints,true);assert.equal(hover.group.children[0].material.size,5);assert.equal(hover.group.children[0].material.sizeAttenuation,false);
const marker=hover.group.children[0];hover.clearGraphics();assert.equal(marker.parent,null);assert.equal(hover.group.children.length,0);
const editorSource=fs.readFileSync(path.join(js,'core/Editor.js'),'utf8');assert.ok(editorSource.includes('isSnapSatisfied(this.selected,snap)'));
console.log(JSON.stringify({ok:true,version:'0.75.34',dropReproduced:true,fullEndFootprint:true,previewCommitSame:true,translationPreservesRotation:true,stableFeatureLock:true,releaseRadius:true,recheck:true,negativeGroundAllowed:true,screenPixels:5}));
