import {getProfileDefinition} from './ProfileCatalog.js';
import {getDesignProfileDefinition} from './DesignProfileCatalog.js';
import {buildDesignProfileSection} from './DesignProfileSection.js';

const customSections = new Map();
const catalogSections = new Map();
const referenceSections = new Map();

export function getSectionDefinition(catalogId,faceClosures=[]) {
  const custom = customSections.get(catalogId);
  if (custom) return custom;
  const catalog = catalogSections.get(catalogId);
  if (catalog) return catalog;
  const cacheKey=`${catalogId}:${[...faceClosures].sort().join(',')}`;
  const cached = referenceSections.get(cacheKey);
  if (cached) return cached;
  const profile = getDesignProfileDefinition(catalogId) || getProfileDefinition(catalogId);
  if (!profile) return null;
  const reference = buildReferenceSection(profile,faceClosures);
  referenceSections.set(cacheKey,reference);
  return reference;
}


export function registerCatalogSection(catalogId, section, sourceName = '数据库型材库') {
  if (!catalogId || !section?.outer?.length) return null;
  const normalized = normalizeSection({
    ...section,
    id: section.id || `CATALOG-${catalogId}`,
    catalogId,
    name: section.name || `${catalogId} 数据库截面`,
    sourceType: section.sourceType || 'DATABASE_CATALOG',
    sourceName: section.sourceName || sourceName,
    sourceText: section.sourceText || '',
    accuracy: section.accuracy || 'CATALOG',
    referenceOnly: section.referenceOnly === true
  });
  catalogSections.set(catalogId,normalized);
  return normalized;
}

export function removeCatalogSection(catalogId) { return catalogSections.delete(catalogId); }
export function clearCatalogSections() { catalogSections.clear(); }
export function registerCustomSection(catalogId, section, sourceName = 'DXF', sourceText = '') {
  const profile = getDesignProfileDefinition(catalogId) || getProfileDefinition(catalogId);
  if (!profile) throw new Error(`未知型材截面：${catalogId}`);
  if (!section?.outer?.length || section.outer.length < 3) throw new Error('截面缺少有效外轮廓');
  const normalized = normalizeSection({
    ...section,
    id: `CUSTOM-${catalogId}`,
    catalogId,
    name: `${profile.name || profile.variant || profile.nominal || catalogId} DXF 截面`,
    sourceType: 'DXF_IMPORTED',
    sourceName,
    sourceText,
    accuracy: 'SOURCE_DXF',
    referenceOnly: false
  });
  customSections.set(catalogId, normalized);
  return normalized;
}

export function removeCustomSection(catalogId) {
  return customSections.delete(catalogId);
}

export function hasCustomSection(catalogId) {
  return customSections.has(catalogId);
}

export function clearCustomSections() {
  customSections.clear();
}

export function exportCustomSections() {
  return [...customSections.values()].map(section => structuredClone(section));
}

export function loadCustomSections(sections) {
  customSections.clear();
  for (const section of sections || []) {
    if (!section?.catalogId || !section?.outer?.length) continue;
    customSections.set(section.catalogId, normalizeSection(structuredClone(section)));
  }
}

export function getSectionBounds(section) {
  if (!section?.outer?.length) return {minX:0,maxX:0,minY:0,maxY:0,width:0,height:0};
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of section.outer) {
    minX = Math.min(minX, Number(point.x));
    maxX = Math.max(maxX, Number(point.x));
    minY = Math.min(minY, Number(point.y));
    maxY = Math.max(maxY, Number(point.y));
  }
  return {minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY};
}

export function getSectionInfo(catalogId) {
  const section = getSectionDefinition(catalogId);
  if (!section) return null;
  const bounds = getSectionBounds(section);
  return {
    catalogId,
    sourceType: section.sourceType,
    sourceName: section.sourceName,
    accuracy: section.accuracy,
    referenceOnly: !!section.referenceOnly,
    width: bounds.width,
    height: bounds.height,
    holeCount: section.holes?.length || 0,
    imported: section.sourceType === 'DXF_IMPORTED'
  };
}

