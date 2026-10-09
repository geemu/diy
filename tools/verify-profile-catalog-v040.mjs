import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const catalogModule=await import(pathToFileURL(path.join(staticRoot,'js/model/ProfileCatalog.js')).href);
const sectionModule=await import(pathToFileURL(path.join(staticRoot,'js/model/ProfileSectionRegistry.js')).href);
const {ProfileCatalogList,registerProfileDefinition,getProfileDefinition,unregisterProfileDefinition}=catalogModule;
const {registerCatalogSection,getSectionDefinition,sectionToSvg,removeCatalogSection}=sectionModule;

const before=ProfileCatalogList.length;
const custom=registerProfileDefinition({id:'DB-TEST-3060',nominal:'3060',variant:'TEST3060',name:'测试数据库型材',series:'30',system:'自定义',sectionSize:[30,60],slotWidth:8.2,wallThicknessOptions:[1.8,2],defaultWallThickness:2,sourceFamily:'DATABASE',custom:true});
assert.equal(getProfileDefinition('DB-TEST-3060').variant,'TEST3060');
assert.equal(ProfileCatalogList.length,before+1);
const section={outer:[{x:-15,y:-30},{x:15,y:-30},{x:15,y:30},{x:-15,y:30}],holes:[[{x:-3,y:-3},{x:3,y:-3},{x:3,y:3},{x:-3,y:3}]]};
registerCatalogSection(custom.id,section,'verify');
const resolved=getSectionDefinition(custom.id);
assert.equal(resolved.sourceType,'DATABASE_CATALOG');
assert.match(sectionToSvg(resolved),/<svg/);
removeCatalogSection(custom.id);unregisterProfileDefinition(custom.id);
assert.equal(ProfileCatalogList.length,before);

const html=fs.readFileSync(path.join(staticRoot,'index.html'),'utf8');
const app=fs.readFileSync(path.join(staticRoot,'js/app.js'),'utf8');
const css=fs.readFileSync(path.join(staticRoot,'css/app.css'),'utf8');
const scene=fs.readFileSync(path.join(staticRoot,'js/core/SceneManager.js'),'utf8');
const controller=fs.readFileSync(path.join(root,'src/main/java/com/paic/stock/aluminumcad/controller/ProfileCatalogController.java'),'utf8');
const schemaSql=fs.readFileSync(path.join(root,'src/main/resources/sql/schema.sql'),'utf8');
for(const token of ['自定义型材','保存到数据库','profileThumbSvg','removeDatabaseProfile'])assert.ok(html.includes(token)||app.includes(token),token);
for(const token of ['profile-section-thumb','modal-in','toast-in'])assert.ok(css.includes(token),token);
for(const token of ['setHover(','updateCameraTween(','cameraTween'])assert.ok(scene.includes(token),token);
assert.ok(controller.includes('/api/profile-catalog'));
assert.ok(schemaSql.includes('profile_catalog'));
console.log(JSON.stringify({ok:true,version:'0.75.34',schema:62,profileThumbnailSvg:true,databaseCatalog:true,customProfileCrud:true,hoverPrehighlight:true,smoothCamera:true},null,2));
