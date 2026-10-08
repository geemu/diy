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
