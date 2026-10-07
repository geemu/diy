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
const {catalogPresentation}=await import(moduleUrl(path.join(js,'interaction/CatalogPresentation.js')));
const {getDesignProfileDefinition}=await import(moduleUrl(path.join(js,'model/DesignProfileCatalog.js')));
const dispose=o=>o.traverse(c=>{c.geometry?.dispose();c.material?.dispose();});
let boreCases=0;
// 所有夹具的目录主孔必须是真通孔，且与宿主安装偏移使用同一参数；非空网格不足以证明正确。
for(const option of catalog.ShaftComponentOptions.filter(x=>x.value!=='ROD'))for(const diameter of catalog.shaftDiametersFor(option.value)){
  const part=catalog.componentPart(catalog.shaftComponent({type:option.value,diameter,mixed:false}));
  const mesh=factory.create(part);mesh.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,-part.dimensions.axisOffsetY,-diameter*20),new THREE.Vector3(0,0,1));
  assert.equal(ray.intersectObject(mesh,true).length,0,`${option.value} Φ${diameter} 主孔不得被实体或内壁封堵`);
  mesh.traverse(c=>{for(const m of [].concat(c.material||[]))assert.equal(m.fog,false,'实际构件不能随远处地面一起雾化');});
  assert.equal(mesh.scale.x,1);dispose(mesh);boreCases++;
}
assert.equal(getDesignProfileDefinition('DESIGN-2020R').name,'欧标20x20R');
assert.equal(catalogPresentation({type:'PROFILE',dimensions:{profileId:'DESIGN-2020R'}}).rotation[2],Math.PI/2);
assert.equal(catalogPresentation({type:'PROFILE',dimensions:{profileId:'DESIGN-2020'}}).rotation[2],0);
assert.ok(catalogPresentation({dimensions:{geometryKind:'SHAFT_L_FIX'}}).referenceSpan>0);
assert.notEqual(catalogPresentation({dimensions:{geometryKind:'ANGLE_BRACKET'}}).margin,catalogPresentation({dimensions:{geometryKind:'THREE_WAY'}}).margin);
assert.equal(catalogPresentation({dimensions:{geometryKind:'A_PILLAR_BRACKET'}}).rotation[0],Math.PI/2);
const scene=fs.readFileSync(path.join(js,'core/SceneManager.js'),'utf8');
const {default:InfiniteGround}=await import(moduleUrl(path.join(js,'core/InfiniteGround.js')));
const ground=new InfiniteGround();
assert.equal(ground.material.depthWrite,false);assert.equal(ground.mesh.name,'__presentation_ground__');
assert.ok(scene.includes('new InfiniteGround()')&&!scene.includes('new THREE.GridHelper(20000'));
ground.dispose();
const preview=fs.readFileSync(path.join(js,'interaction/ProfileSectionPreview3D.js'),'utf8');
assert.ok(preview.includes('style.referenceSpan/2')&&preview.includes('MeshLambertMaterial'));
assert.ok(!preview.includes('this.mesh.scale.set'),'不能用改变真实几何尺寸的方式校准目录展示');
console.log(JSON.stringify({ok:true,version:'0.75.17',boreCases,presentationOnly:true,rProfileNameAndView:true,canvasGroundAndFade:true}));
