import * as THREE from 'three';
import {getSectionDefinition} from '../model/ProfileSectionRegistry.js';
import {slotWorldNormal} from '../model/SlotMatcher.js';

/** 验证实际槽腔，不把“宿主不参与第三方OBB”当成可以把隐藏件埋入铝材的许可。 */
export function hiddenConnectorFits(source,target,transform,layout,sourceFace) {
  if(!layout||!transform)return false;
  source.updateMatrixWorld(true);target.updateMatrixWorld(true);
  const targetAxis=new THREE.Vector3(0,0,1).transformDirection(target.matrixWorld);
  if(Math.abs(targetAxis.dot(slotWorldNormal(source,sourceFace)))<.99999)return false;
  for(const support of layout.supports){
    const host=support.host==='SOURCE'?source:target,part=host.userData.part;
    // 当前只承诺等截面直杆；斜切、缩放及未知空腔不能靠设计参考件绕过。
    if(['START','END'].some(end=>Math.abs(Number(part.endCuts?.[end]?.angleDeg||0))>.001))return false;
    const scale=host.getWorldScale(new THREE.Vector3());
    if([scale.x,scale.y,scale.z].some(value=>Math.abs(value-1)>.00001))return false;
    const section=getSectionDefinition(part.designProfile?.profileId,part.designProfile?.faceClosures||[]);
    if(!section?.outer?.length)return false;
    const direction=new THREE.Vector3(...support.direction).applyQuaternion(transform.quaternion);
    const hostAxis=new THREE.Vector3(0,0,1).transformDirection(host.matrixWorld);
    // T脚只适配共轴直槽；斜着把宽脚塞进槽口不能靠投影或放宽容差通过。
    if(Math.abs(direction.dot(hostAxis))<1-1e-12)return false;
    const rings=[section.outer,...(section.holes||[])];
    for(const station of [0,support.length]){
      const polygon=[];
      for(const vertex of support.contour){
        const world=new THREE.Vector3(...vertex).applyQuaternion(transform.quaternion).add(transform.position).addScaledVector(direction,station);
        const local=host.worldToLocal(world),[w,h]=part.dimensions.sectionSize;
        if(Math.abs(local.x)>w/2+.0001||Math.abs(local.y)>h/2+.0001||Math.abs(local.z)>part.dimensions.length/2+.0001)return false;
        polygon.push({x:local.x,y:local.y});
      }
      // 用与实体相同的凹T轮廓，而不是把窄颈/宽脚之间的槽唇也填进矩形。
      if(polygon.some(point=>inMaterial(point,section)))return false;
      for(const ring of rings)for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length];
        if(inside(a,polygon)&&!onBoundary(a,polygon))return false;
        if(polygon.some((c,j)=>segmentsCross(a,b,c,polygon[(j+1)%polygon.length])))return false;
      }
    }
  }
  return true;
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
