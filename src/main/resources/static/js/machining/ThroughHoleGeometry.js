import * as THREE from 'three';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import {getSectionDefinition} from '../model/ProfileSectionRegistry.js';

const SEGMENTS=40;
// 未加工的显示网格归当前生成网格所有，dispose时一起释放，不进入Part/JSON。
// 以uuid寻址，让Vue代理入口与原始Three对象入口共用同一份未加工几何。
const originalGeometries=new Map();
const normalMatrices=new WeakMap();

/**
 * 直型材通孔的显示网格切口。有限凸孔体裁剪原三角面，孔壁仅保留实际铝材部分。
 * 不是制造B-Rep，也不改变既有保守包络碰撞；不支持的孔继续由原展示路径处理。
 */
export function renderThroughHoleGeometry(root,group,holes) {
  const part=root.userData.part;
  const bodies=root.children.filter(object=>object.isMesh&&!object.name.startsWith('__'));
  const processed=new Set();
  if(!holes.length) {for(const body of bodies)restoreBody(body);return processed;}
  const section=getSectionDefinition(part.designProfile?.profileId,part.designProfile?.faceClosures||[]);
  if(part.profilePath?.type!=='LINE'||!section?.outer?.length||!bodies.length) return processed;
  const cuts=[];
  for(const hole of holes) {
    const segments=holeSegments(hole,part);
    if(!segments.length)continue;
    cuts.push(...segments);processed.add(hole.item.id);
    if(hole.secondary)processed.add(hole.secondary.id);
  }
  const prisms=cuts.length?materialPrisms(section,part):[];
  const wallVertices=[];
  root.updateWorldMatrix(true,true);
  const inverseRoot=root.matrixWorld.clone().invert();
  for(const body of bodies) {
    const old=body.geometry,original=originalGeometries.get(old.uuid)||old;
    if(!cuts.length) {
      restoreBody(body);
      continue;
    }
    const source=original.clone(),matrix=inverseRoot.clone().multiply(body.matrixWorld),inverse=matrix.clone().invert();
    const localCuts=cuts.map(cut=>({...cut,planes:cut.planes.map(plane=>plane.clone().applyMatrix4(inverse))}));
    const vertices=[];
    eachTriangle(source,triangle=>{
      let polygons=[triangle];
      for(const cut of localCuts) polygons=polygons.flatMap(polygon=>subtract(polygon,cut.planes));
      for(const polygon of polygons) appendPolygon(vertices,polygon);
    });
    const geometry=geometryFrom(vertices);
    originalGeometries.set(geometry.uuid,source);
    geometry.addEventListener('dispose',()=>{originalGeometries.delete(geometry.uuid);source.dispose();});
    body.geometry=geometry;old.dispose();refreshEdges(body,source,localCuts);
    // 按原截面材料三角棱柱裁剪孔壁，不能跨过T槽或空腔补出一整根实心管。
    for(const cut of cuts) for(const face of cut.walls) {
      const local=face.map(vertex=>transformVertex(vertex,inverse));
      for(const prism of prisms) {
        let polygon=local;
        for(const plane of prism) {polygon=clip(polygon,plane,true);if(polygon.length<3)break;}
        if(polygon.length<3)continue;
        polygon=polygon.map(vertex=>transformVertex(vertex,matrix));
        let polygons=[polygon];
        for(const other of cuts)if(other.holeId!==cut.holeId)polygons=polygons.flatMap(value=>subtract(value,other.planes));
        for(const value of polygons)appendPolygon(wallVertices,value,true);
      }
    }
  }
  if(wallVertices.length) {
    const material=ProfileGeometryFactory.material(part);material.roughness=.3;
    const wall=new THREE.Mesh(geometryFrom(wallVertices),material);
    wall.name='__through_hole_walls__';wall.userData.appearanceOnly=true;wall.userData.profileRoot=root;
    wall.castShadow=true;wall.receiveShadow=true;group.add(wall);
  }
  return processed;
}

