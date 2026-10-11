import * as THREE from 'three';
import {getSlotDefinitionsForFace} from '../model/ProfileFeatureCatalog.js';
import {getSectionDefinition} from '../model/ProfileSectionRegistry.js';
import {slotWorldPoint,slotWorldNormal} from '../model/SlotMatcher.js';
import {panelMaterialContours} from '../model/PanelShapeModel.js';
import {clipContourToRectangle,contourArea} from '../model/PanelContourMath.js';

const EPS=1e-6;
const EDGES=['BOTTOM','TOP','LEFT','RIGHT'];
const FACES=['FRONT','BACK','LEFT','RIGHT'];

/** 四边插槽的领域布局。槽位来自当前开放槽，槽深来自截面外轮廓的第一道材料壁，不猜型号。 */
export function resolvePanelSlots(opening,boundary,options={}){
  const thickness=Number(options.thickness??5),clearance=Number(options.clearanceMm??2);
  if(!Number.isFinite(thickness)||thickness<.5||!Number.isFinite(clearance)||clearance<.1||clearance>20)throw new Error('插槽板厚度至少0.5mm，槽底余量应为0.1至20mm');
  if(Number(options.normalOffsetMm??0)!==0)throw new Error('四边插槽按实际槽口落位，不支持法向偏移');
  const n=opening.normalAxis.toLowerCase(),center=new THREE.Vector3(opening.center.x,opening.center.y,opening.center.z);
  const candidates=boundary.map((member,index)=>{
    const edge=EDGES[index],toward=center.clone().sub(member.center);toward[n]=0;
    // 沿杆方向不属于侧面法向；仅取这条边指向框口的横向分量。
    toward[member.axis.toLowerCase()]=0;toward.normalize();
    const face=FACES.find(value=>slotWorldNormal(member.mesh,value).dot(toward)>1-1e-7);
    const section=getSectionDefinition(member.part.designProfile?.profileId,member.part.designProfile?.faceClosures||[]);
    const label=member.part.displayId||member.part.name||'外框型材';
    if(!face||!section?.outer?.length)throw new Error(label+' 缺少可识别的向内槽面或截面轮廓，不能四边插槽');
    const saved=options.slotFit?.edges?.find(value=>value.edge===edge);
    const slots=getSlotDefinitionsForFace(member.part,face).filter(slot=>!saved||(saved.profileId===member.part.id&&saved.face===face&&saved.slotId===slot.id));
    const values=slots.map(slot=>({member,edge,face,slot,section,point:slotWorldPoint(member.mesh,{face,offset:slot.offset,stationS:member.part.dimensions.length/2})}));
    if(!values.length)throw new Error(label+' 朝框口的一面没有开放的适配 T 槽；请检查封槽、截面朝向或重新适配');
    return values;
  });
  const fits=[];
  // 不把错层槽口“平均”成一张板。四条槽的中心平面必须真正重合。
  for(const first of candidates[0]){
    const plane=first.point[n],chosen=[first,...candidates.slice(1).map(values=>values.find(value=>Math.abs(value.point[n]-plane)<1e-4))];
    if(chosen.some(value=>!value))continue;
    try{
      const edges=chosen.map(value=>slotInsertion(value,opening,thickness,clearance));
      fits.push({plane,edges});
    }catch(error){fits.push({plane,error});}
  }
  const fit=fits.filter(value=>!value.error).sort((a,b)=>Math.abs(a.plane-center[n])-Math.abs(b.plane-center[n])||a.plane-b.plane)[0];
  if(!fit)throw fits.find(value=>value.error)?.error||new Error('四条向内 T 槽不在同一平面；请调整外框截面朝向或槽位，不会把板材抬到梁顶');
  const byEdge=Object.fromEntries(fit.edges.map(value=>[value.edge,value]));
  const widthBounds={min:opening.bounds.width.min-byEdge.LEFT.insertionMm,max:opening.bounds.width.max+byEdge.RIGHT.insertionMm};
  const heightBounds={min:opening.bounds.height.min-byEdge.BOTTOM.insertionMm,max:opening.bounds.height.max+byEdge.TOP.insertionMm};
  const position={...opening.center};position[n]=fit.plane;
  position[opening.widthAxis.toLowerCase()]=(widthBounds.min+widthBounds.max)/2;
  position[opening.heightAxis.toLowerCase()]=(heightBounds.min+heightBounds.max)/2;
  return {...opening,width:widthBounds.max-widthBounds.min,height:heightBounds.max-heightBounds.min,center:position,panelPlacement:'T_SLOT',
    slotFit:{version:1,edges:fit.edges.map(({edge,profileId,face,slotId,insertionMm})=>({edge,profileId,face,slotId,insertionMm}))},
    slotEngagement:fit.edges.map((value,index)=>{
      const member=boundary[index],along=member.axis.toLowerCase(),origin=position[along];
      return {edge:value.edge,insertionMm:value.insertionMm,min:member.box.min[along]-origin,max:member.box.max[along]-origin};
    })};
}

