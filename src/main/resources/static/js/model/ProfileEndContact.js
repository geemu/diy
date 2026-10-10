import * as THREE from 'three';
import {getSectionDefinition} from './ProfileSectionRegistry.js';
import {getFaceSurfaceOffset,getFaceHalfSpan} from './ProfileCoordinateSystem.js';

/** 吸附与设计连接共用的端面贴平判断；只读既有截面/斜切/世界矩阵，不移动型材。 */
export function profileEndContact(source,target,options={}) {
  const errors=[],sourcePart=source?.userData?.part,targetPart=target?.userData?.part;
  const surface=getFaceSurfaceOffset(targetPart?.dimensions?.sectionSize,options.targetFace);
  const section=getSectionDefinition(sourcePart?.designProfile?.profileId,sourcePart?.designProfile?.faceClosures||[]);
  const linear=part=>part?.type==='PROFILE'&&(!part.profilePath||part.profilePath.type==='LINE')&&Number(part.dimensions?.length)>0;
  if(!linear(sourcePart)||!linear(targetPart)||!surface||!section?.outer?.length){
    return {ok:false,angleErrorDeg:0,contactGapMm:0,errors:[{code:'CONTACT_GEOMETRY_UNSUPPORTED',message:'当前截面 / 路径没有可用的端面贴合几何'}]};
  }
  source.updateWorldMatrix(true,false);target.updateWorldMatrix(true,false);
  const end=options.sourceEnd==='END'?'END':'START',cut=endCut(sourcePart,end);
  const normal=new THREE.Vector3(0,0,end==='END'?1:-1);
  normal[cut.axis]=cut.tangent;
  normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(source.matrixWorld));
  const targetNormal=new THREE.Vector3();targetNormal[surface.axis]=Math.sign(surface.value);
  targetNormal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(target.matrixWorld));
  const alignment=THREE.MathUtils.clamp(-normal.dot(targetNormal),-1,1);
  const angleErrorDeg=THREE.MathUtils.radToDeg(Math.acos(alignment));
  const targetPlanePoint=new THREE.Vector3();targetPlanePoint[surface.axis]=surface.value;
  targetPlanePoint.applyMatrix4(target.matrixWorld);
  const inverseTarget=target.matrixWorld.clone().invert(),delta=options.delta||new THREE.Vector3();
  const length=Number(sourcePart.dimensions?.length||0),targetLength=Number(targetPart.dimensions?.length||0);
  const halfSpan=getFaceHalfSpan(targetPart.dimensions?.sectionSize,options.targetFace);
  const targetStart=endCut(targetPart,'START'),targetEnd=endCut(targetPart,'END');
  let contactGapMm=0,outside=false;
  for(const vertex of section.outer){
    const x=Number(vertex.x),y=Number(vertex.y);
    const offset=cut.tangent*(cut.axis==='x'?x:y);
    const z=end==='END'?length/2-offset:-length/2+offset;
    const world=new THREE.Vector3(x,y,z).applyMatrix4(source.matrixWorld).add(delta);
    contactGapMm=Math.max(contactGapMm,Math.abs(world.clone().sub(targetPlanePoint).dot(targetNormal)));
    const local=world.applyMatrix4(inverseTarget);
    const across=surface.axis==='y'?local.x:local.y;
    const startZ=-targetLength/2+targetStart.tangent*local[targetStart.axis];
    const endZ=targetLength/2-targetEnd.tangent*local[targetEnd.axis];
    if(Math.abs(across)>halfSpan+.1||local.z<startZ-.1||local.z>endZ+.1)outside=true;
  }
  // 中心碰到不代表整面贴平；反向穿入、倾斜端面和 10mm 间隙都不能显示成功。
  if(alignment<.999999||contactGapMm>.10001){
    errors.push({code:'PROFILE_END_NOT_FLUSH',message:`端面未贴平：方向偏差 ${format(angleErrorDeg)}°，最大间隙 ${format(contactGapMm)} mm；请先对齐型材`});
  }
  // 两梁侧面内角可由实际连接件两条腿提供支撑；只有通过端口 / 足迹检查的调用方可免除此项。
  if(options.requireFootprint!==false&&outside)errors.push({code:'PROFILE_END_OUT_OF_SUPPORT',message:'端面超出目标型材的支撑范围，请移动到完整贴合的位置'});
  return {ok:!errors.length,angleErrorDeg,contactGapMm,errors};
}

export function endCut(part,end){
  const raw=part?.endCuts?.[end]||{};
  const angle=THREE.MathUtils.clamp(Number(raw.angleDeg||0),-60,60);
  return {axis:raw.axis==='Y'?'y':'x',tangent:Math.abs(angle)<.001?0:Math.tan(THREE.MathUtils.degToRad(angle))};
}
function format(value){return Number(Number(value).toFixed(2));}
