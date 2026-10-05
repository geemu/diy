/** 板材/几何体的尺寸与轮廓事实源。单位 mm；薄板轮廓在 XY 面，厚度沿 Z。 */
export const PanelShapeFields = Object.freeze({
  rectangle:[['width','宽度 (mm)',400,1],['height','高度 (mm)',400,1],['thickness','厚度 (mm)',5,.1]],
  circle:[['diameter','直径 (mm)',400,1],['thickness','厚度 (mm)',5,.1]],
  ellipse:[['width','宽度 (mm)',400,1],['height','高度 (mm)',400,1],['thickness','厚度 (mm)',5,.1]],
  polygon:[['sides','边数',6,3,20],['radius','外接圆半径 (mm)',200,1],['thickness','厚度 (mm)',5,.1]],
  cross:[['width','总宽度 (mm)',400,10],['height','总高度 (mm)',400,10],['cutWidth','切角宽度 (mm)',100,1],['cutHeight','切角高度 (mm)',100,1],['thickness','厚度 (mm)',5,.1]],
  ring:[['outerDiameter','外径 (mm)',100,1],['innerDiameter','内径 (mm)',50,1],['thickness','厚度 (mm)',5,.1]],
  obround:[['radius','半径 R (mm)',50,1],['straightA','直线 A (mm)',100,0],['straightB','直线 B (mm)',0,0],['thickness','厚度 (mm)',5,.1]],
  sphere:[['radius','半径 (mm)',50,1],['segments','细分段数',32,3,64]],
  cylinder:[['topRadius','顶部半径 (mm)',25,0],['bottomRadius','底部半径 (mm)',25,0],['height','高度 (mm)',50,1],['segments','细分段数',32,3,64]],
  cone:[['bottomRadius','底部半径 (mm)',25,1],['height','高度 (mm)',50,1],['segments','细分段数',32,3,64]],
  torus:[['radius','圆环半径 (mm)',25,1],['tubeRadius','管道半径 (mm)',10,1],['radialSegments','径向细分',16,3,32],['tubularSegments','管状细分',100,3,200]]
});
export const SolidPanelShapes = ['sphere','cylinder','cone','torus'];
export function panelDefaults(shape) { return Object.fromEntries((PanelShapeFields[shape]||[]).map(([key,,value])=>[key,value])); }
export function panelDimensions(shape,parameters,edgeMode=false) {
  if(!PanelShapeFields[shape])throw new Error('未知板材形状');
  const p={...parameters};
  for(const [key,label,,min,max] of PanelShapeFields[shape]){
    p[key]=Number(p[key]);
    if(!Number.isFinite(p[key])||p[key]<min||(max&&p[key]>max))throw new Error(`${label} 必须在 ${min}${max?' 至 '+max:' 以上'} 范围内`);
    if(/Segments|segments|sides/.test(key)&&!Number.isInteger(p[key]))throw new Error(`${label} 必须为整数`);
  }
  if(shape==='polygon'&&edgeMode)p.radius=p.radius/(2*Math.sin(Math.PI/p.sides));
  if(shape==='cross'&&(p.cutWidth*2>=p.width||p.cutHeight*2>=p.height))throw new Error('切角尺寸必须小于对应总尺寸的一半');
  if(shape==='ring'&&p.innerDiameter>=p.outerDiameter)throw new Error('圆环内径必须小于外径');
  if(shape==='cylinder'&&p.topRadius+p.bottomRadius<=0)throw new Error('圆柱体至少一个半径必须大于 0');
  if(shape==='torus'&&p.tubeRadius>=p.radius)throw new Error('管道半径必须小于圆环半径');
  let width=p.width,height=p.height,thickness=p.thickness;
  if(shape==='circle')width=height=p.diameter;
  if(shape==='polygon'){const points=panelContours(shape,p).outer;width=Math.max(...points.map(x=>x.x))-Math.min(...points.map(x=>x.x));height=Math.max(...points.map(x=>x.y))-Math.min(...points.map(x=>x.y));}
  if(shape==='ring')width=height=p.outerDiameter;
  if(shape==='obround'){width=p.straightA+p.radius*2;height=p.straightB+p.radius*2;}
  if(shape==='sphere')width=height=thickness=p.radius*2;
  if(['cylinder','cone'].includes(shape)){width=thickness=Math.max(p.topRadius||0,p.bottomRadius)*2;height=p.height;}
  if(shape==='torus'){width=height=(p.radius+p.tubeRadius)*2;thickness=p.tubeRadius*2;}
  return {width,height,thickness,panelShape:shape,shapeParameters:p};
}
function ellipse(rx,ry,cx=0,cy=0,segments=64) { return Array.from({length:segments},(_,i)=>({x:cx+rx*Math.cos(i*2*Math.PI/segments),y:cy+ry*Math.sin(i*2*Math.PI/segments)})); }
export function panelContours(shape,p) {
  const point=(x,y)=>({x,y});let outer=[],holes=[];
  const w=p.width/2,h=p.height/2;
  if(shape==='rectangle')outer=[point(-w,-h),point(w,-h),point(w,h),point(-w,h)];
  if(shape==='circle')outer=ellipse(p.diameter/2,p.diameter/2);
  if(shape==='ellipse')outer=ellipse(w,h);
  if(shape==='polygon')outer=ellipse(p.radius,p.radius,0,0,p.sides);
  if(shape==='ring'){outer=ellipse(p.outerDiameter/2,p.outerDiameter/2);holes=[ellipse(p.innerDiameter/2,p.innerDiameter/2).reverse()];}
  if(shape==='cross'){const x=w-p.cutWidth,y=h-p.cutHeight;outer=[point(-x,-h),point(x,-h),point(x,-y),point(w,-y),point(w,y),point(x,y),point(x,h),point(-x,h),point(-x,y),point(-w,y),point(-w,-y),point(-x,-y)];}
  if(shape==='obround'){
    const a=p.straightA/2,b=p.straightB/2;
    for(const [cx,cy,start] of [[a,b,0],[-a,b,Math.PI/2],[-a,-b,Math.PI],[a,-b,Math.PI*1.5]])
      for(let i=0;i<=16;i++){const angle=start+i*Math.PI/32;outer.push(point(cx+p.radius*Math.cos(angle),cy+p.radius*Math.sin(angle)));}
  }
  return {outer,holes};
}

/** 工程图使用参数曲面采样点，禁止把球、圆锥或圆环体降格为盒子轮廓。 */
export function solidPanelPoints(shape,p) {
  const points=[];
  if(shape==='sphere')for(let j=0;j<=24;j++)for(let i=0;i<48;i++){
    const a=i*Math.PI/24,b=j*Math.PI/24;points.push({x:p.radius*Math.sin(b)*Math.cos(a),y:p.radius*Math.cos(b),z:p.radius*Math.sin(b)*Math.sin(a)});
  }
  if(shape==='cylinder'||shape==='cone')for(const [radius,y] of [[shape==='cone'?0:p.topRadius,p.height/2],[p.bottomRadius,-p.height/2]])for(let i=0;i<64;i++)points.push({x:radius*Math.cos(i*Math.PI/32),y,z:radius*Math.sin(i*Math.PI/32)});
  if(shape==='torus')for(let j=0;j<16;j++)for(let i=0;i<64;i++){
    const a=i*Math.PI/32,b=j*Math.PI/8,r=p.radius+p.tubeRadius*Math.cos(b);points.push({x:r*Math.cos(a),y:r*Math.sin(a),z:p.tubeRadius*Math.sin(b)});
  }
  return points;
}
