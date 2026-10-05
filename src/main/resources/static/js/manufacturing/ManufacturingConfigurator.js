import {ProfileCatalogList,getProfileDefinition} from '../model/ProfileCatalog.js';
import {getDesignProfileDefinition,profileDisplayName} from '../model/DesignProfileCatalog.js';
import {designConnectionLabel} from '../model/DesignConnectionCatalog.js';

/**
 * 制造配置中心。
 * 设计阶段只保存截面和连接意图；本模块负责把设计对象绑定到真实材料目录和真实连接规则。
 * 不包含价格、供应商订单、库存或排料。
 */
export default class ManufacturingConfigurator {
  constructor(editor) {
    this.editor=editor;
  }

  profileGroups() {
    const groups=new Map();
    for(const part of this.editor.parts || []){
      if(part?.type!=='PROFILE')continue;
      const profileId=part.designProfile?.profileId;
      if(!profileId)continue;
      if(!groups.has(profileId))groups.set(profileId,[]);
      groups.get(profileId).push(part);
    }
    return [...groups.entries()].map(([designProfileId,parts])=>{
      const design=getDesignProfileDefinition(designProfileId);
      const appliedIds=[...new Set(parts.map(item=>item.manufacturingProfile?.profileId).filter(Boolean))];
      return {
        key:designProfileId,
        designProfileId,
        label:design?.name || profileDisplayName(parts[0]),
        nominal:design?.nominal || parts[0]?.designProfile?.nominal || '',
        count:parts.length,
        partIds:parts.map(item=>item.id),
        configured:appliedIds.length===1 && parts.every(item=>item.manufacturingProfile?.profileId===appliedIds[0]),
        manufacturingProfileId:appliedIds.length===1?appliedIds[0]:null,
        mixed:appliedIds.length>1,
        candidates:this.profileCandidates(designProfileId)
      };
    }).sort((a,b)=>String(a.nominal).localeCompare(String(b.nominal),'zh-CN',{numeric:true}));
  }

  profileCandidates(designProfileId) {
    const design=getDesignProfileDefinition(designProfileId);
    if(!design)return [];
    return ProfileCatalogList.filter(item=>{
      const [w,h]=item.sectionSize || [];
      return (Number(w)===Number(design.width)&&Number(h)===Number(design.height))
        || (Number(w)===Number(design.height)&&Number(h)===Number(design.width));
    }).map(item=>({
      id:item.id,
      label:`${item.variant || item.nominal} · ${item.system}`,
      name:item.name,
      system:item.system,
      variant:item.variant,
      wallThickness:Number(item.defaultWallThickness || 0),
      slotWidth:Number(item.slotWidth || 0),
      alloy:item.alloy || '',
      sourceFamily:item.sourceFamily || ''
    }));
  }

  configureProfileGroup(designProfileId,manufacturingProfileId) {
    const definition=getProfileDefinition(manufacturingProfileId);
    if(!definition)throw new Error('请选择有效的制造型材规格');
    const allowed=this.profileCandidates(designProfileId).some(item=>item.id===definition.id);
    if(!allowed)throw new Error('所选制造规格与当前设计截面尺寸不一致');
    let count=0;
    for(const part of this.editor.parts || []){
      if(part?.type!=='PROFILE'||part.designProfile?.profileId!==designProfileId)continue;
      part.manufacturingProfile={
        profileId:definition.id,
        name:definition.name,
        nominal:definition.nominal,
        variant:definition.variant,
        system:definition.system,
        wallThickness:Number(definition.defaultWallThickness || 0),
        slotWidth:Number(definition.slotWidth || 0),
        alloy:definition.alloy || '',
        sourceFamily:definition.sourceFamily || '',
        configuredAt:new Date().toISOString()
      };
      count++;
    }
    this.revalidateConnections(partsIds(this.editor.parts,designProfileId));
    this.changed();
    return count;
  }

  clearProfileGroup(designProfileId) {
    let count=0;
    for(const part of this.editor.parts || []){
      if(part?.type!=='PROFILE'||part.designProfile?.profileId!==designProfileId)continue;
      if(part.manufacturingProfile){part.manufacturingProfile=null;count++;}
    }
    this.revalidateConnections(partsIds(this.editor.parts,designProfileId));
    this.changed();
    return count;
  }

