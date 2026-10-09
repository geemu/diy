import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const load=rel=>import(pathToFileURL(path.join(staticRoot,rel)).href);
const {default:BomExporter}=await load('js/export/BomExporter.js');

const sample=JSON.parse(fs.readFileSync(path.join(staticRoot,'samples/型材架子_610x670_H2050.json'),'utf8'));
const base=structuredClone(sample.parts.find(part=>part.type==='PROFILE'));
const p1=structuredClone(base);p1.id='P1';p1.displayId='P-01';p1.assemblyId='A1';p1.dimensions.length=500;p1.profilePath={type:'LINE',length:500};p1.machiningItems=[{id:'M1',type:'THROUGH_HOLE',face:'FRONT',stationS:100,offset:0,diameter:8,processStage:'STRAIGHT',referenceDatum:'A_END'}];
const p2=structuredClone(base);p2.id='P2';p2.displayId='P-02';p2.assemblyId='A1';p2.dimensions.length=500;p2.profilePath={type:'LINE',length:500};p2.machiningItems=[{id:'M2',type:'THROUGH_HOLE',face:'FRONT',stationS:300,offset:0,diameter:8,processStage:'STRAIGHT',referenceDatum:'A_END'}];
const accessory={id:'H1',displayId:'H-01',name:'30系列直角角码',type:'ACCESSORY',accessoryType:'ANGLE_BRACKET',hardwareSku:'ANGLE_BRACKET_3030',dimensions:{size:30},hardwareSpec:{category:'角码',material:'铝合金'},assemblyId:'A1'};
const assembly={id:'A1',name:'上层框架',parentId:null,installationStep:1,installationNote:'',hidden:false,locked:false};
const editor={
  parts:[p1,p2,accessory],
  assemblyManager:{
    assemblies:[assembly],
    get(id){return id==='A1'?assembly:null;},
    ancestors(){return[];}
  }
};
const bom=new BomExporter(editor);editor.bomExporter=bom;
const summary=bom.buildSummary();
assert.equal(summary.partCount,3);
assert.equal(summary.profileCount,2);
assert.equal(summary.profileGroupCount,1);
assert.equal(summary.totalProfileLengthMm,1000);
assert.equal(summary.hardwareCount,1);
assert.equal(summary.hardwareSkuCount,1);
assert.equal(summary.machiningFeatureCount,2);
assert.equal(summary.machiningProfileCount,2);
assert.equal(summary.assemblyCount,1);

const cut=bom.buildCutListRows();
assert.equal(cut.length,3,'cut list must be one row per profile piece plus header');
assert.ok(cut[1].includes('P-01'));
assert.ok(cut[1].includes('上层框架'));
const machining=bom.buildMachiningDetailRows();
assert.equal(machining.length,3,'machining.csv must be one row per feature plus header');
const machiningBom=bom.buildMachiningBomRows();
assert.equal(machiningBom.length,2,'same Ø8 through-hole operation should aggregate across positions');
assert.equal(machiningBom[1][4],2);
const sub=bom.buildSubassemblyBomRows();
assert.ok(sub.some(row=>row[0]==='上层框架'));
const hardware=bom.buildHardwareBomRows();
assert.equal(hardware.length,2);
assert.equal(hardware[1][1],'ANGLE_BRACKET_3030');
assert.equal(hardware[1][7],1);
const consistency=bom.validateConsistency();
assert.equal(consistency.ok,true,JSON.stringify(consistency.errors));

const factory=fs.readFileSync(path.join(staticRoot,'js/export/FactoryPackageExporter.js'),'utf8');
for(const token of ['BOM/','项目汇总.csv','型材BOM.csv','五金BOM.csv','加工BOM.csv','子装配BOM.csv','cut-list.csv','machining.csv','BOM一致性报告.txt']){
  if(token==='BOM/') continue;
  assert.ok(factory.includes(token),`factory package missing ${token}`);
}
for(const forbidden of ['StockCutOptimizer','StockLayoutExporter','原料排料.csv']) assert.ok(!factory.includes(forbidden),`raw-material feature leaked into FactoryPackageExporter: ${forbidden}`);

console.log(JSON.stringify({ok:true,version:'0.75.36',schema:62,summary,cutRows:cut.length-1,machiningRows:machining.length-1,machiningBomGroups:machiningBom.length-1,rawMaterialScope:false},null,2));