export function sectionToSvg(section, options = {}) {
  if (!section?.outer?.length) return '';
  const bounds = getSectionBounds(section);
  const margin = Math.max(2, Math.max(bounds.width, bounds.height) * 0.08);
  const minX = bounds.minX - margin;
  const minY = -bounds.maxY - margin;
  const width = bounds.width + margin * 2;
  const height = bounds.height + margin * 2;
  const path = [ringPath(section.outer), ...(section.holes || []).map(ringPath)].join(' ');
  const strokeWidth = Math.max(0.25, Math.max(width,height) / 220);
  const fill = options.fill || '#dfe5ec';
  const stroke = options.stroke || '#3f4b59';
  return `<svg class="section-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(minX)} ${fmt(minY)} ${fmt(width)} ${fmt(height)}" preserveAspectRatio="xMidYMid meet"><path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${fmt(strokeWidth)}" fill-rule="evenodd" vector-effect="non-scaling-stroke"/></svg>`;
}

function ringPath(points) {
  return points.map((point,index) => `${index === 0 ? 'M' : 'L'} ${fmt(point.x)} ${fmt(-point.y)}`).join(' ') + ' Z';
}

function fmt(value) {
  return Number(Number(value).toFixed(4));
}

function buildReferenceSection(profile,faceClosures=[]) {
  // 投影到设计目录不会改变具体型号已有的参考截面；数据库/DXF 仍优先。
  const design=getDesignProfileDefinition(profile.id);
  if(design?.sectionStyle==='CATALOG_REFERENCE')profile=getProfileDefinition(profile.id)||profile;
  const [width,height] = profile.sectionSize;
  const slotWidth = Math.min(Number(profile.slotWidth || Math.min(width,height) * 0.25), Math.min(width,height) * 0.45);
  const minSize = Math.min(width,height);
  const slotDepth = Math.max(1.6, Math.min(minSize * 0.17, 5));
  const variant = String(profile.variant || profile.nominal || profile.id || '').toUpperCase();
  // 所有外轮廓沿用设计目录的真实槽面/槽位置；具体型号内腔仍保留原参考差异。
  const designSection=design?buildDesignProfileSection(design,faceClosures):null;
  const outer = designSection?.outer || buildNotchedOuter(width,height,slotWidth,slotDepth,faceClosures);
  const referenceHoles = design?.sectionStyle==='CATALOG_REFERENCE'&&design.shape!=='ROUND_CORNER'
    ?buildVariantHoles(width,height,variant,Number(profile.defaultWallThickness || 1.8),slotWidth)
    :designSection?.holes || buildVariantHoles(width,height,variant,Number(profile.defaultWallThickness || 1.8),slotWidth);
  const closedSlotHoles=designSection?.closedSlotHoles||[];
  const holes=design?.sectionStyle==='CATALOG_REFERENCE'&&design.shape!=='ROUND_CORNER'
    ?[...closedSlotHoles,...fitReferenceHoles(referenceHoles,outer,closedSlotHoles)]
    :referenceHoles;
  return normalizeSection({
    id: `REF-${profile.id}`,
    catalogId: profile.id,
    name: `${profile.name || profile.variant || profile.nominal || profile.id} 内置参考截面`,
    sourceType: 'BUILT_IN_REFERENCE',
    sourceName: '内置参数化参考截面',
    sourceText: '',
    accuracy: 'REFERENCE',
    referenceOnly: true,
    outer,
    holes,
    note: '该截面用于编辑器视觉区分与建模预览，不作为生产精确图档。生产前应绑定自定义 DXF 截面。'
  });
}

