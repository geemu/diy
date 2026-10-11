import * as THREE from 'three';

const sectionAppearance=new WeakMap();

/** 铝材外观只归显示网格所有；用户的配色、截面、孔径与制造数据保持原值。 */
export function createProfileAluminumMaterial(part) {
  const material=new THREE.MeshStandardMaterial({
    color:part.color||0xd3d7db,metalness:.82,roughness:.42,envMapIntensity:.78,
    vertexColors:true,dithering:true,side:THREE.DoubleSide,fog:false,
    // 真实轮廓线与金属面仍错开一个深度单位，避免转动时争抢像素。
    polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1
  });
  material.userData.profileAluminum=true;
  configureProfileAluminumMaterial(material);
  return material;
}

/** Three 的材质 clone 不复制编译回调；弧形分段克隆后也须显式接回同一套外观。 */
export function configureProfileAluminumMaterial(material) {
  if(!material?.isMeshStandardMaterial||!material.userData.profileAluminum)return;
  material.extensions={...(material.extensions||{}),derivatives:true};
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
attribute vec2 profileSurface;
attribute vec4 profileRim;
varying vec4 vProfilePosition;
varying vec4 vProfileRim;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
vProfilePosition=vec4(position,profileSurface.x+2.0*profileSurface.y);
vProfileRim=profileRim;
`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec4 vProfilePosition;
varying vec4 vProfileRim;
// 细纹固定在型材的毫米坐标中；小于屏幕像素时衰减，不能变成转动闪烁的条纹。
float profileGrainWave(float phase) {
  return sin(phase)*(1.0-smoothstep(.7,3.0,fwidth(phase)));
}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
float profileBore=step(1.5,vProfilePosition.w);
float profileCut=clamp(vProfilePosition.w,0.0,1.0)*(1.0-profileBore);
float profileAcross=dot(vProfilePosition.xy,vec2(.63,.78));
float profileSkinGrain=profileGrainWave(profileAcross*42.0+sin(vProfilePosition.z*.015)*.5)
  +.5*profileGrainWave(profileAcross*97.0+vProfilePosition.z*.017);
float profileCutGrain=profileGrainWave(vProfilePosition.x*12.0+vProfilePosition.y*.7)
  +.5*profileGrainWave(vProfilePosition.x*30.0+vProfilePosition.y*.4);
float profileGrain=mix(profileSkinGrain,profileCutGrain,profileCut);
diffuseColor.rgb*=mix(.82,.96,profileCut)*(1.0+profileGrain*.014);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+profileCut*.17-profileBore*.08+profileGrain*.012,.26,.78);`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
metalnessFactor=clamp(metalnessFactor-profileCut*.08,0.0,1.0);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
// 仅在现有凸棱约 .16mm 的表面带中柔化反光，不移动材料边界或补上槽口。
float rimWidth=max(.0001,min(.16,vProfileRim.y*.08));
float rimResolution=1.0-smoothstep(.5,2.0,fwidth(vProfileRim.x)/rimWidth);
vec3 profileDX=dFdx(-vViewPosition),profileDY=dFdy(-vViewPosition);
vec2 profileDU=vec2(dFdx(vProfileRim.x),dFdy(vProfileRim.x));
vec2 profileDZ=vec2(dFdx(vProfilePosition.z),dFdy(vProfilePosition.z));
float profileDet=profileDU.x*profileDZ.y-profileDU.y*profileDZ.x;
if(vProfileRim.y>0.0&&profileCut<.5&&profileBore<.5) {
  float fromStart=1.0-smoothstep(0.0,rimWidth,max(0.0,vProfileRim.x));
  float fromEnd=1.0-smoothstep(0.0,rimWidth,max(0.0,vProfileRim.y-vProfileRim.x));
  float rimTilt=(-vProfileRim.z*fromStart+vProfileRim.w*fromEnd)*rimResolution;
  // 用实际表面导数取沿轮廓的切向，只增两个 vec4 varying，避免小显卡的插值槽负担。
  vec3 profileTangent=(profileDX*profileDZ.y-profileDY*profileDZ.x)*sign(profileDet);
  if(abs(rimTilt)>.0001&&abs(profileDet)>1e-8&&dot(profileTangent,profileTangent)>.000001)
    normal=normalize(normal+normalize(profileTangent)*rimTilt*faceDirection);
}`);
  };
  material.customProgramCacheKey=()=> 'profile-aluminum-cut-skin-rim-v1';
}

/**
 * 端面保持硬法向，侧壁只平滑当前轮廓中相邻小角度曲面；T 槽、方孔与材料棱角不抹圆。
 * profileSurface / profileRim 是可裁剪插值的展示属性，不是新的加工或截面事实。
 */
export function applyProfileSurfaceShading(geometry,section) {
  const position=geometry.attributes.position,normal=geometry.attributes.normal;
  if(!position||!normal)return;
  const colors=new Float32Array(position.count*3),surfaces=new Float32Array(position.count*2),rims=new Float32Array(position.count*4);
  let appearance=section&&sectionAppearance.get(section);
  if(!appearance&&section?.outer?.length) {
    appearance=sectionAppearanceData(section);sectionAppearance.set(section,appearance);
  }
  for(let i=0;i<position.count;i+=3) {
    const cut=Math.abs(normal.getZ(i))>.9;
    const edge=cut||geometry.index?null:triangleSectionEdge(position,i,appearance?.segments);
    for(let k=i;k<Math.min(i+3,position.count);k++) {
      const faceCut=geometry.index?Math.abs(normal.getZ(k))>.9:cut;
      const x=position.getX(k),y=position.getY(k);
      let shade=1;
      if(!faceCut&&appearance?.hull.length) {
        let depth=Infinity;
        for(const e of appearance.hull)depth=Math.min(depth,(e.dx*(y-e.a.y)-e.dy*(x-e.a.x))/e.length);
        shade=.36+.64*Math.exp(-Math.max(0,depth)/appearance.falloff);
      }
      colors.set([shade,shade,shade],k*3);surfaces[k*2]=faceCut?1:0;
      if(!edge)continue;
      const u=Math.max(0,Math.min(edge.length,(x-edge.a.x)*edge.tx+(y-edge.a.y)*edge.ty));
      const end=u>edge.length/2?edge.end:edge.start;
      normal.setXYZ(k,end.normal.x,end.normal.y,0);
      rims.set([u,edge.length,edge.start.rim,edge.end.rim],k*4);
    }
  }
  normal.needsUpdate=true;
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('profileSurface',new THREE.BufferAttribute(surfaces,2));
  geometry.setAttribute('profileRim',new THREE.BufferAttribute(rims,4));
}

function sectionAppearanceData(section) {
  const points=section.outer.map(p=>({x:Number(p.x),y:Number(p.y)})).sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=list=>{
    const result=[];
    for(const point of list){while(result.length>1&&cross(result.at(-2),result.at(-1),point)<=0)result.pop();result.push(point);}
    return result;
  };
  const hull=half(points).slice(0,-1).concat(half([...points].reverse()).slice(0,-1));
  const width=points.at(-1).x-points[0].x,height=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
  const hullEdges=hull.length<3?[]:hull.map((a,i)=>{const b=hull[(i+1)%hull.length];return {a,dx:b.x-a.x,dy:b.y-a.y,length:Math.hypot(b.x-a.x,b.y-a.y)};});
  const segments=new Map();
  for(const outline of [section.outer,...(section.holes||[])]) {
    const ring=outline.map(p=>({x:Number(p.x),y:Number(p.y)}));
    if(ring.length>1&&pointKey(ring[0])===pointKey(ring.at(-1)))ring.pop();
    // 用户截面中可能带连续重合点；它不形成表面，不能参与单位切向或圆弧法向计算。
    for(let i=ring.length-1;i>0;i--)if(pointKey(ring[i])===pointKey(ring[i-1]))ring.splice(i,1);
    if(ring.length<3)continue;
    const area=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a.x*b.y-b.x*a.y;},0);
    // 材料始终在轮廓左侧：外环逆时针、孔环顺时针，法向朝真实空腔或外侧。
    if((outline===section.outer&&area<0)||(outline!==section.outer&&area>0))ring.reverse();
    const edges=ring.map((a,i)=>{
      const b=ring[(i+1)%ring.length],length=Math.hypot(b.x-a.x,b.y-a.y);
      return {a,b,length,tx:(b.x-a.x)/length,ty:(b.y-a.y)/length};
    });
    for(let i=0;i<edges.length;i++) {
      const edge=edges[i];if(!Number.isFinite(edge.tx)||!Number.isFinite(edge.ty))continue;
      edge.normal={x:edge.ty,y:-edge.tx};
      const before=edges[(i+edges.length-1)%edges.length],after=edges[(i+1)%edges.length];
      edge.start=cornerAppearance(before,edge,edge.normal);
      edge.end=cornerAppearance(edge,after,edge.normal);
      segments.set(segmentKey(edge.a,edge.b),edge);
    }
  }
  return {hull:hullEdges,falloff:Math.max(.1,Math.min(width,height)*.085),segments};
}

function cornerAppearance(before,after,flatNormal) {
  const dot=Math.max(-1,Math.min(1,before.tx*after.tx+before.ty*after.ty));
  const turn=before.tx*after.ty-before.ty*after.tx;
  if(dot>Math.cos(Math.PI/6)) {
    const x=before.ty+after.ty,y=-before.tx-after.tx,length=Math.hypot(x,y);
    if(length>1e-8)return {normal:{x:x/length,y:y/length},rim:0};
  }
  // 仅凸角有窄反光带；凹槽转折仍保持原法向，不能假装存在圆角填料。
  return {normal:flatNormal,rim:turn>1e-6&&dot>-.87?Math.min(2,turn/(1+dot)):0};
}

function triangleSectionEdge(position,index,segments) {
  if(!segments)return null;
  const a={x:position.getX(index),y:position.getY(index)};
  for(let k=index+1;k<Math.min(index+3,position.count);k++) {
    const b={x:position.getX(k),y:position.getY(k)};
    if(pointKey(a)!==pointKey(b))return segments.get(segmentKey(a,b))||null;
  }
  return null;
}

// 和 BufferAttribute 相同的 Float32 精度，不把接近的不同槽点并到一个几何位置。
function pointKey(point) {return `${Math.fround(point.x)},${Math.fround(point.y)}`;}
function segmentKey(a,b) {const ka=pointKey(a),kb=pointKey(b);return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;}
