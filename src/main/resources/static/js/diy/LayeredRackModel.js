import {getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';
import {DEFAULT_FRAME_DIMENSIONS} from './DiyTemplateCatalog.js';

export const RACK_LAYOUT_VERSION=3;

/** 生成与回改共用同一布局，尺寸均为外尺寸。成员键不是构件 ID，增删层时保留其余构件身份。 */
export function layeredRackLayout(input={}) {
  // 当前 Schema 的旧参数架保留原布局；新生成或显式选配使用实际双侧槽配对，不猜自由搭架的角色。
  if([2,RACK_LAYOUT_VERSION].includes(Number(input.layoutVersion)))return configuredRackLayout(input);
  const catalogId=input.catalogId||'DESIGN-3030',definition=getDesignProfileDefinition(catalogId);
  if(!definition)throw new Error('多层架型材型号不存在');
  const parameters={catalogId,width:Number(input.width??1000),depth:Number(input.depth??600),height:Number(input.height??1800),levels:Number(input.levels??4),centerBeamCount:Number(input.centerBeamCount??0),autoConnect:input.autoConnect!==false};
  const {width,depth,height,levels,centerBeamCount}=parameters,[sx,sy]=definition.sectionSize.map(Number);
  if(![width,depth,height].every(value=>Number.isFinite(value)&&value>0))throw new Error('框架宽、深、高必须是大于零的有效数值');
  if(!Number.isInteger(levels)||levels<2||levels>12||!Number.isInteger(centerBeamCount)||centerBeamCount<0||centerBeamCount>4)throw new Error('层数为2~12，每层中间承托梁为0~4根');
  if(width<=sx*2||depth<=sy*2)throw new Error('外形尺寸过小，无法容纳当前型材截面');
  if(height<sy*levels)throw new Error('高度不足以容纳这些层，横梁会重叠；请增加高度或减少层数');
  if(centerBeamCount&&(width-sx)/(centerBeamCount+1)<sx)throw new Error('宽度不足以容纳中间承托梁，请增加宽度或减少承托梁');
  const members=[],postX=(width-sx)/2,postZ=(depth-sy)/2;
  const add=(key,length,position,rotation,name)=>members.push({key,catalogId,length,position,rotation,name:name+' '+definition.name});
  for(const x of [-1,1])for(const z of [-1,1])add(`POST:${x}:${z}`,height,{x:x*postX,y:height/2,z:z*postZ},{x:-Math.PI/2,y:0,z:0},'多层架立柱');
  for(let level=0;level<levels;level++) {
    const y=sy/2+level*(height-sy)/(levels-1);
    for(const sign of [-1,1]) {
      add(`WIDTH:${level}:${sign}`,width-sx*2,{x:0,y,z:sign*postZ},{x:0,y:Math.PI/2,z:0},`第${level+1}层横梁`);
      add(`DEPTH:${level}:${sign}`,depth-sy*2,{x:sign*postX,y,z:0},{x:0,y:0,z:0},`第${level+1}层纵梁`);
    }
    for(let index=1;index<=centerBeamCount;index++)add(`CENTER:${level}:${index}`,depth-sy-sx,{x:-postX+index/(centerBeamCount+1)*postX*2,y,z:0},{x:0,y:0,z:0},`第${level+1}层中间承托梁${index}`);
  }
  return {parameters,members};
}

export const RackProfileRoles=Object.freeze([
  {id:'post',label:'立柱'},{id:'top',label:'顶部梁'},{id:'bottom',label:'底部梁'},
  {id:'middle',label:'中间层梁'},{id:'side',label:'侧梁'},{id:'center',label:'中间承托梁'}
]);

export const RackSideMountOptions=Object.freeze([
  {value:'FRAME',label:'柱间（沿用框架接法）'},
  {value:'INSET',label:'内收，接前后横梁'}
]);

export function createRackRoleSettings(){
  return Object.fromEntries(RackProfileRoles.map(role=>[role.id,{catalogId:'',quarterTurns:0}]));
}

/** 布局的成员键只在本次生成/回改时解析为真实 ID，不保存第二份世界坐标或安装关系。 */
export function rackSideJointPlan(layout,memberIds){
  return (layout.sideJoints||[]).map(joint=>{
    const sourceProfileId=memberIds[joint.sourceKey],targetProfileId=memberIds[joint.targetKey];
    if(!sourceProfileId||!targetProfileId)throw new Error('侧梁接头的框架成员信息不完整');
    return {sourceProfileId,targetProfileId,sourceEnd:joint.sourceEnd,targetFace:joint.targetFace};
  });
}

/** 按部位选材和接法的布局；输入/输出都是模型毫米，外尺寸、层顶面及真实目录槽共同决定落位。 */
function configuredRackLayout(input){
  const catalogId=String(input.catalogId||'DESIGN-3030'),global=getDesignProfileDefinition(catalogId);
  if(!global)throw new Error('框架统一型材型号不存在');
  const layoutVersion=Number(input.layoutVersion)===RACK_LAYOUT_VERSION?RACK_LAYOUT_VERSION:2;
  // 默认值只影响新布局；缺少尺寸的旧参数架仍按原默认解释，显式尺寸不被预设覆盖。
  const dimensionDefaults=layoutVersion===RACK_LAYOUT_VERSION?DEFAULT_FRAME_DIMENSIONS:{width:1000,depth:600,height:1800};
  const profileRoles=createRackRoleSettings();
  for(const role of RackProfileRoles){
    const value=input.profileRoles?.[role.id]||{};
    profileRoles[role.id]={catalogId:String(value.catalogId||''),quarterTurns:integer(value.quarterTurns??0,0,1,role.label+'截面朝向')};
  }
  const parameters={layoutVersion,catalogId,profileRoles,width:positive(input.width??dimensionDefaults.width,'宽'),depth:positive(input.depth??dimensionDefaults.depth,'深'),height:positive(input.height??dimensionDefaults.height,'高'),
    levels:integer(input.levels??4,2,12,'层数'),centerBeamCount:integer(input.centerBeamCount??0,0,4,'每层承托梁数'),
    bayCount:integer(input.bayCount??1,1,8,'联排格数'),bayMode:input.bayMode==='INDEPENDENT'?'INDEPENDENT':'SHARED',
    topMount:input.topMount==='ON_TOP'?'ON_TOP':'BETWEEN',bottomMount:input.bottomMount==='UNDER_POST'?'UNDER_POST':'BETWEEN',
    sideMount:normalizeSideMount(input.sideMount),bottomClearance:nonnegative(input.bottomClearance??0,'底层梁离地高度'),manualLevelHeights:input.manualLevelHeights===true,autoConnect:input.autoConnect!==false};
  const {width,depth,height,levels,centerBeamCount,bayCount,bayMode}=parameters;
  parameters.levelSettings=Array.from({length:levels},(_,index)=>{
    const row=input.levelSettings?.[index]||{};
    return {heightMm:row.heightMm==null||row.heightMm===''?null:positive(row.heightMm,'层顶面高度'),catalogId:String(row.catalogId||''),centerCatalogId:String(row.centerCatalogId||''),centerBeamCount:row.centerBeamCount==null||row.centerBeamCount===''?null:integer(row.centerBeamCount,0,4,'本层承托梁数'),leftSideMount:normalizeSideMount(row.leftSideMount,true),rightSideMount:normalizeSideMount(row.rightSideMount,true)};
  });
  const profile=(role,layer=null,override='')=>{
    const option=profileRoles[role],inherit=['side','center'].includes(role)&&!override&&!option.catalogId&&layer;
    if(inherit)return layer;
    const definition=getDesignProfileDefinition(override||option.catalogId||catalogId);
    if(!definition||definition.shape==='U_CHANNEL')throw new Error(RackProfileRoles.find(item=>item.id===role).label+'没有可用的槽型材');
    if(String(definition.series)!==String(global.series)||Number(definition.slotWidth)!==Number(global.slotWidth))throw new Error('当前按部位搭架请使用相同系列和槽宽；可混用3030 / 3060等截面，不自动套用跨系列连接');
    const turn=option.quarterTurns,[a,b]=definition.sectionSize.map(Number);
    return {definition,catalogId:definition.id,turn,across:turn?b:a,h:turn?a:b};
  };
  const post=profile('post'),postWidth=post.across,postDepth=post.h;
  const layerProfiles=Array.from({length:levels},(_,index)=>{
    const role=index===0?'bottom':index===levels-1?'top':'middle';
    const beam=profile(role,null,role==='middle'?parameters.levelSettings[index].catalogId:'');
    return {role,beam,side:profile('side',beam),center:profile('center',beam,parameters.levelSettings[index].centerCatalogId),centerCount:parameters.levelSettings[index].centerBeamCount??centerBeamCount};
  });
  const bottom=layerProfiles[0],top=layerProfiles[levels-1];
  const bottomThickness=Math.max(bottom.beam.h,bottom.side.h),bottomTop=parameters.bottomClearance+bottomThickness;
  if(parameters.bottomMount==='UNDER_POST'&&(parameters.bottomClearance!==0||Math.abs(bottom.beam.h-bottom.side.h)>.001))throw new Error('柱下承托底框需要从地面起，宽向和侧梁同厚；离地底梁请选择“装在柱间”');
  if(parameters.topMount==='ON_TOP'&&Math.abs(top.beam.h-top.side.h)>.001)throw new Error('柱顶搭接需要顶部梁与侧梁的竖向厚度一致，请调整型号或截面朝向');
  const postBottom=parameters.bottomMount==='UNDER_POST'?bottomTop:0,postTop=parameters.topMount==='ON_TOP'?height-top.beam.h:height;
  if(postTop-postBottom<=1||height<=bottomTop)throw new Error('高度不足以容纳顶部、底部梁与立柱');
  const heights=layerProfiles.map((layer,index)=>{
    if(index===0)return bottomTop;
    if(index===levels-1)return height;
    if(parameters.manualLevelHeights){const value=parameters.levelSettings[index].heightMm;if(value==null)throw new Error('请填写每个中间层的顶面高度');return value;}
    return bottomTop+index*(height-bottomTop)/(levels-1);
  });
  for(let index=0;index<levels;index++){
    const layer=layerProfiles[index],thickness=Math.max(layer.beam.h,layer.side.h,layer.centerCount?layer.center.h:0);
    if(heights[index]-thickness<-.001||(index&&heights[index]-thickness<heights[index-1]-.001))throw new Error('层高或所选截面使上下层重叠，请调整各层高度');
    if(index>0&&index<levels-1&&(heights[index]>postTop+.001||heights[index]-thickness<postBottom-.001))throw new Error('中间层超出立柱可安装高度');
  }
  const normalXFaces=post.turn?['FRONT','BACK']:['LEFT','RIGHT'],normalZFaces=post.turn?['LEFT','RIGHT']:['FRONT','BACK'];
  const slotsZ=oppositeSlotOffsets(post.definition,normalXFaces,-1),slotsX=oppositeSlotOffsets(post.definition,normalZFaces,post.turn?-1:1);
  const lane=(available,span,spec,axis,sign,label)=>rackLane(available,span,spec,axis,sign,label,layoutVersion);
  const members=[],sideJoints=[],roleCounts={post:0,top:0,bottom:0,middle:0,side:0,center:0};
  const add=(key,spec,length,position,axis,role,name)=>{
    if(!Number.isFinite(length)||length<=1)throw new Error(name+'净长度不足，请增加外尺寸或减少联排格数');
    const rotation=axis==='Y'?{x:-Math.PI/2,y:0,z:spec.turn*Math.PI/2}:axis==='X'?{x:0,y:Math.PI/2,z:spec.turn*Math.PI/2}:{x:0,y:0,z:spec.turn*Math.PI/2};
    members.push({key,catalogId:spec.catalogId,length,position,rotation,role,name:name+' '+spec.definition.name});roleCounts[role]++;
  };
  const postZ=(depth-postDepth)/2;
  if(postZ<=postDepth/2)throw new Error('深度不足以容纳立柱');
  const compartments=[],columns=[];
  if(bayMode==='SHARED'){
    const spacing=(width-postWidth)/bayCount;
    if(spacing<=postWidth)throw new Error('每格净宽不足以容纳立柱');
    for(let index=0;index<=bayCount;index++)columns.push({x:-(width-postWidth)/2+index*spacing,key:index===0?-1:index===bayCount?1:'MID:'+index,sign:index===0?-1:index===bayCount?1:0});
    for(let index=0;index<bayCount;index++)compartments.push({index,left:columns[index],right:columns[index+1],outerWidth:spacing+postWidth});
  }else{
    const bayWidth=width/bayCount;
    if(bayWidth<=postWidth*2)throw new Error('每格外宽不足以容纳两侧立柱');
    for(let index=0;index<bayCount;index++){
      const center=-width/2+(index+.5)*bayWidth,left={x:center-(bayWidth-postWidth)/2,key:bayCount===1?-1:index+':-1',sign:-1},right={x:center+(bayWidth-postWidth)/2,key:bayCount===1?1:index+':1',sign:1};
      columns.push(left,right);compartments.push({index,left,right,outerWidth:bayWidth});
    }
  }
  for(const column of columns)for(const sign of [-1,1])add(`POST:${column.key}:${sign}`,post,postTop-postBottom,{x:column.x,y:(postBottom+postTop)/2,z:sign*postZ},'Y','post','立柱');
  for(let index=0;index<levels;index++){
    const layer=layerProfiles[index],levelTop=heights[index],stacked=index===0&&parameters.bottomMount==='UNDER_POST'||index===levels-1&&parameters.topMount==='ON_TOP';
    const zFront=-postZ+lane(slotsZ,postDepth,layer.beam,'X',-1,'宽向梁'),zBack=postZ+lane(slotsZ,postDepth,layer.beam,'X',1,'宽向梁');
    // 柱间净长与横梁间净长不同；内收量由柱宽和侧梁宽决定，不能只加长原柱间梁。
    const beamGap=zBack-zFront-layer.beam.across,sidePositions=[],sideByKey=new Map();
    if(layoutVersion===RACK_LAYOUT_VERSION&&beamGap<=1)throw new Error(`第${index+1}层前后梁之间没有足够净深，请增加深度或调整梁截面`);
    const widthKey=(bay,sign)=>(stacked&&bayMode==='SHARED'||bayCount===1)?`WIDTH:${index}:${sign}`:`WIDTH:${index}:${bay.index}:${sign}`;
    for(const bay of compartments)for(const side of ['left','right']){
      const column=bay[side],direction=side==='left'?1:-1,setting=parameters.levelSettings[index];
      const mount=setting[side+'SideMount']||parameters.sideMount,inset=mount==='INSET';
      const sharedMiddle=bayMode==='SHARED'&&column.sign===0;
      const key=`DEPTH:${index}:${column.key}`+(inset&&sharedMiddle?`:INSET:${direction}`:'');
      if(sideByKey.has(key))continue; // 共享中柱的默认柱间梁只生成一次；内收后每格有自己的侧梁。
      const x=inset?column.x+direction*(postWidth+layer.side.across)/2:column.x+lane(slotsX,postWidth,layer.side,'Z',column.sign,'侧梁');
      const length=inset||stacked?beamGap:depth-postDepth*2;
      if(inset){
        const left=bay.left.x+(stacked?-postWidth:postWidth)/2,right=bay.right.x+(stacked?postWidth:-postWidth)/2;
        if(layer.side.h>layer.beam.h+.001||x-layer.side.across/2<left-.001||x+layer.side.across/2>right+.001)throw new Error(`第${index+1}层内收侧梁超出前后横梁的完整支撑范围，请调整型号、朝向或格宽`);
      }
      const entry={key,column,x,length,z:(inset||layoutVersion===RACK_LAYOUT_VERSION&&stacked)?(zFront+zBack)/2:0,mount};
      sideByKey.set(key,entry);sidePositions.push(entry);
      for(const sign of [-1,1]){
        const targetKey=inset||stacked?widthKey(bay,sign):`POST:${column.key}:${sign}`;
        const faces=inset||stacked?(layer.beam.turn?['FRONT','BACK']:['LEFT','RIGHT']):(post.turn?['LEFT','RIGHT']:['BACK','FRONT']);
        sideJoints.push({sourceKey:key,targetKey,sourceEnd:sign<0?'START':'END',targetFace:faces[sign<0?0:1]});
      }
    }
    for(let i=0;i<sidePositions.length;i++)for(let j=i+1;j<sidePositions.length;j++)if(Math.abs(sidePositions[i].x-sidePositions[j].x)<layer.side.across-.001)throw new Error(`第${index+1}层侧梁互相重叠，请增加格宽或调整侧梁接法`);
    if(stacked&&bayMode==='SHARED'){
      for(const sign of [-1,1])add(`WIDTH:${index}:${sign}`,layer.beam,width,{x:0,y:levelTop-layer.beam.h/2,z:sign<0?zFront:zBack},'X',layer.role,`第${index+1}层宽向梁`);
    }else for(const bay of compartments){
      const length=stacked?bay.outerWidth:bay.right.x-bay.left.x-postWidth;
      for(const sign of [-1,1])add(bayCount===1?`WIDTH:${index}:${sign}`:`WIDTH:${index}:${bay.index}:${sign}`,layer.beam,length,{x:(bay.left.x+bay.right.x)/2,y:levelTop-layer.beam.h/2,z:sign<0?zFront:zBack},'X',layer.role,`第${index+1}层宽向梁`);
    }
    for(const entry of sidePositions)add(entry.key,layer.side,entry.length,{x:entry.x,y:levelTop-layer.side.h/2,z:entry.z},'Z','side',`第${index+1}层侧梁${entry.mount==='INSET'?'（内收）':''}`);
    for(const bay of compartments)for(let count=1;count<=layer.centerCount;count++){
      const x=bay.left.x+count/(layer.centerCount+1)*(bay.right.x-bay.left.x);
      if(sidePositions.some(entry=>Math.abs(entry.x-x)<(layer.side.across+layer.center.across)/2-.001)||(bay.right.x-bay.left.x)/(layer.centerCount+1)<layer.center.across-.001)throw new Error('本层承托梁过密或与侧梁重叠，请减少根数或增加格宽');
      add(bayCount===1?`CENTER:${index}:${count}`:`CENTER:${index}:${bay.index}:${count}`,layer.center,zBack-zFront-layer.beam.across,{x,y:levelTop-layer.center.h/2,z:(zFront+zBack)/2},'Z','center',`第${index+1}层承托梁${count}`);
    }
  }
  return {parameters,members,roleCounts,layerHeights:heights,sideJoints};
}

/** 槽来自目录的开放面；没有中间槽时不能补一个虚构的 offset=0。 */
function oppositeSlotOffsets(definition,faces,sign){
  const definitions=definition.slotDefinitions||[];
  return definitions.filter(slot=>slot.face===faces[0]&&Number.isFinite(Number(slot.offset)))
    .map(slot=>sign*Number(slot.offset))
    .filter(offset=>definitions.some(slot=>slot.face===faces[1]&&Math.abs(sign*Number(slot.offset)-offset)<.001));
}

/**
 * 梁中心偏移 = 柱槽横坐标 - 梁槽横坐标。旋转矩形梁后，槽的横向轴也随之改变。
 * 宽梁只允许向框内伸出，真实槽必须位于双方端面交叠区；这不是连接件足迹/制造合法性的证明。
 */
function rackLane(available,span,spec,axis,sign,label,layoutVersion){
  const beamWidth=spec.across,desired=sign*(span-beamWidth)/2;
  if(layoutVersion===2){
    const valid=available.filter(offset=>Math.abs(offset)+beamWidth/2<=span/2+.001);
    if(!valid.length)throw new Error(label+'没有可对准且保持外尺寸的开放槽位，请调整截面或立柱朝向');
    return valid.sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired))[0];
  }
  const faces=spec.turn?['LEFT','RIGHT']:['FRONT','BACK'];
  const sourceSign=axis==='X'?(spec.turn?1:-1):(spec.turn?-1:1);
  const sourceSlots=oppositeSlotOffsets(spec.definition,faces,sourceSign),candidates=[];
  for(const targetSlot of available)for(const sourceSlot of sourceSlots){
    if(Math.abs(targetSlot)>span/2+.001||Math.abs(sourceSlot)>beamWidth/2+.001)continue;
    const offset=targetSlot-sourceSlot;
    if(beamWidth<=span+.001&&Math.abs(offset)+beamWidth/2>span/2+.001)continue;
    if((sign<0&&offset-beamWidth/2<-span/2-.001)||(sign>0&&offset+beamWidth/2>span/2+.001))continue;
    if(!candidates.some(value=>Math.abs(value-offset)<.001))candidates.push(offset);
  }
  if(!candidates.length)throw new Error(label+'与立柱没有可配对且保持外尺寸的开放槽位，请调整型号或截面朝向');
  return candidates.sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired)||Math.abs(a)-Math.abs(b)||a-b)[0];
}

function normalizeSideMount(value,inherit=false){
  if(value==null||value==='')return inherit?'':'FRAME';
  if(!RackSideMountOptions.some(option=>option.value===value))throw new Error('侧梁接法不存在，请重新选择');
  return value;
}

function positive(value,label){const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(label+'必须为正数');return number;}
function nonnegative(value,label){const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error(label+'不能小于0');return number;}
function integer(value,min,max,label){const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new Error(`${label}应为${min}～${max}的整数`);return number;}
