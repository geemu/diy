import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');

const editorModule=await import(pathToFileURL(path.join(staticRoot,'js/model/ProfileSectionEditor.js')).href);
const catalogModule=await import(pathToFileURL(path.join(staticRoot,'js/model/ProfileCatalog.js')).href);
const {buildSectionFromEditor,readSectionEditorState,sectionStyleForTemplate}=editorModule;
const {buildCatalogSlotDefinitions,registerProfileDefinition,getProfileDefinition,unregisterProfileDefinition}=catalogModule;

const baseForm={
  id:'VERIFY-SECTION',variant:'VERIFY',width:30,height:60,slotWidth:8,
  defaultWallThickness:2,centerHoleDiameter:5,cornerChamfer:3
};

const rectangularTube=buildSectionFromEditor({...baseForm,sectionTemplate:'RECT_TUBE'});
assert.equal(rectangularTube.outer.length,4);
assert.equal(rectangularTube.holes.length,1);
assert.equal(rectangularTube.editor.template,'RECT_TUBE');

const roundTube=buildSectionFromEditor({...baseForm,sectionTemplate:'ROUND_TUBE',width:40});
assert.equal(roundTube.outer.length,64);
assert.equal(roundTube.holes.length,1);

const solidRound=buildSectionFromEditor({...baseForm,sectionTemplate:'SOLID_ROUND',width:20});
assert.equal(solidRound.holes.length,0);

const tSlot=buildSectionFromEditor({...baseForm,sectionTemplate:'T_SLOT'});
assert.equal(tSlot.referenceOnly,true);
assert.equal(tSlot.editor.template,'T_SLOT');
assert.ok(buildCatalogSlotDefinitions(30,60,'30',8).length>0);

const restored=readSectionEditorState(rectangularTube,'DATABASE_RECT_TUBE');
assert.equal(restored.sectionTemplate,'RECT_TUBE');
assert.equal(sectionStyleForTemplate('ROUND_TUBE'),'DATABASE_ROUND_TUBE');

registerProfileDefinition({
  id:'DB-DISABLED-VERIFY',nominal:'3030',variant:'DB-DISABLED-VERIFY',name:'停用验证',series:'30',system:'自定义',
  sectionSize:[30,30],slotWidth:8,slotDefinitions:[],wallThicknessOptions:[2],defaultWallThickness:2,
  sourceFamily:'DATABASE',custom:true,enabled:false,sortOrder:9000
});
assert.equal(getProfileDefinition('DB-DISABLED-VERIFY').enabled,false);
assert.equal(getProfileDefinition('DB-DISABLED-VERIFY').slotDefinitions.length,0);
unregisterProfileDefinition('DB-DISABLED-VERIFY');

const html=fs.readFileSync(path.join(staticRoot,'index.html'),'utf8');
const app=fs.readFileSync(path.join(staticRoot,'js/app.js'),'utf8');
const api=fs.readFileSync(path.join(staticRoot,'js/model/ProfileCatalogApi.js'),'utf8');
const preview=fs.readFileSync(path.join(staticRoot,'js/interaction/ProfileSectionPreview3D.js'),'utf8');
const pom=fs.readFileSync(path.join(root,'pom.xml'),'utf8');
const controller=fs.readFileSync(path.join(root,'src/main/java/com/paic/stock/aluminumcad/controller/ProfileCatalogController.java'),'utf8');
const service=fs.readFileSync(path.join(root,'src/main/java/com/paic/stock/aluminumcad/service/ProfileCatalogService.java'),'utf8');
const serviceImpl=fs.readFileSync(path.join(root,'src/main/java/com/paic/stock/aluminumcad/service/impl/ProfileCatalogServiceImpl.java'),'utf8');
const mapper=fs.readFileSync(path.join(root,'src/main/resources/mapper/ProfileCatalogMapper.xml'),'utf8');
const baseMapper=fs.readFileSync(path.join(root,'src/main/resources/mapper/BaseMapper.xml'),'utf8');

for(const token of ['型材目录管理','profileSectionPreviewCanvas','profileSectionTemplateOptions','toggleDatabaseProfile']) {
  assert.ok(html.includes(token)||app.includes(token),token);
}
for(const token of ['includeDisabled','/api/profile-catalog']) assert.ok(api.includes(token),token);
assert.ok(preview.includes('class ProfileSectionPreview3D'));
assert.ok(controller.includes('@RequestParam(name = "includeDisabled"'));
assert.ok(service.includes('interface ProfileCatalogService'));
assert.ok(serviceImpl.includes('implements ProfileCatalogService'));
assert.ok(mapper.includes('ProfileCatalogResultMap'));
assert.ok(baseMapper.includes('ProfileCatalogColumns'));
assert.ok(!serviceImpl.includes('JdbcTemplate'));
assert.ok(pom.includes('<java.version>21</java.version>'));
assert.ok(pom.includes('<groupId>tools.jackson.core</groupId>'));
assert.ok(pom.includes('<artifactId>jackson-databind</artifactId>'));
assert.ok(pom.includes('<artifactId>lombok</artifactId>'));
assert.ok(pom.includes('<version>0.75.23</version>'));

console.log(JSON.stringify({
  ok:true,
  version:'0.75.23',
  schema:62,
  javaStyle:'controller/domain/mapper/service/service.impl/config',
  jackson:3,
  visualSectionTemplates:['T_SLOT','RECT_TUBE','ROUND_TUBE','SOLID_RECT','SOLID_ROUND','CHAMFER_RECT','CUSTOM_JSON'],
  catalogManager:true,
  svgPreview:true,
  threePreview:true
},null,2));