function buildNotchedOuter(width,height,slotWidth,slotDepth,faceClosures=[]) {
  const hw = width / 2;
  const hh = height / 2;
  const sx = Math.min(slotWidth / 2, hw * 0.45);
  const sy = Math.min(slotWidth / 2, hh * 0.45);
  const dx = Math.min(slotDepth, hw * 0.35);
  const dy = Math.min(slotDepth, hh * 0.35);
  const closed=new Set(faceClosures);
  return [p(-hw,-hh),
    ...(closed.has('BACK')?[]:[p(-sx,-hh),p(-sx,-hh+dy),p(sx,-hh+dy),p(sx,-hh)]),p(hw,-hh),
    ...(closed.has('RIGHT')?[]:[p(hw,-sy),p(hw-dx,-sy),p(hw-dx,sy),p(hw,sy)]),p(hw,hh),
    ...(closed.has('FRONT')?[]:[p(sx,hh),p(sx,hh-dy),p(-sx,hh-dy),p(-sx,hh)]),p(-hw,hh),
    ...(closed.has('LEFT')?[]:[p(-hw,sy),p(-hw+dx,sy),p(-hw+dx,-sy),p(-hw,-sy)])];
}

function buildVariantHoles(width,height,variant,wallThickness,slotWidth) {
  // TXCK 目录第 1 页轻型 3030 A/B/H/T：四个 Ø4.2 角孔，中心 Ø6.8 参考孔。
  if(width===30&&height===30&&['3030A','3030B','3030H','3030T'].includes(variant)) {
    const result=[];
    for(const x of [-11.5,11.5])for(const y of [-11.5,11.5])result.push(circlePoints(x,y,2.1,24));
    result.push(circlePoints(0,0,3.4,32));
    return result;
  }
  // TXCL 第 4 页 F/H/T 的四角为矩形内腔；此处仍是独立简化参考，不冒充精确图档。
  if(width===40&&height===40&&['4040F','4040H','4040T'].includes(variant)) {
    const result=[];
    for(const x of [-14,14])for(const y of [-14,14])result.push(roundedRectPoints(x,y,6,6,.7));
    result.push(circlePoints(0,0,3.4,32));
    return result;
  }
  const minSize = Math.min(width,height);
  const maxHoleW = Math.max(2, width / 2 - wallThickness * 3.2);
  const maxHoleH = Math.max(2, height / 2 - wallThickness * 3.2);
  const rectW = Math.max(2.4, Math.min(maxHoleW, width * 0.22));
  const rectH = Math.max(2.4, Math.min(maxHoleH, height * 0.22));
  const slotHalf = Math.min(Number(slotWidth || minSize * 0.25) / 2, minSize * 0.225);
  const margin = Math.max(0.35,wallThickness * 0.25);
  const maxQx = Math.max(0,width / 2 - rectW / 2 - wallThickness * 1.15);
  const maxQy = Math.max(0,height / 2 - rectH / 2 - wallThickness * 1.15);
  const qx = Math.min(maxQx,Math.max(width * 0.23,slotHalf + rectW / 2 + margin));
  const qy = Math.min(maxQy,Math.max(height * 0.23,slotHalf + rectH / 2 + margin));
  const smallR = Math.max(1.2, minSize * 0.055);
  const centerR = Math.max(1.5, minSize * 0.075);
  const holes = [];

  if (variant.endsWith('C')) {
    for(const x of [-qx,qx])for(const y of [-qy,qy])holes.push(roundedRectPoints(x,y,rectW*.68,rectH*.68,1.1));
    holes.push(circlePoints(0,0,centerR,28));
  } else if (variant.endsWith('G')) {
    for(const x of [-qx,qx])for(const y of [-qy,qy])holes.push(roundedRectPoints(x,y,rectW*.78,rectH*.78,.6));
    holes.push(circlePoints(0,0,centerR,28));
  } else if (variant.endsWith('H')) {
    holes.push(roundedRectPoints(qx,qy,rectW * 0.72,rectH * 0.72,1),roundedRectPoints(-qx,qy,rectW * 0.72,rectH * 0.72,1),roundedRectPoints(qx,-qy,rectW * 0.72,rectH * 0.72,1),roundedRectPoints(-qx,-qy,rectW * 0.72,rectH * 0.72,1));
    holes.push(circlePoints(0,0,centerR * 0.8,24));
  } else if (variant.endsWith('T')) {
    const sideX = Math.min(width * 0.22,width / 2 - rectW * 0.36 - wallThickness * 1.4);
    holes.push(roundedRectPoints(sideX,0,rectW * 0.62,height * 0.31,1.2),roundedRectPoints(-sideX,0,rectW * 0.62,height * 0.31,1.2));
    holes.push(circlePoints(0,0,centerR * 0.8,24));
  } else if (variant.endsWith('X')) {
    holes.push(diamondPoints(qx,qy,rectW * 0.55,rectH * 0.55),diamondPoints(-qx,qy,rectW * 0.55,rectH * 0.55),diamondPoints(qx,-qy,rectW * 0.55,rectH * 0.55),diamondPoints(-qx,-qy,rectW * 0.55,rectH * 0.55));
    holes.push(diamondPoints(0,0,minSize * 0.17,minSize * 0.17));
  } else if (variant.endsWith('B')) {
    holes.push(diamondPoints(qx,qy,rectW * 0.72,rectH * 0.72),diamondPoints(-qx,qy,rectW * 0.72,rectH * 0.72),diamondPoints(qx,-qy,rectW * 0.72,rectH * 0.72),diamondPoints(-qx,-qy,rectW * 0.72,rectH * 0.72));
    holes.push(circlePoints(0,0,centerR * 1.15,28));
  } else if (variant.endsWith('A')) {
    holes.push(roundedRectPoints(qx,qy,rectW * 1.08,rectH * 0.66,1.1),roundedRectPoints(-qx,qy,rectW * 1.08,rectH * 0.66,1.1),roundedRectPoints(qx,-qy,rectW * 1.08,rectH * 0.66,1.1),roundedRectPoints(-qx,-qy,rectW * 1.08,rectH * 0.66,1.1));
    holes.push(roundedRectPoints(0,0,minSize * 0.14,minSize * 0.14,0.7));
  } else if (variant.startsWith('J')) {
    const ratio = variant.endsWith('R') ? 0.72 : 0.82;
    const radius = variant.endsWith('R') ? 2.1 : 1.6;
    holes.push(roundedRectPoints(qx,qy,rectW * ratio,rectH * 0.95,radius),roundedRectPoints(-qx,qy,rectW * ratio,rectH * 0.95,radius),roundedRectPoints(qx,-qy,rectW * ratio,rectH * 0.95,radius),roundedRectPoints(-qx,-qy,rectW * ratio,rectH * 0.95,radius));
    if (variant.endsWith('R')) holes.push(circlePoints(0,0,centerR * 0.92,28));
    else holes.push(diamondPoints(0,0,minSize * 0.14,minSize * 0.14));
  } else if (variant.endsWith('R')) {
    holes.push(circlePoints(qx,qy,Math.min(rectW,rectH) * 0.40,24),circlePoints(-qx,qy,Math.min(rectW,rectH) * 0.40,24),circlePoints(qx,-qy,Math.min(rectW,rectH) * 0.40,24),circlePoints(-qx,-qy,Math.min(rectW,rectH) * 0.40,24));
    holes.push(circlePoints(0,0,centerR,28));
  } else {
    holes.push(roundedRectPoints(qx,qy,rectW,rectH,1.1),roundedRectPoints(-qx,qy,rectW,rectH,1.1),roundedRectPoints(qx,-qy,rectW,rectH,1.1),roundedRectPoints(-qx,-qy,rectW,rectH,1.1));
    holes.push(circlePoints(0,0,centerR,28));
  }
  return holes.filter(ring => ring.length >= 3);
}

