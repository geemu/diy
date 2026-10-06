import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href,cache=new Map();
function moduleUrl(file){
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,quote,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl),catalog=await import(moduleUrl(path.join(js,'model/ComponentCatalog.js')));
const {default:factory}=await import(moduleUrl(path.join(js,'geometry/ComponentGeometryFactory.js')));
const {CURRENT_APP_VERSION}=await import(moduleUrl(path.join(js,'io/ProjectSchema.js')));
let shaftCases=0,connectionCases=0,accessoryCases=0;
function checkLitMaterials(object,label){
  object.traverse(child=>{
    if(!child.isMesh)return;
    const positions=child.geometry.attributes.position;
    for(let i=0;i<positions.count;i++)assert.ok(Number.isFinite(positions.getX(i))&&Number.isFinite(positions.getY(i))&&Number.isFinite(positions.getZ(i)),`${label} 几何坐标必须有限`);
    for(const material of [].concat(child.material)){
      assert.ok(material.isMeshLambertMaterial||material.isMeshPhongMaterial,`${label} 孔壁不能使用不受光照的黑色覆盖层`);
      assert.equal(material.fog,false);
    }
  });
}
function dispose(object){const materials=new Set();object.traverse(child=>{child.geometry?.dispose();for(const material of [].concat(child.material||[]))materials.add(material);});for(const material of materials)material.dispose();}
function clearRay(object,origin,direction,label){
  object.updateMatrixWorld(true);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(object,true).length,0,label);
}
// 遍历全部夹具规格，既检查受光材质，也验证主孔仍贯通，不能用白色圆片掩盖黑孔。
for(const option of catalog.ShaftComponentOptions.filter(x=>x.value!=='ROD'))for(const diameter of catalog.shaftDiametersFor(option.value)){
  const part=catalog.componentPart(catalog.shaftComponent({type:option.value,diameter,mixed:false})),object=factory.create(part);
  checkLitMaterials(object,option.value);
  clearRay(object,[0,-part.dimensions.axisOffsetY,-diameter*20],[0,0,1],`${option.value} Φ${diameter} 主孔不得封堵`);
  // 正交钻孔的圆筒和外表面必须共享材质，不因修改孔色引入新的制造参数。
  if(!['LIMIT_RING','VERTICAL_SK','HORIZONTAL_SHF'].includes(option.value)){
    const materials=new Set();object.traverse(child=>{if(child.isMesh)materials.add(child.material);});
    assert.equal(materials.size,1,`${option.value} 内外表面应共享同一金属材质`);
  }
  dispose(object);shaftCases++;
}
for(const option of catalog.ConnectionComponentOptions)for(const spec of catalog.connectionSpecs(option.value)){
  const part=catalog.componentPart(catalog.connectionComponent({type:option.value,spec:spec.value,length:165,side:'right'})),object=factory.create(part);
  checkLitMaterials(object,option.value);dispose(object);connectionCases++;
}
for(const option of catalog.EndCapMaterialOptions.filter(x=>x.value!=='PLASTIC')){
  // 金属端盖和弹性螺母走同一个带孔挤出路径；其他目录选项的完整范围由既有回归覆盖。
  const capMaterial=option.value;
  const object=factory.create(catalog.componentPart(catalog.accessoryComponent({type:'END_CAP',capMaterial})));
  checkLitMaterials(object,capMaterial);clearRay(object,[0,0,-100],[0,0,1],'金属端盖中心孔必须贯通');dispose(object);accessoryCases++;
}
for(const elasticSeries of [20,30,40]){
  const object=factory.create(catalog.componentPart(catalog.accessoryComponent({type:'FASTENING',head:'ELASTIC_NUT',elasticSeries})));
  checkLitMaterials(object,'ELASTIC_NUT');clearRay(object,[0,0,-100],[0,0,1],'弹性螺母中心孔必须贯通');dispose(object);accessoryCases++;
}
const plate=factory.create(catalog.componentPart(catalog.connectionComponent({type:'FLAT_PLATE',spec:catalog.connectionSpecs('FLAT_PLATE')[0].value})));
assert.equal(plate.children.length,1,'带孔挤出已有真实孔壁，不应重复添加遮孔圆筒');
clearRay(plate,[0,plate.userData.part.dimensions.size/2,-100],[0,0,1],'两孔连接片孔口必须贯通');dispose(plate);
// 螺钉的内六角盲槽底属于真实暗部，不应被通孔修复误改成亮色封口。
const screw=factory.create(catalog.componentPart(catalog.accessoryComponent({type:'FASTENING',head:'SHCS',thread:6,screwLength:20})));
let darkSocket=false;screw.traverse(child=>{if(child.isMesh&&child.material?.color?.getHexString()==='08090a')darkSocket=true;});
assert.ok(darkSocket);
dispose(screw);
console.log(JSON.stringify({ok:true,version:CURRENT_APP_VERSION,shaftCases,connectionCases,accessoryCases,litBoreWalls:true,throughHolesPreserved:true,noDuplicateBlackTubes:true,screwBlindSocketPreserved:true}));
