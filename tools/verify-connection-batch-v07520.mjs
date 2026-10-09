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
const THREE=await import(threeUrl),load=file=>import(moduleUrl(path.join(js,file)));
const {default:Editor}=await load('core/Editor.js'),{default:Factory}=await load('geometry/ProfileGeometryFactory.js');
const {default:Connections}=await load('connection/ConnectionManager.js'),{default:Placement,connectorEnvelope,envelopesOverlap}=await load('connection/ConnectionPlacementManager.js');
const {default:Batch,BatchConnectionComponentOptions}=await load('connection/ConnectionBatchManager.js'),{default:Resolver}=await load('connection/AutoConnectionResolver.js');
const {default:Assemblies}=await load('model/AssemblyManager.js'),{default:Constraints}=await load('constraint/ConstraintManager.js'),{default:History}=await load('history/HistoryManager.js');
const {default:Generator}=await load('diy/DiyGenerator.js'),{DiyTemplateList}=await load('diy/DiyTemplateCatalog.js');
const {default:Schema}=await load('io/ProjectSchema.js'),{connectionSpecs}=await load('model/ComponentCatalog.js');
const {default:Snap}=await load('snap/SnapManager.js');
const {profileFeatureWorldPoint}=await load('model/ProfileFeatureCatalog.js');

