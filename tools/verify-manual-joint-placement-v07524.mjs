import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {editor,joint,dispose,signature,countMeshes,THREE,load} from './verify-connection-batch-v07520.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {connectionComponent,connectionSpecs,connectionPlacementMode,preferredConnectionSpec}=await load('model/ComponentCatalog.js');
const {default:AccessoryPlacement}=await load('interaction/AccessoryPlacementManager.js');
const {default:Scene}=await load('core/SceneManager.js');
const {default:Schema}=await load('io/ProjectSchema.js');
const definition=connectionComponent({type:'CORNER_CUBE',spec:preferredConnectionSpec('CORNER_CUBE',30)});
const outcomes={};

function corner(){
  const e=editor();
  const column=e.addProfile('DESIGN-3030',500,{position:{x:0,y:250,z:0},rotation:{x:-Math.PI/2,y:0,z:0},select:false,captureHistory:false});
  const a=e.addProfile('DESIGN-3030',300,{position:{x:165,y:250,z:0},rotation:{x:0,y:Math.PI/2,z:0},select:false,captureHistory:false});
  const b=e.addProfile('DESIGN-3030',200,{position:{x:0,y:250,z:115},select:false,captureHistory:false});
  for(const [mesh,face] of [[a,'RIGHT'],[b,'BACK']])e.connectionManager.createConnection(mesh,column,{designType:'ANGLE_BRACKET',sourceEnd:'START',targetFace:face,sourceMountFace:'FRONT',sourceMountFaces:['FRONT','BACK'],componentDefinition:definition});
  e.historyManager.reset();return {e,column,a,b,point:new THREE.Vector3(15,250,15)};
}
function checkedCorner(f){
  const m=f.e.connectionPlacementManager;m.begin('ANGLE_BRACKET',{componentDefinition:definition});
  const candidate=m.resolveDirectJoint({object:f.a,point:f.point});
  assert.ok(candidate?.valid,candidate?.message||'两根梁的内角必须有实际安装候选');
  assert.equal(candidate.item.geometry.jointKind,'SIDE_CORNER');return candidate;
}
function commit(m,c){return m.installConnection(c.source,c.target,c.item.type,'单击吸附',{sourceMountFace:c.item.geometry.sourceMountFace});}

