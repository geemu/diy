const items = [
  {id:'ANGLE_BRACKET_2020',label:'20系列直角角码',accessoryType:'ANGLE_BRACKET',size:20,material:'铝合金',category:'角码',series:'20',note:'适配20系列型材'},
  {id:'ANGLE_BRACKET_3030',label:'30系列直角角码',accessoryType:'ANGLE_BRACKET',size:30,material:'铝合金',category:'角码',series:'30',note:'适配30系列型材'},
  {id:'ANGLE_BRACKET_4040',label:'40系列直角角码',accessoryType:'ANGLE_BRACKET',size:40,material:'铝合金',category:'角码',series:'40',note:'适配40系列型材'},
  {id:'ANGLE_BRACKET_4545',label:'45系列直角角码',accessoryType:'ANGLE_BRACKET',size:45,material:'铝合金',category:'角码',series:'45',note:'设计占位模型，制造阶段再选择真实规格'},
  {id:'ANGLE_BRACKET_6060',label:'60系列直角角码',accessoryType:'ANGLE_BRACKET',size:60,material:'铝合金',category:'角码',series:'60',note:'设计占位模型，制造阶段再选择真实规格'},
  {id:'ANGLE_BRACKET_8080',label:'80系列直角角码',accessoryType:'ANGLE_BRACKET',size:80,material:'铝合金',category:'角码',series:'80',note:'设计占位模型，制造阶段再选择真实规格'},
  {id:'CORNER_CUBE_30',label:'30系列三维角件',accessoryType:'CORNER_CUBE',size:30,material:'锌合金',category:'角件',series:'30',note:'三向连接'},

  {id:'INTERNAL_CONNECTOR_30',label:'30系列内置连接件',accessoryType:'INTERNAL_CONNECTOR',size:30,length:34,material:'镀锌钢',category:'内置连接件',series:'30',note:'基础参数化模型，生产前按实际采购件核对'},
  {id:'INTERNAL_CONNECTOR_40',label:'40系列内置连接件',accessoryType:'INTERNAL_CONNECTOR',size:40,length:42,material:'镀锌钢',category:'内置连接件',series:'40',note:'基础参数化模型，生产前按实际采购件核对'},
  {id:'INTERNAL_CONNECTOR_45',label:'45系列内置连接件',accessoryType:'INTERNAL_CONNECTOR',size:45,length:46,material:'镀锌钢',category:'内置连接件',series:'45',note:'设计占位模型'},
  {id:'INTERNAL_CONNECTOR_60',label:'60系列内置连接件',accessoryType:'INTERNAL_CONNECTOR',size:60,length:58,material:'镀锌钢',category:'内置连接件',series:'60',note:'设计占位模型'},
  {id:'INTERNAL_CONNECTOR_80',label:'80系列内置连接件',accessoryType:'INTERNAL_CONNECTOR',size:80,length:72,material:'镀锌钢',category:'内置连接件',series:'80',note:'设计占位模型'},
  {id:'ANCHOR_CONNECTOR_30',label:'30系列锚式连接件',accessoryType:'ANCHOR_CONNECTOR',size:30,length:38,material:'镀锌钢',category:'锚式连接件',series:'30'},
  {id:'ANCHOR_CONNECTOR_40',label:'40系列锚式连接件',accessoryType:'ANCHOR_CONNECTOR',size:40,length:46,material:'镀锌钢',category:'锚式连接件',series:'40'},
  {id:'CONNECTION_PLATE_30',label:'30系列平面连接板',accessoryType:'CONNECTION_PLATE',width:70,height:70,thickness:4,material:'镀锌钢',category:'连接板',series:'30'},
  {id:'CONNECTION_PLATE_40',label:'40系列平面连接板',accessoryType:'CONNECTION_PLATE',width:90,height:90,thickness:5,material:'镀锌钢',category:'连接板',series:'40'},
  {id:'CONNECTION_PLATE_45',label:'45系列平面连接板',accessoryType:'CONNECTION_PLATE',width:100,height:100,thickness:5,material:'镀锌钢',category:'连接板',series:'45'},
  {id:'CONNECTION_PLATE_60',label:'60系列平面连接板',accessoryType:'CONNECTION_PLATE',width:130,height:130,thickness:6,material:'镀锌钢',category:'连接板',series:'60'},
  {id:'CONNECTION_PLATE_80',label:'80系列平面连接板',accessoryType:'CONNECTION_PLATE',width:170,height:170,thickness:8,material:'镀锌钢',category:'连接板',series:'80'},

  {id:'T_NUT_M5',label:'T型螺母 M5',accessoryType:'T_NUT',size:14,thread:'M5',slotWidthRange:[5,7],material:'镀锌钢',category:'紧固件'},
  {id:'T_NUT_M6',label:'T型螺母 M6',accessoryType:'T_NUT',size:16,thread:'M6',slotWidthRange:[7,9],material:'镀锌钢',category:'紧固件'},
  {id:'T_NUT_M8',label:'T型螺母 M8',accessoryType:'T_NUT',size:18,thread:'M8',slotWidthRange:[7.5,11],material:'镀锌钢',category:'紧固件'},
  {id:'SOCKET_SCREW_M5X12',label:'内六角螺钉 M5×12',accessoryType:'SOCKET_SCREW',diameter:5,length:12,headDiameter:8.5,material:'12.9级钢',category:'紧固件'},
  {id:'SOCKET_SCREW_M6X16',label:'内六角螺钉 M6×16',accessoryType:'SOCKET_SCREW',diameter:6,length:16,headDiameter:10,material:'12.9级钢',category:'紧固件'},
  {id:'SOCKET_SCREW_M8X20',label:'内六角螺钉 M8×20',accessoryType:'SOCKET_SCREW',diameter:8,length:20,headDiameter:13,material:'12.9级钢',category:'紧固件'},
  {id:'WASHER_M5',label:'平垫 M5',accessoryType:'WASHER',outerDiameter:10,innerDiameter:5.3,thickness:1,material:'镀锌钢',category:'紧固件'},
  {id:'WASHER_M6',label:'平垫 M6',accessoryType:'WASHER',outerDiameter:12,innerDiameter:6.4,thickness:1.2,material:'镀锌钢',category:'紧固件'},
  {id:'WASHER_M8',label:'平垫 M8',accessoryType:'WASHER',outerDiameter:16,innerDiameter:8.4,thickness:1.6,material:'镀锌钢',category:'紧固件'},

  {id:'LEVELING_FOOT_M8_40',label:'M8 调节脚杯 Ø40',accessoryType:'LEVELING_FOOT',stemDiameter:8,stemLength:45,footDiameter:40,footThickness:8,thread:'M8',material:'镀锌钢+尼龙',category:'底脚'},
  {id:'LEVELING_FOOT_M10_50',label:'M10 调节脚杯 Ø50',accessoryType:'LEVELING_FOOT',stemDiameter:10,stemLength:55,footDiameter:50,footThickness:10,thread:'M10',material:'镀锌钢+尼龙',category:'底脚'},
  {id:'CASTER_50_M8',label:'2寸脚轮 M8',accessoryType:'CASTER',wheelDiameter:50,wheelWidth:20,stemDiameter:8,stemLength:25,thread:'M8',material:'钢+PU',category:'脚轮'},
  {id:'FOOT_CUP_3030',label:'3030 塑料底脚',accessoryType:'FOOT_CUP',size:30,height:12,material:'尼龙',category:'底脚',series:'30'},
  {id:'FOOT_CUP_4040',label:'4040 塑料底脚',accessoryType:'FOOT_CUP',size:40,height:14,material:'尼龙',category:'底脚',series:'40'},

  {id:'END_CAP_3030',label:'3030 端盖',accessoryType:'END_CAP',size:30,thickness:6,material:'尼龙',category:'端盖'},
  {id:'END_CAP_4040',label:'4040 端盖',accessoryType:'END_CAP',size:40,thickness:7,material:'尼龙',category:'端盖'},
  {id:'DRAWER_SLIDE_350',label:'三节抽屉导轨 350',accessoryType:'DRAWER_SLIDE',length:350,width:12,height:45,material:'冷轧钢',category:'导轨'},
  {id:'DRAWER_SLIDE_400',label:'三节抽屉导轨 400',accessoryType:'DRAWER_SLIDE',length:400,width:12,height:45,material:'冷轧钢',category:'导轨'},
  {id:'DRAWER_SLIDE_450',label:'三节抽屉导轨 450',accessoryType:'DRAWER_SLIDE',length:450,width:12,height:45,material:'冷轧钢',category:'导轨'},
  {id:'DRAWER_SLIDE_500',label:'三节抽屉导轨 500',accessoryType:'DRAWER_SLIDE',length:500,width:12,height:45,material:'冷轧钢',category:'导轨'},
  {id:'HINGE_GENERIC_40',label:'通用门铰链 40',accessoryType:'HINGE',width:40,height:40,thickness:4,pinDiameter:6,material:'铝合金/钢',category:'门五金',note:'通用参数化门铰链，不绑定供应商品牌'},
  {id:'HANDLE_GENERIC_120',label:'通用门拉手 120',accessoryType:'HANDLE',length:120,standOff:28,diameter:10,material:'铝合金',category:'门五金',note:'通用参数化门拉手，不绑定供应商品牌'}
];

