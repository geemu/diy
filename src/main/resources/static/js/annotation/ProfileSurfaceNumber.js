import * as THREE from 'three';

const FACES=[{name:'FRONT',axis:'y',sign:1,u:'x',up:1},{name:'BACK',axis:'y',sign:-1,u:'x',up:-1},{name:'RIGHT',axis:'x',sign:1,u:'y',up:-1},{name:'LEFT',axis:'x',sign:-1,u:'y',up:1}];

/** 编号只覆盖真实外表面三角面。沿型材长度印字，不用屏幕标签，也不跨过槽口。 */
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
    const height=Math.min(8,(strip[1]-strip[0])*.86,body.length*.65/aspect);
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
    if(positions.length>before)patches.push({face:face.name,strip:[...strip],rect,height,width});
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

function textureFor(text,lightInk) {
  const canvas=globalThis.document?.createElement('canvas'),context=canvas?.getContext?.('2d');
  if(!context)return null;
  const font='600 72px Arial, sans-serif';context.font=font;
  canvas.width=Math.ceil(context.measureText(text).width+24);canvas.height=96;
  context.font=font;context.textAlign='center';context.textBaseline='middle';
  context.fillStyle=lightInk?'#edf2f7':'#17212d';context.fillText(text,canvas.width/2,canvas.height/2+3);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return {texture,aspect:canvas.width/canvas.height};
}

/** 资源完全归展示层管理；不加入构件层级、碰撞/BOM/导出或撤销历史。 */
export default class ProfileSurfaceNumber {
  constructor(scene) {
    this.group=new THREE.Group();this.group.name='__profile_surface_numbers__';scene.add(this.group);
    this.records=new Map();
  }

  refresh(meshes,enabled=true) {
    const active=new Set(enabled?meshes.filter(mesh=>mesh.visible!==false&&mesh.userData?.part?.type==='PROFILE'):[]);
    for(const [root,record] of this.records)if(!active.has(root)){this.release(record);this.records.delete(root);}
    for(const root of active) {
      const part=root.userData.part,keys=[String(part.displayId||''),String(part.color||'')];
      root.updateWorldMatrix(true,true);
      root.traverse(object=>{if(object.isMesh&&!object.name?.startsWith('__'))keys.push(`${object.geometry?.uuid}:${object.geometry?.attributes.position?.version}:${object.matrix.elements.join(',')}`);});
      const key=keys.join('|'),existing=this.records.get(root);
      if(existing?.key===key)continue;
      if(existing){this.release(existing);this.records.delete(root);}
      if(!part.displayId)continue;
      const color=new THREE.Color(part.color||0xd3d7db),ink=textureFor(part.displayId,Math.max(color.r,color.g,color.b)<.18);
      if(!ink)continue;
      const geometry=buildSurfaceNumberGeometry(root,ink.aspect);
      if(!geometry){ink.texture.dispose();continue;}
      const material=new THREE.MeshBasicMaterial({map:ink.texture,transparent:true,depthTest:true,depthWrite:false,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,toneMapped:false});
      const stamp=new THREE.Mesh(geometry,material);stamp.name='__profile_surface_number__';stamp.userData.appearanceOnly=true;
      stamp.renderOrder=1550;stamp.matrixAutoUpdate=false;stamp.raycast=()=>{};this.group.add(stamp);
      this.records.set(root,{key,root,stamp,texture:ink.texture});
    }
    this.update();
  }

  update() {
    for(const {root,stamp} of this.records.values()) {
      stamp.visible=root.visible!==false&&!!root.parent;
      if(!stamp.visible)continue;
      root.updateWorldMatrix(true,false);stamp.matrix.copy(root.matrixWorld);stamp.matrixWorldNeedsUpdate=true;
    }
  }

  release(record) {
    record.stamp.removeFromParent();record.stamp.geometry.dispose();record.stamp.material.dispose();record.texture.dispose();
  }

  dispose() {
    for(const record of this.records.values())this.release(record);
    this.records.clear();this.group.removeFromParent();
  }
}
