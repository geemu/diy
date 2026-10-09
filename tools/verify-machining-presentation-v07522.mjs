import assert from 'node:assert/strict';
import fs from 'node:fs';
import {editor,dispose,signature,THREE,load} from './verify-connection-batch-v07520.mjs';
const {default:Machining,machiningLocalPose}=await load('machining/MachiningManager.js');
const {default:Annotations}=await load('annotation/SceneAnnotationManager.js');
const {default:Placement}=await load('machining/MachiningPlacementManager.js');
const {default:Schema}=await load('io/ProjectSchema.js');
const {createSurfaceFeedback,disposeFeedback}=await load('interaction/SurfaceFeedback.js');
const outcomes={};
const e=editor();e.addProfile('DESIGN-4040',260,{position:{x:0,y:20,z:0},select:false,captureHistory:false});e.machiningManager=new Machining(e);
const mesh=e.meshes[0],part=mesh.userData.part;
const hole=e.machiningManager.addThroughHole(mesh,{face:'FRONT',stationS:76.9,offset:10,diameter:9});
e.machiningManager.addThroughHole(mesh,{face:'FRONT',stationS:147.9,offset:10,diameter:9});
const before=signature(e),group=mesh.userData.machiningGroup;
assert.equal(group.children.length,4,'两个通孔分别展示入口和出口');
for(const marker of group.children){assert.equal(marker.children[0].material.color.getHex(),0x10151b);assert.equal(marker.children[0].material.opacity,1);assert.equal(marker.children[0].material.transparent,true);assert.equal(marker.children[0].renderOrder,1600);assert.equal(marker.children[0].material.depthWrite,true);assert.equal(marker.children[0].material.depthTest,true);assert.equal(marker.children[0].material.side,THREE.FrontSide);assert.equal(marker.children[0].raycast(),undefined);assert.ok(marker.userData.appearanceOnly);}
// 加工示意不参与选中面、拾取和工程尺寸事实；重复刷新不产生工程修改。
const helper=createSurfaceFeedback(mesh,{color:0xffa629});assert.ok(helper);assert.ok(group.children.every(marker=>marker.name.startsWith('__')));disposeFeedback(helper);e.machiningManager.refreshProfile(mesh);assert.equal(signature(e),before);
const end=e.machiningManager.addEndHole(mesh,{end:'END',offsetX:7,offsetY:-4,diameter:6});const endPose=machiningLocalPose(part,end);assert.equal(endPose.point.x,7);assert.equal(endPose.point.y,-4);assert.equal(endPose.point.z,130.03);
const compound=e.machiningManager.addHoleGroup(mesh,{face:'RIGHT',stationS:190,offset:10,diameter:9,majorDiameter:16,secondaryType:'COUNTERSINK'});
assert.equal(mesh.userData.machiningGroup.children.filter(marker=>marker.userData.machiningId===compound.items[0].id).length,1,'孔组通孔只画出口，入口用沉头展示');
outcomes.darkEntryExitCompoundAndEndOffsets=true;
const defaultProject={...e.exportProject(),schemaVersion:62,editorState:{},profileSections:[],dimensions:[]};assert.equal(Schema.load(defaultProject).project.editorState.annotations.showMachiningDimensions,false);
defaultProject.editorState.annotations={showMachiningLabels:false,showMachiningDimensions:true};assert.equal(Schema.load(defaultProject).project.editorState.annotations.showMachiningDimensions,true);assert.equal(Schema.load(defaultProject).project.editorState.annotations.showMachiningLabels,false);
const placement=new Placement(e),previewBefore=signature(e);placement.begin('THROUGH_HOLE');placement.hover={mesh,face:'FRONT',point:mesh.localToWorld(machiningLocalPose(part,hole).point.clone())};placement.renderPreview();assert.equal(placement.previewGroup.children[0].geometry.type,'RingGeometry');assert.equal(placement.previewGroup.children[0].geometry.parameters.outerRadius,4.5);assert.equal(placement.previewGroup.children[0].material.color.getHex(),0x70a0cc);assert.equal(signature(e),previewBefore);placement.cancel();assert.equal(placement.previewGroup.children.length,0);placement.previewGroup.removeFromParent();outcomes.thinPreviewAndSavedPreferences=true;
// 轻量 DOM 只替代文字节点；可见性/射线/相机仍运行真实实现。
class Element {constructor(){this.style={};this.dataset={};this.children=[];this.listeners=new Map();this.classList={add(){}};this.offsetWidth=92;this.offsetHeight=25;}appendChild(child){this.children.push(child);}replaceChildren(){this.children=[];}remove(){}addEventListener(type,handler){this.listeners.set(type,handler);}removeEventListener(type){this.listeners.delete(type);}getBoundingClientRect(){return {left:0,top:0,width:800,height:600};}}
globalThis.document={createElement:()=>new Element()};
globalThis.requestAnimationFrame=()=>0;
e.sceneManager.container=new Element();e.sceneManager.container.clientWidth=800;e.sceneManager.container.clientHeight=600;e.sceneManager.renderer={domElement:new Element()};e.sceneManager.addFrameHandler=()=>{};
e.sceneManager.camera=new THREE.PerspectiveCamera(40,800/600,.1,10000);e.sceneManager.camera.position.set(0,400,0);e.sceneManager.camera.up.set(0,0,-1);e.sceneManager.camera.lookAt(0,0,0);e.sceneManager.camera.updateMatrixWorld(true);mesh.updateMatrixWorld(true);
const a=new Annotations(e,e.sceneManager);assert.equal(a.options.showMachiningDimensions,false);a.setOptions({showOverall:false,showPartDimensions:false,showMachiningLabels:true,showUserDimensions:false});a.refresh();a.render();assert.ok(a.labels.filter(l=>l.kind==='machining').every(l=>l.element.style.display==='none'));
const target=a.labels.find(l=>l.element.dataset.annotationId.includes(hole.id)&&l.localNormal.y>0),p=target.worldPoint.clone().project(e.sceneManager.camera);a.pointer={x:(p.x+1)*400,y:(1-p.y)*300};a.render();assert.equal(a.labels.filter(l=>l.kind==='machining'&&l.element.style.display!=='none').length,1);assert.equal(target.element.style.display,'');assert.ok(target.element.style.transform.startsWith('translate('));assert.equal(e.sceneManager.container.dataset.machiningHover,'true');
e.sceneManager.transformControls.dragging=true;a.render();assert.ok(a.labels.filter(l=>l.kind==='machining').every(l=>l.element.style.display==='none'));e.sceneManager.transformControls.dragging=false;
a.pointer={x:799,y:599};a.render();assert.ok(a.labels.filter(l=>l.kind==='machining').every(l=>l.element.style.display==='none'));assert.equal(e.sceneManager.container.dataset.machiningHover,'false');
a.pointer={x:(p.x+1)*400,y:(1-p.y)*300};e.addProfile('DESIGN-4040',260,{position:{x:0,y:100,z:0},select:false,captureHistory:false});e.meshes[1].updateMatrixWorld(true);a.render();assert.equal(target.element.style.display,'none','前方另一构件遮挡时不透视显示加工提示');
a.dispose();assert.equal(e.sceneManager.renderer.domElement.listeners.size,0);assert.equal(e.sceneManager.container.dataset.machiningHover,undefined);delete globalThis.document;delete globalThis.requestAnimationFrame;
const css=fs.readFileSync('src/main/resources/static/css/app.css','utf8');assert.ok(css.includes('.scene-annotation-label.machining{background:#17202e'));assert.ok(!css.includes('.scene-annotation-label.machining{background:#25c86b'));
outcomes.oneCompactHoverTipOcclusionDragDefaultAndCleanup=true;dispose(e);
console.log(JSON.stringify({ok:true,version:'0.75.32',...outcomes}));
