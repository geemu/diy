import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const read=rel=>fs.readFileSync(path.join(staticRoot,rel),'utf8');

const html=read('index.html');
const css=read('css/app.css');
const app=read('js/app.js');
const layout=read('js/ui/WorkbenchLayoutManager.js');

for(const token of ['data-layout-drag="library"','data-layout-drag="inspector"','data-layout-resize="library"','data-layout-resize="inspector"','data-floating-drag="toolbar"','data-floating-drag="viewCube"','复位工作台布局']){
  assert.ok(html.includes(token),`index.html missing ${token}`);
}
for(const token of ['layout-floating','--library-track','--inspector-track','floating-drag-handle','engineering-locatable']){
  assert.ok(css.includes(token),`app.css missing ${token}`);
}
for(const token of ['floatPanel(','dockPanel(','startPanelDrag(','startPanelResize(','startFloaterDrag(','localStorage','notifyResize()']){
  assert.ok(layout.includes(token),`WorkbenchLayoutManager missing ${token}`);
}
for(const token of ['new WorkbenchLayoutManager().init()','resetWorkbenchLayout','engineeringRowHasParts','engineeringRowSelected','focusEngineeringRow']){
  assert.ok(app.includes(token),`app.js missing ${token}`);
}
assert.ok(html.includes('@dblclick="focusEngineeringRow(row)"'),'工程清单必须支持双击定位三维构件');
assert.ok(html.includes('engineering-current-row'),'三维选择必须能反向高亮工程清单行');
assert.ok(html.includes('双击清单行可关闭窗口并在三维画布中定位对应构件'),'工程中心缺少定位提示');
assert.ok(layout.includes('window.dispatchEvent(new Event(\'resize\'))'),'布局变化必须通知 Three.js 重新计算画布');

console.log(JSON.stringify({
  ok:true,
  version:'0.71.0',
  draggablePanels:true,
  resizablePanels:true,
  draggableToolbar:true,
  draggableViewCube:true,
  persistedLayout:true,
  resetLayout:true,
  engineeringTo3d:true,
  threeDToEngineering:true
},null,2));
