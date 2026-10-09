import * as THREE from 'three';
import {profileDesignDefinition} from '../model/DesignProfileCatalog.js';
import {getDevelopedLength} from '../model/ProfilePath.js';

const FACES=[{name:'FRONT',axis:'y',sign:1,u:'x',up:1},{name:'BACK',axis:'y',sign:-1,u:'x',up:-1},{name:'RIGHT',axis:'x',sign:1,u:'y',up:-1},{name:'LEFT',axis:'x',sign:-1,u:'y',up:1}];
const SURFACE_TEXT_HEIGHT_MM=3;
const FONT_RATIO=72/96;

/** 印字只覆盖真实外表面三角面；可读朝向由显示层调整，不跨过槽口或孔。 */
export function buildSurfaceNumberGeometry(root,aspect=3) {
  if(root.userData?.part?.type!=='PROFILE')return null;
  root.updateWorldMatrix(true,true);
  const bodies=[];
  root.traverse(object=>{
    if(!object.isMesh||!object.visible||!object.geometry?.attributes.position)return;
    for(let ancestor=object;ancestor&&ancestor!==root;ancestor=ancestor.parent)if(ancestor.name?.startsWith('__')||ancestor.userData?.surfaceFeedback)return;
    object.geometry.computeBoundingBox();
    const box=object.geometry.boundingBox;
    bodies.push({object,box,length:box.max.z-box.min.z});
  });
  // 弧形参考网格在中间的一段真实材料面印字，不架一块跨越弯曲面的平板。
  bodies.sort((a,b)=>Math.abs(b.length-a.length)>.00001?b.length-a.length:a.object.position.lengthSq()-b.object.position.lengthSq());
  const body=bodies[0];
  if(!body||body.length<4)return null;
  const geometry=body.object.geometry,attribute=geometry.attributes.position,index=geometry.index;
  const matrix=root.matrixWorld.clone().invert().multiply(body.object.matrixWorld);
  const triangles=[];
  for(let i=0,count=index?index.count:attribute.count;i<count;i+=3)triangles.push([0,1,2].map(offset=>new THREE.Vector3().fromBufferAttribute(attribute,index?index.getX(i+offset):i+offset)));
  const positions=[],uvs=[],patches=[];
  const center=(body.box.min.z+body.box.max.z)/2;
  for(const face of FACES) {
    const boundary=face.sign>0?body.box.max[face.axis]:body.box.min[face.axis];
    const normal=new THREE.Vector3();normal[face.axis]=face.sign;
    const surface=triangles.filter(triangle=>{
      const n=triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize();
      return n.dot(normal)>.999&&triangle.every(point=>Math.abs(point[face.axis]-boundary)<.001);
    });
    const intervals=[];
    for(const triangle of surface) {
      const hits=[];
      for(let i=0;i<3;i++) {
        const a=triangle[i],b=triangle[(i+1)%3];
        if(Math.abs(a.z-center)<.00001)hits.push(a[face.u]);
        if((a.z<center&&b.z>center)||(a.z>center&&b.z<center))hits.push(a[face.u]+(b[face.u]-a[face.u])*(center-a.z)/(b.z-a.z));
      }
      if(hits.length>1)intervals.push([Math.min(...hits),Math.max(...hits)]);
    }
    intervals.sort((a,b)=>a[0]-b[0]);
    const strips=[];
    for(const interval of intervals) {
      const last=strips.at(-1);
      if(last&&interval[0]<=last[1]+.0001)last[1]=Math.max(last[1],interval[1]);
      else strips.push([...interval]);
    }
    strips.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])||Math.abs(a[0]+a[1])-Math.abs(b[0]+b[1]));
    const strip=strips[0];
    if(!strip||strip[1]-strip[0]<1.5)continue;
    // 足迹使用固定毫米尺寸；窄壁/短杆仅在建几何时等比限缩，不按屏幕字号补偿缩放。
    const height=Math.min(SURFACE_TEXT_HEIGHT_MM/FONT_RATIO,(strip[1]-strip[0])*.86,body.length*.9/aspect);
    const width=height*aspect,lane=(strip[0]+strip[1])/2;
    const rect={uMin:lane-height/2,uMax:lane+height/2,zMin:center-width/2,zMax:center+width/2};
    const before=positions.length;
    for(const triangle of surface) {
      let polygon=triangle;
      for(const [axis,limit,sign] of [[face.u,rect.uMin,-1],[face.u,rect.uMax,1],['z',rect.zMin,-1],['z',rect.zMax,1]])polygon=clip(polygon,axis,limit,sign);
      for(let i=1;i<polygon.length-1;i++)for(const point of [polygon[0],polygon[i],polygon[i+1]]) {
        const u=(point.z-rect.zMin)/width,v=(point[face.u]-rect.uMin)/height;
        uvs.push(u,face.up>0?v:1-v);
        const local=point.clone().applyMatrix4(matrix);positions.push(local.x,local.y,local.z);
      }
    }
    if(positions.length>before) {
      const corners=[[rect.zMin,rect.uMin],[rect.zMax,rect.uMin],[rect.zMax,rect.uMax],[rect.zMin,rect.uMax]].map(([z,u])=>{
        const point=new THREE.Vector3();point.z=z;point[face.u]=u;point[face.axis]=boundary;
        return point.applyMatrix4(matrix);
      });
      const surfaceNormal=normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(matrix)).normalize();
      patches.push({face:face.name,strip:[...strip],rect,height,width,corners,normal:surfaceNormal,start:before/3,count:(positions.length-before)/3});
    }
  }
  if(!positions.length)return null;
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));result.computeVertexNormals();
  result.userData.numberPatches=patches;
  return result;
}

