import {layeredRackLayout,RACK_LAYOUT_VERSION,RackProfileRoles} from './LayeredRackModel.js';

const STORAGE_KEY='diy-quick-frame-presets-v1';
const LIMIT=20,MAX_BYTES=65536;
const ROOT_FIELDS=['layoutVersion','catalogId','width','depth','height','levels','centerBeamCount','centerDirection',
  'bayCount','bayMode','topMount','bottomMount','sideMount','bottomClearance','manualLevelHeights','autoConnect'];
const LAYER_FIELDS=['heightMm','catalogId','centerCatalogId','centerBeamCount','centerDirection','leftSideMount','rightSideMount'];

/** 本机常用参数，不含工程、构件ID/位置/关系，不自动套用或写Project。 */
export default class QuickFramePresetStore {
  constructor(storageProvider=()=>globalThis.localStorage){this.storageProvider=storageProvider;}
  read(){
    const raw=this.storageProvider().getItem(STORAGE_KEY);
    if(!raw)return [];
    if(raw.length>MAX_BYTES)throw new Error('常用方案数据过大，原本机数据未覆盖');
    let data;try{data=JSON.parse(raw);}catch(_){throw new Error('常用方案数据无法读取，原本机数据未覆盖');}
    if(data?.version!==1||!Array.isArray(data.presets)||data.presets.length>LIMIT)throw new Error('常用方案格式不受支持，原本机数据未覆盖');
    const ids=new Set();
    return data.presets.map(row=>{
      if(typeof row?.id!=='string'||!row.id||row.id.length>128||ids.has(row.id))throw new Error('常用方案标识无效，原本机数据未覆盖');
      ids.add(row.id);
      return {id:row.id,name:validName(row.name),parameters:parameterFields(row.parameters)};
    });
  }
  parameters(input){
    const picked=parameterFields(input);
    // 明确套用参数才按当前新建规则检查，不重建或迁移已保存的旧架子。
    return parameterFields(layeredRackLayout({...picked,layoutVersion:RACK_LAYOUT_VERSION}).parameters);
  }
  save(name,input,id=null,expected=null){
    const entries=this.read(),parameters=this.parameters(input),label=validName(name);
    if(entries.some(row=>row.name===label&&row.id!==id))throw new Error('已有同名方案，请换名称或明确替换所选方案');
    const index=id?entries.findIndex(row=>row.id===id):-1;
    if(id&&index<0)throw new Error('所选方案已不存在，请重新选择');
    if(expected&&JSON.stringify(entries[index])!==JSON.stringify(expected))throw new Error('所选方案已在其他窗口更改，请刷新并重新确认');
    if(!id&&entries.length>=LIMIT)throw new Error(`最多保存${LIMIT}个常用方案，请先删除不需要的方案`);
    const entry={id:id||crypto.randomUUID(),name:label,parameters};
    if(index>=0)entries[index]=entry;else entries.push(entry);
    this.write(entries);return {entries,entry};
  }
  remove(id,expected=null){
    const entries=this.read();
    if(!entries.some(row=>row.id===id))throw new Error('所选方案已不存在，请重新选择');
    if(expected&&JSON.stringify(entries.find(row=>row.id===id))!==JSON.stringify(expected))throw new Error('所选方案已在其他窗口更改，请刷新并重新确认');
    const next=entries.filter(row=>row.id!==id);this.write(next);return next;
  }
  write(entries){
    const raw=JSON.stringify({version:1,presets:entries});
    if(raw.length>MAX_BYTES)throw new Error('常用方案数据过大，未保存');
    this.storageProvider().setItem(STORAGE_KEY,raw);
  }
}

function validName(value){
  if(typeof value!=='string'||!value.trim()||value.trim().length>60)throw new Error('方案名称请填写1~60个字');
  return value.trim();
}

function parameterFields(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('常用方案缺少搭建参数');
  const pick=(object,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(object,key)).map(key=>{
    const value=object[key];
    if(value!==null&&!['string','number','boolean'].includes(typeof value))throw new Error('常用方案参数格式无效');
    if(typeof value==='number'&&!Number.isFinite(value)||typeof value==='string'&&value.length>256)throw new Error('常用方案参数无效或过长');
    return [key,value];
  }));
  const output=pick(input,ROOT_FIELDS);
  if(typeof output.catalogId!=='string'||!output.catalogId||!['width','depth','height'].every(key=>typeof output[key]==='number'&&Number.isFinite(output[key])&&output[key]>0)||
    !Number.isInteger(output.levels)||output.levels<2||output.levels>12)throw new Error('常用方案缺少有效型号、尺寸或层数');
  for(const key of ['manualLevelHeights','autoConnect'])if(Object.hasOwn(output,key)&&typeof output[key]!=='boolean')throw new Error('常用方案开关参数无效');
  output.profileRoles=Object.fromEntries(RackProfileRoles.map(role=>{
    const value=input.profileRoles?.[role.id]||{};
    if(typeof value!=='object'||Array.isArray(value))throw new Error('常用方案部位选配格式无效');
    return [role.id,pick(value,['catalogId','quarterTurns'])];
  }));
  const layers=input.levelSettings||[];
  if(!Array.isArray(layers)||layers.length>12)throw new Error('常用方案逐层设置无效');
  output.levelSettings=layers.map(value=>{
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('常用方案逐层设置无效');
    return pick(value,LAYER_FIELDS);
  });
  return output;
}
