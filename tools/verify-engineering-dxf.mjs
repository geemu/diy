import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const load=rel=>import(pathToFileURL(path.join(staticRoot,rel)).href);

const {default:EngineeringDrawingModel}=await load('js/drawing/EngineeringDrawingModel.js');
const {default:EngineeringDrawingLayout}=await load('js/drawing/EngineeringDrawingLayout.js');
const dxfModule=await load('js/drawing/EngineeringDrawingDxfExporter.js');
const {default:EngineeringDrawingDxfExporter,ENGINEERING_DRAWING_DXF_VERSION,ENGINEERING_DXF_LAYERS}=dxfModule;

assert.equal(ENGINEERING_DRAWING_DXF_VERSION,1);
assert.deepEqual(Object.keys(ENGINEERING_DXF_LAYERS),['PROFILE','CENTER','DIMENSION','TEXT','TITLEBLOCK','VIEW','HIDDEN']);

const parts=[
  {id:'P1',displayId:'P-01',name:'左立柱',type:'PROFILE',position:{x:-300,y:500,z:0},rotation:{x:-Math.PI/2,y:0,z:0},dimensions:{length:1000,sectionSize:[30,30]},profilePath:{type:'LINE',length:1000}},
  {id:'P2',displayId:'P-02',name:'右立柱',type:'PROFILE',position:{x:300,y:500,z:0},rotation:{x:-Math.PI/2,y:0,z:0},dimensions:{length:1000,sectionSize:[30,30]},profilePath:{type:'LINE',length:1000}},
  {id:'P3',displayId:'P-03',name:'横梁',type:'PROFILE',position:{x:0,y:985,z:0},rotation:{x:0,y:Math.PI/2,z:0},dimensions:{length:570,sectionSize:[30,30]},profilePath:{type:'LINE',length:570}}
];
const editor={parts,meshes:[],syncPartFromMesh(){},assemblyManager:{get(){return null;},partIds(){return[];}}};
const model=new EngineeringDrawingModel(editor).buildProject({projectName:'鱼缸架 CAD',revision:'C'});
const layout=EngineeringDrawingLayout.layout(model,{paper:'A3'});
const exporter=new EngineeringDrawingDxfExporter();
const dxf=exporter.export(model,layout,{projectName:'鱼缸架 CAD',revision:'C'});

for(const token of ['SECTION','TABLES','LTYPE','LAYER','ENTITIES','EOF','$INSUNITS','AC1015']) assert.ok(dxf.includes(token),`DXF missing ${token}`);
for(const layer of ['PROFILE','CENTER','DIMENSION','TEXT','TITLEBLOCK','VIEW','HIDDEN']) assert.ok(dxf.includes(`\n2\n${layer}\n`)||dxf.includes(`\n8\n${layer}\n`),`missing layer ${layer}`);
assert.ok(dxf.includes('\\U+9C7C\\U+7F38\\U+67B6'), 'Chinese title should use DXF Unicode escape');
assert.ok((dxf.match(/\n0\nLINE\n/g)||[]).length>=20,'expected editable LINE entities');
assert.ok((dxf.match(/\n0\nTEXT\n/g)||[]).length>=8,'expected TEXT entities');
assert.ok((dxf.match(/\n0\nSOLID\n/g)||[]).length>=4,'expected dimension arrow SOLID entities');
assert.ok(dxf.includes('\n8\nDIMENSION\n'),'dimension geometry must be on DIMENSION layer');
assert.ok(dxf.includes('\n8\nCENTER\n'),'center lines must be on CENTER layer');

const serviceText=fs.readFileSync(path.join(staticRoot,'js/drawing/EngineeringDrawingService.js'),'utf8');
const factoryText=fs.readFileSync(path.join(staticRoot,'js/export/FactoryPackageExporter.js'),'utf8');
const html=fs.readFileSync(path.join(staticRoot,'index.html'),'utf8');
for(const token of ['EngineeringDrawingDxfExporter','exportDxf','downloadDxf']) assert.ok(serviceText.includes(token),`service missing ${token}`);
for(const token of ['总装工程图_${drawingPaper}.dxf','DXF图层说明.json','sheet.dxf']) assert.ok(factoryText.includes(token),`factory missing ${token}`);
assert.ok(html.includes('导出 DXF 制图文件'));

console.log(JSON.stringify({ok:true,version:'0.68.0',schema:62,dxfVersion:1,layers:Object.keys(ENGINEERING_DXF_LAYERS),sheetUnits:'mm',svgDxfSharedModel:true},null,2));
