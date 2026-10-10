import * as THREE from 'three';
import {profileDesignDefinition} from '../model/DesignProfileCatalog.js';
import {getDevelopedLength, getLocalFrameAtStation} from '../model/ProfilePath.js';
import {machiningLocalPose} from '../machining/MachiningManager.js';

const FACES=[{name:'FRONT',axis:'y',sign:1,u:'x',up:1},{name:'BACK',axis:'y',sign:-1,u:'x',up:-1},{name:'RIGHT',axis:'x',sign:1,u:'y',up:-1},{name:'LEFT',axis:'x',sign:-1,u:'y',up:1}];
const SURFACE_TEXT_HEIGHT_MM=4;
const MACHINING_TEXT_HEIGHT_MM=2.6;
const MACHINING_LEADER_WIDTH_MM=.16;
const FONT_RATIO=72/96;
const SECONDARY_HOLES=['COUNTERSINK','COUNTERBORE','END_COUNTERSINK','END_COUNTERBORE'];
const OPPOSITE_FACE={FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'};

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

/** 孔径/螺纹仅按已有加工参数展示，复合孔只合并同位置的关联项。 */
export function machiningSizeInfo(item,linked) {
  const positive=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
  const diameter=positive(item.diameter),major=item.type.includes('COUNTERSINK')?positive(item.majorDiameter??item.diameter):diameter,format=value=>String(Number(value.toFixed(3)));
  if(['END_TAP','TAPPED_HOLE'].includes(item.type)) {
    const thread=String(item.tappingSize||'').trim(),match=/^M\s*(\d+(?:\.\d+)?)/i.exec(thread),nominal=positive(match?.[1]);
    return thread&&nominal?{text:thread,radius:nominal/2}:null;
  }
  if(SECONDARY_HOLES.includes(item.type)) {
    if(!major)return null;
    const bore=positive(linked?.diameter),name=item.type.includes('COUNTERSINK')?'沉头':'沉孔';
    return {text:`${bore?`Φ${format(bore)} / `:''}${name}Φ${format(major)}`,radius:major/2};
  }
  if(['THROUGH_HOLE','END_HOLE','BLIND_HOLE'].includes(item.type)&&diameter)return {text:`${item.type==='BLIND_HOLE'?'盲孔 ':''}Φ${format(diameter)}`,radius:diameter/2};
  return null;
}

function sameHolePosition(a,b) {
  const end=String(a.type).startsWith('END_');
  if(end!==String(b.type).startsWith('END_'))return false;
  if(end)return a.end===b.end&&Math.abs(Number(a.offsetX||0)-Number(b.offsetX||0))<.001&&Math.abs(Number(a.offsetY||0)-Number(b.offsetY||0))<.001;
  return a.face===b.face&&Math.abs(Number(a.stationS??a.distanceFromStart)-Number(b.stationS??b.distanceFromStart))<.001&&Math.abs(Number(a.offset||0)-Number(b.offset||0))<.001;
}

function machiningSurfaceEntries(part) {
  const items=part.machiningItems||[],entries=[];
  // 路径工具会规范化入参，只给它展示副本，避免印字回写Part/历史。
  const viewPart={...part,dimensions:{...part.dimensions},profilePath:part.profilePath?{...part.profilePath}:undefined};
  const length=part.profilePath?.type==='ARC'?getDevelopedLength(part.profilePath):Number(part.dimensions?.length);
  for(const item of items) {
    const linked=items.find(other=>other.id===item.linkedHoleId&&sameHolePosition(item,other));
    const secondary=items.find(other=>other.linkedHoleId===item.id&&SECONDARY_HOLES.includes(other.type)&&sameHolePosition(item,other));
    const size=machiningSizeInfo(item,linked);
    if(!size)continue;
    const end=String(item.type).startsWith('END_'),station=end?(item.end==='END'?length:0):Number(item.stationS??item.distanceFromStart);
    if(!Number.isFinite(station)||!Number.isFinite(length)||length<=0||station<0||station>length||(!end&&!OPPOSITE_FACE[item.face]))continue;
    const datum=end?(item.end==='END'?'B':'A'):(item.referenceDatum||linked?.referenceDatum)==='B_END'?'B':'A';
    const basis=end?`${datum}端`:`${datum}${Math.round(datum==='B'?length-station:station)}`;
    const wide=Number(part.dimensions.sectionSize[0])>=Number(part.dimensions.sectionSize[1]);
    const direction=end?new THREE.Vector3(wide?1:0,wide?0:1,0):new THREE.Vector3(...getLocalFrameAtStation(viewPart,station).tangent);
    const faces=secondary?[]:[item.face];
    if(item.type==='THROUGH_HOLE'&&OPPOSITE_FACE[item.face])faces.push(OPPOSITE_FACE[item.face]);
    for(const face of faces)entries.push({id:`${item.id}:${face||item.end}`,text:`${basis} · ${size.text}`,shortText:basis,size,pose:machiningLocalPose(viewPart,item,face),direction});
  }
  return entries;
}

/** 只读取当前已裁切的实体材料面，不读取原未加工几何或可视孔腔/高亮辅助面。 */
function materialTriangles(root) {
  const triangles=[],inverse=root.matrixWorld.clone().invert();
  root.traverse(object=>{
    if(!object.isMesh||!physicallyVisible(object)||!object.geometry?.attributes.position)return;
    const geometry=object.geometry,attribute=geometry.attributes.position,index=geometry.index,matrix=inverse.clone().multiply(object.matrixWorld);
    for(let i=0,count=index?index.count:attribute.count;i<count;i+=3)triangles.push([0,1,2].map(offset=>new THREE.Vector3().fromBufferAttribute(attribute,index?index.getX(i+offset):i+offset).applyMatrix4(matrix)));
  });
  return triangles;
}

function materialStrips(surface,station) {
  const intervals=[];
  for(const triangle of surface) {
    const hits=[];
    for(let i=0;i<3;i++) {
      const a=triangle[i],b=triangle[(i+1)%3];
      if(Math.abs(a.x-station)<.00001)hits.push(a.y);
      if((a.x<station&&b.x>station)||(a.x>station&&b.x<station))hits.push(a.y+(b.y-a.y)*(station-a.x)/(b.x-a.x));
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
  return strips;
}

function clippedPrint(surface,rect) {
  const polygons=[];let area=0;
  for(const triangle of surface) {
    if(triangle.every(point=>point.x<rect.xMin)||triangle.every(point=>point.x>rect.xMax)||triangle.every(point=>point.y<rect.yMin)||triangle.every(point=>point.y>rect.yMax))continue;
    let polygon=triangle;
    for(const [axis,limit,sign] of [['x',rect.xMin,-1],['x',rect.xMax,1],['y',rect.yMin,-1],['y',rect.yMax,1]])polygon=clip(polygon,axis,limit,sign);
    if(polygon.length<3)continue;
    let sum=0;
    for(let i=0;i<polygon.length;i++)sum+=polygon[i].x*polygon[(i+1)%polygon.length].y-polygon[(i+1)%polygon.length].x*polygon[i].y;
    area+=Math.abs(sum)/2;polygons.push(polygon);
  }
  // 整个印字足迹须有材料支撑；不能只留下穿过槽/孔的一截文字。
  const expected=(rect.xMax-rect.xMin)*(rect.yMax-rect.yMin);
  return Math.abs(area-expected)<=Math.max(.001,expected*.001)?polygons:null;
}

function segmentDistance(point,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,lengthSq=dx*dx+dy*dy;
  const t=lengthSq?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSq)):0;
  return Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t);
}

