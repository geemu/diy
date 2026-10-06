import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href;
const THREE=await import(threeUrl);
const source=fs.readFileSync(path.join(js,'core/InfiniteGround.js'),'utf8').replace("from 'three'",`from '${threeUrl}'`);
const {default:InfiniteGround}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const ground=new InfiniteGround();
assert.equal(ground.mesh.frustumCulled,false);
assert.equal(ground.material.depthTest,false);assert.equal(ground.material.depthWrite,false);
assert.equal(ground.mesh.name,'__presentation_ground__');
assert.equal(ground.mesh.geometry.attributes.position.count,4,'地面成本不能随世界范围增长');
const quadrantColors={positiveXPositiveZ:0x587fb5,negativeXPositiveZ:0x8e6da8,negativeXNegativeZ:0xa17d54,positiveXNegativeZ:0x438c92};
assert.equal(new Set(Object.values(quadrantColors)).size,4);
for(const [name,color] of Object.entries(quadrantColors))assert.equal(ground.material.uniforms[name].value.getHex(),color);
assert.equal(ground.material.uniforms.groundColor.value.getHex(),0xa5bfd5,'象限颜色不能染到地面底色');
assert.equal(ground.material.uniforms.xAxisColor.value.getHex(),0xe74c4c,'X 轴为红色');
assert.equal(ground.material.uniforms.zAxisColor.value.getHex(),0x229e63,'Z 轴为绿色');
assert.match(ground.material.fragmentShader,/hit\.z>=0\.0\s*\?\(hit\.x>=0\.0\?positiveXPositiveZ:negativeXPositiveZ\)\s*:\(hit\.x>=0\.0\?positiveXNegativeZ:negativeXNegativeZ\)/,'四象限按真实世界 X/Z 符号选色');
assert.ok(ground.material.fragmentShader.includes('axisDistance=abs(hit.xz)/axisWidth'));
assert.ok(ground.material.fragmentShader.includes('color=mix(color,zAxisColor,axisCoverage.x*axisFade)'));
assert.ok(ground.material.fragmentShader.includes('color=mix(color,xAxisColor,axisCoverage.y*axisFade)'));
assert.ok(ground.material.fragmentShader.includes('color=mix(color,quadrantInk,lines)'),'象限颜色只作用在线条覆盖区域');
let cases=0,beyondFarPlane=0;
// 根据真实相机逆矩阵模拟片元射线：平移、缩放、投影及远裁剪面之外均可求出地面。
for(const projection of ['perspective','orthographic'])for(const shift of [0,100000,-100000])for(const altitude of [50,500,5000]){
  const camera=projection==='perspective'?new THREE.PerspectiveCamera(38,1.4,1,50000):new THREE.OrthographicCamera(-2000,2000,1400,-1400,-50000,50000);
  camera.position.set(shift,altitude,shift+2800);camera.lookAt(shift,projection==='orthographic'?0:altitude,shift);camera.updateMatrixWorld(true);
  ground.update(camera,true);
  assert.deepEqual(ground.material.uniforms.cameraWorld.value.elements,camera.matrixWorld.elements);
  for(const y of [-.8,-.2,-.002]){
    const a=new THREE.Vector3(.2,y,-1).unproject(camera),b=new THREE.Vector3(.2,y,1).unproject(camera),ray=b.sub(a).normalize();
    if(Math.abs(ray.y)<1e-6)continue; // 正交正视与地面平行，地面不应填成竖直背景。
    const travel=(-.05-a.y)/ray.y;if(travel<=0)continue;
    const hit=a.addScaledVector(ray,travel);assert.ok(Number.isFinite(hit.x)&&Number.isFinite(hit.z));
    if(travel>camera.far)beyondFarPlane++;cases++;
  }
  assert.ok(ground.material.uniforms.fadeDistance.value>=6000);
  ground.update(camera,false);assert.equal(ground.material.uniforms.showGrid.value,0);
}
assert.ok(cases>=27&&beyondFarPlane>0);
assert.ok(ground.material.fragmentShader.includes('fwidth(q)')&&ground.material.fragmentShader.includes('footprint'));
assert.ok(ground.material.fragmentShader.includes('smoothstep(0.12,0.95')&&ground.material.fragmentShader.includes('pow(fade,0.75)'),'网格需保留清晰实线中心，中远景不可过早淡出');
assert.ok(!ground.material.fragmentShader.includes('travel>'),'不能用固定距离切掉网格');
const scene=fs.readFileSync(path.join(js,'core/SceneManager.js'),'utf8');
assert.ok(!scene.includes('new THREE.GridHelper(20000')&&!scene.includes('new THREE.Fog('));
assert.ok(scene.includes('camera,this.grid.visible'),'每次渲染按当前相机和网格开关更新');
const planeSource=fs.readFileSync(path.join(js,'interaction/WorkPlaneVisualizer.js'),'utf8').replace("from 'three'",`from '${threeUrl}'`);
const {default:WorkPlane}=await import('data:text/javascript;base64,'+Buffer.from(planeSource).toString('base64'));
const planes=new WorkPlane({scene:new THREE.Scene(),infiniteGround:ground});
assert.equal(planes.grid.visible,false,'XZ 不能重复叠加有限工作面网格');
planes.setPlane('XY');assert.equal(planes.grid.visible,true);
planes.setVisible(false);assert.equal(planes.grid.visible,false);
planes.setPlane('XZ');planes.setVisible(true);assert.equal(planes.grid.visible,false);
ground.dispose();
console.log(JSON.stringify({ok:true,version:'0.75.8',rayCases:cases,beyondFarPlane,infiniteGrid:true,worldLocked:true,quadrantColors:4,coloredAxes:true,depthOcclusion:false}));