/** 旧参考内腔必须留在新的真实槽轮廓内，避免相交孔使 Three.js 端面三角化破裂。
 * 只约束内置示意孔；数据库/DXF 先返回，不收缩用户的精确截面。
 */
function fitReferenceHoles(holes,outer,reservedHoles=[]) {
  const inRing=(point,ring)=>{
    let result=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],b=ring[j];
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
    }
    return result;
  };
  // 旧型号参考孔不能跨入新保留的槽腔；精确数据库/DXF 截面不走此分支。
  const inside=point=>inRing(point,outer)&&!reservedHoles.some(ring=>inRing(point,ring));
  const result=[];
  for(const ring of holes) {
    const center=ring.reduce((sum,point)=>({x:sum.x+point.x/ring.length,y:sum.y+point.y/ring.length}),{x:0,y:0});
    if(!inside(center))continue;
    for(let attempt=0;attempt<12;attempt++) {
      const factor=Math.pow(.8,attempt);
      const candidate=ring.map(point=>({x:center.x+(point.x-center.x)*factor,y:center.y+(point.y-center.y)*factor}));
      // 凹槽不能只检查顶点：同时取边上点，避免孔边跨过槽口。
      if(candidate.every((point,index)=>{const next=candidate[(index+1)%candidate.length];return [0,.25,.5,.75].every(t=>inside({x:point.x+(next.x-point.x)*t,y:point.y+(next.y-point.y)*t}));})) {
        result.push(candidate);break;
      }
    }
  }
  return result;
}