function segmentMeetsRect(a,b,rect) {
  let from=0,to=1;
  for(const axis of ['x','y']) {
    const delta=b[axis]-a[axis],min=rect[`${axis}Min`],max=rect[`${axis}Max`];
    if(Math.abs(delta)<1e-8){if(a[axis]<min||a[axis]>max)return false;continue;}
    const first=(min-a[axis])/delta,last=(max-a[axis])/delta;
    from=Math.max(from,Math.min(first,last));to=Math.min(to,Math.max(first,last));
    if(from>to)return false;
  }
  return true;
}

function segmentsMeet(a,b,c,d) {
  const ax=b.x-a.x,ay=b.y-a.y,bx=d.x-c.x,by=d.y-c.y,cx=c.x-a.x,cy=c.y-a.y,denominator=ax*by-ay*bx;
  if(Math.abs(denominator)<1e-8)return Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b))<.2;
  const t=(cx*by-cy*bx)/denominator,s=(cx*ay-cy*ax)/denominator;
  return t>=0&&t<=1&&s>=0&&s<=1;
}

function pathSegments(path) {return path.slice(1).map((point,index)=>[path[index],point]);}

/** 在同一局部孔口平面找最短直线/单折线；避让印字、其他孔和已放引线，不挪孔。 */
function machiningLeader(rect,radius,blocked,mouths,leaders) {
  const center={x:(rect.xMin+rect.xMax)/2,y:(rect.yMin+rect.yMax)/2};
  const anchors=[{x:Math.max(rect.xMin,Math.min(rect.xMax,0)),y:Math.max(rect.yMin,Math.min(rect.yMax,0))},
    {x:rect.xMin,y:center.y},{x:rect.xMax,y:center.y},{x:center.x,y:rect.yMin},{x:center.x,y:rect.yMax}];
  anchors.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));
  const ownRect={xMin:rect.xMin-.06,xMax:rect.xMax+.06,yMin:rect.yMin-.06,yMax:rect.yMax+.06},routes=[];
  for(const anchor of anchors.slice(0,3)) {
    const outward=new THREE.Vector2(anchor.x<=rect.xMin+1e-6?-1:anchor.x>=rect.xMax-1e-6?1:0,
      anchor.y<=rect.yMin+1e-6?-1:anchor.y>=rect.yMax-1e-6?1:0).normalize();
    const start={x:anchor.x+outward.x*.35,y:anchor.y+outward.y*.35};
    const bends=[null,{x:start.x,y:0},{x:0,y:start.y},{x:start.x,y:Math.sign(start.y)*(radius+2)},{x:Math.sign(start.x)*(radius+2),y:start.y}];
    for(const bend of bends) {
      const tail=bend||start,distance=Math.hypot(tail.x,tail.y);
      if(distance<=radius+.4)continue;
      const tip={x:tail.x/distance*(radius+.18),y:tail.y/distance*(radius+.18)};
      const path=(bend?[start,bend,tip]:[start,tip]).filter((point,index,points)=>!index||Math.hypot(point.x-points[index-1].x,point.y-points[index-1].y)>.05);
      const segments=pathSegments(path);
      if(!segments.length||segments.some(([a,b])=>segmentMeetsRect(a,b,ownRect)||blocked.some(other=>segmentMeetsRect(a,b,other))||
        mouths.some(hole=>Math.hypot(hole.x,hole.y)>.001&&segmentDistance(hole,a,b)<hole.radius)||
        leaders.some(leader=>pathSegments(leader).some(([c,d])=>segmentsMeet(a,b,c,d)))))continue;
      const length=segments.reduce((sum,[a,b])=>sum+Math.hypot(b.x-a.x,b.y-a.y),0);
      if(length>45)continue;
      // 箭头两短边同样不得指进相邻孔或划过其他文字。
      const last=path.at(-2),dx=last.x-tip.x,dy=last.y-tip.y,d=Math.hypot(dx,dy),arrowLength=Math.min(1.2,length*.55);
      const arrow=[-1,1].map(sign=>({x:tip.x+dx/d*arrowLength-dy/d*arrowLength*.45*sign,y:tip.y+dy/d*arrowLength+dx/d*arrowLength*.45*sign}));
      if(arrow.some(end=>blocked.some(other=>segmentMeetsRect(tip,end,other))||segmentMeetsRect(tip,end,ownRect)||
        mouths.some(hole=>Math.hypot(hole.x,hole.y)>.001&&segmentDistance(hole,tip,end)<hole.radius)||
        leaders.some(leader=>pathSegments(leader).some(([a,b])=>segmentsMeet(tip,end,a,b)))))continue;
      routes.push({path,arrow,score:length+(bend?1:0)});
    }
  }
  routes.sort((a,b)=>a.score-b.score);
  return routes[0]||null;
}

