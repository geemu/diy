import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {CURRENT_APP_VERSION,CURRENT_PROJECT_SCHEMA_VERSION} from '../src/main/resources/static/js/io/ProjectSchema.js';
import {buildConnectionInstallationDiagram,getConnectionInstallationSteps} from '../src/main/resources/static/js/manufacturing/ConnectionInstallationDiagram.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const manager=read('src/main/resources/static/js/drawing/ContourFrameManager.js');
const editor=read('src/main/resources/static/js/core/Editor.js');
const app=read('src/main/resources/static/js/app.js');
const html=read('src/main/resources/static/index.html');
const css=read('src/main/resources/static/css/app.css');

assert.equal(CURRENT_APP_VERSION,'0.75.5');
assert.equal(CURRENT_PROJECT_SCHEMA_VERSION,62);
for(const token of ['simpleConstraints','EQUAL_LENGTH','PARALLEL','ALIGN_POINTS','addSimpleConstraint','removeSimpleConstraint','validateSimpleConstraints','applyEqualLengthRelations']) assert.ok(manager.includes(token),`轮廓简单关系缺少 ${token}`);
for(const token of ['addContourFrameConstraint','removeContourFrameConstraint','contourFrameVersion:5','connectionInstallationDiagramVersion:4']) assert.ok(editor.includes(token),`Editor 缺少 ${token}`);
for(const token of ['contourConstraintForm','selectedContourConstraints','addContourEdgeConstraint','addContourPointAlignment','removeContourConstraint']) assert.ok(app.includes(token),`App 缺少 ${token}`);
for(const token of ['简单关系','等长','平行','横向对齐','纵向对齐']) assert.ok(html.includes(token),`界面缺少 ${token}`);
assert.ok(css.includes('.contour-relation-card'));
const steps=getConnectionInstallationSteps({type:'END_SCREW'});
assert.equal(steps.length,3);assert.match(steps[1].text,/螺钉/);
const svg=buildConnectionInstallationDiagram({type:'ANGLE_BRACKET',sourceCode:'P001',targetCode:'P002',hardware:[{code:'H001',name:'角码'},{code:'H002',name:'螺钉'}]});
for(const token of ['安装步骤','拆卸顺序','螺钉插入','install-arrow','screw-arrow','3 → 2 → 1','P001','H001']) assert.ok(svg.includes(token),`连接安装示意缺少 ${token}`);
assert.ok(!html.includes('单价'));assert.ok(!html.includes('总价'));
console.log(JSON.stringify({ok:true,version:CURRENT_APP_VERSION,schema:CURRENT_PROJECT_SCHEMA_VERSION,simpleContourRelations:['等长','平行','点对齐'],installationDirections:true,screwInsertionDirection:true,disassemblyOrder:true,pricing:false},null,2));