  revalidateConnections(partIds=[]) {
    const ids=new Set((partIds||[]).filter(Boolean));
    if(!ids.size)return;
    for(const connection of this.editor.connectionManager?.connections || []){
      if(!ids.has(connection.sourceProfileId) && !ids.has(connection.targetProfileId))continue;
      if(connection.manufacturingRuleId){
        const current=this.editor.connectionManager.getManufacturingOptions(connection).find(item=>item.ruleId===connection.manufacturingRuleId);
        if(!current?.valid)this.editor.connectionManager.clearManufacturingRule(connection);
        else this.editor.connectionManager.rebuild(connection);
      }else{
        this.editor.connectionManager.rebuild(connection);
      }
    }
  }

  connectionRows() {
    return (this.editor.connectionManager?.connections || []).map(connection=>{
      const source=this.editor.parts.find(item=>item.id===connection.sourceProfileId);
      const target=this.editor.parts.find(item=>item.id===connection.targetProfileId);
      return {
        id:connection.id,
        label:designConnectionLabel(connection.designType),
        designType:connection.designType,
        source:source?.displayId || source?.name || '-',
        target:target?.displayId || target?.name || '-',
        configured:!!connection.manufacturingRuleId,
        manufacturingRuleId:connection.manufacturingRuleId || null,
        options:this.editor.connectionManager.getManufacturingOptions(connection)
      };
    });
  }

  configureConnection(connectionId,ruleId) {
    return this.editor.connectionManager.configureManufacturingRule(connectionId,ruleId);
  }

  clearConnection(connectionId) {
    return this.editor.connectionManager.clearManufacturingRule(connectionId);
  }

  recommendAll() {
    let profiles=0;
    for(const group of this.profileGroups()){
      if(group.configured)continue;
      const candidate=group.candidates[0];
      if(candidate)profiles+=this.configureProfileGroup(group.designProfileId,candidate.id);
    }
    let connections=0;
    for(const connection of this.editor.connectionManager?.connections || []){
      if(connection.manufacturingRuleId)continue;
      const option=this.editor.connectionManager.getManufacturingOptions(connection).find(item=>item.valid);
      if(option){this.editor.connectionManager.configureManufacturingRule(connection,option.ruleId);connections++;}
    }
    this.changed();
    return {profiles,connections};
  }

  clearAll() {
    let profiles=0;
    for(const part of this.editor.parts || []){
      if(part?.type==='PROFILE'&&part.manufacturingProfile){part.manufacturingProfile=null;profiles++;}
    }
    let connections=0;
    for(const connection of this.editor.connectionManager?.connections || []){
      if(connection.manufacturingRuleId){this.editor.connectionManager.clearManufacturingRule(connection);connections++;}
    }
    this.changed();
    return {profiles,connections};
  }

  status() {
    const profileGroups=this.profileGroups();
    const connectionRows=this.connectionRows();
    const profilePartCount=profileGroups.reduce((sum,item)=>sum+item.count,0);
    const configuredProfilePartCount=profileGroups.filter(item=>item.configured).reduce((sum,item)=>sum+item.count,0);
    const configuredConnectionCount=connectionRows.filter(item=>item.configured).length;
    return {
      profileGroups:profileGroups.length,
      profilePartCount,
      configuredProfilePartCount,
      unconfiguredProfilePartCount:profilePartCount-configuredProfilePartCount,
      connectionCount:connectionRows.length,
      configuredConnectionCount,
      unconfiguredConnectionCount:connectionRows.length-configuredConnectionCount,
      ready:(profilePartCount===configuredProfilePartCount)&&(connectionRows.length===configuredConnectionCount)
    };
  }

  changed() {
    this.editor.emitStats?.();
    this.editor.emitProjectChanged?.();
  }
}

function partsIds(parts,designProfileId){return (parts||[]).filter(part=>part?.type==='PROFILE'&&part.designProfile?.profileId===designProfileId).map(part=>part.id);}