export const HardwareCatalogList = Object.freeze(items.map(item => deepFreeze({...item})));
export const HardwareCatalog = Object.freeze(Object.fromEntries(HardwareCatalogList.map(item => [item.id,item])));

export function getHardwareDefinition(id) {
  return HardwareCatalog[id] || null;
}

export function hardwareDimensions(definition) {
  if (!definition) return {size:30};
  if(definition.dimensions)return structuredClone(definition.dimensions);
  if (definition.accessoryType === 'DRAWER_SLIDE') return {length:Number(definition.length),width:Number(definition.width),height:Number(definition.height)};
  if (definition.accessoryType === 'SOCKET_SCREW') return {diameter:Number(definition.diameter),length:Number(definition.length),headDiameter:Number(definition.headDiameter)};
  if (definition.accessoryType === 'WASHER') return {outerDiameter:Number(definition.outerDiameter),innerDiameter:Number(definition.innerDiameter),thickness:Number(definition.thickness)};
  if (definition.accessoryType === 'END_CAP') return {size:Number(definition.size),thickness:Number(definition.thickness || 6)};
  if (definition.accessoryType === 'INTERNAL_CONNECTOR' || definition.accessoryType === 'ANCHOR_CONNECTOR') return {size:Number(definition.size||30),length:Number(definition.length||definition.size||30)};
  if (definition.accessoryType === 'CONNECTION_PLATE') return {width:Number(definition.width||70),height:Number(definition.height||70),thickness:Number(definition.thickness||4),size:Number(Math.max(definition.width||70,definition.height||70))};
  if (definition.accessoryType === 'LEVELING_FOOT') return {stemDiameter:Number(definition.stemDiameter||8),stemLength:Number(definition.stemLength||45),footDiameter:Number(definition.footDiameter||40),footThickness:Number(definition.footThickness||8),size:Number(definition.footDiameter||40)};
  if (definition.accessoryType === 'CASTER') return {wheelDiameter:Number(definition.wheelDiameter||50),wheelWidth:Number(definition.wheelWidth||20),stemDiameter:Number(definition.stemDiameter||8),stemLength:Number(definition.stemLength||25),size:Number(definition.wheelDiameter||50)};
  if (definition.accessoryType === 'FOOT_CUP') return {size:Number(definition.size||30),height:Number(definition.height||12)};
  if (definition.accessoryType === 'HINGE') return {width:Number(definition.width||40),height:Number(definition.height||40),thickness:Number(definition.thickness||4),pinDiameter:Number(definition.pinDiameter||6),size:Number(Math.max(definition.width||40,definition.height||40))};
  if (definition.accessoryType === 'HANDLE') return {length:Number(definition.length||120),standOff:Number(definition.standOff||28),diameter:Number(definition.diameter||10),size:Number(definition.length||120)};
  return {size:Number(definition.size || 30)};
}

export function isHardwareCompatibleWithSlot(hardwareId,slotWidth) {
  const definition=getHardwareDefinition(hardwareId);
  const range=definition?.slotWidthRange;
  if(!Array.isArray(range)||range.length<2)return true;
  const width=Number(slotWidth||0);
  return width>=Number(range[0])&&width<=Number(range[1]);
}

function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);Object.values(value).forEach(item=>deepFreeze(item));return value;}
