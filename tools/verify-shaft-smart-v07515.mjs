import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const js=path.join(root,'src/main/resources/static/js'),vendor=path.join(root,'target/classes/static/vendor/three');
registerHooks({resolve(specifier,context,next){
  if(specifier==='three')return {url:pathToFileURL(path.join(vendor,'build/three.module.min.js')).href,shortCircuit:true};
  if(specifier.startsWith('three/addons/'))return {url:pathToFileURL(path.join(vendor,'examples/jsm',specifier.slice(13))).href,shortCircuit:true};
  return next(specifier,context);
}});
const THREE=await import('three');
const {shaftComponent,shaftFixturePorts,shaftDiametersFor}=await import('../src/main/resources/static/js/model/ComponentCatalog.js');
const {default:Factory}=await import('../src/main/resources/static/js/geometry/ComponentGeometryFactory.js');
const {default:Mount}=await import('../src/main/resources/static/js/model/AccessoryMountManager.js');
const {default:Editor}=await import('../src/main/resources/static/js/core/Editor.js');
const {default:Validator}=await import('../src/main/resources/static/js/validation/FactoryValidator.js');
const types=['VERTICAL_SK','HORIZONTAL_SHF','CROSS_FIX','PARALLEL_FIX','PARALLEL_FIX_35','PARALLEL_FIX_40','L_FIX','T_FIX','LIMIT_RING'];
const target=new THREE.Group();target.userData.part={id:'shaft',type:'SHAFT',dimensions:{diameter:8,length:400}};
const mounts=new Mount({getMeshByPartId:()=>target,syncPartFromMesh(){}});
let boreCases=0,transforms=0,reverseTransforms=0;
for(const type of types)for(const diameter of shaftDiametersFor(type)){
  const definition=shaftComponent({type,diameter,mixed:false}),ports=shaftFixturePorts(definition);
  const fixture=Factory.create({...definition,type:'ACCESSORY'});fixture.updateMatrixWorld(true);
  assert.ok(ports.length>0);assert.equal(new Set(ports.map(port=>port.id)).size,ports.length);
  for(const port of ports){
    const axis=new THREE.Vector3(...port.axis),center=new THREE.Vector3(...port.center);
    const ray=new THREE.Raycaster(center.clone().addScaledVector(axis,-Math.max(100,diameter*10)),axis);
    assert.equal(ray.intersectObject(fixture,true).length,0,`${type} ${diameter} ${port.id} 必须沿真实通孔贯通`);
    boreCases++;
    target.userData.part.dimensions.diameter=port.diameter;
    for(const rotation of [[0,0,0],[.2,.4,.6],[Math.PI/2,0,-Math.PI/2],[-.3,1.1,-.6]])for(const stationS of [0,150,400]){
      target.rotation.set(...rotation);target.position.set(120,-40,80);target.updateMatrixWorld(true);
      const transform=mounts.resolveShaftAxis(definition,target,{stationS,holeId:port.id});
      mounts.applyTransform(fixture,transform);
      assert.ok(fixture.localToWorld(center.clone()).distanceTo(target.localToWorld(new THREE.Vector3(0,0,stationS-200)))<1e-6);
      assert.ok(axis.clone().applyQuaternion(fixture.quaternion).distanceTo(new THREE.Vector3(0,0,1).applyQuaternion(target.quaternion))<1e-6);
      assert.equal(transform.mountReference.holeId,port.id);assert.equal(transform.mountReference.stationS,stationS);
      transforms++;
      const shaftTransform=mounts.resolveShaftForFixture(fixture,{holeId:port.id,length:100,startOffset:-25});
      const rod=new THREE.Group();mounts.applyTransform(rod,shaftTransform);
      assert.ok(rod.localToWorld(new THREE.Vector3(0,0,-50)).distanceTo(fixture.localToWorld(center.clone().addScaledVector(axis,-25)))<1e-6);
      assert.ok(new THREE.Vector3(0,0,1).applyQuaternion(rod.quaternion).distanceTo(axis.clone().applyQuaternion(fixture.quaternion))<1e-6);
      assert.equal(shaftTransform.diameter,port.diameter);reverseTransforms++;
    }
    fixture.position.set(0,0,0);fixture.rotation.set(0,0,0);fixture.updateMatrixWorld(true);
  }
  fixture.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.dispose();});
}
assert.throws(()=>mounts.resolveShaftAxis(shaftComponent({type:'L_FIX',diameter:8,mixed:false}),target,{holeId:'UNKNOWN'}),/不存在/);
target.userData.part.dimensions.diameter=10;
assert.throws(()=>mounts.resolveShaftAxis(shaftComponent({type:'L_FIX',diameter:8,mixed:false}),target,{holeId:'X'}),/不匹配/);
const mixed=shaftComponent({type:'L_FIX',diameter:8,mixed:true,secondDiameter:10});
const alternate=mounts.resolveShaftAxis(mixed,target,{stationS:80,holeId:'Y'});
const savedPart={...mixed,type:'ACCESSORY',id:'clip',hardwareSpec:{source:'DIY_COMPONENT_CATALOG'},mountReference:alternate.mountReference};
const validator=new Validator({getMeshByPartId:()=>target}),errors=[];
validator.validateAccessoryMount(savedPart,errors,[]);
assert.equal(errors.length,0,'异径夹具必须检查所选孔，而不是未使用的主孔');
savedPart.mountReference.holeId='UNKNOWN';validator.validateAccessoryMount(savedPart,errors,[]);assert.equal(errors[0].code,'SHAFT_CLAMP_MISMATCH');

