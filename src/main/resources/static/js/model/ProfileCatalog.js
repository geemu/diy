const WALL_20 = Object.freeze([1.2, 1.5, 1.8, 2.0]);
const WALL_30 = Object.freeze([1.4, 1.5, 1.6, 1.8, 2.0]);
const WALL_40 = Object.freeze([1.5, 1.8, 2.0, 2.5, 3.0]);
const WALL_45 = Object.freeze([1.8, 2.0, 2.5, 3.0]);
const WALL_60 = Object.freeze([2.0, 2.5, 3.0, 4.0]);
const WALL_80 = Object.freeze([2.5, 3.0, 4.0, 5.0]);

function v(id, nominal, variant, width, height, series, slotWidth, walls, defaultWall, options = {}) {
  const defaultFaceClosures=options.defaultFaceClosures||(options.crossSectionStyle==='ROUND_CORNER'?['FRONT','RIGHT']:[]);
  return Object.freeze({
    id,
    nominal,
    variant,
    code: variant,
    name: options.name || `工业铝型材 ${variant}`,
    series,
    system: options.system || '欧标',
    sectionSize: Object.freeze([width, height]),
    slotWidth,
    slotDefinitions: Object.freeze(buildSlotDefinitions(width,height,series,slotWidth,options.slotDefinitions).filter(slot=>!defaultFaceClosures.includes(slot.face))),
    defaultFaceClosures:Object.freeze([...defaultFaceClosures]),
    slotModel: options.slotModel || 'CATALOG_EXPLICIT',
    wallThicknessOptions: Object.freeze([...walls]),
    defaultWallThickness: defaultWall,
    alloy: options.alloy || 'A6063-T5',
    crossSectionStyle: options.crossSectionStyle || 'CATALOG_VARIANT',
    sourceFamily: options.sourceFamily || 'COMMON_MARKET',
    note: options.note || '同名规格不同厂家可能存在内腔、筋位、圆角和实际壁厚差异，生产前以实际截面图/DXF为准。'
  });
}


function buildSlotDefinitions(width,height,series,slotWidth,explicit) {
  // 数据库目录显式传空数组时表示“该截面没有 T 槽”；undefined 才表示使用标准槽位推导。
  if (Array.isArray(explicit)) {
    return Object.freeze(explicit.map((slot,index)=>Object.freeze({
      id:String(slot.id || `SLOT-${index+1}`),
      face:String(slot.face || 'FRONT').toUpperCase(),
      index:Number(slot.index ?? index),
      offset:Number(slot.offset || 0),
      width:Number(slot.width || slotWidth || 0),
      source:slot.source || 'CATALOG_EXPLICIT'
    })));
  }
  const result=[];
  const addFace=(face,span)=>{
    const offsets=standardSlotOffsets(span,Number(series||span||30));
    offsets.forEach((offset,index)=>result.push(Object.freeze({
      id:`${face}-S${index+1}`,
      face,
      index,
      offset,
      width:Number(slotWidth||0),
      source:'CATALOG_STANDARD'
    })));
  };
  addFace('FRONT',Number(width));
  addFace('BACK',Number(width));
  addFace('LEFT',Number(height));
  addFace('RIGHT',Number(height));
  return Object.freeze(result);
}

function standardSlotOffsets(span,series) {
  const safeSpan=Math.max(1,Number(span||1));
  const safeSeries=Math.max(1,Number(series||safeSpan));
  const count=Math.max(1,Math.round(safeSpan/safeSeries));
  if(count===1)return [0];
  const offsets=[];
  for(let index=0;index<count;index++) offsets.push((index-(count-1)/2)*safeSeries);
  return offsets.filter(value=>Math.abs(value)<=safeSpan/2-safeSeries*0.25+1e-6);
}

