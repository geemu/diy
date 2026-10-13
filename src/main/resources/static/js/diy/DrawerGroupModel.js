import {getHardwareDefinition,hardwareDimensions} from '../model/HardwareCatalog.js';
import {drawerSlideGeometry} from '../model/DrawerSlideGeometryModel.js';

// 两端各留 1 mm 是当前设计预览的避碰间隙，不作为某供应商的装配规范。
const SLIDE_END_CLEARANCE_MM = 1;

/** 纯布局：总宽含左右导轨，深度从面板外面到箱体背面；不写工程或替换用户规格。 */
export function drawerGroupLayout(options = {}) {
  const width = millimetres(options.width,500,'总宽',120);
  const depth = millimetres(options.depth,450,'深度',120);
  const height = millimetres(options.height,600,'总高',100);
  const count = millimetres(options.count,3,'数量',1);
  if (!Number.isInteger(count) || count > 12) throw new Error('抽屉数量须为 1～12 的整数');
  const gap = millimetres(options.gap,3,'缝隙',0);
  const frontThickness = millimetres(options.frontThickness,18,'面板厚度',3);
  const boardThickness = millimetres(options.boardThickness,12,'箱体板厚',3);
  const frontMode = options.frontMode === undefined ? 'INSET' : options.frontMode;
  if (!['INSET','OVERLAY'].includes(frontMode)) throw new Error('请选择内置或外盖面板');
  if (options.includeSlides !== undefined && typeof options.includeSlides !== 'boolean') throw new Error('请选择是否添加导轨');
  const includeSlides = options.includeSlides === true;
  const origin = {
    x:millimetres(options.position?.x,0,'位置 X'),
    y:millimetres(options.position?.y,0,'位置 Y'),
    z:millimetres(options.position?.z,0,'位置 Z')
  };
  let slideDefinition = null;
  let slide = null;
  if (includeSlides) {
    const slideLength = millimetres(options.slideLength,400,'导轨长度',1);
    slideDefinition = getHardwareDefinition(`DRAWER_SLIDE_${slideLength}`);
    if (!slideDefinition || slideDefinition.accessoryType !== 'DRAWER_SLIDE') throw new Error(`不支持 ${slideLength} mm 导轨；请选择目录规格，不会自动替换长度`);
    slide = drawerSlideGeometry(hardwareDimensions(slideDefinition));
    const requiredDepth = frontThickness + slide.length + SLIDE_END_CLEARANCE_MM * 2;
    if (depth < requiredDepth) throw new Error(`${slideLength} mm 导轨放不下：深度 ${depth} mm 含 ${frontThickness} mm 面板及前后各 ${SLIDE_END_CLEARANCE_MM} mm 间隙，至少需要 ${requiredDepth} mm；请增加深度或手动选择较短导轨`);
  }
  const drawerHeight = (height - gap * (count - 1)) / count;
  const boxHeight = drawerHeight - 30;
  const minimumBoxHeight = Math.max(40,boardThickness + 20,slide ? slide.height / 0.76 : 0);
  if (boxHeight < minimumBoxHeight) {
    const requiredHeight = Math.ceil((minimumBoxHeight + 30) * count + gap * (count - 1));
    throw new Error(`当前数量、缝隙、板厚${includeSlides ? '和导轨高度' : ''}需要总高至少 ${requiredHeight} mm；请增加总高或减少数量`);
  }
  const boxWidth = width - (slide ? slide.occupiedWidth * 2 : 0);
  const boxDepth = depth - frontThickness;
  if (boxWidth - boardThickness * 2 < 40) throw new Error('扣除左右导轨和侧板后，箱体净宽不足 40 mm；请增加总宽');
  if (boxDepth - boardThickness < 40) throw new Error('扣除面板及背板后，箱体净深不足 40 mm；请增加深度');
  const frontWidth = frontMode === 'OVERLAY' ? width + 20 : width;
  const frontInnerZ = origin.z - frontThickness / 2;
  const rearZ = frontInnerZ - boxDepth;
  const sideZ = (frontInnerZ + rearZ) / 2;
  const members = [];
  const addPanel = (drawerIndex,name,panelWidth,panelHeight,thickness,position,rotation,color) => members.push({
    drawerIndex,type:'PANEL',name:`抽屉${drawerIndex + 1}-${name}`,dimensions:{width:panelWidth,height:panelHeight,thickness},
    position,rotation:rotation || {x:0,y:0,z:0},color
  });
  for (let drawerIndex = 0; drawerIndex < count; drawerIndex++) {
    const yBase = origin.y + drawerIndex * (drawerHeight + gap);
    const centerY = yBase + drawerHeight / 2;
    const boxBottomY = centerY - boxHeight / 2;
    addPanel(drawerIndex,'面板',frontWidth,drawerHeight,frontThickness,{x:origin.x,y:centerY,z:origin.z},null,options.frontColor || '#d8c1a2');
    for (const sign of [-1,1]) {
      addPanel(drawerIndex,sign < 0 ? '左侧板' : '右侧板',boxDepth,boxHeight,boardThickness,
        {x:origin.x + sign * (boxWidth - boardThickness) / 2,y:centerY,z:sideZ},{x:0,y:Math.PI / 2,z:0},'#caa87c');
    }
    addPanel(drawerIndex,'背板',boxWidth - boardThickness * 2,boxHeight,boardThickness,
      {x:origin.x,y:centerY,z:rearZ + boardThickness / 2},null,'#caa87c');
    // 底板在左右侧板和背板之间对接，不叠进侧板或留原来的悬空前缝。
    addPanel(drawerIndex,'底板',boxWidth - boardThickness * 2,boxDepth - boardThickness,boardThickness,
      {x:origin.x,y:boxBottomY + boardThickness / 2,z:frontInnerZ - (boxDepth - boardThickness) / 2},{x:Math.PI / 2,y:0,z:0},'#b99568');
    if (slide) {
      // 左件局部 +X 朝箱体；右件转 180° 后 -X 朝箱体。最内侧表面只贴侧板，不穿入木板。
      for (const sign of [-1,1]) members.push({
        drawerIndex,type:'ACCESSORY',accessoryType:'DRAWER_SLIDE',hardwareSku:slideDefinition.id,
        name:`抽屉${drawerIndex + 1}-${sign < 0 ? '左' : '右'}导轨`,dimensions:hardwareDimensions(slideDefinition),
        position:{x:origin.x + sign * (boxWidth / 2 + slide.maxX),y:centerY - boxHeight * 0.12,z:frontInnerZ - SLIDE_END_CLEARANCE_MM - slide.length / 2},
        rotation:{x:0,y:sign < 0 ? 0 : Math.PI,z:0},color:slideDefinition.color || '#6f7780'
      });
    }
  }
  for (const member of members) {
    if (![...Object.values(member.position),...Object.values(member.dimensions)].every(Number.isFinite)) throw new Error('抽屉尺寸或位置超出可用数值范围');
  }
  return {members,parameters:{width,depth,height,count,gap,frontMode,frontThickness,boardThickness,includeSlides,slideLength:slideDefinition?.length || null,position:origin},
    drawerHeight,boxWidth,boxDepth,boxHeight,frontWidth,slideOccupiedWidth:slide?.occupiedWidth || 0};
}

function millimetres(value,fallback,label,minimum = -Infinity) {
  const raw = value === undefined ? fallback : value;
  const number = Number(raw);
  if (raw === null || typeof raw === 'boolean' || String(raw).trim() === '' || !Number.isFinite(number) || number < minimum) {
    throw new Error(`${label}须为${minimum === -Infinity ? '有效' : `不小于 ${minimum} 的`}数值`);
  }
  return number;
}
