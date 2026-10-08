/**
 * 面向非 CAD 用户的内置 DIY 模板目录。
 *
 * 模板只描述“用户想做什么”和参数默认值，不持久化 Three.js 对象。
 * 最终仍通过 Editor 领域 API 生成标准 Project Part。
 */
const templates = [
  {
    id:'BASIC_FRAME',
    label:'基础空间框',
    icon:'▦',
    category:'基础结构',
    summary:'两层、无中间承托梁的空间框起始参数。',
    generator:'LAYERED_RACK',
    defaults:{width:1000, depth:600, height:1000, levels:2, centerBeamCount:0}
  },
  {
    id:'STORAGE_RACK',
    label:'多层置物架',
    icon:'▤',
    category:'架体',
    summary:'四层、每层一根中间承托梁的起始参数。',
    generator:'LAYERED_RACK',
    defaults:{width:1000, depth:500, height:1800, levels:4, centerBeamCount:1}
  },
  {
    id:'TURTLE_TANK_RACK',
    label:'鱼缸 / 龟缸架',
    icon:'▥',
    category:'架体',
    summary:'五层、每层两根中间承托梁的起始参数；不代表承重已验算。',
    generator:'LAYERED_RACK',
    defaults:{width:1000, depth:650, height:2000, levels:5, centerBeamCount:2}
  },
  {
    id:'MACHINE_FRAME',
    label:'设备机架',
    icon:'◇',
    category:'设备框架',
    summary:'两层、每层一根中间承托梁的起始参数。',
    generator:'LAYERED_RACK',
    defaults:{width:900, depth:700, height:1200, levels:2, centerBeamCount:1}
  }
];

export const DiyTemplateList = Object.freeze(templates.map(item => Object.freeze({
  ...item,
  defaults:Object.freeze({...item.defaults})
})));

export function getDiyTemplate(id) {
  return DiyTemplateList.find(item => item.id === id) || null;
}