const variants = [
  v('EU20-2020','2020','2020',20,20,'20',6,WALL_20,1.5),
  // TXCJ 欧标 20 第 1 页：A 下侧封闭，B 下侧与右侧封闭；不按字母跨系列猜测。
  v('EU20-2020A','2020','2020A',20,20,'20',6,WALL_20,1.5,{sourceFamily:'JLCFA_TXCJ_20',defaultFaceClosures:['BACK']}),
  v('EU20-2020B','2020','2020B',20,20,'20',6,WALL_20,1.8,{sourceFamily:'JLCFA_TXCJ_20',defaultFaceClosures:['BACK','RIGHT']}),
  v('EU20-2040','2040','2040',20,40,'20',6,WALL_20,1.8),
  v('EU20-2060','2060','2060',20,60,'20',6,WALL_20,2.0),
  v('EU20-2080','2080','2080',20,80,'20',6,WALL_20,2.0),

  v('EU30-3030','3030','3030',30,30,'30',8.2,WALL_30,1.8,{sourceFamily:'JLCFA_TXCK_30'}),
  // 嘉立创 TXCK 欧标 30 目录第 1 页：下=BACK、上=FRONT、右=RIGHT。
  v('EU30-3030A','3030','3030A',30,30,'30',8.2,WALL_30,1.8,{sourceFamily:'JLCFA_TXCK_30',defaultFaceClosures:['BACK']}),
  v('EU30-3030B','3030','3030B',30,30,'30',8.2,WALL_30,1.8,{sourceFamily:'JLCFA_TXCK_30',defaultFaceClosures:['BACK','RIGHT']}),
  v('EU30-3030C','3030','3030C',30,30,'30',8.2,WALL_30,1.8,{sourceFamily:'JLCFA_TXCK_30'}),
  v('EU30-3030G','3030','3030G',30,30,'30',8.2,WALL_30,1.8,{sourceFamily:'JLCFA_TXCK_30'}),
  v('EU30-3030H','3030','3030H',30,30,'30',8.2,WALL_30,2.0,{sourceFamily:'JLCFA_TXCK_30',defaultFaceClosures:['FRONT','BACK']}),
  v('EU30-3030R','3030','3030R',30,30,'30',8.2,WALL_30,1.8,{crossSectionStyle:'ROUND_CORNER',sourceFamily:'JLCFA_TXCK_30'}),
  v('EU30-3030T','3030','3030T',30,30,'30',8.2,WALL_30,1.8,{sourceFamily:'JLCFA_TXCK_30',defaultFaceClosures:['FRONT','BACK','RIGHT']}),
  v('EU30-3030X','3030','3030X',30,30,'30',8.2,WALL_30,1.8,{sourceFamily:'JLCFA_TXCK_30'}),
  v('EU30-J3030','3030','J3030',30,30,'30',8.2,WALL_30,1.8,{sourceFamily:'JLCFA_TXCK_30'}),
  v('EU30-J3030R','3030','J3030R',30,30,'30',8.2,WALL_30,1.8,{crossSectionStyle:'ROUND_CORNER',sourceFamily:'JLCFA_TXCK_30'}),
  v('EU30-3060','3060','3060',30,60,'30',8.2,WALL_30,2.0,{sourceFamily:'JLCFA_TXCK_30'}),
  // 第 2 页 60×30 横向图旋转 90° 后映射到目录的 30×60 局部截面。
  v('EU30-3060A','3060','3060A',30,60,'30',8.2,WALL_30,2.0,{sourceFamily:'JLCFA_TXCK_30',defaultFaceClosures:['RIGHT']}),
  v('EU30-3060B','3060','3060B',30,60,'30',8.2,WALL_30,2.0,{sourceFamily:'JLCFA_TXCK_30',defaultFaceClosures:['LEFT','RIGHT','FRONT']}),
  v('EU30-3090','3090','3090',30,90,'30',8.2,WALL_30,2.0,{sourceFamily:'JLCFA_TXCK_30'}),
  v('EU30-30120','30120','30120',30,120,'30',8.2,WALL_30,2.0,{sourceFamily:'JLCFA_TXCK_30'}),

  v('EU40-4040','4040','4040',40,40,'40',8,WALL_40,2.0),
  // TXCL 欧标 40 第 4 页：F 四面开槽，H 上下封闭，T 上下与右侧封闭。
  v('EU40-4040F','4040','4040F',40,40,'40',8,WALL_40,2.0,{sourceFamily:'JLCFA_TXCL_40'}),
  v('EU40-4040H','4040','4040H',40,40,'40',8,WALL_40,2.5,{sourceFamily:'JLCFA_TXCL_40',defaultFaceClosures:['FRONT','BACK']}),
  v('EU40-4040T','4040','4040T',40,40,'40',8,WALL_40,2.0,{sourceFamily:'JLCFA_TXCL_40',defaultFaceClosures:['FRONT','BACK','RIGHT']}),
  v('EU40-4080','4080','4080',40,80,'40',8,WALL_40,2.0),
  v('EU40-4080H','4080','4080H',40,80,'40',8,WALL_40,2.5),
  v('EU40-40120','40120','40120',40,120,'40',8,WALL_40,2.5),
  v('EU40-40160','40160','40160',40,160,'40',8,WALL_40,3.0),

  v('EU45-4545','4545','4545',45,45,'45',10,WALL_45,2.0),
  v('EU45-4590','4590','4590',45,90,'45',10,WALL_45,2.5),
  v('EU60-6060','6060','6060',60,60,'60',10,WALL_60,2.5),
  v('EU60-6060S','6060','6060S',60,60,'60',10,WALL_60,2.5),
  v('EU60-6090','6090','6090',60,90,'60',10,WALL_60,3.0),
  v('EU60-60120','60120','60120',60,120,'60',10,WALL_60,3.0),
  v('EU80-8080','8080','8080',80,80,'80',10,WALL_80,3.0),

  v('CUSTOM-3030','3030','自定义3030',30,30,'30',8,WALL_30,2.0,{system:'自定义',sourceFamily:'CUSTOM',name:'自定义 3030 截面'})
];

