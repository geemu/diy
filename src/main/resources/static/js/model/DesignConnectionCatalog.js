/**
 * 设计阶段连接目录。
 *
 * 这里只表达玩家的结构意图，不携带真实螺钉、螺母、角码料号或加工参数。
 * 真实制造规则由 ManufacturingConfigurator 在制造配置阶段绑定。
 */
const definitions = [
  {id:'ANGLE_BRACKET',label:'角码连接',shortLabel:'角码',summary:'两根型材通过外置直角连接件连接'},
  {id:'INTERNAL_CONNECTOR',label:'内置连接',shortLabel:'内置连接',summary:'隐藏式连接，制造阶段再确定具体加工和紧固件'},
  {id:'ANCHOR_CONNECTOR',label:'锚式连接',shortLabel:'锚式连接',summary:'型材端部与目标槽位通过锚式连接件固定'},
  {id:'CONNECTION_PLATE',label:'连接板',shortLabel:'连接板',summary:'使用外置连接板进行多点紧固'},
  {id:'END_SCREW',label:'端面连接',shortLabel:'端面连接',summary:'端部与侧面直接紧固，制造阶段再确定螺纹和孔加工'}
];

export const DesignConnectionList = Object.freeze(definitions.map(item=>Object.freeze({...item})));
export const DesignConnectionCatalog = Object.freeze(Object.fromEntries(DesignConnectionList.map(item=>[item.id,item])));
export const DEFAULT_DESIGN_CONNECTION_TYPE = 'ANGLE_BRACKET';

export function getDesignConnectionDefinition(id) {
  return DesignConnectionCatalog[String(id || '').toUpperCase()] || null;
}

export function designConnectionLabel(id) {
  return getDesignConnectionDefinition(id)?.label || String(id || '连接');
}