/** 在孔旁搜索短距离内的完整材料带；坐标、孔口和已放印字均不挪动。 */
function buildMachiningSurfaceGeometry(triangles,entry,aspect,occupied,holes) {
  const {point,normal}=entry.pose,u=entry.direction.clone().addScaledVector(normal,-entry.direction.dot(normal));
  if(u.lengthSq()<1e-8)return null;
  u.normalize();const v=normal.clone().cross(u).normalize();
  const surface=[];
  for(const triangle of triangles) {
    if(triangle.some(vertex=>Math.abs(vertex.clone().sub(point).dot(normal))>.04))continue;
    if(triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize().dot(normal)<.999)continue;
    surface.push(triangle.map(vertex=>{const delta=vertex.clone().sub(point);return new THREE.Vector3(delta.dot(u),delta.dot(v),delta.dot(normal));}));
  }
  if(!surface.length)return null;
  const projected=corner=>{const delta=corner.clone().sub(point);return {x:delta.dot(u),y:delta.dot(v)};};
  const neighbors=occupied.filter(patch=>patch.normal.dot(normal)>.999&&Math.abs(patch.corners[0].clone().sub(point).dot(normal))<.04);
  const blocked=neighbors.map(patch=>{
    const corners=patch.corners.map(projected);
    return {xMin:Math.min(...corners.map(p=>p.x))-.8,xMax:Math.max(...corners.map(p=>p.x))+.8,yMin:Math.min(...corners.map(p=>p.y))-.8,yMax:Math.max(...corners.map(p=>p.y))+.8};
  });
  const leaders=neighbors.flatMap(patch=>patch.leaderPaths||[]).map(path=>path.map(projected));
  const mouths=holes.filter(hole=>hole.pose.normal.dot(normal)>.999&&Math.abs(hole.pose.point.clone().sub(point).dot(normal))<.04).map(hole=>({...projected(hole.pose.point),radius:hole.size.radius+1}));
  const heightMm=MACHINING_TEXT_HEIGHT_MM/FONT_RATIO,widthMm=heightMm*aspect,reach=Math.min(45,Math.max(18,entry.size.radius+widthMm*.65+3)),candidates=[];
  let minX=Infinity,maxX=-Infinity;
  for(const triangle of surface)for(const p of triangle){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);}
  const centerLimit=(minX+maxX)/2;
  const stations=[0,entry.size.radius+widthMm/2+1.5,-entry.size.radius-widthMm/2-1.5,Math.max(minX+widthMm/2+.5,Math.min(maxX-widthMm/2-.5,0)),centerLimit];
  for(const x of [...new Set(stations)]) {
    if(Math.abs(x)>reach)continue;
    for(const strip of materialStrips(surface,x)) {
      const height=Math.min(heightMm,(strip[1]-strip[0])*.8);
      if(height*FONT_RATIO<1.5)continue;
      const width=height*aspect;
      for(const y of [...new Set([(strip[0]+strip[1])/2,strip[0]+height/2+.2,strip[1]-height/2-.2])]) {
        const rect={xMin:x-width/2,xMax:x+width/2,yMin:y-height/2,yMax:y+height/2};
        if(blocked.some(other=>rect.xMin<other.xMax&&rect.xMax>other.xMin&&rect.yMin<other.yMax&&rect.yMax>other.yMin))continue;
        if(mouths.some(hole=>Math.hypot(Math.max(rect.xMin-hole.x,0,hole.x-rect.xMax),Math.max(rect.yMin-hole.y,0,hole.y-rect.yMax))<hole.radius))continue;
        if(leaders.some(path=>pathSegments(path).some(([a,b])=>segmentMeetsRect(a,b,rect))))continue;
        const polygons=clippedPrint(surface,rect);
        if(!polygons)continue;
        const leader=machiningLeader(rect,entry.size.radius,blocked,mouths,leaders);
        if(leader)candidates.push({rect,polygons,height,width,leader,score:leader.score+Math.hypot(x,y)*.25+(heightMm-height)*8});
      }
    }
  }
  candidates.sort((a,b)=>a.score-b.score);
  const chosen=candidates[0];if(!chosen)return null;
  const {rect,polygons,height,width,leader}=chosen,positions=[],uvs=[],guides=[],local=p=>point.clone().addScaledVector(u,p.x).addScaledVector(v,p.y).addScaledVector(normal,p.z);
  for(const polygon of polygons)for(let i=1;i<polygon.length-1;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]]) {
    const vertex=local(p);positions.push(vertex.x,vertex.y,vertex.z);uvs.push((p.x-rect.xMin)/width,(p.y-rect.yMin)/height);guides.push(0);
  }
  const plane=surface[0][0].z,corners=[[rect.xMin,rect.yMin],[rect.xMax,rect.yMin],[rect.xMax,rect.yMax],[rect.xMin,rect.yMax]].map(([x,y])=>local(new THREE.Vector3(x,y,plane)));
  // 引线是深度受限的细注释笔画，不是补槽/封孔材料；和文字共用一次绘制及可见性。
  const stroke=(a,b,type=1)=>{
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.001)return;
    const px=-dy/length*MACHINING_LEADER_WIDTH_MM/2,py=dx/length*MACHINING_LEADER_WIDTH_MM/2;
    const quad=[{x:a.x-px,y:a.y-py},{x:b.x-px,y:b.y-py},{x:b.x+px,y:b.y+py},{x:a.x+px,y:a.y+py}];
    for(const index of [0,1,2,0,2,3]) {
      const vertex=local({...quad[index],z:0});positions.push(vertex.x,vertex.y,vertex.z);uvs.push(0,0);guides.push(type);
    }
  };
  for(const [a,b] of pathSegments(leader.path))stroke(a,b);
  for(const end of leader.arrow)stroke(leader.path.at(-1),end);
  const rim=[];
  for(let i=0;i<48;i++){const angle=i*Math.PI*2/48;rim.push({x:Math.cos(angle)*(entry.size.radius+.18),y:Math.sin(angle)*(entry.size.radius+.18)});}
  for(let i=0;i<rim.length;i++)stroke(rim[i],rim[(i+1)%rim.length],2);
  const toLocal=p=>local({...p,z:0}),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('stampGuide',new THREE.Float32BufferAttribute(guides,1));geometry.computeVertexNormals();
  geometry.userData.numberPatches=[{face:entry.id,corners,normal:normal.clone(),height,width,start:0,count:positions.length/3,
    leaderPaths:[leader.path,...leader.arrow.map(end=>[leader.path.at(-1),end])].map(path=>path.map(toLocal))}];
  geometry.userData.holeLink={point:point.clone(),normal:normal.clone(),rim:rim.map(toLocal)};
  return geometry;
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
  return {texture,lightInk,aspect:width/96,layouts:[{aspect:width/96,fontRatio:FONT_RATIO}]};
}