export const ProfileCatalogList = [...variants];
export const ProfileCatalog = Object.fromEntries(variants.map(item => [item.id, item]));
export const ProfileSystemOptions = Object.freeze(['欧标','国标','自定义']);
export const NominalProfileOptions = Object.freeze([...new Set(variants.map(item => item.nominal))]);


export function buildCatalogSlotDefinitions(width,height,series,slotWidth) {
  return buildSlotDefinitions(Number(width),Number(height),series,Number(slotWidth),undefined).map(slot=>({...slot}));
}

export function registerProfileDefinition(input) {
  if (!input?.id || !input?.variant || !Array.isArray(input.sectionSize) || input.sectionSize.length < 2) {
    throw new Error('自定义型材缺少 id / variant / sectionSize');
  }
  const wallOptions = Array.isArray(input.wallThicknessOptions) && input.wallThicknessOptions.length
    ? input.wallThicknessOptions.map(Number).filter(Number.isFinite)
    : [Number(input.defaultWallThickness || 2)];
  const definition = Object.freeze({
    id:String(input.id),
    nominal:String(input.nominal || input.variant),
    variant:String(input.variant),
    code:String(input.code || input.variant),
    name:String(input.name || `工业铝型材 ${input.variant}`),
    series:String(input.series || input.nominal || ''),
    system:String(input.system || '自定义'),
    sectionSize:Object.freeze([Number(input.sectionSize[0]),Number(input.sectionSize[1])]),
    slotWidth:Number(input.slotWidth || 8),
    slotDefinitions:buildSlotDefinitions(Number(input.sectionSize[0]),Number(input.sectionSize[1]),input.series,input.slotWidth,input.slotDefinitions),
    slotModel:input.slotModel || 'CATALOG_EXPLICIT',
    defaultFaceClosures:Object.freeze([...(input.defaultFaceClosures||[])]),
    wallThicknessOptions:Object.freeze(wallOptions.length ? wallOptions : [2]),
    defaultWallThickness:Number(input.defaultWallThickness || wallOptions[0] || 2),
    alloy:input.alloy || 'A6063-T5',
    crossSectionStyle:input.crossSectionStyle || 'DATABASE_CUSTOM',
    sourceFamily:input.sourceFamily || 'DATABASE',
    note:input.note || '数据库自定义型材',
    custom:input.custom === true || input.sourceFamily === 'DATABASE',
    enabled:input.enabled !== false,
    sortOrder:Number(input.sortOrder ?? 1000)
  });
  const existingIndex=ProfileCatalogList.findIndex(item=>item.id===definition.id);
  if(existingIndex>=0) ProfileCatalogList.splice(existingIndex,1,definition);
  else ProfileCatalogList.push(definition);
  ProfileCatalog[definition.id]=definition;
  return definition;
}

