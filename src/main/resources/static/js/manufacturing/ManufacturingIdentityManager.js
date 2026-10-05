/**
 * 为制造输出提供稳定、可读的编号。
 * 编号写回当前工程模型，保存后保持不变；当前版本不维护历史 Schema 兼容。
 */
export default class ManufacturingIdentityManager {
  constructor(editor){this.editor=editor;}

  reconcile(){
    const parts=this.editor.parts||[];
    const connections=this.editor.connectionManager?.connections||[];
    const assemblies=this.editor.assemblyManager?.assemblies||[];
    this.assignCollection(parts,part=>this.partPrefix(part),'manufacturingCode');
    this.assignCollection(connections,()=> 'C','manufacturingCode');
    this.assignCollection(assemblies,()=> 'G','manufacturingCode');
    const machining=[];
    for(const part of parts){
      if(part.type!=='PROFILE')continue;
      for(const item of part.machiningItems||[])machining.push(item);
    }
    this.assignCollection(machining,()=> 'M','manufacturingCode');
    return {parts:parts.length,connections:connections.length,assemblies:assemblies.length,machining:machining.length};
  }

  assignPart(part){
    if(!part)return null;
    if(part.manufacturingCode)return part.manufacturingCode;
    const prefix=this.partPrefix(part);
    const used=new Set((this.editor.parts||[]).map(item=>item.manufacturingCode).filter(Boolean));
    part.manufacturingCode=this.nextCode(prefix,used);
    return part.manufacturingCode;
  }

  codeForPart(part){return part?.manufacturingCode||part?.displayId||part?.id||'';}
  codeForConnection(connection){return connection?.manufacturingCode||connection?.id||'';}
  codeForMachining(item){return item?.manufacturingCode||item?.id||'';}
  codeForAssembly(assembly){return assembly?.manufacturingCode||assembly?.id||'';}

  partPrefix(part){
    if(part?.type==='PROFILE')return 'P';
    if(part?.type==='PANEL')return 'B';
    if(part?.type==='SHAFT')return 'S';
    if(part?.type==='ACCESSORY')return part.generatedByConnectionId?'H':'A';
    return 'P';
  }

  assignCollection(items,prefixFn,field){
    const used=new Set();
    for(const item of items){
      const value=String(item?.[field]||'').trim();
      if(value&&!used.has(value))used.add(value);
      else if(item)item[field]=null;
    }
    for(const item of items){
      if(!item||item[field])continue;
      const prefix=prefixFn(item);
      const code=this.nextCode(prefix,used);
      item[field]=code;
      used.add(code);
    }
  }

  nextCode(prefix,used){
    let index=1;
    while(used.has(`${prefix}${String(index).padStart(3,'0')}`))index++;
    return `${prefix}${String(index).padStart(3,'0')}`;
  }
}
