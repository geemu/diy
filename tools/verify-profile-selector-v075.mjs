import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
const design=await import(moduleUrl(path.join(js,'model/DesignProfileCatalog.js')));
const catalog=await import(moduleUrl(path.join(js,'model/ProfileCatalog.js')));
const registry=await import(moduleUrl(path.join(js,'model/ProfileSectionRegistry.js')));
const {default:selector}=await import(moduleUrl(path.join(js,'ui/ProfileSelector.js')));
const {default:factory}=await import(moduleUrl(path.join(js,'geometry/ProfileGeometryFactory.js')));
const {default:Schema}=await import(moduleUrl(path.join(js,'io/ProjectSchema.js')));
const feature=await import(moduleUrl(path.join(js,'model/ProfileFeatureCatalog.js')));
const {catalogPresentation}=await import(moduleUrl(path.join(js,'interaction/CatalogPresentation.js')));
const choices=design.getDesignProfileChoices(),groups=design.groupDesignProfiles(choices);
assert.equal(groups.length,20,'19 个矩形外尺寸组与一个 U 型组；圆角不单列尺寸');
const family=groups.find(item=>item.id==='DESIGN-3030');
for(const id of ['DESIGN-3030','DESIGN-3030R','EU30-3030A','EU30-3030B','EU30-3030X','EU30-J3030'])assert.ok(family.models.some(item=>item.id===id),id);
assert.ok(!groups.some(item=>item.label.includes('3030A')),'一级不列变体');
assert.equal(family.models.filter(item=>item.name==='3030').length,0,'标准项沿用几何名称，由选择器显示 3030');
assert.ok(!choices.some(item=>item.id==='EU30-3030'),'同名标准项不重复');
assert.equal(design.getDesignProfileDefinition('3030N1'),null,'不凭用户举例名称伪造不存在的图档');
assert.ok(catalogPresentation({type:'PROFILE',dimensions:{profileId:'EU30-3030A'},designProfile:{faceClosures:['BACK']}}).direction[1]<0,'单封面的预览必须露出封闭背面');
const presentationB=catalogPresentation({type:'PROFILE',dimensions:{profileId:'EU30-3030B'},designProfile:{faceClosures:['BACK','RIGHT']}});
assert.ok(presentationB.direction[0]>0&&presentationB.direction[1]<0,'双封面预览应同时露出两个封面');
for(const definition of choices)for(const forbidden of ['system','alloy','supplier','defaultWallThickness','wallThicknessOptions','price'])assert.equal(definition[forbidden],undefined);

const events=[],context={modelValue:'EU30-3030A',groups,$emit:(...args)=>events.push(args)};
context.choose=selector.methods.choose.bind(context);
assert.equal(selector.computed.selectedGroup.call(context).id,'DESIGN-3030');
selector.methods.chooseGroup.call(context,{target:{value:'DESIGN-4040'}});
assert.deepEqual(events,[['update:modelValue','DESIGN-4040'],['change',{previousId:'EU30-3030A',profileId:'DESIGN-4040'}]]);
events.length=0;context.choose('EU30-3030B');assert.deepEqual(events,[['update:modelValue','EU30-3030B'],['change',{previousId:'EU30-3030A',profileId:'EU30-3030B'}]]);
events.length=0;context.choose('EU30-3030A');assert.equal(events.length,0,'选择相同型号不得反复重建构件');

