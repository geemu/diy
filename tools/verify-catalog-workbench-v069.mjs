import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {workbenchIcon} from '../src/main/resources/static/js/ui/WorkbenchIcons.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,'src/main/resources/static',file),'utf8');
const html=read('index.html'),app=read('js/app.js'),css=read('css/app.css');
const rail=html.slice(html.indexOf('<nav class="tool-rail'),html.indexOf('<aside v-show="quickPanel"'));
assert.ok(!rail.includes('自由绘制')&&!html.includes("quickPanel==='draw'"),'左轨不重复提供选材/自由绘制表单');
assert.equal((html.match(/id="design-profile-choice"/g)||[]).length,1);
assert.equal((html.match(/v-model="newProfile.catalogId"/g)||[]).length,1,'只保留一个截面选择器');
assert.ok(html.includes('quickAddProfile(newProfile.catalogId)')&&html.includes('ref="catalogProfileCanvas"'));
assert.ok(app.includes("mode==='FREE'&&!hasChosenProfile.value"),'未选材时 E 先定位到组件库');
assert.ok(app.includes("presentation:'catalog'"));
assert.ok(read('js/interaction/ProfileSectionPreview3D.js').includes('this.resizeObserver.disconnect()'));
for(const name of ['build','batch','connection','group','check','measure','fit','profile','shaft','panel','accessory','machining','select','draw','move','rotate','delete']) {
  const svg=workbenchIcon(name);
  assert.ok(svg.includes('viewBox="0 0 24 24"')&&svg.includes('stroke="currentColor"'));
}
assert.ok(!workbenchIcon('<script>').includes('<script>'),'图标不插入任意输入');

const menu=html.slice(html.indexOf('<nav class="cad-menubar"'),html.indexOf('<div class="project-chip'));
assert.equal((menu.match(/<details class="cad-menu">/g)||[]).length,8);
assert.ok(menu.includes('@click="newProject"')&&menu.includes('@click="loadSample"'));
assert.ok(!menu.includes('@click="loadSample">新建项目'),'新建必须是空白工程，不得加载示例');
for(const fn of ['newProject','renameProject','importJson','exportJson','capturePng','undo','redo','toggleProjection','toggleGrid','toggleWorkPlane','showAllParts','setMovementStep','openResource','openEngineeringCenter','openManufacturingConfig','runFactoryValidation','exportFactoryPackage','resetWorkbenchLayout']) {
  assert.ok(menu.includes(fn),`菜单缺少 ${fn}`);
  assert.ok(new RegExp(`(?:function|const)\\s+${fn}\\b`).test(app),`${fn} 没有实现`);
}
const create=app.slice(app.indexOf('function newProject()'),app.indexOf('async function loadSample()'));
assert.ok(create.includes('editor.clear()')&&create.includes('editor.historyManager.reset()'));
assert.ok(create.includes('confirm(')&&!create.includes('diyGenerator.generate'));
assert.ok(create.indexOf('editor.historyManager.reset()')>create.indexOf('editor.drawingSettings='),'新建历史基线必须包含新工程名称');
assert.ok(app.includes('Object.assign(engineeringDrawingForm,editor.drawingSettings)'));
assert.ok(app.includes("dirty.value=false;notify('工程文件已导出"));
assert.ok(app.includes('打开工程将替换当前未保存的设计'));
assert.ok(css.includes('--bg:#020617')&&css.includes('background:#e0f2fe'));
assert.ok(css.includes('.modal-card,.engineering-center-modal{background:#020617'));
assert.ok(css.includes('.cad-topbar{position:relative;z-index:3000'),'菜单应位于浮动面板之上');
assert.ok(app.includes("if(document.querySelector('.modal-backdrop'))return;"),'弹窗期间不能编辑背景工程');
assert.ok(read('js/ui/WorkbenchLayoutManager.js').includes("'right',344"));

// 提取实际方法，不构造 WebGL 编辑器；使用真实 Three.js 投影检验完整包围盒。
const THREE=await import(pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href);
const editorSource=read('js/core/Editor.js'),sceneSource=read('js/core/SceneManager.js');
const fit=new Function('THREE',editorSource.match(/\n  fitView\(\) \{([\s\S]*?)\n  \}/)[1]);
const resize=new Function(sceneSource.match(/\n  resize\(\) \{([\s\S]*?)\n  \}/)[1]);
const applyViewportAnchor=new Function('width','height',sceneSource.match(/\n  applyViewportAnchor\([^\n]*\) \{([\s\S]*?)\n  \}/)[1]);
const setView=new Function('THREE','direction','center','distance','options',sceneSource.match(/\n  setView\([^\n]+\) \{([\s\S]*?)\n  \}/)[1]);
let fitCases=0;
for(const [width,height] of [[1192,952],[616,720],[336,720]])for(const size of [[1000,1000,600],[2000,40,30],[30,2500,30]])for(const kind of ['perspective','orthographic']){
  const half=new THREE.Vector3(...size).multiplyScalar(.5),center=new THREE.Vector3(100,600,-200);
  const p=new THREE.PerspectiveCamera(38,width/height,1,50000);
  const o=new THREE.OrthographicCamera(-1100,1100,1100,-1100,1,50000);
  const manager={container:{clientWidth:width,clientHeight:height},perspectiveCamera:p,orthographicCamera:o,camera:kind==='perspective'?p:o,renderer:{setSize(){}},orbitControls:{target:new THREE.Vector3(),update(){}}};
  manager.resize=()=>resize.call(manager);
  manager.applyViewportAnchor=(width,height)=>applyViewportAnchor.call(manager,width,height);
  manager.applyViewportAnchor(width,height);
  manager.setView=(direction,target,distance)=>setView.call(manager,THREE,direction,target,distance,{immediate:true});
  fit.call({sceneManager:manager,getCenterAndSize:()=>({center,max:Math.max(...size,500),radius:half.length()})},THREE);
  manager.camera.updateMatrixWorld(true);
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    const point=new THREE.Vector3(x*half.x,y*half.y,z*half.z).add(center).project(manager.camera);
    assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1,`${kind} ${width}×${height} ${size} 适配裁切`);
  }
  if(kind==='orthographic'){
    const before=new THREE.Vector3().copy(center).add(half).project(o);
    manager.resize();o.updateMatrixWorld(true);
    assert.ok(before.distanceTo(new THREE.Vector3().copy(center).add(half).project(o))<1e-9,'重复 resize 不应改变正交缩放');
  }
  fitCases++;
}
console.log(JSON.stringify({ok:true,version:'0.75.10',singleCatalogSelector:true,noLeftDrawPanel:true,localVectorIcons:true,topMenus:8,blankNewProject:true,unsavedGuard:true,darkShellBlueCanvas:true,fitCases,schema:62}));
