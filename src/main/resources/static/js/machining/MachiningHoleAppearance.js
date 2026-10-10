import * as THREE from 'three';

// 常见公制粗牙仅用于展示；不是新的加工参数或制造规格。
const COARSE_PITCH = new Map([[2,.4],[2.5,.45],[3,.5],[4,.7],[5,.8],[6,1],[8,1.25],[10,1.5],[12,1.75],[16,2]]);

/** 只读取孔型、尺寸与孔组关系；未指定的小孔/未知螺距不能伪造为已配置。 */
export function machiningHoleAppearanceData(item,items,part) {
  const type=String(item.type||''),thread=/^(?:END_TAP|TAPPED_HOLE)$/.test(type);
  const sink=type.includes('COUNTERSINK'),counterbore=type.includes('COUNTERBORE');
  const linked=items.find(other=>other.id===item.linkedHoleId&&other.type==='THROUGH_HOLE');
  const size=/^M\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?/i.exec(String(item.tappingSize||''));
  const nominal=positive(size?.[1],positive(item.diameter,8));
  const explicitPitch=item.threadPitch??item.pitch??size?.[2];
  const pitch=explicitPitch==null?(COARSE_PITCH.get(nominal)||0):positive(explicitPitch,0);
  const radius=positive(sink?(item.majorDiameter??item.diameter):thread?nominal:item.diameter,8)/2;
  const [width,height]=part.dimensions.sectionSize;
  const span=positive(['LEFT','RIGHT'].includes(item.face)?width:height,30);
  let depth=positive(item.depth,12),entrance=Math.min(.18,radius*.06);
  let bore=Math.max(.05,radius-Math.min(.13,radius*.035)),mode=0,amplitude=0;
  const closed=type!=='THROUGH_HOLE'&&!linked;
  if (sink) {
    bore=linked?Math.min(radius,positive(linked.diameter,8)/2):0;
    const angle=Math.min(170,Math.max(10,positive(item.angleDeg??item.countersinkAngleDeg,90)));
    entrance=Math.max(.02,(radius-bore)/Math.tan(THREE.MathUtils.degToRad(angle/2)));
    depth=linked?Math.max(span,entrance):entrance;
    mode=1;
  } else if (counterbore) {
    bore=linked?Math.min(radius,positive(linked.diameter,8)/2):radius;
    entrance=depth;
    if (linked) depth=Math.max(span,entrance+.02);
    mode=2;
  } else if (thread&&pitch>0) {
    // 有明确底孔时优先真实底孔；没有底孔字段时只作粗牙牙形展示近似。
    const minor=positive(item.diameter,Math.max(.1,nominal-1.08*pitch))/2;
    if (minor<radius) {
      bore=minor;amplitude=radius-minor;mode=3;
      entrance=Math.min(depth*.2,Math.max(.2,pitch*.35));
    }
  }
  if (type==='THROUGH_HOLE') depth=span;
  return {radius,bore,depth,entrance,mode,pitch,amplitude,closed,
    traceDepth:Math.min(depth,Math.max(radius*6,pitch*8,.2))};
}

/**
 * 在真实孔位绘制随视角变化的虚拟凹腔。宿主截面未做布尔切除：
 * 孔壁/锥面/螺旋牙是展示层光照，深度缓冲仍为孔口，不能据此判断实体空腔。
 */
export function addMachiningHoleAppearance(group,item,items,pose,part) {
  const data=machiningHoleAppearanceData(item,items,part);
  const marker=new THREE.Group();marker.name='__machining_hole__';
  marker.userData.machiningId=item.id;marker.userData.appearanceOnly=true;
  marker.position.copy(pose.point);marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),pose.normal);
  const uniforms={
    openingRadius:{value:data.radius},boreRadius:{value:data.bore},holeDepth:{value:data.depth},
    entranceDepth:{value:data.entrance},traceDepth:{value:data.traceDepth},holeMode:{value:data.mode},
    threadPitch:{value:Math.max(.01,data.pitch)},threadAmplitude:{value:data.amplitude},closedBottom:{value:data.closed?1:0},
    cameraLocal:{value:new THREE.Vector3()},viewLocal:{value:new THREE.Vector3(0,0,1)},orthographic:{value:0},
    keyLocal:{value:new THREE.Vector3()},fillLocal:{value:new THREE.Vector3()},metalColor:{value:new THREE.Color('#a2a6ab')}
  };
  const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,
    side:THREE.FrontSide,transparent:true,opacity:1,depthTest:true,depthWrite:true,fog:false});
  const aperture=new THREE.Mesh(new THREE.CircleGeometry(data.radius,64),material);
  aperture.name='__hole_aperture__';aperture.renderOrder=1600;aperture.raycast=()=>{};
  const inverse=new THREE.Matrix4(),cameraWorld=new THREE.Vector3(),direction=new THREE.Vector3();
  const key=new THREE.Vector3(1400,2600,1500).normalize(),fill=new THREE.Vector3(-1200,900,-800).normalize();
  aperture.onBeforeRender=(_renderer,_scene,camera)=>{
    inverse.copy(aperture.matrixWorld).invert();
    camera.getWorldPosition(cameraWorld);uniforms.cameraLocal.value.copy(cameraWorld).applyMatrix4(inverse);
    camera.getWorldDirection(direction).negate();uniforms.viewLocal.value.copy(direction).transformDirection(inverse);
    uniforms.orthographic.value=camera.isOrthographicCamera?1:0;
    uniforms.keyLocal.value.copy(key).transformDirection(inverse);uniforms.fillLocal.value.copy(fill).transformDirection(inverse);
    material.uniformsNeedUpdate=true;
  };
  marker.add(aperture);group.add(marker);
}

