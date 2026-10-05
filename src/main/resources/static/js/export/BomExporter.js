import CsvExporter from './CsvExporter.js';
import {normalizeProfilePath,getPathMetrics,getPathLabel} from '../model/ProfilePath.js';
import {getSectionInfo} from '../model/ProfileSectionRegistry.js';
import {getHardwareDefinition} from '../model/HardwareCatalog.js';
import {profileDisplayName,profileNominal} from '../model/DesignProfileCatalog.js';

/**
 * Current manufacturing report source of truth.
 *
 * v0.38 deliberately does NOT model raw stock, offcuts, stock lengths or inventory.
 * It reports what the design contains and what must be cut/machined/assembled.
 */
export default class BomExporter {
  constructor(editor){this.editor=editor;}

  n(value){return Number(Number(value||0).toFixed(2));}
  code(part){return this.editor.manufacturingIdentityManager?.codeForPart(part)||part?.displayId||part?.id||'';}

  sig(part,withMachining=false){
    normalizeProfilePath(part);
    const dp=part.designProfile||{},path=part.profilePath||{};
    let key=[dp.profileId,part.manufacturingProfile?.profileId||'UNCONFIGURED',JSON.stringify(dp.faceClosures||[]),JSON.stringify(path),JSON.stringify(part.endCuts||{})].join('|');
    if(withMachining){
      const machining=structuredClone(part.machiningItems||[]).map(item=>{
        delete item.id;
        delete item.generatedByConnectionId;
        delete item.linkedHoleId;
        return item;
      }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
      key+='|'+JSON.stringify(machining);
    }
    return key;
  }

  groups(machiningOnly=false,parts=null){
    const map=new Map();
    const source=(parts||this.editor.parts).filter(part=>part.type==='PROFILE');
    for(const part of source){
        normalizeProfilePath(part);
      const has=(part.machiningItems||[]).length>0;
      if(machiningOnly&&!has)continue;
      const key=this.sig(part,machiningOnly);
      if(!map.has(key))map.set(key,{parts:[],length:Number(part.dimensions?.length||0),hasMachining:has});
      map.get(key).parts.push(part);
    }
    return [...map.values()];
  }

  assemblyPath(part){
    if(!part?.assemblyId)return '未分组';
    const manager=this.editor.assemblyManager;
    const current=manager?.get(part.assemblyId);
    if(!current)return `未知组件/${part.assemblyId}`;
    const chain=[...(manager.ancestors(part.assemblyId)||[])].reverse().map(id=>manager.get(id)?.name||id);
    chain.push(current.name||current.id);
    return chain.join(' / ');
  }

  detail(part){
    return (part.machiningItems||[]).map(item=>this.machiningLabel(item)).join('；');
  }

  machiningLabel(item){
    const face={FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'};
    const stage={STRAIGHT:'直料加工',BEND_BEFORE:'弯前加工',BEND_AFTER:'弯后加工'};
    const prefix=stage[item.processStage]||'';
    const end=item.end==='START'?'A端':'B端';
    if(item.type==='END_TAP')return `${prefix} ${end} ${item.tappingSize}攻丝 深${item.depth}`.trim();
    if(item.type==='END_HOLE')return `${prefix} ${end} Ø${item.diameter}端面孔 深${item.depth}`.trim();
    if(item.type==='END_COUNTERBORE')return `${prefix} ${end} Ø${item.diameter}端面沉孔 深${item.depth}`.trim();
    if(item.type==='END_COUNTERSINK')return `${prefix} ${end} Ø${item.majorDiameter}端面沉头 ${item.angleDeg||90}°`.trim();
    const station=this.n(item.stationS??item.distanceFromStart);
    const ref=item.referenceDatum?` 基准:${item.referenceDatum}`:'';
    if(item.type==='THROUGH_HOLE')return `${prefix} ${face[item.face]||item.face} S=${station} Ø${item.diameter}通孔${ref}`.trim();
    if(item.type==='COUNTERSINK')return `${prefix} ${face[item.face]||item.face} S=${station} Ø${item.majorDiameter??item.diameter}沉头${item.angleDeg?` ${item.angleDeg}°`:''}${ref}`.trim();
    if(item.type==='COUNTERBORE')return `${prefix} ${face[item.face]||item.face} S=${station} Ø${item.diameter}沉孔 深${item.depth}${ref}`.trim();
    if(item.type==='TAPPED_HOLE')return `${prefix} ${face[item.face]||item.face} S=${station} ${item.tappingSize}螺纹孔 深${item.depth}${ref}`.trim();
    if(item.type==='SLOT'||item.type==='OBROUND_SLOT')return `${prefix} ${face[item.face]||item.face} S=${station} ${item.type==='SLOT'?'槽':'腰孔'} ${item.length}×${item.width} ${item.orientation||''}${ref}`.trim();
    if(item.type==='MILLING_REGION')return `${prefix} ${face[item.face]||item.face} S=${station} 铣削 ${item.length}×${item.width} 深${item.depth}${ref}`.trim();
    return `${prefix} ${item.type} S=${station}${ref}`.trim();
  }

  buildBomRows(){return this.buildProfileBomRows();}

  buildProfileBomRows(parts=null){
    const rows=[['序号','设计截面','制造规格','体系','壁厚(mm)','制造槽宽(mm)','路径','展开/切割长度(mm)','数量','总长度(mm)','加工','构件编号']];
    let index=1;
    for(const group of this.groups(false,parts)){
      const part=group.parts[0],mp=part.manufacturingProfile||{},metrics=getPathMetrics(part);
      rows.push([index++,profileDisplayName(part),mp.name||'待配置',mp.system||'待配置',mp.wallThickness??'',mp.slotWidth??'',getPathLabel(part),this.n(metrics.developedLength),group.parts.length,this.n(metrics.developedLength*group.parts.length),group.hasMachining?'有':'无',group.parts.map(item=>this.code(item)).join(' / ')]);
    }
    return rows;
  }

  /** One row per physical profile piece. No raw-stock optimization semantics. */
  buildCutListRows(parts=null){
    const rows=[['序号','构件编号','组件路径','设计截面','截面尺寸','路径类型','切割/展开长度(mm)','中心半径R(mm)','角度(°)','弯曲平面','A端切','B端切','加工','备注']];
    const source=(parts||this.editor.parts).filter(part=>part.type==='PROFILE');
    let index=1;
    for(const part of source){
      normalizeProfilePath(part);
      const metrics=getPathMetrics(part),cuts=part.endCuts||{};
      const cutLabel=end=>`${Number(end?.angleDeg||0)}°/${end?.axis==='Y'?'Y':'X'}`;
      rows.push([index++,this.code(part),this.assemblyPath(part),profileDisplayName(part),profileNominal(part),metrics.type,this.n(metrics.developedLength),metrics.radius||'',metrics.angleDeg||'',metrics.plane||'',cutLabel(cuts.START),cutLabel(cuts.END),(part.machiningItems||[]).length?'需加工':'',part.note||'']);
    }
    return rows;
  }

  buildCutSummaryRows(parts=null){
    const rows=[['切割组','设计截面','截面尺寸','路径','A端切','B端切','切割/展开长度(mm)','数量','总长度(mm)','构件编号']];
    let index=1;
    for(const group of this.groups(false,parts)){
      const part=group.parts[0],metrics=getPathMetrics(part),cuts=part.endCuts||{};
      const cutLabel=end=>`${Number(end?.angleDeg||0)}°/${end?.axis==='Y'?'Y':'X'}`;
      rows.push([`C-${String(index++).padStart(3,'0')}`,profileDisplayName(part),profileNominal(part),getPathLabel(part),cutLabel(cuts.START),cutLabel(cuts.END),this.n(metrics.developedLength),group.parts.length,this.n(metrics.developedLength*group.parts.length),group.parts.map(item=>this.code(item)).join(' / ')]);
    }
    return rows;
  }

  buildMachiningRows(){
    const rows=[['加工组','设计截面','截面尺寸','长度(mm)','数量','构件编号','加工明细']];
    let index=1;
    for(const group of this.groups(true)){
      const part=group.parts[0];
      rows.push([`M-${String(index++).padStart(3,'0')}`,profileDisplayName(part),profileNominal(part),this.n(part.dimensions.length),group.parts.length,group.parts.map(item=>this.code(item)).join(' / '),this.detail(part)]);
    }
    return rows;
  }

  /** One row per machining feature instance. */
  buildMachiningDetailRows(parts=null){
    const rows=[['序号','构件编号','组件路径','截面型号','加工项编号','加工类型','加工面/端','S(mm)','偏移(mm)','基准','槽位','工序','参数','连接派生']];
    const source=(parts||this.editor.parts).filter(part=>part.type==='PROFILE');
    let index=1;
    for(const part of source){
      for(const item of part.machiningItems||[]){
        const faceOrEnd=item.end ? (item.end==='START'?'A端':'B端') : (item.face||'');
        rows.push([index++,this.code(part),this.assemblyPath(part),profileDisplayName(part),this.editor.manufacturingIdentityManager?.codeForMachining(item)||item.id||'',item.type||'',faceOrEnd,item.stationS??item.distanceFromStart??'',item.offset??'',item.referenceDatum||'',item.reference?.slotId||'',item.processStage||'',this.machiningLabel(item),item.generatedByConnectionId||'']);
      }
    }
    return rows;
  }

  /** Aggregated feature-count BOM for manufacturing planning. */
  buildMachiningBomRows(parts=null){
    const map=new Map();
    const source=(parts||this.editor.parts).filter(part=>part.type==='PROFILE');
    for(const part of source){
      for(const item of part.machiningItems||[]){
        const clone=structuredClone(item);
        for(const key of ['id','generatedByConnectionId','linkedHoleId','patternSourceId','featureGroupId','stationS','distanceFromStart','offset','reference','referenceDatum'])delete clone[key];
        const key=JSON.stringify(clone);
        if(!map.has(key))map.set(key,{item,parts:[]});
        map.get(key).parts.push(part);
      }
    }
    const rows=[['序号','加工类型','加工面/端','规格参数','数量','构件编号']];
    let index=1;
    for(const group of map.values())rows.push([index++,group.item.type||'',group.item.end?(group.item.end==='START'?'A端':'B端'):(group.item.face||''),this.machiningLabel(group.item),group.parts.length,group.parts.map(part=>this.code(part)).join(' / ')]);
    return rows;
  }

  buildHardwareBomRows(parts=null){
    const source=(parts||this.editor.parts).filter(part=>part.type==='ACCESSORY'&&part.hardwareSpec?.source!=='ACCESSORY_CATALOG');
    const rows=[['序号','SKU','类别','名称','螺纹','尺寸','材质','数量','自动生成','连接编号','槽位引用','构件编号']];
    const groups=new Map();
    for(const part of source){
      const definition=getHardwareDefinition(part.hardwareSku);
      const sku=part.hardwareSku||part.accessoryType||'ACCESSORY';
      if(!groups.has(sku))groups.set(sku,{sku,definition,parts:[],connectionIds:new Set(),mounts:[]});
      const group=groups.get(sku);group.parts.push(part);
      if(part.generatedByConnectionId)group.connectionIds.add(part.generatedByConnectionId);
      if(part.mountReference)group.mounts.push(part.mountReference);
    }
    let index=1;
    for(const group of groups.values()){
      const d=group.definition||{},size=hardwareSizeLabel(d,group.parts[0]);
      const mounts=[...new Set(group.mounts.map(ref=>`${ref.face||''}/${ref.slotId||''}@S${this.n(ref.stationS||0)}`))].join('；');
      const connectionIds=[...group.connectionIds].map(id=>this.editor.manufacturingIdentityManager?.codeForConnection(this.editor.connectionManager?.connections?.find(item=>item.id===id))||id);
      rows.push([index++,group.sku,d.category||group.parts[0].hardwareSpec?.category||'配件',d.label||group.parts[0].name||group.sku,d.thread||'',size,d.material||group.parts[0].hardwareSpec?.material||'',group.parts.length,connectionIds.length?'是':'否',connectionIds.join(' / '),mounts,group.parts.map(part=>this.code(part)).join(' / ')]);
    }
    return rows;
  }

  buildAccessoryBomRows(parts=null){
    const source=(parts||this.editor.parts).filter(part=>part.type==='ACCESSORY'&&part.hardwareSpec?.source==='ACCESSORY_CATALOG');
    const rows=[['序号','分类','型号','名称','尺寸','材质','单位','数量','安装规则','构件编号']];
    const groups=new Map();
    for(const part of source){
      const model=part.hardwareSpec?.model||part.hardwareSku||part.accessoryType||'ACCESSORY';
      if(!groups.has(model))groups.set(model,{model,parts:[]});
      groups.get(model).parts.push(part);
    }
    let index=1;
    for(const group of groups.values()){
      const part=group.parts[0];
      const descriptor=describeGenericPart(part)||{};
      const mountRule=part.mountRule ? JSON.stringify(part.mountRule) : '';
      rows.push([index++,part.hardwareSpec?.category||'配件',group.model,part.name||group.model,descriptor.size||'',part.hardwareSpec?.material||'',part.hardwareSpec?.unit||'个',group.parts.length,mountRule,group.parts.map(item=>this.code(item)).join(' / ')]);
    }
    return rows;
  }

  buildMaterialRows(parts=null){
    const source=parts||this.editor.parts;
    const rows=[['序号','类别','设计截面','制造规格','体系/材质','长度/尺寸','数量','构件编号','备注']];
    let index=1;
    for(const group of this.groups(false,source)){
      const part=group.parts[0],metrics=getPathMetrics(part),mp=part.manufacturingProfile||{};
      const material=[mp.system,mp.alloy,mp.wallThickness?`壁厚${mp.wallThickness}mm`:null].filter(Boolean).join(' · ') || '待配置';
      rows.push([index++,'型材',profileDisplayName(part),mp.name||'待配置',material,`展开 ${this.n(metrics.developedLength)} mm`,group.parts.length,group.parts.map(item=>this.code(item)).join(' / '),group.hasMachining?'需加工':'']);
    }
    const genericGroups=new Map();
    for(const part of source.filter(part=>part.type!=='PROFILE')){
      const descriptor=describeGenericPart(part);
      if(!descriptor)continue;
      const key=[part.type,descriptor.spec,descriptor.size,descriptor.material].join('|');
      if(!genericGroups.has(key))genericGroups.set(key,{...descriptor,parts:[]});
      genericGroups.get(key).parts.push(part);
    }
    for(const group of genericGroups.values())rows.push([index++,group.category,'-',group.spec,group.material,group.size,group.parts.length,group.parts.map(part=>this.code(part)).join(' / '),'']);
    return rows;
  }

  buildSubassemblyBomRows(){
    const rows=[['组件路径','安装顺序','类别','规格/型号','尺寸/长度','数量','构件编号','加工/备注']];
    const buckets=new Map();
    for(const part of this.editor.parts){
      const path=this.assemblyPath(part);
      const desc=describeBomPart(part,this);
      const key=[path,desc.category,desc.spec,desc.size,desc.note].join('|');
      if(!buckets.has(key))buckets.set(key,{path,desc,parts:[]});
      buckets.get(key).parts.push(part);
    }
    const stepFor=part=>part.assemblyId?Number(this.editor.assemblyManager?.get(part.assemblyId)?.installationStep||0):0;
    for(const bucket of [...buckets.values()].sort((a,b)=>a.path.localeCompare(b.path,'zh-CN'))){
      const first=bucket.parts[0];
      rows.push([bucket.path,stepFor(first)||'',bucket.desc.category,bucket.desc.spec,bucket.desc.size,bucket.parts.length,bucket.parts.map(part=>this.code(part)).join(' / '),bucket.desc.note]);
    }
    return rows;
  }

  buildProjectSummaryRows(){
    const summary=this.buildSummary();
    return [
      ['指标','数值','单位'],
      ['型材件数',summary.profileCount,'件'],
      ['型材规格组',summary.profileGroupCount,'组'],
      ['型材总展开长度',summary.totalProfileLengthMm,'mm'],
      ['五金/附件件数',summary.hardwareCount,'件'],
      ['五金 SKU',summary.hardwareSkuCount,'种'],
      ['加工 Feature',summary.machiningFeatureCount,'项'],
      ['需加工型材',summary.machiningProfileCount,'件'],
      ['装配组件',summary.assemblyCount,'个'],
      ['项目总构件',summary.partCount,'件']
    ];
  }

  buildSummary(){
    const profiles=this.editor.parts.filter(part=>part.type==='PROFILE');
    const accessories=this.editor.parts.filter(part=>part.type==='ACCESSORY');
    const totalProfileLengthMm=this.n(profiles.reduce((sum,part)=>sum+Number(getPathMetrics(part).developedLength||0),0));
    const machiningFeatureCount=profiles.reduce((sum,part)=>sum+(part.machiningItems||[]).length,0);
    return {
      partCount:this.editor.parts.length,
      profileCount:profiles.length,
      profileGroupCount:this.groups(false).length,
      totalProfileLengthMm,
      hardwareCount:accessories.length,
      hardwareSkuCount:new Set(accessories.map(part=>part.hardwareSku||part.accessoryType||'ACCESSORY')).size,
      machiningFeatureCount,
      machiningProfileCount:profiles.filter(part=>(part.machiningItems||[]).length>0).length,
      assemblyCount:this.editor.assemblyManager?.assemblies?.length||0
    };
  }

  validateConsistency(){
    const errors=[],warnings=[],infos=[];
    const ids=new Set(),displayIds=new Set();
    const assemblyIds=new Set((this.editor.assemblyManager?.assemblies||[]).map(item=>item.id));
    for(const part of this.editor.parts){
      if(!part?.id)errors.push({code:'BOM_PART_ID_MISSING',severity:'ERROR',subject:part?.displayId||'未知构件',message:'构件缺少稳定 id，无法进行 BOM 追溯'});
      else if(ids.has(part.id))errors.push({code:'BOM_DUPLICATE_PART_ID',severity:'ERROR',subject:part.id,message:'存在重复构件 id'});
      else ids.add(part.id);
      if(part?.displayId){
        if(displayIds.has(part.displayId))warnings.push({code:'BOM_DUPLICATE_DISPLAY_ID',severity:'WARNING',subject:part.displayId,message:'存在重复构件编号，建议重新编号'});
        displayIds.add(part.displayId);
      }
      if(part?.assemblyId&&!assemblyIds.has(part.assemblyId))errors.push({code:'BOM_DANGLING_ASSEMBLY',severity:'ERROR',subject:this.code(part),message:`构件引用不存在的组件 ${part.assemblyId}`});
      if(part?.type==='PROFILE'){
        const length=Number(getPathMetrics(part).developedLength||0);
        if(!Number.isFinite(length)||length<=0)errors.push({code:'BOM_INVALID_PROFILE_LENGTH',severity:'ERROR',subject:this.code(part),message:'型材切割/展开长度必须大于 0'});
      }
    }
    const summary=this.buildSummary();
    const groupedProfileCount=this.groups(false).reduce((sum,group)=>sum+group.parts.length,0);
    if(groupedProfileCount!==summary.profileCount)errors.push({code:'BOM_PROFILE_COUNT_MISMATCH',severity:'ERROR',subject:'型材BOM',message:`模型 ${summary.profileCount} 件，BOM 汇总 ${groupedProfileCount} 件`});
    if(!errors.length)infos.push({code:'BOM_MODEL_CONSISTENT',severity:'INFO',subject:'BOM一致性',message:`模型与 BOM 数量一致：${summary.partCount} 个构件，${summary.profileCount} 根型材，${summary.machiningFeatureCount} 项加工`});
    return {ok:errors.length===0,errors,warnings,infos,summary};
  }

  static consistencyText(result){
    const lines=['BOM 一致性报告','',`结果：${result.ok?'通过':'失败'}`,`ERROR: ${result.errors.length}`,`WARNING: ${result.warnings.length}`,''];
    for(const group of [['ERROR',result.errors],['WARNING',result.warnings],['INFO',result.infos]]){
      if(!group[1].length)continue;
      lines.push(`[${group[0]}]`);
      for(const item of group[1])lines.push(`- ${item.code} | ${item.subject}: ${item.message}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  static fileText(rows){return '\uFEFF'+CsvExporter.build(rows);}
}

function describeBomPart(part,bom){
  if(part.type==='PROFILE'){
    normalizeProfilePath(part);
    const metrics=getPathMetrics(part);
    return {category:'设计型材',spec:profileDisplayName(part),size:`${profileNominal(part)} / ${bom.n(metrics.developedLength)}mm`,note:(part.machiningItems||[]).length?bom.detail(part):''};
  }
  const generic=describeGenericPart(part);
  return generic ? {category:generic.category,spec:generic.spec,size:generic.size,note:''} : {category:part.type||'构件',spec:part.name||'',size:'',note:''};
}

function describeGenericPart(part){
  let spec='',size='',material=part.materialSpec?.material||'',category=part.type;
  if(part.type==='SHAFT'){category='光轴';spec=`Ø${part.dimensions?.diameter||''}`;size=`L${part.dimensions?.length||''}mm`;}
  else if(part.type==='PANEL'){category='板材';spec=part.name||'板材';size=`${part.dimensions?.width||''}×${part.dimensions?.height||''}×${part.dimensions?.thickness||''}mm`;}
  else if(part.type==='ACCESSORY'){
    category=part.hardwareSpec?.category||'配件';
    const definition=getHardwareDefinition(part.hardwareSku);
    spec=definition?.label||part.name||part.hardwareSku||part.accessoryType||'配件';
    if(part.accessoryType==='DRAWER_SLIDE')size=`L${part.dimensions?.length||''}×${part.dimensions?.height||''}×${part.dimensions?.width||''}mm`;
    else if(part.accessoryType==='SOCKET_SCREW')size=`Ø${part.dimensions?.diameter||''}×${part.dimensions?.length||''}mm`;
    else if(part.accessoryType==='END_CAP')size=`${part.dimensions?.size||''}×${part.dimensions?.size||''}×${part.dimensions?.thickness||''}mm`;
    else size=hardwareSizeLabel(definition||{},part)||`${part.dimensions?.size||''}mm`;
    material=part.hardwareSpec?.material||material;
  } else return null;
  return {category,spec,size,material};
}

function hardwareSizeLabel(definition,part){
  if(definition.accessoryType==='SOCKET_SCREW')return `M${definition.diameter}×${definition.length}`;
  if(definition.accessoryType==='T_NUT')return definition.thread||'';
  if(definition.accessoryType==='WASHER')return `Ø${definition.outerDiameter}/Ø${definition.innerDiameter}×${definition.thickness}`;
  if(definition.accessoryType==='CONNECTION_PLATE')return `${definition.width}×${definition.height}×${definition.thickness}mm`;
  if(definition.accessoryType==='CASTER')return `Ø${definition.wheelDiameter}×${definition.wheelWidth}mm`;
  if(definition.accessoryType==='LEVELING_FOOT')return `${definition.thread||''} / Ø${definition.footDiameter}`;
  if(definition.accessoryType==='HINGE')return `${definition.width||40}×${definition.height||40}×${definition.thickness||4}mm`;
  if(definition.accessoryType==='HANDLE')return `L${definition.length||120} / H${definition.standOff||28}mm`;
  if(definition.size)return `${definition.size}mm`;
  return part?.dimensions?.size?`${part.dimensions.size}mm`:'';
}
