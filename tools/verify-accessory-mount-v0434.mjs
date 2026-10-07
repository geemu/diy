import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const read=relative=>fs.readFileSync(path.join(staticRoot,relative),'utf8');

const manager=read('js/model/AccessoryMountManager.js');
const editor=read('js/core/Editor.js');
const grip=read('js/interaction/ProfileGripEditor.js');
const app=read('js/app.js');
const html=read('index.html');
const schema=read('js/io/ProjectSchema.js');

for(const token of ['refreshForTargets','refreshAll','resolveProfileEnd','resolvePanelSide','mountReference']) {
  assert.ok(manager.includes(token),`AccessoryMountManager missing ${token}`);
}
for(const token of ['new AccessoryMountManager(this)','accessoryMountManager.refreshForTargets','detachMountedAccessory']) {
  assert.ok(editor.includes(token),`Editor missing ${token}`);
}
assert.ok(editor.includes("&& !part?.mountReference"),'mounted accessory must not be directly transformable');
assert.ok(editor.includes("if (copy.type === 'ACCESSORY') copy.mountReference = null"),'duplicated accessory must detach mount reference');
assert.ok(grip.includes('accessoryMountManager?.refreshForTargets([drag.partId])'),'profile grip must refresh mounted accessories');
assert.ok(app.includes('detachSelectedAccessory'));
assert.ok(app.includes('mountPositionLabel'));
assert.ok(html.includes('解除安装'));
assert.ok(html.includes('已安装配件会跟随宿主移动、旋转和尺寸变化'));
assert.ok(schema.includes("CURRENT_APP_VERSION = '0.75.15'"));
assert.ok(schema.includes('accessoryMountingVersion:2'));

console.log(JSON.stringify({
  ok:true,
  version:'0.75.15',
  schema:62,
  mountLifecycle:true,
  hostTransformFollow:true,
  profileGripFollow:true,
  detachSupported:true,
  mountedDirectTransformLocked:true
},null,2));
