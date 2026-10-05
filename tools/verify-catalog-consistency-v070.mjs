import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,'src/main/resources/static',file),'utf8');
const html=read('index.html'),app=read('js/app.js'),css=read('css/app.css');
assert.ok(css.includes(':focus:not([type="checkbox"])')&&css.includes(':hover:not(:disabled):not([type="checkbox"])'),'深色表单必须定义 hover/focus 状态');
assert.ok(css.includes('option{background:#1a1a1a;color:#f3f4f6}'));
assert.ok(css.includes('.cad-tool-rail .rail-tool.active:before{content:none}'),'选中态不得叠加第二条指示条');
assert.ok(css.includes('.cad-menu-popover button.active{background:transparent;color:#d1d5db'));
assert.ok(html.includes('class="menu-state"')&&html.includes(':aria-pressed="gridEnabled"'));
for(const category of ['shaft','panel','accessory','connection']){
  const start=html.indexOf(`<template v-else-if="activeLibrary==='${category}'">`);
  const section=html.slice(start,html.indexOf('\n        </template>',start));
  assert.ok(section.includes('catalog-component-content')&&section.includes('catalog-profile-preview')&&section.includes('ref="catalogProfileCanvas"'),`${category} 应使用一致的规格和预览布局`);
}
for(const command of ['placeShaftComponent','placePanelComponent','placeAccessoryComponent','placeConnectionComponent','mountCatalogAccessory(selectedCatalogAccessory)','createPanelFromOpening','createDoorFromOpening','clearAutoConnections'])assert.ok(html.includes(command));
assert.ok(app.includes('PrimitiveGeometryFactory.create(previewSpec)'));
assert.ok(app.includes('watch(connectionRuleId,()=>{if(connectionPlacementState.active)cancelConnectionPlacement();})'));
assert.ok(app.includes('accessoryPlacementState.definitionId!==accessoryDefinition(item).id'),'换规格必须退出旧配件放置，不能误安装旧件');
assert.ok(app.includes('color:panelMaterialColors[newPanel.material]'));
assert.ok(app.includes('catalogProfilePreview?.dispose();catalogProfilePreview=null;return;'),'离开目录必须释放预览');
assert.ok(!html.includes('https://www.lewandiy.com/'),'预览不能依赖参考网站远程资源');

// 用真实 Three.js 几何检验包围球适配；不创建 WebGL、Editor 或工程构件。
const THREE=await import(pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href);
const preview=read('js/interaction/ProfileSectionPreview3D.js');
const fit=new Function('THREE',preview.match(/\n  fitCatalogObject\(\) \{([\s\S]*?)\n  \}/)[1]);
let fitCases=0;
for(const aspect of [.6,1.4,2])for(const size of [[30,30,105],[12,12,108],[500,400,18],[60,130,30],[12,45,500]]){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial());
  mesh.geometry.translate(40,-20,60);
  const group=new THREE.Group();group.add(mesh);
  const camera=new THREE.PerspectiveCamera(32,aspect,.1,5000);
  const state={mesh,root:group,camera};
  fit.call(state,THREE);camera.updateMatrixWorld(true);group.updateMatrixWorld(true);
  const corners=new THREE.Box3().setFromObject(mesh);
  for(const x of [corners.min.x,corners.max.x])for(const y of [corners.min.y,corners.max.y])for(const z of [corners.min.z,corners.max.z]){
    const p=new THREE.Vector3(x,y,z).project(camera);
    assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1,`目录预览裁切：${size} / ${aspect}`);
  }
  const before=camera.position.clone();fit.call(state,THREE);
  assert.ok(before.distanceTo(camera.position)<1e-9,'重复 resize 不能累计改变预览比例');
  mesh.geometry.dispose();mesh.material.dispose();fitCases++;
}
assert.ok(preview.includes('this.renderer.forceContextLoss()'));
assert.ok(preview.includes('if(!this.canvas.isConnected)this.renderer.forceContextLoss()'),'不能强制丢失仍由创建页复用的画布上下文');
console.log(JSON.stringify({ok:true,version:'0.71.0',sharedCatalogLayout:5,darkControlStates:true,uniformMenuStates:true,previewFitCases:fitCases,remoteImages:false,schema:62}));