function clip(points,axis,limit,sign) {
  const result=[];
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],da=(a[axis]-limit)*sign,db=(b[axis]-limit)*sign;
    if(da<=.000001)result.push(a);
    if((da<0&&db>0)||(da>0&&db<0))result.push(a.clone().lerp(b,da/(da-db)));
  }
  return result;
}

/** 从已选具体截面和当前长度取展示文字；读取圆弧展开长不调用会回写Part的路径规范化。 */
export function profileSurfaceLabel(part) {
  const definition=profileDesignDefinition(part),id=String(part.designProfile?.profileId||'');
  const model=definition?.shape==='U_CHANNEL'?definition.name
    :id.startsWith('DESIGN-')?id.slice(7)
    :definition?.name||id||part.designProfile?.nominal||part.dimensions?.sectionSize?.join('×')||'型材';
  const length=part.profilePath?.type==='ARC'?getDevelopedLength(part.profilePath):Number(part.dimensions?.length??part.profilePath?.length);
  const fields=[String(part.displayId||''),String(model),`${Number.isFinite(length)&&length>0?Math.round(length*100)/100:'—'} mm`];
  return {fields,text:fields.join(' · ')};
}

function textureFor(label,lightInk) {
  const canvas=globalThis.document?.createElement('canvas'),context=canvas?.getContext?.('2d');
  if(!context)return null;
  const font='600 72px Arial, sans-serif';context.font=font;
  const width=Math.ceil(context.measureText(label.text).width+24);
  // 所有信息常驻为同一紧凑单行；选中/悬停不放大，也不生成浮字。
  canvas.width=width;canvas.height=96;
  context.font=font;context.textAlign='center';context.textBaseline='middle';
  context.fillStyle=lightInk?'#edf2f7':'#17212d';
  context.fillText(label.text,width/2,48+3);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return {texture,aspect:width/96,layouts:[{aspect:width/96,fontRatio:FONT_RATIO}]};
}

/** 用真实表面UV随型材缩放；镜头仅选可见面并翻正文字，不控制字号。 */
function textMaterial(texture) {
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,toneMapped:false});
  const faces=Array.from({length:FACES.length},()=>new THREE.Vector2());
  material.userData.stampFaces=faces;
  material.onBeforeCompile=shader=>{
    shader.uniforms.stampFaces={value:faces};
    shader.vertexShader='attribute float stampPatch;\nuniform vec2 stampFaces[4];\nvarying float vStampVisible;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vec2 stampFace=stampFaces[int(stampPatch+0.5)];vStampVisible=stampFace.x;
      #ifdef USE_MAP
        // 同时反转两个UV方向，只翻正阅读方向，不镜像或改变实际印字尺寸。
        if(stampFace.y>0.5)vMapUv=vec2(1.0)-vMapUv;
      #endif`);
    shader.fragmentShader='varying float vStampVisible;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','if(vStampVisible<0.5)discard;\n#include <map_fragment>');
  };
  material.customProgramCacheKey=()=> 'profile-surface-text-world-v1';
  return material;
}

function physicallyVisible(object) {
  for(let parent=object;parent;parent=parent.parent)if(parent.visible===false||parent.name?.startsWith('__')||parent.userData?.surfaceFeedback)return false;
  return true;
}

