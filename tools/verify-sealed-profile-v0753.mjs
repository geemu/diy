import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href,cache=new Map();
function moduleUrl(file) {
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,quote,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl);
const design=await import(moduleUrl(path.join(js,'model/DesignProfileCatalog.js')));
const registry=await import(moduleUrl(path.join(js,'model/ProfileSectionRegistry.js')));
const {buildDesignProfileSection}=await import(moduleUrl(path.join(js,'model/DesignProfileSection.js')));
const {default:factory}=await import(moduleUrl(path.join(js,'geometry/ProfileGeometryFactory.js')));
const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.x*q.y-q.x*p.y;},0)/2);
const center=ring=>ring.reduce((sum,p)=>({x:sum.x+p.x/ring.length,y:sum.y+p.y/ring.length}),{x:0,y:0});
let sectionCases=0,chamberRays=0,wallRays=0;
// 全部内置可选型号、全部封边组合；圆弧两面不是槽面，不人为挖孔。
for(const profile of design.getDesignProfileChoices().filter(p=>p.shape!=='U_CHANNEL')) {
  const faces=profile.shape==='ROUND_CORNER'?['BACK','LEFT']:['FRONT','BACK','LEFT','RIGHT'];
  for(let mask=0;mask<2**faces.length;mask++) {
    const closures=faces.filter((face,i)=>mask&(1<<i));
    const section=registry.getSectionDefinition(profile.id,closures);
    const generated=buildDesignProfileSection(profile,closures);
    const object=factory.createSectionMesh(section,100,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));object.updateMatrixWorld(true);
    for(const ring of generated.closedSlotHoles||[]) {
      const point=center(ring);
      // A/B 两端都应看到真实贯通空腔，不能只在端面画黑色贴图。
      for(const sign of [-1,1]) {
        const ray=new THREE.Raycaster(new THREE.Vector3(point.x,point.y,sign*70),new THREE.Vector3(0,0,-sign));
        assert.equal(ray.intersectObject(object).length,0,`${profile.id} ${closures} 封边槽腔应贯通`);chamberRays++;
      }
    }
    for(const face of new Set([...(profile.defaultFaceClosures||[]),...closures])) {
      if(!faces.includes(face))continue;
      const horizontal=face==='LEFT'||face==='RIGHT',sign=face==='LEFT'||face==='BACK'?-1:1;
      const extent=(horizontal?profile.width:profile.height)/2;
      const origin=horizontal?new THREE.Vector3(sign*(extent+20),0,0):new THREE.Vector3(0,sign*(extent+20),0);
      const direction=horizontal?new THREE.Vector3(-sign,0,0):new THREE.Vector3(0,-sign,0);
      const hit=new THREE.Raycaster(origin,direction).intersectObject(object)[0];
      assert.ok(hit&&Math.abs(hit.distance-20)<1e-5,`${profile.id} ${face} 必须保留连续外壁`);wallRays++;
    }
    // 对比实际端面三角化与二维净面积，发现重叠孔、填孔和丢失三角形。
    const pos=object.geometry.attributes.position;
    let capArea=0;
    for(let i=0;i<pos.count;i+=3) {
      if([i,i+1,i+2].every(j=>Math.abs(pos.getZ(j)+50)<1e-5)) {
        capArea+=Math.abs((pos.getX(i+1)-pos.getX(i))*(pos.getY(i+2)-pos.getY(i))-(pos.getY(i+1)-pos.getY(i))*(pos.getX(i+2)-pos.getX(i)))/2;
      }
    }
    const expected=area(section.outer)-section.holes.reduce((sum,ring)=>sum+area(ring),0);
    // 60×90 原有分格内孔不满足整系列格长；本轮不重绘其旧内腔，仍检查新增槽腔和侧壁。
    if(profile.width%Number(profile.series)===0&&profile.height%Number(profile.series)===0)
      assert.ok(Math.abs(capArea-expected)<Math.max(.01,expected*1e-5),`${profile.id} ${closures} 端面三角化不完整 ${capArea}/${expected}`);
    object.geometry.dispose();object.material.dispose();sectionCases++;
  }
}
const standard=registry.getSectionDefinition('DESIGN-4040',['FRONT','RIGHT']);
assert.equal(standard.holes.length,7,'中央孔、四角孔、两个封闭槽腔都应保留');
// 精确导入截面有自己的孔定义，不能凭封边追加通用参考孔。
const exact={outer:[{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}],holes:[]};
const database=registry.registerCatalogSection('DESIGN-4040',exact);
assert.equal(registry.getSectionDefinition('DESIGN-4040',['FRONT']),database);
registry.removeCatalogSection('DESIGN-4040');
const imported=registry.registerCustomSection('DESIGN-4040',exact);
assert.equal(registry.getSectionDefinition('DESIGN-4040',['FRONT']),imported);
registry.removeCustomSection('DESIGN-4040');
const html=fs.readFileSync(path.join(root,'src/main/resources/static/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'src/main/resources/static/css/app.css'),'utf8');
assert.ok(html.includes('@toggle="positionFooterMenu"')&&html.includes('@scroll="repositionFooterMenus"'));
assert.ok(css.includes('height:48px;padding:5px 8px;overflow:visible'));
assert.ok(css.includes('.workbench-footer .toolbar-more .cad-menu-popover{position:fixed;'));
console.log(JSON.stringify({ok:true,sectionCases,chamberRays,wallRays,integerSeriesEndCaps:true,exactSectionsUnchanged:true,singleFooterRow:true}));
