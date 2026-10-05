import {profileSeries as designProfileSeries} from './DesignProfileCatalog.js';
const rules = [
  {
    id:'END_SCREW_M6_CSK',type:'END_SCREW',label:'M6 端面螺钉连接（Ø7通孔 + Ø12沉头）',
    source:{tap:{size:'M6',depth:10}},target:{throughHole:{diameter:7},headMachining:{enabled:true,type:'COUNTERSINK',majorDiameter:12,angleDeg:90}},
    hardware:{screwSku:'SOCKET_SCREW_M6X16',washerSku:'WASHER_M6',count:1},
    supportedSourcePathTypes:['LINE'],supportedTargetPathTypes:['LINE'],
    compatibility:{sourceSeries:['20','30'],targetSeries:['20','30'],requireAxisNormalAlignment:true,maxAngleErrorDeg:6,maxContactGapMm:10},
    productionNotes:['沉头尺寸需按实际 M6 螺钉头型和实际工艺核对。']
  },
  {
    id:'END_SCREW_M8_CSK',type:'END_SCREW',label:'M8 端面螺钉连接（Ø9通孔 + Ø16沉头）',
    source:{tap:{size:'M8',depth:12}},target:{throughHole:{diameter:9},headMachining:{enabled:true,type:'COUNTERSINK',majorDiameter:16,angleDeg:90}},
    hardware:{screwSku:'SOCKET_SCREW_M8X20',washerSku:'WASHER_M8',count:1},
    supportedSourcePathTypes:['LINE'],supportedTargetPathTypes:['LINE'],
    compatibility:{sourceSeries:['30','40','45','60'],targetSeries:['30','40','45','60'],requireAxisNormalAlignment:true,maxAngleErrorDeg:6,maxContactGapMm:10},
    productionNotes:['沉头角度、有效深度及适配螺钉头型应按实际紧固件与加工厂工艺确认。']
  },
  {
    id:'END_SCREW_M8_CBORE',type:'END_SCREW',label:'M8 端面螺钉连接（Ø9通孔 + Ø14沉孔）',
    source:{tap:{size:'M8',depth:12}},target:{throughHole:{diameter:9},headMachining:{enabled:true,type:'COUNTERBORE',diameter:14,depth:6}},
    hardware:{screwSku:'SOCKET_SCREW_M8X20',washerSku:'WASHER_M8',count:1},
    supportedSourcePathTypes:['LINE'],supportedTargetPathTypes:['LINE'],
    compatibility:{sourceSeries:['30','40','45','60'],targetSeries:['30','40','45','60'],requireAxisNormalAlignment:true,maxAngleErrorDeg:6,maxContactGapMm:10},
    productionNotes:['沉孔深度需按实际圆柱头螺钉高度与装配间隙确认。']
  },
  {
    id:'END_SCREW_M8_THRU_ONLY',type:'END_SCREW',label:'M8 端面螺钉连接（仅 Ø9 通孔）',
    source:{tap:{size:'M8',depth:12}},target:{throughHole:{diameter:9},headMachining:{enabled:false,type:null}},
    hardware:{screwSku:'SOCKET_SCREW_M8X20',washerSku:'WASHER_M8',count:1},
    supportedSourcePathTypes:['LINE'],supportedTargetPathTypes:['LINE'],
    compatibility:{sourceSeries:['30','40','45','60'],targetSeries:['30','40','45','60'],requireAxisNormalAlignment:true,maxAngleErrorDeg:6,maxContactGapMm:10},
    productionNotes:['无头部沉加工；螺钉头部是否外露由装配方案决定。']
  },

  angleRule('ANGLE_BRACKET_20_M5','20','20系列角码连接','ANGLE_BRACKET_2020','T_NUT_M5','SOCKET_SCREW_M5X12','WASHER_M5',6),
  angleRule('ANGLE_BRACKET_30_M6','30','30系列角码连接','ANGLE_BRACKET_3030','T_NUT_M6','SOCKET_SCREW_M6X16','WASHER_M6',8),
  angleRule('ANGLE_BRACKET_40_M8','40','40系列角码连接','ANGLE_BRACKET_4040','T_NUT_M8','SOCKET_SCREW_M8X20','WASHER_M8',10),
  angleRule('ANGLE_BRACKET_45_M8','45','45系列角码连接','ANGLE_BRACKET_4545','T_NUT_M8','SOCKET_SCREW_M8X20','WASHER_M8',11),
  angleRule('ANGLE_BRACKET_60_M8','60','60系列角码连接','ANGLE_BRACKET_6060','T_NUT_M8','SOCKET_SCREW_M8X20','WASHER_M8',14),
  angleRule('ANGLE_BRACKET_80_M8','80','80系列角码连接','ANGLE_BRACKET_8080','T_NUT_M8','SOCKET_SCREW_M8X20','WASHER_M8',18),

  internalRule('INTERNAL_CONNECTOR_30_M6','30','30系列内置连接','INTERNAL_CONNECTOR_30','M6',10,'SOCKET_SCREW_M6X16'),
  internalRule('INTERNAL_CONNECTOR_40_M8','40','40系列内置连接','INTERNAL_CONNECTOR_40','M8',12,'SOCKET_SCREW_M8X20'),
  internalRule('INTERNAL_CONNECTOR_45_M8','45','45系列内置连接','INTERNAL_CONNECTOR_45','M8',14,'SOCKET_SCREW_M8X20'),
  internalRule('INTERNAL_CONNECTOR_60_M8','60','60系列内置连接','INTERNAL_CONNECTOR_60','M8',16,'SOCKET_SCREW_M8X20'),
  internalRule('INTERNAL_CONNECTOR_80_M8','80','80系列内置连接','INTERNAL_CONNECTOR_80','M8',20,'SOCKET_SCREW_M8X20'),
  anchorRule('ANCHOR_CONNECTOR_30_M6','30','30系列锚式连接','ANCHOR_CONNECTOR_30','M6','T_NUT_M6','SOCKET_SCREW_M6X16'),
  anchorRule('ANCHOR_CONNECTOR_40_M8','40','40系列锚式连接','ANCHOR_CONNECTOR_40','M8','T_NUT_M8','SOCKET_SCREW_M8X20'),

  plateRule('CONNECTION_PLATE_30_M6','30','30系列连接板','CONNECTION_PLATE_30','T_NUT_M6','SOCKET_SCREW_M6X16','WASHER_M6'),
  plateRule('CONNECTION_PLATE_40_M8','40','40系列连接板','CONNECTION_PLATE_40','T_NUT_M8','SOCKET_SCREW_M8X20','WASHER_M8'),
  plateRule('CONNECTION_PLATE_45_M8','45','45系列连接板','CONNECTION_PLATE_45','T_NUT_M8','SOCKET_SCREW_M8X20','WASHER_M8'),
  plateRule('CONNECTION_PLATE_60_M8','60','60系列连接板','CONNECTION_PLATE_60','T_NUT_M8','SOCKET_SCREW_M8X20','WASHER_M8'),
  plateRule('CONNECTION_PLATE_80_M8','80','80系列连接板','CONNECTION_PLATE_80','T_NUT_M8','SOCKET_SCREW_M8X20','WASHER_M8')
];