/** 投影内接矩形只评估候选面的可见性；实际字号和足迹由表面几何决定。 */
function readableRectangle(corners,center,layout,direction={x:1,y:0}) {
  let area=0;
  for(let i=0;i<4;i++)area+=corners[i].x*corners[(i+1)%4].y-corners[(i+1)%4].x*corners[i].y;
  if(Math.abs(area)<.0001)return null;
  const sign=Math.sign(area);let halfHeight=Infinity;
  for(let i=0;i<4;i++) {
    const a=corners[i],b=corners[(i+1)%4],dx=b.x-a.x,dy=b.y-a.y;
    const clearance=sign*(dx*(center.y-a.y)-dy*(center.x-a.x));
    const denominator=Math.abs(dx*direction.y-dy*direction.x)*layout.aspect+Math.abs(dx*direction.x+dy*direction.y);
    if(clearance<=0||denominator<.000001)return null;
    halfHeight=Math.min(halfHeight,clearance/denominator);
  }
  halfHeight*=.9;
  if(!Number.isFinite(halfHeight)||halfHeight<=0)return null;
  return {halfWidth:halfHeight*layout.aspect,halfHeight,readability:halfHeight*2*layout.fontRatio,layout};
}

/** 资源完全归展示层管理；不加入构件层级、碰撞/BOM/导出或撤销历史。 */
export default class ProfileSurfaceNumber {
  constructor(scene) {
    this.group=new THREE.Group();this.group.name='__profile_surface_numbers__';scene.add(this.group);
    this.records=new Map();
    this.viewport=new THREE.Vector2();
    this.meshes=[];this.occluders=[];this.occlusionState=new Map();this.occlusionRevision=0;this.renderFrame=-1;
    this.occlusionRay=new THREE.Raycaster();
  }

  refresh(meshes,enabled=true) {
    this.meshes=meshes;this.occluders=[];this.occlusionState.clear();this.occlusionRevision++;this.renderFrame=-1;
    for(const root of meshes)root.traverse(object=>{if(object.isMesh&&object.geometry?.attributes.position&&!object.name?.startsWith('__'))this.occluders.push(object);});
    const active=new Set(enabled?meshes.filter(mesh=>mesh.visible!==false&&mesh.userData?.part?.type==='PROFILE'):[]);
    for(const [root,record] of this.records)if(!active.has(root)){this.release(record);this.records.delete(root);}
    for(const root of active) {
      const part=root.userData.part,label=profileSurfaceLabel(part),keys=[label.text,String(part.color||'')];
      root.updateWorldMatrix(true,true);
      root.traverse(object=>{if(object.isMesh&&!object.name?.startsWith('__'))keys.push(`${object.geometry?.uuid}:${object.geometry?.attributes.position?.version}:${object.matrix.elements.join(',')}`);});
      const key=keys.join('|'),existing=this.records.get(root);
      if(existing?.key===key)continue;
      if(existing){this.release(existing);this.records.delete(root);}
      if(!part.displayId)continue;
      const color=new THREE.Color(part.color||0xd3d7db),ink=textureFor(label,Math.max(color.r,color.g,color.b)<.18);
      if(!ink)continue;
      const geometry=buildSurfaceNumberGeometry(root,ink.aspect);
      if(!geometry){ink.texture.dispose();continue;}
      const patchIds=new Float32Array(geometry.attributes.position.count);
      geometry.userData.numberPatches.forEach((patch,index)=>patchIds.fill(index,patch.start,patch.start+patch.count));
      geometry.setAttribute('stampPatch',new THREE.Float32BufferAttribute(patchIds,1));
      const material=textMaterial(ink.texture);
      const stamp=new THREE.Mesh(geometry,material);stamp.name='__profile_surface_number__';stamp.userData.appearanceOnly=true;
      stamp.renderOrder=1550;stamp.matrixAutoUpdate=false;stamp.frustumCulled=false;stamp.raycast=()=>{};this.group.add(stamp);
      const record={key,root,stamp,texture:ink.texture,layouts:ink.layouts,viewWorld:new THREE.Matrix4(),projection:new THREE.Matrix4(),modelWorld:new THREE.Matrix4(),width:0,height:0,occlusionRevision:-1,face:null};
      stamp.onBeforeRender=(renderer,_scene,camera)=>{
        this.prepareOcclusion(renderer);stamp.matrix.copy(root.matrixWorld);stamp.updateMatrixWorld(true);
        renderer.getSize(this.viewport);this.orient(record,camera,this.viewport.x,this.viewport.y);
      };
      this.records.set(root,record);
    }
    this.update();
  }

  update() {
    for(const {root,stamp} of this.records.values()) {
      stamp.visible=physicallyVisible(root)&&!!root.parent;
      if(!stamp.visible)continue;
      root.updateWorldMatrix(true,false);stamp.matrix.copy(root.matrixWorld);stamp.matrixWorldNeedsUpdate=true;
    }
  }

