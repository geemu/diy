import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vendor=path.join(root,'target/classes/static/vendor/three/build/three.module.min.js');
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:pathToFileURL(vendor).href,shortCircuit:true}:next(specifier,context);}});
const THREE=await import('three');
const {default:Draw}=await import('../src/main/resources/static/js/drawing/ProfileDrawTool.js');
const {default:Factory}=await import('../src/main/resources/static/js/geometry/ProfileGeometryFactory.js');
const {default:Interference}=await import('../src/main/resources/static/js/interaction/InterferenceFeedbackManager.js');
const {profileQuaternion}=await import('../src/main/resources/static/js/geometry/ProfileOrientation.js');

const rect={left:0,top:0,width:1200,height:900};
const camera=new THREE.PerspectiveCamera(38,rect.width/rect.height,1,50000);
camera.position.set(1400,1100,1400);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
function eventFor(point){const v=point.clone().project(camera);return {clientX:(v.x+1)*rect.width/2,clientY:(1-v.y)*rect.height/2};}
function editorFor(){
  const editor={parts:[],meshes:[],selected:null,selectedMeshes:[],captures:0,changes:0,autoConnectionEnabled:false,projectSettings:{collisionToleranceMm:.5,contactToleranceMm:1},connectionManager:{connections:[]}};
  editor.sceneManager={scene:new THREE.Scene(),camera,renderer:{domElement:{style:{},getBoundingClientRect:()=>rect}},transformControls:{detach(){},attach(){}},setMarqueeMode(){},hideSnapFeedback(){},showSnapPoint(){},clearSnapPreview(){},showSnapFeedback(){},
    worldPointOnPlane(event,normal,point){const raycaster=new THREE.Raycaster();raycaster.setFromCamera(new THREE.Vector2(event.clientX/rect.width*2-1,1-event.clientY/rect.height*2),camera);return raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,point),new THREE.Vector3());}};
  editor.snapManager={isEnabled:()=>false};
  editor.historyManager={capture(){editor.captures++;}};editor.emitStats=()=>{};editor.emitProjectChanged=()=>editor.changes++;
  editor.getMeshByPartId=id=>editor.meshes.find(m=>m.userData.part.id===id);
  editor.interferenceFeedbackManager=new Interference(editor);
  editor.addProfileBetweenPoints=(catalogId,start,end,options)=>{
    const q=profileQuaternion(end.clone().sub(start),options.crossSectionUp),e=new THREE.Euler().setFromQuaternion(q),position=start.clone().add(end).multiplyScalar(.5);
    const part={id:'P'+(editor.parts.length+1),displayId:'P'+(editor.parts.length+1),type:'PROFILE',position:{x:position.x,y:position.y,z:position.z},rotation:{x:e.x,y:e.y,z:e.z},designProfile:{profileId:catalogId,faceClosures:options.faceClosures},dimensions:{length:start.distanceTo(end),sectionSize:[20,40]},profilePath:{type:'LINE',length:start.distanceTo(end)}};
    const mesh=Factory.create(part);mesh.position.copy(position);mesh.quaternion.copy(q);mesh.updateMatrixWorld(true);editor.sceneManager.scene.add(mesh);editor.parts.push(part);editor.meshes.push(mesh);editor.selected=mesh;return mesh;
  };
  return editor;
}

const editor=editorFor(),tool=new Draw(editor),origin=new THREE.Vector3(0,20,0);
tool.begin('FREE',{catalogId:'DESIGN-2040',plane:'XZ',gridSnap:false,continueDrawing:false,previewLengthMm:500});
tool.handlePointerMove(eventFor(origin));
assert.ok(tool.previewGroup,'首击前只有一份实体方向预览');
assert.equal(tool.idlePreviewLengthMm,80,'2040首击前只显示80mm短段，传入500也不能生成长料');
assert.ok(editor.sceneManager.renderer.domElement.style.cursor.includes('data:image/svg+xml'),'橙色瞄准器式画笔');
assert.ok(editor.sceneManager.renderer.domElement.style.cursor.endsWith('16 16, crosshair'),'画笔中心准确落在指针');
assert.equal(editor.parts.length,0);assert.equal(editor.captures,0);assert.equal(editor.changes,0);
assert.ok(!Object.hasOwn(tool.options,'previewLengthMm'),'展示长度不得成为持久化绘制设置');
const preview=tool.previewGroup;
for(const axis of ['X','Y','Z']){
  assert.equal(tool.handleKeyDown({key:'Tab'}),true);assert.equal(tool.axisLock,axis);
  assert.equal(tool.previewGroup,preview,'方向切换复用同一临时实体');
  assert.ok(Math.abs(new THREE.Box3().setFromObject(preview).min.y)<1e-6,'三方向都从实际工作平面起步');
}
tool.axisLock='X';tool.handleClick(eventFor(origin));
assert.equal(editor.parts.length,0,'第一点击只选起点，不额外添加默认长度型材');
assert.equal(editor.captures,0);assert.ok(tool.start);
tool.handlePointerMove(eventFor(new THREE.Vector3(450,20,0)));
assert.ok(Math.abs(tool.linearSegment(tool.hover).start.distanceTo(tool.linearSegment(tool.hover).end)-450)<1e-6,'鼠标终点决定长度，而非默认500');
tool.updateLengthDraft('350');assert.equal(tool.typedLength,'350');
assert.equal(tool.commitLength(350),true);assert.equal(editor.parts.length,1);assert.equal(editor.captures,1);assert.equal(editor.changes,1);
assert.equal(editor.parts[0].dimensions.length,350);assert.equal(tool.isActive(),false);assert.equal(tool.previewGroup,null);
assert.ok(Math.abs(new THREE.Box3().setFromObject(editor.meshes[0]).min.y)<1e-6);

