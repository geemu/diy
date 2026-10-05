import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href;
const cache=new Map();
// 使用项目实际的本地 Three.js；只改模块解析路径，不替换几何或伪造 Editor 返回值。
function moduleUrl(file) {
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,quote,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl),catalog=await import(moduleUrl(path.join(js,'model/ComponentCatalog.js')));
const {default:factory}=await import(moduleUrl(path.join(js,'geometry/PrimitiveGeometryFactory.js')));
const {default:profileFactory}=await import(moduleUrl(path.join(js,'geometry/ProfileGeometryFactory.js')));
const model=await import(moduleUrl(path.join(js,'model/PanelShapeModel.js')));
const {getDesignProfileDefinition}=await import(moduleUrl(path.join(js,'model/DesignProfileCatalog.js')));
const {getSectionDefinition}=await import(moduleUrl(path.join(js,'model/ProfileSectionRegistry.js')));
const {default:Schema,CURRENT_APP_VERSION}=await import(moduleUrl(path.join(js,'io/ProjectSchema.js')));
assert.equal(catalog.ProfileReferenceOptions.length,16);assert.equal(catalog.ConnectionComponentOptions.length,18);assert.equal(catalog.ShaftComponentOptions.length,10);assert.equal(catalog.PanelShapeOptions.length,11);assert.equal(catalog.AccessoryComponentOptions.length,4);
assert.deepEqual(catalog.fastenerThreads('KNURLED_THUMB'),[3,4,5,6,8,10]);
assert.ok(!catalog.fastenerLengths('SHCS',3).includes(15)&&catalog.fastenerLengths('PAN_HEAD',3).includes(15));
let geometryCases=0,connectorSpecs=0;
function checkMesh(part) {
  const object=part.type==='PROFILE'?profileFactory.create(part):factory.create(part),bounds=new THREE.Box3().setFromObject(object);
  assert.ok(!bounds.isEmpty());object.traverse(child=>{if(child.geometry){const a=child.geometry.attributes.position;for(let i=0;i<a.count;i++)assert.ok(Number.isFinite(a.getX(i))&&Number.isFinite(a.getY(i))&&Number.isFinite(a.getZ(i)),part.name||part.dimensions.geometryKind);}});
  assert.ok(bounds.getSize(new THREE.Vector3()).length()>0);object.traverse(c=>{c.geometry?.dispose();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material?.dispose();});geometryCases++;return bounds;
}
for(const option of catalog.ConnectionComponentOptions)for(const spec of catalog.connectionSpecs(option.value)){
  const definition=catalog.connectionComponent({type:option.value,spec:spec.value,length:165,side:'right'});
  assert.ok(definition.label.includes(spec.label));checkMesh(catalog.componentPart(definition));connectorSpecs++;
}
for(const option of catalog.ShaftComponentOptions.filter(x=>x.value!=='ROD'))for(const diameter of catalog.shaftDiametersFor(option.value))checkMesh(catalog.componentPart(catalog.shaftComponent({type:option.value,diameter,mixed:false})));
for(const foot of catalog.FootCupOptions)checkMesh(catalog.componentPart(catalog.accessoryComponent({type:'FOOT_CUP',foot:foot.value})));
for(const head of catalog.FastenerHeadOptions.filter(x=>x.value!=='ELASTIC_NUT'))for(const thread of catalog.fastenerThreads(head.value))checkMesh(catalog.componentPart(catalog.accessoryComponent({type:'FASTENING',head:head.value,thread,screwLength:catalog.fastenerLengths(head.value,thread)[0]})));
for(const cap of catalog.EndCapMaterialOptions)for(const id of ['DESIGN-2020','DESIGN-2040','DESIGN-3030R','DESIGN-U88'])checkMesh(catalog.componentPart(catalog.accessoryComponent({type:'END_CAP',capMaterial:cap.value},getDesignProfileDefinition(id))));
for(const slideType of catalog.SlideTypeOptions)for(const length of catalog.SlideLengthOptions)checkMesh(catalog.componentPart(catalog.accessoryComponent({type:'SLIDE_RAIL',slideType:slideType.value,slideLength:length.value})));
for(const option of catalog.ProfileReferenceOptions){
  const definition=getDesignProfileDefinition(option.id);assert.ok(definition);
  const part={type:'PROFILE',dimensions:{length:140,sectionSize:definition.sectionSize},designProfile:{profileId:definition.id,faceClosures:definition.defaultFaceClosures}};checkMesh(part);
}
assert.equal(getDesignProfileDefinition('DESIGN-2040').slotDefinitions.length,6);
assert.equal(getDesignProfileDefinition('DESIGN-2020R').slotDefinitions.length,2);
assert.equal(getDesignProfileDefinition('DESIGN-U88').slotDefinitions.length,0);
assert.notDeepEqual(getSectionDefinition('DESIGN-2020').outer,getSectionDefinition('DESIGN-2020',['FRONT']).outer);
assert.deepEqual(catalog.closureFaces('A',getDesignProfileDefinition('DESIGN-2020R')),['BACK']);
const {default:Grip}=await import(moduleUrl(path.join(js,'interaction/ProfileGripEditor.js')));
const grip=Object.create(Grip.prototype),gripHost=new THREE.Group();gripHost.userData.part={type:'PROFILE',dimensions:{length:100},profilePath:{type:'LINE',length:100}};
grip.options={enabled:true};grip.sceneManager={};grip.editor={selected:gripHost,selectedMeshes:[gripHost],isMeshTransformable:()=>true};
assert.equal(grip.selectedMesh(),gripHost);
for(const name of ['accessoryPlacementManager','connectionPlacementManager','machiningPlacementManager']){
  grip.editor[name]={isActive:()=>true};assert.equal(grip.selectedMesh(),null,`${name} 必须禁止拉伸手柄抢安装点击`);delete grip.editor[name];
}
const {default:MountManager}=await import(moduleUrl(path.join(js,'model/AccessoryMountManager.js')));
const host=new THREE.Group();host.userData.part={id:'rod',type:'SHAFT',dimensions:{diameter:8,length:100}};
host.position.set(25,40,60);host.rotation.set(.2,.4,.1);host.updateMatrixWorld(true);
const mounts=new MountManager({});
for(const type of catalog.ShaftComponentOptions.filter(x=>x.value!=='ROD')){
  const definition=catalog.shaftComponent({type:type.value,diameter:8,mixed:false});
  const transform=mounts.resolveShaftAxis(definition,host,{stationS:30});
  const clip=new THREE.Group();clip.position.set(transform.position.x,transform.position.y,transform.position.z);clip.rotation.set(transform.rotation.x,transform.rotation.y,transform.rotation.z);clip.updateMatrixWorld(true);
  const mainBore=clip.localToWorld(new THREE.Vector3(0,-definition.dimensions.axisOffsetY,0));
  const rodStation=host.localToWorld(new THREE.Vector3(0,0,-20));
  assert.ok(mainBore.distanceTo(rodStation)<1e-8,`${type.value} 主轴孔必须对齐光轴站位`);
  assert.equal(transform.mountReference.stationS,30);
}
const parts=[];
for(const shape of catalog.PanelShapeOptions){const d=model.panelDimensions(shape.value,model.panelDefaults(shape.value));const part={id:shape.value,type:'PANEL',name:shape.label,dimensions:d};checkMesh(part);parts.push(part);}
assert.throws(()=>model.panelDimensions('ring',{outerDiameter:50,innerDiameter:60,thickness:5}));assert.throws(()=>model.panelDimensions('cross',{width:100,height:100,cutWidth:60,cutHeight:10,thickness:5}));assert.throws(()=>model.panelDimensions('torus',{radius:10,tubeRadius:20,radialSegments:16,tubularSegments:100}));
const sample=JSON.parse(fs.readFileSync(path.join(root,'src/main/resources/static/samples/型材架子_610x670_H2050.json'),'utf8'));
sample.parts.push(...parts);const loaded=Schema.load(JSON.parse(JSON.stringify(sample))).project;
assert.deepEqual(loaded.parts.slice(-11).map(p=>p.dimensions),parts.map(p=>p.dimensions));
const bad=structuredClone(sample);bad.parts.at(-1).dimensions.width=1;assert.throws(()=>Schema.load(bad));
const {default:Drawing}=await import(moduleUrl(path.join(js,'drawing/EngineeringDrawingModel.js')));
const drawing=new Drawing({parts}).buildProject({views:['FRONT']});
const ring=drawing.views.FRONT.entities.find(x=>x.partId==='ring');assert.equal(ring.rings.length,2);
const cross=drawing.views.FRONT.entities.find(x=>x.partId==='cross');assert.equal(cross.rings[0].length,12);
assert.ok(drawing.views.FRONT.entities.find(x=>x.partId==='sphere').polygon.length>20);
console.log(JSON.stringify({ok:true,version:CURRENT_APP_VERSION,schema:62,profileReference:16,connectionTypes:18,connectorSpecs,shaftTypes:10,panelShapes:11,accessoryTypes:4,footSpecs:catalog.FootCupOptions.length,geometryCases,shapeRoundTrip:true,nonRectangularDrawing:true}));
