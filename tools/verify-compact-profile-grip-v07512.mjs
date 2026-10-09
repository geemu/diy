import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href,cache=new Map();
function moduleUrl(file){
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl);
const {default:Grip}=await import(moduleUrl(path.join(js,'interaction/ProfileGripEditor.js')));
globalThis.window={addEventListener(){}};
const canvas={style:{},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
const camera=new THREE.PerspectiveCamera(40,1280/720,1,100000);camera.position.set(800,500,900);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const mesh=new THREE.Mesh(new THREE.BoxGeometry(30,60,300));mesh.userData.part={id:'test',type:'PROFILE',dimensions:{sectionSize:[30,60],length:300},profilePath:{type:'LINE',length:300}};
const editor={selected:mesh,selectedMeshes:[mesh],sceneManager:{scene:new THREE.Scene(),camera,renderer:{domElement:canvas},transformControls:{dragging:false},addFrameHandler(){}},isMeshTransformable:()=>true,constraintManager:{constraints:[]},connectionManager:{connections:[]}};
const grip=new Grip(editor);grip.refresh();
assert.equal(grip.handles.START.visible,false);assert.equal(grip.handles.END.visible,false,'未悬停不显示端点');
const screen=point=>{const p=point.clone().project(camera);return {clientX:(p.x+1)*640,clientY:(1-p.y)*360}};
const event=screen(grip.handles.END.position);assert.equal(grip.pickHandle(event),grip.handles.END,'隐藏视觉仍可用小屏幕邻域拾取');
grip.handlePointerMove(event);assert.equal(grip.handles.END.visible,true);assert.equal(grip.handles.START.visible,false);
assert.ok(grip.handles.END.children.every(child=>!['SphereGeometry','RingGeometry'].includes(child.geometry.type)),'不再使用球体/大圆环');
const pixelSpan=()=>{
  const p=grip.handles.END.position,right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),q=p.clone().addScaledVector(right,13*grip.worldPerPixel(p));
  const a=screen(p),b=screen(q);return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
};
assert.ok(Math.abs(pixelSpan()-13)<1e-5);camera.position.multiplyScalar(8);camera.updateMatrixWorld(true);grip.refresh();assert.ok(Math.abs(pixelSpan()-13)<1e-5,'放大缩小不改变屏幕尺寸');
const ortho=new THREE.OrthographicCamera(-1280,1280,720,-720,1,100000);
editor.sceneManager.camera=ortho;
assert.equal(grip.worldPerPixel(grip.handles.END.position),2);ortho.zoom=4;
assert.equal(grip.worldPerPixel(grip.handles.END.position),.5,'正交缩放也按实际画布高度换算');
editor.sceneManager.camera=camera;
grip.handlePointerMove({clientX:-100,clientY:-100});assert.equal(grip.handles.END.visible,false);
editor.connectionManager.connections=[{sourceProfileId:'test',sourceEnd:'START'}];grip.hoverEnd='START';grip.refresh();assert.equal(grip.handles.START.userData.blocked,true);assert.equal(grip.handles.START.children[0].material.color.getHex(),0xd04a4a);
editor.accessoryPlacementManager={isActive:()=>true};grip.refresh();assert.equal(grip.handles.START.visible,false);assert.equal(grip.pickHandle(event),null,'配件放置不抢端部点击');
const app=fs.readFileSync(path.join(js,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
const editorCode=fs.readFileSync(path.join(js,'core/Editor.js'),'utf8');
assert.ok(editorCode.includes('if(this.profileGripEditor.pickHandle(event))'),'端部小箭头不叠普通 Feature 球');
assert.ok(app.includes('editor.setSelectedProfileLengthFromEnd('),'长度草稿经端部编辑事务确认');
assert.ok(html.includes('固定 A 端，调整 B 端')&&html.includes('固定 B 端，调整 A 端'));
assert.ok(html.includes('v-model.number="profileLengthForm.lengthMm"'),'输入不能直接修改业务长度');
assert.ok(app.includes("input?.focus();input?.select()"),'双击端点聚焦侧栏长度输入');
console.log(JSON.stringify({ok:true,version:'0.75.36',hoverOnly:true,pixelSized:true,endpointProtection:true,placementShield:true,anchoredInput:true}));