function slotInsertion(value,opening,thickness,clearance){
  const {member,edge,face,slot,section,point}=value,n=opening.normalAxis.toLowerCase();
  const label=member.part.displayId||member.part.name||'型材';
  if(!Number.isFinite(Number(slot.width))||thickness+.1>Number(slot.width)+EPS)throw new Error(label+' 的槽口宽 '+slot.width+'mm，放不下 '+thickness+'mm 板厚及装配余量');
  const inward=slotWorldNormal(member.mesh,face).negate();
  const ring=section.outer.map(p=>{
    const world=new THREE.Vector3(p.x,p.y,0).applyMatrix4(member.mesh.matrixWorld).sub(point);
    return {u:world[n],d:world.dot(inward)};
  });
  // 第一道壁随 u 呈分段线性：检索厚度带两端、全部截面顶点及区间中点即可覆盖整带，非仅孔心采样。
  const half=thickness/2+.05,stations=[-half,half,...ring.map(p=>p.u).filter(u=>u>-half&&u<half)].sort((a,b)=>a-b);
  const samples=stations.flatMap((u,i)=>i?[u,(u+stations[i-1])/2]:[u]);
  const depth=Math.min(...samples.map(u=>firstWall(ring,u)));
  const insertion=Math.floor((depth-clearance)*10000)/10000;
  if(!Number.isFinite(depth)||insertion<.5)throw new Error(label+' 的实际槽口/槽底不能容纳当前板厚和槽底余量；请减薄板材或调整余量');
  return {edge,profileId:member.part.id,face,slotId:slot.id,insertionMm:insertion};
}

function firstWall(ring,u){
  let first=Infinity;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    if(u<Math.min(a.u,b.u)-EPS||u>Math.max(a.u,b.u)+EPS)continue;
    if(Math.abs(a.u-b.u)<EPS){if(Math.abs(u-a.u)<EPS&&Math.max(a.d,b.d)>=-EPS)first=Math.min(first,Math.max(0,Math.min(a.d,b.d)));continue;}
    const d=a.d+(b.d-a.d)*(u-a.u)/(b.u-a.u);
    if(d>=-EPS)first=Math.min(first,Math.max(0,d));
  }
  return first;
}

/** 裁角后四条边仍必须各有实际板料进入槽内，不能把整条插入边切掉后仍称为四边插槽。 */
export function assertPanelSlotEngagement(part,opening){
  if(opening.panelPlacement!=='T_SLOT')return;
  const p=part.position||{},r=part.rotation||{},q=new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x||0,r.y||0,r.z||0));
  const target=opening.rotation,expected=new THREE.Quaternion().setFromEuler(new THREE.Euler(target.x,target.y,target.z));
  if(Math.abs(Number(part.dimensions.width)-opening.width)>1e-4||Math.abs(Number(part.dimensions.height)-opening.height)>1e-4
    ||['x','y','z'].some(key=>!Number.isFinite(Number(p[key]))||Math.abs(Number(p[key])-opening.center[key])>1e-4)||q.angleTo(expected)>1e-5)throw new Error('板材已偏离关联 T 槽，请先预览重新适配；不会静默恢复原位置');
  const outer=panelMaterialContours(part).outer,w=Number(part.dimensions.width)/2,h=Number(part.dimensions.height)/2;
  for(const fit of opening.slotEngagement){
    const vertical=['LEFT','RIGHT'].includes(fit.edge),span=vertical?h:w;
    const min=Math.max(-span,fit.min),max=Math.min(span,fit.max),depth=fit.insertionMm;
    const bounds=vertical?{minX:fit.edge==='LEFT'?-w:w-depth,maxX:fit.edge==='LEFT'?-w+depth:w,minY:min,maxY:max}
      :{minX:min,maxX:max,minY:fit.edge==='BOTTOM'?-h:h-depth,maxY:fit.edge==='BOTTOM'?-h+depth:h};
    if(max-min<1||rectangleMaterialArea(outer,bounds)<depth*.5)throw new Error(({LEFT:'左',RIGHT:'右',TOP:'上',BOTTOM:'下'})[fit.edge]+'边裁剪后没有保留有效插槽板边，请调整裁角或改选框口');
  }
}

function rectangleMaterialArea(ring,bounds){
  const cx=(bounds.minX+bounds.maxX)/2,cy=(bounds.minY+bounds.maxY)/2;
  return clipContourToRectangle(ring.map(p=>({x:p.x-cx,y:p.y-cy})),(bounds.maxX-bounds.minX)/2,(bounds.maxY-bounds.minY)/2)
    .reduce((sum,contour)=>sum+Math.abs(contourArea(contour)),0);
}

/** Schema62 的可选业务引用；不保存世界槽坐标、射线、材质或渲染网格。 */
export function validPanelSlotFit(spec){
  const fit=spec?.slotFit;
  return Array.isArray(spec?.sourcePartIds)&&fit?.version===1&&Array.isArray(fit.edges)&&fit.edges.length===4&&EDGES.every(edge=>fit.edges.filter(value=>value?.edge===edge).length===1)
    &&new Set(fit.edges.map(value=>value?.profileId)).size===4&&fit.edges.every(value=>value&&spec.sourcePartIds.includes(value.profileId)&&FACES.includes(value.face)
      &&typeof value.slotId==='string'&&!!value.slotId&&typeof value.insertionMm==='number'&&Number.isFinite(value.insertionMm)&&value.insertionMm>=.5)
    &&Number.isFinite(Number(spec.clearanceMm))&&Number(spec.clearanceMm)>=.1&&Number(spec.clearanceMm)<=20&&Number(spec.normalOffsetMm??0)===0;
}
