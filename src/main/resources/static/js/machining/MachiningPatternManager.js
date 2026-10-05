import {isEndMachiningFeature, normalizeMachiningFeature} from './MachiningFeatureCatalog.js';

/** Parametric machining pattern, mirror and clipboard manager. */
export default class MachiningPatternManager {
  constructor(editor){this.editor=editor;this.clipboard=null;}

  linear(profileMesh,sourceId,options={}){
    const part=this.#profilePart(profileMesh),source=this.#source(part,sourceId);this.#assertManual(source);this.#assertPatternSource(source);
    if(isEndMachiningFeature(source))throw new Error('端面加工不支持线性阵列');
    const count=this.#count(options.count),spacing=this.#spacing(options.spacingMm),patternId=crypto.randomUUID();
    source.patternSource={id:patternId,type:'LINEAR',count,spacingMm:spacing};
    const created=this.#rebuildLinear(part,source,patternId,count,spacing);this.#refresh(profileMesh);return created;
  }

  rectangular(profileMesh,sourceId,options={}){
    const part=this.#profilePart(profileMesh),source=this.#source(part,sourceId);this.#assertManual(source);this.#assertPatternSource(source);
    if(isEndMachiningFeature(source))throw new Error('端面加工不支持矩形阵列');
    const countS=this.#count(options.countS??2),countOffset=this.#count(options.countOffset??2);
    const spacingS=this.#spacing(options.spacingS??options.spacingMm??50),spacingOffset=this.#spacing(options.spacingOffset??20);
    const patternId=crypto.randomUUID();
    source.patternSource={id:patternId,type:'RECTANGULAR',countS,countOffset,spacingS,spacingOffset};
    const created=this.#rebuildRectangular(part,source,patternId,countS,countOffset,spacingS,spacingOffset);this.#refresh(profileMesh);return created;
  }

  updateLinear(profileMesh,patternId,options={}){
    const part=this.#profilePart(profileMesh),source=part.machiningItems.find(item=>item.patternSource?.id===patternId);if(!source)throw new Error('阵列源加工项不存在');
    if(source.patternSource?.type==='RECTANGULAR')return this.updateRectangular(profileMesh,patternId,options);
    const count=this.#count(options.count??source.patternSource.count),spacing=this.#spacing(options.spacingMm??source.patternSource.spacingMm);
    part.machiningItems=part.machiningItems.filter(item=>item.pattern?.id!==patternId);source.patternSource={...source.patternSource,type:'LINEAR',count,spacingMm:spacing};
    const created=this.#rebuildLinear(part,source,patternId,count,spacing);this.#refresh(profileMesh);return created;
  }

  updateRectangular(profileMesh,patternId,options={}){
    const part=this.#profilePart(profileMesh),source=part.machiningItems.find(item=>item.patternSource?.id===patternId);if(!source)throw new Error('矩形阵列源加工项不存在');
    const ps=source.patternSource||{};const countS=this.#count(options.countS??ps.countS??2),countOffset=this.#count(options.countOffset??ps.countOffset??2);
    const spacingS=this.#spacing(options.spacingS??ps.spacingS??50),spacingOffset=this.#spacing(options.spacingOffset??ps.spacingOffset??20);
    part.machiningItems=part.machiningItems.filter(item=>item.pattern?.id!==patternId);source.patternSource={id:patternId,type:'RECTANGULAR',countS,countOffset,spacingS,spacingOffset};
    const created=this.#rebuildRectangular(part,source,patternId,countS,countOffset,spacingS,spacingOffset);this.#refresh(profileMesh);return created;
  }

