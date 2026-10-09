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
const {default:Manager}=await import(moduleUrl(path.join(js,'connection/ConnectionManager.js')));
const {default:Placement}=await import(moduleUrl(path.join(js,'connection/ConnectionPlacementManager.js')));
const {connectionDesignType}=await import(moduleUrl(path.join(js,'model/ComponentCatalog.js')));
const definition={id:'test-angle',label:'直角角码4040',accessoryType:'CATALOG_COMPONENT',color:'#808080',dimensions:{geometryKind:'ANGLE_BRACKET',size:40,width:40,height:40,thickness:4.8,length:40,angle:90,holeCount:2}};
assert.equal(connectionDesignType(definition),'ANGLE_BRACKET');
assert.equal(connectionDesignType({...definition,dimensions:{...definition.dimensions,geometryKind:'CORNER_CUBE'}}),'ANGLE_BRACKET');
assert.equal(connectionDesignType({...definition,dimensions:{...definition.dimensions,geometryKind:'THREE_WAY'}}),null);
assert.equal(connectionDesignType({...definition,dimensions:{...definition.dimensions,angle:45}}),null);
function profile(id,length,pos,rot){
  const mesh=new THREE.Group();
  mesh.position.set(...pos);mesh.rotation.set(...rot);
  mesh.userData.part={id,displayId:id,type:'PROFILE',dimensions:{sectionSize:[40,40],length},profilePath:{type:'LINE',length},designProfile:{profileId:'DESIGN-4040',series:40,slotWidth:8,faceClosures:[]},position:{x:pos[0],y:pos[1],z:pos[2]},rotation:{x:rot[0],y:rot[1],z:rot[2]}};
  mesh.add(new THREE.Mesh(new THREE.BoxGeometry(40,40,length),new THREE.MeshBasicMaterial()));mesh.updateMatrixWorld(true);return mesh;
}
const source=profile('横梁',300,[170,20,0],[0,Math.PI/2,0]),target=profile('立柱',500,[0,250,0],[-Math.PI/2,0,0]);
const camera=new THREE.PerspectiveCamera(40,1280/720,1,100000);camera.position.set(800,650,800);camera.lookAt(0,100,0);camera.updateMatrixWorld(true);
let captures=0;
const editor={meshes:[source,target],parts:[source.userData.part,target.userData.part],projectSettings:{contactToleranceMm:.5,collisionToleranceMm:.5},
  sceneManager:{scene:new THREE.Scene(),camera,renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})}},pickHit:()=>null},
  machiningManager:{removeGeneratedByConnection(){}},getMeshByPartId:id=>editor.meshes.find(m=>m.userData.part.id===id),
  historyManager:{capture(){captures++;}},emitStats(){},emitProjectChanged(){},updateDimensions(){},isMeshTransformable:()=>true,
  removePartByIdSilently(id){editor.meshes=editor.meshes.filter(m=>m.userData.part.id!==id);editor.parts=editor.parts.filter(p=>p.id!==id);},
  constraintManager:{constraints:[]}};