function holeSegments(hole,part) {
  const {item,pose,secondary}=hole;
  const diameter=Number(item.diameter),[width,height]=part.dimensions.sectionSize;
  const span=Number(['FRONT','BACK'].includes(item.face)?height:width);
  if(!Number.isFinite(diameter)||diameter<=0||!Number.isFinite(span)||span<=0||!pose.point.toArray().every(Number.isFinite))return [];
  const matrix=new THREE.Matrix4().compose(pose.point.clone().addScaledVector(pose.normal,-.03),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),pose.normal.clone().negate()),new THREE.Vector3(1,1,1));
  const radius=diameter/2;
  let entrance=0,major=radius;
  if(secondary) {
    major=Number(secondary.majorDiameter??secondary.diameter)/2;
    if(secondary.type==='COUNTERSINK') {
      const angle=Number(secondary.angleDeg??secondary.countersinkAngleDeg??90);
      if(!Number.isFinite(angle)||angle<=0||angle>=180)return [];
      entrance=(major-radius)/Math.tan(THREE.MathUtils.degToRad(angle/2));
    } else entrance=Number(secondary.depth);
    if(!Number.isFinite(major)||major<radius||!Number.isFinite(entrance)||entrance<0||entrance>=span)return [];
  }
  const result=[];
  if(entrance>0&&major>radius) {
    const first=frustum(0,entrance,major,secondary.type==='COUNTERSINK'?radius:major,matrix,item.id,false);
    if(secondary.type==='COUNTERBORE')first.walls.push(...stepRing(entrance,radius,major,matrix));
    result.push(first);
  }
  result.push(frustum(entrance,span,radius,radius,matrix,item.id,true));
  return result;
}

function frustum(start,end,r0,r1,matrix,holeId,exit) {
  const slope=(r1-r0)/(end-start),inset=Math.cos(Math.PI/SEGMENTS);
  const planes=[new THREE.Plane(new THREE.Vector3(0,0,-1),start-(start===0 ? .02 : 0)),new THREE.Plane(new THREE.Vector3(0,0,1),-end-(exit ? .02 : 0))];
  const walls=[];
  for(let i=0;i<SEGMENTS;i++) {
    const a=i*2*Math.PI/SEGMENTS,b=(i+1)*2*Math.PI/SEGMENTS,middle=(a+b)/2;
    planes.push(new THREE.Plane(new THREE.Vector3(Math.cos(middle),Math.sin(middle),-slope*inset),(-r0+slope*start)*inset).normalize());
    const vertex=(angle,z,r)=>makeVertex(new THREE.Vector3(r*Math.cos(angle),r*Math.sin(angle),z),new THREE.Vector3(-Math.cos(angle),-Math.sin(angle),slope).normalize());
    walls.push([vertex(a,start,r0),vertex(b,start,r0),vertex(b,end,r1),vertex(a,end,r1)].map(value=>transformVertex(value,matrix)));
  }
  return {holeId,planes:planes.map(plane=>plane.applyMatrix4(matrix)),walls};
}

function stepRing(depth,inner,outer,matrix) {
  const result=[];
  for(let i=0;i<SEGMENTS;i++) {
    const a=i*2*Math.PI/SEGMENTS,b=(i+1)*2*Math.PI/SEGMENTS;
    result.push([[a,inner],[b,inner],[b,outer],[a,outer]].map(([angle,r])=>transformVertex(
      makeVertex(new THREE.Vector3(r*Math.cos(angle),r*Math.sin(angle),depth),new THREE.Vector3(0,0,-1)),matrix)));
  }
  return result;
}

