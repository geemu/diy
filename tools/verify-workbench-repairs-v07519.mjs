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
const {default:Editor}=await import(moduleUrl(path.join(js,'core/Editor.js')));
const {default:Scene}=await import(moduleUrl(path.join(js,'core/SceneManager.js')));
const {default:Factory}=await import(moduleUrl(path.join(js,'geometry/ProfileGeometryFactory.js')));
const {default:Connections}=await import(moduleUrl(path.join(js,'connection/ConnectionManager.js')));
const {default:Assemblies}=await import(moduleUrl(path.join(js,'model/AssemblyManager.js')));
const {default:Constraints}=await import(moduleUrl(path.join(js,'constraint/ConstraintManager.js')));
const {default:History}=await import(moduleUrl(path.join(js,'history/HistoryManager.js')));
const {default:Annotations}=await import(moduleUrl(path.join(js,'annotation/SceneAnnotationManager.js')));
const {featureWorldPoint}=await import(moduleUrl(path.join(js,'constraint/AssemblyMateMath.js')));

const localFiles=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?localFiles(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
for(const file of localFiles(js).filter(file=>file.endsWith('.js')))assert.ok(!/from\s+['"][^'"]+\.js\?v=/.test(fs.readFileSync(file,'utf8')),`${path.relative(js,file)} 不得用带版本的相对 import 绕过统一 importmap`);
const html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
assert.ok(html.includes('@click="startProfileDraw(\'FREE\',{fixedLengthMm:0,continueDrawing:false})"'),'底栏绘制调用已注册的唯一画笔处理');
assert.ok(!html.includes('selectDrawMode('),'不得保留未注册的底栏事件入口');

function editor(){
  const e=Object.create(Editor.prototype);
  Object.assign(e,{parts:[],meshes:[],selected:null,selectedMeshes:[],selectionFilter:'ALL',partSequence:1,captures:0,changes:0,userDimensions:[],projectSettings:{contactToleranceMm:.5,collisionToleranceMm:.5},
    sceneManager:{scene:new THREE.Scene(),transformControls:{attach(){},detach(){}},setSelections(){},clearSnapPreview(){},hideSnapFeedback(){}},
    profileGripEditor:{refresh(){}},annotationManager:{requestRefresh(){}},snapManager:{clearLock(){}},accessoryMountManager:{refreshForTargets(){}},machiningManager:{removeGeneratedByConnection(){}},
    emitStats(){},updateDimensions(){},emitProjectChanged(){this.changes++;},nextDisplayId(){return 'P-'+this.partSequence++;},
    insertPart(part){const mesh=Factory.create(part);mesh.position.set(part.position.x,part.position.y,part.position.z);mesh.rotation.set(part.rotation.x,part.rotation.y,part.rotation.z);mesh.updateMatrixWorld(true);this.parts.push(part);this.meshes.push(mesh);this.sceneManager.scene.add(mesh);return mesh;},
    exportProject(){return structuredClone({parts:this.parts,assemblies:this.assemblyManager.assemblies,connections:this.connectionManager.export(),constraints:this.constraintManager.export()});},
    restoreProject(p){this.connectionManager.clear();for(const m of this.meshes){m.removeFromParent();Factory.disposeObject(m);}this.parts=[];this.meshes=[];for(const part of structuredClone(p.parts))this.insertPart(part);this.assemblyManager.load(p.assemblies);this.connectionManager.load(p.connections);this.constraintManager.load(p.constraints);this.select(null);}
  });
  e.assemblyManager=new Assemblies(e);e.connectionManager=new Connections(e);e.constraintManager=new Constraints(e);e.historyManager=new History(e);
  const part=(id,length,position,rotation)=>({id,displayId:id,type:'PROFILE',name:id,position,rotation,locked:false,hidden:false,dimensions:{length,sectionSize:[30,30]},designProfile:{profileId:'DESIGN-3030',faceClosures:[]},profilePath:{type:'LINE',length},machiningItems:[]});
  const a=e.insertPart(part('A',300,{x:165,y:15,z:120},{x:0,y:Math.PI/2,z:0})),b=e.insertPart(part('B',500,{x:0,y:250,z:120},{x:-Math.PI/2,y:0,z:0}));
  e.selectMany([a,b]);e.connectionManager.createConnection(a,b,{designType:'ANGLE_BRACKET',sourceEnd:'START',targetFace:'RIGHT'});
  e.assemblyManager.create(['A','B'],'原组件');e.historyManager.reset();return e;
}
function dispose(e){e.connectionManager.clear();for(const mesh of e.meshes)Factory.disposeObject(mesh);}
function expectGraph(e,copies,originalAssembly){
  assert.equal(copies.length,2);assert.equal(e.parts.length,4);assert.equal(e.connectionManager.connections.length,2);
  assert.equal(e.assemblyManager.assemblies.length,2);assert.equal(new Set(copies.map(m=>m.userData.part.assemblyId)).size,1);
  assert.notEqual(copies[0].userData.part.assemblyId,originalAssembly);
  assert.equal(e.assemblyManager.partIds(originalAssembly).length,2);
  assert.ok(e.connectionManager.connections.every(c=>c.validation.ok));
}
const outcomes={};
{
  const helper=new THREE.Group();helper.userData.connectionId='connection';
  const nested=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());nested.userData.part={id:'preview-label'};helper.add(nested);
  assert.equal(Scene.prototype.resolveRoot.call({},nested),helper,'嵌套预览标签不得抢走连接实体的拾取');
  helper.userData.connectionId=null;assert.equal(Scene.prototype.resolveRoot.call({},nested),nested);Factory.disposeObject(helper);
  outcomes.nestedConnectionPick=true;outcomes.canonicalModuleImports=true;
}
{
  const e=editor(),assembly=e.parts[0].assemblyId,before=JSON.stringify(e.exportProject()),h=e.historyManager.index;
  const copies=e.duplicateArray({axis:'Z',count:2,spacing:200});expectGraph(e,copies,assembly);
  assert.equal(e.historyManager.index,h+1);assert.equal(e.changes,1);
  e.historyManager.undo();assert.equal(JSON.stringify(e.exportProject()),before);
  e.historyManager.redo();assert.equal(e.parts.length,4);assert.equal(e.connectionManager.connections.length,2);
  e.select(e.meshes[0]);assert.equal(e.selectedMeshes.length,2,'原组件不会带选阵列副本');
  outcomes.linearGraphAndHistory=true;dispose(e);
}
{
  const e=editor(),assembly=e.parts[0].assemblyId;
  const copies=e.circularArray({axis:'Y',count:2,angleDeg:180,centerMode:'WORLD_ORIGIN'});expectGraph(e,copies,assembly);
  outcomes.circularGraph=true;dispose(e);
}
{
  const e=editor(),assembly=e.parts[0].assemblyId;
  const copies=e.mirrorSelected({axis:'Z',copy:true,planeMode:'WORLD_ORIGIN'});expectGraph(e,copies,assembly);
  assert.equal(e.connectionManager.connections[1].sourceEnd,'END');
  outcomes.mirrorGraphAndEndReference=true;dispose(e);
}
{
  const e=editor(),before=JSON.stringify(e.exportProject()),h=e.historyManager.index;
  e.parts[0].locked=true;const locked=JSON.stringify(e.exportProject());
  assert.throws(()=>e.mirrorSelected({axis:'X',copy:false}),/锁定/);assert.equal(JSON.stringify(e.exportProject()),locked);assert.equal(e.historyManager.index,h);
  e.parts[0].locked=false;e.assemblyManager.get(e.parts[0].assemblyId).locked=true;
  assert.throws(()=>e.mirrorSelected({axis:'X',copy:false}),/锁定/);e.assemblyManager.get(e.parts[0].assemblyId).locked=false;
  assert.equal(JSON.stringify(e.exportProject()),before);
  e.select(e.meshes[0],{individual:true});
  assert.throws(()=>e.mirrorSelected({axis:'Z',copy:true,planeMode:'SELECTION_CENTER'}),/完全重叠/);
  assert.throws(()=>e.duplicateArray({spacing:0}),/不能为 0/);assert.equal(e.parts.length,2);assert.equal(e.historyManager.index,h);
  outcomes.lockInheritanceAndNoopGuard=true;dispose(e);
}
{
  const e=editor(),connection=e.connectionManager.connections[0],helper=e.connectionManager.helperMeshes.get(connection.id);
  e.setPartVisibility('A',false);assert.equal(helper.visible,false);assert.equal(e.connectionManager.connections.length,1);
  e.showAll();assert.equal(helper.visible,true);e.setAssemblyVisibility(e.parts[0].assemblyId,false);assert.equal(helper.visible,false);
  e.historyManager.undo();assert.ok([...e.connectionManager.helperMeshes.values()].every(m=>m.visible));
  assert.equal(e.selectConnection(connection.id),true);assert.equal(e.selectedMeshes.length,2);
  outcomes.visibilityAndConnectionSelection=true;dispose(e);
}
{
  const e=editor(),source=e.meshes[0],target=e.meshes[1];source.userData.lastSnap={targetProfileId:'B',sourceEnd:'START',targetFace:'RIGHT'};
  e.constraintManager.createRigidMateFromLastSnap(source);const copies=e.circularArray({axis:'Y',count:2,angleDeg:180});
  assert.equal(e.constraintManager.constraints.length,2);const c=e.constraintManager.constraints[1];
  assert.ok(copies.some(m=>m.userData.part.id===c.sourcePartId));assert.ok(copies.some(m=>m.userData.part.id===c.targetPartId));
  assert.deepEqual(c.referenceRelativeQuaternion.length,4);
  const saved=copies.map(m=>m.position.toArray());e.constraintManager.solveForChangedParts(copies.map(m=>m.userData.part.id));
  copies.forEach((m,i)=>assert.ok(m.position.distanceTo(new THREE.Vector3(...saved[i]))<1e-5));
  e.selectMany(e.meshes.filter(m=>['A','B'].includes(m.userData.part.id)));assert.throws(()=>e.mirrorSelected({copy:false}),/约束/);
  outcomes.constraintRemappingAndGuard=true;dispose(e);
}
{
  const e=editor(),original=e.assemblyManager.get(e.parts[0].assemblyId);original.configurator='SIMPLE_FRAME';original.parameters={width:300};
  e.parts.forEach(p=>{p.configuratorId=original.id;p.configuratorRole='FRAME';});
  const copies=e.duplicateArray({axis:'Z',count:2,spacing:200}),assembly=e.assemblyManager.get(copies[0].userData.part.assemblyId);
  assert.deepEqual(original.parameters,{width:300});assert.equal(original.configurator,'SIMPLE_FRAME');
  assert.equal(assembly.parameters,null);assert.equal(assembly.configurator,null);assert.ok(copies.every(m=>!m.userData.part.configuratorId));
  outcomes.parameterizedCopiesExplicitlyDetached=true;dispose(e);
}
{
  const e=editor(),connection=e.connectionManager.connections[0];
  const accessory=(id,properties)=>{const p={id,type:'ACCESSORY',hidden:false,...properties},m=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());m.userData.part=p;e.parts.push(p);e.meshes.push(m);e.sceneManager.scene.add(m);return m;};
  const mounted=accessory('mounted',{mountReference:{targetPartId:'A'}}),generated=accessory('generated',{generatedByConnectionId:connection.id}),ownHidden=accessory('own-hidden',{hidden:true,mountReference:{targetPartId:'A'}});
  e.setPartVisibility('A',false);assert.equal(mounted.visible,false);assert.equal(generated.visible,false);
  assert.equal(mounted.userData.part.hidden,false,'继承隐藏不覆盖配件自己的显示设置');
  e.setPartVisibility('A',true);assert.equal(mounted.visible,true);assert.equal(generated.visible,true);assert.equal(ownHidden.visible,false);
  outcomes.mountedAndDerivedVisibility=true;dispose(e);
}
{
  const e=editor(),before=JSON.stringify(e.exportProject()),selected=e.selectedMeshes.map(m=>m.userData.part.id),h=e.historyManager.index;
  const insert=e.insertPart.bind(e);let insertions=0;
  e.insertPart=(...args)=>{if(++insertions===2)throw new Error('模拟第二个副本失败');return insert(...args);};
  assert.throws(()=>e.duplicateArray({axis:'Z',count:3,spacing:200}),/第二个副本失败/);
  assert.equal(JSON.stringify(e.exportProject()),before);assert.equal(e.historyManager.index,h);
  assert.deepEqual(e.selectedMeshes.map(m=>m.userData.part.id),selected);
  outcomes.batchAtomicRollback=true;dispose(e);
}
{
  const e=editor(),source=e.meshes[0],target=e.meshes[1];
  const sf={partId:source.userData.part.id,type:'PROFILE_END',end:'START',stationS:0},tf={partId:target.userData.part.id,type:'PROFILE_FACE',face:'RIGHT',stationS:15};
  source.userData.lastSnap={targetProfileId:target.userData.part.id,sourceEnd:'START',targetFace:'RIGHT'};
  e.constraintManager.createRigidMateFromLastSnap(source,{semantic:{sourceFeature:sf,targetFeature:tf},solverMode:'SEMANTIC'});
  const original=featureWorldPoint(e,tf),copies=e.mirrorSelected({axis:'Z',planeMode:'WORLD_ORIGIN'}),constraint=e.constraintManager.constraints[1];
  assert.equal(constraint.semantic.sourceFeature.end,'END');assert.equal(constraint.semantic.sourceFeature.stationS,300);
  assert.equal(constraint.semantic.targetFeature.stationS,485);
  assert.ok(featureWorldPoint(e,constraint.semantic.targetFeature).distanceTo(new THREE.Vector3(original.x,original.y,-original.z))<1e-5);
  const positions=copies.map(m=>m.position.clone());e.constraintManager.solveForChangedParts(copies.map(m=>m.userData.part.id));
  copies.forEach((m,i)=>assert.ok(m.position.distanceTo(positions[i])<1e-5,'镜像后的语义接头不能跳到立柱另一端'));
  outcomes.mirroredSemanticStation=true;dispose(e);
}
{
  const e=editor();e.parts[0].machiningItems=[{id:'manual-hole',type:'THROUGH_HOLE',stationS:120}];
  e.meshes[0].userData.lastSnap={targetProfileId:'B',sourceEnd:'START',targetFace:'RIGHT'};
  const original=e.constraintManager.createRigidMateFromLastSnap(e.meshes[0]);original.sourceAnchor.machiningFeatureId='manual-hole';
  const copies=e.duplicateArray({axis:'Z',count:2,spacing:200}),constraint=e.constraintManager.constraints[1],hole=copies[0].userData.part.machiningItems[0];
  assert.notEqual(hole.id,'manual-hole');assert.equal(constraint.sourceAnchor.machiningFeatureId,hole.id);
  outcomes.manualFeatureIdRemapping=true;dispose(e);
}
{
  const e=editor(),annotations=Object.create(Annotations.prototype),labels=[];
  Object.assign(annotations,{editor:e,sceneManager:e.sceneManager,options:{showPartDimensions:false},addDimension(a,b,o,text){labels.push(text);}});
  e.select(null);annotations.addProfileDimensions();assert.equal(labels.length,0);
  e.featureHoverManager={mesh:e.meshes[1],clear(){this.mesh=null;}};annotations.addProfileDimensions();assert.equal(labels.length,1);
  e.featureHoverManager.mesh=null;labels.length=0;
  e.select(e.meshes[0],{individual:true});annotations.addProfileDimensions();assert.equal(labels.length,1);
  labels.length=0;annotations.options.showPartDimensions=true;annotations.addProfileDimensions();assert.equal(labels.length,2);
  outcomes.contextDimensionsAndAllOption=true;dispose(e);
}
console.log(JSON.stringify({ok:true,version:'0.75.36',...outcomes}));