  /** 仅真实构件参与锚点遮挡；镜头不变时其他构件移动/隐藏也必须让读字重算。 */
  prepareOcclusion(renderer) {
    if(this.renderFrame===renderer.info.render.frame)return;
    this.renderFrame=renderer.info.render.frame;
    for(const root of this.meshes)root.updateWorldMatrix(true,true);
    let changed=false;
    for(const object of this.occluders) {
      const visible=physicallyVisible(object),previous=this.occlusionState.get(object);
      if(previous?.visible===visible&&previous.matrix.equals(object.matrixWorld))continue;
      this.occlusionState.set(object,{visible,matrix:object.matrixWorld.clone()});changed=true;
    }
    if(changed)this.occlusionRevision++;
  }

  anchorVisible(anchor,projected,camera) {
    if(![projected.x,projected.y,projected.z].every(Number.isFinite)||projected.z<-1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1)return false;
    this.occlusionRay.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);
    this.occlusionRay.far=Math.max(0,this.occlusionRay.ray.origin.distanceTo(anchor)-.05);
    return !this.occlusionRay.intersectObjects(this.occluders.filter(object=>this.occlusionState.get(object)?.visible),false).length;
  }

  orient(record,camera,width,height) {
    const {stamp}=record;
    if(record.width===width&&record.height===height&&record.occlusionRevision===this.occlusionRevision&&record.viewWorld.equals(camera.matrixWorld)&&record.projection.equals(camera.projectionMatrix)&&record.modelWorld.equals(stamp.matrixWorld))return;
    record.width=width;record.height=height;record.viewWorld.copy(camera.matrixWorld);record.projection.copy(camera.projectionMatrix);record.modelWorld.copy(stamp.matrixWorld);
    record.occlusionRevision=this.occlusionRevision;
    const faces=stamp.material.userData.stampFaces;
    faces.forEach(face=>face.set(0,0));
    if(width<=0||height<=0)return;
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(stamp.matrixWorld),eye=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld),candidates=[];
    for(const [index,patch] of stamp.geometry.userData.numberPatches.entries()) {
      const worldCorners=patch.corners.map(corner=>corner.clone().applyMatrix4(stamp.matrixWorld));
      const center=worldCorners.reduce((sum,corner)=>sum.add(corner),new THREE.Vector3()).multiplyScalar(.25);
      const towardEye=camera.isOrthographicCamera?camera.getWorldDirection(new THREE.Vector3()).negate():eye.clone().sub(center).normalize();
      const facing=patch.normal.clone().applyMatrix3(normalMatrix).normalize().dot(towardEye);
      if(facing<=.05)continue;
      const nearClipped=camera.isPerspectiveCamera&&worldCorners.some(corner=>corner.clone().applyMatrix4(camera.matrixWorldInverse).z>=-camera.near);
      const screen=worldCorners.map(corner=>{const p=corner.clone().project(camera);return {x:p.x*width/2,y:p.y*height/2};});
      const projected=center.clone().project(camera),screenCenter={x:projected.x*width/2,y:projected.y*height/2};
      const dx=screen[1].x+screen[2].x-screen[0].x-screen[3].x,dy=screen[1].y+screen[2].y-screen[0].y-screen[3].y,length=Math.hypot(dx,dy);
      if(length<.000001)continue;
      const sign=dx<0||(Math.abs(dx)<.000001&&dy<0)?-1:1,direction={x:dx/length*sign,y:dy/length*sign};
      const rectangles=nearClipped?[]:record.layouts.map(layout=>readableRectangle(screen,screenCenter,layout,direction)).filter(Boolean);
      rectangles.sort((a,b)=>b.readability-a.readability);
      const rect=rectangles[0];
      if(rect)candidates.push({index,face:patch.face,center,projected,flip:sign<0,score:Math.max(rect.readability,.001)*(.6+.4*facing)});
    }
    candidates.sort((a,b)=>b.score-a.score);
    // 相邻面的可读性相近时沿用当前面，防止微小转动造成两份文字反复跳换。
    const previous=candidates.find(candidate=>candidate.face===record.face);
    if(previous&&previous.score>=candidates[0].score*.85)candidates.splice(0,0,...candidates.splice(candidates.indexOf(previous),1));
    const chosen=candidates.find(candidate=>this.anchorVisible(candidate.center,candidate.projected,camera));
    if(!chosen){record.face=null;return;}
    record.face=chosen.face;
    faces[chosen.index].set(1,chosen.flip?1:0);
  }

  release(record) {
    record.stamp.removeFromParent();record.stamp.geometry.dispose();record.stamp.material.dispose();
    record.texture.dispose();
  }

  dispose() {
    for(const record of this.records.values())this.release(record);
    this.records.clear();this.occlusionState.clear();this.occluders=[];this.meshes=[];this.group.removeFromParent();
  }
}
