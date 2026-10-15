import * as THREE from 'three';
import {resolvePanelSlots} from './PanelSlotPlacement.js';

const AXIS_NAMES = ['X','Y','Z'];

/**
 * Resolve a rectangular opening from four axis-aligned linear profile members.
 *
 * The resolver intentionally works from business profile roots instead of child
 * geometry. It is aimed at DIY workflows: select the four members surrounding an
 * opening, then let Panel/Door configurators consume one stable descriptor.
 */
export default class FrameOpeningResolver {
  constructor(editor) {
    this.editor = editor;
  }

  resolve(partIds = null, options = {}) {
    const ids = partIds?.length ? [...new Set(partIds)] : this.selectedProfileIds();
    if (ids.length !== 4) throw new Error('框口配置需要选择 4 根围成矩形的直线型材');
    const meshes = ids.map(id => this.editor.getMeshByPartId(id)).filter(Boolean);
    if (meshes.length !== 4 || meshes.some(mesh => mesh.userData?.part?.type !== 'PROFILE' || mesh.userData?.part?.profilePath?.type === 'ARC')) {
      throw new Error('框口配置仅支持 4 根直线型材');
    }

    const tolerance = Math.max(0.01, Number(options.axisToleranceMm ?? 0.1));
    const members = meshes.map(mesh => this.describeMember(mesh));
    const grouped = new Map();
    for (const member of members) {
      if (!grouped.has(member.axis)) grouped.set(member.axis, []);
      grouped.get(member.axis).push(member);
    }
    const directions = [...grouped.keys()];
    if (directions.length !== 2 || directions.some(axis => grouped.get(axis).length !== 2)) {
      throw new Error('所选型材必须由两组互相垂直的平行边组成');
    }

    const normalAxis = AXIS_NAMES.find(axis => !directions.includes(axis));
    const normalValues = members.map(item => item.center[normalAxis.toLowerCase()]);
    if (Math.max(...normalValues) - Math.min(...normalValues) > tolerance) {
      throw new Error('所选 4 根型材不在同一框口平面');
    }

    const preferred = preferredPanelAxes(normalAxis);
    if (!directions.includes(preferred.widthAxis) || !directions.includes(preferred.heightAxis)) {
      throw new Error('当前框口方向暂不支持自动配置');
    }

    const widthBounds = this.innerBounds(grouped.get(preferred.heightAxis), preferred.widthAxis);
    const heightBounds = this.innerBounds(grouped.get(preferred.widthAxis), preferred.heightAxis);
    const width = widthBounds.max - widthBounds.min;
    const height = heightBounds.max - heightBounds.min;
    if (!(width > 1) || !(height > 1)) throw new Error('框口净尺寸无效，请检查型材位置和截面尺寸');

    // 四条中心线的间距不能证明闭合：每条实体边必须覆盖净开口，四角也必须接触。
    for (const member of grouped.get(preferred.widthAxis)) this.assertCovers(member,preferred.widthAxis,widthBounds,tolerance);
    for (const member of grouped.get(preferred.heightAxis)) this.assertCovers(member,preferred.heightAxis,heightBounds,tolerance);
    for (const horizontal of grouped.get(preferred.widthAxis)) for (const vertical of grouped.get(preferred.heightAxis)) {
      if (AXIS_NAMES.some(axis => horizontal.box.max[axis.toLowerCase()] < vertical.box.min[axis.toLowerCase()] - tolerance || vertical.box.max[axis.toLowerCase()] < horizontal.box.min[axis.toLowerCase()] - tolerance)) {
        throw new Error('所选型材没有形成闭合框口：角部仍有间隙，请先吸附四个角');
      }
    }

    const center = {x:0,y:0,z:0};
    center[preferred.widthAxis.toLowerCase()] = (widthBounds.min + widthBounds.max) / 2;
    center[preferred.heightAxis.toLowerCase()] = (heightBounds.min + heightBounds.max) / 2;
    center[normalAxis.toLowerCase()] = normalValues.reduce((sum,value) => sum + value, 0) / normalValues.length;

    const basis = makePanelBasis(preferred.widthAxis, preferred.heightAxis);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.width,basis.height,basis.normal));
    const euler = new THREE.Euler().setFromQuaternion(quaternion,'XYZ');
    const assemblyIds = [...new Set(members.map(item => item.part.assemblyId).filter(Boolean))];

    return {
      sourcePartIds:members.map(item => item.part.id),
      sourceDisplayIds:members.map(item => item.part.displayId || item.part.id),
      widthAxis:preferred.widthAxis,
      heightAxis:preferred.heightAxis,
      normalAxis,
      width:Number(width.toFixed(4)),
      height:Number(height.toFixed(4)),
      center,
      rotation:{x:euler.x,y:euler.y,z:euler.z},
      basis:{
        width:{x:basis.width.x,y:basis.width.y,z:basis.width.z},
        height:{x:basis.height.x,y:basis.height.y,z:basis.height.z},
        normal:{x:basis.normal.x,y:basis.normal.y,z:basis.normal.z}
      },
      bounds:{width:widthBounds,height:heightBounds},
      assemblyId:assemblyIds.length === 1 ? assemblyIds[0] : null
    };
  }

  /**
   * 解析一个外框或已保存的单块板引用；新填板的分格入口为 resolvePanelCells，门框严格四边不变。
   * 水平板按实际梁顶判断同层，而非中心同高；四角允许同一根真实立柱同时贴合两条外边。
   */
  resolvePanel(partIds=null,options={}){
    const ids=partIds?.length?[...new Set(partIds)]:this.selectedProfileIds();
    if(ids.length<4||ids.length>64)throw new Error('请选择同一框面的四根外边，可一起选中间承托梁（最多64根）');
    const members=ids.map(id=>{
      const mesh=this.editor.getMeshByPartId(id);
      if(!mesh||mesh.visible===false||mesh.userData.part?.hidden||mesh.userData.part?.type!=='PROFILE')throw new Error('框口板仅支持可见的直线型材');
      return this.describePanelMember(mesh);
    });
    const grouped=new Map();
    for(const member of members){if(!grouped.has(member.axis))grouped.set(member.axis,[]);grouped.get(member.axis).push(member);}
    const directions=[...grouped.keys()];
    if(directions.length!==2||directions.some(axis=>grouped.get(axis).length<2))throw new Error('请选择一个矩形外框的完整四边，不要混选不同层或立柱');
    const normalAxis=AXIS_NAMES.find(axis=>!directions.includes(axis)),preferred=preferredPanelAxes(normalAxis);
    const tolerance=Math.max(.01,Number(options.axisToleranceMm??.1)),n=normalAxis.toLowerCase();
    const placement=options.placement==null||options.placement==='T_SLOT'?'T_SLOT':normalAxis==='Y'&&options.placement!=='INSET'?'ON_FRAME':'INSET';
    const tops=members.map(m=>m.box.max[n]),bottoms=members.map(m=>m.box.min[n]);
    const centers=members.map(m=>m.center[n]);
    if(placement!=='T_SLOT'&&normalAxis==='Y'){
      if(Math.max(...tops)-Math.min(...tops)>tolerance)throw new Error('所选型材梁顶不在同一层，请只选本层外框与齐平承托梁');
    }else if(placement!=='T_SLOT'&&Math.max(...centers)-Math.min(...centers)>tolerance&&Math.max(...tops)-Math.min(...tops)>tolerance&&Math.max(...bottoms)-Math.min(...bottoms)>tolerance){
      throw new Error('所选型材不在同一个框面，请分面生成板材');
    }
    const pair=(axis,coordinate)=>{
      const sorted=[...grouped.get(axis)].sort((a,b)=>a.center[coordinate.toLowerCase()]-b.center[coordinate.toLowerCase()]);
      const low=sorted[0],high=sorted[sorted.length-1];
      if(low===high||sorted.some((m,i)=>i&&Math.abs(m.center[coordinate.toLowerCase()]-sorted[i-1].center[coordinate.toLowerCase()])<tolerance))throw new Error('外框有重叠或拼接边，暂不能唯一判断整块板材');
      return [low,high];
    };
    const widthPair=pair(preferred.widthAxis,preferred.heightAxis),heightPair=pair(preferred.heightAxis,preferred.widthAxis);
    const widthBounds=this.innerBounds(heightPair,preferred.widthAxis),heightBounds=this.innerBounds(widthPair,preferred.heightAxis);
    const width=widthBounds.max-widthBounds.min,height=heightBounds.max-heightBounds.min;
    if(width<=1||height<=1)throw new Error('外框净尺寸无效，请检查四条外边');
    const touches=(a,b)=>AXIS_NAMES.every(axis=>a.box.min[axis.toLowerCase()]<=b.box.max[axis.toLowerCase()]+tolerance&&b.box.min[axis.toLowerCase()]<=a.box.max[axis.toLowerCase()]+tolerance);
    const columns=[];
    for(const mesh of this.editor.meshes||[]){
      const p=mesh.userData?.part;if(!p||p.hidden||mesh.visible===false||ids.includes(p.id)||p.type!=='PROFILE')continue;
      try{const member=this.describePanelMember(mesh);if(member.axis===normalAxis)columns.push(member);}catch{ /* 未适配/斜切对象不作为闭合证明。 */ }
    }
    for(const a of widthPair)for(const b of heightPair){
      if(!touches(a,b)&&!columns.some(column=>touches(a,column)&&touches(b,column)))throw new Error('外框角部没有贴合，也没有同时接到同一根立柱；请先吸附或补齐外边');
    }
    const boundary=[...widthPair,...heightPair],boundaryIds=new Set(boundary.map(m=>m.part.id));
    for(const member of members.filter(m=>!boundaryIds.has(m.part.id))){
      const along=member.axis===preferred.widthAxis?widthBounds:heightBounds;
      const across=member.axis===preferred.widthAxis?heightBounds:widthBounds;
      const key=(member.axis===preferred.widthAxis?preferred.heightAxis:preferred.widthAxis).toLowerCase();
      if(options.resolveSlots!==false)this.assertCovers(member,member.axis,along,tolerance);
      else if(member.box.max[member.axis.toLowerCase()]<=along.min+tolerance||member.box.min[member.axis.toLowerCase()]>=along.max-tolerance)throw new Error('所选中间梁不在当前框口内');
      if(member.box.min[key]<across.min-tolerance||member.box.max[key]>across.max+tolerance)throw new Error('中间承托梁超出所选外框，请只选择同一框内的构件');
    }
    const planeMembers=placement==='T_SLOT'?boundary:members;
    const min=Math.max(...planeMembers.map(m=>m.box.min[n])),max=Math.min(...planeMembers.map(m=>m.box.max[n]));
    if(max<min-tolerance)throw new Error('所选构件没有共同框面');
    const center={x:0,y:0,z:0};
    center[preferred.widthAxis.toLowerCase()]=(widthBounds.min+widthBounds.max)/2;
    center[preferred.heightAxis.toLowerCase()]=(heightBounds.min+heightBounds.max)/2;
    center[n]=(min+max)/2;
    const basis=makePanelBasis(preferred.widthAxis,preferred.heightAxis),euler=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(basis.width,basis.height,basis.normal)),'XYZ');
    const assemblyIds=[...new Set(members.map(m=>m.part.assemblyId).filter(Boolean))];
    const cornerPartIds=columns.filter(column=>widthPair.some(a=>heightPair.some(b=>touches(a,column)&&touches(b,column)))).map(column=>column.part.id);
    const opening={sourcePartIds:members.map(m=>m.part.id),boundaryPartIds:boundary.map(m=>m.part.id),cornerPartIds,sourceDisplayIds:members.map(m=>m.part.displayId||m.part.id),
      widthAxis:preferred.widthAxis,heightAxis:preferred.heightAxis,normalAxis,width,height,center,rotation:{x:euler.x,y:euler.y,z:euler.z},
      basis:{width:{...basis.width},height:{...basis.height},normal:{...basis.normal}},bounds:{width:widthBounds,height:heightBounds},
      panelPlacement:placement,supportFaceMm:Math.max(...tops),assemblyId:assemblyIds.length===1?assemblyIds[0]:null};
    return placement==='T_SLOT'&&options.resolveSlots!==false?resolvePanelSlots(opening,boundary,options):opening;
  }

  /**
   * 插槽板和显式divideFrame消费者共用真实分隔梁；后者只分格，不要求活动件插入T槽。
   * 只截取连续长梁的本格区间，不把其实体截断；未选中的同面梁也参与。
   * 只有覆盖当前净口、实际贴合两端的杆才能分隔；半截梁不能延长成虚拟边，仍由预览显示冲突。
   */
  resolvePanelCells(partIds=null,options={}){
    if(options.placement&&options.placement!=='T_SLOT'&&!options.divideFrame)return {cells:[{opening:this.resolvePanel(partIds,options),error:''}]};
    const outer=this.resolvePanel(partIds,{...options,resolveSlots:false}),tolerance=Math.max(.01,Number(options.axisToleranceMm??.1));
    const n=outer.normalAxis.toLowerCase(),half=Number(options.thickness??5)/2;
    const boundary=outer.boundaryPartIds.map(id=>this.describePanelMember(this.editor.getMeshByPartId(id)));
    let plane=outer.center[n],outerError='';
    const slotMode=outer.panelPlacement==='T_SLOT';
    if(slotMode)try{plane=resolvePanelSlots(outer,boundary,options).center[n];}catch(error){outerError=error.message;}
    const columns=[],candidates=[],boundaryIds=new Set(outer.boundaryPartIds);
    for(const mesh of this.editor.meshes||[]){
      const part=mesh.userData?.part;
      if(!part||part.type!=='PROFILE'||part.hidden||mesh.visible===false)continue;
      let member;try{member=this.describePanelMember(mesh);}catch{continue;}
      if(member.axis===outer.normalAxis){columns.push(member);continue;}
      if(boundaryIds.has(part.id)||member.box.min[n]>=plane+half-.001||member.box.max[n]<=plane-half+.001)continue;
      const isWidth=member.axis===outer.widthAxis,across=isWidth?outer.bounds.height:outer.bounds.width;
      const key=(isWidth?outer.heightAxis:outer.widthAxis).toLowerCase(),along=isWidth?outer.bounds.width:outer.bounds.height;
      if(member.box.min[key]<across.min-tolerance||member.box.max[key]>across.max+tolerance)continue;
      if(member.box.max[member.axis.toLowerCase()]<=along.min+tolerance||member.box.min[member.axis.toLowerCase()]>=along.max-tolerance)continue;
      candidates.push(member);
    }
    for(const id of outer.sourcePartIds.filter(id=>!boundaryIds.has(id))){
      if(!candidates.some(m=>m.part.id===id))throw new Error('所选中间梁不在外框的插槽板面内；请不要混选其他层');
    }
    // 限制有限 DIY 框口规模；不扫描其他层、不以装配成员名或“第几根”推断板数。
    if(candidates.length>64)throw new Error('当前框内同面构件超过64根，请分区域填板');
    const touches=(a,b)=>AXIS_NAMES.every(axis=>a.box.min[axis.toLowerCase()]<=b.box.max[axis.toLowerCase()]+tolerance&&b.box.min[axis.toLowerCase()]<=a.box.max[axis.toLowerCase()]+tolerance);
    const connected=(a,b)=>touches(a,b)||columns.some(column=>touches(a,column)&&touches(b,column));
    const queue=[boundary],leaves=[];
    while(queue.length){
      const edges=queue.shift(),widthBounds=this.innerBounds(edges.slice(2),outer.widthAxis),heightBounds=this.innerBounds(edges.slice(0,2),outer.heightAxis);
      const cuts=candidates.filter(member=>{
        if(edges.some(e=>e.part.id===member.part.id))return false;
        const isWidth=member.axis===outer.widthAxis,across=isWidth?heightBounds:widthBounds,along=isWidth?widthBounds:heightBounds;
        const key=(isWidth?outer.heightAxis:outer.widthAxis).toLowerCase(),axis=member.axis.toLowerCase();
        if(member.box.min[key]<across.min-tolerance||member.box.max[key]>across.max+tolerance||member.box.max[key]-member.box.min[key]>=across.max-across.min-1)return false;
        if(member.box.min[axis]>along.min+tolerance||member.box.max[axis]<along.max-tolerance)return false;
        return (isWidth?edges.slice(2):edges.slice(0,2)).every(edge=>connected(member,edge));
      }).sort((a,b)=>Number(a.axis===outer.widthAxis)-Number(b.axis===outer.widthAxis)||a.center[(a.axis===outer.widthAxis?outer.heightAxis:outer.widthAxis).toLowerCase()]-b.center[(b.axis===outer.widthAxis?outer.heightAxis:outer.widthAxis).toLowerCase()]||a.part.id.localeCompare(b.part.id));
      const cut=cuts[0];
      if(!cut){leaves.push(edges);continue;}
      if(leaves.length+queue.length>=63)throw new Error('分格超过64块，请分区域填板');
      if(cut.axis===outer.heightAxis){queue.push([edges[0],edges[1],edges[2],cut],[edges[0],edges[1],cut,edges[3]]);}
      else queue.push([edges[0],cut,edges[2],edges[3]],[cut,edges[1],edges[2],edges[3]]);
    }
    const cells=leaves.map(edges=>{
      // 每块只保存自己的四边 ID；以后改尺寸、完整复制和重新适配仍可重算长梁上的局部框口。
      const opening=this.resolvePanel(edges.map(m=>m.part.id),{...options,resolveSlots:false});
      opening.center[n]=plane;
      if(!slotMode)return {opening,error:''};
      try{
        const fitted=resolvePanelSlots(opening,edges,{...options,slotPlaneMm:plane});
        return {opening:fitted,error:outerError};
      }catch(error){return {opening,error:outerError||error.message};}
    }).sort((a,b)=>a.opening.center[outer.heightAxis.toLowerCase()]-b.opening.center[outer.heightAxis.toLowerCase()]||a.opening.center[outer.widthAxis.toLowerCase()]-b.opening.center[outer.widthAxis.toLowerCase()]);
    return {cells};
  }

  /**
   * 新填板入口按真实闭合外框分面；共享立柱不从选择中消耗，允许同时属于正面和侧面。
   * 已保存板的单面解析与门框入口不变，每个框面仍走原插槽、分格和四角闭合检查。
   */
  resolveSelectedPanelCells(partIds=null,options={}){
    const ids=partIds?.length?[...new Set(partIds)]:this.selectedProfileIds();
    if(ids.length<4||ids.length>64)throw new Error('请选择一个或多个框面的完整四边，可一起选中间分隔梁（最多64根）');
    const members=ids.map(id=>{
      const mesh=this.editor.getMeshByPartId(id);
      if(!mesh||mesh.visible===false||mesh.userData.part?.hidden||mesh.userData.part?.type!=='PROFILE')throw new Error('框口板仅支持可见的直线型材');
      return this.describePanelMember(mesh);
    });
    let singleError;
    try{
      // 保留原单面外框和整层分格行为，包括真实槽位失败的红色预览，不借分组放宽合法性。
      const {cells}=this.resolvePanelCells(ids,options);
      if(options.normalAxis&&cells.some(cell=>cell.opening.normalAxis!==options.normalAxis))throw new Error('所选框口不是当前安装朝向');
      return {cells:cells.map(cell=>({...cell,frameIndex:0})),unusedPartIds:[]};
    }catch(error){singleError=error;}
    const frames=this.selectedPanelFrames(members,options);
    if(!frames.length){
      if(new Set(members.map(member=>member.axis)).size===2)throw singleError;
      throw new Error('未识别到完整闭合框面；请为每个面选齐四条边，并检查角部是否实际贴合');
    }
    const used=new Set(),cells=[],cellKeys=new Set();
    let frameIndex=0;
    for(const frame of frames){
      const {opening}=frame,n=opening.normalAxis.toLowerCase(),half=Number(options.thickness??5)/2;
      const boundaryIds=new Set(opening.boundaryPartIds);
      const frameIds=members.filter(member=>{
        if(boundaryIds.has(member.part.id))return true;
        if(![opening.widthAxis,opening.heightAxis].includes(member.axis))return false;
        if(member.box.min[n]>=frame.planeMm+half-.001||member.box.max[n]<=frame.planeMm-half+.001)return false;
        const isWidth=member.axis===opening.widthAxis,across=isWidth?opening.bounds.height:opening.bounds.width;
        const key=(isWidth?opening.heightAxis:opening.widthAxis).toLowerCase(),along=isWidth?opening.bounds.width:opening.bounds.height;
        return member.box.min[key]>=across.min-frame.tolerance&&member.box.max[key]<=across.max+frame.tolerance
          &&member.box.max[member.axis.toLowerCase()]>along.min+frame.tolerance&&member.box.min[member.axis.toLowerCase()]<along.max-frame.tolerance;
      }).map(member=>member.part.id);
      for(const id of frameIds)used.add(id);
      const result=this.resolvePanelCells(frameIds,options);
      const uniqueCells=result.cells.filter(cell=>{
        const key=panelCellKey(cell.opening,options);
        if(cellKeys.has(key))return false;
        cellKeys.add(key);return true;
      });
      if(!uniqueCells.length)continue;
      cells.push(...uniqueCells.map(cell=>({...cell,frameIndex})));
      frameIndex++;
      if(cells.length>64)throw new Error('多面分格合计超过64块，请分区域填板');
    }
    return {cells,unusedPartIds:ids.filter(id=>!used.has(id))};
  }

  /** 自动组合先检查真实四角连接，再复用原闭合及槽位解析；不补虚拟边。 */
  selectedPanelFrames(members,options={}){
    const tolerance=Math.max(.01,Number(options.axisToleranceMm??.1)),candidates=[],keys=new Set();
    const columns=[];
    for(const mesh of this.editor.meshes||[]){
      const part=mesh.userData?.part;if(!part||part.type!=='PROFILE'||part.hidden||mesh.visible===false)continue;
      try{columns.push(this.describePanelMember(mesh));}catch{ /* 未适配构件不能证明闭合。 */ }
    }
    let attempts=0;
    for(const normalAxis of AXIS_NAMES){
      if(options.normalAxis&&normalAxis!==options.normalAxis)continue;
      const {widthAxis,heightAxis}=preferredPanelAxes(normalAxis),n=normalAxis.toLowerCase();
      const widths=members.filter(member=>member.axis===widthAxis),heights=members.filter(member=>member.axis===heightAxis);
      if(widths.length<2||heights.length<2)continue;
      const supports=columns.filter(member=>member.axis===normalAxis);
      const connected=(a,b)=>panelMembersTouch(a,b,tolerance)||supports.some(column=>panelMembersTouch(a,column,tolerance)&&panelMembersTouch(b,column,tolerance));
      for(let i=0;i<widths.length;i++)for(let j=i+1;j<widths.length;j++){
        const widthPair=[widths[i],widths[j]],heightBounds=this.innerBounds(widthPair,heightAxis);
        if(heightBounds.max-heightBounds.min<=1)continue;
        // 柱间侧梁可通过同一立柱连接两条外边，不额外要求它覆盖梁间净口；闭合由原解析器核实。
        const sides=heights.filter(member=>widthPair.every(edge=>connected(member,edge)));
        for(let a=0;a<sides.length;a++)for(let b=a+1;b<sides.length;b++){
          const heightPair=[sides[a],sides[b]],widthBounds=this.innerBounds(heightPair,widthAxis),edges=[...widthPair,...heightPair];
          if(widthBounds.max-widthBounds.min<=1)continue;
          const min=Math.max(...edges.map(edge=>edge.box.min[n])),max=Math.min(...edges.map(edge=>edge.box.max[n]));
          if(max<min-tolerance)continue;
          if(++attempts>2048)throw new Error('所选构件的闭合框口组合过多，请分面或分区域填板');
          const ids=edges.map(edge=>edge.part.id),key=[normalAxis,...[...ids].sort()].join('|');
          if(keys.has(key))continue;
          let opening;
          try{opening=this.resolvePanel(ids,{...options,resolveSlots:false});}catch{continue;}
          keys.add(key);
          let planeMm=opening.center[n],slotPlane=false;
          if(opening.panelPlacement==='T_SLOT'){
            const boundary=opening.boundaryPartIds.map(id=>edges.find(edge=>edge.part.id===id));
            try{planeMm=resolvePanelSlots(opening,boundary,options).center[n];slotPlane=true;}catch(error){
              // 自动组合不将跨槽面的包络接触当成板面；显式单面仍走原错误预览。
              if(error.code==='PANEL_SLOT_PLANES_MISMATCH')continue;
              // 板厚、槽深、封槽等真实适配失败保留，不能靠筛选假装安装合格。
            }
          }
          candidates.push({opening,planeMm,slotPlane,tolerance,min,max});
        }
      }
    }
    candidates.sort((a,b)=>b.opening.width*b.opening.height-a.opening.width*a.opening.height||a.opening.boundaryPartIds.join('|').localeCompare(b.opening.boundaryPartIds.join('|')));
    const frames=[];
    for(const candidate of candidates){
      const containing=frames.find(frame=>panelFrameContains(frame,candidate));
      if(containing){
        if(panelFrameContains(candidate,containing))throw new Error('同一框面有重叠的外边，无法唯一判断板材；请取消重复边或分区域选择');
        continue; // 同面的内层框由原分格器处理，不能再生成一张覆盖它的重复板。
      }
      frames.push(candidate);
    }
    const order=['Z','X','Y'];
    return frames.sort((a,b)=>order.indexOf(a.opening.normalAxis)-order.indexOf(b.opening.normalAxis)||a.planeMm-b.planeMm
      ||a.opening.bounds.height.min-b.opening.bounds.height.min||a.opening.bounds.width.min-b.opening.bounds.width.min);
  }

  /** 包络来自型材尺寸和本体姿态，不把表面印字、孔标或选择辅助线算作外框尺寸。 */
  describePanelMember(mesh){
    const part=mesh.userData.part,d=part?.dimensions;
    if(part?.profilePath?.type==='ARC'||part?.type!=='PROFILE'||Object.values(part.endCuts||{}).some(c=>Math.abs(Number(c?.angleDeg||0))>1e-7))throw new Error('自动框口板暂不支持弯杆或斜切边');
    mesh.updateWorldMatrix(true,false);
    const scale=mesh.getWorldScale(new THREE.Vector3()),quaternion=mesh.getWorldQuaternion(new THREE.Quaternion());
    if([scale.x,scale.y,scale.z].some(v=>Math.abs(v-1)>1e-7))throw new Error('自动框口板不支持缩放型材，请用实际截面尺寸');
    const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(quaternion));
    if(axes.some(v=>Math.max(Math.abs(v.x),Math.abs(v.y),Math.abs(v.z))<1-1e-7))throw new Error('自动框口板暂支持横平竖直及截面90°朝向');
    const [w,h]=d.sectionSize||[d.size,d.size],length=Number(part.profilePath?.length??d.length);
    if(![Number(w),Number(h),length].every(v=>Number.isFinite(v)&&v>0))throw new Error('框口型材尺寸无效');
    const points=[];
    for(const x of [-w/2,w/2])for(const y of [-h/2,h/2])for(const z of [-length/2,length/2])points.push(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));
    const box=new THREE.Box3().setFromPoints(points),center=mesh.getWorldPosition(new THREE.Vector3());
    return {mesh,part,box,center,size:box.getSize(new THREE.Vector3()),axis:dominantAxis(axes[2])};
  }

  selectedProfileIds() {
    const meshes = this.editor.selectedMeshes?.length ? this.editor.selectedMeshes : (this.editor.selected ? [this.editor.selected] : []);
    return meshes.filter(mesh => mesh.userData?.part?.type === 'PROFILE').map(mesh => mesh.userData.part.id);
  }

  describeMember(mesh) {
    mesh.updateMatrixWorld(true);
    const part = mesh.userData.part;
    const center = mesh.getWorldPosition(new THREE.Vector3());
    const quaternion = mesh.getWorldQuaternion(new THREE.Quaternion());
    const direction = new THREE.Vector3(0,0,1).applyQuaternion(quaternion).normalize();
    const axis = dominantAxis(direction);
    if (Math.abs(direction[axis.toLowerCase()]) < 1 - 1e-7) throw new Error('框口填板目前支持沿画布方向的矩形框；斜框请使用自由添加');
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    return {mesh,part,axis,center,size,box};
  }

  assertCovers(member,axis,bounds,tolerance) {
    const key=axis.toLowerCase();
    if(member.box.min[key]>bounds.min+tolerance || member.box.max[key]<bounds.max-tolerance)throw new Error('所选型材没有围成框口：有边过短或偏离角部，请先检查四条边');
  }

  innerBounds(pair, coordinateAxis) {
    const key = coordinateAxis.toLowerCase();
    const sorted = [...pair].sort((a,b) => a.center[key] - b.center[key]);
    const low = sorted[0];
    const high = sorted[1];
    const lowThickness = Math.max(0.1, Number(low.size[key] || 0));
    const highThickness = Math.max(0.1, Number(high.size[key] || 0));
    return {
      min:low.center[key] + lowThickness / 2,
      max:high.center[key] - highThickness / 2
    };
  }
}

