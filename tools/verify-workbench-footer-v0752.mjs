import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,'src/main/resources/static',file),'utf8');
const html=read('index.html'),css=read('css/app.css'),app=read('js/app.js');
const stage=html.indexOf('<div class="canvas-stage"'),footer=html.indexOf('<footer class="workbench-footer"');
assert.ok(stage>0&&footer>stage);
assert.ok(html.indexOf('ref="viewport"',stage)<footer,'Three.js 容器属于底栏上方的独立画布');
for(const name of ['canvas-transform-bar','canvas-bottom-bar']) {
  assert.ok(html.indexOf(`class="${name}"`)>footer,`${name} 必须归入底部工作台而非画布`);
}
assert.ok(!html.includes('class="quick-rotate-bar"'),'快捷旋转收进更多菜单，不再占据常驻底栏');
assert.ok(html.indexOf('v-for="axis in [\'X\',\'Y\',\'Z\']" :key="\'rotate\'+axis"')>footer&&html.includes('@click="quickRotate(axis)"'),'三个方向的快捷旋转仍可从工作台菜单执行');
assert.ok(html.indexOf('footer-display-menu"')>footer,'次要显示开关仍在工作台菜单中可达');
assert.ok(!html.includes('data-floating-drag="toolbar"'),'已停靠工具条不再允许拖回画布');
assert.ok(html.includes('<div class="canvas-stage" @dragover.prevent @drop="dropAsset">'),'组件拖放只在真实画布提交');
for(const token of ['.canvas-shell{display:flex;flex-direction:column}', '.canvas-stage{position:relative;flex:1;', '.workbench-footer{position:relative;flex:0 0 auto;', 'transform:none!important;', '.workbench-footer-scroll{display:flex;', '.workbench-footer-status{display:flex;'])assert.ok(css.includes(token),token);
assert.ok(app.includes('viewportResizeObserver.observe(viewport.value)')&&app.includes('viewportResizeObserver?.disconnect()'),'底栏动态换行必须重算画布并清理观察器');

const layoutSource=read('js/ui/WorkbenchLayoutManager.js');
const {default:Layout}=await import('data:text/javascript;base64,'+Buffer.from(layoutSource).toString('base64'));
// 真实 init 在旧布局存在时仅注册仍浮动的 View Cube，不读取或应用旧工具条位置。
const calls=[],state={floaters:{toolbar:{custom:true,x:100,y:200},viewCube:{custom:true,x:8,y:9}}};
const manager={workspace:{},canvas:{},state,cleanup:[],bindPanel(...args){calls.push(['panel',...args]);},bindFloater(...args){calls.push(['floater',...args]);},applyStoredLayout(){calls.push(['stored']);},clampAll(){}};
const previousWindow=globalThis.window;
globalThis.window={addEventListener(){},removeEventListener(){}};
try{Layout.prototype.init.call(manager);}finally{globalThis.window=previousWindow;}
assert.equal(state.floaters.toolbar,undefined);
assert.deepEqual(state.floaters.viewCube,{custom:true,x:8,y:9});
assert.deepEqual(calls.filter(item=>item[0]==='floater'),[['floater','viewCube','.view-cube']]);
assert.ok(layoutSource.includes("document.querySelector('.canvas-stage')"),'浮动导航限制到实际画布，不可覆盖底栏');
console.log(JSON.stringify({ok:true,version:'0.75.34',separateCanvas:true,dockedToolbar:true,dockedRotation:true,dockedStatus:true,oldToolbarPositionIgnored:true,resizeObserver:true}));
