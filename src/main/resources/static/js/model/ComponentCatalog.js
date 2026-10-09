import {ComponentCatalogData as data} from './ComponentCatalogData.js';
import {hiddenCornerLayout,hiddenCornerDimensions} from './ConnectionComponentPorts.js';

/** 玩家组件目录：选项、规格与几何参数共用一份事实，预览与实际添加不得各自猜尺寸。 */
const category = name => data.categories[name];
// 隐藏角槽件与原目录的一字长条不是同一零件，不改写原始参照目录数据。
const hiddenCornerSpecs=[30,40].map(size=>({value:String(size),label:`${size}系列 · 槽8 · 隐藏角槽件`}));
export const ConnectionComponentOptions = [...category('连接').selects[0].options.filter(x=>!x.disabled),{value:'HIDDEN_CORNER',label:'内置角槽连接件'}];
export const ShaftComponentOptions = category('光轴').selects[0].options;
export const PanelShapeOptions = category('板材').selects[0].options;
export const AccessoryComponentOptions = category('配件').selects[0].options;
export const ProfileReferenceOptions = category('铝材').selects[0].options.map((x,index)=>({...x,id:profileId(x.label),index}));
export const ProfileClosureOptions = category('铝材').variants.find(x=>x.selects.length>1).selects[1].options;
export const FastenerHeadOptions = category('配件').variants.find(x=>x.selects[0].value==='FASTENING').selects[1].options;
export const FootCupOptions = category('配件').variants.find(x=>x.selects[0].value==='FOOT_CUP').selects[1].options;
export const SlideTypeOptions = category('配件').variants[0].selects[1].options;
export const SlideLengthOptions = category('配件').variants[0].selects[2].options;
export const EndCapMaterialOptions = category('配件').variants.find(x=>x.selects[0].value==='END_CAP').selects[1].options;
export const APillarLengthOptions = category('连接').variants.at(-1).selects[2].options;
export const APillarSideOptions = category('连接').variants.at(-1).selects[3].options;
export function profileId(label) { return label.includes('A柱')?'DESIGN-U88':`DESIGN-${label.replace('欧标','').replace('x','')}`; }
export function connectionSpecs(type) { return type==='HIDDEN_CORNER'?hiddenCornerSpecs:category('连接').variants.find(x=>x.selects[0].value===type)?.selects[1].options || []; }
/** 只有已有接头规则覆盖的组件才进入自动安装；不能把任意多向件当成直角角码。 */
export function connectionDesignType(definition,{savedRecord=false}={}) {
  const d=definition?.dimensions||{};
  if(Number(d.size)===15)return null;
  if(['L_BRACKET','ANGLE_BRACKET','CORNER_CUBE','HEAVY_CORNER'].includes(d.geometryKind)&&Math.abs(Number(d.angle||90)-90)<.01)return 'ANGLE_BRACKET';
  if(hiddenCornerLayout(d))return 'INTERNAL_CONNECTOR';
  // 当前Schema已有记录只保留其原模型/位置；长条不能再冒充隐藏直角件安装。
  if(d.geometryKind==='INNER_BRACKET'&&savedRecord)return 'INTERNAL_CONNECTOR';
  if(['FLAT_PLATE','T_PLATE','L_PLATE','CROSS_PLATE'].includes(d.geometryKind)&&Math.abs(Number(d.angle||90)-90)<.01)return 'CONNECTION_PLATE';
  return null;
}
/** 没有接头规则时必须显式选择自由放置，不能静默穿过模型落到工作面。 */
export function connectionPlacementMode(definition,free=false) {
  return free?'FREE':connectionDesignType(definition)?'JOINT':'UNSUPPORTED';
}
export function preferredConnectionSpec(type,series) {
  const choices=connectionSpecs(type).filter(option=>!option.disabled);
  const mapped=choices.filter(option=>connectionDesignType(connectionComponent({type,spec:option.value})));
  return (mapped.find(option=>Number(connectionComponent({type,spec:option.value}).dimensions.size)===Number(series))||mapped[0]||choices[0])?.value;
}
export function shaftDiametersFor(type) { return (category('光轴').variants.find(x=>x.selects[0].value===type)?.selects[1].options || []).map(x=>Number(x.value)); }
export function fastenerThreads(head) { return Object.keys(data.fasteners[head] || {}).map(Number); }
export function fastenerLengths(head,diameter) { return data.fasteners[head]?.[diameter] || []; }
export function closureFaces(value,profile=null) {
  // R 截面的圆弧侧天然无槽，封边从剩余两个可安装面起算，避免“一面封边”没有变化。
  const faces=profile?.shape==='ROUND_CORNER'?{A:'BACK',B:'LEFT',C:'FRONT',D:'RIGHT'}:{A:'FRONT',B:'RIGHT',C:'BACK',D:'LEFT'};
  return String(value||'').split('+').filter(Boolean).map(x=>faces[x]);
}

