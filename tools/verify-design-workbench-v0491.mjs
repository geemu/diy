import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const read=(relative)=>fs.readFileSync(path.join(staticRoot,relative),'utf8');

const designModule=await import(pathToFileURL(path.join(staticRoot,'js/model/DesignProfileCatalog.js')).href);
const {DesignProfileList,getDesignProfileDefinition}=designModule;
assert.ok(DesignProfileList.length>=10,'设计型材目录过少');
for(const item of DesignProfileList){
  for(const forbidden of ['system','standard','wallThickness','defaultWallThickness','weight','linearWeight','alloy','supplier','sku']){
    assert.equal(item[forbidden],undefined,`设计型材 ${item.id} 不得包含制造字段 ${forbidden}`);
  }
  assert.ok(Number(item.width)>0 && Number(item.height)>0,`${item.id} 缺少设计截面尺寸`);
  assert.ok(Array.isArray(item.defaultFaceClosures),`${item.id} 缺少封边定义`);
}
assert.equal(getDesignProfileDefinition('DESIGN-3030')?.nominal,'3030');

const schema=read('js/io/ProjectSchema.js');
const editor=read('js/core/Editor.js');
const feature=read('js/model/ProfileFeatureCatalog.js');
const connectionPlacement=read('js/connection/ConnectionPlacementManager.js');
const machiningPlacement=read('js/machining/MachiningPlacementManager.js');
const app=read('js/app.js');
const html=read('index.html');

assert.ok(schema.includes('CURRENT_PROJECT_SCHEMA_VERSION = 62'));
assert.ok(schema.includes('delete project.editorState.workbenchMode'));
assert.ok(schema.includes('项目当前不维护历史 Schema 兼容'));
assert.ok(editor.includes('manufacturingProfile:null'),'新建设计型材必须保持 manufacturingProfile=null');
assert.ok(editor.includes('designProfile:{'),'Editor 必须写入 designProfile');
assert.ok(feature.includes('resolveProfileSurfaceFeature'),'连接目标面必须支持独立侧面解析');
assert.ok(feature.includes('isProfileFaceClosed'),'封边必须参与槽位解析');

for(const token of ['resolveDirectJoint','directPreview','单击吸附','两点选择','connectorGhost','resolveProfileSurfaceFeature']){
  assert.ok(connectionPlacement.includes(token),`ConnectionPlacementManager 缺少 ${token}`);
}
assert.ok(connectionPlacement.includes('移动鼠标只负责预览'),'连接 hover 不得提交 Anchor');
assert.ok(connectionPlacement.includes("feature.type!=='PROFILE_END'"),'连接源必须能锁定端部 Anchor');
assert.ok(connectionPlacement.includes("!['PROFILE_SLOT','PROFILE_FACE'].includes(feature.type)"),'连接目标必须能锁定侧面/槽位 Anchor');

for(const token of ['handlePointerMove','handleClick','renderPreview','RingGeometry','已添加：']){
  assert.ok(machiningPlacement.includes(token),`MachiningPlacementManager 缺少 ${token}`);
}
assert.ok(machiningPlacement.includes('点击后才写入 MachiningFeature'),'加工 hover 不得直接落业务数据');

for(const token of ['closeCadMenus','handleCadMenuPointerDown','function returnToSelection']){
  assert.ok(app.includes(token),`app.js 缺少 ${token}`);
}
assert.ok(!html.includes('workbenchMode') && !app.includes('setWorkbenchMode'),'工作台不再区分模式');
assert.ok(!html.includes('@click="openProfileCatalogManager"'),'设计页面不得暴露真实制造型材目录管理入口');
const selector=read('js/ui/ProfileSelector.js');
assert.ok(html.includes('input-id="design-profile-choice"')&&selector.includes('截面规格')&&selector.includes('具体型号'),'选材改为截面规格/具体型号两级');
for(const text of ['选择规格，点击预览后到画布绘制','角槽、直角、内置和连接板支持接头安装','打孔、攻丝和开槽','精确连接与配合','更多加工']){
  assert.ok(html.includes(text),`工作台缺少中文交互：${text}`);
}
for(const visibleEnglish of ['>Warning<','>Error<','>Connection<','>Profile<','>Feature<','>Snap<','>Assembly<']){
  assert.ok(!html.includes(visibleEnglish),`页面仍包含直接展示的英文术语 ${visibleEnglish}`);
}

console.log(JSON.stringify({
  ok:true,
  version:'0.75.36',
  schema:62,
  currentOnly:true,
  designManufacturingSeparated:true,
  designProfiles:DesignProfileList.length,
  faceClosureAware:true,
  oneClickJointSnap:true,
  twoClickFallback:true,
  ghostConnector:true,
  ghostMachining:true,
  unifiedWorkbench:true,
  chineseWorkbench:true,
  menuAutoClose:true,
  pricing:false
},null,2));
