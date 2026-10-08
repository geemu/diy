import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const editor=read('src/main/resources/static/js/core/Editor.js');
const scene=read('src/main/resources/static/js/core/SceneManager.js');
const snap=read('src/main/resources/static/js/snap/SnapManager.js');
const feedback=read('src/main/resources/static/js/interaction/InterferenceFeedbackManager.js');
const app=read('src/main/resources/static/js/app.js');
const html=read('src/main/resources/static/index.html');
const css=read('src/main/resources/static/css/app.css');

for (const token of ['InterferenceFeedbackManager','interferenceFeedbackManager.preview','interferenceFeedbackManager.requestRefresh']) assert.ok(editor.includes(token),`missing editor token ${token}`);
for (const token of ['showSnapPreview','clearSnapPreview','__snap_preview__']) assert.ok(scene.includes(token),`missing scene snap token ${token}`);
for (const token of ['preview(mesh)','sourcePoint:sourcePoint.clone()']) assert.ok(snap.includes(token),`missing snap preview token ${token}`);
for (const token of ['isIntentionalContact','BoxHelper','PROFILE','PANEL','SHAFT','ACCESSORY']) assert.ok(feedback.includes(token),`missing interference token ${token}`);
for (const token of ['contextStartConnection','contextOpenAccessories','contextOpenMachining','interferenceState']) assert.ok(app.includes(token),`missing app token ${token}`);
for (const token of ['构件干涉','contextMenu.connectionCandidates','添加配件…','添加加工…']) assert.ok(html.includes(token),`missing context UI ${token}`);
for (const menu of ['文件','编辑','视图','显示','移动步长（吸附）','模型库','制造']) assert.ok(html.includes(`<summary>${menu}</summary>`),`missing menu ${menu}`);
assert.ok(css.includes('.interference-hud'));
assert.ok(css.includes('.context-section-label'));

const collisionModule=await import(pathToFileURL(path.join(root,'src/main/resources/static/js/validation/PartCollisionDetector.js')).href);
const make=(x,length=100)=>({type:'PROFILE',position:{x,y:0,z:0},rotation:{x:0,y:0,z:0},dimensions:{sectionSize:[30,30],length},profilePath:{type:'LINE',length}});
const a=collisionModule.profileObb(make(0));
const b=collisionModule.profileObb(make(10));
const c=collisionModule.profileObb(make(100));
assert.equal(collisionModule.intersectObb(a,b,0.5).intersects,true);
assert.equal(collisionModule.intersectObb(a,c,0.5).intersects,false);

console.log(JSON.stringify({ok:true,version:'0.75.24',schema:62,liveInterference:true,persistentRedOutline:true,snapPreview:true,contextActions:true,topMenus:8,pricing:false},null,2));
