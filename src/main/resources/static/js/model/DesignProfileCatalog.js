/**
 * 设计阶段型材目录。
 *
 * 这里只描述“玩家搭结构时必须知道的几何语义”：截面尺寸、槽宽、槽面和封边。
 * 欧标/国标、壁厚、米重、合金、供应商等制造属性不允许进入本目录。
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
    slotDefinitions:Object.freeze(buildSlots(Number(width),Number(height),Number(series),Number(slotWidth))),
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

export const DesignProfileList=Object.freeze(profiles);
export const DesignProfileCatalog=Object.freeze(Object.fromEntries(profiles.map(item=>[item.id,item])));

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
  const closed=new Set((part?.designProfile?.faceClosures || []).map(value=>String(value).toUpperCase()));
  return closed.has(String(face).toUpperCase());
}