tool.begin('FREE',{catalogId:'DESIGN-2040',gridSnap:false,continueDrawing:false,previewLengthMm:500});tool.axisLock='X';
tool.handleClick(eventFor(new THREE.Vector3(0,20,150)));tool.handleClick(eventFor(new THREE.Vector3(240,20,150)));
assert.equal(editor.parts.length,2);assert.ok(Math.abs(editor.parts[1].dimensions.length-240)<1e-6);assert.equal(editor.captures,2);assert.equal(tool.isActive(),false);
tool.begin('FREE',{catalogId:'DESIGN-2040',previewLengthMm:500});tool.handlePointerMove(eventFor(origin));tool.stop();
assert.equal(editor.parts.length,2);assert.equal(editor.captures,2);assert.equal(tool.previewGroup,null,'取消只清未确认预览');

editor.autoConnectionEnabled=true;let autoCalls=0;
editor.autoConnectionResolver={connectFromSnap(){autoCalls++;}};editor.autoConnectProfiles=()=>{autoCalls++;return {createdCount:0};};
tool.begin('FREE',{catalogId:'DESIGN-2040',gridSnap:false,continueDrawing:false});tool.axisLock='X';tool.handleClick(eventFor(origin));tool.handlePointerMove(eventFor(new THREE.Vector3(300,20,0)));
assert.ok(tool.previewGroup.children.some(m=>m.isMesh&&m.material.color.getHex()===0xe24848));
tool.commitLength(300);assert.equal(editor.parts.length,3);assert.equal(editor.captures,3);assert.equal(autoCalls,0,'显式红色落位不冒充吸附或自动连接');
assert.ok(editor.interferenceFeedbackManager.issues.length>0);assert.ok(editor.interferenceFeedbackManager.group.children.some(m=>m.material?.color.getHex()===0xf04444));

const contacts=editorFor(),a=contacts.addProfileBetweenPoints('DESIGN-2040',new THREE.Vector3(0,20,0),new THREE.Vector3(200,20,0),{crossSectionUp:new THREE.Vector3(0,1,0)});
const b=contacts.addProfileBetweenPoints('DESIGN-2040',new THREE.Vector3(210,20,-200),new THREE.Vector3(210,20,200),{crossSectionUp:new THREE.Vector3(0,1,0)});
const before=JSON.stringify(contacts.parts);contacts.interferenceFeedbackManager.refresh({live:false});
const bands=()=>contacts.interferenceFeedbackManager.group.children.filter(m=>m.userData.__contact);
assert.equal(bands().length,2);assert.ok(bands().every(m=>m.material.color.getHex()===0xffc400),'完成后的局部接头黄标');
contacts.interferenceFeedbackManager.refresh({live:true});assert.ok(bands().every(m=>m.material.color.getHex()===0x25c778),'拖动候选仍绿色');
assert.equal(JSON.stringify(contacts.parts),before,'配色不修改工程或连接状态');
b.position.x+=.3;b.userData.part.position.x+=.3;b.updateMatrixWorld(true);contacts.interferenceFeedbackManager.refresh({live:false});assert.equal(bands().length,0,'仍有间隙不能冒充已贴合黄标');
b.position.x-=10;b.userData.part.position.x-=10;b.updateMatrixWorld(true);contacts.interferenceFeedbackManager.refresh({live:false});assert.equal(bands().length,0,'红色干涉优先，不能同时保留黄色接头带');
assert.ok(contacts.interferenceFeedbackManager.issues.length>0);
for(const ed of [editor,contacts]){ed.interferenceFeedbackManager.clear();for(const mesh of ed.meshes)Factory.disposeObject(mesh);}

const app=fs.readFileSync(path.join(root,'src/main/resources/static/js/app.js'),'utf8'),html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
const drawSource=fs.readFileSync(path.join(root,'src/main/resources/static/js/drawing/ProfileDrawTool.js'),'utf8'),css=fs.readFileSync(path.join(root,'src/main/resources/static/css/app.css'),'utf8');
assert.ok(drawSource.includes("classList?.toggle('profile-drawing-active'")&&drawSource.includes("classList?.remove('profile-drawing-active')"),'画笔独占状态有开启和清理');
assert.ok(css.includes('canvas.profile-drawing-active{cursor:var(--profile-draw-cursor,crosshair)!important}'),'普通悬停清理不能吞掉画笔光标');
const selection=app.slice(app.indexOf('function quickAddProfile('),app.indexOf('function openInspectorForNewProfile('));
assert.ok(selection.includes("startProfileDraw('FREE',{fixedLengthMm:0,continueDrawing:false"));assert.ok(!selection.includes('profilePlacementManager.begin'));
assert.ok(!html.includes('结束添加'));assert.ok(html.includes('v-if="drawState.active" class="transform-tool draw-tool active"'));
const drop=app.slice(app.indexOf('function dropAsset('),app.indexOf('function quickAddProfile('));
assert.ok(drop.includes('quickAddProfile(definition.id)')&&!drop.includes('placeProfileWithSnap'),'拖放只拿起同一支画笔，不能额外插入长料');
assert.ok(!html.includes('<label>默认长度</label>'),'普通目录不能再暗示默认整根长度');
assert.ok(!html.includes('绘制型材</span></button>')||html.includes('quickAddProfile(newProfile.catalogId);contextMenu.visible=false'));
console.log(JSON.stringify({ok:true,version:'0.75.17',oneDrawingWorkflow:true,aimingCursor:true,shortIdlePreview:true,dropArmsDrawing:true,firstClickNoPart:true,mouseLength:true,typedLength:true,singleHistory:true,cancelNoPart:true,ghostTransient:true,contactYellow:true,candidateGreen:true,collisionRed:true}));