/** 用真实表面UV随型材缩放；镜头仅选可见面并翻正文字，不控制字号。 */
function textMaterial(texture,lightInk) {
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,toneMapped:false});
  const faces=Array.from({length:FACES.length},()=>new THREE.Vector2());
  material.userData.stampFaces=faces;
  const focused={value:0};material.userData.stampFocused=focused;
  material.onBeforeCompile=shader=>{
    shader.uniforms.stampFaces={value:faces};
    shader.uniforms.stampFocused=focused;
    shader.uniforms.stampGuideColor={value:new THREE.Color(lightInk?0xd0dce5:0x485e6a)};
    shader.uniforms.stampFocusColor={value:new THREE.Color(0xd98512)};
    shader.vertexShader='attribute float stampPatch;\nattribute float stampGuide;\nuniform vec2 stampFaces[4];\nvarying float vStampVisible;\nvarying float vStampGuide;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vec2 stampFace=stampFaces[int(stampPatch+0.5)];vStampVisible=stampFace.x;vStampGuide=stampGuide;
      #ifdef USE_MAP
        // 同时反转两个UV方向，只翻正阅读方向，不镜像或改变实际印字尺寸。
        if(stampFace.y>0.5)vMapUv=vec2(1.0)-vMapUv;
      #endif`);
    shader.fragmentShader='varying float vStampVisible;\nvarying float vStampGuide;\nuniform float stampFocused;\nuniform vec3 stampGuideColor;\nuniform vec3 stampFocusColor;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`if(vStampVisible<0.5)discard;
      if(vStampGuide>0.5) {
        if(vStampGuide>1.5&&stampFocused<0.5)discard;
        diffuseColor=vec4(mix(stampGuideColor,stampFocusColor,stampFocused),mix(0.82,1.0,stampFocused));
      } else {
        #include <map_fragment>
        if(stampFocused>0.5)diffuseColor.rgb=mix(diffuseColor.rgb,stampFocusColor,0.88);
      }`);
  };
  material.customProgramCacheKey=()=> `profile-surface-text-world-v2-${lightInk?'light':'dark'}`;
  return material;
}

function materialObject(object) {
  for(let parent=object;parent;parent=parent.parent)if(parent.name?.startsWith('__')||parent.userData?.surfaceFeedback)return false;
  return true;
}

function physicallyVisible(object) {
  if(!materialObject(object))return false;
  for(let parent=object;parent;parent=parent.parent)if(parent.visible===false)return false;
  return true;
}

function insidePolygon(point,polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
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
    this.machiningRecords=new Map();
    this.viewport=new THREE.Vector2();
    this.meshes=[];this.occluders=[];this.occlusionState=new Map();this.occlusionRevision=0;this.renderFrame=-1;
    this.occlusionRay=new THREE.Raycaster();
    this.focusedRecord=null;
    this.hoverState=null;
  }

  refresh(meshes,enabled=true,{showMachiningSurface=false,occludingRoots=[]}={}) {
    this.clearHover();
    this.meshes=[...new Set([...meshes,...occludingRoots])];this.occluders=[];this.occlusionState.clear();this.occlusionRevision++;this.renderFrame=-1;
    // 隐藏实体仍在遮挡快照中，重新显示时不要求先重建印字。
    for(const root of this.meshes)root.traverse(object=>{if(object.isMesh&&object.geometry?.attributes.position&&materialObject(object))this.occluders.push(object);});
    const active=new Set(enabled?meshes.filter(mesh=>mesh.visible!==false&&mesh.userData?.part?.type==='PROFILE'):[]);
    for(const [root,record] of this.records)if(!active.has(root)){this.release(record);this.records.delete(root);}
    for(const root of active) {
      const part=root.userData.part,label=profileSurfaceLabel(part),keys=[label.text,String(part.color||'')];
      root.updateWorldMatrix(true,true);
      // 纯世界随动由stamp矩阵承担，不因root变换重造表面印字。
      root.traverse(object=>{if(object.isMesh&&physicallyVisible(object))keys.push(`${object.geometry?.uuid}:${object.geometry?.attributes.position?.version}:${object===root?'root':object.matrix.elements.join(',')}`);});
      const key=keys.join('|'),existing=this.records.get(root);
      if(existing?.key===key)continue;
      if(existing){this.release(existing);this.records.delete(root);}
      if(!part.displayId)continue;
      const color=new THREE.Color(part.color||0xd3d7db),ink=textureFor(label,Math.max(color.r,color.g,color.b)<.18);
      if(!ink)continue;
      const geometry=buildSurfaceNumberGeometry(root,ink.aspect);
      if(!geometry){ink.texture.dispose();continue;}
      this.records.set(root,this.createRecord(root,key,geometry,ink,'__profile_surface_number__'));
    }
    this.refreshMachining(meshes,showMachiningSurface,enabled);
    this.update();
  }

  createRecord(root,key,geometry,ink,name) {
    const patchIds=new Float32Array(geometry.attributes.position.count);
    geometry.userData.numberPatches.forEach((patch,index)=>patchIds.fill(index,patch.start,patch.start+patch.count));
    geometry.setAttribute('stampPatch',new THREE.Float32BufferAttribute(patchIds,1));
    if(!geometry.attributes.stampGuide)geometry.setAttribute('stampGuide',new THREE.Float32BufferAttribute(new Float32Array(patchIds.length),1));
    const stamp=new THREE.Mesh(geometry,textMaterial(ink.texture,ink.lightInk));stamp.name=name;stamp.userData.appearanceOnly=true;
    stamp.renderOrder=1550;stamp.matrixAutoUpdate=false;stamp.frustumCulled=false;stamp.raycast=()=>{};this.group.add(stamp);
    const record={key,root,stamp,texture:ink.texture,layouts:ink.layouts,viewWorld:new THREE.Matrix4(),projection:new THREE.Matrix4(),modelWorld:new THREE.Matrix4(),width:0,height:0,occlusionRevision:-1,face:null,hoverShape:null};
    stamp.onBeforeRender=(renderer,_scene,camera)=>{
      this.prepareOcclusion(renderer);stamp.matrix.copy(root.matrixWorld);stamp.updateMatrixWorld(true);
      renderer.getSize(this.viewport);this.orient(record,camera,this.viewport.x,this.viewport.y);
    };
    return record;
  }

  refreshMachining(meshes,enabled,showNumbers) {
    const active=new Set(enabled?meshes.filter(root=>root.userData?.part?.type==='PROFILE'&&physicallyVisible(root)):[]);
    for(const [root,job] of this.machiningRecords)if(!active.has(root)) {
      for(const record of job.stamps)this.release(record);
      this.machiningRecords.delete(root);
    }
    for(const root of active) {
      const part=root.userData.part,entries=machiningSurfaceEntries(part),keys=[String(part.color||''),String(showNumbers),this.records.get(root)?.key||''];
      root.updateWorldMatrix(true,true);
      root.traverse(object=>{if(object.isMesh&&physicallyVisible(object))keys.push(`${object.geometry?.uuid}:${object.geometry?.attributes.position?.version}:${object===root?'root':object.matrix.elements.join(',')}`);});
      for(const entry of entries)keys.push(`${entry.id}:${entry.text}:${entry.size.radius}:${entry.pose.point.toArray()}:${entry.pose.normal.toArray()}:${entry.direction.toArray()}`);
      const key=keys.join('|'),previous=this.machiningRecords.get(root);
      if(previous?.key===key)continue;
      if(previous)for(const record of previous.stamps)this.release(record);
      const stamps=[],occupied=[...(this.records.get(root)?.stamp.geometry.userData.numberPatches||[])];
      const color=new THREE.Color(part.color||0xd3d7db),lightInk=Math.max(color.r,color.g,color.b)<.18;
      const triangles=entries.length?materialTriangles(root):[];
      for(const entry of entries)for(const text of [entry.text,entry.shortText]) {
        const ink=textureFor({text},lightInk);if(!ink)break;
        const geometry=buildMachiningSurfaceGeometry(triangles,entry,ink.aspect,occupied,entries);
        if(!geometry){ink.texture.dispose();continue;}
        occupied.push(...geometry.userData.numberPatches);
        stamps.push(this.createRecord(root,entry.id,geometry,ink,'__machining_surface_text__'));break;
      }
      this.machiningRecords.set(root,{key,stamps});
    }
  }

  *allRecords() {
    yield* this.records.values();
    for(const job of this.machiningRecords.values())yield* job.stamps;
  }

  update() {
    for(const {root,stamp} of this.allRecords()) {
      stamp.visible=physicallyVisible(root)&&!!root.parent;
      if(!stamp.visible)continue;
      root.updateWorldMatrix(true,false);stamp.matrix.copy(root.matrixWorld);stamp.matrixWorldNeedsUpdate=true;
    }
  }

  clearHover() {
    if(this.focusedRecord)this.focusedRecord.stamp.material.userData.stampFocused.value=0;
    this.focusedRecord=null;
    this.hoverState=null;
  }

  /** 只用本帧已可见的印字/孔口投影作悬停反馈，不加入拾取实体或修改选择。 */
  updateHover(pointer,camera,width,height) {
    if(!pointer){this.clearHover();return;}
    const previous=this.hoverState;
    if(previous&&previous.x===pointer.x&&previous.y===pointer.y&&previous.width===width&&previous.height===height&&previous.revision===this.occlusionRevision&&
      previous.viewWorld.equals(camera.matrixWorld)&&previous.projection.equals(camera.projectionMatrix))return;
    const candidates=[],ndc=new THREE.Vector2(pointer.x/width*2-1,1-pointer.y/height*2);
    for(const job of this.machiningRecords.values())for(const record of job.stamps) {
      const shape=record.hoverShape;
      if(!shape||!record.stamp.visible||!physicallyVisible(record.root)||!record.root.parent||record.width!==width||record.height!==height||
        !record.viewWorld.equals(camera.matrixWorld)||!record.projection.equals(camera.projectionMatrix)||!record.modelWorld.equals(record.root.matrixWorld))continue;
      const onText=insidePolygon(pointer,shape.text),onHole=insidePolygon(pointer,shape.rim);
      if(!onText&&!onHole)continue;
      candidates.push({record,origin:onText?shape.textOrigin:shape.holeOrigin,normal:shape.normal,
        score:(onText?0:1e6)+Math.hypot(pointer.x-shape.center.x,pointer.y-shape.center.y)});
    }
    candidates.sort((a,b)=>a.score-b.score);
    let chosen=null;
    for(const candidate of candidates) {
      // 字/孔心可见不代表其整片区域无遮挡；再核对指针处的实际前方实体。
      this.occlusionRay.setFromCamera(ndc,camera);
      const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(candidate.normal,candidate.origin),point=this.occlusionRay.ray.intersectPlane(plane,new THREE.Vector3());
      if(point&&this.anchorVisible(point,point.clone().project(camera),camera)){chosen=candidate.record;break;}
    }
    if(chosen!==this.focusedRecord) {
      this.clearHover();
      if(chosen){chosen.stamp.material.userData.stampFocused.value=1;this.focusedRecord=chosen;}
    }
    this.hoverState={x:pointer.x,y:pointer.y,width,height,revision:this.occlusionRevision,viewWorld:camera.matrixWorld.clone(),projection:camera.projectionMatrix.clone()};
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
    record.hoverShape=null;
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
      if(rect)candidates.push({index,face:patch.face,center,projected,worldCorners,flip:sign<0,score:Math.max(rect.readability,.001)*(.6+.4*facing)});
    }
    candidates.sort((a,b)=>b.score-a.score);
    // 相邻面的可读性相近时沿用当前面，防止微小转动造成两份文字反复跳换。
    const previous=candidates.find(candidate=>candidate.face===record.face);
    if(previous&&previous.score>=candidates[0].score*.85)candidates.splice(0,0,...candidates.splice(candidates.indexOf(previous),1));
    if(!candidates.length){record.face=null;return;}
    const link=stamp.geometry.userData.holeLink,holePoint=link?.point.clone().applyMatrix4(stamp.matrixWorld);
    if(holePoint&&!this.anchorVisible(holePoint,holePoint.clone().project(camera),camera)){record.face=null;return;}
    const chosen=candidates.find(candidate=>this.anchorVisible(candidate.center,candidate.projected,camera));
    if(!chosen){record.face=null;return;}
    record.face=chosen.face;
    faces[chosen.index].set(1,chosen.flip?1:0);
    if(link) {
      const toScreen=world=>{const p=world.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};};
      const rim=link.rim.map(point=>toScreen(point.clone().applyMatrix4(stamp.matrixWorld)));
      if(rim.every(p=>[p.x,p.y,p.z].every(Number.isFinite)&&p.z>=-1&&p.z<=1))record.hoverShape={text:chosen.worldCorners.map(toScreen),rim,
        center:toScreen(chosen.center),textOrigin:chosen.worldCorners[0],holeOrigin:holePoint,normal:link.normal.clone().applyMatrix3(normalMatrix).normalize()};
    }
  }

  release(record) {
    if(this.focusedRecord===record)this.clearHover();
    record.stamp.removeFromParent();record.stamp.geometry.dispose();record.stamp.material.dispose();
    record.texture.dispose();
  }

  dispose() {
    for(const record of this.allRecords())this.release(record);
    this.records.clear();this.machiningRecords.clear();this.occlusionState.clear();this.occluders=[];this.meshes=[];this.group.removeFromParent();
  }
}
