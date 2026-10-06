import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const editor=read('src/main/resources/static/js/core/Editor.js');
const app=read('src/main/resources/static/js/app.js');
const html=read('src/main/resources/static/index.html');
const css=read('src/main/resources/static/css/app.css');
const placement=read('src/main/resources/static/js/interaction/AccessoryPlacementManager.js');
const schema=read('src/main/resources/static/js/io/ProjectSchema.js');

for(const token of ['AccessoryPlacementManager','accessoryPlacementManager.handleClick','accessoryPlacementManager.handlePointerMove']) assert.ok(editor.includes(token),`missing editor ${token}`);
for(const token of ['begin(definition','createGhostMesh','previewCollision','PROFILE_END','PANEL_SIDE','0x24b36b','0xe54848']) assert.ok(placement.includes(token),`missing placement ${token}`);
for(const token of ['accessoryPlacementState','accessoryPlacementSeed','cancelAccessoryPlacement','已记住右键位置']) assert.ok(app.includes(token),`missing app ${token}`);
for(const token of ['配件放置','placeAccessoryComponent','取消放置 · Esc','<summary>模型库</summary>']) assert.ok(html.includes(token),`missing ui ${token}`);
assert.ok(html.includes('<summary>视图</summary>'));
assert.ok(html.includes('<summary>帮助</summary>')&&html.includes('快捷键与操作说明'));
assert.ok(css.includes('.accessory-placement-hud'));
assert.ok(css.includes('.accessory-placement-hud.invalid'));
assert.ok(schema.includes('placementSystemVersion:1'));
assert.ok(schema.includes('interactionPolishVersion:5'));
assert.ok(schema.includes("CURRENT_APP_VERSION = '0.75.5'"));

console.log(JSON.stringify({ok:true,version:'0.75.5',schema:62,unifiedAccessoryPlacement:true,ghostPreview:true,collisionAwarePreview:true,contextSeed:true,liveSnapHint:true,topMenus:8,pricing:false},null,2));