export function unregisterProfileDefinition(id) {
  const index=ProfileCatalogList.findIndex(item=>item.id===id);
  if(index>=0) ProfileCatalogList.splice(index,1);
  delete ProfileCatalog[id];
}

export function registerProfileDefinitions(items=[]) {
  return (items||[]).map(registerProfileDefinition);
}

export function getProfileDefinition(id) {
  if (!id) return null;
  if (ProfileCatalog[id]) return ProfileCatalog[id];
  return ProfileCatalogList.find(item => item.variant === id || item.nominal === id) || null;
}


export function getProfileSlotDefinitions(id,face=null) {
  const definition=getProfileDefinition(id);
  const slots=definition?.slotDefinitions || [];
  if(!face)return slots.map(slot=>({...slot}));
  const normalized=String(face).toUpperCase();
  return slots.filter(slot=>slot.face===normalized).map(slot=>({...slot}));
}

export function getVariantsForNominal(nominal) {
  return ProfileCatalogList.filter(item => item.nominal === nominal);
}

export function getDefaultVariantId(nominal) {
  const list = getVariantsForNominal(nominal);
  return list.length ? list[0].id : ProfileCatalogList[0].id;
}

export function inferProfileDefinition(sectionSize) {
  if (!Array.isArray(sectionSize) || sectionSize.length < 2) return null;
  const a = Number(sectionSize[0]);
  const b = Number(sectionSize[1]);
  return ProfileCatalogList.find(item => {
    const [w,h] = item.sectionSize;
    return (w === a && h === b) || (w === b && h === a);
  }) || null;
}

export function getWallThicknessOptions(id) {
  return [...(getProfileDefinition(id)?.wallThicknessOptions || [1.5,1.8,2.0,2.5,3.0])];
}

export function normalizeProfilePart(part) {
  if (!part || part.type !== 'PROFILE') return part;
  const oldId = part.profileSpec?.catalogId;
  const inferred = getProfileDefinition(oldId) || inferProfileDefinition(part.dimensions?.sectionSize);
  const def = inferred || ProfileCatalogList[0];
  part.profileSpec = {
    catalogId: def.id,
    nominal: part.profileSpec?.nominal || def.nominal,
    variant: part.profileSpec?.variant || def.variant,
    system: part.profileSpec?.system || def.system,
    wallThickness: Number(part.profileSpec?.wallThickness || def.defaultWallThickness),
    slotWidth: Number(part.profileSpec?.slotWidth || def.slotWidth),
    alloy: part.profileSpec?.alloy || def.alloy,
    crossSectionStyle: part.profileSpec?.crossSectionStyle || def.crossSectionStyle,
    sourceFamily: part.profileSpec?.sourceFamily || def.sourceFamily,
    note: part.profileSpec?.note || def.note
  };
  part.dimensions = part.dimensions || {};
  part.dimensions.sectionSize = [...def.sectionSize];
  part.dimensions.size = def.sectionSize[0];
  return part;
}
