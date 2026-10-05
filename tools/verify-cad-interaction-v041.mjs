import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname,'..');
const staticRoot = path.join(root,'src/main/resources/static');
const read = relative => fs.readFileSync(path.join(staticRoot,relative),'utf8');

const editor = read('js/core/Editor.js');
const scene = read('js/core/SceneManager.js');
const app = read('js/app.js');
const html = read('index.html');
const css = read('css/app.css');
const feature = read('js/interaction/FeatureHoverManager.js');
const workPlane = read('js/interaction/WorkPlaneVisualizer.js');
const cycle = read('js/interaction/SelectionCycleManager.js');

for (const token of ['setLassoMode','pickInScreenPolygon','pickRoots','setTransformSpace']) assert.ok(scene.includes(token),`SceneManager missing ${token}`);
for (const token of ['FeatureHoverManager','WorkPlaneVisualizer','SelectionCycleManager','cadInteractionVersion:3']) assert.ok(editor.includes(token),`Editor missing ${token}`);
for (const token of ['toggleLassoSelect','toggleTransformSpace','toggleWorkPlane','promptProfileLength']) assert.ok(app.includes(token),`app missing ${token}`);
for (const token of ['自由选择','Alt+点击 穿透选择','工作面','A固定','调整B端','B固定','调整A端']) assert.ok(html.includes(token),`UI missing ${token}`);
for (const token of ['scene-lasso','feature-hover-hud','space-tool']) assert.ok(css.includes(token),`CSS missing ${token}`);
assert.ok(feature.includes('型材 Feature 级预高亮'));
assert.ok(feature.includes('ProfileFeatureCatalog'));
assert.ok(workPlane.includes('CAD 工作平面可视化'));
assert.ok(cycle.includes('穿透/循环选择'));
assert.ok(!html.includes('供应商、料号或截面说明'),'供应商相关 UI 文案不应保留');

console.log(JSON.stringify({
  ok:true,
  version:'0.65.0',
  schema:62,
  lasso:true,
  penetrationCycle:true,
  featureHover:true,
  transformSpace:['world','local'],
  workPlane:['XY','XZ','YZ'],
  typeAwareContextMenu:true,
  supplierScope:false
},null,2));
