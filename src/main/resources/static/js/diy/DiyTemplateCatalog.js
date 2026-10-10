/**
 * 面向非 CAD 用户的内置 DIY 模板目录。
 *
 * 模板只描述“用户想做什么”和参数默认值，不持久化 Three.js 对象。
 * 最终仍通过 Editor 领域 API 生成标准 Project Part。
 */
export const DEFAULT_FRAME_DIMENSIONS = Object.freeze({width:670, depth:610, height:2000});

// 按用户示例预置型材朝向和接法；只用于明确选取预设，不改变旧参数架的缺省角色。
export function createQuickFrameDefaults(levels,centerBeamCount) {
  return {
    ...DEFAULT_FRAME_DIMENSIONS, levels, centerBeamCount,
    bayCount:1,bayMode:'SHARED',topMount:'BETWEEN',bottomMount:'BETWEEN',bottomClearance:0,manualLevelHeights:false,
    profileRoles:Object.freeze({
      post:Object.freeze({catalogId:'DESIGN-3060',quarterTurns:0}),
      bottom:Object.freeze({catalogId:'DESIGN-3060',quarterTurns:1})
    }),
    sideMount:'INSET',
    levelSettings:Object.freeze(Array.from({length:levels},(_,index)=>Object.freeze({
      heightMm:null,catalogId:'',centerCatalogId:index===0?'DESIGN-3030':'',centerBeamCount:null,
      leftSideMount:index===0||index===levels-1?'FRAME':'',
      rightSideMount:index===0||index===levels-1?'FRAME':''
    })))
  };
}

const templates = [
  {
    id:'BASIC_FRAME',
    label:'基础空间框',
    icon:'▦',
    category:'基础结构',
    summary:'两层、无中间承托梁；3060立柱，底框平放，顶底侧梁在柱间。',
    generator:'LAYERED_RACK',
    defaults:createQuickFrameDefaults(2,0)
  },
  {
    id:'STORAGE_RACK',
    label:'多层置物架',
    icon:'▤',
    category:'架体',
    summary:'四层、每层一根承托梁；3060立柱，底框平放，中间侧梁内收。',
    generator:'LAYERED_RACK',
    defaults:createQuickFrameDefaults(4,1)
  },
  {
    id:'TURTLE_TANK_RACK',
    label:'鱼缸 / 龟缸架',
    icon:'▥',
    category:'架体',
    summary:'五层、每层一根承托梁；3060立柱，底框平放，顶底侧梁在柱间、中间内收；不代表承重已验算。',
    generator:'LAYERED_RACK',
    defaults:createQuickFrameDefaults(5,1)
  },
  {
    id:'MACHINE_FRAME',
    label:'设备机架',
    icon:'◇',
    category:'设备框架',
    summary:'两层、每层一根承托梁；3060立柱，底框平放，顶底侧梁在柱间。',
    generator:'LAYERED_RACK',
    defaults:createQuickFrameDefaults(2,1)
  }
];

export const DiyTemplateList = Object.freeze(templates.map(item => Object.freeze({
  ...item,
  defaults:Object.freeze({...item.defaults})
})));

export function getDiyTemplate(id) {
  return DiyTemplateList.find(item => item.id === id) || null;
}
