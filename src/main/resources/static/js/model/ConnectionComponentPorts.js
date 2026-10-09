/** 本地设计角码的孔位/腿尺寸单一事实；几何和安装共同使用，不代表供应商制造图。 */
export function angleBracketLayout(dimensions={}) {
  const kind=dimensions.geometryKind,s=Number(dimensions.size||20),t=Number(dimensions.thickness||Math.max(2,s*.12));
  if(!['L_BRACKET','ANGLE_BRACKET','CORNER_CUBE','HEAVY_CORNER'].includes(kind)||Math.abs(Number(dimensions.angle||90)-90)>.01)return null;
  const width=kind==='L_BRACKET'?s*.45:Math.max(s,Number(dimensions.height||s));
  const depth=kind==='HEAVY_CORNER'?Number(dimensions.length||80):s,height=kind==='HEAVY_CORNER'?depth:s;
  // 长截面的两列孔按系列节距；不能另用外观比例 w*.22 推测安装孔心。
  const pitch=width>=s*2-.01?s:width*.44;
  const baseOffsets=kind==='HEAVY_CORNER'||Number(dimensions.holeCount)<3?[0]:[-pitch/2,pitch/2];
  const targetOffsets=kind!=='HEAVY_CORNER'&&Number(dimensions.holeCount)===4?[-pitch/2,pitch/2]:[0];
  const station=kind==='HEAVY_CORNER'?.85:.5;
  return {width,depth,height,thickness:t,radius:s*.12,baseOffsets,targetOffsets,
    sourcePorts:baseOffsets.map((offset,index)=>({id:`BASE-${index+1}`,point:[offset,0,depth*station]})),
    targetPorts:targetOffsets.map((offset,index)=>({id:`UPRIGHT-${index+1}`,point:[offset,height*station,-t/2]}))};
}

/** 参考角槽件的窄颈、宽脚和两条腿；宽脚适配本项目槽腔，不冒充供应商采购尺寸。 */
export function hiddenCornerDimensions(size) {
  const series=Number(size);
  if(![30,40].includes(series))return null;
  return {geometryKind:'HIDDEN_CORNER',hiddenGeometryVersion:2,size:series,width:13.2,neckWidth:7.6,
    height:series===30?31:32,length:38,thickness:series===30?7.2:8,slotWidth:8,recess:.25,
    shoulderDepth:series===30?2.05:2.65,bevel:.4,sourceHoleStation:25,targetHoleStation:22,
    holeRadius:3.05,holeCount:2,angle:90};
}

/** 仅更正当前Schema62上一版的已知薄板参数，不转换历史Schema或任意自定义件。 */
export function normalizeHiddenCornerDimensions(dimensions={}) {
  const size=Number(dimensions.size);
  if(dimensions.geometryKind==='HIDDEN_CORNER'&&dimensions.hiddenGeometryVersion==null&&[30,40].includes(size)
    &&Number(dimensions.width)===6&&Number(dimensions.thickness)===4&&Number(dimensions.recess)===2
    &&Number(dimensions.length)===(size===30?20:24)&&Number(dimensions.holeRadius)===1.7
    &&Number(dimensions.slotWidth)===8&&Number(dimensions.holeCount)===2&&Number(dimensions.angle)===90){
    return {...dimensions,...hiddenCornerDimensions(size)};
  }
  return dimensions;
}

/** +Z横腿入梁，+Y立腿沿目标槽；两面交线为原点，孔心始终在各自宿主安装面。 */
export function hiddenCornerLayout(dimensions={}) {
  const d=normalizeHiddenCornerDimensions(dimensions);
  if(d.geometryKind!=='HIDDEN_CORNER'||d.hiddenGeometryVersion!==2||![30,40].includes(Number(d.size)))return null;
  const width=Number(d.width),neck=Number(d.neckWidth),depth=Number(d.thickness),recess=Number(d.recess);
  const shoulder=Number(d.shoulderDepth),bevel=Number(d.bevel),radius=Number(d.holeRadius);
  const sourceLength=Number(d.length)-depth,targetLength=Number(d.height)-depth;
  const sourceHole=Number(d.sourceHoleStation)-depth,targetHole=Number(d.targetHoleStation)-depth;
  if(![width,neck,depth,recess,shoulder,bevel,radius,sourceLength,targetLength,sourceHole,targetHole].every(value=>Number.isFinite(value)&&value>0)
    ||Number(d.slotWidth)!==8||neck>=8||width<=neck||radius>=neck/2||shoulder<=recess||depth<=shoulder+2*bevel
    ||bevel>=(width-neck)/2||sourceHole+radius>=sourceLength||targetHole+radius>=targetLength
    ||sourceHole<=radius||targetHole<=radius||Number(d.holeCount)!==2||!(Math.abs(Number(d.angle)-90)<=.01))return null;
  const n=neck/2,w=width/2;
  // 与真实几何相同的T形轮廓；不能再用跨过槽唇的矩形包络判定宿主空腔。
  const crossSection=[[-n,-recess],[n,-recess],[n,-shoulder],[w-bevel,-shoulder],[w,-shoulder-bevel],
    [w,-depth+bevel],[n,-depth],[-n,-depth],[-w,-depth+bevel],[-w,-shoulder-bevel],[-w+bevel,-shoulder],[-n,-shoulder]];
  const heel=[[-n,-depth],[n,-depth],[n,0],[-n,0]];
  return {width,neck,depth,recess,shoulder,bevel,radius,sourceLength,targetLength,sourceHole,targetHole,crossSection,
    sourcePorts:[{id:'SOURCE-SLOT',point:[0,0,sourceHole]}],targetPorts:[{id:'TARGET-SLOT',point:[0,targetHole,0]}],
    supports:[{host:'SOURCE',contour:crossSection.map(([x,y])=>[x,y,0]),direction:[0,0,1],length:sourceLength},
      {host:'TARGET',contour:crossSection.map(([x,z])=>[x,0,z]),direction:[0,1,0],length:targetLength},
      {host:'TARGET',contour:heel.map(([x,z])=>[x,-depth,z]),direction:[0,1,0],length:depth}]};
}
