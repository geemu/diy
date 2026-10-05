import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const staticRoot = path.join(root, 'src/main/resources/static');
const index = fs.readFileSync(path.join(staticRoot, 'index.html'), 'utf8');
const pom = fs.readFileSync(path.join(root, 'pom.xml'), 'utf8');
const vendorConfigPath = path.join(root,'src/main/java/com/paic/stock/aluminumcad/config/StaticVendorResourceConfig.java');
const vendorConfig = fs.existsSync(vendorConfigPath) ? fs.readFileSync(vendorConfigPath,'utf8') : '';

const failures = [];

for (const needle of ['http://','https://','//cdn.','unpkg.com','jsdelivr.net']) {
  if (index.includes(needle)) failures.push(`index.html 含外部运行期地址：${needle}`);
}

for (const relative of [
  'vendor/vue/vue.global.js',
  'vendor/jszip/jszip.min.js',
  'js/app.js',
  'js/boot.js',
  'samples/型材架子_610x670_H2050.json'
]) {
  if (!fs.existsSync(path.join(staticRoot, relative))) failures.push(`缺少静态文件：${relative}`);
}

for (const expected of [
  './vendor/three/build/three.module.min.js',
  './vendor/three/examples/jsm/controls/OrbitControls.js',
  './vendor/three/examples/jsm/controls/TransformControls.js'
]) {
  if (!index.includes(expected)) failures.push(`importmap 未引用：${expected}`);
}

if (!pom.includes('unpack-three-static-vendor') || !pom.includes('copy-three-static-vendor')) {
  failures.push('pom.xml 未配置 Three.js 构建期静态资源复制');
}
if (!pom.includes('<artifactId>three</artifactId>') || !vendorConfig.includes('/vendor/three/**')) {
  failures.push('Three.js IDE 直跑本地 fallback 未配置');
}

const forbiddenFiles = walk(root).filter(file => /\.(bat|cmd|ps1)$/i.test(file));
if (forbiddenFiles.length) failures.push(`存在禁止的启动脚本：${forbiddenFiles.map(file => path.relative(root,file)).join(', ')}`);

if (failures.length) {
  console.error(failures.map(item => `FAIL: ${item}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok:true,
  runtimeCdn:0,
  forbiddenScripts:0,
  threeStrategy:'local static copy + local WebJar classpath fallback; browser runtime CDN=0'
}, null, 2));

function walk(directory) {
  const out = [];
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const full = path.join(directory,entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
