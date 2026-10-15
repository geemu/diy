import {drawerGroupLayout} from '../diy/DrawerGroupModel.js';

const TOLERANCE_MM = .1;
const MAX_REAR_COMBINATIONS = 512;

/** 读取共用分格器给出的本格四边与真实包住它的后框，不移动宿主或把外深当净深。 */
export function resolveDrawerOpening(editor,sourcePartIds,options={},openingDescriptor=null) {
  const ids = [...new Set(sourcePartIds||[])];
  if (ids.length !== 4) throw new Error('本格尚未解析成4条真实边，请重新选择完整外框区域');
  const resolver = editor.panelDoorConfigurator.openingResolver;
  const members = ids.map(id => {
    const mesh = editor.getMeshByPartId(id);
    if (!mesh || mesh.visible === false || mesh.userData?.part?.hidden || mesh.userData?.part?.type !== 'PROFILE') throw new Error('抽屉框口需要4根可见的直线型材');
    return resolver.describePanelMember(mesh);
  });
  const opening = openingDescriptor || resolver.resolvePanel(ids,{placement:'INSET',resolveSlots:false});
  if (opening.heightAxis !== 'Y' || !['X','Z'].includes(opening.normalAxis)) throw new Error('抽屉需要竖直框口，请选择本层正面的左右立柱和上下梁，不要选择水平层框');
  const side = options.frontSide ?? 'POSITIVE';
  if (!['POSITIVE','NEGATIVE'].includes(side)) throw new Error('请选择抽屉朝外的方向');
  const clearance = Number(options.edgeClearanceMm ?? 2);
  if (options.edgeClearanceMm === null || typeof options.edgeClearanceMm === 'boolean' || String(options.edgeClearanceMm ?? 2).trim() === '' || !Number.isFinite(clearance) || clearance < .1 || clearance > 50) throw new Error('框口安装间隙须为0.1～50 mm');
  const sign = side === 'POSITIVE' ? 1 : -1, n = opening.normalAxis.toLowerCase();
  const visible = [];
  for (const mesh of editor.meshes) {
    if (!mesh.userData?.part || mesh.visible === false || mesh.userData.part.hidden || mesh.userData.part.type !== 'PROFILE' || ids.includes(mesh.userData.part.id)) continue;
    try { visible.push(resolver.describePanelMember(mesh)); } catch { /* 弯杆、斜杆或未知姿态不能证明后框。 */ }
  }
  const outward = member => sign > 0 ? member.box.max[n] : -member.box.min[n];
  const frontPlane = Math.max(...members.map(outward));
  const w=opening.widthAxis.toLowerCase(),behind=visible.filter(member=>outward(member)<frontPlane-TOLERANCE_MM);
  const bars=behind.filter(member=>member.axis===opening.widthAxis&&member.box.min[w]<=opening.bounds.width.min+TOLERANCE_MM&&member.box.max[w]>=opening.bounds.width.max-TOLERANCE_MM);
  const posts=behind.filter(member=>member.axis==='Y'&&member.box.min.y<=opening.bounds.height.min+TOLERANCE_MM&&member.box.max.y>=opening.bounds.height.max-TOLERANCE_MM);
  // 前面已被真实竖杆分格时，后框可包住本格，不要求背后再复制一根同位置竖杆。
  const lists=[bars.filter(member=>member.box.max.y<=opening.bounds.height.min+TOLERANCE_MM),
    bars.filter(member=>member.box.min.y>=opening.bounds.height.max-TOLERANCE_MM),
    posts.filter(member=>member.box.min[w]<=opening.bounds.width.min+TOLERANCE_MM),
    posts.filter(member=>member.box.max[w]>=opening.bounds.width.max-TOLERANCE_MM)];
  if (lists.some(list => !list.length)) throw new Error('没有识别到该层对应的后框，无法确定安装深度；请检查选择的框口和朝外方向，不会改为在原点生成');
  if (lists.reduce((count,list) => count*list.length,1) > MAX_REAR_COMBINATIONS) throw new Error('对应后框有过多重叠候选，请分区域选择或清理重复型材');
  const rearFrames = [];
  for (const a of lists[0]) for (const b of lists[1]) for (const c of lists[2]) for (const d of lists[3]) {
    const rear = [a,b,c,d],rearIds = rear.map(member => member.part.id);
    if (new Set(rearIds).size !== 4) continue;
    try {
      const frame = resolver.resolvePanel(rearIds,{placement:'INSET',resolveSlots:false});
      if (frame.normalAxis !== opening.normalAxis || ['width','height'].some(axis => frame.bounds[axis].min>opening.bounds[axis].min+TOLERANCE_MM || frame.bounds[axis].max<opening.bounds[axis].max-TOLERANCE_MM)) continue;
      // 采用后框最靠内的材料面，保守留出后方空间；角码/内部梁仍由原材料检查处理。
      rearFrames.push({ids:rearIds,plane:Math.max(...rear.map(outward)),bounds:frame.bounds,
        extra:frame.width*frame.height-opening.width*opening.height});
    } catch { /* 不闭合或错层的组合不作为真实深度边界。 */ }
  }
  rearFrames.sort((a,b) => b.plane-a.plane || a.extra-b.extra);
  if (!rearFrames.length) throw new Error('对应后框没有形成同层闭合框口，无法确定抽屉安装深度');
  const rear = rearFrames[0];
  if (rearFrames.slice(1).some(frame => Math.abs(frame.plane-rear.plane) <= TOLERANCE_MM && JSON.stringify(frame.bounds)===JSON.stringify(rear.bounds)
    && [...frame.ids].sort().join('|') !== [...rear.ids].sort().join('|'))) throw new Error('对应后框有重复或歧义的边，请先明确安装区域');
  const frontMode = options.frontMode ?? 'INSET';
  if (!['INSET','OVERLAY'].includes(frontMode)) throw new Error('请选择内置或外盖面板');
  const thickness = Number(options.frontThickness ?? 18);
  if (!Number.isFinite(thickness) || thickness < 3) throw new Error('面板厚度须不小于3 mm');
  const panelOuter = frontMode === 'OVERLAY' ? frontPlane+clearance+thickness : frontPlane-clearance;
  const available = {width:opening.width-clearance*2,height:opening.height-clearance*2,depth:panelOuter-rear.plane-clearance};
  if (available.width < 120 || available.height < 100 || available.depth < 120) throw new Error('扣除安装间隙后，该框口不足以放入当前抽屉模型');
  const position = {...opening.center,y:opening.bounds.height.min+clearance};
  position[n] = sign*(panelOuter-thickness/2);
  const rotationY = opening.normalAxis === 'Z' ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? Math.PI/2 : -Math.PI/2);
  return {sourcePartIds:ids,rearPartIds:rear.ids,sourceDisplayIds:opening.sourceDisplayIds,normalAxis:opening.normalAxis,
    frontSide:side,clearanceMm:clearance,width:opening.width,height:opening.height,available,position,rotationY};
}

/** 表单值保留原样；超出净空间时只生成红色示意，不暗改尺寸、导轨或型材。 */
export function planDrawersInOpening(editor,sourcePartIds,options={},openingDescriptor=null) {
  const opening = resolveDrawerOpening(editor,sourcePartIds,options,openingDescriptor);
  const fit=value=>Math.floor((value+1e-7)*100)/100;
  const effective = {...options,...(options.sizeMode==='AUTO'?Object.fromEntries(Object.entries(opening.available).map(([key,value])=>[key,fit(value)])):{}),
    position:{...opening.position},rotationY:opening.rotationY};
  const layout = drawerGroupLayout(effective),errors = [];
  for (const [key,label] of [['width','总宽'],['height','总高'],['depth','深度']]) {
    if (layout.parameters[key] > opening.available[key] + .001) errors.push(`${label} ${mm(layout.parameters[key])} mm 超过该框口可用${label} ${mm(opening.available[key])} mm；可按框口填入尺寸或手动调整`);
  }
  return {opening,options:effective,layout,errors};
}

function mm(value) { return Number(Number(value).toFixed(2)); }