  dissolve(profileMesh,patternId){const part=this.#profilePart(profileMesh),source=part.machiningItems.find(item=>item.patternSource?.id===patternId),children=part.machiningItems.filter(item=>item.pattern?.id===patternId);if(!source&&!children.length)throw new Error('阵列不存在');if(source)delete source.patternSource;for(const item of children)delete item.pattern;this.#refresh(profileMesh);return children.length+(source?1:0);}

  copy(profileMesh,sourceId){const part=this.#profilePart(profileMesh),source=this.#source(part,sourceId);this.#assertManual(source);const clone=structuredClone(source);delete clone.id;delete clone.pattern;delete clone.patternSource;delete clone.mirror;delete clone.generatedByConnectionId;delete clone.linkedHoleId;delete clone.featureGroupId;this.clipboard={kind:'MACHINING_FEATURE',sourceProfileId:part.id,item:clone};return structuredClone(this.clipboard);}

  paste(profileMesh,options={}){const part=this.#profilePart(profileMesh);if(!this.clipboard?.item)throw new Error('加工剪贴板为空');const clone=structuredClone(this.clipboard.item);clone.id=crypto.randomUUID();if(!isEndMachiningFeature(clone)){const length=this.#length(part),station=Number(options.stationS??clone.stationS??clone.distanceFromStart??0);if(!Number.isFinite(station)||station<-.001||station>length+.001)throw new Error('粘贴加工位置超出目标型材长度');clone.stationS=station;clone.distanceFromStart=station;if(options.face)clone.face=options.face;if(Number.isFinite(Number(options.offset)))clone.offset=Number(options.offset);}clone.copiedFrom={profileId:this.clipboard.sourceProfileId,at:new Date().toISOString()};normalizeMachiningFeature(clone,part);part.machiningItems.push(clone);this.#refresh(profileMesh);return clone;}

  mirrorOffset(profileMesh,sourceId){return this.#mirror(profileMesh,sourceId,'FACE_OFFSET');}
  mirrorOppositeFace(profileMesh,sourceId){return this.#mirror(profileMesh,sourceId,'OPPOSITE_FACE');}
  mirrorEnd(profileMesh,sourceId){return this.#mirror(profileMesh,sourceId,'END');}

  #mirror(profileMesh,sourceId,mode){const part=this.#profilePart(profileMesh),source=this.#source(part,sourceId);this.#assertManual(source);const clone=structuredClone(source);clone.id=crypto.randomUUID();if(mode==='END'){if(isEndMachiningFeature(source))clone.end=source.end==='END'?'START':'END';else{const length=this.#length(part);clone.stationS=length-Number(source.stationS??source.distanceFromStart??0);clone.distanceFromStart=clone.stationS;}}else{if(isEndMachiningFeature(source))throw new Error('端面加工仅支持 A/B 端镜像');if(mode==='FACE_OFFSET')clone.offset=-Number(source.offset||0);else{const opposite={FRONT:'BACK',BACK:'FRONT',LEFT:'RIGHT',RIGHT:'LEFT'}[source.face];if(!opposite)throw new Error('当前加工面不支持对面镜像');clone.face=opposite;}}clone.mirror={sourceId:source.id,mode};delete clone.pattern;delete clone.patternSource;delete clone.featureGroupId;normalizeMachiningFeature(clone,part);part.machiningItems.push(clone);this.#refresh(profileMesh);return clone;}

  #rebuildLinear(part,source,patternId,count,spacing){const length=this.#length(part),created=[];for(let index=1;index<count;index++){const stationS=Number(source.stationS??source.distanceFromStart??0)+spacing*index;if(stationS<-.001||stationS>length+.001)throw new Error(`第 ${index+1} 个阵列加工超出型材长度`);const clone=structuredClone(source);clone.id=crypto.randomUUID();clone.stationS=stationS;clone.distanceFromStart=stationS;clone.pattern={id:patternId,type:'LINEAR',sourceId:source.id,index,count,spacingMm:spacing};delete clone.patternSource;delete clone.generatedByConnectionId;delete clone.featureGroupId;normalizeMachiningFeature(clone,part);part.machiningItems.push(clone);created.push(clone);}return created;}

  #rebuildRectangular(part,source,patternId,countS,countOffset,spacingS,spacingOffset){const length=this.#length(part),created=[];for(let row=0;row<countOffset;row++){for(let col=0;col<countS;col++){if(row===0&&col===0)continue;const stationS=Number(source.stationS??source.distanceFromStart??0)+spacingS*col;if(stationS<-.001||stationS>length+.001)throw new Error(`矩形阵列第 ${col+1} 列超出型材长度`);const clone=structuredClone(source);clone.id=crypto.randomUUID();clone.stationS=stationS;clone.distanceFromStart=stationS;clone.offset=Number(source.offset||0)+spacingOffset*row;clone.pattern={id:patternId,type:'RECTANGULAR',sourceId:source.id,row,col,countS,countOffset,spacingS,spacingOffset};delete clone.patternSource;delete clone.generatedByConnectionId;delete clone.featureGroupId;normalizeMachiningFeature(clone,part);part.machiningItems.push(clone);created.push(clone);}}return created;}

  #assertPatternSource(source){if(source.pattern)throw new Error('阵列成员不能再次建立阵列，请编辑原阵列');if(source.patternSource)throw new Error('该加工已经是阵列源，请编辑现有阵列');}
  #count(value){const n=Math.floor(Number(value||2));if(!Number.isFinite(n)||n<2||n>200)throw new Error('阵列数量必须为 2~200');return n;}
  #spacing(value){const n=Number(value??50);if(!Number.isFinite(n)||Math.abs(n)<.001)throw new Error('阵列间距必须是非零数值');return n;}
  #assertManual(item){if(item.generatedByConnectionId)throw new Error('连接派生加工不能手工编辑/复制');}
  #profilePart(mesh){const part=mesh?.userData?.part;if(!part||part.type!=='PROFILE')throw new Error('请选择型材');part.machiningItems=Array.isArray(part.machiningItems)?part.machiningItems:[];return part;}
  #source(part,id){const item=part.machiningItems.find(v=>v.id===id);if(!item)throw new Error('加工项不存在');return item;}
  #length(part){if(part.profilePath?.type==='ARC')return Math.abs(Number(part.profilePath.radius||0)*Number(part.profilePath.angleDeg||0)*Math.PI/180);return Number(part.profilePath?.length??part.dimensions?.length??0);}
  #refresh(mesh){this.editor.machiningManager.refreshProfile(mesh);this.editor.emitStats();this.editor.history?.capture?.();this.editor.historyManager?.capture?.();this.editor.emitProjectChanged?.();}
}
