import * as THREE from 'three';

/**
 * 型材内槽的展示暗部：截面凸包内的凹槽越深越暗，圆弧外表面仍保持原色。
 * 只生成 vertex color，不移动顶点、不修改截面或制造尺寸；端面不应用凹槽估算。
 */
export function applyProfileSurfaceShading(geometry,section) {
  if(!section?.outer?.length)return;
  const points=section.outer.map(p=>({x:Number(p.x),y:Number(p.y)})).sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=list=>{
    const result=[];
    for(const point of list){while(result.length>1&&cross(result.at(-2),result.at(-1),point)<=0)result.pop();result.push(point);}
    return result;
  };
  const hull=half(points).slice(0,-1).concat(half([...points].reverse()).slice(0,-1));
  if(hull.length<3)return;
  const edges=hull.map((a,i)=>{const b=hull[(i+1)%hull.length];return {a,dx:b.x-a.x,dy:b.y-a.y,length:Math.hypot(b.x-a.x,b.y-a.y)};});
  const width=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
  const height=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
  const falloff=Math.max(.1,Math.min(width,height)*.085);
  const position=geometry.attributes.position,normal=geometry.attributes.normal;
  const colors=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++) {
    let shade=1;
    if(Math.abs(normal.getZ(i))<.9) {
      const x=position.getX(i),y=position.getY(i);
      const depth=Math.max(0,Math.min(...edges.map(e=>(e.dx*(y-e.a.y)-e.dy*(x-e.a.x))/e.length)));
      shade=.5+.5*Math.exp(-depth/falloff);
    }
    colors.set([shade,shade,shade],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
}