function editor(){
  const e=Object.create(Editor.prototype);
  Object.assign(e,{parts:[],meshes:[],selected:null,selectedMeshes:[],partSequence:1,changes:0,userDimensions:[],projectSettings:{contactToleranceMm:.5,collisionToleranceMm:.5},
    sceneManager:{scene:new THREE.Scene(),transformControls:{attach(){},detach(){},enabled:true},setSelections(){},clearSnapPreview(){},hideSnapFeedback(){}},
    profileGripEditor:{refresh(){}},annotationManager:{requestRefresh(){}},snapManager:{clearLock(){}},accessoryMountManager:{refreshForTargets(){}},machiningManager:{removeGeneratedByConnection(){}},
    interferenceFeedbackManager:{refresh(){},requestRefresh(){}},fitView(){},emitStats(){},updateDimensions(){},emitProjectChanged(){this.changes++;},nextDisplayId(){return 'P-'+this.partSequence++;},
    insertPart(part,options={}){const mesh=Factory.create(part);mesh.position.set(part.position.x,part.position.y,part.position.z);mesh.rotation.set(part.rotation.x,part.rotation.y,part.rotation.z);mesh.updateMatrixWorld(true);this.parts.push(part);this.meshes.push(mesh);this.sceneManager.scene.add(mesh);if(options.select!==false)this.select(mesh);if(options.captureHistory!==false)this.historyManager.capture();return mesh;},
    exportProject(){return structuredClone({parts:this.parts,assemblies:this.assemblyManager.assemblies,connections:this.connectionManager.export(),constraints:this.constraintManager.export()});},
    restoreProject(p){this.connectionManager.clear();for(const m of this.meshes){m.removeFromParent();Factory.disposeObject(m);}this.parts=[];this.meshes=[];for(const part of structuredClone(p.parts))this.insertPart(part,{select:false,captureHistory:false});this.assemblyManager.load(p.assemblies);this.connectionManager.load(p.connections);this.constraintManager.load(p.constraints);this.select(null);}
  });
  e.assemblyManager=new Assemblies(e);e.connectionManager=new Connections(e);e.constraintManager=new Constraints(e);e.historyManager=new History(e);
  e.snapManager=new Snap(e);e.connectionPlacementManager=new Placement(e);e.autoConnectionResolver=new Resolver(e);e.connectionBatchManager=new Batch(e);e.historyManager.reset();return e;
}
function joint(y=250){
  const e=editor();
  e.addProfile('DESIGN-3030',300,{position:{x:165,y,z:0},rotation:{x:0,y:Math.PI/2,z:0},select:false,captureHistory:false});
  e.addProfile('DESIGN-3030',500,{position:{x:0,y:250,z:0},rotation:{x:-Math.PI/2,y:0,z:0},select:false,captureHistory:false});
  e.historyManager.reset();return e;
}
function dispose(e){e.connectionBatchManager.cancel();e.connectionManager.clear();for(const m of e.meshes)Factory.disposeObject(m);}
const signature=e=>JSON.stringify(e.exportProject()),outcomes={};
const countMeshes=e=>[...e.connectionManager.helperMeshes.values()].reduce((count,group)=>count+group.children.length,0);
assert.deepEqual(new Set(BatchConnectionComponentOptions.map(item=>item.value)),new Set(['L_BRACKET','ANGLE_BRACKET','CORNER_CUBE','HEAVY_CORNER','INNER_BRACKET','FLAT_PLATE','L_PLATE','T_PLATE','CROSS_PLATE']));
outcomes.nineMappedTypes=true;
{
  const e=joint(),batch=e.connectionBatchManager,before=signature(e),h=e.historyManager.index;
  const state=batch.begin();assert.equal(state.contactCount,1);assert.equal(state.readyCount,2);assert.equal(state.rows.filter(row=>row.enabled).length,2);assert.equal(batch.previewGroup.children.length,2);assert.equal(signature(e),before);
  const poses=batch.previewGroup.children.map(mesh=>({p:mesh.position.clone(),q:mesh.quaternion.clone()}));
  const result=batch.confirm();assert.equal(result.createdCount,2);assert.equal(result.connectionCount,1);assert.equal(e.historyManager.index,h+1);assert.equal(e.changes,1);
  const c=result.connections[0];assert.equal(c.designComponentMountFaces.length,2);assert.equal(c.manufacturingRuleId,null);assert.equal(e.parts.length,2);assert.equal(countMeshes(e),2);
  e.connectionManager.helperMeshes.get(c.id).children.forEach((mesh,i)=>{assert.ok(mesh.position.distanceTo(poses[i].p)<1e-6);assert.ok(mesh.quaternion.angleTo(poses[i].q)<1e-6);});
  const saved=e.exportProject();Schema.assertCurrentConnections(saved.connections);e.restoreProject(saved);assert.equal(countMeshes(e),2);assert.deepEqual(e.connectionManager.connections[0].designComponentMountFaces,c.designComponentMountFaces);
  e.historyManager.undo();assert.equal(signature(e),before);assert.equal(countMeshes(e),0);e.historyManager.redo();assert.equal(countMeshes(e),2);
  assert.equal(batch.begin().readyCount,0);assert.equal(batch.emit().existingCount,1);batch.cancel();
  e.setPartVisibility(e.parts[0].id,false);assert.ok([...e.connectionManager.helperMeshes.values()].every(mesh=>!mesh.visible));e.showAll();assert.ok([...e.connectionManager.helperMeshes.values()].every(mesh=>mesh.visible));
  const beam=e.meshes[0];beam.position.y=15;e.syncPartFromMesh(beam);beam.updateMatrixWorld(true);e.connectionManager.updateConnectionsForProfile(beam.userData.part.id);
  assert.equal(e.connectionManager.connections[0].status,'INVALID','接头移动到端边时不能继续展示悬空的已安装另一侧');
  assert.ok(e.connectionManager.connections[0].validation.errors.some(error=>['DESIGN_COMPONENT_FOOTPRINT_OUT_OF_RANGE','COMPONENT_PORT_NOT_ALIGNED'].includes(error.code)));
  beam.position.y=250;e.syncPartFromMesh(beam);beam.updateMatrixWorld(true);e.connectionManager.updateConnectionsForProfile(beam.userData.part.id);assert.equal(countMeshes(e),2);
  outcomes.bothSidesOneJointHistoryReload=true;outcomes.previewMatchesCommit=true;outcomes.existingAndVisibilitySafe=true;dispose(e);
}
{
  const e=joint(),batch=e.connectionBatchManager,before=signature(e),h=e.historyManager.index;
  let state=batch.begin();const unchecked=state.rows.find(row=>row.enabled).id;state=batch.toggle(unchecked,false);assert.equal(state.readyCount,1);assert.equal(state.uncheckedCount,1);assert.equal(batch.previewGroup.children.length,1);assert.equal(signature(e),before);
  batch.cancel();assert.equal(signature(e),before);assert.equal(e.historyManager.index,h);
  state=batch.begin({sides:'SINGLE'});assert.equal(state.readyCount,1);assert.equal(batch.confirm().createdCount,1);assert.equal(countMeshes(e),1);
  outcomes.independentSideToggleAndSingle=true;outcomes.cancelReadOnly=true;dispose(e);
}
{
  for(const y of [15,485]){const e=joint(y),state=e.connectionBatchManager.begin();assert.equal(state.contactCount,1);assert.equal(state.readyCount,1,'端部外侧没有支撑面，不安装悬空的第二件');dispose(e);}
  const e=joint(),batch=e.connectionBatchManager;batch.begin();const chosen=batch.rows[0].placements[0].envelope;
  e.addProfile('DESIGN-2020',20,{position:{x:chosen.center.x,y:chosen.center.y,z:chosen.center.z},select:false,captureHistory:false});
  const scope=e.parts.slice(0,2).map(p=>p.id),state=batch.begin({profileIds:scope});assert.equal(state.contactCount,1);assert.equal(state.readyCount,1,'第三方障碍只阻挡实际碰到的一侧');
  outcomes.endFootprintAndOneSideObstacle=true;dispose(e);
}
{
  const e=joint(),batch=e.connectionBatchManager;const beam=e.meshes[0];beam.position.x+=2.54;e.syncPartFromMesh(beam);beam.updateMatrixWorld(true);
  const state=batch.begin();assert.equal(state.contactCount,0);assert.equal(state.readyCount,0);assert.equal(state.nearbyCount,1);assert.match(state.rows[0].message,/2\.54/);batch.cancel();
  beam.position.x-=2.54;e.syncPartFromMesh(beam);beam.updateMatrixWorld(true);batch.begin();beam.userData.part.name='changed';assert.throws(()=>batch.confirm(),/重新扫描/);
  outcomes.realGapAndStaleGuard=true;dispose(e);
}
{
  const e=joint(),batch=e.connectionBatchManager;
  const spec=connectionSpecs('ANGLE_BRACKET').find(s=>/4孔/.test(s.label)&&/30/.test(s.label));assert.ok(spec);
  batch.begin({type:'ANGLE_BRACKET',spec:spec.value});assert.ok(batch.rows[0].solutions.every(row=>row.definition.label.includes('4孔')));batch.cancel();
  const src=e.meshes[0],dst=e.meshes[1];const c=e.connectionManager.createConnection(src,dst,{sourceEnd:'START',targetFace:'RIGHT',designType:'ANGLE_BRACKET'});
  assert.equal(batch.begin().existingCount,1);assert.equal(batch.emit().readyCount,0);batch.cancel();c.autoGenerated=true;c.userOverridden=false;
  assert.equal(batch.begin().readyCount,2);batch.confirm();assert.equal(e.connectionManager.connections.length,1);assert.equal(e.connectionManager.connections[0].id,c.id);
  const bad=structuredClone(e.connectionManager.export());bad[0].designComponentMountFaces=['FRONT','LEFT'];assert.throws(()=>Schema.assertCurrentConnections(bad),/互为反面/);assert.throws(()=>e.connectionManager.load(bad),/互为反面/);assert.equal(countMeshes(e),2);
  const before=signature(e);assert.throws(()=>e.connectionManager.installDesignComponent(src,dst,{sourceEnd:'START',targetFace:'RIGHT',designType:'ANGLE_BRACKET',componentDefinition:c.designComponent,sourceMountFace:'FRONT',sourceMountFaces:['FRONT','LEFT']}),/互为反面/);assert.equal(signature(e),before);
  const next=e.connectionManager.getDesignSwitchOptions(c).find(item=>item.valid&&!item.current);assert.ok(next);e.connectionManager.switchDesignType(c,next.type);assert.equal(c.designComponent,null);assert.deepEqual(c.designComponentMountFaces,[]);assert.equal(c.designComponentMountFace,null);
  outcomes.explicitSpecManualAndMalformedMountGuard=true;outcomes.abstractUpgradeAndSwitchCleanup=true;dispose(e);
}
{
  const e=joint(),batch=e.connectionBatchManager,q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.7,.2)),offset=new THREE.Vector3(100,70,-50);
  for(const mesh of e.meshes){mesh.position.applyQuaternion(q).add(offset);mesh.quaternion.premultiply(q);mesh.updateMatrixWorld(true);e.syncPartFromMesh(mesh);}
  const state=batch.begin();assert.equal(state.readyCount,2);const envelopes=batch.previewGroup.children.map(connectorEnvelope);assert.equal(envelopesOverlap(...envelopes,.5),false);assert.equal(batch.confirm().createdCount,2);
  outcomes.rotatedComponentObb=true;dispose(e);
}
{
  for(const mode of ['array','mirror']){
    const e=joint();e.connectionBatchManager.begin();e.connectionBatchManager.confirm();
    e.assemblyManager.create(e.parts.map(part=>part.id),'双侧接头组件');e.selectMany(e.meshes);e.historyManager.capture();
    const before=signature(e),h=e.historyManager.index;
    if(mode==='array')e.duplicateArray({axis:'Z',count:2,spacing:200});else e.mirrorSelected({axis:'Y',copy:true,planeMode:'WORLD_ORIGIN'});
    assert.equal(e.parts.length,4);assert.equal(e.connectionManager.connections.length,2);assert.equal(countMeshes(e),4);
    assert.ok(e.connectionManager.connections.every(c=>c.validation.ok&&c.designComponentMountFaces.length===2));assert.equal(e.historyManager.index,h+1);
    e.historyManager.undo();assert.equal(signature(e),before);e.historyManager.redo();assert.equal(countMeshes(e),4);dispose(e);
  }
  outcomes.doubleSidedGraphCopyAndMirror=true;
}
{
  const geometry=[];
  for(const template of DiyTemplateList){const e=editor(),generator=new Generator(e),h=e.historyManager.index;
    const result=generator.generate(template.id,{catalogId:'DESIGN-3030',width:800,depth:500,height:1000,levels:3,centerBeamCount:1,autoConnect:false});
    assert.equal(result.createdPartCount,19);assert.equal(e.historyManager.index,h+1);assert.equal(e.changes,1);
    geometry.push(e.parts.map(p=>({dimensions:p.dimensions,position:p.position,rotation:p.rotation})));dispose(e);
  }
  for(const actual of geometry.slice(1))assert.deepEqual(actual,geometry[0]);
  outcomes.allPresetsShareParameterSemantics=true;
}
{
  const e=editor(),result=new Generator(e).generate('STORAGE_RACK',{catalogId:'DESIGN-3030',width:1000,depth:500,height:1800,levels:4,centerBeamCount:1});
  assert.equal(result.createdPartCount,24);assert.equal(e.connectionManager.connections.length,40);
  const h=e.historyManager.index,state=e.connectionBatchManager.begin();assert.equal(state.contactCount,40);assert.equal(state.readyCount,64);assert.equal(state.blockedCount,0);assert.equal(state.nearbyCount,0);assert.equal(e.connectionBatchManager.previewGroup.children.length,64);
  const committed=e.connectionBatchManager.confirm();assert.equal(committed.createdCount,64);assert.equal(committed.connectionCount,40);assert.equal(e.historyManager.index,h+1);assert.equal(e.connectionManager.connections.length,40);assert.equal(countMeshes(e),64);
  outcomes.fourLayerFortyJointsSixtyFourComponents=true;dispose(e);
}
{
  const e=editor();new Generator(e).generate('STORAGE_RACK',{catalogId:'DESIGN-3060',width:1000,depth:500,height:1800,levels:4,centerBeamCount:1});
  const centers=e.meshes.filter(m=>m.userData.part.name.includes('中间承托梁'));
  assert.deepEqual(centers.map(m=>m.userData.part.dimensions.length),[410,410,410,410]);
  for(const center of centers)for(const end of ['START','END']){
    const p=profileFeatureWorldPoint(center,{type:'PROFILE_END',end});
    assert.ok(e.meshes.filter(m=>m.userData.part.name.includes('横梁')).some(m=>{const l=m.worldToLocal(p.clone());return Math.abs(Math.abs(l.x)-15)<1e-5&&Math.abs(l.y)<1e-5&&Math.abs(l.z)<=m.userData.part.dimensions.length/2;}));
  }
  const state=e.connectionBatchManager.begin();assert.equal(state.contactCount,40);assert.equal(state.nearbyCount,0);assert.ok(state.readyCount>24,'逐孔匹配增加可用多槽安装侧，不扩大端中心的槽容差');
  for(const row of e.connectionBatchManager.rows)for(const p of row.placements)if(p.checked.item.type==='ANGLE_BRACKET')assert.ok(p.checked.item.geometry.componentPorts.ok);
  outcomes.rectangularCenterBeamContactsAndSlotBoundary=true;dispose(e);
}
{
  const e=editor(),before=signature(e),h=e.historyManager.index;
  for(const options of [{width:20},{height:50,levels:4},{levels:2.5},{width:100,centerBeamCount:4},{depth:-1}])assert.throws(()=>e.addLayeredRack({catalogId:'DESIGN-3030',...options}));
  assert.equal(signature(e),before);assert.equal(e.historyManager.index,h);assert.equal(e.changes,0);
  const html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8'),app=fs.readFileSync(path.join(js,'app.js'),'utf8');
  assert.equal((html.match(/id="frame-preset"/g)||[]).length,1);assert.ok(!html.includes('高级生成器'));assert.ok(!html.includes('@click="generateFrame"'));assert.ok(app.includes("sides:'BOTH'"));assert.ok(html.includes('附近但未贴合'));
  assert.ok(!app.includes("const preferred = new Set(['2020','3030','4040','4545','6060','8080'])"),'框架不能继续使用只允许六个方截面的旧白名单');
  outcomes.invalidFrameAtomicAndUnifiedForm=true;dispose(e);
}
console.log(JSON.stringify({ok:true,version:'0.75.32',...outcomes}));
export {editor,joint,dispose,signature,countMeshes,THREE,load};
