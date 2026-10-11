// 板材局部毫米轮廓运算；只处理二维简单闭环，不保存/导出 Three.js 三角网格。
const EPS=1e-5;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const at=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const key=p=>Math.round(p.x/EPS)+','+Math.round(p.y/EPS);
const length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);

export function contourArea(ring){return ring.reduce((sum,p,i)=>sum+cross(p,ring[(i+1)%ring.length]),0)/2;}
export function contourBounds(ring){return {minX:Math.min(...ring.map(p=>p.x)),maxX:Math.max(...ring.map(p=>p.x)),minY:Math.min(...ring.map(p=>p.y)),maxY:Math.max(...ring.map(p=>p.y))};}
export function insideContour(point,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}

export function cleanContour(points){
  const ring=[];
  for(const p of points)if(!ring.length||key(p)!==key(ring[ring.length-1]))ring.push({x:Number(p.x),y:Number(p.y)});
  if(ring.length>1&&key(ring[0])===key(ring[ring.length-1]))ring.pop();
  let changed=true;
  while(changed&&ring.length>=3){
    changed=false;
    for(let i=0;i<ring.length;i++){
      const a=ring[(i+ring.length-1)%ring.length],p=ring[i],b=ring[(i+1)%ring.length];
      if(Math.abs(cross(sub(p,a),sub(b,a)))<=EPS*length(a,b)&&((p.x-a.x)*(p.x-b.x)+(p.y-a.y)*(p.y-b.y))<=EPS){ring.splice(i,1);changed=true;break;}
    }
  }
  return ring;
}

/** 新轮廓必须简单；零宽相接、自交不能作为可加工的一块板。 */
export function assertSimpleContour(ring){
  if(ring.length<3||ring.some((p,i)=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||length(p,ring[(i+1)%ring.length])<EPS)||Math.abs(contourArea(ring))<EPS)throw new Error('缺口轮廓无效');
  for(let i=0;i<ring.length;i++)for(let j=i+1;j<ring.length;j++){
    if(j===i+1||i===0&&j===ring.length-1)continue;
    const a=ring[i],b=ring[(i+1)%ring.length],c=ring[j],d=ring[(j+1)%ring.length];
    if(segmentTouches(a,b,c,d))throw new Error('缺口轮廓自交或相接形成零宽材料');
  }
}

function segmentTouches(a,b,c,d){
  const r=sub(b,a),s=sub(d,c),q=sub(c,a),den=cross(r,s);
  if(Math.abs(den)>EPS*EPS){const t=cross(q,s)/den,u=cross(q,r)/den;return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS;}
  if(Math.abs(cross(q,r))>EPS*length(a,b))return false;
  const rr=r.x*r.x+r.y*r.y,t=(q.x*r.x+q.y*r.y)/rr,v=sub(d,a),u=(v.x*r.x+v.y*r.y)/rr;
  return Math.max(Math.min(t,u),0)<=Math.min(Math.max(t,u),1)+EPS;
}

/**
 * 分割相交/重合线段后，仅保留左右材料归属不同的边，材料永远在有向边左侧。
 * 因而不会把孔口/三角剖分的内部边当切割边，也不会把多个缺口并成大包围矩形。
 */
