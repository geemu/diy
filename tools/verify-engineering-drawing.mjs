import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const html=read('src/main/resources/static/index.html');
const editor=read('src/main/resources/static/js/core/Editor.js');
const schema=read('src/main/resources/static/js/io/ProjectSchema.js');
const factory=read('src/main/resources/static/js/export/FactoryPackageExporter.js');
const pom=read('pom.xml');

assert.match(schema,/CURRENT_PROJECT_SCHEMA_VERSION = 62/);
assert.match(schema,/CURRENT_APP_VERSION = '0\.75\.10'/);
assert.ok(html.includes('v0.75.10'));
assert.ok(pom.includes('<version>0.75.10</version>'));
for(const token of ['二维工程图','A3 横向','A4 横向','导出 DXF 制图文件']) assert.ok(html.includes(token),`missing UI: ${token}`);
for(const token of ['EngineeringDrawingService','engineeringDrawingService','drawingSettings']) assert.ok(editor.includes(token),`missing editor integration: ${token}`);
for(const token of ['装配工程图','总装工程图_model.json','drawingPaper','buildSubassemblySheets']) assert.ok(factory.includes(token),`missing factory drawing output: ${token}`);

const modelModule=await import(pathToFileURL(path.join(staticRoot,'js/drawing/EngineeringDrawingModel.js')).href);
const layoutModule=await import(pathToFileURL(path.join(staticRoot,'js/drawing/EngineeringDrawingLayout.js')).href);
const svgModule=await import(pathToFileURL(path.join(staticRoot,'js/drawing/EngineeringDrawingSvgExporter.js')).href);
assert.equal(modelModule.ENGINEERING_DRAWING_MODEL_VERSION,1);
assert.equal(layoutModule.ENGINEERING_DRAWING_LAYOUT_VERSION,1);

const parts=[
  {id:'P1',displayId:'P-01',name:'左立柱',type:'PROFILE',position:{x:-300,y:500,z:0},rotation:{x:-Math.PI/2,y:0,z:0},dimensions:{length:1000,sectionSize:[30,30]},profilePath:{type:'LINE',length:1000}},
  {id:'P2',displayId:'P-02',name:'右立柱',type:'PROFILE',position:{x:300,y:500,z:0},rotation:{x:-Math.PI/2,y:0,z:0},dimensions:{length:1000,sectionSize:[30,30]},profilePath:{type:'LINE',length:1000}},
  {id:'P3',displayId:'P-03',name:'横梁',type:'PROFILE',position:{x:0,y:985,z:0},rotation:{x:0,y:Math.PI/2,z:0},dimensions:{length:570,sectionSize:[30,30]},profilePath:{type:'LINE',length:570}}
];
const mockEditor={parts,meshes:[],syncPartFromMesh(){},assemblyManager:{get(){return null;},partIds(){return[];}}};
const Model=modelModule.default;
const model=new Model(mockEditor).buildProject({projectName:'Test Frame',revision:'B'});
assert.equal(model.scope.partCount,3);
for(const key of ['FRONT','TOP','RIGHT','ISO']) assert.ok(model.views[key],`missing view ${key}`);
assert.ok(model.views.FRONT.entities.length===3);
assert.ok(model.views.FRONT.dimensions.length>=2);
assert.ok(model.overall.width>500);
assert.ok(model.overall.height>900);


const leftModel=new Model(mockEditor).buildProject({projectName:'Test Frame',views:['FRONT','TOP','LEFT','ISO']});
assert.ok(leftModel.views.LEFT);
const leftLayout=layoutModule.default.layout(leftModel,{paper:'A4'});
assert.ok(leftLayout.views.LEFT);
const leftSvg=new svgModule.default().export(leftModel,leftLayout,{projectName:'Test Frame'});
assert.ok(leftSvg.includes('左视图'));

const layout=layoutModule.default.layout(model,{paper:'A3'});
assert.equal(layout.paper.name,'A3');
assert.ok(layout.views.FRONT.layout.scale>0);
assert.ok(layout.titleBlock.height>0);
const svg=new svgModule.default().export(model,layout,{projectName:'Test Frame',revision:'B'});
for(const token of ['正视图','俯视图','右视图','等轴测图','title-block','Test Frame','版本 B']) assert.ok(svg.includes(token),`missing SVG token ${token}`);

console.log(JSON.stringify({ok:true,version:'0.75.10',schema:62,drawingModel:1,views:['FRONT','TOP','RIGHT','ISO'],paper:['A3','A4'],factoryPackage:true},null,2));
