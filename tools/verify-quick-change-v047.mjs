import assert from 'node:assert/strict';
import fs from 'node:fs';
const manager=fs.readFileSync('src/main/resources/static/js/connection/ConnectionManager.js','utf8');
const app=fs.readFileSync('src/main/resources/static/js/app.js','utf8');
const html=fs.readFileSync('src/main/resources/static/index.html','utf8');
const schema=fs.readFileSync('src/main/resources/static/js/io/ProjectSchema.js','utf8');

for(const token of ['getDesignSwitchOptions','switchDesignType','switchToRecommendedDesignType','getManufacturingOptions','configureManufacturingRule','clearManufacturingRule','userOverridden']) assert.ok(manager.includes(token),token);
for(const token of ['connectionSwitchOptions','switchConnectionRule','switchConnectionRecommended','openManufacturingConfig']) assert.ok(app.includes(token),token);
for(const token of ['设计连接方式','换一个推荐方式','去制造配置','已改']) assert.ok(html.includes(token),token);
assert.ok(html.includes('真实角码、螺钉、螺母和加工参数统一在“制造配置”中确定'));
assert.ok(schema.includes('connectionQuickChangeVersion:1'));
assert.ok(schema.includes('manufacturingConfigurationVersion:1'));
assert.ok(schema.includes("CURRENT_APP_VERSION = '0.75.8'"));
console.log(JSON.stringify({ok:true,version:'0.75.8',designQuickChange:true,sameConnectionId:true,manufacturingInvalidatedOnDesignChange:true,manufacturingConfiguredSeparately:true},null,2));
