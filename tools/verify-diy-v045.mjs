import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const html=fs.readFileSync(path.join(staticRoot,'index.html'),'utf8');
const app=fs.readFileSync(path.join(staticRoot,'js/app.js'),'utf8');
const editor=fs.readFileSync(path.join(staticRoot,'js/core/Editor.js'),'utf8');
const css=fs.readFileSync(path.join(staticRoot,'css/app.css'),'utf8');

for(const token of ['框架参数','每层中间承托梁','生成框架','用途预设']) assert.ok(html.includes(token),`missing DIY UI: ${token}`);
for(const token of ['DiyGenerator','DiyTemplateList','generateDiyTemplate','selectDiyTemplate']) assert.ok(app.includes(token),`missing app DIY integration: ${token}`);
for(const token of ['addLayeredRack(options = {})','layeredRackLayout','assemblyManager.reconcile']) assert.ok(editor.includes(token),`missing Editor DIY capability: ${token}`);
assert.ok(fs.readFileSync(path.join(staticRoot,'js/diy/LayeredRackModel.js'),'utf8').includes('中间承托梁'),'共享布局保留每层承托梁，生成和回改使用同一事实');
for(const token of ['.diy-template-grid','.diy-template-choice','.diy-template-summary']) assert.ok(css.includes(token),`missing DIY CSS: ${token}`);

const catalogModule=await import(pathToFileURL(path.join(staticRoot,'js/diy/DiyTemplateCatalog.js')).href);
assert.equal(catalogModule.DiyTemplateList.length,4);
assert.ok(catalogModule.DiyTemplateList.some(item=>item.label==='鱼缸 / 龟缸架'));
assert.ok(catalogModule.getDiyTemplate('BASIC_FRAME'));
assert.equal(catalogModule.getDiyTemplate('TURTLE_TANK_RACK').defaults.levels,5);
assert.equal(catalogModule.getDiyTemplate('TURTLE_TANK_RACK').defaults.centerBeamCount,2);

const generatorModule=await import(pathToFileURL(path.join(staticRoot,'js/diy/DiyGenerator.js')).href);
const calls=[];
const mockEditor={
  parts:[],
  addFrame(options){calls.push(['FRAME',options]);this.parts.push({},{});return 'A1';},
  addLayeredRack(options){calls.push(['LAYERED_RACK',options]);this.parts.push({},{},{});return 'A2';}
};
const generator=new generatorModule.default(mockEditor);
const basic=generator.generate('BASIC_FRAME',{catalogId:'DESIGN-3030',width:800,depth:500,height:900});
const rack=generator.generate('STORAGE_RACK',{catalogId:'DESIGN-3030',width:1000,depth:500,height:1800,levels:4,centerBeamCount:1});
assert.equal(basic.createdPartCount,3);
assert.equal(rack.createdPartCount,3);
assert.equal(calls[0][0],'LAYERED_RACK');
assert.equal(calls[0][1].levels,2);
assert.equal(calls[0][1].centerBeamCount,0);
assert.ok(catalogModule.DiyTemplateList.every(item=>item.generator==='LAYERED_RACK'));
assert.equal(calls[1][0],'LAYERED_RACK');

console.log(JSON.stringify({ok:true,version:'0.75.23',templates:catalogModule.DiyTemplateList.map(item=>item.id),currentSchema:62,unifiedWorkbench:true},null,2));