function normalizeSection(section) {
  const normalized = {...section};
  normalized.outer = normalizeRing(section.outer, false);
  normalized.holes = (section.holes || []).map(ring => normalizeRing(ring, true)).filter(ring => ring.length >= 3);
  normalized.bounds = getSectionBounds(normalized);
  return normalized;
}

function normalizeRing(ring, clockwise) {
  const points = (ring || []).map(point => p(Number(point.x),Number(point.y))).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length > 1 && samePoint(points[0], points[points.length - 1])) points.pop();
  const area = signedArea(points);
  if ((clockwise && area > 0) || (!clockwise && area < 0)) points.reverse();
  return points;
}

function signedArea(points) {
  let area = 0;
  for (let i=0;i<points.length;i++) {
    const a = points[i];
    const b = points[(i+1)%points.length];
    area += a.x*b.y - b.x*a.y;
  }
  return area / 2;
}

function samePoint(a,b,tolerance=1e-6) {
  return Math.abs(a.x-b.x) <= tolerance && Math.abs(a.y-b.y) <= tolerance;
}

function roundedRectPoints(cx,cy,width,height,radius,segments=4) {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.max(0, Math.min(radius,hw,hh));
  const points = [];
  addArc(points,cx+hw-r,cy+hh-r,r,0,Math.PI/2,segments);
  addArc(points,cx-hw+r,cy+hh-r,r,Math.PI/2,Math.PI,segments);
  addArc(points,cx-hw+r,cy-hh+r,r,Math.PI,Math.PI*1.5,segments);
  addArc(points,cx+hw-r,cy-hh+r,r,Math.PI*1.5,Math.PI*2,segments);
  return points;
}

function circlePoints(cx,cy,radius,segments=32) {
  const points = [];
  for (let i=0;i<segments;i++) {
    const angle = i / segments * Math.PI * 2;
    points.push(p(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius));
  }
  return points;
}

function diamondPoints(cx,cy,width,height) {
  return [p(cx,cy+height/2),p(cx-width/2,cy),p(cx,cy-height/2),p(cx+width/2,cy)];
}

function addArc(points,cx,cy,r,start,end,segments) {
  for (let i=0;i<=segments;i++) {
    const t = start + (end-start) * (i/segments);
    const point = p(cx+Math.cos(t)*r,cy+Math.sin(t)*r);
    if (!points.length || !samePoint(points[points.length-1],point)) points.push(point);
  }
}

function p(x,y) {
  return {x:Number(x),y:Number(y)};
}
