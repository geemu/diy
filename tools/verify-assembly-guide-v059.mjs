import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {CURRENT_APP_VERSION,CURRENT_PROJECT_SCHEMA_VERSION} from '../src/main/resources/static/js/io/ProjectSchema.js';
import {buildAssemblyGuidePrintHtml} from '../src/main/resources/static/js/manufacturing/AssemblyGuideDocument.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const contour=read('src/main/resources/static/js/drawing/ContourFrameManager.js');
const editor=read('src/main/resources/static/js/core/Editor.js');
const app=read('src/main/resources/static/js/app.js');
const html=read('src/main/resources/static/index.html');
const css=read('src/main/resources/static/css/app.css');

assert.equal(CURRENT_APP_VERSION,'0.70.0');
assert.equal(CURRENT_PROJECT_SCHEMA_VERSION,62);
for(const token of ['createConstraintSprite','contourConstraintId','onRelationRequest','focusConstraint','constraintPosition']) assert.ok(contour.includes(token),`轮廓关系可视化缺少 ${token}`);
for(const token of ['focusContourFrameConstraint','contourRelationVisualizationVersion:2','assemblyGuideDocumentVersion:2','contourFrameVersion:5']) assert.ok(editor.includes(token),`Editor 缺少 ${token}`);
for(const token of ['activeContourConstraintId','focusContourConstraint','assemblyGuidePageIndex','assemblyGuideCurrentStep','printAssemblyGuide','buildAssemblyGuidePrintHtml']) assert.ok(app.includes(token),`App 缺少 ${token}`);
for(const token of ['装配说明书','打印装配说明','上一页','下一页','点击图标或这里的关系可相互定位']) assert.ok(html.includes(token),`界面缺少 ${token}`);
assert.ok(css.includes('.assembly-guide-book'));
assert.ok(css.includes('.contour-relation-list span.active'));

const steps=[{id:'S1',step:1,title:'安装底框',note:'先将四根型材拼成底框。',prerequisiteSteps:[],parts:[{id:'P1',code:'P001',name:'底部型材'}],connections:[{id:'C1',code:'C001',type:'ANGLE_BRACKET',sourceCode:'P001',targetCode:'P002',hardware:[{id:'H1',code:'H001',name:'角码'}]}],hardware:[{id:'H1',code:'H001',name:'角码'}]}];
const printHtml=buildAssemblyGuidePrintHtml(steps,{projectName:'测试框架',appVersion:'0.70.0'});
for(const token of ['测试框架','装配说明书','安装底框','P001','C001','H001','安装步骤','拆卸顺序：3 → 2 → 1','@media print','page-break-after']) assert.ok(printHtml.includes(token),`打印说明缺少 ${token}`);
assert.ok(!html.includes('单价'));assert.ok(!html.includes('总价'));
console.log(JSON.stringify({ok:true,version:CURRENT_APP_VERSION,schema:CURRENT_PROJECT_SCHEMA_VERSION,relationOverlay:true,relationLocate:true,assemblyGuidePaging:true,printableGuide:true,pricing:false},null,2));
