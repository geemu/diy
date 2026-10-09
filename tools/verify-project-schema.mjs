import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname,'..');
const staticRoot = path.join(root,'src/main/resources/static');
const schemaModule = await import(pathToFileURL(path.join(staticRoot,'js/io/ProjectSchema.js')).href);
const {default:ProjectSchema,CURRENT_PROJECT_SCHEMA_VERSION,CURRENT_APP_VERSION} = schemaModule;

assert.equal(CURRENT_PROJECT_SCHEMA_VERSION,62);
assert.equal(CURRENT_APP_VERSION,'0.75.36');

const sample = {
  metadata:{name:'Schema 62 验证工程'},
  schemaVersion:62,
  parts:[
    {
      id:'P1',displayId:'P001',name:'30×30 槽型材',type:'PROFILE',
      position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},
      dimensions:{length:500,size:30,sectionSize:[30,30]},
      designProfile:{profileId:'DESIGN-3030',nominal:'3030',series:'30',slotWidth:8,faceClosures:[]},
      manufacturingProfile:null,
      profilePath:{type:'LINE',length:500},endCuts:{START:{angleDeg:0,axis:'X'},END:{angleDeg:0,axis:'X'}},
      machiningItems:[],assemblyId:null,hidden:false,locked:false
    },
    {
      id:'P2',displayId:'P002',name:'30×30 槽型材',type:'PROFILE',
      position:{x:500,y:0,z:0},rotation:{x:0,y:0,z:0},
      dimensions:{length:500,size:30,sectionSize:[30,30]},
      designProfile:{profileId:'DESIGN-3030',nominal:'3030',series:'30',slotWidth:8,faceClosures:[]},
      manufacturingProfile:null,
      profilePath:{type:'LINE',length:500},endCuts:{START:{angleDeg:0,axis:'X'},END:{angleDeg:0,axis:'X'}},
      machiningItems:[],assemblyId:null,hidden:false,locked:false
    }
  ],
  connections:[{
    id:'C1',designType:'ANGLE_BRACKET',type:'ANGLE_BRACKET',manufacturingRuleId:null,
    sourceProfileId:'P1',targetProfileId:'P2',sourceEnd:'END',targetFace:'LEFT',generatedHardwareIds:[]
  }],
  constraints:[],assemblies:[],profileSections:[],dimensions:[],manufacturing:{},editorState:{}
};

const shippedSample=JSON.parse(fs.readFileSync(path.join(staticRoot,'samples/型材架子_610x670_H2050.json'),'utf8'));
const loadedShippedSample=ProjectSchema.load(shippedSample);
assert.equal(loadedShippedSample.project.schemaVersion,62);
assert.ok(loadedShippedSample.project.parts.every(part=>part.type!=='PROFILE'||(part.designProfile?.profileId&&part.manufacturingProfile===null)),'内置示例必须从设计模型开始，真实制造规格留空');

const loaded = ProjectSchema.load(sample);
assert.equal(loaded.project.schemaVersion,62);
assert.equal(loaded.project.metadata.version,'0.75.36');
assert.equal(loaded.project.parts[0].designProfile.profileId,'DESIGN-3030');
assert.equal(loaded.project.parts[0].manufacturingProfile,null);
assert.equal(loaded.project.connections[0].designType,'ANGLE_BRACKET');
assert.equal(loaded.project.connections[0].manufacturingRuleId,null);
assert.equal(loaded.project.editorState.designModelVersion,1);
assert.equal(loaded.project.editorState.manufacturingConfigurationVersion,1);
assert.equal(loaded.project.editorState.connectionAnchorVersion,1);
assert.equal(loaded.project.editorState.connectionPlacementVersion,2);
assert.equal(loaded.project.editorState.machiningPlacementVersion,1);
assert.equal(Object.hasOwn(loaded.project.editorState,'workbenchMode'),false);
assert.equal(loaded.project.editorState.autoConnectionSystemVersion,2);
assert.equal(loaded.project.editorState.autoConnectionEnabled,true);
assert.equal(loaded.project.editorState.dimensionSystemVersion,2);
assert.equal(loaded.project.editorState.engineeringDrawingSystemVersion,2);
assert.equal(loaded.project.editorState.profileGripEditingVersion,1);
assert.equal(loaded.project.editorState.profileGripDefaults.gridStepMm,10);

for (const unsupported of [59,49,48,41,1]) {
  const old = structuredClone(sample);
  old.schemaVersion = unsupported;
  assert.throws(() => ProjectSchema.load(old), /仅支持 schema v62/);
}

const malformed = structuredClone(sample);
delete malformed.dimensions;
assert.throws(() => ProjectSchema.load(malformed), /缺少数组字段：dimensions/);

const oldProfile = structuredClone(sample);
delete oldProfile.parts[0].designProfile;
oldProfile.parts[0].profileSpec={catalogId:'EU30-3030'};
assert.throws(() => ProjectSchema.load(oldProfile), /缺少 designProfile\.profileId/);

const oldConnection=structuredClone(sample);
delete oldConnection.connections[0].designType;
oldConnection.connections[0].ruleId='ANGLE_BRACKET_30_M6';
assert.throws(()=>ProjectSchema.load(oldConnection),/缺少有效 designType/);

const forbiddenPart=structuredClone(sample);
forbiddenPart.parts.push({id:'OLD',type:'CONNECTOR'});
assert.throws(()=>ProjectSchema.load(forbiddenPart),/不支持构件类型/);

for (const forbidden of ['stockLengthMm','sawKerfMm','endTrimMm','minReusableOffcutMm']) {
  assert.equal(loaded.project.manufacturing[forbidden],undefined,`raw material field must be absent: ${forbidden}`);
}

console.log(JSON.stringify({
  ok:true,
  schema:62,
  currentOnly:true,
  version:'0.75.36',
  designManufacturingSeparated:true,
  abstractDesignConnections:true,
  legacyProjectCompatibility:false,
  unifiedWorkbench:true
},null,2));