export const ConnectionRuleList = Object.freeze(rules.map(rule => deepFreeze(rule)));
export const ConnectionRuleCatalog = Object.freeze(Object.fromEntries(ConnectionRuleList.map(rule => [rule.id,rule])));
export const DEFAULT_END_SCREW_RULE_ID = 'END_SCREW_M8_CSK';

export function getConnectionRule(id){return ConnectionRuleCatalog[id] || null;}
export function getDefaultConnectionRule(type='END_SCREW'){return ConnectionRuleList.find(rule => rule.type===type) || null;}
export function normalizeConnectionRuleId(connection){
  if(!connection)return DEFAULT_END_SCREW_RULE_ID;
  if(connection.ruleId && getConnectionRule(connection.ruleId))return connection.ruleId;
  if(connection.type==='END_SCREW' || !connection.type)return DEFAULT_END_SCREW_RULE_ID;
  return connection.ruleId || null;
}

export function recommendConnectionRules(sourcePart,targetPart,context={}) {
  const sourceSeries=profileSeries(sourcePart);
  const targetSeries=profileSeries(targetPart);
  const rows=[];
  for(const rule of ConnectionRuleList){
    if(!seriesCompatible(rule.compatibility?.sourceSeries,sourceSeries) || !seriesCompatible(rule.compatibility?.targetSeries,targetSeries))continue;
    let score=0;
    const reasons=[];
    if(sourceSeries&&targetSeries&&sourceSeries===targetSeries){score+=30;reasons.push(`${sourceSeries}系列同系列匹配`);}
    if(rule.type==='ANGLE_BRACKET'){score+=context.targetSlotMatched===false?-30:45;reasons.push('角码适合直角外置连接');}
    else if(rule.type==='INTERNAL_CONNECTOR'){score+=38;reasons.push('内置连接外观简洁');}
    else if(rule.type==='ANCHOR_CONNECTOR'){score+=35;reasons.push('锚式连接适合槽内紧固');}
    else if(rule.type==='CONNECTION_PLATE'){score+=28;reasons.push('连接板提供多点紧固');}
    else if(rule.type==='END_SCREW'){score+=40;reasons.push('端面螺钉自动派生加工');}
    if(Number(context.angleErrorDeg||0)<=6)score+=8;
    rows.push({rule,score,reasons});
  }
  return rows.sort((a,b)=>b.score-a.score);
}