const a=design.getDesignProfileDefinition('EU30-3030A');
assert.deepEqual(a.slotDefinitions,catalog.getProfileDefinition(a.id).slotDefinitions);
const sectionA=registry.getSectionDefinition(a.id),sectionB=registry.getSectionDefinition('EU30-3030B');
assert.notDeepEqual(sectionA.outer,sectionB.outer,'A/B 的封闭面不同，不能靠虚构内腔差异区分型号');
assert.ok(registry.getSectionDefinition(a.id,['FRONT']).outer.length<sectionA.outer.length,'封边同时影响几何');
const part={id:'P-test',type:'PROFILE',name:a.name,designProfile:{profileId:a.id,nominal:a.nominal,series:a.series,slotWidth:a.slotWidth,faceClosures:[]},manufacturingProfile:null,dimensions:{length:300,sectionSize:a.sectionSize},profilePath:{type:'LINE',length:300},transform:{position:{x:0,y:15,z:0},rotation:{x:0,y:0,z:0}},machiningFeatures:[]};
const mesh=factory.create(part);mesh.traverse(child=>{if(child.geometry){const positions=child.geometry.attributes.position;for(const value of positions.array)assert.ok(Number.isFinite(value));child.geometry.dispose();}if(child.material)for(const material of [].concat(child.material))material.dispose();});
const project={schemaVersion:62,parts:[part],connections:[],constraints:[],assemblies:[],profileSections:[],dimensions:[]};
const loaded=Schema.load(JSON.parse(JSON.stringify(project))).project;assert.equal(loaded.parts[0].designProfile.profileId,a.id);assert.equal(loaded.parts[0].manufacturingProfile,null);

// 动态目录也按实际外尺寸归组，即使目录名称不包含尺寸；停用项只解析，不用于新建。
catalog.registerProfileDefinition({id:'TEST-EXPLICIT-3030',nominal:'自定义名称',variant:'试验截面',sectionSize:[30,30],series:'30',slotWidth:8,slotDefinitions:[],sourceFamily:'DATABASE',enabled:true});
registry.registerCatalogSection('TEST-EXPLICIT-3030',{outer:[{x:-15,y:-15},{x:15,y:-15},{x:15,y:15},{x:-15,y:15}],holes:[]});
assert.ok(design.groupDesignProfiles(design.getDesignProfileChoices()).find(item=>item.id==='DESIGN-3030').models.some(item=>item.id==='TEST-EXPLICIT-3030'));
assert.equal(registry.getSectionDefinition('TEST-EXPLICIT-3030').sourceType,'DATABASE_CATALOG');
assert.deepEqual(feature.getSlotDefinitionsForFace({designProfile:{profileId:'TEST-EXPLICIT-3030'}},'FRONT'),[],'显式无槽不能凭外尺寸虚构吸附槽位');
catalog.unregisterProfileDefinition('TEST-EXPLICIT-3030');registry.removeCatalogSection('TEST-EXPLICIT-3030');