function panelMembersTouch(a,b,tolerance){
  return AXIS_NAMES.every(axis=>a.box.min[axis.toLowerCase()]<=b.box.max[axis.toLowerCase()]+tolerance&&b.box.min[axis.toLowerCase()]<=a.box.max[axis.toLowerCase()]+tolerance);
}

/** 跨框面组合后的同一板位只保留一份，槽引用不同的合法平行板面仍独立；键只用于本次规划。 */
function panelCellKey(opening,options={}){
  // 纯框口消费者按真实四边和净区间去重：30/60梁的框面中点不同，不是两个抽屉空间。
  if(options.divideFrame&&opening.panelPlacement!=='T_SLOT')return JSON.stringify([opening.normalAxis,[...opening.sourcePartIds].sort(),opening.bounds]);
  const slots=(opening.slotFit?.edges||[]).map(edge=>[edge.profileId,edge.face,edge.slotId]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify([opening.normalAxis,[...opening.sourcePartIds].sort(),slots,
    slots.length?null:opening.center[opening.normalAxis.toLowerCase()]]);
}

/** 仅同一真实框面内去掉被包住的子框；有效插槽面使用原槽位平面容差，不合并平行错层框。 */
function panelFrameContains(outer,inner){
  if(outer.opening.normalAxis!==inner.opening.normalAxis)return false;
  const tolerance=Math.min(outer.tolerance,inner.tolerance),planeTolerance=outer.slotPlane&&inner.slotPlane?1e-4:tolerance;
  if(Math.abs(outer.planeMm-inner.planeMm)>=planeTolerance||Math.min(outer.max,inner.max)<Math.max(outer.min,inner.min)-tolerance)return false;
  return ['width','height'].every(axis=>outer.opening.bounds[axis].min<=inner.opening.bounds[axis].min+tolerance&&outer.opening.bounds[axis].max>=inner.opening.bounds[axis].max-tolerance);
}

function dominantAxis(vector) {
  const values = {X:Math.abs(vector.x),Y:Math.abs(vector.y),Z:Math.abs(vector.z)};
  return [...AXIS_NAMES].sort((a,b) => values[b] - values[a])[0];
}

function preferredPanelAxes(normalAxis) {
  if (normalAxis === 'Z') return {widthAxis:'X',heightAxis:'Y'};
  if (normalAxis === 'Y') return {widthAxis:'X',heightAxis:'Z'};
  return {widthAxis:'Z',heightAxis:'Y'};
}

function axisVector(axis) {
  if (axis === 'X') return new THREE.Vector3(1,0,0);
  if (axis === 'Y') return new THREE.Vector3(0,1,0);
  return new THREE.Vector3(0,0,1);
}

function makePanelBasis(widthAxis,heightAxis) {
  const width = axisVector(widthAxis);
  const height = axisVector(heightAxis);
  const normal = new THREE.Vector3().crossVectors(width,height).normalize();
  return {width,height,normal};
}
