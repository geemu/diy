import {getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';

/** 生成与回改共用同一布局，尺寸均为外尺寸。成员键不是构件 ID，增删层时保留其余构件身份。 */
export function layeredRackLayout(input={}) {
  const catalogId=input.catalogId||'DESIGN-3030',definition=getDesignProfileDefinition(catalogId);
  if(!definition)throw new Error('多层架型材型号不存在');
  const parameters={catalogId,width:Number(input.width??1000),depth:Number(input.depth??600),height:Number(input.height??1800),levels:Number(input.levels??4),centerBeamCount:Number(input.centerBeamCount??0),autoConnect:input.autoConnect!==false};
  const {width,depth,height,levels,centerBeamCount}=parameters,[sx,sy]=definition.sectionSize.map(Number);
  if(![width,depth,height].every(value=>Number.isFinite(value)&&value>0))throw new Error('框架宽、深、高必须是大于零的有效数值');
  if(!Number.isInteger(levels)||levels<2||levels>12||!Number.isInteger(centerBeamCount)||centerBeamCount<0||centerBeamCount>4)throw new Error('层数为2~12，每层中间承托梁为0~4根');
  if(width<=sx*2||depth<=sy*2)throw new Error('外形尺寸过小，无法容纳当前型材截面');
  if(height<sy*levels)throw new Error('高度不足以容纳这些层，横梁会重叠；请增加高度或减少层数');
  if(centerBeamCount&&(width-sx)/(centerBeamCount+1)<sx)throw new Error('宽度不足以容纳中间承托梁，请增加宽度或减少承托梁');
  const members=[],postX=(width-sx)/2,postZ=(depth-sy)/2;
  const add=(key,length,position,rotation,name)=>members.push({key,catalogId,length,position,rotation,name:name+' '+definition.name});
  for(const x of [-1,1])for(const z of [-1,1])add(`POST:${x}:${z}`,height,{x:x*postX,y:height/2,z:z*postZ},{x:-Math.PI/2,y:0,z:0},'多层架立柱');
  for(let level=0;level<levels;level++) {
    const y=sy/2+level*(height-sy)/(levels-1);
    for(const sign of [-1,1]) {
      add(`WIDTH:${level}:${sign}`,width-sx*2,{x:0,y,z:sign*postZ},{x:0,y:Math.PI/2,z:0},`第${level+1}层横梁`);
      add(`DEPTH:${level}:${sign}`,depth-sy*2,{x:sign*postX,y,z:0},{x:0,y:0,z:0},`第${level+1}层纵梁`);
    }
    for(let index=1;index<=centerBeamCount;index++)add(`CENTER:${level}:${index}`,depth-sy-sx,{x:-postX+index/(centerBeamCount+1)*postX*2,y,z:0},{x:0,y:0,z:0},`第${level+1}层中间承托梁${index}`);
  }
  return {parameters,members};
}
