import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href;
const cache=new Map();
function moduleUrl(file) {
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,quote,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const catalog=await import(moduleUrl(path.join(js,'model/ComponentCatalog.js')));
const {default:factory}=await import(moduleUrl(path.join(js,'geometry/PrimitiveGeometryFactory.js')));
const {hardwareDimensions}=await import(moduleUrl(path.join(js,'model/HardwareCatalog.js')));
const {getDesignProfileDefinition}=await import(moduleUrl(path.join(js,'model/DesignProfileCatalog.js')));
const {catalogPresentation}=await import(moduleUrl(path.join(js,'interaction/CatalogPresentation.js')));
const editorSource=fs.readFileSync(path.join(js,'core/Editor.js'),'utf8');
const addHardware=new Function('crypto','getHardwareDefinition','normalizeVector','hardwareDimensions','catalogId','options',editorSource.match(/\n  addHardware\([^\n]*\) \{([\s\S]*?)\n  \}/)[1]);
const normalizeVector=value=>({x:Number(value?.x||0),y:Number(value?.y||0),z:Number(value?.z||0)});
const state={nextDisplayId(){return 'A-test';},insertPart(part){return part;}};
function signature(object) {
  const hash=createHash('sha256'),materials=new Set(),geometries=new Set();
  object.updateMatrixWorld(true);
  object.traverse(mesh=>{
    if(!mesh.isMesh)return;
    hash.update(JSON.stringify(mesh.matrix.elements));
    for(const name of ['position','normal']) {
      const a=mesh.geometry.attributes[name]?.array;
      if(a)hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
    }
    const index=mesh.geometry.index?.array;
    if(index)hash.update(Buffer.from(index.buffer,index.byteOffset,index.byteLength));
    hash.update(JSON.stringify({type:mesh.material.type,color:mesh.material.color.getHex(),shininess:mesh.material.shininess}));
    geometries.add(mesh.geometry);materials.add(mesh.material);
  });
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
  return hash.digest('hex');
}
let cases=0;
function check(definition) {
  const preview=catalog.componentPart(definition);
  const actual=addHardware.call(state,{randomUUID},()=>null,normalizeVector,hardwareDimensions,definition.id,{definition});
  assert.deepEqual(preview.dimensions,actual.dimensions);
  assert.equal(preview.color,actual.color);assert.equal(preview.accessoryType,actual.accessoryType);
  assert.equal(signature(factory.create(preview)),signature(factory.create(actual)),definition.label+' 预览与正式构件必须具有相同几何/材质');
  cases++;
}
for(const foot of catalog.FootCupOptions)check(catalog.accessoryComponent({type:'FOOT_CUP',foot:foot.value}));
for(const head of catalog.FastenerHeadOptions) {
  if(head.value==='ELASTIC_NUT'){for(const series of [20,30,40])check(catalog.accessoryComponent({type:'FASTENING',head:head.value,elasticSeries:series}));continue;}
  for(const thread of catalog.fastenerThreads(head.value))for(const length of catalog.fastenerLengths(head.value,thread))check(catalog.accessoryComponent({type:'FASTENING',head:head.value,thread,screwLength:length}));
}
for(const profile of catalog.ProfileReferenceOptions)for(const cap of catalog.EndCapMaterialOptions)check(catalog.accessoryComponent({type:'END_CAP',capMaterial:cap.value},getDesignProfileDefinition(profile.id)));
for(const slide of catalog.SlideTypeOptions)for(const length of catalog.SlideLengthOptions) {
  const definition=catalog.accessoryComponent({type:'SLIDE_RAIL',slideType:slide.value,slideLength:length.value});
  const presentation=catalogPresentation(catalog.componentPart(definition));
  assert.ok(presentation.direction[0]>0&&presentation.direction[2]>0,'滑轨从翻边开放侧观看，并保持右上斜向');
  check(definition);
}
const footObject=factory.create(catalog.componentPart(catalog.accessoryComponent({type:'FOOT_CUP',foot:'D40-M8-30'})));
assert.ok(footObject.children.some(mesh=>mesh.material.isMeshPhongMaterial&&mesh.material.shininess===40));
assert.ok(footObject.children.some(mesh=>mesh.material.isMeshPhongMaterial&&mesh.material.shininess===8),'橡胶底不能与金属杯共用强高光');
signature(footObject);
assert.ok(fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8').includes('适配 {{currentAccessoryComponent.dimensions.width}}'));
console.log(JSON.stringify({ok:true,version:'0.75.32',cases,footSpecs:catalog.FootCupOptions.length,slideOpenSide:true,selectedCapSection:true,previewCommitSameGeometryAndMaterial:true}));
