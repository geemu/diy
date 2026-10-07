import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {CURRENT_APP_VERSION,CURRENT_PROJECT_SCHEMA_VERSION} from '../src/main/resources/static/js/io/ProjectSchema.js';
import {buildContourPreset} from '../src/main/resources/static/js/drawing/ContourPresetFactory.js';
import {buildConnectionInstallationDiagram} from '../src/main/resources/static/js/manufacturing/ConnectionInstallationDiagram.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const manager=read('src/main/resources/static/js/drawing/ContourFrameManager.js');
const draw=read('src/main/resources/static/js/drawing/ProfileDrawTool.js');
const editor=read('src/main/resources/static/js/core/Editor.js');
const html=read('src/main/resources/static/index.html');
const css=read('src/main/resources/static/css/app.css');
const app=read('src/main/resources/static/js/app.js');

assert.equal(CURRENT_APP_VERSION,'0.75.15');
assert.equal(CURRENT_PROJECT_SCHEMA_VERSION,62);
for(const kind of ['L','U','STAIR']){
  const points=buildContourPreset(kind,{widthMm:1000,depthMm:600,notchMm:240,plane:'XZ',center:{x:0,y:0,z:0}});
  assert.ok(points.length>=6,`${kind} 轮廓点不足`);
}
for(const token of ['contourDimensionIndex','INSERT_POINT','DELETE_POINT','insertPoint(edgeIndex','deletePoint(pointIndex','createDimensionSprite','createEdgeHitMesh']) assert.ok(manager.includes(token),`轮廓编辑缺少 ${token}`);
for(const token of ['createContourFrame(inputPoints','presetType']) assert.ok(draw.includes(token),`轮廓创建缺少 ${token}`);
for(const token of ['insertContourFramePoint','deleteContourFramePoint','createContourFrameFromPoints','contourFrameVersion:5','connectionInstallationDiagramVersion:4']) assert.ok(editor.includes(token),`Editor 缺少 ${token}`);
for(const token of ['快捷轮廓','L 型','U 型','阶梯型','点击画布中的尺寸标签','右键轮廓边','右键蓝色控制点','安装示意']) assert.ok(html.includes(token),`界面缺少 ${token}`);
for(const token of ['createContourPreset','connectionDiagramSvg','onDimensionRequest','onContextAction']) assert.ok(app.includes(token),`App 缺少 ${token}`);
assert.ok(css.includes('.contour-preset-card'));
assert.ok(css.includes('.connection-installation-diagram'));
const svg=buildConnectionInstallationDiagram({type:'ANGLE_BRACKET',sourceCode:'P001',targetCode:'P002',hardware:[{code:'H001',name:'角码'}]});
assert.match(svg,/角码连接/);assert.match(svg,/P001/);assert.match(svg,/H001/);
assert.ok(!html.includes('单价'));assert.ok(!html.includes('总价'));
console.log(JSON.stringify({ok:true,version:CURRENT_APP_VERSION,schema:CURRENT_PROJECT_SCHEMA_VERSION,clickDimension:true,insertPoint:true,deletePoint:true,presets:['L','U','STAIR'],connectionDiagram:true,pricing:false},null,2));
