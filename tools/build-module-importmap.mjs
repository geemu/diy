import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const staticRoot=path.join(root,'src/main/resources/static');
/** 静态 importmap 统一整个本地模块图的版本/身份，不用运行时 CDN、构建服务器或重复的模块实例。 */
export function moduleImportMap() {
  const html=fs.readFileSync(path.join(staticRoot,'index.html'),'utf8');
  const previous=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)[1]);
  const schema=fs.readFileSync(path.join(staticRoot,'js/io/ProjectSchema.js'),'utf8');
  const version=schema.match(/CURRENT_APP_VERSION = '([^']+)'/)[1];
  const imports=Object.fromEntries(Object.entries(previous.imports).filter(([name])=>!name.startsWith('./js/')));
  const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
  for(const file of walk(path.join(staticRoot,'js')).filter(file=>file.endsWith('.js')).sort()) {
    const relative='./'+path.relative(staticRoot,file).replaceAll('\\','/');
    imports[relative]=`${relative}?v=${version}`;
  }
  return {imports};
}

// 输出可审阅的 apply_patch 文本，不直接写入工作区文件。
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const html=fs.readFileSync(path.join(staticRoot,'index.html'),'utf8');
  const previous=html.match(/<script type="importmap">\r?\n([^\r\n]+)\r?\n\s*<\/script>/)[1];
  process.stdout.write(JSON.stringify(`*** Begin Patch\n*** Update File: src/main/resources/static/index.html\n@@\n-${previous}\n+    ${JSON.stringify(moduleImportMap())}\n*** End Patch`));
}
