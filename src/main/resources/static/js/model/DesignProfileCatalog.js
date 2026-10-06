import {ProfileCatalogList, getProfileDefinition} from './ProfileCatalog.js';

/**
 * 设计阶段型材目录。
 *
 * 这里只描述“玩家搭结构时必须知道的几何语义”：截面尺寸、槽宽、槽面和封边。
 * 具体型号名称仅用于尺寸组内的几何选择；壁厚、米重、合金和供应商仍在制造阶段配置。
 */
function designProfile(id, width, height, series, slotWidth, options = {}) {
  const nominal = `${Number(width)}${Number(height)}`;
  return Object.freeze({
    id,
    nominal,
    name:options.name || `${width}×${height} 槽型材`,
    width:Number(width),
    height:Number(height),
    sectionSize:Object.freeze([Number(width),Number(height)]),
    series:String(series),
    slotWidth:Number(slotWidth),
    slotDefinitions:Object.freeze((options.shape==='U_CHANNEL'?[]:buildSlots(Number(width),Number(height),Number(series),Number(slotWidth))).filter(slot=>!(options.defaultFaceClosures||[]).includes(slot.face))),
    // 截面几何保留封闭面的原槽腔，安装槽位仍只暴露开放面。
    sectionSlotDefinitions:Object.freeze(options.shape==='U_CHANNEL'?[]:buildSlots(Number(width),Number(height),Number(series),Number(slotWidth))),
    defaultFaceClosures:Object.freeze([...(options.defaultFaceClosures || [])]),
    shape:options.shape || 'T_SLOT',
    sectionStyle:options.sectionStyle || 'DESIGN_REFERENCE'
  });
}

function buildSlots(width,height,series,slotWidth) {
  const result=[];
  const add=(face,span)=>{
    const count=Math.max(1,Math.round(span/series));
    const offsets=count===1?[0]:Array.from({length:count},(_,index)=>(index-(count-1)/2)*series)
      .filter(value=>Math.abs(value)<=span/2-series*0.25+1e-6);
    offsets.forEach((offset,index)=>result.push(Object.freeze({
      id:`${face}-S${index+1}`,
      face,
      index,
      offset:Number(offset),
      width:Number(slotWidth),
      source:'DESIGN_PROFILE'
    })));
  };
  add('FRONT',width);
  add('BACK',width);
  add('LEFT',height);
  add('RIGHT',height);
  return result;
}

const profiles=[
  designProfile('DESIGN-1515',15,15,15,3,{name:'欧标15x15'}),
  designProfile('DESIGN-2020',20,20,20,6),
  designProfile('DESIGN-2040',20,40,20,6),
  designProfile('DESIGN-2060',20,60,20,6),
  designProfile('DESIGN-2080',20,80,20,6),
  designProfile('DESIGN-3030',30,30,30,8),
  designProfile('DESIGN-3060',30,60,30,8),
  designProfile('DESIGN-3090',30,90,30,8),
  designProfile('DESIGN-30120',30,120,30,8),
  designProfile('DESIGN-4040',40,40,40,8),
  designProfile('DESIGN-4080',40,80,40,8),
  designProfile('DESIGN-40120',40,120,40,8),
  designProfile('DESIGN-40160',40,160,40,8),
  designProfile('DESIGN-4545',45,45,45,10),
  designProfile('DESIGN-4590',45,90,45,10),
  designProfile('DESIGN-6060',60,60,60,10),
  designProfile('DESIGN-6090',60,90,60,10),
  designProfile('DESIGN-60120',60,120,60,10),
  designProfile('DESIGN-8080',80,80,80,10)
];
for(const size of [20,30,40])profiles.push(designProfile(`DESIGN-${size}${size}R`,size,size,size,size===20?6:8,
  {name:`欧标${size}x${size}R`,shape:'ROUND_CORNER',defaultFaceClosures:['FRONT','RIGHT']}));
profiles.push(designProfile('DESIGN-U88',8,8,8,0,{name:'A柱 U型 8x8',shape:'U_CHANNEL',defaultFaceClosures:['FRONT','BACK','LEFT','RIGHT']}));
const referenceNominals=new Set(['2020','2040','2060','3030','3060','3090','4040','4080','40120','6060','8080']);
const namedProfiles=profiles.map(item=>item.shape==='T_SLOT'&&referenceNominals.has(item.nominal)?Object.freeze({...item,name:`欧标${item.width}x${item.height}`}):item);

export const DesignProfileList=Object.freeze(namedProfiles);
export const DesignProfileCatalog=Object.freeze(Object.fromEntries(namedProfiles.map(item=>[item.id,item])));

const geometricDefinitions=new WeakMap();

