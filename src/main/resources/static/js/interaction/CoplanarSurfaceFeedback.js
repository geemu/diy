import {profileSidePlanes} from '../model/ProfileFeatureCatalog.js';
import {createSurfaceFeedback,disposeFeedback} from './SurfaceFeedback.js';

export const COPLANAR_SURFACE_COLOR=0xa17af5;
export const COPLANAR_TOLERANCE_MM=0.1;

/** 齐平只是展示判断，不是约束/移动命令。上面指空间朝上的实体侧面，不是屏幕上方。 */
export function compareProfileTopPlanes(source,target,sourceOffset=null){
  const topPlanes=mesh=>{
    const planes=profileSidePlanes(mesh);
    const maximum=Math.max(...planes.map(plane=>plane.normal.y));
    if(maximum<0.25)return [];
    return planes.filter(plane=>maximum-plane.normal.y<1e-6);
  };
  let best=null;
  const sourcePlanes=topPlanes(source);
  // 只读预测平移后的表面；不临时移动业务 Mesh，以免触发随动、历史或页面闪动。
  if(sourceOffset)for(const plane of sourcePlanes){plane.point.add(sourceOffset);for(const corner of plane.corners)corner.add(sourceOffset);}
  for(const a of sourcePlanes)for(const b of topPlanes(target)){
    if(a.normal.dot(b.normal)<0.999999)continue;
    const gapMm=Math.abs(a.normal.dot(a.point.clone().sub(b.point)));
    const deviation=Math.max(...a.corners.map(p=>Math.abs(b.normal.dot(p.clone().sub(b.point)))),...b.corners.map(p=>Math.abs(a.normal.dot(p.clone().sub(a.point)))));
    const relation={sourceFace:a.face,targetFace:b.face,gapMm,maxDeviationMm:deviation,aligned:deviation<=COPLANAR_TOLERANCE_MM};
    if(!best||relation.maxDeviationMm<best.maxDeviationMm)best=relation;
  }
  return best;
}

/** 两边都存在真实平面材料才同时高亮，圆弧面/未知截面不能只凭包围范围宣称齐平。 */
export function addCoplanarSurfaceFeedback(group,source,target,seenFaces=null){
  const relation=compareProfileTopPlanes(source,target);
  if(!relation?.aligned)return relation;
  const helpers=[[source,relation.sourceFace],[target,relation.targetFace]].map(([root,face])=>createSurfaceFeedback(root,{feature:{face},color:COPLANAR_SURFACE_COLOR,opacity:0.46,renderOrder:1603}));
  if(helpers.some(helper=>!helper)){
    for(const helper of helpers)if(helper)disposeFeedback(helper);
    return {...relation,aligned:false,unsupportedSurface:true};
  }
  const keys=[`${source.uuid}:${relation.sourceFace}`,`${target.uuid}:${relation.targetFace}`];
  for(let i=0;i<helpers.length;i++){
    const helper=helpers[i];
    if(seenFaces?.has(keys[i])){disposeFeedback(helper);continue;}
    seenFaces?.add(keys[i]);helper.userData.__coplanar=true;group.add(helper);
  }
  return relation;
}

export function coplanarFeedbackLabel(relation){
  if(!relation||relation.unsupportedSurface)return '';
  if(relation.aligned)return '当前上表面齐平 · 紫色';
  const value=Number(relation.gapMm.toFixed(2));
  return value>0?`上表面未齐平 · 高差 ${value} mm`:'上表面有倾斜 · 未齐平';
}
