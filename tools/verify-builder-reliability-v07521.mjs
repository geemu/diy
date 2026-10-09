import assert from 'node:assert/strict';
import {editor,joint,dispose,signature,countMeshes,THREE,load} from './verify-connection-batch-v07520.mjs';
const {default:Feedback}=await load('interaction/InterferenceFeedbackManager.js');
const {default:FrameEdit}=await load('diy/FrameParameterManager.js');
const {default:Opening}=await load('configurator/FrameOpeningResolver.js');
const {default:Primitive}=await load('geometry/PrimitiveGeometryFactory.js');
const {default:Profile}=await load('geometry/ProfileGeometryFactory.js');
const {default:Panels}=await load('configurator/PanelDoorConfigurator.js');
const outcomes={};
function prepare(e){
  e.frameParameterManager=new FrameEdit(e);e.panelDoorConfigurator=new Panels(e);
  e.interferenceFeedbackManager=new Feedback(e);
  e.interferenceFeedbackManager.requestRefresh=()=>{};
  e.sceneManager.refreshSelection=()=>{};e.machiningManager.normalizeFeatures=()=>{};e.machiningManager.refreshProfile=()=>{};
  const insert=e.insertPart;e.insertPart=function(part,options={}){if(part.type==='PROFILE')return insert.call(this,part,options);const mesh=Primitive.create(part);mesh.position.set(part.position.x,part.position.y,part.position.z);mesh.rotation.set(part.rotation.x,part.rotation.y,part.rotation.z);mesh.updateMatrixWorld(true);this.parts.push(part);this.meshes.push(mesh);this.sceneManager.scene.add(mesh);if(options.select!==false)this.select(mesh);if(options.captureHistory!==false)this.historyManager.capture();return mesh;};
  return e;
}
{
  const e=joint(),b=e.connectionBatchManager;b.begin();b.confirm();const original=e.exportProject(),c=e.connectionManager.connections[0];
  e.meshes[0].position.y=15;e.syncPartFromMesh(e.meshes[0]);e.connectionManager.updateConnectionsForProfile(e.parts[0].id);
  let state=b.begin();assert.equal(state.existingCount,0);assert.equal(state.invalidCount,1);assert.equal(state.blockedCount,1);assert.equal(state.readyCount,0);assert.equal(state.rows[0].status,'INVALID_EXISTING');b.cancel();
  e.meshes[0].position.x+=1000;e.syncPartFromMesh(e.meshes[0]);e.connectionManager.updateConnectionsForProfile(e.parts[0].id);
  state=b.begin();assert.equal(state.invalidCount,1,'远离吸附范围的失效关系也必须报告');assert.equal(e.connectionManager.connections[0].id,c.id);b.cancel();e.restoreProject(original);assert.equal(countMeshes(e),2);
  outcomes.invalidExistingAndFarRelation=true;dispose(e);
}
{
  const e=joint(),b=e.connectionBatchManager;b.begin({sides:'SINGLE'});b.confirm();const before=signature(e),c=e.connectionManager.connections[0],h=e.historyManager.index,primary=c.designComponentMountFace;
  assert.equal(b.begin({supplement:false}).readyCount,0);b.cancel();assert.equal(b.begin({type:'L_BRACKET'}).readyCount,0);b.cancel();
  const state=b.begin();assert.equal(state.readyCount,1);assert.equal(state.existingCount,1);assert.match(state.rows[0].message,/仅补另一侧/);assert.equal(signature(e),before);b.cancel();assert.equal(signature(e),before);
  b.begin();assert.equal(b.confirm().createdCount,1);assert.equal(e.connectionManager.connections.length,1);assert.equal(c.designComponentMountFace,primary);assert.equal(c.designComponentMountFaces.length,2);assert.equal(e.historyManager.index,h+1);
  e.historyManager.undo();assert.equal(signature(e),before);e.historyManager.redo();assert.equal(countMeshes(e),2);
  outcomes.supplementOriginalIdentityCancelUndo=true;dispose(e);
}
{
  const e=prepare(joint()),b=e.connectionBatchManager;b.begin({sides:'SINGLE'});b.confirm();const c=e.connectionManager.connections[0];
  for(const part of e.parts)part.manufacturingProfile={profileId:'EU30-3030',slotWidth:8};
  e.connectionManager.configureManufacturingRule(c,'ANGLE_BRACKET_30_M6');assert.equal(c.status,'VALID');assert.ok(c.designComponent);assert.ok(c.generatedHardwareIds.length);assert.equal(e.connectionManager.helperMeshes.has(c.id),false);
  const before=signature(e),h=e.historyManager.index,state=b.begin();assert.equal(state.existingCount,1);assert.equal(state.invalidCount,0);assert.equal(state.blockedCount,0);assert.equal(state.readyCount,0);assert.match(state.rows[0].message,/制造方案/);assert.equal(signature(e),before);assert.equal(e.historyManager.index,h);b.cancel();
  // 正式五金已作为 Part 检查；其显示 helper 即便保留旧目录描述也不能重复当安装实体。
  const helper=new THREE.Group();helper.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial()));e.connectionManager.helperMeshes.set(c.id,helper);e.sceneManager.scene.add(helper);assert.equal(b.reservedEnvelopes().length,0);
  e.addPanel(1,1,1,{position:{x:10000,y:10000,z:10000},select:false,captureHistory:false});
  const feedback=e.interferenceFeedbackManager,seen=new Set(),classify=feedback.classify.bind(feedback);feedback.classify=(a,b)=>{seen.add(a.part.id);seen.add(b.part.id);return classify(a,b);};feedback.refresh();assert.ok(c.generatedHardwareIds.some(id=>seen.has(id)));assert.ok([...seen].every(id=>!id.startsWith('@connection:')));feedback.clear();dispose(e);outcomes.formalHardwarePreservedAndNotDoubleCounted=true;
}
{
  const e=prepare(joint()),b=e.connectionBatchManager;b.begin();b.confirm();const feedback=new Feedback(e),beforeParts=e.parts.length;
  assert.equal(feedback.refresh().count,0,'宿主与自己的派生角码不误报');
  e.addPanel(1,1,1,{position:{x:25,y:268.2,z:10},select:false,captureHistory:false});const s=feedback.refresh();assert.ok(s.count>0);assert.match(s.message,/包络检查/);assert.ok(s.issues.some(issue=>issue.connectionIds.length));assert.ok(s.partIds.every(id=>e.parts.some(p=>p.id===id)));assert.equal(e.parts.length,beforeParts+1);
  assert.ok(feedback.group.children.some(child=>child.userData.__interference));
  e.connectionManager.helperMeshes.get(e.connectionManager.connections[0].id).visible=false;assert.equal(feedback.refresh().count,0);feedback.clear();dispose(e);
  outcomes.designComponentLiveObstacleAndHostExclusion=true;
}
{
  const e=joint(),mesh=e.meshes[0];mesh.position.x+=.3;e.syncPartFromMesh(mesh);mesh.updateMatrixWorld(true);const feedback=new Feedback(e),s=feedback.refresh();assert.equal(s.count,0);assert.equal(s.contactCount,0);assert.equal(s.nearCount,1);assert.match(s.message,/尚未贴合/);assert.equal(e.connectionBatchManager.begin().readyCount,0);e.connectionBatchManager.cancel();
  mesh.position.x-=.3;e.syncPartFromMesh(mesh);mesh.updateMatrixWorld(true);assert.equal(feedback.refresh().contactCount,1);assert.equal(e.connectionBatchManager.begin().readyCount,2);feedback.clear();dispose(e);outcomes.nearContactInstallThresholds=true;
}
{
  const e=editor();for(const z of [-250,250])e.addProfile('DESIGN-3030',100,{position:{x:-500,y:15,z},rotation:{x:0,y:Math.PI/2,z:0},select:false,captureHistory:false});for(const x of [-250,250])e.addProfile('DESIGN-3030',100,{position:{x,y:15,z:0},select:false,captureHistory:false});
  const before=signature(e);assert.throws(()=>new Opening(e).resolve(e.parts.map(p=>p.id)),/没有围成框口/);assert.equal(signature(e),before);dispose(e);outcomes.disconnectedBarsNotOpening=true;
}
{
  const e=prepare(editor()),id=e.addLayeredRack({catalogId:'DESIGN-3030',width:1000,depth:500,height:1800,levels:4,centerBeamCount:1,captureHistory:false,autoConnect:false});e.historyManager.reset();
  const a=e.assemblyManager.get(id),m=e.frameParameterManager,ids=[...Object.values(a.parameters.memberIds)],before=signature(e),h=e.historyManager.index;
  const input=m.begin(id);assert.equal(input.width,1000);assert.equal(m.preview({...input,width:1200,depth:600,height:1900}).memberCount,24);assert.equal(signature(e),before);assert.equal(e.historyManager.index,h);m.cancel();assert.equal(signature(e),before);
  m.begin(id);m.preview({...input,width:1200,depth:600,height:1900});m.confirm();assert.equal(e.historyManager.index,h+1);assert.deepEqual(Object.values(a.parameters.memberIds),ids);assert.equal(a.parameters.width,1200);assert.equal(e.parts.length,24);e.historyManager.undo();assert.equal(signature(e),before);e.historyManager.redo();assert.equal(e.assemblyManager.get(id).parameters.width,1200);
  const current=m.begin(id);assert.equal(m.preview({...current,levels:5}).addedCount,5);m.confirm();assert.equal(e.parts.length,29);
  const p=e.exportProject();e.restoreProject(p);const reloaded=m.begin(id);assert.equal(m.preview({...reloaded,levels:3}).removedCount,10);m.confirm();assert.equal(e.parts.length,19);
  const movedBefore=signature(e);e.meshes[0].position.x+=1;e.syncPartFromMesh(e.meshes[0]);m.begin(id);assert.throws(()=>m.preview({...e.assemblyManager.get(id).parameters,width:1300}),/自由编辑结果/);m.cancel();e.restoreProject(JSON.parse(movedBefore));
  const part=e.parts[0];part.machiningItems=[{id:'manual-hole',type:'HOLE'}];const guarded=signature(e);m.begin(id);assert.throws(()=>m.preview({...e.assemblyManager.get(id).parameters,width:1300}),/加工/);m.cancel();assert.equal(signature(e),guarded);
  dispose(e);outcomes.frameParametersPreviewIdentityLevelsHistoryReloadAndGuards=true;
}
{
  const e=prepare(editor()),id=e.addLayeredRack({catalogId:'DESIGN-3030',width:1000,depth:500,height:1800,levels:3,centerBeamCount:0,captureHistory:false,autoConnect:false}),a=e.assemblyManager.get(id),map=a.parameters.memberIds;
  const sourcePartIds=['WIDTH:0:-1','WIDTH:0:1','DEPTH:0:-1','DEPTH:0:1'].map(key=>map[key]);
  const panel=e.panelDoorConfigurator.createPanelFromSelection({sourcePartIds,thickness:5}).panel,oldWidth=panel.dimensions.width,oldId=panel.id;e.historyManager.reset();
  const m=e.frameParameterManager,p=m.begin(id),before=signature(e);assert.equal(m.preview({...p,width:1100,depth:550}).panelCount,1);assert.equal(signature(e),before);m.confirm();assert.equal(panel.id,oldId);assert.ok(Math.abs(panel.dimensions.width-oldWidth-100)<1e-5);e.historyManager.undo();assert.equal(signature(e),before);
  for(const mesh of e.meshes.filter(mesh=>mesh.userData.part.type==='PROFILE')){mesh.position.add(new THREE.Vector3(100,50,200));mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2));mesh.position.sub(new THREE.Vector3(100,50,200)).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2).add(new THREE.Vector3(100,50,200));e.syncPartFromMesh(mesh);mesh.updateMatrixWorld(true);}
  m.begin(id);assert.ok(m.preview({...p,width:1200}).ready);m.cancel();dispose(e);outcomes.framePanelRefitAndRigidPose=true;
}
console.log(JSON.stringify({ok:true,version:'0.75.39',...outcomes}));
