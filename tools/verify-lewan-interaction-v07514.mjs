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
const {default:Placement}=await import(moduleUrl(path.join(js,'interaction/ProfilePlacementManager.js')));
const {default:Alignment}=await import(moduleUrl(path.join(js,'interaction/QuickAlignmentManager.js')));
const {default:Stretch}=await import(moduleUrl(path.join(js,'interaction/WholeStretchManager.js')));
function profile(id,length,x=0,z=0){
  const part={id,type:'PROFILE',position:{x,y:20,z},rotation:{x:0,y:Math.PI/2,z:0},dimensions:{length,sectionSize:[20,40]},designProfile:{profileId:'DESIGN-2040',faceClosures:[]},profilePath:{type:'LINE',length},machiningItems:[]};
  const mesh=Factory.create(part);mesh.position.set(x,20,z);mesh.rotation.y=Math.PI/2;mesh.updateMatrixWorld(true);return mesh;
}
let histories=0,commits=0;
const editor={selected:null,selectedMeshes:[],meshes:[],parts:[],sceneManager:{scene:new THREE.Scene(),transformControls:{detach(){},attach(){}},clearSnapPreview(){},hideSnapFeedback(){},pickHit(){return {object:null,point:new THREE.Vector3(9,0,9)};},worldPointOnPlane(){return new THREE.Vector3(30,0,40);},setSelections(){}},
  profileGripEditor:{refresh(){}},snapManager:{clearLock(){},snap(){return null;},preview(){return null;},candidateCollision(){return null;}},workPlaneVisualizer:{plane:'XZ'},isMeshTransformable:()=>true,selectableMeshes(){return this.meshes;},
  placeProfileWithSnap(){commits++;return {};},constraintManager:{listForPart(){return [];}},connectionManager:{updateConnectionsForProfiles(){}},accessoryMountManager:{refreshForTargets(){}},interferenceFeedbackManager:{requestRefresh(){},preview(){},refresh(){}},
  historyManager:{capture(){histories++;}},exportProject(){return {parts:this.meshes.map(mesh=>structuredClone(mesh.userData.part))};},syncPartFromMesh(mesh){mesh.userData.part.position={x:mesh.position.x,y:mesh.position.y,z:mesh.position.z};},
  updateDimensions(){},emitStats(){},emitProjectChanged(){},rebuildLinearProfileVisual(mesh){Factory.rebuildLinearGroup(mesh,mesh.userData.part);}};
const placement=new Placement(editor);
assert.throws(()=>placement.begin('DESIGN-2040',0),/长度/);
placement.begin('DESIGN-2040',500);placement.handlePointerMove({clientX:0,clientY:0});
assert.equal(editor.parts.length,0);assert.equal(commits,0);assert.equal(placement.ghost.visible,true);
assert.ok(Math.abs(new THREE.Box3().setFromObject(placement.ghost).min.y)<1e-6,'真实底面落地');
for(let i=0;i<3;i++){placement.cycle();placement.handlePointerMove({clientX:0,clientY:0});assert.ok(Math.abs(new THREE.Box3().setFromObject(placement.ghost).min.y)<1e-6);}
placement.handleClick({clientX:0,clientY:0});placement.handleClick({clientX:10,clientY:10});assert.equal(commits,2);assert.ok(placement.isActive());placement.cancel();assert.equal(placement.isActive(),false);assert.equal(histories,0);

const align=new Alignment(editor);
editor.meshes=[profile('a',500,-400),profile('b',300,200)];editor.selectedMeshes=editor.meshes;editor.selected=editor.meshes[1];
align.execute('LENGTH');assert.deepEqual(editor.meshes.map(m=>m.userData.part.dimensions.length),[300,300]);assert.ok(editor.meshes[0].position.distanceTo(editor.meshes[1].position)<1e-6);assert.equal(histories,1);
editor.meshes[0].position.x=-400;align.execute('END');assert.equal(editor.meshes[0].position.x,200);
editor.meshes=[profile('a',200,0),profile('b',200,20),profile('c',200,100)];editor.selectedMeshes=editor.meshes;editor.selected=editor.meshes[2];
align.execute('DISTRIBUTE','X');assert.equal(editor.meshes[1].position.x,50);align.execute('CENTER','X');assert.deepEqual(editor.meshes.map(m=>m.position.x),[100,100,100]);
const beforeParallelGuard=histories,positionsBeforeParallelGuard=editor.meshes.map(m=>m.position.toArray());
editor.meshes[0].rotation.y=0;editor.meshes[0].updateMatrixWorld(true);
assert.throws(()=>align.execute('CENTER','X'),/平行/);assert.equal(histories,beforeParallelGuard);assert.deepEqual(editor.meshes.map(m=>m.position.toArray()),positionsBeforeParallelGuard);
editor.meshes[0].rotation.y=Math.PI/2;editor.meshes[0].updateMatrixWorld(true);
const historyBeforeGuard=histories;editor.constraintManager.listForPart=()=>[{enabled:true,suppressed:false}];assert.throws(()=>align.execute('CENTER'),/约束/);assert.equal(histories,historyBeforeGuard);editor.constraintManager.listForPart=()=>[];

const stretch=Object.create(Stretch.prototype),mesh=profile('s',300,200);editor.meshes=[mesh];editor.selectedMeshes=[mesh];editor.selected=mesh;
stretch.editor=editor;stretch.proxy=new THREE.Group();stretch.proxy.position.set(350,20,0);stretch.proxy.scale.set(80,80,80);stretch.proxy.updateMatrixWorld(true);stretch.outline={update(){}};
stretch.region=new THREE.Box3(new THREE.Vector3(310,-30,-50),new THREE.Vector3(390,70,50));stretch.ids=['s'];stretch.before=editor.exportProject();stretch.origin=stretch.proxy.position.clone();
stretch.originals=[{mesh,part:structuredClone(mesh.userData.part),position:mesh.position.clone(),quaternion:mesh.quaternion.clone()}];
const fixed=mesh.localToWorld(new THREE.Vector3(0,0,-150));stretch.proxy.position.x+=80;stretch.preview();assert.ok(Math.abs(mesh.userData.part.dimensions.length-380)<1e-6);assert.ok(mesh.localToWorld(new THREE.Vector3(0,0,-190)).distanceTo(fixed)<1e-6);assert.deepEqual(mesh.scale.toArray(),[1,1,1]);
const h=histories;stretch.restorePreview();assert.equal(mesh.userData.part.dimensions.length,300);assert.equal(histories,h,'取消不提交历史');

const app=fs.readFileSync(path.join(js,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
assert.ok(app.includes("event.key.toLowerCase() === 'e'")||app.includes("event.key.toLowerCase() === 'e'"));
assert.ok(app.includes("else if (event.key.toLowerCase() === 'e') toggleQuickAlignment()"));
assert.ok(app.includes("['w','m'].includes(event.key.toLowerCase())"));
assert.ok(app.includes("event.code==='Space'"));assert.ok(app.includes("event.key.toLowerCase()==='b'&&event.shiftKey"));
assert.ok(html.includes('绘制中…按 Esc 退出'));assert.ok(!html.includes('结束添加'));assert.ok(!html.includes('自由绘制 · E'));
for(const mesh of editor.meshes)Factory.disposeObject(mesh);
console.log(JSON.stringify({ok:true,version:'0.75.25',ghostNotPersistent:true,repeatPlacement:true,tabDirections:true,groundSurface:true,alignment:true,stretchFixedEnd:true,noSectionScale:true,cancelNoHistory:true,shortcutConflictRemoved:true}));
