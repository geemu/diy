import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {CURRENT_APP_VERSION,CURRENT_PROJECT_SCHEMA_VERSION} from '../src/main/resources/static/js/io/ProjectSchema.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const draw=read('src/main/resources/static/js/drawing/ProfileDrawTool.js');
const playback=read('src/main/resources/static/js/manufacturing/AssemblyPlaybackManager.js');
const editor=read('src/main/resources/static/js/core/Editor.js');
const app=read('src/main/resources/static/js/app.js');
const html=read('src/main/resources/static/index.html');
const css=read('src/main/resources/static/css/app.css');
const sample=JSON.parse(read('src/main/resources/static/samples/型材架子_610x670_H2050.json'));

assert.equal(CURRENT_APP_VERSION,'0.59.0');
assert.equal(CURRENT_PROJECT_SCHEMA_VERSION,59);
assert.equal(sample.schemaVersion,59);
assert.equal(sample.metadata.version,'0.59.0');
for(const token of ["'CONTOUR'",'finishContour()','validateSimpleContour','PROFILE_DRAW_CONTOUR','轮廓生成框架']) assert.ok(draw.includes(token),`轮廓生成缺少 ${token}`);
assert.ok(html.includes("startProfileDraw('CONTOUR')"));
assert.ok(html.includes('完成闭合并生成'));
assert.ok(app.includes('finishContourDraw'));
for(const token of ['AssemblyPlaybackManager','startAssemblyPlayback','nextAssemblyPlaybackStep','previousAssemblyPlaybackStep','pauseAssemblyPlayback']) assert.ok(editor.includes(token),`Editor 缺少 ${token}`);
for(const token of ['applyStageVisibility','explodePartIds','requestAnimationFrame','currentStepNumber','hardware']) assert.ok(playback.includes(token),`装配播放缺少 ${token}`);
for(const token of ['装配播放','上一步','下一步','播放这一步','assemblyPlaybackState']) assert.ok(html.includes(token),`装配 UI 缺少 ${token}`);
assert.ok(css.includes('.assembly-playback-bar'));
assert.ok(css.includes('.contour-draw-actions'));
assert.ok(!html.includes('单价'));
assert.ok(!html.includes('总价'));
assert.ok(!html.includes('成本估算'));

console.log(JSON.stringify({ok:true,version:CURRENT_APP_VERSION,schema:CURRENT_PROJECT_SCHEMA_VERSION,contourCreator:true,selfIntersectionGuard:true,assemblyPlayback:true,stepVisibility:true,animatedAssembly:true,pricing:false},null,2));