/** 具体型号只投影几何字段；选中型号不等于完成制造材料配置。 */
function catalogGeometry(profile) {
  if(geometricDefinitions.has(profile))return geometricDefinitions.get(profile);
  const [width,height]=profile.sectionSize.map(Number);
  const shape=profile.crossSectionStyle==='ROUND_CORNER'?'ROUND_CORNER':'T_SLOT';
  const closed=new Set([...(profile.defaultFaceClosures||[]),...(shape==='ROUND_CORNER'?['FRONT','RIGHT']:[])]);
  // 明确缺少槽定义的面就是无槽面；不能将其回退成四面通用 T 槽。
  for(const face of ['FRONT','BACK','LEFT','RIGHT'])if(!profile.slotDefinitions.some(slot=>slot.face===face))closed.add(face);
  const definition=Object.freeze({
    id:profile.id,nominal:`${width}${height}`,name:String(profile.variant||profile.code||profile.id),
    width,height,sectionSize:Object.freeze([width,height]),series:String(profile.series),
    slotWidth:Number(profile.slotWidth),slotDefinitions:Object.freeze(profile.slotDefinitions.filter(slot=>!closed.has(slot.face))),
    sectionSlotDefinitions:Object.freeze(profile.sourceFamily==='DATABASE'?profile.slotDefinitions:[...profile.slotDefinitions,...buildSlots(width,height,Number(profile.series),Number(profile.slotWidth)).filter(slot=>closed.has(slot.face))]),
    defaultFaceClosures:Object.freeze([...closed]),shape,sectionStyle:'CATALOG_REFERENCE'
  });
  geometricDefinitions.set(profile,definition);
  return definition;
}

/** 标准几何为默认项，A/B/N 等真实目录型号为二级项；不凭型号名推测不存在的截面。 */
export function getDesignProfileChoices(catalog=ProfileCatalogList) {
  const result=[...DesignProfileList];
  const standardCodes=new Set(result.map(item=>item.id.replace('DESIGN-','')));
  for(const profile of catalog) {
    if(profile.enabled===false)continue;
    if(profile.sourceFamily!=='DATABASE'&&standardCodes.has(String(profile.variant||profile.code)))continue;
    result.push(getDesignProfileDefinition(profile.id));
  }
  return result.filter(Boolean);
}

/** 外尺寸是一级查找入口，不是持久化型号身份；圆角变体仍属于同一尺寸组。 */
export function groupDesignProfiles(profiles) {
  const groups=new Map();
  for(const profile of profiles) {
    const key=profile.shape==='U_CHANNEL'?`U:${profile.width}x${profile.height}`:`${profile.width}x${profile.height}`;
    if(!groups.has(key))groups.set(key,{key,id:profile.id,label:profile.shape==='U_CHANNEL'?'U 型 8×8':`${profile.width}${profile.height} · ${profile.width}×${profile.height} mm`,models:[]});
    const group=groups.get(key);
    if(!group.models.some(item=>item.id===profile.id))group.models.push(profile);
  }
  return [...groups.values()];
}

export function getDesignProfileDefinition(id) {
  if(!id)return null;
  const standard=DesignProfileCatalog[id] || DesignProfileList.find(item=>item.nominal===String(id));
  if(standard)return standard;
  const catalog=getProfileDefinition(id);
  return catalog?catalogGeometry(catalog):null;
}

export function getDefaultDesignProfileId(nominal='3030') {
  return DesignProfileList.find(item=>item.nominal===String(nominal))?.id || 'DESIGN-3030';
}

export function getDesignProfileSlots(id,face=null) {
  const definition=getDesignProfileDefinition(id);
  if(!definition)return [];
  const closed=new Set(definition.defaultFaceClosures || []);
  const slots=definition.slotDefinitions.filter(slot=>!closed.has(slot.face));
  if(!face)return slots.map(slot=>({...slot}));
  const normalized=String(face).toUpperCase();
  return slots.filter(slot=>slot.face===normalized).map(slot=>({...slot}));
}

export function profileDesignDefinition(part) {
  return getDesignProfileDefinition(part?.designProfile?.profileId);
}

export function profileSeries(part) {
  return String(part?.designProfile?.series || profileDesignDefinition(part)?.series || '');
}

export function profileNominal(part) {
  const definition=profileDesignDefinition(part);
  return String(part?.designProfile?.nominal || definition?.nominal || '');
}

export function profileSlotWidth(part) {
  const definition=profileDesignDefinition(part);
  return Number(part?.designProfile?.slotWidth ?? definition?.slotWidth ?? 0);
}

export function profileDisplayName(part) {
  const definition=profileDesignDefinition(part);
  return definition?.name || `${part?.dimensions?.sectionSize?.[0] || 0}×${part?.dimensions?.sectionSize?.[1] || 0} 型材`;
}

export function isProfileFaceClosed(part,face) {
  const closed=new Set([...(profileDesignDefinition(part)?.defaultFaceClosures||[]),...(part?.designProfile?.faceClosures || [])].map(value=>String(value).toUpperCase()));
  return closed.has(String(face).toUpperCase());
}