const html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
for(const id of ['design-profile-choice','selected-profile-choice','replace-profile-choice'])assert.ok(html.includes(`input-id="${id}"`));
assert.ok(html.includes('构件方向')&&html.includes('画布方向')&&html.includes('旋转中心无关'));
const sceneSource=fs.readFileSync(path.join(js,'core/SceneManager.js'),'utf8');
assert.ok(sceneSource.includes('this.resetInitialView();'),'启动必须使用独立的上前初始化方向');
const THREE=await import(threeUrl);
const verifiedClosures={
  'EU20-2020A':['BACK'],'EU20-2020B':['BACK','RIGHT'],
  'EU30-3030A':['BACK'],'EU30-3030B':['BACK','RIGHT'],'EU30-3030H':['FRONT','BACK'],
  'EU30-3030T':['FRONT','BACK','RIGHT'],'EU30-3060A':['RIGHT'],'EU30-3060B':['LEFT','RIGHT','FRONT'],
  'EU40-4040F':[],'EU40-4040H':['FRONT','BACK'],'EU40-4040T':['FRONT','BACK','RIGHT']
};
let faceCases=0;
for(const [id,closed] of Object.entries(verifiedClosures)) {
  const definition=design.getDesignProfileDefinition(id);
  assert.deepEqual(definition.defaultFaceClosures,closed);
  const testPart={...part,designProfile:{...part.designProfile,profileId:id,faceClosures:[...closed]},dimensions:{length:100,sectionSize:definition.sectionSize}};
  const object=factory.create(testPart);object.updateMatrixWorld(true);
  const [width,height]=definition.sectionSize;
  for(const [face,direction,extent] of [['FRONT',new THREE.Vector3(0,1,0),height/2],['BACK',new THREE.Vector3(0,-1,0),height/2],['LEFT',new THREE.Vector3(-1,0,0),width/2],['RIGHT',new THREE.Vector3(1,0,0),width/2]]) {
    const slots=feature.getSlotDefinitionsForFace(testPart,face);
    if(closed.includes(face)) {
      assert.equal(slots.length,0,`${id} ${face} 不能有槽位吸附`);
      const ray=new THREE.Raycaster(direction.clone().multiplyScalar(extent+20),direction.clone().negate());
      const hit=ray.intersectObject(object,true).find(item=>item.object.isMesh);
      assert.ok(hit&&Math.abs(hit.distance-20)<1e-5,`${id} ${face} 必须是真实封闭壁面`);
    } else assert.ok(slots.length>0,`${id} ${face} 应保留槽位`);
    faceCases++;
  }
  const section=registry.getSectionDefinition(id);
  const inside=point=>{let result=false;for(let i=0,j=section.outer.length-1;i<section.outer.length;j=i++){const a=section.outer[i],b=section.outer[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;};
  for(const ring of section.holes)for(const point of ring)assert.ok(inside(point),`${id} 内腔不能与 T 槽相交`);
  object.traverse(child=>{child.geometry?.dispose();for(const material of [].concat(child.material||[]))material.dispose();});
}
const replacementSource=fs.readFileSync(path.join(js,'model/ProfileReplacementManager.js'),'utf8');
const applyDefinition=new Function('getDesignProfileDefinition','part','definition','options',replacementSource.match(/function applyDefinition\([^\n]*\) \{([\s\S]*?)\n\}/)[1]);
const replacementPart={...part,designProfile:{...part.designProfile,profileId:'EU30-3030B',faceClosures:['BACK','RIGHT','FRONT']}};
applyDefinition(design.getDesignProfileDefinition,replacementPart,a,{});
assert.deepEqual(replacementPart.designProfile.faceClosures,['BACK','FRONT'],'B→A 移除原型号自带封面，保留用户额外封边');
const setView=new Function('THREE','direction','center','distance','options',sceneSource.match(/\n  setView\([^\n]*\) \{([\s\S]*?)\n  \}/)[1]);
const manager={camera:new THREE.PerspectiveCamera(38,1.6,1,50000),orbitControls:{target:new THREE.Vector3(0,500,0),update(){}}};
manager.setView=(...args)=>setView.call(manager,THREE,...args);
const resetInitialView=new Function('THREE',sceneSource.match(/\n  resetInitialView\(\) \{([\s\S]*?)\n  \}/)[1]);
resetInitialView.call(manager,THREE);
const offset=manager.camera.position.clone().sub(manager.orbitControls.target);
assert.ok(Math.abs(offset.x)<1e-6&&offset.y>0&&offset.z>0,'初始化只从上、前方向观察，不偏向右');
assert.ok(Math.abs(offset.y-offset.z)<1e-6,'上前边为 45 度');
assert.ok(Math.abs(offset.length()-3000)<1e-6);
const toolbar=html.slice(html.indexOf('<div class="canvas-transform-bar"'),html.indexOf('<div class="quick-rotate-bar"'));
assert.ok(toolbar.includes('class="draw-hud"')&&toolbar.includes('确认这一根')&&toolbar.includes('取消当前段'));
assert.equal((html.match(/class="draw-hud"/g)||[]).length,1,'不残留独立绘制大卡片');
assert.ok(html.includes('drawing-status')&&!html.includes('draw-hud-heading'));
console.log(JSON.stringify({ok:true,version:'0.75.2',sizeGroups:groups.length,modelChoices:choices.length,models3030:family.models.length,concreteGeometry:true,schemaRoundTrip:true,manufacturingUnbound:true,cascadingSelection:true,closedFaceCases:faceCases,compactDrawingBar:true,initialUpperFront:true}));
