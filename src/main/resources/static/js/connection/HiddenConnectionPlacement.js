import * as THREE from 'three';
import {getSectionDefinition} from '../model/ProfileSectionRegistry.js';
import {slotWorldNormal} from '../model/SlotMatcher.js';

/** 验证实际槽腔，不把“宿主不参与第三方OBB”当成可以把隐藏件埋入铝材的许可。 */
export function hiddenConnectorFits(source,target,transform,layout,sourceFace) {
  return hiddenConnectorFit(source,target,transform,layout,sourceFace).ok;
}

/** 与原空腔守卫共用同一判断，保留失败的宿主/站位原因，不用放宽容差把隐藏件塞进材料。 */
export function hiddenConnectorFit(source,target,transform,layout,sourceFace) {
  const fail=(code,message)=>({ok:false,errors:[{code,message}]});
  if(!layout||!transform)return fail('HIDDEN_COMPONENT_LAYOUT_INVALID','内置角槽件缺少有效的腿轮廓或安装方向');
  source.updateMatrixWorld(true);target.updateMatrixWorld(true);
  const targetAxis=new THREE.Vector3(0,0,1).transformDirection(target.matrixWorld);
  if(Math.abs(targetAxis.dot(slotWorldNormal(source,sourceFace)))<.99999)return fail('HIDDEN_COMPONENT_AXIS_MISALIGNED','内置角槽件的立腿没有沿目标型材槽的长度方向，当前安装面不能形成两槽直角交汇');
  for(const support of layout.supports){
    const host=support.host==='SOURCE'?source:target,part=host.userData.part;
    const label=support.host==='SOURCE'?'源型材':'目标型材';
    // 当前只承诺等截面直杆；斜切、缩放及未知空腔不能靠设计参考件绕过。
    if(['START','END'].some(end=>Math.abs(Number(part.endCuts?.[end]?.angleDeg||0))>.001))return fail('HIDDEN_COMPONENT_END_CUT_UNSUPPORTED',`${label}有斜切端面，当前内置角槽件尚未适配该槽内端部`);
    const scale=host.getWorldScale(new THREE.Vector3());
    if([scale.x,scale.y,scale.z].some(value=>Math.abs(value-1)>.00001))return fail('HIDDEN_COMPONENT_SCALE_UNSUPPORTED',`${label}带缩放，不能用缩放后的槽腔判断内置角槽件安装`);
    const section=getSectionDefinition(part.designProfile?.profileId,part.designProfile?.faceClosures||[]);
    if(!section?.outer?.length)return fail('HIDDEN_COMPONENT_SECTION_UNKNOWN',`${label}没有可确认的实际截面槽腔`);
    const direction=new THREE.Vector3(...support.direction).applyQuaternion(transform.quaternion);
    const hostAxis=new THREE.Vector3(0,0,1).transformDirection(host.matrixWorld);
    // T脚只适配共轴直槽；斜着把宽脚塞进槽口不能靠投影或放宽容差通过。
    if(Math.abs(direction.dot(hostAxis))<1-1e-12)return fail('HIDDEN_COMPONENT_LEG_AXIS_MISALIGNED',`${label}的槽长方向与内置角槽件的腿不共轴，不能斜插或跨接`);
    const rings=[section.outer,...(section.holes||[])];
    const polygons=[],[w,h]=part.dimensions.sectionSize;
    let minimum=Infinity,maximum=-Infinity,outsideSection=false;
    // 支撑端点只转换一次，先解释完整腿长越界，再用同一截面多边形查材料。
    for(const station of [0,support.length]){
      const polygon=[];
      for(const vertex of support.contour){
        const world=new THREE.Vector3(...vertex).applyQuaternion(transform.quaternion).add(transform.position).addScaledVector(direction,station);
        const local=host.worldToLocal(world);
        minimum=Math.min(minimum,local.z);maximum=Math.max(maximum,local.z);
        if(Math.abs(local.x)>w/2+.0001||Math.abs(local.y)>h/2+.0001)outsideSection=true;
        polygon.push({x:local.x,y:local.y});
      }
      polygons.push(polygon);
    }
    const halfLength=part.dimensions.length/2;
    if(minimum<-halfLength-.0001||maximum>halfLength+.0001){
      const end=minimum<-halfLength-.0001?'A':'B',excess=end==='A'?-halfLength-minimum:maximum-halfLength;
      return fail('HIDDEN_COMPONENT_END_OUT_OF_RANGE',`${label}端部长度不足：内置角槽件超出 ${end} 端 ${Number(excess.toFixed(2))} mm，请换安装侧；不会延长型材或强行生成`);
    }
    if(outsideSection)return fail('HIDDEN_COMPONENT_SECTION_OUT_OF_BOUNDS',`${label}的截面不能完整容纳内置角槽件的宽脚`);
    for(const polygon of polygons){
      // 用与实体相同的凹T轮廓，而不是把窄颈/宽脚之间的槽唇也填进矩形。
      if(polygon.some(point=>inMaterial(point,section)))return fail('HIDDEN_COMPONENT_CAVITY_INTERFERENCE',`${label}的槽唇或斜壁与内置角槽件的实际轮廓相交，请换适配规格；不会放宽穿透容差`);
      for(const ring of rings)for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length];
        if(inside(a,polygon)&&!onBoundary(a,polygon))return fail('HIDDEN_COMPONENT_CAVITY_INTERFERENCE',`${label}的槽腔内有材料进入内置角槽件轮廓，请换适配规格`);
        if(polygon.some((c,j)=>segmentsCross(a,b,c,polygon[(j+1)%polygon.length])))return fail('HIDDEN_COMPONENT_CAVITY_INTERFERENCE',`${label}的槽壁与内置角槽件轮廓相交，请换适配规格`);
      }
    }
  }
  return {ok:true,errors:[]};
}

function inMaterial(point,section){return inside(point,section.outer)&&!(section.holes||[]).some(ring=>inside(point,ring));}
function inside(p,ring){
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
}
function segmentsCross(a,b,c,d){
  const side=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const abC=side(a,b,c),abD=side(a,b,d),cdA=side(c,d,a),cdB=side(c,d,b);
  return abC*abD<-1e-10&&cdA*cdB<-1e-10;
}
function onBoundary(p,ring){
  return ring.some((a,index)=>{
    const b=ring[(index+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y;
    return Math.abs(dx*(p.y-a.y)-dy*(p.x-a.x))<=1e-6&&p.x>=Math.min(a.x,b.x)-1e-6&&p.x<=Math.max(a.x,b.x)+1e-6&&p.y>=Math.min(a.y,b.y)-1e-6&&p.y<=Math.max(a.y,b.y)+1e-6;
  });
}
