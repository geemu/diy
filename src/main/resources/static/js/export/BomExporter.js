import CsvExporter from './CsvExporter.js';
import {normalizeProfilePath,getPathMetrics,getPathLabel} from '../model/ProfilePath.js';
import {getSectionInfo,getSectionDefinition,sectionToSvg} from '../model/ProfileSectionRegistry.js';
import {getHardwareDefinition} from '../model/HardwareCatalog.js';
import {profileDisplayName,profileNominal,getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';
import {getProfileDefinition} from '../model/ProfileCatalog.js';
import {ConnectionComponentOptions,ProfileReferenceOptions} from '../model/ComponentCatalog.js';
import {designConnectionLabel} from '../model/DesignConnectionCatalog.js';
import {isEndMachiningFeature,normalizeMachiningFeature,machiningFeatureLabel} from '../machining/MachiningFeatureCatalog.js';

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
      map.get(key).hasMachining ||= has;
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

  /** 面向使用者/工厂的汇总视图；稳定领域ID只用于定位，不进入可见列。 */
  buildFactoryAccessoryList(model=this.buildDesignMaterialList()) {
    const headers=['类别','名称','规格 / 型号','尺寸','数量','单位','备注'];
    const rows=model.entries.filter(entry=>['ACCESSORY','CONNECTION'].includes(entry.kind)).map(entry=>({
      ...entry,
      cells:[entry.category,entry.name,[entry.spec,entry.model].filter(Boolean).join(' · '),entry.size,
        entry.pending?'—':entry.quantity,entry.pending?'—':entry.unit,
        [entry.pending?`${entry.quantity}处待选型，不计采购数量`:'',entry.note].filter(Boolean).join('；')]
    }));
    return {headers,rows};
  }

  /** 与普通材料清单共用完整加工分组，只在副本上规范化路径/加工。 */
  factoryMachiningGroups(model=this.buildDesignMaterialList()) {
    const byId=new Map((this.editor.parts||[]).map(part=>[part.id,part])),groups=[];
    for(const entry of model.entries.filter(item=>item.kind==='PROFILE')) {
      const parts=entry.partIds.map(id=>byId.get(id)).filter(Boolean).map(part=>{
        const copy=structuredClone(part);
        normalizeProfilePath(copy);
        for(const item of copy.machiningItems||[])normalizeMachiningFeature(item,copy);
        return copy;
      });
      const part=parts[0];
      if(!part)continue;
      const hasMachining=(part.machiningItems||[]).length>0,hasEndCuts=Boolean(endCutNote(part));
      if(!hasMachining&&!hasEndCuts)continue;
      const number=String(groups.length+1).padStart(2,'0'),styleId=`STYLE-${number}`;
      // 弯料/未知特征仍保留在清单，不冒充已适配的直料样式图。
      const drawingSupported=part.profilePath?.type!=='ARC'&&(part.machiningItems||[]).every(item=>FACTORY_STYLE_FEATURE_TYPES.has(item.type));
      groups.push({key:entry.key,styleId,label:`加工样式${number}`,entry,parts,partIds:[...entry.partIds],
        kind:'PROFILE',connectionIds:[],hasMachining,hasEndCuts,drawingSupported,
        drawingIds:drawingSupported?[hasMachining?styleId:null,hasEndCuts?`${styleId}-CUT`:null].filter(Boolean):[]});
    }
    return groups;
  }

  buildFactoryMachiningList(groups=this.factoryMachiningGroups()) {
    const headers=['加工样式','规格 / 型号','切割/展开长度（mm）','数量（支）','端切','加工要求','对应图纸'];
    const rows=groups.map(group=>{
      const part=group.parts[0],metrics=getPathMetrics(part),cuts=part.endCuts||{},material=part.manufacturingProfile;
      const endCuts=['START','END'].map(end=>`${end==='START'?'A':'B'}端：${Number(cuts[end]?.angleDeg||0)===0?'方切':`${cuts[end].angleDeg}°/${cuts[end].axis||'X'}`}`).join('；');
      const machining=(part.machiningItems||[]).map(item=>this.factoryMachiningLabel(item)).join('；');
      const drawingNote=group.drawingSupported?group.drawingIds.map(id=>`${id}.svg / .dxf`).join('；'):
        part.profilePath?.type==='ARC'?'弯料请查看原弯曲图并复核':'含未适配特征，需另行确认加工图';
      return {key:group.key,styleId:group.styleId,kind:group.kind,partIds:group.partIds,connectionIds:[],
        drawingSupported:group.drawingSupported,drawingIds:group.drawingIds,
        cells:[`${group.label}（${group.styleId}）`,[group.entry.spec,profileDisplayName(part),material?.name||'制造材料待配置',material?.alloy,
          material?.wallThickness!=null?`壁厚${material.wallThickness} mm`:'',material?.slotWidth!=null?`槽宽${material.slotWidth} mm`:''].filter(Boolean).join(' · '),
          this.n(metrics.developedLength),group.parts.length,endCuts,
          [machining||'仅端切',(part.designProfile?.faceClosures||[]).length?'封槽：'+part.designProfile.faceClosures.map(face=>({FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'}[face]||face)).join('/'):'',
            metrics.type==='ARC'?getPathLabel(part):'',part.note].filter(Boolean).join('；'),drawingNote]};
    });
    return {headers,rows};
  }

  factoryMachiningLabel(item) {
    const number=value=>value==null?'待确认':String(Number(value));
    const face={FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'};
    const datum={A_END:'A端',B_END:'B端',FACE_CENTER:'面中心',SLOT_CENTER:'槽中心',END_FACE:'端面'};
    const stage={STRAIGHT:'直料加工',BEND_BEFORE:'弯前加工',BEND_AFTER:'弯后加工'};
    const depth=`深${number(item.depth)} mm`,diameter=`Φ${number(item.diameter)}`;
    let process=machiningFeatureLabel(item);
    if(['THROUGH_HOLE','BLIND_HOLE','END_HOLE'].includes(item.type))process=`${diameter} ${process}${item.type==='THROUGH_HOLE'?'':` · ${depth}`}`;
    else if(['TAPPED_HOLE','END_TAP'].includes(item.type))process=`${item.tappingSize||'螺纹待确认'} ${process} · ${depth}`;
    else if(['COUNTERBORE','END_COUNTERBORE'].includes(item.type))process=`${diameter} ${process} · ${depth}`;
    else if(['COUNTERSINK','END_COUNTERSINK'].includes(item.type))process=`${process} Φ${number(item.majorDiameter??item.diameter)} · ${number(item.angleDeg)}°`;
    else if(['SLOT','OBROUND_SLOT','MILLING_REGION'].includes(item.type))process=`${process} ${number(item.length)}×${number(item.width)} mm · ${Number(item.depth)===0?'通槽':depth} · ${item.orientation==='CROSS_PROFILE'?'横向':'沿长度'}${item.type==='MILLING_REGION'?` · 圆角R${number(item.cornerRadius)}`:''}`;
    const location=isEndMachiningFeature(item)?`${item.end==='START'?'A':'B'}端 · X偏移${number(item.offsetX??0)} / Y偏移${number(item.offsetY??0)} mm`:
      `${face[item.face]||'加工面待确认'} · 距A端S=${number(item.stationS??item.distanceFromStart)} mm · 横向偏移${number(item.offset??0)} mm`;
    return [stage[item.processStage],location,process,datum[item.referenceDatum]?`基准：${datum[item.referenceDatum]}`:'',item.note].filter(Boolean).join(' · ');
  }

  static factoryListRows(model) {
    // 用户备注/名称仍按文本导出，避免表格应用把以 =/+/−/@ 开头的文本执行为公式。
    return [model.headers,...model.rows.map(row=>row.cells)].map(row=>row.map(value=>
      typeof value==='string'&&/^[\s\uFEFF]*[=+\-@]/.test(value)?`'${value}`:value));
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
      const key=[part.type,descriptor.spec,descriptor.size,descriptor.material,descriptor.shapeKey||''].join('|');
      if(!genericGroups.has(key))genericGroups.set(key,{...descriptor,parts:[]});
      genericGroups.get(key).parts.push(part);
    }
    for(const group of genericGroups.values())rows.push([index++,group.category,'-',group.spec,group.material,group.size,group.parts.length,group.parts.map(part=>this.code(part)).join(' / '),group.note||'']);
    return rows;
  }

  /** 玩家清单只读领域记录；不能数展示网格，也不能把抽象连接冒充购买件。 */
  buildDesignMaterialList() {
    const source=this.editor.parts||[],connections=this.editor.connectionManager?.connections||[];
    const state=this.editor.materialListManager?.state||{profileSystems:{},virtualItems:[]};
    const byId=new Map(source.map(part=>[part.id,part])),groups=new Map(),statistics=new Map(),warnings=[];
    const configuredIds=new Set(source.filter(part=>part.type==='PROFILE'&&part.manufacturingProfile).map(part=>part.designProfile?.profileId));
    const thumbnails=new Map();
    const systemFor=part=>{
      const id=part?.designProfile?.profileId;
      if(!id)return '待核实';
      if(part.manufacturingProfile?.system)return part.manufacturingProfile.system;
      if(state.profileSystems[id])return state.profileSystems[id];
      const definition=getProfileDefinition(id),reference=ProfileReferenceOptions.find(item=>item.id===id);
      return definition?.system||(reference?.label.includes('欧标')?'欧标':getDesignProfileDefinition(id)?.name.includes('欧标')?'欧标':'待核实');
    };
    const add=(key,entry,partIds=[],connectionIds=[])=>{
      if(!groups.has(key))groups.set(key,{...entry,key,quantity:0,partIds:[],connectionIds:[]});
      const group=groups.get(key);group.quantity+=entry.quantity??1;
      group.partIds.push(...partIds);group.connectionIds.push(...connectionIds);
    };
    for(const part of source.filter(item=>item.type==='PROFILE')){
      // 原getPathMetrics会规范化入参；这里仅在展示副本上调用，打开/导出不回写。
      const copy=structuredClone(part),metrics=getPathMetrics(copy),definition=getDesignProfileDefinition(part.designProfile?.profileId);
      const system=systemFor(part),model=(definition?.sectionSize||part.dimensions?.sectionSize||[]).join('x');
      const machining=(part.machiningItems||[]).map(item=>this.machiningLabel(item)).join('；');
      const note=[profileDisplayName(part),part.manufacturingProfile?.name,part.note,
        (part.designProfile?.faceClosures||[]).length?'封槽 '+part.designProfile.faceClosures.join('/'):'',
        metrics.type==='ARC'?getPathLabel(copy):'',endCutNote(part),machining].filter(Boolean).join('；');
      const profileId=part.designProfile?.profileId;
      if(!thumbnails.has(profileId))thumbnails.set(profileId,profileSectionThumbnail(part));
      const entry={category:'铝型材',name:'铝材',spec:system,model:model||profileDisplayName(part),size:`${this.n(metrics.developedLength)} mm`,
        lengthMm:metrics.developedLength,quantity:1,unit:'支',profileId:part.designProfile?.profileId,
        systemEditable:!configuredIds.has(profileId),
        machining:machining||'无',note,thumbnail:thumbnails.get(profileId),kind:'PROFILE'};
      const key=stableSignature(['PROFILE',part.designProfile,part.manufacturingProfile,part.dimensions?.sectionSize,part.dimensions?.wallThickness,
        copy.profilePath,part.endCuts||{},machiningSignature(part),part.note||'',system]);
      add(key,entry,[part.id]);
      const statKey=[system,entry.model,part.designProfile?.profileId,part.manufacturingProfile?.profileId||''].join('|');
      if(!statistics.has(statKey))statistics.set(statKey,{key:statKey,model:entry.model,spec:system,variant:[profileDisplayName(part),part.manufacturingProfile?.name].filter(Boolean).join(' / '),lengthMm:0,quantity:0,taps:0,through:0,countersinks:0});
      const stat=statistics.get(statKey);stat.lengthMm+=metrics.developedLength;stat.quantity++;
      for(const item of part.machiningItems||[]){
        if(['END_TAP','TAPPED_HOLE'].includes(item.type))stat.taps++;
        if(item.type==='THROUGH_HOLE')stat.through++;
        if(['COUNTERSINK','END_COUNTERSINK'].includes(item.type))stat.countersinks++;
      }
    }
    for(const part of source.filter(item=>item.type!=='PROFILE')){
      const descriptor=describeGenericPart(part);if(!descriptor)continue;
      const definition=getHardwareDefinition(part.hardwareSku),spec=part.hardwareSpec||{},isConnector=spec.category==='连接件'||['ANGLE_BRACKET','INTERNAL_CONNECTOR','ANCHOR_CONNECTOR','CONNECTION_PLATE'].includes(part.accessoryType);
      const category=part.type==='PANEL'?'板材':part.type==='SHAFT'?'光轴':isConnector?'连接件':'配件/五金';
      const host=byId.get(part.mountReference?.targetPartId),system=host?.type==='PROFILE'?systemFor(host):'';
      const note=[descriptor.note,part.note,spec.note,part.generatedByConnectionId?'制造配置已明确的散件':'',part.dimensions?.sideMountGeometryVersion?'梁侧安装参考规格':''].filter(Boolean).join('；');
      const entry={category,name:definition?.label||part.name||descriptor.spec,spec:system||descriptor.material||'待核实',model:spec.model||part.hardwareSku||descriptor.spec,
        size:descriptor.size,lengthMm:part.type==='SHAFT'?Number(part.dimensions?.length||0):null,quantity:1,unit:spec.unit||(part.type==='PANEL'?'张':'个'),
        machining:part.type==='PANEL'?(descriptor.note||'无'):'—',note,kind:part.type};
      const key=JSON.stringify([part.type,part.accessoryType,part.hardwareSku,part.dimensions,part.materialSpec,spec,system,part.note||'']);
      add(key,entry,[part.id],part.generatedByConnectionId?[part.generatedByConnectionId]:[]);
    }
    for(const connection of connections){
      // 正式制造件已由上面的Part计入，不再叠加设计参考件或套装。
      if(connection.manufacturingRuleId){
        if(!source.some(part=>part.generatedByConnectionId===connection.id))warnings.push(`${connection.id} 已配置制造方案但没有派生五金，请检查连接`);
        continue;
      }
      const component=connection.designComponent,sourcePart=byId.get(connection.sourceProfileId),targetPart=byId.get(connection.targetProfileId);
      const a=systemFor(sourcePart),b=systemFor(targetPart),system=a===b?a:`${a} / ${b}`;
      const conflict=a!==b||a==='待核实',invalid=connection.status==='INVALID'||connection.validation?.ok===false;
      const faces=[...new Set(connection.designComponentMountFaces||[])];
      const quantity=component?Math.max(1,faces.length):1;
      const kind=component?.dimensions?.geometryKind;
      const name=kind==='ANGLE_BRACKET'?'角码连接件':ConnectionComponentOptions.find(item=>item.value===kind)?.label||component?.label||designConnectionLabel(connection.designType);
      const size=Number(component?.dimensions?.size);
      const wideBracket=kind==='ANGLE_BRACKET'&&component?.dimensions?.sideMountGeometryVersion==null;
      const width=Number(wideBracket?component.dimensions.width??size:size),height=Number(wideBracket?component.dimensions.height??size:size);
      const model=Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0?`${width}x${height}`:'待选型';
      const note=[component?'套装需求；紧固件请按实际套装核对':'仅连接意图，未选具体连接件',component?.label,
        component?.dimensions?.sideMountGeometryVersion?'梁侧安装参考规格，采购前核对孔位':'',
        conflict?'两端规格不一致或未核实':'',invalid?'几何失效，待检查':''].filter(Boolean).join('；');
      const entry={category:component?'连接件套装':'待选型连接',name,spec:system,model,size:component?componentSize(component.dimensions):'—',
        quantity,unit:component?'套':'处',machining:'—',note,kind:'CONNECTION',warning:conflict||invalid,pending:!component};
      const key=JSON.stringify(['CONNECTION',connection.designType,component||null,system,invalid]);
      add(key,entry,[],[connection.id]);
      if(conflict||invalid)warnings.push(`${this.editor.manufacturingIdentityManager?.codeForConnection(connection)||connection.id}：${conflict?'规格不一致或未核实':''}${conflict&&invalid?'；':''}${invalid?'几何失效':''}`);
    }
    const entries=[...groups.values()].map((entry,index)=>({...entry,index:index+1,partIds:[...new Set(entry.partIds)],connectionIds:[...new Set(entry.connectionIds)]}));
    const categories=['铝型材','板材','光轴','连接件套装','连接件','配件/五金','待选型连接'].map(name=>({name,entries:entries.filter(entry=>entry.category===name)})).filter(category=>category.entries.length);
    const virtualItems=(state.virtualItems||[]).map(item=>({...item,key:item.id,category:'虚拟构件',size:item.model,machining:'—',kind:'VIRTUAL',partIds:[],connectionIds:[],isVirtual:true}));
    for(const entry of entries)if(entry.spec==='待核实'&&entry.kind==='PROFILE')warnings.push(`${entry.model} 的规格待核实`);
    const profileCount=source.filter(part=>part.type==='PROFILE').length;
    return {entries,categories,virtualItems,statistics:[...statistics.values()].map(stat=>({...stat,lengthMm:this.n(stat.lengthMm)})),warnings:[...new Set(warnings)],
      profileCount,totalLengthMm:this.n([...statistics.values()].reduce((sum,stat)=>sum+stat.lengthMm,0)),
      modelCount:entries.filter(entry=>!entry.pending).reduce((sum,entry)=>sum+entry.quantity,0),
      connectionKitCount:entries.filter(entry=>entry.category==='连接件套装').reduce((sum,entry)=>sum+entry.quantity,0),
      pendingConnectionCount:entries.filter(entry=>entry.pending).reduce((sum,entry)=>sum+entry.quantity,0)};
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
  return generic ? {category:generic.category,spec:generic.spec,size:generic.size,note:generic.note||''} : {category:part.type||'构件',spec:part.name||'',size:'',note:''};
}

function describeGenericPart(part){
  let spec='',size='',material=part.materialSpec?.material||'',category=part.type,note='',shapeKey='';
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
  if(part.type==='PANEL'&&part.dimensions?.edgeNotches?.length){
    shapeKey=JSON.stringify(part.dimensions.edgeNotches);
    note=part.dimensions.edgeNotches.map(n=>({LEFT:'左',RIGHT:'右',TOP:'上',BOTTOM:'下'}[n.edge])+'边'+(n.outline?'轮廓避让（非矩形，范围 ':'矩形缺口 ')+n.widthMm+'×'+n.depthMm+'mm'+(n.outline?'，按切割轮廓）':'')+'，距'+(n.anchor==='END'?'右/上':'左/下')+'端'+n.offsetMm+'mm').join('；');
  }
  return {category,spec,size,material,note,shapeKey};
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

function machiningSignature(part) {
  const items=part.machiningItems||[];
  const parameters=items.map(item=>{
    const copy=structuredClone(item);
    normalizeMachiningFeature(copy,part);
    for(const key of ['id','manufacturingCode','generatedByConnectionId','linkedHoleId','patternSourceId','featureGroupId','pattern','patternSource','mirror'])delete copy[key];
    return copy;
  });
  const signatures=parameters.map(stableSignature),byId=new Map(items.map((item,index)=>[item.id,signatures[index]])),holeGroups=new Map();
  for(let index=0;index<items.length;index++) {
    const id=items[index].featureGroupId;
    if(!id)continue;
    if(!holeGroups.has(id))holeGroups.set(id,[]);
    holeGroups.get(id).push(signatures[index]);
  }
  for(const group of holeGroups.values())group.sort();
  // 复合孔的拓扑也参与比较，但不按随机孔组/连接/阵列身份拆成不同采购加工项。
  return items.map((item,index)=>stableSignature({parameters:parameters[index],
    linkedHole:item.linkedHoleId?(byId.get(item.linkedHoleId)||`未解析:${item.linkedHoleId}`):null,
    holeGroup:item.featureGroupId?holeGroups.get(item.featureGroupId):null
  })).sort();
}

function stableSignature(value) {
  const sort=item=>Array.isArray(item)?item.map(sort):item&&typeof item==='object'?
    Object.fromEntries(Object.keys(item).sort().map(key=>[key,sort(item[key])])):item;
  return JSON.stringify(sort(value));
}

const FACTORY_STYLE_FEATURE_TYPES=new Set(['THROUGH_HOLE','BLIND_HOLE','TAPPED_HOLE','COUNTERSINK','COUNTERBORE',
  'SLOT','OBROUND_SLOT','MILLING_REGION','END_TAP','END_HOLE','END_COUNTERBORE','END_COUNTERSINK']);

function endCutNote(part) {
  return ['START','END'].filter(end=>Number(part.endCuts?.[end]?.angleDeg||0)!==0)
    .map(end=>`${end==='START'?'A':'B'}端切 ${part.endCuts[end].angleDeg}°/${part.endCuts[end].axis||'X'}`).join('；');
}

function componentSize(dimensions={}) {
  const values=[dimensions.width??dimensions.size,dimensions.height??dimensions.size,dimensions.thickness].filter(value=>Number.isFinite(Number(value)));
  return values.length?values.join('×')+' mm':'参考尺寸待核实';
}

function profileSectionThumbnail(part) {
  const section=getSectionDefinition(part.designProfile?.profileId);
  return section?sectionToSvg(section):'';
}