// 执行真实 Editor 命令与 Manager，不创建 WebGL；历史/刷新只统计调用次数。
target.userData.part.dimensions.diameter=8;
let captures=0,created=0;
const commandEditor={getMeshByPartId:()=>target,isMeshTransformable:()=>true,mountHardware(id,partId,options){
  assert.equal(options.captureHistory,false);assert.equal(options.select,false);created++;
  const transform=mounts.resolveShaftAxis(options.definition,target,options),mesh=Factory.create({...options.definition,id:'new',type:'ACCESSORY',mountReference:transform.mountReference});mounts.applyTransform(mesh,transform);return mesh;
},accessoryMountManager:mounts,interferenceFeedbackManager:{requestRefresh(){}},historyManager:{capture(){captures++;}},emitProjectChanged(){},emitStats(){}};
const smart=Editor.prototype.createShaftSmartFixture;
const fixture=smart.call(commandEditor,shaftComponent({type:'L_FIX',diameter:8,mixed:false}),'shaft',25,'X');
assert.equal(fixture.userData.part.mountReference.stationS,100);assert.equal(captures,1);assert.equal(created,1);
target.position.x+=75;target.rotation.z+=.2;target.updateMatrixWorld(true);mounts.refreshAccessory(fixture);
const port=shaftFixturePorts(fixture.userData.part).find(p=>p.id==='X');
assert.ok(fixture.localToWorld(new THREE.Vector3(...port.center)).distanceTo(target.localToWorld(new THREE.Vector3(0,0,-100)))<1e-6,'所选孔刷新后仍对齐宿主');
for(const percent of [-1,101,NaN])assert.throws(()=>smart.call(commandEditor,mixed,'shaft',percent,'Y'),/位置/);
assert.equal(captures,1);assert.equal(created,1);
commandEditor.isMeshTransformable=()=>false;assert.throws(()=>smart.call(commandEditor,mixed,'shaft',50,'Y'),/锁定/);
commandEditor.getMeshByPartId=()=>fixture;commandEditor.assemblyManager={isPartEffectivelyLocked:()=>false};commandEditor.updateDimensions=()=>{};
let rodCalls=0;commandEditor.addShaft=(diameter,length,options)=>{rodCalls++;assert.equal(diameter,8);assert.equal(length,120);assert.equal(options.captureHistory,false);assert.equal(options.select,false);assert.equal(options.mountReference,undefined);return new THREE.Group();};
Editor.prototype.createShaftFromFixture.call(commandEditor,'new',{holeId:'Y',length:120,startOffset:-20});assert.equal(rodCalls,1);assert.equal(captures,2);
for(const length of [0,-2,NaN])assert.throws(()=>Editor.prototype.createShaftFromFixture.call(commandEditor,'new',{holeId:'Y',length,startOffset:0}),/长度/);
assert.throws(()=>Editor.prototype.createShaftFromFixture.call(commandEditor,'new',{holeId:'Y',length:20,startOffset:Infinity}),/偏移/);
assert.equal(rodCalls,1);assert.equal(captures,2);
fixture.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.dispose();});

// 清除全部设计连接必须逐项调用 Manager，由原链清理派生项，并只记录一次历史。
let clearCaptures=0,restored=false;
const clearEditor={connectionManager:{connections:[{id:'auto'},{id:'manual'}],removeConnection(id){this.connections=this.connections.filter(item=>item.id!==id);}},
  exportProject(){return {connections:this.connectionManager.connections.map(item=>({...item}))};},restoreProject(before){restored=true;this.connectionManager.connections=before.connections;},
  updateDimensions(){},emitStats(){},emitProjectChanged(){},historyManager:{capture(){clearCaptures++;}}};
assert.deepEqual(Editor.prototype.clearAllDesignConnections.call(clearEditor),{removedCount:2});
assert.equal(clearEditor.connectionManager.connections.length,0);assert.equal(clearCaptures,1);
assert.deepEqual(Editor.prototype.clearAllDesignConnections.call(clearEditor),{removedCount:0});assert.equal(clearCaptures,1);
clearEditor.connectionManager.connections=[{id:'auto'},{id:'manual'}];
clearEditor.connectionManager.removeConnection=function(id){if(id==='manual')throw new Error('清理失败');this.connections=this.connections.filter(item=>item.id!==id);};
assert.throws(()=>Editor.prototype.clearAllDesignConnections.call(clearEditor),/清理失败/);assert.ok(restored);
assert.deepEqual(clearEditor.connectionManager.connections.map(item=>item.id),['auto','manual']);assert.equal(clearCaptures,1);

const app=fs.readFileSync(path.join(js,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
assert.ok(html.includes('id="shaft-smart-type"')&&html.includes('id="shaft-smart-hole"')&&html.includes('id="shaft-smart-position"'));
for(const action of ['openShaftSmart','clearAllConnections','openQuickPanel(\'drawer\')','openQuickPanel(\'panel\')','toggleSelectionVisibility','mirrorAlong(axis)'])assert.ok(html.includes(action));
assert.ok(app.includes('if(shaftSmart.visible){event.preventDefault();shaftSmart.visible=false;return;}'));
assert.ok(html.includes('quickPanel===\'batch\'')&&html.includes('quickPanel===\'drawer\''));
console.log(JSON.stringify({ok:true,version:'0.75.24',fixtureTypes:types.length,boreCases,transforms,reverseTransforms,selectedHoleDiameter:true,hostFollow:true,oneHistory:true,guards:true,clearConnectionTransaction:true,modalAndTools:true}));
