/**
 * 设计阶段型材目录。
 *
 * 这里只描述“玩家搭结构时必须知道的几何语义”：截面尺寸、槽宽、槽面和封边。
 * 欧标名称仅用作用户要求的截面系列展示；壁厚、米重、合金和供应商仍在制造阶段配置。
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
const namedProfiles=profiles.map(item=>referenceNominals.has(item.nominal)?Object.freeze({...item,name:`欧标${item.width}x${item.height}`}):item);

export const DesignProfileList=Object.freeze(namedProfiles);
export const DesignProfileCatalog=Object.freeze(Object.fromEntries(namedProfiles.map(item=>[item.id,item])));

export function getDesignProfileDefinition(id) {
  if(!id)return null;
  return DesignProfileCatalog[id] || DesignProfileList.find(item=>item.nominal===String(id)) || null;
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