export function buildConnectionParameters(ruleId,overrides={}){
  const rule=getConnectionRule(ruleId)||getDefaultConnectionRule('END_SCREW');
  if(!rule)throw new Error(`未找到连接规则：${ruleId}`);
  if(rule.type !== 'END_SCREW')throw new Error(`规则 ${rule.id} 不是端面螺钉连接规则`);
  const head=rule.target.headMachining||{};
  return {
    ruleId:rule.id,type:rule.type,
    tappingSize:overrides.tappingSize||rule.source.tap.size,
    tappingDepth:numberOr(overrides.tappingDepth,rule.source.tap.depth),
    throughHoleDiameter:numberOr(overrides.throughHoleDiameter,rule.target.throughHole.diameter),
    headMachiningEnabled:overrides.headMachiningEnabled!==undefined ? overrides.headMachiningEnabled!==false : (overrides.countersinkEnabled!==undefined ? overrides.countersinkEnabled!==false : head.enabled!==false),
    headMachiningType:overrides.headMachiningType || head.type || null,
    headDiameter:numberOr(overrides.headDiameter ?? overrides.countersinkDiameter,head.majorDiameter ?? head.diameter),
    headDepth:head.type==='COUNTERBORE' ? numberOr(overrides.headDepth ?? overrides.countersinkDepth,head.depth) : null,
    headAngleDeg:numberOr(overrides.headAngleDeg ?? overrides.countersinkAngleDeg,head.angleDeg),
    countersinkEnabled:overrides.countersinkEnabled!==undefined ? overrides.countersinkEnabled!==false : head.enabled!==false,
    countersinkDiameter:numberOr(overrides.countersinkDiameter,head.majorDiameter ?? head.diameter),
    countersinkDepth:head.type==='COUNTERBORE' ? numberOr(overrides.countersinkDepth,head.depth) : null,
    countersinkAngleDeg:numberOr(overrides.countersinkAngleDeg,head.angleDeg)
  };
}

function angleRule(id,series,label,bracketSku,tNutSku,screwSku,washerSku,tolerance){return {
  id,type:'ANGLE_BRACKET',label:`${label}（角码 + T螺母/螺钉）`,
  hardware:{bracketSku,tNutSku,screwSku,washerSku,fastenerPairs:2},
  supportedSourcePathTypes:['LINE'],supportedTargetPathTypes:['LINE'],
  compatibility:{sourceSeries:[series],targetSeries:[series],requireAxisNormalAlignment:true,maxAngleErrorDeg:6,maxContactGapMm:12,targetSlotCenterToleranceMm:tolerance,requireTargetSlot:true,requireSourceSlot:true},
  productionNotes:['角码孔距、T螺母形式和螺钉长度需按实际采购件确认。']
};}
function internalRule(id,series,label,connectorSku,tapSize,tapDepth,screwSku){return {
  id,type:'INTERNAL_CONNECTOR',label,
  hardware:{connectorSku,screwSku,count:1},source:{tap:{size:tapSize,depth:tapDepth}},
  supportedSourcePathTypes:['LINE'],supportedTargetPathTypes:['LINE'],
  compatibility:{sourceSeries:[series],targetSeries:[series],requireAxisNormalAlignment:true,maxAngleErrorDeg:6,maxContactGapMm:10,requireTargetSlot:true,targetSlotCenterToleranceMm:Number(series)*0.28},
  productionNotes:['内置连接件结构按通用件建模；实际开孔/避让要求必须以采购件图纸为准。']
};}
function anchorRule(id,series,label,connectorSku,tapSize,tNutSku,screwSku){return {
  id,type:'ANCHOR_CONNECTOR',label,
  hardware:{connectorSku,tNutSku,screwSku,count:1},source:{tap:{size:tapSize,depth:String(series)==='40'?12:10}},
  supportedSourcePathTypes:['LINE'],supportedTargetPathTypes:['LINE'],
  compatibility:{sourceSeries:[series],targetSeries:[series],requireAxisNormalAlignment:true,maxAngleErrorDeg:6,maxContactGapMm:10,requireTargetSlot:true,targetSlotCenterToleranceMm:Number(series)*0.28},
  productionNotes:['锚式连接件的切口/钻孔结构因厂家差异较大，本规则只负责槽位和基础紧固关系。']
};}
function plateRule(id,series,label,plateSku,tNutSku,screwSku,washerSku){return {
  id,type:'CONNECTION_PLATE',label,
  hardware:{plateSku,tNutSku,screwSku,washerSku,fastenerPairs:4},
  supportedSourcePathTypes:['LINE'],supportedTargetPathTypes:['LINE'],
  compatibility:{sourceSeries:[series],targetSeries:[series],requireAxisNormalAlignment:false,maxAngleErrorDeg:90,maxContactGapMm:16,requireTargetSlot:true,targetSlotCenterToleranceMm:Number(series)*0.30},
  productionNotes:['连接板孔距为参数化示意，采购/加工前需绑定实际板件 SKU 或图纸。']
};}
function profileSeries(part){return designProfileSeries(part) || null;}
function seriesCompatible(list,series){return !Array.isArray(list)||!list.length||!series||list.includes(series);}
function numberOr(value,fallback){const source=value!==undefined&&value!==null&&value!==''?value:fallback;return source===undefined||source===null||source===''?null:Number(source);}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);Object.values(value).forEach(item=>deepFreeze(item));return value;}