/** 此处尺寸描述通用设计几何，不是供应商料号或制造认证。 */
function definition(kind,label,dimensions,options={}) {
  const key=Object.entries(dimensions).map(([k,v])=>`${k}:${v}`).join('-');
  return {id:`DIY-${kind}-${key}`,label,model:label,accessoryType:options.accessoryType || 'CATALOG_COMPONENT',
    category:options.category || '连接件',source:'DIY_COMPONENT_CATALOG',material:options.material||'设计参考件',
    color:options.color||'#808080',note:'通用参数化设计模型；制造前核对实际尺寸和安装方案',
    dimensions:{geometryKind:kind,...dimensions},mountRule:options.mountRule||{target:'FREE'},...options};
}
export function connectionComponent(form) {
  if(form.type==='HIDDEN_CORNER'){
    const option=hiddenCornerSpecs.find(x=>x.value===String(form.spec))||hiddenCornerSpecs[0],size=Number(option.value);
    return definition('HIDDEN_CORNER',option.label,hiddenCornerDimensions(size),
      {color:'#a9adb2',note:'T槽窄颈宽脚、倒角与紧定螺钉设计参考；按本项目槽腔适配，不是采购尺寸或真实五金加工配置'});
  }
  const type=form.type,option=connectionSpecs(type).find(x=>x.value===String(form.spec)) || connectionSpecs(type)[0];
  const label=option?.label||'',numbers=label.match(/\d+/g)?.map(Number)||[20,20];
  const size=label.includes('A柱')?8:numbers[0];
  const p={size,width:size,height:numbers[1]||size,thickness:Math.max(2,size*.12),length:size,
    holeCount:label.includes('4孔')?4:label.includes('3孔')?3:(type==='ANGLE_BRACKET'&&numbers[1]>=size*2?4:2),angle:Number(label.match(/-(\d+)°/)?.[1]||90)};
  if(type==='HEAVY_CORNER')p.length=80;
  if(type==='SHELF_BRACKET')p.length=Number(label.match(/-(\d+)(?:\(|$)/)?.[1]||20);
  if(type==='PANEL_FIX_CONNECTOR'){p.size=p.width=p.height=numbers[0];p.rounded=label.startsWith('半圆');}
  if(type==='A_PILLAR_BRACKET'){p.length=Number(form.length||165);p.side=form.side||'right';}
  const name=ConnectionComponentOptions.find(x=>x.value===type)?.label||type;
  return definition(type,`${name} ${label}${type==='A_PILLAR_BRACKET'?` ${p.length}mm ${p.side==='left'?'左':'右'}`:''}`,p,{color:type==='L_BRACKET'?'#a30016':'#808080'});
}
export function shaftComponent(form) {
  const type=form.type,d=Number(form.diameter),name=ShaftComponentOptions.find(x=>x.value===type)?.label||type;
  const dimensions={size:d*2,diameter:d,secondDiameter:form.mixed?Number(form.secondDiameter):d,length:d*2,
    width:d*2,height:d*4,thickness:d*2,spacing:type.endsWith('_35')?35:type.endsWith('_40')?40:d*2};
  // 安装偏移必须使用实际主轴孔中心，不能让所有夹具沿用十字夹的偏移。
  dimensions.axisOffsetY=type.startsWith('PARALLEL')?dimensions.spacing/2:['VERTICAL_SK','HORIZONTAL_SHF','LIMIT_RING'].includes(type)?0:d;
  if(type.startsWith('PARALLEL'))dimensions.height=dimensions.spacing+d*2;
  if(type==='VERTICAL_SK')Object.assign(dimensions,{width:d*4,height:d*3.5,length:d*2,thickness:d*1.3});
  if(type==='HORIZONTAL_SHF')Object.assign(dimensions,{width:d*4,height:d*2,length:d*1.2,thickness:d*1.2});
  if(type==='LIMIT_RING')Object.assign(dimensions,{size:d*1.9,width:d*1.9,height:d*1.9,length:d*.65,thickness:d*.65});
  // L 夹是前低后高的实体阶梯块，主轴孔位于下层；不能沿用通用立板尺寸。
  // 公开修改页 Φ8 的宽/高/长为 17.6/32/32；只用于设计参考几何，不是厂商料号尺寸。
  if(type==='L_FIX')Object.assign(dimensions,{width:d*2.2,height:d*4,length:d*4,thickness:d*4,axisOffsetY:d});
  return definition(`SHAFT_${type}`,`${name} ${form.mixed?`异径Φ${dimensions.secondDiameter}-${d}`:`Φ${d}`}mm`,dimensions,{category:'光轴配件',mountRule:{target:'SHAFT_AXIS',diameter:d}});
}

/** 夹具可安装主孔的轴心。坐标取自共用几何，不将紧固螺钉孔当作光轴孔。 */
export function shaftFixturePorts(source) {
  const d=source?.dimensions||{},type=String(d.geometryKind||'').replace(/^SHAFT_/,''),a=Number(d.diameter),b=Number(d.secondDiameter||a);
  const port=(id,label,axis,center,diameter=a)=>({id,label,axis,center,diameter});
  const z=port('Z','前后孔 (Z轴)',[0,0,1],[0,-Number(d.axisOffsetY||0),0]);
  if(type==='L_FIX')return [port('X','水平孔（转角）',[1,0,0],[0,-Number(d.axisOffsetY),Number(d.length)/4],b),port('Y','垂直孔（顶部）',[0,1,0],[0,0,Number(d.length)/4],b),{...z,label:'前后孔（末端）'}];
  if(type==='CROSS_FIX')return [port('X','水平孔 (X轴)',[1,0,0],[0,a,0],b),z];
  if(type==='T_FIX')return [port('Y','垂直孔',[0,1,0],[0,0,0],b),{...z,label:'前后孔'}];
  if(type.startsWith('PARALLEL_FIX'))return [port('UPPER','上孔',[0,0,1],[0,Number(d.spacing)/2,0],b),{...z,id:'LOWER',label:'下孔'}];
  if(['VERTICAL_SK','HORIZONTAL_SHF','LIMIT_RING'].includes(type))return [{...z,label:'轴心孔'}];
  return [];
}
export function accessoryComponent(form,profile) {
  if(form.type==='SLIDE_RAIL')return definition('SLIDE_RAIL',`${SlideTypeOptions.find(x=>x.value===form.slideType)?.label} ${SlideLengthOptions.find(x=>String(x.value)===String(form.slideLength))?.label||`${form.slideLength}mm`}`,
    {length:Number(form.slideLength),width:12,height:45,black:form.slideType==='THREE_SECTION_BLACK'},
    {category:'导轨',accessoryType:'DRAWER_SLIDE',mountRule:{target:'PANEL_SIDE'},color:form.slideType==='THREE_SECTION_BLACK'?'#282a2d':'#909090'});
  if(form.type==='FASTENING') {
    if(form.head==='ELASTIC_NUT')return definition('ELASTIC_NUT',`${form.elasticSeries}×${form.elasticSeries}-M${Number(form.elasticSeries)===20?6:8}`,
      {size:Number(form.elasticSeries),diameter:Number(form.elasticSeries)===20?6:8},{category:'紧固件',color:'#222326'});
    return definition(`SCREW_${form.head}`,`${FastenerHeadOptions.find(x=>x.value===form.head)?.label} M${form.thread}*${form.screwLength}`,
      {diameter:Number(form.thread),length:Number(form.screwLength),headDiameter:Number(form.thread)*1.65},{category:'紧固件',thread:`M${form.thread}`,accessoryType:'SOCKET_SCREW',color:'#282b2f'});
  }
  if(form.type==='END_CAP')return definition('END_CAP',EndCapMaterialOptions.find(x=>x.value===form.capMaterial)?.label||'端盖',
    {size:Number(profile?.width||20),width:Number(profile?.width||20),height:Number(profile?.height||20),thickness:form.capMaterial==='PLASTIC'?3:2,
      capMaterial:form.capMaterial,profileId:profile?.id||'DESIGN-2020'},
    {category:'端盖',accessoryType:'END_CAP',color:form.capMaterial==='ALUMINUM'?'#a8aaad':'#222326',mountRule:{target:'PROFILE_END',profileNominal:profile?.nominal||'2020'}});
  const [footDiameter,stemDiameter,stemLength]=String(form.foot).match(/\d+/g).map(Number);
  return definition('FOOT_CUP',`脚杯 ${form.foot}`,{size:footDiameter,footDiameter,stemDiameter,stemLength,footThickness:8},
    {category:'底脚',accessoryType:'LEVELING_FOOT',thread:`M${stemDiameter}`,mountRule:{target:'PROFILE_BOTTOM'}});
}
export function componentPart(definition) {
  return {type:'ACCESSORY',accessoryType:definition.accessoryType,color:definition.color,dimensions:{...definition.dimensions}};
}
