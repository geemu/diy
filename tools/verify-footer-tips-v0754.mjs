import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,'src/main/resources/static',file),'utf8');
const html=read('index.html'),css=read('css/app.css'),app=read('js/app.js');
const footer=html.slice(html.indexOf('<footer class="workbench-footer"'),html.indexOf('</footer>')+9);
assert.ok(footer.includes('workbench-footer-scroll')&&footer.includes('workbench-footer-status'));
assert.ok(!footer.includes('status-label')&&!footer.includes('status-hint'),'长提示不得继续占底栏布局');
assert.ok(!/\s:?title=/.test(footer),'自定义 tip 不得和原生 title 重复显示');
assert.ok(html.includes('<teleport to="body">')&&html.includes('role="tooltip"'));
assert.ok(app.includes("if(event.key==='Escape')hideFooterTip();"),'规格框聚焦时 Esc 也必须清理提示');
assert.ok(css.includes('.workbench-footer-scroll{display:flex;')&&css.includes('.workbench-footer-status{display:flex;'));
assert.ok(css.includes('flex:1;min-width:0;height:100%;overflow-x:auto;overflow-y:hidden'));
assert.ok(css.includes('.workbench-footer-tip{position:fixed;')&&css.includes('pointer-events:none'));
for(const action of ['toggleSnap','toggleAutoConnection','toggleGrid','toggleWorkPlane','toggleProjection','fitView','capturePng']) {
  const button=footer.match(new RegExp(`<button[^>]*@click="${action}"[^>]*>`))?.[0];
  assert.ok(button?.includes('data-tip='),`${action} 应有独立的操作说明`);
}

// 直接执行实际 Vue 事件函数，验证夹边、键盘焦点和过期异步提示，不替换生产实现。
const functions=['hideFooterTip','showFooterTip','leaveFooterTip'].map(name=>{
  const found=app.match(new RegExp(`    (?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n    \\}`));
  assert.ok(found,`${name} 必须存在`);return found[0];
}).join('\n');
const create=new Function('footerTip','footerTipElement','nextTick','window',`let footerTipAnchor=null,footerTipSequence=0;${functions}\nreturn {hideFooterTip,showFooterTip,leaveFooterTip};`);
const state={visible:false,text:'',x:0,y:0};
const tip={value:{getBoundingClientRect:()=>({width:280,height:96})}};
const api=create(state,tip,()=>Promise.resolve(),{innerWidth:300,innerHeight:700});
const attributes=new Map([['data-tip','绘制提示\nEsc 结束']]);
const anchor={getAttribute:key=>attributes.get(key),setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key),closest:()=>null,getBoundingClientRect:()=>({left:266,top:652,width:30,height:30}),contains:target=>target==='child'};
await api.showFooterTip({target:{closest:()=>anchor}});
assert.equal(state.visible,true);assert.equal(state.x,12);assert.equal(state.y,548);
assert.equal(attributes.get('aria-describedby'),'workbench-footer-tip');
api.leaveFooterTip({relatedTarget:'child'});assert.equal(state.visible,true,'鼠标进入按钮内部图标不能闪退');
api.leaveFooterTip({relatedTarget:null});assert.equal(state.visible,false);assert.equal(attributes.has('aria-describedby'),false);
let resume;
const asyncState={visible:false,text:'',x:0,y:0};
const asyncApi=create(asyncState,tip,()=>new Promise(resolve=>{resume=resolve;}),{innerWidth:300,innerHeight:700});
const pending=asyncApi.showFooterTip({target:{closest:()=>anchor}});
asyncApi.hideFooterTip();resume();await pending;
assert.equal(asyncState.visible,false,'鼠标离开后，旧 nextTick 不得重新显示提示');
assert.equal(attributes.has('aria-describedby'),false);
console.log(JSON.stringify({ok:true,sharedFooterTips:true,noNativeDuplicate:true,pinnedStatus:true,viewportClamped:true,keyboardFocus:true,staleTipCancelled:true}));
