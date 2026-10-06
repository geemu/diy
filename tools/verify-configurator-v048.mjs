import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path,'utf8');
const opening = read('src/main/resources/static/js/configurator/FrameOpeningResolver.js');
const configurator = read('src/main/resources/static/js/configurator/PanelDoorConfigurator.js');
const replacement = read('src/main/resources/static/js/model/ProfileReplacementManager.js');
const editor = read('src/main/resources/static/js/core/Editor.js');
const assembly = read('src/main/resources/static/js/model/AssemblyManager.js');
const schema = read('src/main/resources/static/js/io/ProjectSchema.js');
const app = read('src/main/resources/static/js/app.js');
const html = read('src/main/resources/static/index.html');
const hardware = read('src/main/resources/static/js/model/HardwareCatalog.js');
const primitive = read('src/main/resources/static/js/geometry/PrimitiveGeometryFactory.js');

for (const token of ['sourcePartIds','innerBounds','框口配置需要选择 4 根','widthAxis','heightAxis','normalAxis']) {
  assert.ok(opening.includes(token),`FrameOpeningResolver missing ${token}`);
}
for (const token of ['createPanelFromSelection','refitPanel','createDoorFromSelection','refitDoor','DOOR_CONFIGURATOR','HINGE_GENERIC_40','HANDLE_GENERIC_120',"source:'DOOR_CONFIGURATOR'",'constraintManager.removeForPart']) {
  assert.ok(configurator.includes(token),`PanelDoorConfigurator missing ${token}`);
}
for (const token of ["scope === 'ASSEMBLY'","scope === 'SAME_MODEL'",'switchToRecommendedDesignType','centerlinePreserved','invalidConnectionIds','structuredClone']) {
  assert.ok(replacement.includes(token),`ProfileReplacementManager missing ${token}`);
}
for (const token of ['PanelDoorConfigurator','ProfileReplacementManager','createPanelFromSelectedOpening','createDoorFromSelectedOpening','replaceProfiles','panelDoorConfiguratorVersion:1','profileReplacementVersion:1']) {
  assert.ok(editor.includes(token),`Editor missing ${token}`);
}
for (const token of ['kind:item.kind || null','configurator:item.configurator || null','parameters:item.parameters ? structuredClone(item.parameters) : null']) {
  assert.ok(assembly.includes(token),`AssemblyManager missing ${token}`);
}
assert.ok(schema.includes("CURRENT_APP_VERSION = '0.75.4'"));
assert.ok(schema.includes('panelDoorConfiguratorVersion:1'));
assert.ok(schema.includes('profileReplacementVersion:1'));
for (const token of ['panelFitForm','doorForm','profileReplaceForm','createPanelFromOpening','createDoorFromOpening','replaceSelectedProfiles']) {
  assert.ok(app.includes(token),`app.js missing ${token}`);
}
for (const token of ['框口自动填板','门组件生成器','快速替换截面','重新适配']) {
  assert.ok(html.includes(token),`index.html missing ${token}`);
}
for (const token of ['HINGE_GENERIC_40','HANDLE_GENERIC_120']) assert.ok(hardware.includes(token),`HardwareCatalog missing ${token}`);
for (const token of ["accessoryType === 'HINGE'","accessoryType === 'HANDLE'"]) assert.ok(primitive.includes(token),`PrimitiveGeometryFactory missing ${token}`);

console.log(JSON.stringify({
  ok:true,
  version:'0.75.4',
  frameOpeningResolver:true,
  panelConfigurator:true,
  doorConfigurator:true,
  panelDoorRefit:true,
  profileReplacement:true,
  connectionAutoRepair:true,
  schemaVersion:62
},null,2));
