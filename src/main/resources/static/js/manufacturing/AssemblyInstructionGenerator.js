/** 根据组件顺序、连接关系与制造编号生成可操作的装配步骤。 */
export default class AssemblyInstructionGenerator {
  constructor(editor){this.editor=editor;}

  build(){
    this.editor.manufacturingIdentityManager?.reconcile();
    const manager=this.editor.assemblyManager;
    const definitions=[];
    const roots=manager?.tree?.()||[];
    const assemblyNodes=[];
    const walk=node=>{
      if(!node.single)assemblyNodes.push(node);
      for(const child of node.children||[])walk(child);
    };
    roots.forEach(walk);
    const ordered=assemblyNodes
      .filter(node=>(node.parts||[]).some(part=>!part.generatedByConnectionId))
      .sort((a,b)=>Number(a.installationStep||999)-Number(b.installationStep||999)||String(a.name||'').localeCompare(String(b.name||''),'zh-CN'));

    for(const node of ordered){
      const ids=(node.parts||[]).filter(part=>!part.generatedByConnectionId).map(part=>part.id);
      if(ids.length)definitions.push({
        id:`assembly:${node.id}`,
        title:node.name||'安装组件',
        note:node.installationNote||'',
        partIds:ids,
        assemblyId:node.id
      });
    }

    const assigned=new Set(definitions.flatMap(step=>step.partIds));
    const remaining=(this.editor.parts||[]).filter(part=>!assigned.has(part.id)&&!part.generatedByConnectionId);
    if(remaining.length){
      const profiles=remaining.filter(part=>part.type==='PROFILE');
      const panels=remaining.filter(part=>['PANEL','SHAFT'].includes(part.type));
      const accessories=remaining.filter(part=>part.type==='ACCESSORY');
      if(profiles.length)definitions.unshift({id:'auto:profiles',title:'搭建主体型材',note:'先完成主要型材框架和基础连接。',partIds:profiles.map(part=>part.id)});
      if(panels.length)definitions.push({id:'auto:panels',title:'安装板材与功能构件',note:'主体框架稳定后再安装板材、光轴等构件。',partIds:panels.map(part=>part.id)});
      if(accessories.length)definitions.push({id:'auto:accessories',title:'安装独立配件',note:'最后安装端盖、脚杯、脚轮、把手等独立配件。',partIds:accessories.map(part=>part.id)});
    }

    if(!definitions.length && (this.editor.parts||[]).some(part=>!part.generatedByConnectionId)){
      definitions.push({id:'auto:all',title:'组装当前结构',note:'当前工程尚未划分组件，可先按构件编号完成组装。',partIds:this.editor.parts.filter(part=>!part.generatedByConnectionId).map(part=>part.id)});
    }

    const numbered=definitions.map((step,index)=>({...step,step:index+1}));
    const stepByPart=new Map();
    for(const step of numbered)for(const partId of step.partIds||[])stepByPart.set(partId,step.step);
    const connections=this.editor.connectionManager?.connections||[];
    const connectionsByStep=new Map(numbered.map(step=>[step.step,[]]));
    for(const connection of connections){
      const sourceStep=stepByPart.get(connection.sourceProfileId)||0;
      const targetStep=stepByPart.get(connection.targetProfileId)||0;
      const ownerStep=Math.max(sourceStep,targetStep);
      if(ownerStep>0&&connectionsByStep.has(ownerStep))connectionsByStep.get(ownerStep).push(connection);
    }

    return numbered.map(step=>this.makeStep(step,connectionsByStep.get(step.step)||[],stepByPart));
  }

  makeStep(definition,connections,stepByPart){
    const ids=new Set(definition.partIds||[]);
    const partMap=new Map((this.editor.parts||[]).map(part=>[part.id,part]));
    const connectionIds=new Set(connections.map(connection=>connection.id));
    const hardware=(this.editor.parts||[]).filter(part=>part.generatedByConnectionId&&connectionIds.has(part.generatedByConnectionId));
    const identity=this.editor.manufacturingIdentityManager;
    const parts=[...ids].map(id=>partMap.get(id)).filter(Boolean).map(part=>({id:part.id,code:identity?.codeForPart(part)||part.displayId||part.id,name:part.name||part.type,type:part.type}));
    const prerequisites=new Set();
    for(const connection of connections){
      const a=stepByPart.get(connection.sourceProfileId)||0;
      const b=stepByPart.get(connection.targetProfileId)||0;
      const earlier=Math.min(a||definition.step,b||definition.step);
      if(earlier>0&&earlier<definition.step)prerequisites.add(earlier);
    }
    return {
      ...definition,
      partIds:[...ids],
      parts,
      prerequisiteSteps:[...prerequisites].sort((a,b)=>a-b),
      connections:connections.map(connection=>{
        const source=partMap.get(connection.sourceProfileId),target=partMap.get(connection.targetProfileId);
        const connectionHardware=hardware.filter(part=>part.generatedByConnectionId===connection.id);
        return {
          id:connection.id,
          code:identity?.codeForConnection(connection)||connection.id,
          type:connection.designType||connection.type,
          sourcePartId:source?.id||null,
          targetPartId:target?.id||null,
          sourceCode:source?(identity?.codeForPart(source)||source.displayId||source.id):'',
          targetCode:target?(identity?.codeForPart(target)||target.displayId||target.id):'',
          sourceEnd:connection.sourceEnd||'START',
          targetFace:connection.targetFace||'FRONT',
          sourceMountFace:connection.sourceMountFace||null,
          placement:connection.placement?structuredClone(connection.placement):null,
          hardware:connectionHardware.map(part=>({id:part.id,code:identity?.codeForPart(part)||part.displayId||part.id,name:part.name||'五金'}))
        };
      }),
      hardware:hardware.map(part=>({id:part.id,code:identity?.codeForPart(part)||part.displayId||part.id,name:part.name||'五金'}))
    };
  }
}