function positive(value,fallback) {const number=Number(value);return Number.isFinite(number)&&number>0?number:fallback;}

const vertexShader=`
varying vec2 aperturePoint;
void main() {
  aperturePoint=position.xy;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

const fragmentShader=`
uniform float openingRadius,boreRadius,holeDepth,entranceDepth,traceDepth,holeMode;
uniform float threadPitch,threadAmplitude,closedBottom,orthographic;
uniform vec3 cameraLocal,viewLocal,keyLocal,fillLocal,metalColor;
varying vec2 aperturePoint;

float cavityRadius(vec3 p) {
  float depth=max(0.0,-p.z);
  if (holeMode<0.5) return mix(openingRadius,boreRadius,clamp(depth/entranceDepth,0.0,1.0));
  if (holeMode<1.5) return mix(openingRadius,boreRadius,clamp(depth/entranceDepth,0.0,1.0));
  if (holeMode<2.5) return depth<entranceDepth?openingRadius:boreRadius;
  if (depth<entranceDepth) return mix(openingRadius,boreRadius,depth/entranceDepth);
  // 深度与圆周角同时变化：右旋螺旋，不是互不相连的平圆环。
  float theta=dot(p.xy,p.xy)<0.000001?0.0:atan(p.y,p.x);
  float phase=depth/threadPitch+theta/6.2831853;
  float tooth=smoothstep(0.08,0.88,2.0*abs(fract(phase)-0.5));
  return boreRadius+threadAmplitude*tooth;
}

float wallField(vec3 p) {return length(p.xy)-cavityRadius(p);}

vec3 inwardNormal(vec3 p) {
  float e=max(0.001,min(openingRadius*.003,threadPitch*.02));
  vec3 g=vec3(wallField(p+vec3(e,0.0,0.0))-wallField(p-vec3(e,0.0,0.0)),
              wallField(p+vec3(0.0,e,0.0))-wallField(p-vec3(0.0,e,0.0)),
              wallField(p+vec3(0.0,0.0,e))-wallField(p-vec3(0.0,0.0,e)));
  return -g/max(length(g),0.00001);
}

vec3 metalShade(vec3 p,vec3 normal,vec3 view) {
  float depth=max(0.0,-p.z),relativeDepth=depth/max(openingRadius,0.1);
  float cavityLight=0.35+0.65*exp(-relativeDepth*.38);
  float key=max(0.0,dot(normal,keyLocal)),fill=max(0.0,dot(normal,fillLocal));
  float reflection=pow(max(0.0,dot(normal,normalize(keyLocal+view))),30.0);
  float edge=pow(1.0-max(0.0,dot(normal,view)),3.0)*.09;
  float toolMark=sin(depth*90.0/openingRadius)*.015;
  return (metalColor*(.16+.65*key+.24*fill+toolMark)+vec3(reflection*.48+edge))*cavityLight;
}

void main() {
  vec3 entry=vec3(aperturePoint,0.0);
  vec3 view=orthographic>.5?normalize(viewLocal):normalize(cameraLocal-entry);
  if (view.z<=.015) discard;
  vec3 ray=-view;
  float stepDepth=traceDepth/64.0,previous=0.0,hitDepth=traceDepth;
  bool hit=false;
  for (int i=1;i<=64;i++) {
    float depth=float(i)*stepDepth;
    vec3 p=entry+ray*(depth/max(.015,view.z));
    if (wallField(p)>=0.0) {
      float low=previous,high=depth;
      for (int j=0;j<5;j++) {
        float middle=(low+high)*.5;
        if (wallField(entry+ray*(middle/view.z))>=0.0) high=middle;else low=middle;
      }
      hitDepth=(low+high)*.5;hit=true;break;
    }
    previous=depth;
  }
  vec3 color=vec3(.008,.011,.016);
  if (hit) {
    vec3 p=entry+ray*(hitDepth/view.z),normal=inwardNormal(p);
    // 沉孔的台阶底面朝外，不能误画成连续斜面。
    if (holeMode>1.5&&holeMode<2.5&&abs(hitDepth-entranceDepth)<stepDepth*.06) normal=vec3(0.0,0.0,1.0);
    color=metalShade(p,normal,view);
  } else if (closedBottom>.5&&holeDepth<=traceDepth+.001) {
    vec3 p=entry+ray*(holeDepth/view.z);
    color=metalShade(p,vec3(0.0,0.0,1.0),view)*.55;
  }
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
