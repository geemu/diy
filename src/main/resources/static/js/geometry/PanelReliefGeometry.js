import * as THREE from 'three';
import {panelMaterialContours,SolidPanelShapes} from '../model/PanelShapeModel.js';

const triangleCache=new WeakMap(),panelCache=new WeakMap();
const EPS=1e-6;

/** 板材局部 XY 是切割面，Z 是厚度；只读实体三角面，不采集标注、着色或临时工具网格。 */
export function panelPose(part) {
  const p=part.position||{},r=part.rotation||{};
  return new THREE.Matrix4().compose(new THREE.Vector3(p.x||0,p.y||0,p.z||0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x||0,r.y||0,r.z||0,'XYZ')),new THREE.Vector3(1,1,1));
}

function localTriangles(geometry) {
  const p=geometry.attributes.position,index=geometry.index;
  if(!p)return [];
  const signature=[p.version,index?.version,p.count,index?.count].join('|'),saved=triangleCache.get(geometry);
  if(saved?.signature===signature&&saved.position===p&&saved.index===index)return saved.triangles;
  const triangles=[],count=index?index.count:p.count;
  for(let i=0;i+2<count;i+=3)triangles.push([0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j)));
  triangleCache.set(geometry,{signature,triangles,position:p,index});return triangles;
}

function materialMeshes(object) {
  const meshes=[];object.updateWorldMatrix(true,true);
  object.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.attributes.position||mesh.userData?.surfaceFeedback)return;
    for(let node=mesh;node;node=node.parent){
      if(node.visible===false)return;
      if(node!==object&&node.name?.startsWith('__'))return;
      if(node===object)break;
    }
    meshes.push(mesh);
  });
  return meshes;
}

function meshTriangles(mesh,inverse) {
  const matrix=inverse.clone().multiply(mesh.matrixWorld);
  return localTriangles(mesh.geometry).map(triangle=>triangle.map(p=>p.clone().applyMatrix4(matrix)));
}

/** 保留 n·p >= constant 的一侧，切点沿三角边插值。 */
function clip(polygon,normal,constant) {
  if(!polygon.length)return [];
  const result=[];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a.dot(normal)-constant,db=b.dot(normal)-constant;
    if(da>=-EPS)result.push(a);
    if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS))result.push(a.clone().lerp(b,da/(da-db)));
  }
  return result;
}

function prismPlanes(triangle,half) {
  const area=(triangle[1].x-triangle[0].x)*(triangle[2].y-triangle[0].y)-(triangle[1].y-triangle[0].y)*(triangle[2].x-triangle[0].x);
  const points=area<0?[triangle[0],triangle[2],triangle[1]]:triangle;
  const planes=[{n:new THREE.Vector3(0,0,1),c:-half},{n:new THREE.Vector3(0,0,-1),c:-half}];
  for(let i=0;i<3;i++){
    const a=points[i],b=points[(i+1)%3],n=new THREE.Vector3(a.y-b.y,b.x-a.x,0).normalize();
    planes.push({n,c:n.x*a.x+n.y*a.y+EPS*2});
  }
  return planes;
}

function panelPrisms(part) {
  if(part?.type!=='PANEL'||SolidPanelShapes.includes(part.dimensions?.panelShape))return null;
  const signature=JSON.stringify(part.dimensions),saved=panelCache.get(part);
  if(saved?.signature===signature)return saved.prisms;
  const contours=panelMaterialContours(part),outer=contours.outer.map(p=>new THREE.Vector2(p.x,p.y));
  const holes=contours.holes.map(ring=>ring.map(p=>new THREE.Vector2(p.x,p.y))),points=[...outer,...holes.flat()];
  const half=Number(part.dimensions.thickness)/2;
  if(!Number.isFinite(half)||half<=0||outer.length<3)return null;
  const prisms=THREE.ShapeUtils.triangulateShape(outer,holes).map(indices=>{
    const triangle=indices.map(i=>new THREE.Vector3(points[i].x,points[i].y,0));
    return {triangle,half,center:triangle.reduce((p,q)=>p.add(q),new THREE.Vector3()).multiplyScalar(1/3),
      box:new THREE.Box3().setFromPoints(triangle.flatMap(p=>[new THREE.Vector3(p.x,p.y,-half),new THREE.Vector3(p.x,p.y,half)]))};
  });
  panelCache.set(part,{signature,prisms});return prisms;
}

