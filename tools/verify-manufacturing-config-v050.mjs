import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const staticRoot=path.join(root,'src/main/resources/static');
const read=rel=>fs.readFileSync(path.join(staticRoot,rel),'utf8');
const readRoot=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const designModule=await import(pathToFileURL(path.join(staticRoot,'js/model/DesignConnectionCatalog.js')).href);
const {DesignConnectionList}=designModule;
assert.deepEqual(DesignConnectionList.map(item=>item.id),['ANGLE_BRACKET','INTERNAL_CONNECTOR','ANCHOR_CONNECTOR','CONNECTION_PLATE','END_SCREW']);
for(const item of DesignConnectionList){
  for(const forbidden of ['screwSku','tNutSku','washerSku','thread','diameter','machining']){
    assert.equal(item[forbidden],undefined,`设计连接不得携带制造字段 ${forbidden}`);
  }
}

const schema=read('js/io/ProjectSchema.js');
const manager=read('js/connection/ConnectionManager.js');
const configurator=read('js/manufacturing/ManufacturingConfigurator.js');
const resolver=read('js/connection/AutoConnectionResolver.js');
const placement=read('js/connection/ConnectionPlacementManager.js');
const validator=read('js/validation/FactoryValidator.js');
const replacement=read('js/model/ProfileReplacementManager.js');
const bom=read('js/export/BomExporter.js');
const editor=read('js/core/Editor.js');
const app=read('js/app.js');
const html=read('index.html');
const pom=readRoot('pom.xml');

assert.ok(schema.includes('CURRENT_PROJECT_SCHEMA_VERSION = 62'));
assert.ok(schema.includes("CURRENT_APP_VERSION = '0.71.0'"));
assert.ok(schema.includes('manufacturingConfigurationVersion:1'));
assert.ok(schema.includes('连接 ${connection.id} 缺少有效 designType'));
assert.ok(pom.includes('<version>0.71.0</version>'));

for(const token of ['createDesignConnection','recommendDesignFor','getManufacturingOptions','configureManufacturingRule','clearManufacturingRule','manufacturingRuleId:null',"status:'DESIGN_VALID'"]){
  assert.ok(manager.includes(token),`ConnectionManager missing ${token}`);
}
assert.ok(manager.includes('if(!connection.manufacturingRuleId){') && manager.includes('this.createDesignHelper(connection,source,target);'),'未配置制造规则时必须只生成设计提示，不得生成真实五金');
assert.ok(manager.includes('请先完成连接两端型材的真实材料配置'),'制造连接必须等待真实材料配置');
assert.ok(manager.includes('制造槽宽'),'真实连接方案必须按制造槽宽校验紧固件');
assert.ok(resolver.includes('recommendDesignFor'));
assert.ok(resolver.includes('designType:recommended.type'));
assert.ok(!resolver.includes('ruleId:recommended.rule'));
assert.ok(placement.includes('designType'));
assert.ok(placement.includes('recommendDesignFor'));

for(const token of ['profileGroups()','profileCandidates(','configureProfileGroup(','connectionRows()','configureConnection(','recommendAll()','clearAll()','status()']){
  assert.ok(configurator.includes(token),`ManufacturingConfigurator missing ${token}`);
}
assert.ok(configurator.includes('不包含价格、供应商订单、库存或排料'));
assert.ok(editor.includes('new ManufacturingConfigurator(this)'));
assert.ok(replacement.includes('connection.manufacturingRuleId=null'));
assert.ok(validator.includes('MANUFACTURING_PROFILE_UNCONFIGURED'));
assert.ok(validator.includes('MANUFACTURING_CONNECTION_UNCONFIGURED'));
assert.ok(validator.includes("append(lines, '错误'"),'制造检查文本不得直接显示 ERROR/WARNING/INFO');

assert.ok(bom.includes('part.manufacturingProfile?.profileId') && bom.includes('UNCONFIGURED'),'BOM 分组必须区分真实制造规格');
for(const token of ['制造规格','体系/材质','待配置'])assert.ok(bom.includes(token),`BOM missing ${token}`);

for(const token of ['manufacturingConfigVisible','manufacturingProfileGroups','manufacturingConnectionRows','manufacturingConfigStatus','recommendManufacturingConfig','clearManufacturingConfig']){
  assert.ok(app.includes(token),`app.js missing ${token}`);
}
assert.ok(app.includes('制造配置未完成'));
for(const token of ['制造配置','型材材料','连接与加工','完成情况','本页不包含报价','一键推荐配置','清空制造配置','去制造配置','制造检查']){
  assert.ok(html.includes(token),`index.html missing ${token}`);
}
for(const forbidden of ['材料单价','报价金额','成本估算','供应商订单']){
  assert.ok(!html.includes(forbidden),`制造配置页面不应出现报价能力：${forbidden}`);
}

console.log(JSON.stringify({
  ok:true,
  version:'0.71.0',
  schema:62,
  abstractDesignConnection:true,
  realHardwareDeferred:true,
  manufacturingProfileMapping:true,
  manufacturingConnectionMapping:true,
  factoryExportGate:true,
  bomManufacturingAware:true,
  pricing:false
},null,2));
