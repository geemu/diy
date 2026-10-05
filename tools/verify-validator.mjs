import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname,'..');
const moduleUrl = relative => pathToFileURL(path.join(root,'src/main/resources/static/js',relative)).href;
const {default: ProjectSchema} = await import(moduleUrl('io/ProjectSchema.js'));
const {default: FactoryValidator} = await import(moduleUrl('validation/FactoryValidator.js'));
const {normalizeProfilePath} = await import(moduleUrl('model/ProfilePath.js'));

const raw = {
  metadata:{name:'验证工程'},schemaVersion:59,
  parts:[{
    id:'P1',displayId:'P001',name:'30×30 槽型材',type:'PROFILE',
    position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},
    dimensions:{length:500,size:30,sectionSize:[30,30]},
    designProfile:{profileId:'DESIGN-3030',nominal:'3030',series:'30',slotWidth:8,faceClosures:[]},
    manufacturingProfile:null,profilePath:{type:'LINE',length:500},
    endCuts:{START:{angleDeg:0,axis:'X'},END:{angleDeg:0,axis:'X'}},
    machiningItems:[],assemblyId:null,hidden:false,locked:false
  }],
  connections:[],constraints:[],assemblies:[],profileSections:[],dimensions:[],manufacturing:{},editorState:{}
};
const current = ProjectSchema.load(raw).project;
for (const part of current.parts) if (part.type === 'PROFILE') normalizeProfilePath(part);

const baseEditor = parts => ({
  parts,
  projectSettings: current.manufacturing,
  connectionManager: {connections: [],evaluateConnectionGeometry(){return {ok:true,errors:[],warnings:[]};}},
  constraintManager:{constraints:[]},
  getMeshByPartId(id) {
    const part = this.parts.find(item => item.id === id);
    return part ? {userData:{part}} : null;
  }
});

// Manufacturing validation must block a design-only project until real material is mapped.
const designOnlyResult = new FactoryValidator(baseEditor(current.parts)).validate();
if (!designOnlyResult.errors.some(item => item.code === 'MANUFACTURING_PROFILE_UNCONFIGURED')) {
  throw new Error('未配置真实制造型材时，制造检查必须阻断');
}
if (!designOnlyResult.infos.some(item => item.code === 'DESIGN_REFERENCE_SECTION')) {
  throw new Error('设计阶段应提示真实材料截面留到制造配置阶段');
}

// After material configuration the profile itself should no longer be blocked by manufacturing mapping.
const configured = structuredClone(current.parts[0]);
configured.manufacturingProfile={profileId:'EU30-3030',name:'欧标 3030',system:'欧标',wallThickness:2,slotWidth:8.2,alloy:'6063-T5'};
const configuredResult = new FactoryValidator(baseEditor([configured])).validate();
if (configuredResult.errors.some(item => item.code === 'MANUFACTURING_PROFILE_UNCONFIGURED')) {
  throw new Error('已配置制造型材后不应继续报告未配置错误');
}

const invalid = structuredClone(configured);
invalid.displayId = 'TEST-INVALID';
invalid.machiningItems = [{
  id:'M-INVALID',type:'THROUGH_HOLE',face:'FRONT',stationS:Number(invalid.dimensions.length)+10,offset:1000,diameter:9
}];
const invalidResult = new FactoryValidator(baseEditor([invalid])).validate();
if (!invalidResult.errors.some(item => item.code === 'MACHINING_STATION_OUT_OF_RANGE')) throw new Error('未拦截越界孔位');
if (!invalidResult.errors.some(item => item.code === 'HOLE_EXCEEDS_PROFILE_FACE')) throw new Error('未拦截越界截面孔位');

console.log(JSON.stringify({
  ok:true,
  schema:59,
  manufacturingGate:true,
  designReferenceIsInfo:true,
  designOnlyErrors:designOnlyResult.errors.map(item => item.code),
  invalidCaseErrors:invalidResult.errors.map(item => item.code)
}, null, 2));
