import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const moduleUrl=relative=>pathToFileURL(path.join(root,'src/main/resources/static/js',relative)).href;
const {default:PartCollisionDetector,profileObb,intersectObb}=await import(moduleUrl('validation/PartCollisionDetector.js'));
const {default:ConnectionCompletenessInspector}=await import(moduleUrl('validation/ConnectionCompletenessInspector.js'));
const {default:FactoryValidator}=await import(moduleUrl('validation/FactoryValidator.js'));

function profile(id,{position={x:0,y:0,z:0},rotation={x:0,y:0,z:0},length=100,section=30}={}){
  return {id,displayId:id,name:id,type:'PROFILE',position,rotation,dimensions:{length,sectionSize:[section,section]},profilePath:{type:'LINE',length},profileSpec:{catalogId:'EU30-3030',nominal:'3030',variant:'3030'},machiningItems:[],endCuts:{START:{angleDeg:0,axis:'X'},END:{angleDeg:0,axis:'X'}}};
}

const a=profile('A');
const touch=profile('TOUCH',{position:{x:0,y:0,z:100}});
const penetrate=profile('PEN',{position:{x:0,y:0,z:99}});
assert.equal(intersectObb(profileObb(a),profileObb(touch),0.5).intersects,false,'end-face touch must not be collision');
const penetration=intersectObb(profileObb(a),profileObb(penetrate),0.5);
assert.equal(penetration.intersects,true,'1mm penetration must be detected above 0.5mm tolerance');
assert.ok(penetration.minPenetrationMm>0.5);

const cross=profile('CROSS',{rotation:{x:0,y:Math.PI/2,z:0}});
const collisionEditor={parts:[a,cross],projectSettings:{collisionToleranceMm:0.5}};
const collisionReport=new PartCollisionDetector(collisionEditor).inspect();
assert.equal(collisionReport.errors.length,1);
assert.equal(collisionReport.errors[0].code,'PROFILE_VOLUME_COLLISION');
assert.deepEqual(collisionReport.errors[0].partIds,['A','CROSS']);

const beam=profile('BEAM',{position:{x:0,y:0,z:0},length:100});
const post=profile('POST',{position:{x:0,y:0,z:65},rotation:{x:0,y:Math.PI/2,z:0},length:100});
const contactEditor={parts:[beam,post],projectSettings:{contactToleranceMm:1},connectionManager:{connections:[]},constraintManager:{constraints:[]}};
const contactReport=new ConnectionCompletenessInspector(contactEditor).inspect();
assert.ok(contactReport.warnings.some(item=>item.code==='GEOMETRIC_CONTACT_WITHOUT_CONNECTION'));
contactEditor.connectionManager.connections=[{id:'C1',sourceProfileId:'BEAM',targetProfileId:'POST',status:'VALID'}];
const represented=new ConnectionCompletenessInspector(contactEditor).inspect();
assert.equal(represented.warnings.length,0,'represented joint must not be reported missing');

const validatorEditor={
  parts:[a,cross],
  projectSettings:{minimumEndDistanceMm:8,duplicatePositionToleranceMm:0.05,collisionToleranceMm:0.5,contactToleranceMm:1},
  connectionManager:{connections:[]},constraintManager:{constraints:[]},
  getMeshByPartId(id){const part=this.parts.find(item=>item.id===id);return part?{userData:{part}}:null;}
};
const factoryResult=new FactoryValidator(validatorEditor).validate();
assert.ok(factoryResult.errors.some(item=>item.code==='PROFILE_VOLUME_COLLISION'));
assert.ok(factoryResult.categories.COLLISION>=1);
assert.equal(factoryResult.ok,false);

const html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'src/main/resources/static/js/app.js'),'utf8');
const factory=fs.readFileSync(path.join(root,'src/main/resources/static/js/export/FactoryPackageExporter.js'),'utf8');
assert.ok(html.includes('生产检查'));
assert.ok(html.includes('定位模型'));
assert.ok(app.includes('focusValidationIssue'));
assert.ok(factory.includes('生产检查报告.txt'));

console.log(JSON.stringify({ok:true,version:'0.75.25',schema:62,obbSat:true,contactCompleteness:true,locatableIssues:true,factoryGate:true},null,2));