function materialPrisms(section,part) {
  const outer=section.outer.map(point=>new THREE.Vector2(Number(point.x),Number(point.y)));
  const holes=(section.holes||[]).map(ring=>ring.map(point=>new THREE.Vector2(Number(point.x),Number(point.y))));
  const triangles=THREE.ShapeUtils.triangulateShape(outer,holes),points=outer.concat(...holes);
  const half=Number(part.dimensions.length)/2;
  const cutPlane=end=>{
    const cut=part.endCuts?.[end],angle=Math.max(-60,Math.min(60,Number(cut?.angleDeg||0))),tan=Math.tan(angle*Math.PI/180);
    const sign=end==='START'?1:-1,normal=new THREE.Vector3(cut?.axis==='Y'?0:sign*tan,cut?.axis==='Y'?sign*tan:0,-sign);
    return new THREE.Plane(normal,-half).normalize();
  };
  return triangles.map(indices=>{
    const values=indices.map(index=>points[index]),center=values.reduce((sum,p)=>sum.add(p),new THREE.Vector2()).multiplyScalar(1/3);
    const planes=[cutPlane('START'),cutPlane('END')];
    for(let i=0;i<3;i++) {
      const a=values[i],b=values[(i+1)%3],normal=new THREE.Vector3(b.y-a.y,a.x-b.x,0);
      const plane=new THREE.Plane(normal,-normal.x*a.x-normal.y*a.y).normalize();
      if(plane.distanceToPoint(new THREE.Vector3(center.x,center.y,0))>0)plane.negate();
      planes.push(plane);
    }
    return planes;
  });
}

function subtract(polygon,planes) {
  if(polygon.length<3)return [];
  if(planes.some(plane=>polygon.every(vertex=>plane.distanceToPoint(vertex.p)>=-.0000001)))return [polygon];
  const result=[];let inside=polygon;
  for(const plane of planes) {
    const outside=clip(inside,plane,false);
    if(outside.length>=3)result.push(outside);
    inside=clip(inside,plane,true);
    if(inside.length<3)break;
  }
  return result;
}

function clip(polygon,plane,inside) {
  const result=[];
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const da=plane.distanceToPoint(a.p)*(inside?1:-1),db=plane.distanceToPoint(b.p)*(inside?1:-1);
    if(da<=0)result.push(a);
    if((da<0&&db>0)||(da>0&&db<0))result.push(interpolate(a,b,da/(da-db)));
  }
  return result;
}

function makeVertex(p,n,uv=new THREE.Vector2(),color=new THREE.Vector3(1,1,1)) {return {p,n,uv,color};}
function interpolate(a,b,t) {return makeVertex(a.p.clone().lerp(b.p,t),a.n.clone().lerp(b.n,t).normalize(),a.uv.clone().lerp(b.uv,t),a.color.clone().lerp(b.color,t));}
function transformVertex(vertex,matrix) {
  let normalMatrix=normalMatrices.get(matrix);
  if(!normalMatrix){normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);normalMatrices.set(matrix,normalMatrix);}
  return makeVertex(vertex.p.clone().applyMatrix4(matrix),vertex.n.clone().applyMatrix3(normalMatrix).normalize(),vertex.uv,vertex.color);
}
function eachTriangle(geometry,callback) {
  const {position,normal,uv,color}=geometry.attributes,index=geometry.index,count=index?index.count:position.count;
  for(let i=0;i<count;i+=3)callback([0,1,2].map(offset=>{
    const k=index?index.getX(i+offset):i+offset;
    return makeVertex(new THREE.Vector3().fromBufferAttribute(position,k),normal?new THREE.Vector3().fromBufferAttribute(normal,k):new THREE.Vector3(0,0,1),
      uv?new THREE.Vector2().fromBufferAttribute(uv,k):new THREE.Vector2(),color?new THREE.Vector3().fromBufferAttribute(color,k):new THREE.Vector3(1,1,1));
  }));
}
function appendPolygon(vertices,polygon,orient=false) {
  for(let i=1;i<polygon.length-1;i++) {
    const triangle=[polygon[0],polygon[i],polygon[i+1]],normal=triangle[1].p.clone().sub(triangle[0].p).cross(triangle[2].p.clone().sub(triangle[0].p));
    if(normal.lengthSq()<1e-14)continue;
    if(orient&&normal.dot(triangle[0].n)<0)[triangle[1],triangle[2]]=[triangle[2],triangle[1]];
    vertices.push(...triangle);
  }
}
function geometryFrom(vertices) {
  const geometry=new THREE.BufferGeometry(),positions=[],normals=[],uvs=[],colors=[];
  for(const vertex of vertices){positions.push(...vertex.p.toArray());normals.push(...vertex.n.toArray());uvs.push(...vertex.uv.toArray());colors.push(...vertex.color.toArray());}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  if(vertices.length){geometry.computeBoundingBox();geometry.computeBoundingSphere();}
  else {geometry.boundingBox=new THREE.Box3().makeEmpty();geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),0);}
  return geometry;
}
/**
 * 裁切会产生不等长的共面拼接边，不能再从裁后网格猜轮廓，否则把这些接缝画成放射线。
 * 原实体轮廓只按孔体截断；新增孔口边来自原材料面与孔体的交线，不来自三角剖分。
 */
