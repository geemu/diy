import {profileObb} from '../validation/PartCollisionDetector.js';
import {getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';

/** 只读层高：成员键仅辨认层归属，尺寸与世界高度读当前 Part，不用保存的生成高度替代实际位置。 */
export function rackLayerMeasurements(assembly,parts=[]) {
  if(assembly?.configurator!=='LAYERED_RACK'||!assembly.parameters?.memberIds)return null;
  const members=Object.entries(assembly.parameters.memberIds),byId=new Map(parts.map(part=>[part.id,part]));
  if(!members.some(([,id])=>byId.get(id)?.assemblyId===assembly.id))return null;
  const result={assemblyId:assembly.id,name:assembly.name||'框架',rows:[],bounds:null,error:'',hasPanels:false,unmeasuredPanels:false};
  const levels=Number(assembly.parameters.levels);
  if(!Number.isInteger(levels)||levels<2||levels>12){result.error='此架的层数记录不完整，暂不能自动显示层高';return result;}
  const layers=Array.from({length:levels},()=>[]),mappedIds=new Set();
  for(const [key,id] of members) {
    const part=byId.get(id);
    if(!part||part.assemblyId!==assembly.id){result.error='架体成员已缺失或移出组件，暂不能显示完整层高';return result;}
    const box=profileBounds(part);
    if(!box){result.error='架体含未适配的弯型材或无效尺寸，暂不能自动显示层高';return result;}
    mappedIds.add(id);result.bounds=unionBounds(result.bounds,box);
    const match=/^(?:WIDTH|DEPTH|CENTER):(\d+):/.exec(key);
    if(!match)continue;
    const index=Number(match[1]);
    if(index>=levels){result.error='层成员与当前层数不一致，暂不能自动显示层高';return result;}
    // 轴向水平、截面主轴竖直才能把包络上下界解释为承托面；倾斜架不伪报垂直净高。
    if(Math.abs(box.axes[2].y)>1e-6||Math.max(Math.abs(box.axes[0].y),Math.abs(box.axes[1].y))<1-1e-6){result.error=`第 ${index+1} 层梁已倾斜，层高仅支持水平承托面`;return result;}
    layers[index].push({part,box});
  }
  if(layers.some(layer=>!layer.length)){result.error='部分层没有可辨认的梁，暂不能显示完整层高';return result;}
  for(let index=0;index<levels;index++) {
    const beams=layers[index],top=Math.max(...beams.map(beam=>beam.box.max.y)),bottom=Math.min(...beams.map(beam=>beam.box.min.y));
    const partIds=beams.map(beam=>beam.part.id),ids=new Set(partIds);
    const row={index,label:`第 ${index+1} 层${index===0?' · 底层':index===levels-1?' · 顶层':''}`,partIds,heightMm:top,
      intervalMm:null,clearHeightMm:null,clearanceStartMm:top,clearanceEndMm:null,bottomMm:bottom,
      unevenMm:top-Math.min(...beams.map(beam=>beam.box.max.y)),hasPanels:false};
    // 只计已关联到这一层的水平板；不凭外观猜自由板材归属，也不把槽/孔或连接件当承托平面。
    for(const part of parts) {
      const source=part.panelSpec?.sourcePartIds;
      if(part.type!=='PANEL'||!source?.length||!source.every(id=>ids.has(id)))continue;
      const box=panelBounds(part);
      if(!box||Math.abs(box.axes[2].y)<1-1e-6){result.unmeasuredPanels=true;continue;}
      row.clearanceStartMm=Math.max(row.clearanceStartMm,box.max.y);
      row.bottomMm=Math.min(row.bottomMm,box.min.y);
      row.hasPanels=true;result.hasPanels=true;result.bounds=unionBounds(result.bounds,box);
    }
    result.rows.push(row);
  }
  for(let index=0;index<levels;index++) {
    const row=result.rows[index],next=result.rows[index+1];
    if(index)row.intervalMm=row.heightMm-result.rows[index-1].heightMm;
    if(next){row.clearanceEndMm=next.bottomMm;row.clearHeightMm=next.bottomMm-row.clearanceStartMm;}
  }
  result.unmappedMembers=parts.some(part=>part.assemblyId===assembly.id&&part.type==='PROFILE'&&!mappedIds.has(part.id));
  return result;
}

/** 表单规划副本与实际工程共用口径；不生成实体，不写 Project 或自动改变层高。 */
export function plannedRackLayerMeasurements(layout) {
  if(!layout)return null;
  const id='__rack_layer_plan__',memberIds={},parts=[];
  for(const member of layout.members) {
    const definition=getDesignProfileDefinition(member.catalogId);if(!definition)return null;
    memberIds[member.key]=member.key;
    parts.push({id:member.key,assemblyId:id,type:'PROFILE',position:member.position,rotation:member.rotation,
      dimensions:{sectionSize:definition.sectionSize,length:member.length},profilePath:{type:'LINE',length:member.length}});
  }
  return rackLayerMeasurements({id,name:'框架参数',configurator:'LAYERED_RACK',parameters:{...layout.parameters,memberIds}},parts);
}

export function rackDistanceText(value) {return Number.isFinite(value)?`${Math.round(value)} mm`:'—';}
export function rackClearanceText(row) {
  if(row.clearanceEndMm==null)return '顶部开放';
  if(!Number.isFinite(row.clearHeightMm))return '—';
  return row.clearHeightMm<-.1?`重叠 ${Math.round(-row.clearHeightMm)} mm`:rackDistanceText(Math.max(0,row.clearHeightMm));
}

function profileBounds(part) {
  if(part.type!=='PROFILE'||part.profilePath?.type&&part.profilePath.type!=='LINE')return null;
  const section=part.dimensions?.sectionSize||[part.dimensions?.size,part.dimensions?.size],length=Number(part.profilePath?.length??part.dimensions?.length);
  if(!section.every(value=>Number.isFinite(Number(value))&&Number(value)>0)||!Number.isFinite(length)||length<=0)return null;
  // profileObb内部会规范化路径；只传展示副本，不能因查看层高修改原 Part。
  const obb=profileObb({...part,dimensions:{...part.dimensions},profilePath:{...(part.profilePath||{}),type:'LINE',length:Math.max(1,length)}});
  if(obb)obb.half[2]=length/2;
  return boundsFromObb(obb);
}
function panelBounds(part) {
  const width=Number(part.dimensions?.width),height=Number(part.dimensions?.height),thickness=Number(part.dimensions?.thickness);
  if(![width,height,thickness].every(value=>Number.isFinite(value)&&value>0))return null;
  const obb=profileObb({type:'PROFILE',position:part.position,rotation:part.rotation,
    dimensions:{sectionSize:[width,height],length:thickness},profilePath:{type:'LINE',length:Math.max(1,thickness)}});
  // 只借用既有姿态轴；恢复真实板厚，不能被路径规范化的 1mm 下限加厚。
  if(obb)obb.half[2]=thickness/2;
  return boundsFromObb(obb);
}
function boundsFromObb(obb) {
  if(!obb)return null;
  const min={},max={};
  for(const axis of ['x','y','z']) {
    const extent=obb.axes.reduce((sum,direction,index)=>sum+Math.abs(direction[axis])*obb.half[index],0);
    min[axis]=obb.center[axis]-extent;max[axis]=obb.center[axis]+extent;
  }
  if(![...Object.values(min),...Object.values(max)].every(Number.isFinite))return null;
  return {min,max,axes:obb.axes};
}
function unionBounds(previous,box) {
  if(!previous)return {min:{...box.min},max:{...box.max}};
  for(const axis of ['x','y','z']){previous.min[axis]=Math.min(previous.min[axis],box.min[axis]);previous.max[axis]=Math.max(previous.max[axis],box.max[axis]);}
  return previous;
}
