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
   * 板材专用：选四根外边或连同中间承托梁一起选，仍只解析一块外框板；门框的严格四边入口不变。
   * 水平板按实际梁顶判断同层，而非中心同高；四角允许同一根真实立柱同时贴合两条外边。
   */
  resolvePanel(partIds=null,options={}){
    const ids=partIds?.length?[...new Set(partIds)]:this.selectedProfileIds();
    if(ids.length<4||ids.length>64)throw new Error('请选择同一框面的四根外边，可一起选中间承托梁（最多64根）');
    const members=ids.map(id=>{
      const mesh=this.editor.getMeshByPartId(id);
      if(!mesh||mesh.userData.part?.type!=='PROFILE')throw new Error('框口板仅支持直线型材');
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
      this.assertCovers(member,member.axis,along,tolerance);
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
    return placement==='T_SLOT'?resolvePanelSlots(opening,boundary,options):opening;
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