function cutEdgeGeometry(source,cuts) {
  const original=new THREE.EdgesGeometry(source,24),position=original.attributes.position;
  const values=[],seen=new Set(),epsilon=1e-6,crease=Math.cos(24*Math.PI/180);
  const append=(a,b)=>{
    if(a.distanceToSquared(b)<1e-12)return;
    const key=point=>point.toArray().map(value=>Math.round(value/epsilon)).join(',');
    const ka=key(a),kb=key(b),id=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;
    if(seen.has(id))return;
    seen.add(id);values.push(...a.toArray(),...b.toArray());
  };
  const retain=(a,b,exclude=null)=>{
    let pieces=[[a,b]];
    for(const cut of cuts)if(cut!==exclude)pieces=pieces.flatMap(([start,end])=>subtractEdge(start,end,cut.planes));
    for(const [start,end] of pieces)append(start,end);
  };
  for(let i=0;i<position.count;i+=2)retain(new THREE.Vector3().fromBufferAttribute(position,i),new THREE.Vector3().fromBufferAttribute(position,i+1));
  original.dispose();
  eachTriangle(source,triangle=>{
    const normal=triangle[1].p.clone().sub(triangle[0].p).cross(triangle[2].p.clone().sub(triangle[0].p));
    if(normal.lengthSq()<1e-14)return;
    normal.normalize();
    for(const cut of cuts) {
      if(cut.planes.some(plane=>triangle.every(vertex=>plane.distanceToPoint(vertex.p)>epsilon)))continue;
      let inside=triangle;
      for(const plane of cut.planes){inside=clip(inside,plane,true);if(inside.length<3)break;}
      if(inside.length<3)continue;
      for(let i=0;i<inside.length;i++) {
        const a=inside[i].p,b=inside[(i+1)%inside.length].p;
        // 只取孔体边界上、与原材料面形成真实折角的线，跳过原三角面的内部边。
        if(cut.planes.some(plane=>Math.abs(plane.distanceToPoint(a))<=epsilon&&Math.abs(plane.distanceToPoint(b))<=epsilon&&Math.abs(normal.dot(plane.normal))<crease))retain(a,b,cut);
      }
    }
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
  return geometry;
}

/** 凸孔体在线段上的区间；只去掉内部，保留与孔壁相切的实际轮廓。 */
function subtractEdge(a,b,planes) {
  let from=0,to=1;
  for(const plane of planes) {
    const da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);
    if(da>=-1e-7&&db>=-1e-7)return [[a,b]];
    if(da<=0&&db<=0)continue;
    const t=da/(da-db);
    if(da>0)from=Math.max(from,t);else to=Math.min(to,t);
    if(from>=to)return [[a,b]];
  }
  const result=[];
  if(from>1e-8)result.push([a,a.clone().lerp(b,from)]);
  if(to<1-1e-8)result.push([a.clone().lerp(b,to),b]);
  return result;
}

function refreshEdges(body,source=null,cuts=[]) {
  for(const child of [...body.children])if(child.isLineSegments&&child.userData.helper) {child.removeFromParent();child.geometry.dispose();child.material.dispose();}
  ProfileGeometryFactory.addCadEdges(body,source&&cuts.length?cutEdgeGeometry(source,cuts):null);
}
function restoreBody(body) {
  const old=body.geometry,original=originalGeometries.get(old.uuid);
  if(original){body.geometry=original.clone();old.dispose();refreshEdges(body);}
}
