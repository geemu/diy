import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),js=path.join(root,'src/main/resources/static/js');
const threeUrl=pathToFileURL(path.join(root,'target/classes/static/vendor/three/build/three.module.min.js')).href,cache=new Map();
function moduleUrl(file){
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,q,spec)=>`from '${spec==='three'?threeUrl:spec.startsWith('.')?moduleUrl(path.resolve(path.dirname(file),spec)):spec}'`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
const THREE=await import(threeUrl);
const {default:Factory}=await import(moduleUrl(path.join(js,'geometry/ProfileGeometryFactory.js')));
const {compareProfileTopPlanes,addCoplanarSurfaceFeedback,coplanarFeedbackLabel}=await import(moduleUrl(path.join(js,'interaction/CoplanarSurfaceFeedback.js')));
const {default:SnapManager}=await import(moduleUrl(path.join(js,'snap/SnapManager.js')));
const {default:Interference}=await import(moduleUrl(path.join(js,'interaction/InterferenceFeedbackManager.js')));
const make=(id,x,y,z,rx=0,ry=0,size=[20,40],length=200)=>{
  const mesh=Factory.create({id,displayId:id,type:'PROFILE',designProfile:{profileId:size[1]===40?'DESIGN-2040':'DESIGN-2020'},dimensions:{sectionSize:size,length},profilePath:{type:'LINE',length},position:{x,y,z},rotation:{x:rx,y:ry,z:0}});
  mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,0);return mesh;
};
const target=make('P1',0,20,0,0,0,[20,40],300),source=make('P2',120,20,0,0,Math.PI/2);
const before=JSON.stringify([target.userData.part,source.userData.part]);
assert.equal(compareProfileTopPlanes(source,target).aligned,true,'垂直框边上表面真正齐平');
const sameCenter=make('short',120,20,0,0,Math.PI/2,[20,20]);
assert.equal(compareProfileTopPlanes(sameCenter,target).aligned,false,'中心线同高不代表上表面齐平');
assert.equal(compareProfileTopPlanes(sameCenter,target).gapMm,10);
assert.ok(coplanarFeedbackLabel(compareProfileTopPlanes(sameCenter,target)).includes('高差 10 mm'));
sameCenter.position.y=30;assert.equal(compareProfileTopPlanes(sameCenter,target).aligned,true,'不同厚度以上表面而非中心线判定');
source.position.y+=.2;assert.equal(compareProfileTopPlanes(source,target).aligned,false,'0.2 mm 高差不能算齐平');source.position.y-=.2;
source.rotation.x=.001;assert.equal(compareProfileTopPlanes(source,target).aligned,false,'长杆微倾斜不能只按中心高度判齐平');source.rotation.x=0;
const vertical=make('post',0,100,0,-Math.PI/2);assert.equal(compareProfileTopPlanes(vertical,target),null,'竖杆不能把侧面误称为上面');
const group=new THREE.Group();addCoplanarSurfaceFeedback(group,source,target);assert.equal(group.children.length,2);
assert.ok(group.children.every(h=>h.userData.__coplanar&&h.material.color.getHex()===0xa17af5));
// 实际 SnapManager + 原干涉分类器，覆盖接触允许、反面穿透排除和第三方障碍。
const scene=new THREE.Scene();scene.add(source,target);
let feedback=null,clears=0;
const editor={meshes:[source,target],selected:source,selectedMeshes:[source],projectSettings:{collisionToleranceMm:.5,contactToleranceMm:1},connectionManager:{connections:[]},sceneManager:{scene,clearSnapPreview(){clears++;},hideSnapFeedback(){feedback=null;},showSnapFeedback(value){feedback=value;},showSnapPreview(){},showSnapSurface(){},showCoplanarPreview(){},showSnapPoint(){}},getMeshByPartId(id){return this.meshes.find(m=>m.userData.part.id===id);},currentTransformMeshes(){return this.selectedMeshes;}};
editor.interferenceFeedbackManager=new Interference(editor);
const snap=new SnapManager(editor);snap.rotationSnapEnabled=false;
assert.ok(snap.preview(source),'合法 10 mm 靠近贴面仍可吸附');
assert.ok(snap.snap(source),'合法候选可实际落位');assert.ok(Math.abs(source.position.x-110)<1e-6);
assert.equal(editor.interferenceFeedbackManager.classify({obb:(await import(moduleUrl(path.join(js,'validation/PartCollisionDetector.js')))).profileObb({...source.userData.part,position:{x:110,y:20,z:0}})},{obb:(await import(moduleUrl(path.join(js,'validation/PartCollisionDetector.js')))).profileObb(target.userData.part)}).kind,'CONTACT');
source.position.x=120;source.updateMatrixWorld(true);
const candidate=snap.collectCandidates(source,35).find(c=>c.snap.targetFace==='RIGHT');assert.ok(candidate);
assert.equal(snap.candidateCollision(source,candidate),null);
const obstacle=make('P3',180,20,0,0,Math.PI/2,[20,40],40);editor.meshes.push(obstacle);scene.add(obstacle);
assert.ok(snap.candidateCollision(source,candidate),'吸附对齐目标后撞到第三根必须排除');
assert.equal(snap.preview(source),null);assert.equal(feedback.status,'blocked');assert.ok(clears>0);
const position=source.position.clone();assert.equal(snap.snap(source),null);assert.deepEqual(source.position.toArray(),position.toArray(),'无合法候选不移动源件');
editor.meshes.pop();scene.remove(obstacle);
// 原候选取得后出现新障碍，再次提交仍必须拒绝。
snap.lastSession={sourceId:'P2',originPosition:source.position.clone(),candidates:[candidate],index:0};editor.meshes.push(obstacle);
assert.equal(snap.applyCandidate(source,0),null);assert.equal(source.userData.lastSnap,null);
editor.meshes.pop();source.rotation.y=-Math.PI/2;source.position.x=-90;
assert.ok(snap.collectFaceCandidates(source,snap.endpoints(source),35).every(c=>c.snap.targetFace!=='RIGHT'),'反向伸入目标的端点不能推荐右侧面');
source.position.set(120,20,0);source.rotation.y=Math.PI/2;
assert.equal(JSON.stringify([target.userData.part,source.userData.part]),before,'齐平与候选预判不写业务模型');
const editorSource=fs.readFileSync(path.join(js,'core/Editor.js'),'utf8');
assert.ok(editorSource.includes('this.onSnapChanged?.(null)'),'回退清除 UI 吸附状态');
console.log(JSON.stringify({ok:true,version:'0.75.10',sameTopNotCenter:true,tiltRejected:true,candidateCollision:true,thirdPartyObstacle:true,commitRecheck:true,readonly:true}));
