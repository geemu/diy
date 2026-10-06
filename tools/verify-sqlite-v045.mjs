import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const pom=read('pom.xml');
const config=read('src/main/resources/application.yml');
const schema=read('src/main/resources/sql/schema.sql');
const data=read('src/main/resources/sql/data.sql');
const baseMapper=read('src/main/resources/mapper/BaseMapper.xml');
const profileMapper=read('src/main/resources/mapper/ProfileCatalogMapper.xml');

assert.ok(pom.includes('org.xerial'));
assert.ok(pom.includes('sqlite-jdbc'));
assert.ok(!pom.includes('mysql-connector-j'));
assert.ok(config.includes('jdbc:sqlite:./data/aluminum-cad.db'));
assert.ok(config.includes('org.sqlite.JDBC'));
for(const forbidden of ['ENGINE=InnoDB','AUTO_INCREMENT','ON UPDATE CURRENT_TIMESTAMP','JSON_OBJECT(','ON DUPLICATE KEY UPDATE']) {
  assert.ok(!schema.includes(forbidden),`schema still contains MySQL token: ${forbidden}`);
  assert.ok(!data.includes(forbidden),`data still contains MySQL token: ${forbidden}`);
}
assert.ok(data.includes('ON CONFLICT(model) DO UPDATE SET'));
assert.ok(profileMapper.includes('ON CONFLICT(id) DO UPDATE SET'));
assert.ok(!baseMapper.includes('CAST(#{geometryJson} AS JSON)'));

console.log(JSON.stringify({ok:true,version:'0.75.2',database:'SQLite',jdbc:'org.xerial:sqlite-jdbc:3.53.4.0',mybatisXml:true},null,2));
