import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {moduleImportMap} from './build-module-importmap.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('src/main/resources/static/index.html');
const map=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)[1]);
assert.deepEqual(map,moduleImportMap(),'新文件和全部本地模块必须映射到同一当前版本，不只更新 app.js');
for(const key of ['core/SceneManager','ui/ViewCube','core/Editor','io/ProjectSchema','geometry/ComponentGeometryFactory','interaction/CatalogPresentation']) {
  assert.ok(map.imports[`./js/${key}.js`]?.includes('?v=0.75.34'));
}
const config=read('src/main/java/com/paic/stock/aluminumcad/config/StaticVendorResourceConfig.java');
assert.equal((config.match(/CacheControl.noCache\(\)/g)||[]).length,2);
assert.ok(config.includes('"/js/**"')&&config.includes('"/css/**"'));
console.log(JSON.stringify({ok:true,version:'0.75.34',versionedModules:Object.keys(map.imports).filter(key=>key.startsWith('./js/')).length,sharedModuleIdentity:true,cacheRevalidation:true}));