{
  const first=connectionComponent({type:'CORNER_CUBE',spec:connectionSpecs('CORNER_CUBE')[0].value});
  assert.equal(first.dimensions.size,15);assert.equal(connectionPlacementMode(first),'UNSUPPORTED');assert.equal(connectionPlacementMode(first,true),'FREE');
  assert.equal(definition.dimensions.size,30);assert.equal(connectionPlacementMode(definition),'JOINT');
  for(const series of [20,30,40])assert.equal(connectionComponent({type:'CORNER_CUBE',spec:preferredConnectionSpec('CORNER_CUBE',series)}).dimensions.size,series);
  const source=fs.readFileSync(path.join(root,'src/main/resources/static/js/app.js'),'utf8');
  assert.ok(source.includes("if(placementMode==='UNSUPPORTED')return notify("));assert.ok(!source.includes('catalogConnectionForm.free||!designType'));
  outcomes.explicitFreeAndCompatibleDefault=true;
}
{
  const f=corner(),{e}=f,m=e.connectionPlacementManager,before=signature(e),h=e.historyManager.index;
  const old=e.connectionManager.export(),poses=[...e.connectionManager.helperMeshes.values()].map(g=>g.children.map(c=>({p:c.position.clone(),q:c.quaternion.clone()})));
  const c=checkedCorner(f);assert.equal(signature(e),before);assert.equal(countMeshes(e),4);assert.ok(c.item.geometry.componentPorts.ok);
  const inner=m.candidates.filter(c=>c.valid&&c.item.geometry.jointKind==='SIDE_CORNER');
  assert.ok(inner.length>=1&&inner.length<=2);assert.equal(new Set(inner.map(c=>c.key)).size,inner.length,'重复的默认/显式安装面不得形成重复候选');
  m.directPreview=c;m.renderPreview();const preview=m.previewGroup.children[0],p=preview.position.clone(),q=preview.quaternion.clone();
  const installed=commit(m,c);assert.ok(installed);assert.equal(installed.jointKind,'SIDE_CORNER');assert.equal(installed.status,'DESIGN_VALID');
  assert.equal(e.parts.length,3);assert.equal(e.connectionManager.connections.length,3);assert.equal(countMeshes(e),5);assert.equal(e.historyManager.index,h+1);
  assert.deepEqual(e.connectionManager.export().slice(0,2),old,'原立柱连接与其两侧角码不能被内角件覆盖');
  old.forEach((row,i)=>e.connectionManager.helperMeshes.get(row.id).children.forEach((mesh,j)=>{assert.ok(mesh.position.distanceTo(poses[i][j].p)<1e-6);assert.ok(mesh.quaternion.angleTo(poses[i][j].q)<1e-6);}));
  const mesh=e.connectionManager.helperMeshes.get(installed.id).children[0];assert.ok(mesh.position.distanceTo(p)<1e-6);assert.ok(mesh.quaternion.angleTo(q)<1e-6);
  const saved=e.exportProject();Schema.assertCurrentConnections(saved.connections);e.restoreProject(saved);assert.equal(countMeshes(e),5);assert.equal(e.connectionManager.connections.at(-1).status,'DESIGN_VALID');
  e.historyManager.undo();assert.equal(signature(e),before);assert.equal(countMeshes(e),4);e.historyManager.redo();assert.equal(countMeshes(e),5);
  assert.throws(()=>e.connectionManager.configureManufacturingRule(e.connectionManager.connections.at(-1),'ANGLE_BRACKET_30_M6'),/内角.*设计参考/);
  const s=signature(e),index=e.historyManager.index;m.begin('ANGLE_BRACKET',{componentDefinition:definition});
  assert.equal(commit(m,{...c,source:{...c.source,mesh:e.getMeshByPartId(c.source.mesh.userData.part.id)},target:{...c.target,mesh:e.getMeshByPartId(c.target.mesh.userData.part.id)}}),null);
  assert.equal(signature(e),s);assert.equal(e.historyManager.index,index);
  outcomes.sideCornerPortsAndPreviewCommit=true;outcomes.preserveOldFourComponents=true;outcomes.cornerHistoryReloadAndManufacturingGuard=true;outcomes.duplicateRejectedReadOnly=true;dispose(e);
}
{
  const e=joint(),m=e.connectionPlacementManager,source=e.meshes[0],target=e.meshes[1];
  const c=e.connectionManager.createConnection(source,target,{designType:'ANGLE_BRACKET',sourceEnd:'START',targetFace:'RIGHT',sourceMountFace:'FRONT',componentDefinition:definition});
  const id=c.id,first=e.connectionManager.helperMeshes.get(id).children[0].position.clone(),h=e.historyManager.index;
  m.begin('ANGLE_BRACKET',{componentDefinition:definition});
  const choice=m.resolveDirectJoint({object:target,point:new THREE.Vector3(15,220,0)});assert.ok(choice?.valid,choice?.message);assert.equal(choice.item.geometry.sourceMountFace,'BACK');
  assert.ok(commit(m,choice));assert.equal(e.connectionManager.connections.length,1);assert.equal(e.connectionManager.connections[0].id,id);assert.deepEqual(c.designComponentMountFaces,['FRONT','BACK']);assert.equal(countMeshes(e),2);assert.equal(e.historyManager.index,h+1);
  assert.ok(e.connectionManager.helperMeshes.get(id).children[0].position.distanceTo(first)<1e-6);
  outcomes.manualAddsMissingSideNotReplacement=true;dispose(e);
}
{
  const e=joint(),m=e.connectionPlacementManager,source=e.meshes[0],target=e.meshes[1];
  const c=e.connectionManager.createConnection(source,target,{designType:'ANGLE_BRACKET',sourceEnd:'START',targetFace:'RIGHT',sourceMountFace:'FRONT',componentDefinition:definition});
  m.begin('ANGLE_BRACKET',{componentDefinition:definition});
  const contexts=[];m.pushJointCandidate(contexts,{mesh:source,feature:{type:'PROFILE_END',end:'START'},point:new THREE.Vector3(15,250,0)},{mesh:target,feature:{type:'PROFILE_FACE',face:'RIGHT',stationS:250},point:new THREE.Vector3(15,250,0)},new THREE.Vector3(15,250,0),{sourceMountFace:'BACK'});
  source.userData.part.locked=true;const locked=signature(e),h=e.historyManager.index;
  assert.equal(m.evaluateCandidate(contexts[0]).valid,false);assert.match(m.evaluateCandidate(contexts[0]).message,/锁定/);assert.equal(signature(e),locked);assert.equal(e.historyManager.index,h);
  source.userData.part.locked=false;c.status='INVALID';c.validation.ok=false;const invalid=signature(e);
  assert.equal(m.evaluateCandidate(contexts[0]).valid,false);assert.match(m.evaluateCandidate(contexts[0]).message,/失效连接/);assert.equal(signature(e),invalid);
  outcomes.lockedAndInvalidExistingProtected=true;dispose(e);
}
{
  const f=corner(),c=checkedCorner(f),{e}=f,m=e.connectionPlacementManager;
  const abstract=e.connectionManager.recommendDesignFor(c.source.mesh,c.target.mesh,{sourceEnd:c.source.feature.end,targetFace:c.target.feature.face,sourceMountFace:c.item.geometry.sourceMountFace}).find(item=>item.type==='ANGLE_BRACKET');
  assert.equal(abstract.valid,false,'旧端中心 / 制造连接不能借设计角码扩大站位范围');
  const obstacle=e.addProfile('DESIGN-2020',20,{position:{x:c.envelope.center.x,y:c.envelope.center.y,z:c.envelope.center.z},select:false,captureHistory:false});
  const contexts=[];m.pushJointCandidate(contexts,c.source,c.target,c.source.point,{sourceMountFace:c.item.geometry.sourceMountFace});
  assert.equal(m.evaluateCandidate(contexts[0]).valid,false);assert.match(m.evaluateCandidate(contexts[0]).message,/安装空间/);
  e.removePartByIdSilently(obstacle.userData.part.id);
  const source=c.source.mesh;source.position.addScaledVector(new THREE.Vector3(0,0,1).transformDirection(source.matrixWorld),2);source.updateMatrixWorld(true);e.syncPartFromMesh(source);
  assert.equal(m.evaluateCandidate(contexts[0]).valid,false);assert.equal(commit(m,c),null);
  outcomes.actualPortsNotToleranceExpansion=true;outcomes.cornerThirdPartyAndGapGuards=true;dispose(e);
}
{
  const f=corner(),{e}=f,q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,.6,-.3)),offset=new THREE.Vector3(200,-40,80);
  for(const mesh of e.meshes){mesh.position.applyQuaternion(q).add(offset);mesh.quaternion.premultiply(q);mesh.updateMatrixWorld(true);e.syncPartFromMesh(mesh);}
  e.connectionManager.connections.forEach(c=>e.connectionManager.rebuild(c));f.point.applyQuaternion(q).add(offset);
  const c=checkedCorner(f);assert.ok(commit(e.connectionPlacementManager,c));assert.equal(countMeshes(e),5);assert.ok(e.connectionManager.connections.every(c=>c.status==='DESIGN_VALID'));
  e.assemblyManager.create(e.parts.map(p=>p.id),'内角组件');e.selectMany(e.meshes);e.historyManager.capture();e.duplicateArray({axis:'Z',count:2,spacing:600});
  assert.equal(e.parts.length,6);assert.equal(e.connectionManager.connections.length,6);assert.equal(e.connectionManager.connections.filter(c=>c.jointKind==='SIDE_CORNER').length,2);assert.ok(e.connectionManager.connections.every(c=>c.status==='DESIGN_VALID'));
  outcomes.rotatedCornerAndWholeGraphCopy=true;dispose(e);
}
{
  const e=editor(),host=e.addProfile('DESIGN-3030',200,{position:{x:0,y:250,z:0},select:false,captureHistory:false}),m=new AccessoryPlacement(e);
  const normal=new THREE.Vector3(0,1,0),point=new THREE.Vector3(0,265,0);let planeCalls=0;
  e.sceneManager.pickHit=()=>({object:host,point:point.clone(),surfaceNormal:normal.clone()});e.sceneManager.worldPointOnPlane=()=>{planeCalls++;return new THREE.Vector3(4000,0,3000);};
  const first=connectionComponent({type:'CORNER_CUBE',spec:connectionSpecs('CORNER_CUBE')[0].value});m.begin(first);
  const candidate=m.resolveFree({clientX:20,clientY:30});assert.equal(planeCalls,0);assert.equal(candidate.valid,true);assert.equal(candidate.targetPart.id,host.userData.part.id);assert.ok(candidate.transform.position.y>=265);
  assert.equal(e.parts.length,1);assert.equal(e.connectionManager.connections.length,0);assert.equal(m.resolveFree({}).free,true);
  e.sceneManager.pickHit=()=>null;assert.ok(m.resolveFree({}).transform.position.x>3000);assert.equal(planeCalls,1);
  m.cancel();outcomes.freeHitSurfaceBeforeGround=true;dispose(e);
}
{
  const parent=new THREE.Group(),child=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));parent.userData.part={id:'surface'};parent.rotation.set(.2,.5,.4);parent.add(child);parent.updateMatrixWorld(true);
  const local=new THREE.Vector3(0,1,0),scene=Object.create(Scene.prototype);scene.raycast=()=>[{object:child,point:new THREE.Vector3(4,5,6),face:{normal:local}}];
  const hit=scene.pickHit({},[parent]);assert.equal(hit.object,parent);assert.ok(hit.surfaceNormal.distanceTo(local.clone().transformDirection(child.matrixWorld))<1e-6);assert.deepEqual(local.toArray(),[0,1,0]);
  outcomes.actualChildWorldSurfaceNormal=true;
}
console.log(JSON.stringify({ok:true,version:'0.75.32',...outcomes}));
