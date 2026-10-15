import {planDrawersInOpening} from './DrawerOpeningPlacement.js';
import {adaptDrawerPanels} from './DrawerPanelAdaptation.js';
import {panelReliefObjects} from './PanelReliefManager.js';

const TOLERANCE_MM=.1;

/** 与填板共用闭合/分格；抽屉只处理指定朝向的一侧，不把同一空间从前后重复装满。 */
export function drawerSelectionCells(editor,sourcePartIds,options={}) {
  const ids=[...new Set(sourcePartIds||[])],axis=options.frontAxis??'Z';
  if(ids.length<4||ids.length>64)throw new Error('请选择完整外框，可连同中间梁、多层框口一起选（4～64根型材）');
  if(!['X','Z'].includes(axis))throw new Error('抽屉安装朝向只能选择正背向Z或侧向X');
  const resolver=editor.panelDoorConfigurator.openingResolver;
  const resolveOptions={placement:'INSET',resolveSlots:false,divideFrame:true,normalAxis:axis};
  let cells,seeded=false;
  try {cells=resolver.resolveSelectedPanelCells(ids,resolveOptions).cells;} catch(error) {
    // 水平层框作为边界：优先真实上方空间；顶部没有上梁时可取最近下方，不造虚拟高度。
    let bases;
    try{bases=resolver.resolveSelectedPanelCells(ids,{placement:'INSET',normalAxis:'Y'}).cells;}catch{throw error;}
    cells=bases.flatMap(base=>inferAboveBase(editor,base.opening,options));seeded=true;
    if(!cells.length)throw new Error('所选水平层框上下没有可识别的完整框口；请选择有真实上下梁和立柱的安装区域');
  }
  const sign=options.frontSide==='NEGATIVE'?-1:1,n=axis.toLowerCase();
  const outward=cell=>Math.max(...cell.opening.boundaryPartIds.map(id=>{
    const member=resolver.describePanelMember(editor.getMeshByPartId(id));return sign>0?member.box.max[n]:-member.box.min[n];
  }));
  const unique=new Map();
  for(const cell of cells){const opening=cell.opening,key=JSON.stringify([opening.normalAxis,[...opening.boundaryPartIds].sort(),opening.bounds]);if(!unique.has(key))unique.set(key,{...cell,plane:outward(cell)});}
  const all=[...unique.values()];
  const overlap=(a,b)=>['width','height'].every(key=>Math.min(a.bounds[key].max,b.bounds[key].max)-Math.max(a.bounds[key].min,b.bounds[key].min)>TOLERANCE_MM);
  const targets=all.filter(cell=>!all.some(other=>other.plane>cell.plane+TOLERANCE_MM&&overlap(cell.opening,other.opening)));
  targets.sort((a,b)=>a.opening.bounds.height.min-b.opening.bounds.height.min||a.opening.bounds.width.min-b.opening.bounds.width.min);
  if(!targets.length)throw new Error('当前朝向未识别到完整抽屉框口，请检查外框或切换朝向');
  const used=new Set(targets.flatMap(cell=>cell.opening.sourcePartIds));
  return {cells:targets,unusedPartIds:seeded?[]:ids.filter(id=>!used.has(id)),seeded};
}

export function planDrawerSelection(editor,sourcePartIds,options={}) {
  const selection=drawerSelectionCells(editor,sourcePartIds,options),objects=panelReliefObjects(editor);
  const configuredCount=selection.cells.length*Number(options.levels??options.count??3)*Number(options.columns??1);
  if(Number.isFinite(configuredCount)&&configuredCount>64)throw new Error('本次合计超过64个抽屉，请减少层数/排数或分区域生成');
  const plans=selection.cells.map((cell,index)=>{
    const descriptor=cell.opening,label=`框口${index+1}`;
    let plan;
    try {
      plan=planDrawersInOpening(editor,descriptor.boundaryPartIds,options,descriptor);
      adaptDrawerPanels(editor,plan,objects,options);
      if(cell.error)plan.errors.push(cell.error);
    } catch(error) {
      plan=plan||{layout:null,opening:null,errors:[]};plan.errors.push(error.message);
    }
    plan.index=index;plan.label=label;plan.sourceOpening=descriptor;
    plan.dividerCount=plan.layout?.members.filter(member=>member.role==='DIVIDER').length||0;
    plan.notchCount=plan.layout?.members.reduce((sum,member)=>sum+(member.dimensions.edgeNotches?.length||0),0)||0;
    plan.errors=[...new Set(plan.errors)];return plan;
  });
  const count=plans.reduce((sum,plan)=>sum+(plan.layout?.parameters.count||0),0);
  if(count>64)throw new Error('本次合计超过64个抽屉，请减少层数/排数或分区域生成');
  return {...selection,plans,count,dividerCount:plans.reduce((sum,plan)=>sum+(plan.dividerCount||0),0)};
}

function inferAboveBase(editor,base,options) {
  const resolver=editor.panelDoorConfigurator.openingResolver,axis=options.frontAxis??'Z',widthAxis=axis==='Z'?'X':'Z';
  const sign=options.frontSide==='NEGATIVE'?-1:1,n=axis.toLowerCase(),members=[];
  for(const mesh of editor.meshes){if(mesh.visible===false||mesh.userData?.part?.hidden||mesh.userData?.part?.type!=='PROFILE')continue;try{members.push(resolver.describePanelMember(mesh));}catch{}}
  const lows=base.boundaryPartIds.map(id=>resolver.describePanelMember(editor.getMeshByPartId(id))).filter(member=>member.axis===widthAxis);
  lows.sort((a,b)=>sign*(b.center[n]-a.center[n]));
  if(!lows.length)return [];
  const low=lows[0],posts=members.filter(member=>member.axis==='Y'&&touches(low,member));
  let attempts=0;
  const find=bars=>{
    const found=[];
    for(const peer of bars)for(let i=0;i<posts.length;i++)for(let j=i+1;j<posts.length;j++){
      if(!touches(peer,posts[i])||!touches(peer,posts[j]))continue;
      if(++attempts>512)throw new Error('水平层对应框口有过多候选，请分区域选择');
      const ids=[low.part.id,peer.part.id,posts[i].part.id,posts[j].part.id];
      try {const opening=resolver.resolvePanel(ids,{placement:'INSET',resolveSlots:false});if(opening.normalAxis===axis)found.push({ids,opening});}catch{}
    }
    return found;
  };
  let found=find(members.filter(member=>member.axis===widthAxis&&member.box.min.y>low.box.max.y+1));
  if(!found.length)found=find(members.filter(member=>member.axis===widthAxis&&member.box.max.y<low.box.min.y-1));
  found.sort((a,b)=>a.opening.height-b.opening.height||b.opening.width-a.opening.width);
  if(!found.length)return [];
  return resolver.resolvePanelCells(found[0].ids,{placement:'INSET',resolveSlots:false,divideFrame:true}).cells;
}

function touches(a,b) {return ['x','y','z'].every(axis=>a.box.min[axis]<=b.box.max[axis]+TOLERANCE_MM&&b.box.min[axis]<=a.box.max[axis]+TOLERANCE_MM);}