function boundaries(rings,contains){
  const segments=[],unique=new Map();
  for(const ring of rings)for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];if(length(a,b)<=EPS)continue;
    const ka=key(a),kb=key(b),id=ka<kb?ka+'|'+kb:kb+'|'+ka;
    if(unique.has(id))continue;
    const segment={a,b,cuts:[0,1],bounds:contourBounds([a,b])};unique.set(id,segment);segments.push(segment);
  }
  if(segments.length>6000)throw new Error('连接件轮廓过密，请先简化型号或分次裁剪');
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    const a=segments[i],b=segments[j],A=a.bounds,B=b.bounds;
    if(A.maxX<B.minX-EPS||B.maxX<A.minX-EPS||A.maxY<B.minY-EPS||B.maxY<A.minY-EPS)continue;
    const r=sub(a.b,a.a),s=sub(b.b,b.a),q=sub(b.a,a.a),den=cross(r,s);
    if(Math.abs(den)>EPS*EPS){
      const t=cross(q,s)/den,u=cross(q,r)/den;
      if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS){a.cuts.push(Math.max(0,Math.min(1,t)));b.cuts.push(Math.max(0,Math.min(1,u)));}
    }else if(Math.abs(cross(q,r))<=EPS*length(a.a,a.b)){
      for(const [edge,points] of [[a,[b.a,b.b]],[b,[a.a,a.b]]]){
        const v=sub(edge.b,edge.a),vv=v.x*v.x+v.y*v.y;
        for(const p of points){const w=sub(p,edge.a),t=(w.x*v.x+w.y*v.y)/vv;if(t>0&&t<1)edge.cuts.push(t);}
      }
    }
  }
  const nodes=new Map(),edges=new Map();
  const node=p=>{const id=key(p);if(!nodes.has(id))nodes.set(id,p);return id;};
  for(const segment of segments){
    const cuts=[...new Set(segment.cuts)].sort((a,b)=>a-b);
    for(let i=0;i+1<cuts.length;i++){
      const a=at(segment.a,segment.b,cuts[i]),b=at(segment.a,segment.b,cuts[i+1]),len=length(a,b);
      if(len<EPS*2)continue;
      const mid=at(a,b,.5),offset=Math.min(.001,len*.01),nx=(a.y-b.y)/len*offset,ny=(b.x-a.x)/len*offset;
      const left=contains({x:mid.x+nx,y:mid.y+ny}),right=contains({x:mid.x-nx,y:mid.y-ny});
      if(left===right)continue;
      const start=node(left?a:b),end=node(left?b:a);if(start===end)continue;
      const previous=edges.get(start);
      if(previous&&previous!==end)throw new Error('裁剪轮廓形成零宽相接，请增大间隙或调整位置');
      edges.set(start,end);
    }
  }
  const result=[];
  while(edges.size){
    const start=edges.keys().next().value,ring=[];let current=start;
    do{ring.push(nodes.get(current));const next=edges.get(current);edges.delete(current);if(!next)throw new Error('裁剪轮廓未闭合，请调整间隙');current=next;}while(current!==start);
    const clean=cleanContour(ring);if(clean.length>=3&&Math.abs(contourArea(clean))>EPS)result.push(clean);
  }
  return result;
}

export function unionContours(polygons){
  const rings=polygons.map(cleanContour).filter(r=>r.length>=3&&Math.abs(contourArea(r))>EPS);
  const bounded=rings.map(ring=>({ring,b:contourBounds(ring)}));
  return boundaries(rings,p=>bounded.some(({ring,b})=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY&&insideContour(p,ring)));
}

export function subtractContours(outer,cutouts){
  const cuts=cutouts.map(ring=>({ring,b:contourBounds(ring)}));
  return boundaries([outer,...cutouts],p=>insideContour(p,outer)&&!cuts.some(({ring,b})=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY&&insideContour(p,ring)));
}

/** 以毫米间隙扩张真实轮廓；圆角采用外切采样，避免近似轮廓侵入所需间隙。 */
export function expandContour(ring,gap){
  if(gap<=0)return [ring];
  const pieces=[ring],count=16,radius=gap/Math.cos(Math.PI/count);
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],len=length(a,b),nx=(a.y-b.y)/len*gap,ny=(b.x-a.x)/len*gap;
    pieces.push([{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}]);
    pieces.push(Array.from({length:count},(_,j)=>({x:a.x+radius*Math.cos(j*2*Math.PI/count),y:a.y+radius*Math.sin(j*2*Math.PI/count)})));
  }
  return unionContours(pieces).filter(r=>contourArea(r)>0);
}

export function clipContourToRectangle(ring,w,h){
  const rectangle=[{x:-w,y:-h},{x:w,y:-h},{x:w,y:h},{x:-w,y:h}];
  return boundaries([ring,rectangle],p=>p.x>-w&&p.x<w&&p.y>-h&&p.y<h&&insideContour(p,ring)).filter(r=>contourArea(r)>0);
}
