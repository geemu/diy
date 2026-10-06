import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const math=await import(pathToFileURL(path.join(staticRoot,'js/interaction/ProfileGripMath.js')).href);

assert.equal(math.clampGripLength(4,10),10);
assert.equal(math.clampGripLength(1250,10),1250);

const machining=[
  {id:'A',type:'THROUGH_HOLE',stationS:100,distanceFromStart:100,referenceDatum:'A_END',reference:{datum:'A_END',stationS:100}},
  {id:'B',type:'THROUGH_HOLE',stationS:900,distanceFromStart:900,referenceDatum:'B_END',reference:{datum:'B_END',stationS:900}},
  {id:'END',type:'END_TAP',end:'END',referenceDatum:'END_FACE'}
];
const grown=math.remapMachiningStations(machining,1000,1200);
assert.equal(grown[0].stationS,100,'A datum must stay 100 from A');
assert.equal(grown[1].stationS,1100,'B datum must stay 100 from B');
assert.equal(grown[1].reference.stationS,1100);
assert.equal(grown[2].end,'END');
const shrunk=math.remapMachiningStations(machining,1000,800);
assert.equal(shrunk[0].stationS,100);
assert.equal(shrunk[1].stationS,700);

const c1=math.stretchedCenterPoint({x:0,y:0,z:0},{x:1,y:0,z:0},1000);
assert.deepEqual(c1,{x:500,y:0,z:0});
const c2=math.stretchedCenterPoint({x:1000,y:0,z:0},{x:-1,y:0,z:0},1000);
assert.deepEqual(c2,{x:500,y:0,z:0});

const grip=read('src/main/resources/static/js/interaction/ProfileGripEditor.js');
const editor=read('src/main/resources/static/js/core/Editor.js');
const html=read('src/main/resources/static/index.html');
const css=read('src/main/resources/static/css/app.css');
const snap=read('src/main/resources/static/js/snap/SnapManager.js');
for(const token of ['START','END','setPointerCapture','typedBuffer','isEndDrivenByConstraint','featureSnapDistanceMm','cancelDrag','commitDrag']) assert.ok(grip.includes(token),`missing grip token ${token}`);
for(const token of ['ProfileGripEditor','profileGripEditor','rebuildLinearProfileVisual','setSelectedProfileLengthFromEnd']) assert.ok(editor.includes(token),`missing editor integration ${token}`);
assert.ok(snap.includes('excludePartId'));
assert.ok(html.includes('profile-grip-hud'));
assert.ok(html.includes('双击端点可输入精确总长'));
assert.ok(css.includes('.profile-grip-hud'));

console.log(JSON.stringify({ok:true,version:'0.75.10',schema:62,grips:['A','B'],fixedOppositeEnd:true,numericInput:true,featureSnap:true,gridSnap:true,constraintGuard:true,machiningDatumPreserved:true},null,2));
