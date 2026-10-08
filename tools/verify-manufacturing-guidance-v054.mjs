import assert from 'node:assert/strict';
import ManufacturingIdentityManager from '../src/main/resources/static/js/manufacturing/ManufacturingIdentityManager.js';
import AssemblyInstructionGenerator from '../src/main/resources/static/js/manufacturing/AssemblyInstructionGenerator.js';
import EngineeringDrawingModel from '../src/main/resources/static/js/drawing/EngineeringDrawingModel.js';
import EngineeringDrawingLayout from '../src/main/resources/static/js/drawing/EngineeringDrawingLayout.js';
import EngineeringDrawingSvgExporter from '../src/main/resources/static/js/drawing/EngineeringDrawingSvgExporter.js';
import EngineeringDrawingDxfExporter from '../src/main/resources/static/js/drawing/EngineeringDrawingDxfExporter.js';
import AssemblyManager from '../src/main/resources/static/js/model/AssemblyManager.js';
import {CURRENT_APP_VERSION,CURRENT_PROJECT_SCHEMA_VERSION} from '../src/main/resources/static/js/io/ProjectSchema.js';

const profile=(id,assemblyId,x)=>({
  id,type:'PROFILE',name:'30×30 型材',assemblyId,
  dimensions:{sectionSize:[30,30],length:600},
  designProfile:{profileId:'DESIGN-3030'},
  position:{x,y:0,z:0},rotation:{x:0,y:0,z:0},machiningItems:[]
});
const p1=profile('p1','a1',0);
const p2=profile('p2','a2',250);
const panel={id:'b1',type:'PANEL',name:'侧板',assemblyId:'a2',dimensions:{width:200,height:300,thickness:5},position:{x:120,y:50,z:0},rotation:{x:0,y:0,z:0}};
const generated={id:'h1',type:'ACCESSORY',name:'M6 螺钉',generatedByConnectionId:'c1',dimensions:{size:10},position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0}};
const assemblies=[
  {id:'a1',name:'底框',installationStep:1,parentId:null},
  {id:'a2',name:'上部组件',installationStep:2,parentId:null}
];
const tree=()=>[
  {...assemblies[0],single:false,parts:[p1],children:[]},
  {...assemblies[1],single:false,parts:[p2,panel],children:[]}
];
const editor={
  parts:[p1,p2,panel,generated],
  connectionManager:{connections:[{id:'c1',designType:'ANGLE_BRACKET',sourceProfileId:'p1',targetProfileId:'p2'}]},
  assemblyManager:{assemblies,tree},
  meshes:[]
};
editor.manufacturingIdentityManager=new ManufacturingIdentityManager(editor);
editor.manufacturingIdentityManager.reconcile();

assert.equal(CURRENT_APP_VERSION,'0.75.23');
assert.equal(CURRENT_PROJECT_SCHEMA_VERSION,62);
assert.equal(p1.manufacturingCode,'P001');
assert.equal(p2.manufacturingCode,'P002');
assert.equal(panel.manufacturingCode,'B001');
assert.equal(generated.manufacturingCode,'H001');
assert.equal(editor.connectionManager.connections[0].manufacturingCode,'C001');
assert.equal(assemblies[0].manufacturingCode,'G001');
const restoredAssemblyManager=new AssemblyManager({parts:[]});
restoredAssemblyManager.load([{...assemblies[0]}]);
assert.equal(restoredAssemblyManager.assemblies[0].manufacturingCode,'G001','组件制造编号必须在保存/重开后保留');

const steps=new AssemblyInstructionGenerator(editor).build();
assert.equal(steps.length,2);
assert.equal(steps[0].connections.length,0,'跨步骤连接不能提前出现在第一步');
assert.equal(steps[1].connections.length,1,'跨步骤连接应归属于后安装构件所在步骤');
assert.deepEqual(steps[1].prerequisiteSteps,[1]);
assert.equal(steps[1].hardware.length,1);
assert.equal(steps[1].hardware[0].code,'H001');

const model=new EngineeringDrawingModel(editor).buildProject({projectName:'编号验证'});
const frontTags=model.views.FRONT.tags.map(item=>item.label);
assert.ok(frontTags.includes('P001'));
assert.ok(frontTags.includes('P002'));
assert.ok(frontTags.includes('B001'));
assert.ok(!frontTags.includes('H001'),'总装工程图默认不标注连接自动派生五金，避免图面过载');
const layout=EngineeringDrawingLayout.layout(model,{paper:'A3'});
const svg=new EngineeringDrawingSvgExporter().export(model,layout,{});
const dxf=new EngineeringDrawingDxfExporter().export(model,layout,{});
assert.match(svg,/P001/);
assert.match(svg,/B001/);
assert.doesNotMatch(svg,/H001/);
assert.match(dxf,/P001/);

console.log(JSON.stringify({
  ok:true,version:CURRENT_APP_VERSION,schema:CURRENT_PROJECT_SCHEMA_VERSION,
  codes:[p1.manufacturingCode,p2.manufacturingCode,panel.manufacturingCode,generated.manufacturingCode],
  steps:steps.map(step=>({step:step.step,connections:step.connections.length,prerequisiteSteps:step.prerequisiteSteps})),
  taggedDrawing:true
},null,2));
