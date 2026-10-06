import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vendor=path.join(root,'target/classes/static/vendor/three/build/three.module.min.js');
assert.ok(fs.existsSync(vendor),'先执行 Maven resources，以获取本地 Three.js');
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:pathToFileURL(vendor).href,shortCircuit:true}:next(specifier,context);}});
const THREE=await import('three');
const {resolveScreenAxis}=await import('../src/main/resources/static/js/drawing/ScreenAxisResolver.js');
const {default:ProfileDrawTool}=await import('../src/main/resources/static/js/drawing/ProfileDrawTool.js');
const {profileQuaternion}=await import('../src/main/resources/static/js/geometry/ProfileOrientation.js');

const rect={left:41,top:72,width:1100,height:800};
function camera(kind='perspective'){
  const c=kind==='perspective'?new THREE.PerspectiveCamera(38,rect.width/rect.height,1,50000):new THREE.OrthographicCamera(-1400,1400,1000,-1000,1,50000);
  c.position.set(1800,1450,1800);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;
}
function eventFor(c,p){const v=p.clone().project(c);return {clientX:rect.left+(v.x+1)*rect.width/2,clientY:rect.top+(1-v.y)*rect.height/2};}
let axisCases=0;
for(const kind of ['perspective','orthographic'])for(const axis of ['x','y','z'])for(const sign of [-1,1]){
  const c=camera(kind),origin=new THREE.Vector3(100,15,-80),target=origin.clone();target[axis]+=sign*600;
  const result=resolveScreenAxis(c,rect,eventFor(c,target),origin);
  assert.equal(result.axis,axis.toUpperCase());assert.ok(result.point.distanceTo(target)<1e-6);axisCases++;
}
const front=camera();front.position.set(0,0,2200);front.lookAt(0,0,0);front.updateMatrixWorld(true);
assert.equal(resolveScreenAxis(front,rect,eventFor(front,new THREE.Vector3(200,0,0)),new THREE.Vector3(),'Z'),null,'朝镜头方向不能放大成超长预览');

function editorStub(){
  const editor={parts:[],meshes:[],autoConnectionEnabled:false,projectSettings:{collisionToleranceMm:.5},captures:0};
  editor.sceneManager={scene:new THREE.Scene(),renderer:{domElement:{style:{}}},transformControls:{detach(){},attach(){}},setMarqueeMode(){},hideSnapFeedback(){}};
  editor.historyManager={capture(){editor.captures++;}};
  editor.emitStats=()=>{};editor.emitProjectChanged=()=>{};
  editor.interferenceFeedbackManager={refresh(){return {active:false};},requestRefresh(){}};
  editor.getMeshByPartId=id=>editor.meshes.find(m=>m.userData.part.id===id);
  editor.removePartByIdSilently=id=>{editor.parts=editor.parts.filter(p=>p.id!==id);editor.meshes=editor.meshes.filter(m=>m.userData.part.id!==id);};
  editor.addProfileBetweenPoints=(id,start,end,options)=>{
    const delta=end.clone().sub(start),q=profileQuaternion(delta,options.crossSectionUp),e=new THREE.Euler().setFromQuaternion(q);
    const part={id:'P'+editor.parts.length,type:'PROFILE',displayId:'P'+editor.parts.length,designProfile:{profileId:id},dimensions:{length:delta.length(),sectionSize:[30,30]},profilePath:{type:'LINE',length:delta.length()},position:start.clone().add(end).multiplyScalar(.5),rotation:{x:e.x,y:e.y,z:e.z}};
    const mesh=new THREE.Group();mesh.userData.part=part;mesh.position.copy(part.position);mesh.quaternion.copy(q);mesh.updateMatrixWorld(true);
    editor.parts.push(part);editor.meshes.push(mesh);return mesh;
  };
  return editor;
}
const ed=editorStub(),tool=new ProfileDrawTool(ed);
tool.begin('FREE',{continueDrawing:true});tool.start={point:new THREE.Vector3(0,15,0)};tool.hover={point:new THREE.Vector3(0,615,0)};
assert.equal(tool.commitLength(600),true);
assert.equal(ed.parts[0].dimensions.length,600);assert.ok(Math.abs(ed.parts[0].position.y-300)<1e-6,'空白面竖杆应从地面起步');
assert.equal(tool.mode,'FREE');assert.equal(tool.start,null);
const host=ed.addProfileBetweenPoints('DESIGN-3030',new THREE.Vector3(1000,15,0),new THREE.Vector3(1600,15,0),{crossSectionUp:new THREE.Vector3(0,1,0)});
tool.start={point:new THREE.Vector3(1600,15,0),feature:{type:'PROFILE_END',partId:host.userData.part.id}};
tool.hover={point:new THREE.Vector3(1600,615,0)};
const candidate=tool.typedCandidate(600),segment=tool.linearSegment(candidate);
assert.equal(segment.start.y,30);assert.equal(segment.end.y,630);assert.equal(segment.start.distanceTo(segment.end),600,'搭接后真实型材仍为输入长度');
tool.options.fixedLengthMm=600;const fixedSegment=tool.linearSegment(tool.hover);
assert.equal(fixedSegment.start.distanceTo(fixedSegment.end),600,'按此长度绘制同样使用真实切料长度');tool.options.fixedLengthMm=0;
let feedback=null;ed.sceneManager.showSnapFeedback=value=>{feedback=value;};tool.showDraftFeedback(candidate);
assert.ok(feedback.details.includes('600 mm'),'底部提示与就地输入统一使用真实型材长度');
assert.ok(!feedback.details.includes('615 mm'),'不能把搭接中心线距离当作切料长度');
tool.updatePreview(candidate);const preview=tool.previewGroup;tool.updatePreview(candidate);
assert.equal(tool.previewGroup,preview,'鼠标移动复用截面几何');assert.equal(ed.parts.length,2,'预览不得进入 Project');
ed.autoConnectionEnabled=true;ed.autoConnectionResolver={connectFromSnap(){return null;}};
ed.autoConnectProfiles=ids=>{assert.ok(ids.includes(host.userData.part.id),'自动连接必须包含实际宿主');return {createdCount:0};};
assert.equal(tool.commitLength(600),true);assert.equal(ed.parts[2].dimensions.length,600);
tool.begin('FREE');tool.start={point:new THREE.Vector3(0,15,0)};tool.hover={point:new THREE.Vector3(100,15,0)};
ed.interferenceFeedbackManager.refresh=()=>({active:true});const captures=ed.captures,count=ed.parts.length;
assert.equal(tool.commitLength(100),false);assert.equal(ed.parts.length,count);assert.equal(ed.captures,captures,'拒绝干涉不写历史');
tool.begin('DIAGONAL');tool.start={point:new THREE.Vector3(0,15,0)};tool.hover={point:new THREE.Vector3(300,15,400)};
assert.equal(tool.typedCandidate(500).point.x,300);assert.equal(tool.typedCandidate(500).point.z,400,'斜角模式不能被默认正交开关掰直');
console.log(JSON.stringify({ok:true,version:'0.75.13',axisCases,groundedVertical:true,actualCutLength:true,previewIsTransient:true,collisionRollback:true}));