editor.connectionManager=new Manager(editor);
const placement=new Placement(editor),joint=new THREE.Vector3(20,20,0);
placement.begin('ANGLE_BRACKET',{componentDefinition:definition});
const direct=placement.resolveDirectJoint({object:target,point:joint.clone().add(new THREE.Vector3(0,13,0))});
assert.ok(direct?.valid,direct?.message||'立柱侧面而非源端中心也应自动识别');
assert.equal(direct.source.mesh,source);assert.equal(direct.target.mesh,target);
const y=new THREE.Vector3(0,1,0).applyQuaternion(direct.transform.quaternion),z=new THREE.Vector3(0,0,1).applyQuaternion(direct.transform.quaternion);
assert.ok(y.distanceTo(new THREE.Vector3(0,1,0))<1e-6);assert.ok(z.distanceTo(new THREE.Vector3(1,0,0))<1e-6);
assert.ok(direct.transform.position.distanceTo(new THREE.Vector3(22.4,40,0))<1e-6,'角点位于横梁外表面而不是中心线');
placement.directPreview=direct;placement.renderPreview();
const preview=placement.previewGroup.children[0];assert.ok(preview.quaternion.angleTo(direct.transform.quaternion)<1e-6);
assert.equal(editor.connectionManager.connections.length,0);assert.equal(captures,0,'悬停不写入工程');
const connection=placement.installConnection(direct.source,direct.target,'ANGLE_BRACKET','单击吸附');
assert.ok(connection);assert.equal(captures,1);assert.equal(connection.manufacturingRuleId,null);
const installed=editor.connectionManager.helperMeshes.get(connection.id).children[0];
assert.ok(installed.position.distanceTo(preview.position)<1e-6);assert.ok(installed.quaternion.angleTo(preview.quaternion)<1e-6,'预览和正式连接件共用安装计算');
placement.begin('ANGLE_BRACKET',{componentDefinition:definition});
const update=placement.resolveDirectJoint({object:target,point:joint});
assert.equal(placement.installConnection(update.source,update.target,'ANGLE_BRACKET','单击吸附'),null);
assert.equal(editor.connectionManager.connections.length,1,'已安装侧不重复建连接、不覆盖原件');assert.equal(captures,1,'重复点击不增加历史');
editor.connectionManager.clear();
// 任意整体旋转、平移后仍匹配同一真实安装角点和两个法向。
const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,.7,-.25)),offset=new THREE.Vector3(100,-50,80);
for(const mesh of [source,target]){
  mesh.position.applyQuaternion(q).add(offset);mesh.quaternion.premultiply(q);mesh.updateMatrixWorld(true);
  mesh.userData.part.position={x:mesh.position.x,y:mesh.position.y,z:mesh.position.z};mesh.userData.part.rotation={x:mesh.rotation.x,y:mesh.rotation.y,z:mesh.rotation.z};
}
placement.begin('ANGLE_BRACKET',{componentDefinition:definition});
const rotated=placement.resolveDirectJoint({object:target,point:joint.clone().applyQuaternion(q).add(offset)});
assert.ok(rotated?.valid,rotated?.message);assert.ok(rotated.transform.position.distanceTo(new THREE.Vector3(22.4,40,0).applyQuaternion(q).add(offset))<1e-5);
const projected=rotated.source.point.clone().project(camera),event={clientX:(projected.x+1)*640+5,clientY:(1-projected.y)*360+5};
assert.ok(placement.resolveDirectJoint(null,event)?.valid,'鼠标射线落在接头空隙也能吸附');
const obstacle=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial());obstacle.position.copy(new THREE.Vector3(42,52,0).applyQuaternion(q).add(offset));obstacle.quaternion.copy(q);obstacle.userData.part={id:'障碍板',displayId:'障碍板',type:'PANEL'};obstacle.updateMatrixWorld(true);editor.meshes.push(obstacle);
placement.begin('ANGLE_BRACKET',{componentDefinition:definition});const blocked=placement.resolveDirectJoint({object:target,point:rotated.source.point});assert.equal(blocked.valid,false);assert.match(blocked.message,/安装空间.*障碍板/);editor.meshes.pop();
// 旧件转换直到单击才移除；取消不动原件。
const loose=new THREE.Group();loose.userData.part={...definition,id:'自由角码',name:'自由角码',type:'ACCESSORY'};editor.meshes.push(loose);editor.parts.push(loose.userData.part);
placement.beginExisting('自由角码');placement.cancel();assert.ok(editor.getMeshByPartId('自由角码'));
placement.beginExisting('自由角码');const adoption=placement.resolveDirectJoint({object:target,point:rotated.source.point});
assert.ok(placement.installConnection(adoption.source,adoption.target,'ANGLE_BRACKET','单击吸附'));assert.equal(editor.getMeshByPartId('自由角码'),undefined);assert.equal(editor.connectionManager.connections.length,1);
// 间隙、实体干涉和第三方安装包络均不能冒充绿色安装。
placement.begin('ANGLE_BRACKET',{componentDefinition:definition});source.position.addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(q),5);source.userData.part.position={x:source.position.x,y:source.position.y,z:source.position.z};source.updateMatrixWorld(true);
const gap=placement.resolveDirectJoint({object:source,point:rotated.source.point.clone().addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(q),5)});assert.equal(gap.valid,false);assert.match(gap.message,/未.*贴合|没有贴合/);
source.position.addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(q),-10);source.userData.part.position={x:source.position.x,y:source.position.y,z:source.position.z};source.updateMatrixWorld(true);
const collision=placement.resolveDirectJoint({object:source,point:rotated.source.point});assert.equal(collision.valid,false);assert.match(collision.message,/干涉/);
source.position.addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(q),5);source.userData.part.position={x:source.position.x,y:source.position.y,z:source.position.z};source.updateMatrixWorld(true);
const second=profile('第二横梁',300,[0,20,170],[0,0,0]);second.position.applyQuaternion(q).add(offset);second.quaternion.premultiply(q);second.updateMatrixWorld(true);second.userData.part.position={x:second.position.x,y:second.position.y,z:second.position.z};second.userData.part.rotation={x:second.rotation.x,y:second.rotation.y,z:second.rotation.z};editor.meshes.push(second);
placement.begin('ANGLE_BRACKET',{componentDefinition:definition});placement.handlePointerMove(event);assert.ok(placement.candidates.filter(c=>c.valid).length>=2,'一个角点多接头可以列出合法候选');const previous=placement.directPreview.key;assert.equal(placement.cycleCandidate(1),true);assert.notEqual(placement.directPreview.key,previous,'Tab 只切换候选不让用户手动旋转');
console.log(JSON.stringify({ok:true,version:'0.75.39',canonicalJoint:true,autoOrientation:true,previewEqualsInstalled:true,arbitraryRotation:true,screenGapSnap:true,duplicateSafe:true,existingConversion:true,hoverReadOnly:true,gapAndCollisionGuard:true,thirdPartySpaceGuard:true,candidateCycle:true}));