function polygonArea3d(points) {
  if(points.length<3)return 0;
  let area=0;
  for(let i=1;i+1<points.length;i++)area+=points[i].clone().sub(points[0]).cross(points[i+1].clone().sub(points[0])).length()/2;
  return area;
}

/** 闭合子网格的包含判断；每个子实体独立取奇偶，避免两块重叠腿被 XOR 抵消。 */
function insideSolid(point,triangles) {
  const ray=new THREE.Ray(point,new THREE.Vector3(.371,.529,.763).normalize()),hit=new THREE.Vector3(),distances=[];
  for(const t of triangles)if(ray.intersectTriangle(t[0],t[1],t[2],false,hit)){
    const distance=hit.distanceTo(point);if(distance>EPS)distances.push(distance);
  }
  distances.sort((a,b)=>a-b);
  return distances.filter((d,i)=>!i||Math.abs(d-distances[i-1])>1e-5).length%2===1;
}

/** 包络只作宽阶段筛选；已适配薄板再按真实材料三角棱柱和闭合子网格判断，缺口不是实体。 */
export function panelObjectIntersection(part,object,toleranceMm=.5) {
  const prisms=panelPrisms(part);
  if(!prisms)return null;
  const inverse=panelPose(part).invert(),meshes=materialMeshes(object);
  let supported=false;
  for(const mesh of meshes){
    const triangles=meshTriangles(mesh,inverse);
    if(!triangles.length)continue;
    const box=new THREE.Box3().setFromPoints(triangles.flat()),size=box.getSize(new THREE.Vector3());
    if(Math.min(size.x,size.y,size.z)<EPS)continue;
    supported=true;
    for(const prism of prisms){
      if(!prism.box.intersectsBox(box))continue;
      // 只收缩真实厚度边界；不收缩三角剖分的内部边，避免制造出对角线假空隙。
      const half=prism.half-Math.min(Math.max(0,Number(toleranceMm))/2,prism.half/4);
      const planes=prismPlanes(prism.triangle,half);
      for(const triangle of triangles){
        let polygon=triangle;
        for(const plane of planes){polygon=clip(polygon,plane.n,plane.c);if(!polygon.length)break;}
        if(polygonArea3d(polygon)>EPS)return {intersects:true};
      }
      if(insideSolid(prism.center,triangles))return {intersects:true};
    }
  }
  return supported?{intersects:false}:null;
}

/** 在未裁板的厚度内取实体交线/表面点；不是按连接件大包围盒整块挖角。 */
export function panelObstacleFootprint(part,object) {
  const d=part.dimensions,w=Number(d.width)/2,h=Number(d.height)/2,half=Number(d.thickness)/2;
  const inverse=panelPose(part).invert(),points=[];
  const planes=[{n:new THREE.Vector3(0,0,1),c:-half+EPS},{n:new THREE.Vector3(0,0,-1),c:-half+EPS},
    {n:new THREE.Vector3(1,0,0),c:-w},{n:new THREE.Vector3(-1,0,0),c:-w},
    {n:new THREE.Vector3(0,1,0),c:-h},{n:new THREE.Vector3(0,-1,0),c:-h}];
  for(const mesh of materialMeshes(object))for(const triangle of meshTriangles(mesh,inverse)){
    let polygon=triangle;
    for(const plane of planes){polygon=clip(polygon,plane.n,plane.c);if(!polygon.length)break;}
    points.push(...polygon);
  }
  if(!points.length)return null;
  return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
    minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
