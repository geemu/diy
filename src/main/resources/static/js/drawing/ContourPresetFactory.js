export const ContourPresetTypes=Object.freeze([
  {id:'L',label:'L 型',icon:'└'},
  {id:'U',label:'U 型',icon:'∪'},
  {id:'STAIR',label:'阶梯型',icon:'▟'}
]);

export function buildContourPreset(type,{widthMm=1000,depthMm=600,notchMm=300,plane='XZ',center={x:0,y:0,z:0}}={}){
  const width=Math.max(200,Number(widthMm||1000));
  const depth=Math.max(200,Number(depthMm||600));
  const notch=Math.min(Math.max(80,Number(notchMm||Math.min(width,depth)/3)),Math.min(width,depth)-80);
  const key=String(type||'L').toUpperCase();
  let points2d;
  if(key==='U'){
    const arm=Math.min(notch,width/2-40);
    const innerDepth=Math.min(notch,depth-80);
    points2d=[[0,0],[width,0],[width,depth],[width-arm,depth],[width-arm,innerDepth],[arm,innerDepth],[arm,depth],[0,depth]];
  }else if(key==='STAIR'){
    const x1=width/3,x2=width*2/3,y1=depth/3,y2=depth*2/3;
    points2d=[[0,0],[width,0],[width,y1],[x2,y1],[x2,y2],[x1,y2],[x1,depth],[0,depth]];
  }else{
    const cutX=Math.min(notch,width-80),cutY=Math.min(notch,depth-80);
    points2d=[[0,0],[width,0],[width,cutY],[cutX,cutY],[cutX,depth],[0,depth]];
  }
  const cx=width/2,cy=depth/2;
  return points2d.map(([u,v])=>toWorldPoint(u-cx,v-cy,plane,center));
}

function toWorldPoint(u,v,plane,center){
  const c={x:Number(center?.x||0),y:Number(center?.y||0),z:Number(center?.z||0)};
  if(plane==='XY')return{x:c.x+u,y:c.y+v,z:c.z};
  if(plane==='YZ')return{x:c.x,y:c.y+u,z:c.z+v};
  return{x:c.x+u,y:c.y,z:c.z+v};
}
