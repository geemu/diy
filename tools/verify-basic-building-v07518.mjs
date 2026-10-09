import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const vendor=path.join(root,'target/classes/static/vendor/three'),threeUrl=pathToFileURL(path.join(vendor,'build/three.module.min.js')).href,cache=new Map();
function moduleUrl(file){
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>"from '"+(spec==='three'?threeUrl:spec.startsWith('three/addons/')?moduleUrl(path.join(vendor,'examples/jsm',spec.slice(13))):spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec)+"'");
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl);
const load=async file=>await import(moduleUrl(path.join(js,file)));
const {default:Factory}=await load('geometry/ProfileGeometryFactory.js');
const {default:Alignment}=await load('interaction/QuickAlignmentManager.js');
const {default:Batch}=await load('connection/ConnectionBatchManager.js');
const {default:Connections}=await load('connection/ConnectionManager.js');
const {default:Placement}=await load('connection/ConnectionPlacementManager.js');
const {default:Resolver}=await load('connection/AutoConnectionResolver.js');
const {default:Snap}=await load('snap/SnapManager.js');
const {default:Feedback}=await load('interaction/InterferenceFeedbackManager.js');
const {default:Draw}=await load('drawing/ProfileDrawTool.js');
function profile(id,length=300,position=[0,15,0],rotation=[0,Math.PI/2,0],size=30){
  const part={id,displayId:id,name:id,type:'PROFILE',position:{x:position[0],y:position[1],z:position[2]},rotation:{x:rotation[0],y:rotation[1],z:rotation[2]},dimensions:{sectionSize:[size,size],length},profilePath:{type:'LINE',length},designProfile:{profileId:'DESIGN-'+size+size,series:size,slotWidth:size===20?6:8,faceClosures:[]},machiningItems:[]};
  const mesh=Factory.create(part);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.updateMatrixWorld(true);return mesh;
}
function editor(meshes){
  const e={meshes,parts:meshes.map(mesh=>mesh.userData.part),selected:meshes.at(-1),selectedMeshes:meshes,captures:0,changes:0,projectSettings:{contactToleranceMm:.5,collisionToleranceMm:.5},
    sceneManager:{scene:new THREE.Scene(),transformControls:{detach(){},attach(){},enabled:true},setSelections(){},clearSnapPreview(){},hideSnapFeedback(){}},
    profileGripEditor:{refresh(){}},constraintManager:{listForPart(){return [];},constraints:[]},assemblyManager:{get(){return null;},isPartEffectivelyHidden(part){return !!part.hidden;}},machiningManager:{removeGeneratedByConnection(){}},
    isMeshTransformable(mesh){return !!mesh&&!mesh.userData.part.locked;},getMeshByPartId(id){return this.meshes.find(mesh=>mesh.userData.part.id===id);},
    syncPartFromMesh(mesh){const p=mesh.userData.part;p.position={x:mesh.position.x,y:mesh.position.y,z:mesh.position.z};p.rotation={x:mesh.rotation.x,y:mesh.rotation.y,z:mesh.rotation.z};},
    rebuildLinearProfileVisual(mesh){Factory.rebuildLinearGroup(mesh,mesh.userData.part);},
    accessoryMountManager:{refreshForTargets(){}},updateDimensions(){},emitStats(){},emitProjectChanged(){this.changes++;},
    exportProject(){return {parts:this.meshes.map(mesh=>structuredClone(mesh.userData.part)),connections:structuredClone(this.connectionManager.connections)};},
    restoreProject(project){this.connectionManager.clear();this.parts=structuredClone(project.parts);this.meshes=this.parts.map(p=>{const m=Factory.create(p);m.position.set(p.position.x,p.position.y,p.position.z);m.rotation.set(p.rotation.x,p.rotation.y,p.rotation.z);m.updateMatrixWorld(true);return m;});this.selected=this.meshes.at(-1);this.selectedMeshes=this.meshes;this.connectionManager.connections=structuredClone(project.connections);},
    selectMany(meshes){this.selectedMeshes=meshes;this.selected=meshes.at(-1);}};
  e.historyManager={capture(){e.captures++;}};
  e.connectionManager=new Connections(e);e.connectionPlacementManager=new Placement(e);e.autoConnectionResolver=new Resolver(e);e.snapManager=new Snap(e);
  e.interferenceFeedbackManager=Object.create(Feedback.prototype);e.interferenceFeedbackManager.editor=e;e.interferenceFeedbackManager.refresh=()=>({});
  return e;
}
function signature(e){return JSON.stringify(e.exportProject());}
const outcomes={};
{
  const e=editor([profile('A',500,[-300,15,-90]),profile('B',300,[200,70,150])]),align=new Alignment(e),before=signature(e),poses=e.meshes.map(mesh=>mesh.position.toArray());
  align.begin();const preview=align.preview('CENTER',{referenceId:'B',axes:['Y','Z']});
  assert.equal(signature(e),before);assert.equal(e.captures,0);assert.deepEqual(e.meshes.map(mesh=>mesh.position.toArray()),poses);assert.equal(preview.changedCount,1);
  assert.deepEqual(preview.rows[0].delta,[0,55,240]);assert.equal(e.sceneManager.transformControls.enabled,false);
  align.cancel();assert.equal(signature(e),before);assert.equal(align.previewGroup,null);assert.equal(e.captures,0);assert.equal(e.sceneManager.transformControls.enabled,true);
  align.begin();align.preview('CENTER',{referenceId:'B',axes:['Y','Z']});align.confirm();assert.deepEqual(e.meshes[0].position.toArray(),[-300,70,150]);assert.equal(e.captures,1);assert.equal(e.changes,1);
  const count=e.captures;align.execute('CENTER',{referenceId:'B',axes:['Y','Z']});assert.equal(e.captures,count,'无变化不增加历史');
  e.meshes[0].position.y=15;e.syncPartFromMesh(e.meshes[0]);align.begin();align.preview('CENTER',{referenceId:'B',axes:['Y']});e.meshes[0].userData.part.name='变化';
  assert.throws(()=>align.confirm(),/重新预览/);assert.equal(e.captures,count);align.cancel();
  e.meshes[1].userData.part.locked=true;align.execute('CENTER',{referenceId:'B',axes:['Y']});assert.equal(e.meshes[0].position.y,70,'锁定基准可保持不动');
  e.meshes[0].position.y=15;e.syncPartFromMesh(e.meshes[0]);e.meshes[0].userData.part.locked=true;assert.throws(()=>align.execute('CENTER',{referenceId:'B',axes:['Y']}),/锁定/);
  e.meshes[0].userData.part.locked=false;e.assemblyManager.get=id=>id?{parameters:{}}:null;e.meshes[0].userData.part.assemblyId='frame';assert.throws(()=>align.execute('CENTER',{referenceId:'B',axes:['Y']}),/参数化/);
  outcomes.alignmentReadOnlyCancel=true;outcomes.multiAxisReference=true;outcomes.noopAndStaleGuard=true;outcomes.lockedReferenceAndParameterGuard=true;
}
{
  const a=profile('A',500,[-100,15,0]),b=profile('B',300,[200,15,80],[0,-Math.PI/2,0]),e=editor([a,b]),align=new Alignment(e);
  const endpoint=(mesh,end)=>mesh.localToWorld(new THREE.Vector3(0,0,(end==='START'?-1:1)*mesh.userData.part.dimensions.length/2));
  align.execute('END',{referenceId:'B',end:'START'});assert.ok(Math.abs(endpoint(a,'START').x-endpoint(b,'START').x)<1e-6);assert.ok(Math.abs(a.position.z)<1e-6);
  align.execute('END',{referenceId:'B',end:'END'});assert.ok(Math.abs(endpoint(a,'END').x-endpoint(b,'END').x)<1e-6);assert.ok(Math.abs(a.position.z)<1e-6);
  outcomes.explicitABWithOppositeAxes=true;
}
{
  const source=profile('横梁',300,[600,140,150]),target=profile('立柱',500,[0,250,0],[-Math.PI/2,0,0]),e=editor([source,target]),align=new Alignment(e),before=signature(e);
  align.begin();let state=align.preview('PERPENDICULAR',{referenceId:'立柱',targetFace:'RIGHT',end:'START',stationPercent:0});
  assert.equal(signature(e),before);assert.equal(state.collisions.length,0);align.confirm();
  const box=new THREE.Box3().setFromObject(source);assert.ok(Math.abs(box.min.y)<1e-5,'端部足迹完整退让，底面落在原点平面');
  const snap=new Snap({meshes:e.meshes});assert.ok(snap.collectCandidates(source,.1).some(c=>c.snap.targetFace==='RIGHT'&&c.delta.length()<.1));assert.ok(e.connectionManager.recommendDesignFor(source,target,{sourceEnd:'START',targetFace:'RIGHT'}).some(c=>c.valid));
  assert.deepEqual(source.scale.toArray(),[1,1,1]);assert.equal(e.captures,1);
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.7,.2)),offset=new THREE.Vector3(100,180,-90);
  target.position.applyQuaternion(q).add(offset);target.quaternion.premultiply(q);target.updateMatrixWorld(true);e.syncPartFromMesh(target);
  align.begin();state=align.preview('PERPENDICULAR',{referenceId:'立柱',targetFace:'BACK',end:'END',stationPercent:100});align.confirm();
  assert.ok(snap.collectCandidates(source,.1).some(c=>c.snap.targetFace==='BACK'&&c.snap.sourceEnd==='END'&&c.delta.length()<.1));
  target.userData.part.endCuts={START:{angleDeg:45}};assert.throws(()=>align.plan('PERPENDICULAR',{referenceId:'立柱'}),/斜切/);delete target.userData.part.endCuts;
  const short=editor([profile('大梁',100,[0,0,0],[0,0,0],40),profile('短柱',20,[0,10,0],[-Math.PI/2,0,0],40)]);
  assert.throws(()=>new Alignment(short).plan('PERPENDICULAR',{referenceId:'短柱',targetFace:'RIGHT'}),/容不下完整截面/);
  outcomes.perpendicularAutoOrientation=true;outcomes.fullFootprintAndArbitraryRotation=true;
  outcomes.shortFaceAndMiterGuard=true;
}
{
  const source=profile('梁',300,[170,20,0],[0,Math.PI/2,0],40),target=profile('柱',500,[0,250,0],[-Math.PI/2,0,0],40),e=editor([source,target]),batch=new Batch(e),before=signature(e);
  let state=batch.begin();assert.equal(state.readyCount,1,JSON.stringify(state));assert.equal(signature(e),before);assert.equal(e.captures,0);
  const row=batch.rows.find(row=>row.enabled),ghost=batch.previewGroup.children[0],pos=ghost.position.clone(),q=ghost.quaternion.clone();
  batch.toggle(row.id,false);assert.equal(batch.emit().readyCount,0);assert.throws(()=>batch.confirm(),/勾选/);batch.toggle(row.id,true);
  batch.cancel();assert.equal(signature(e),before);assert.equal(e.captures,0);
  state=batch.begin();const result=batch.confirm();assert.equal(result.createdCount,1);assert.equal(e.captures,1);assert.equal(e.changes,1);
  const connection=e.connectionManager.connections[0],installed=e.connectionManager.helperMeshes.get(connection.id).children[0];
  assert.ok(installed.position.distanceTo(pos)<1e-6);assert.ok(installed.quaternion.angleTo(q)<1e-6);assert.equal(connection.designComponent.dimensions.geometryKind,'ANGLE_BRACKET');assert.equal(connection.manufacturingRuleId,null);assert.equal(connection.autoGenerated,true);
  for(const mesh of [source,target]){mesh.position.x+=100;mesh.updateMatrixWorld(true);e.syncPartFromMesh(mesh);}
  e.connectionManager.updateConnectionsForProfiles(['梁','柱']);
  assert.ok(e.connectionManager.helperMeshes.get(connection.id).children[0].position.distanceTo(pos.clone().add(new THREE.Vector3(100,0,0)))<1e-6,'正式目录组件随接头整体平移');
  state=batch.begin();assert.equal(state.readyCount,0);assert.match(state.rows[0].message,/已有有效设计连接件/);batch.cancel();
  e.connectionManager.clear();const old=e.connectionManager.createConnection(source,target,{sourceEnd:'START',targetFace:'RIGHT',designType:'ANGLE_BRACKET'});
  state=batch.begin();assert.equal(state.readyCount,0);assert.match(state.rows[0].message,/手工/);batch.cancel();
  old.autoGenerated=true;old.userOverridden=true;state=batch.begin();assert.equal(state.readyCount,0);assert.match(state.rows[0].message,/已修改/);batch.cancel();
  old.userOverridden=false;state=batch.begin();assert.equal(state.readyCount,1);batch.confirm();assert.equal(e.connectionManager.connections.length,1);assert.equal(e.connectionManager.connections[0].id,old.id);
  e.connectionManager.clear();source.position.x+=5;source.updateMatrixWorld(true);e.syncPartFromMesh(source);
  state=batch.begin();assert.equal(state.readyCount,0);assert.ok(state.rows.some(row=>/间隙|贴合/.test(row.message)),JSON.stringify(state));batch.cancel();
  source.position.x-=5;source.updateMatrixWorld(true);e.syncPartFromMesh(source);batch.begin();target.userData.part.locked=true;assert.throws(()=>batch.confirm(),/工程已变化/);batch.cancel();
  outcomes.connectionPreviewEqualsInstalled=true;outcomes.selectedProfilesStillScanned=true;outcomes.catalogGeometryNotManufacturing=true;outcomes.manualAndDuplicateSafe=true;outcomes.gapAndStaleGuard=true;
  outcomes.componentFollowsJoint=true;
}
{
  const e=editor([profile('梁1',300,[170,20,0],[0,Math.PI/2,0],40),profile('柱1',500,[0,250,0],[-Math.PI/2,0,0],40),profile('梁2',300,[170,20,500],[0,Math.PI/2,0],40),profile('柱2',500,[0,250,500],[-Math.PI/2,0,0],40)]),batch=new Batch(e),before=signature(e);
  assert.equal(batch.begin().readyCount,2);
  const original=e.connectionManager.installDesignComponent.bind(e.connectionManager);let installs=0;
  e.connectionManager.installDesignComponent=(...args)=>{if(++installs===2)throw new Error('模拟第二处安装失败');return original(...args);};
  assert.throws(()=>batch.confirm(),/第二处安装失败/);
  assert.equal(signature(e),before);assert.equal(e.captures,0);assert.equal(e.changes,0);assert.equal(batch.active,false);assert.equal(batch.previewGroup,null);assert.equal(e.connectionManager.helperMeshes.size,0);assert.deepEqual(e.selectedMeshes.map(m=>m.userData.part.id),['梁1','柱1','梁2','柱2']);
  outcomes.batchAtomicRollback=true;
}
{
  const e=editor([profile('梁',300,[170,20,0],[0,Math.PI/2,0],40),profile('柱',500,[0,250,0],[-Math.PI/2,0,0],40)]),batch=new Batch(e);
  batch.begin();const position=batch.previewGroup.children[0].position.clone();batch.cancel();
  const obstacle=profile('障碍',60,position.toArray(),[0,0,0],40);e.meshes.push(obstacle);e.parts.push(obstacle.userData.part);
  const state=batch.begin({profileIds:['梁','柱']});assert.equal(state.readyCount,0);assert.ok(state.rows.some(row=>/安装空间.*障碍/.test(row.message)),JSON.stringify(state));batch.cancel();
  outcomes.thirdPartSpaceGuard=true;
}
{
  const tool=Object.create(Draw.prototype),point=new THREE.Vector3(),e=editor([]);
  let hidden=0,updated=0;tool.editor=e;tool.start={point};tool.hover={point:new THREE.Vector3(120,0,0)};tool.mode='FREE';tool.typedLength='350';tool.clearPreview=flag=>{if(flag!==false)hidden++;};tool.linearSegment=c=>({start:point.clone(),end:c.point.clone()});tool.lengthOverlay={update(){updated++;}};
  tool.updateSolidPreview({point:point.clone()});assert.equal(hidden,0);assert.equal(updated,1);
  let refresh=0;tool.refreshTypedPreview=()=>refresh++;tool.updateLengthDraft('');assert.equal(tool.typedLength,'');assert.equal(refresh,1);tool.updateLengthDraft('not-a-number');assert.equal(refresh,2);
  outcomes.zeroLengthInputStable=true;outcomes.clearDraftRefreshesGhost=true;
}
const html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
assert.ok(html.includes('生成连接件预览'));assert.ok(html.includes('保持不动的基准'));assert.ok(html.includes('对齐方向（可多选）'));assert.ok(!html.includes('class="quick-alignment-panel"'));
const app=fs.readFileSync(path.join(js,'app.js'),'utf8');assert.ok(app.includes('watch(catalogProfileCanvas,'),'退出审阅重新挂载目录 canvas 时恢复预览');
assert.ok(app.includes("target?.closest('button,a,summary')"),'审阅页正常按钮确认/取消不被全局 Enter 抢走');
console.log(JSON.stringify({ok:true,version:'0.75.25',...outcomes}));
