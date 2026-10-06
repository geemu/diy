import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href;
const cache=new Map();
function moduleUrl(file){
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl);
const {createSurfaceFeedback,disposeFeedback,surfaceGeometryKey}=await import(moduleUrl(path.join(js,'interaction/SurfaceFeedback.js')));
const {default:Factory}=await import(moduleUrl(path.join(js,'geometry/ProfileGeometryFactory.js')));
const {profileObb}=await import(moduleUrl(path.join(js,'validation/PartCollisionDetector.js')));
const make=(id,x=0)=>({id,type:'PROFILE',designProfile:{profileId:'DESIGN-3030'},dimensions:{sectionSize:[30,30],length:300},profilePath:{type:'LINE',length:300},position:{x,y:0,z:0},rotation:{x:0,y:0,z:0}});
// 采用真实型材几何，端面提示不能填住中心通孔。
const part=make('A'),mesh=Factory.create(part);
const before=JSON.stringify(part),vertices=mesh.children[0].geometry.attributes.position.array.slice();
const end=createSurfaceFeedback(mesh,{feature:{end:'END'}});
assert.ok(end,'端面有真实三角面');
end.updateMatrixWorld(true);
const ray=new THREE.Raycaster(new THREE.Vector3(0,0,300),new THREE.Vector3(0,0,-1));
end.raycast=THREE.Mesh.prototype.raycast;
assert.equal(ray.intersectObject(end).length,0,'中心通孔不被颜色封死');
ray.set(new THREE.Vector3(13,13,300),new THREE.Vector3(0,0,-1));
assert.ok(ray.intersectObject(end).length>0,'实体端面的材料仍有颜色，不能靠禁用拾取伪造通孔检查');
for(const face of ['FRONT','BACK','LEFT','RIGHT']){
  const helper=createSurfaceFeedback(mesh,{feature:{face}});
  assert.ok(helper,`${face} 外侧面可以整面提示`);
  const position=helper.geometry.attributes.position;
  assert.ok(Array.from(position.array).every(Number.isFinite));
  disposeFeedback(helper);
}
assert.equal(createSurfaceFeedback(mesh,{feature:{face:'UNKNOWN'}}),null,'未知特征不能全件变绿');
const other=make('B',30),obb=profileObb(other);
const band=createSurfaceFeedback(mesh,{clipObb:obb,marginMm:4,color:0x315cff});
assert.ok(band);band.geometry.computeBoundingBox();
assert.ok(band.geometry.boundingBox.min.x>=10.999,'蓝色只落在接触侧的短带范围');
assert.equal(createSurfaceFeedback(mesh,{clipObb:profileObb(make('far',500)),marginMm:4}),null,'分离件没有接触带');
mesh.rotation.set(.2,.3,.4);mesh.position.set(60,70,80);end.update();
assert.deepEqual(end.matrix.elements,mesh.matrixWorld.elements,'提示跟随真实旋转和位置');
assert.equal(JSON.stringify(part),before,'提示不修改领域模型');
assert.deepEqual(mesh.children[0].geometry.attributes.position.array,vertices,'提示不改变实体几何');
const key=surfaceGeometryKey(mesh);mesh.children[0].scale.z=2;
assert.notEqual(surfaceGeometryKey(mesh),key,'子几何变化必须触发选择覆盖刷新');mesh.children[0].scale.z=1;
const group=new THREE.Group();group.add(end,band);
let released=0;end.geometry.addEventListener('dispose',()=>released++);band.geometry.addEventListener('dispose',()=>released++);
disposeFeedback(group);assert.equal(released,2,'嵌套展示几何释放');
const {default:Primitive}=await import(moduleUrl(path.join(js,'geometry/PrimitiveGeometryFactory.js')));
for(const size of [20,30,40,45,60,80]){
  const bracket=Primitive.create({id:'bracket',type:'ACCESSORY',accessoryType:'ANGLE_BRACKET',dimensions:{size},position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0}});
  bracket.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(bracket);
  assert.ok(Math.abs(box.min.x)<1e-5&&Math.abs(box.min.y)<1e-5&&Math.abs(box.max.x-size)<1e-5&&Math.abs(box.max.y-size)<1e-5,'角码原安装角点/范围保持');
  ray.set(new THREE.Vector3(size*.66,-10,0),new THREE.Vector3(0,1,0));assert.equal(ray.intersectObject(bracket,true).length,0,'底板是真通孔');
  ray.set(new THREE.Vector3(-10,size*.66,0),new THREE.Vector3(1,0,0));assert.equal(ray.intersectObject(bracket,true).length,0,'立板是真通孔');
  disposeFeedback(bracket);
}
const css=fs.readFileSync(path.join(root,'src/main/resources/static/css/app.css'),'utf8');
for(const token of ['.inspector-panel .machining-item-card','.inspector-panel .connection-quick-change select','.inspector-panel select:focus','.inspector-panel option:disabled'])assert.ok(css.includes(token));
console.log(JSON.stringify({ok:true,version:'0.75.10',realSurface:true,holesOpen:true,clipContact:true,readOnly:true,inspectorDarkStates:true}));
