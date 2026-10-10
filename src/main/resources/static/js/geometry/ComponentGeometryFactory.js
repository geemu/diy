import * as THREE from 'three';
import {panelContours,panelMaterialContours} from '../model/PanelShapeModel.js';
import {getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';
import {buildDesignProfileSection} from '../model/DesignProfileSection.js';
import {angleBracketLayout,hiddenCornerLayout} from '../model/ConnectionComponentPorts.js';

/** 通用参数化组件几何，预览与实际构件共用。通孔使用带孔轮廓挤出，不依赖远程图片和模型。 */
export default class ComponentGeometryFactory {
  static create(part) {
    const group=new THREE.Group(),d=part.dimensions||{},kind=d.geometryKind;
    group.userData.part=part;
    if(part.type==='PANEL')group.userData.panelDimensionSnapshot=structuredClone(part.dimensions);
    // 画布使用本地环境反射表现五金金属；预览层仍统一中性照明，不改目录或制造参数。
    const material=kind==='FOOT_CUP'
      ?new THREE.MeshPhongMaterial({color:part.color||'#808080',specular:0x999999,shininess:40,side:THREE.DoubleSide})
      :new THREE.MeshStandardMaterial({color:part.color||'#808080',metalness:part.type==='PANEL'?0.05:0.65,roughness:part.type==='PANEL'?0.65:0.32,envMapIntensity:0.85,side:THREE.DoubleSide});
    const add=(geometry,pos=[0,0,0],rot=[0,0,0],color=null)=>{
      const m=color?material.clone():material;
      if(color){m.color.set(color);if(m.isMeshPhongMaterial){m.specular.set(0x111111);m.shininess=8;}if(m.isMeshStandardMaterial){m.metalness=0.05;m.roughness=0.65;}}
      const mesh=new THREE.Mesh(geometry,m);mesh.position.set(...pos);mesh.rotation.set(...rot);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
    };
    const box=(w,h,t,pos=[0,0,0],color=null)=>add(new THREE.BoxGeometry(w,h,t),pos,[0,0,0],color);
    const cyl=(r,h,pos=[0,0,0],color=null)=>add(new THREE.CylinderGeometry(r,r,h,48),pos,[0,0,0],color);
    const plate=(w,h,t,holes=[],pos=[0,0,0],rot=[0,0,0],outline=null)=>{
      // 带孔挤出已经包含真实内壁；沿用金属材质受光，不再叠加纯黑圆筒遮住孔壁。
      return add(extrude(outline||rectangle(w,h),holes,t),pos,rot);
    };
    const s=Number(d.size||20),t=Number(d.thickness||Math.max(2,s*.12)),r=s*.12;
    if(part.type==='PANEL') {
      const shape=d.panelShape||'rectangle',p=d.shapeParameters||d;
      if(shape==='sphere')add(new THREE.SphereGeometry(p.radius,p.segments,p.segments));
      else if(shape==='cylinder'||shape==='cone')add(new THREE.CylinderGeometry(shape==='cone'?0:p.topRadius,p.bottomRadius,p.height,p.segments));
      else if(shape==='torus')add(new THREE.TorusGeometry(p.radius,p.tubeRadius,p.radialSegments,p.tubularSegments));
      else {const c=panelMaterialContours(part);add(extrude(c.outer,c.holes,d.thickness));}
    } else if(kind?.startsWith('SHAFT_')) {
      const type=kind.slice(6),a=d.diameter,b=d.secondDiameter||a,h=d.height,w=d.width;
      const block=(width,height,depth,bores,pos=[0,0,0])=>{
        for(const mesh of boredBlock(width,height,depth,bores,material)){mesh.position.set(...pos);group.add(mesh);}
      };
      if(type==='L_FIX'){
        const level=d.height/2,depth=d.length/2,small=a*.16;
        // 三个方向都是真孔；上下两块的 Y 孔连续，主 Z 孔中心与安装偏移共用目录参数。
        for(const mesh of boredBlock(d.width,level,d.length,[
          {axis:2,center:[0,0,0],radius:a/2},
          {axis:0,center:[0,0,depth/2],radius:b/2},
          {axis:1,center:[0,0,depth/2],radius:b/2},
          {axis:0,center:[0,0,-depth/2],radius:small}
        ],material)) {mesh.position.y=-d.axisOffsetY;group.add(mesh);}
        for(const mesh of boredBlock(d.width,level,depth,[
          {axis:1,center:[0,0,0],radius:b/2},
          {axis:0,center:[0,0,0],radius:small}
        ],material)) {mesh.position.set(0,level-d.axisOffsetY,depth/2);group.add(mesh);}
      }else if(type==='LIMIT_RING'){
        plate(w,w,d.thickness,[circle(0,0,a/2)],[0,0,0],[0,0,0],circle(0,0,w/2));
        add(new THREE.CylinderGeometry(a*.18,a*.18,a*.45,24),[w/2,0,0],[0,0,-Math.PI/2],'#38393b');
      }else if(type==='VERTICAL_SK'){
        plate(w,a*2,a*.5,[circle(-a*1.45,0,a*.2),circle(a*1.45,0,a*.2)],[0,-a*1.5,0],[Math.PI/2,0,0]);
        const bw=a*2.3,bh=a*3;
        const outline=[point(-bw/2,-bh/2),point(bw/2,-bh/2),point(bw/2,bh*.30),point(bw*.30,bh/2),point(-bw*.30,bh/2),point(-bw/2,bh*.30)];
        plate(bw,bh,d.thickness,[circle(0,0,a/2),circle(a*.7,a*.85,a*.16)],[0,0,0],[0,0,0],outline);
        box(a*.08,a*.9,d.thickness+.02,[0,a*1.05,0],'#242424');
      }else if(type==='HORIZONTAL_SHF'){
        const outline=[point(-w/2,-h*.3),point(-w*.38,-h/2),point(w*.38,-h/2),point(w/2,-h*.3),point(w/2,h*.25),point(w*.28,h/2),point(-w*.28,h/2),point(-w/2,h*.25)];
        plate(w,h,d.thickness,[circle(0,0,a/2),circle(-w*.35,0,a*.2),circle(w*.35,0,a*.2)],[0,0,0],[0,0,0],outline);
        box(a*.07,h*.35,d.thickness+.02,[0,h*.35,0],'#242424');
      }else{
        const bores=[{axis:2,center:[0,-d.axisOffsetY,0],radius:a/2}];
        if(type.startsWith('PARALLEL'))bores.push({axis:2,center:[0,d.spacing/2,0],radius:b/2});
        else bores.push(type==='T_FIX'?{axis:1,center:[0,0,0],radius:b/2}:{axis:0,center:[0,a,0],radius:b/2});
        bores.push({axis:0,center:[0,-d.axisOffsetY,0],radius:a*.16});
        if(type.startsWith('PARALLEL'))bores.push({axis:0,center:[0,d.spacing/2,0],radius:a*.16});
        else if(type!=='T_FIX')bores.push({axis:2,center:[0,a,0],radius:a*.16});
        else bores.push({axis:0,center:[0,a,0],radius:a*.16});
        block(w,h,d.length,bores);
      }
    } else if(kind?.startsWith('SCREW_')) {
      const diameter=d.diameter,length=d.length,head=d.headDiameter,type=kind.slice(6),hh=diameter*(type==='PAN_HEAD'?.55:type==='FLAT_COUNTERSUNK'?.55:1);
      cyl(diameter/2,length,[0,-length/2,0]);
      for(let y=-Math.max(.7,diameter*.18);y>-length;y-=Math.max(.7,diameter*.18))add(new THREE.TorusGeometry(diameter/2,.08*diameter,4,24),[0,y,0],[Math.PI/2,0,0]);
      if(type==='FLAT_COUNTERSUNK')add(new THREE.CylinderGeometry(head/2,diameter/2,hh,48),[0,hh/2,0]);
      else if(type==='PAN_HEAD'){
        const profile=[new THREE.Vector2(0,0),new THREE.Vector2(head*.42,0),new THREE.Vector2(head*.5,hh*.25),new THREE.Vector2(head*.44,hh*.75),new THREE.Vector2(head*.22,hh),new THREE.Vector2(0,hh)];
        add(new THREE.LatheGeometry(profile,48));
      }else if(type==='KNURLED_THUMB')cyl(head/2,hh,[0,hh/2,0]);
      else{
        // 杯头为真正的六角沉孔，孔底独立封闭；不能用实心圆柱盖住六角入口。
        add(extrude(circle(0,0,head/2),[circle(0,0,diameter*.3,6)],hh),[0,hh/2,0],[-Math.PI/2,0,0]);
      }
      if(type!=='KNURLED_THUMB')add(new THREE.ShapeGeometry(shapeFrom(circle(0,0,diameter*.3,6))),[0,type==='SHCS'?hh*.15:hh+.01,0],[-Math.PI/2,0,0],'#08090a');
      if(type==='KNURLED_THUMB')for(let i=0;i<36;i++){const a=i*Math.PI/18;cyl(diameter*.035,hh,[Math.cos(a)*head/2,hh/2,Math.sin(a)*head/2],'#66696d');}
    } else if(kind==='SLIDE_RAIL') {
      // 三层槽型轨道、安装孔与翻边，长度减阶与实际放置模型保持一致。
      for(let i=0;i<3;i++){
        const h=d.height-i*10,l=d.length-i*12,x=(i-1)*4;
        plate(l,h,1.2,[circle(-l*.36,0,3.2),circle(0,0,3.2),circle(l*.36,0,3.2)],[x,0,0],[0,Math.PI/2,0]);
        box(4,1.5,l,[x+2,h/2,0]);box(4,1.5,l,[x+2,-h/2,0]);
      }
    } else if(kind==='END_CAP') {
      const profile=getDesignProfileDefinition(d.profileId),outline=profile&&profile.shape!=='T_SLOT'?buildDesignProfileSection(profile,['FRONT','BACK','LEFT','RIGHT']).outer:roundedRectangle(d.width,d.height,Math.min(d.width,d.height)*.06);
      const capHoles=d.capMaterial==='PLASTIC'||!pointInside(outline,0,0)?[]:[circle(0,0,Math.min(d.width,d.height)*.12)];
      plate(d.width,d.height,t,capHoles,[0,0,0],[0,0,0],outline);
      if(d.capMaterial==='PLASTIC')for(const x of [-1,1])for(const y of [-1,1]){
        const cx=x*d.width*.30,cy=y*d.height*.30;
        if(pointInside(outline,cx,cy))box(d.width*.16,d.height*.16,4,[cx,cy,-t/2-2]);
      }
    } else if(kind==='FOOT_CUP') {
      const base=d.footDiameter,stem=d.stemDiameter,len=d.stemLength;
      cyl(base/2,4,[0,-len/2-14,0],'#252628');
      add(new THREE.CylinderGeometry(base*.23,base/2,12,48),[0,-len/2-6,0]);cyl(stem/2,len);
      for(const y of [-len/2+stem*.5,len/2-stem*1.5])add(new THREE.CylinderGeometry(stem,stem,stem*.65,6),[0,y,0]);
      for(let y=-len/2+stem;y<len/2;y+=Math.max(1,stem*.18))add(new THREE.TorusGeometry(stem/2,stem*.04,4,24),[0,y,0],[Math.PI/2,0,0]);
    } else if(kind==='ELASTIC_NUT') {
      const body=[point(-s*.42,-s*.2),point(s*.42,-s*.2),point(s*.32,s*.2),point(-s*.32,s*.2)];
      plate(s*.84,s*.4,s*.3,[circle(0,0,d.diameter/2)],[0,0,0],[0,0,0],body);
      plate(s,s*.5,s*.12,[circle(0,0,d.diameter/2)],[0,0,s*.21]);
      add(new THREE.TorusGeometry(s*.20,s*.018,6,32),[0,-s*.03,-s*.2],[Math.PI/2,0,0]);
    } else if(['FLAT_PLATE','T_PLATE','L_PLATE','CROSS_PLATE'].includes(kind)) {
      const arm=s*.7,span=s*3,a=arm/2,b=span/2;let outline=rectangle(arm,span),holes=[circle(0,-s,r),circle(0,0,r),circle(0,s,r)];
      if(kind==='FLAT_PLATE'&&d.holeCount===2){outline=rectangle(arm,s*2);holes=[circle(0,-s/2,r),circle(0,s/2,r)];}
      if(kind==='T_PLATE'){outline=[point(-b,b),point(b,b),point(b,b-arm),point(a,b-arm),point(a,-b),point(-a,-b),point(-a,b-arm),point(-b,b-arm)];holes=[circle(-s,s,r),circle(0,s,r),circle(s,s,r),circle(0,0,r),circle(0,-s,r)];}
      if(kind==='L_PLATE'){
        const angle=(d.angle||90)*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle),len=s*2,cot=1/Math.tan(angle/2);
        // 两臂真实夹角，不能用“旋转整个直角板”伪装 45° / 135° 规格。
        outline=[point(-a*cot,-a),point(len,-a),point(len,a),point(a*cot,a),point(len*c+a*sn,len*sn-a*c),point(len*c-a*sn,len*sn+a*c)];
        holes=[circle(s*.55,0,r),circle(s*1.55,0,r),circle(s*.55*c,s*.55*sn,r),circle(s*1.55*c,s*1.55*sn,r)];
      }
      if(kind==='CROSS_PLATE'){outline=[point(-a,-b),point(a,-b),point(a,-a),point(b,-a),point(b,a),point(a,a),point(a,b),point(-a,b),point(-a,a),point(-b,a),point(-b,-a),point(-a,-a)];holes=[circle(0,0,r),circle(-s,0,r),circle(s,0,r),circle(0,-s,r),circle(0,s,r)];}
      plate(span,span,t,holes,[0,0,0],[0,0,0],outline);
    } else if(kind==='THREE_D_CONNECTOR') {
      box(s*.8,s*.8,s*.8);
      const width=s*.55,len=s*1.6,depth=s*.45;
      const section=[point(-width/2,-depth/2),point(width/2,-depth/2),point(width/2,depth*.2),point(width*.3,depth/2),point(width*.10,depth/2),point(width*.10,depth*.18),point(-width*.10,depth*.18),point(-width*.10,depth/2),point(-width*.3,depth/2),point(-width/2,depth*.2)];
      const arm=extrude(section,[circle(0,-depth*.12,s*.09)],len);
      add(arm.clone(),[s*.9,0,0],[0,Math.PI/2,0]);add(arm.clone(),[0,-s*.9,0],[Math.PI/2,0,0]);add(arm,[0,0,s*.9]);
      for(const [pos,rot] of [[[s*.85,depth*.28,0],[-Math.PI/2,0,0]],[[0,-s*.85,depth*.28],[0,0,0]],[[0,depth*.28,s*.85],[-Math.PI/2,0,0]]])add(new THREE.CircleGeometry(s*.10,24),pos,rot,'#111111');
    } else if(['THREE_WAY','TWO_WAY','THREE_WAY_RADIAL'].includes(kind)) {
      if(kind==='THREE_WAY_RADIAL') {
        const outline=[point(-s/2,-s/2),point(s/2,-s/2),...Array.from({length:25},(_,i)=>{const a=i*Math.PI/48;return point(-s/2+s*Math.cos(a),-s/2+s*Math.sin(a));})];
        plate(s,s,s,[],[0,0,0],[0,0,0],outline);
      } else box(s,s,s);
      const faces=kind==='THREE_WAY_RADIAL'?[]:kind==='TWO_WAY'?[[0,Math.PI,0],[0,-Math.PI/2,0]]:[[0,Math.PI,0],[0,-Math.PI/2,0],[Math.PI/2,0,0]];
      for(const rot of faces){
        const m=add(new THREE.CircleGeometry(s*.24,48),[0,0,0],rot,'#66686b');m.position.copy(new THREE.Vector3(0,0,s/2+.025).applyEuler(m.rotation));
      }
    } else if(kind==='UNIVERSAL_JOINT') {
      // 叉形座、横向销轴与顶部安装台，体现转动副而不是两片直板。
      for(const x of [-s*.42,s*.42])plate(s,s*1.35,t,[circle(0,0,s*.2)],[x,-s*.1,0],[0,Math.PI/2,0]);
      plate(s,s,t,[circle(0,0,r)],[0,-s*.72,0],[Math.PI/2,0,0]);
      add(new THREE.CylinderGeometry(s*.25,s*.25,s*1.12,48),[0,0,0],[0,0,Math.PI/2]);
      box(s*.6,s*.75,s*.6,[0,s*.38,0]);
      for(const x of [-s*.58,s*.58])plate(s*.65,s*.65,t,[circle(0,0,s*.13)],[x,0,0],[0,Math.PI/2,0],circle(0,0,s*.325));
      box(s*.8,s*.25,s*.85,[0,-s*.4,0]);
      plate(s*1.2,s*1.2,t,[-1,1].flatMap(x=>[-1,1].map(y=>circle(x*s*.35,y*s*.35,r))),[0,s*.78,0],[Math.PI/2,0,0]);
    } else if(kind==='HIDDEN_CORNER') {
      const layout=hiddenCornerLayout(d);
      if(!layout)throw new Error('隐藏角槽件缺少有效的槽内尺寸');
      const {neck,depth,recess,shoulder,bevel,radius,sourceLength,targetLength,sourceHole,targetHole,crossSection}=layout;
      const centerDepth=-(depth+recess)/2;
      // 有孔窄颈与两侧T脚分别挤出，避免把槽腔/螺孔填成两块宽平板。立腿沿 +Y，而不是向梁下翻。
      plate(neck,sourceLength,depth-recess,[circle(0,sourceHole-sourceLength/2,radius)],
        [0,centerDepth,sourceLength/2],[Math.PI/2,0,0],chamferedRectangle(neck,sourceLength,bevel));
      plate(neck,targetLength,depth-recess,[circle(0,targetHole-targetLength/2,radius)],
        [0,targetLength/2,centerDepth],[0,0,0],chamferedRectangle(neck,targetLength,bevel));
      const rightWing=[point(neck/2,-shoulder),...crossSection.slice(3,7).map(([x,y])=>point(x,y))];
      for(const sign of [-1,1]){
        const wing=rightWing.map(p=>point(p.x*sign,p.y));
        add(extrude(wing,[],sourceLength),[0,0,sourceLength/2]);
        add(extrude(wing,[],targetLength),[0,targetLength/2,0],[Math.PI/2,0,0]);
      }
      // 连接两条腿的窄颈转角完全位于目标槽，不跨过槽唇或伸到梁上。
      box(neck,depth,depth,[0,-depth/2,-depth/2]);
      // 紧定螺钉只属于设计组件展示，不另外生成Hardware/BOM或宿主加工；内六角是真凹口。
      const top=-recess-.2,socketDepth=1.15,totalDepth=depth-recess-.3,shaftDepth=totalDepth-socketDepth;
      const screwRadius=radius-.1,socket=circle(0,0,1.65,6);
      const sourceCap=plate(screwRadius*2,screwRadius*2,socketDepth,[socket],[0,top-socketDepth/2,sourceHole],[Math.PI/2,0,0],circle(0,0,screwRadius));
      const targetCap=plate(screwRadius*2,screwRadius*2,socketDepth,[socket],[0,targetHole,top-socketDepth/2],[0,0,0],circle(0,0,screwRadius));
      const screwMaterial=material.clone();screwMaterial.color.set('#72777e');screwMaterial.metalness=.8;screwMaterial.roughness=.34;
      const sourceShaft=add(new THREE.CylinderGeometry(screwRadius,screwRadius,shaftDepth,32),[0,top-socketDepth-shaftDepth/2,sourceHole]);
      const targetShaft=add(new THREE.CylinderGeometry(screwRadius,screwRadius,shaftDepth,32),[0,targetHole,top-socketDepth-shaftDepth/2],[Math.PI/2,0,0]);
      sourceCap.material=targetCap.material=sourceShaft.material=targetShaft.material=screwMaterial;
    } else if(['INNER_BRACKET','SLIDE_BLOCK'].includes(kind)) {
      if(kind==='INNER_BRACKET'){
        plate(s*.40,s*4,t,[-1.5,-.5,.5,1.5].map(y=>circle(0,y*s,s*.11)));
        for(const x of [-s*.18,s*.18])box(s*.06,s*4,t*.65,[x,0,t*.65]);
      }
      else {
        const slot=panelContours('obround',{radius:s*.18,straightA:0,straightB:s*1.3}).outer.map(p=>point(p.x,p.y-s*.24));
        plate(s*.65,s*3,s*.42,[slot,circle(0,s*1.08,s*.20)]);
        add(new THREE.CircleGeometry(s*.12,32),[-s*.325-.01,-s*1.1,0],[0,-Math.PI/2,0],'#151619');
      }
    } else if(kind==='A_PILLAR_BRACKET') {
      const len=d.length,side=d.side==='left'?-1:1;
      const x=-len/2,outline=[point(x,8),point(len/2,8),point(len/2,3),point(x+45,3)];
      for(let i=0;i<=24;i++){const angle=Math.PI/2+i*Math.PI/48;outline.push(point(x+45+22*Math.cos(angle),-19+22*Math.sin(angle)));}
      outline.push(point(x+15,-34),point(x,-34));
      const mirrored=outline.map(p=>point(p.x*side,p.y));
      plate(len,42,4,[circle((x+7)*side,0,3),circle((x+7)*side,-24,3)],[0,0,0],[0,0,0],mirrored);
      box(len,2,6,[0,7,0]);
    } else if(kind==='SHELF_BRACKET') {
      const depth=d.length,thin=Math.max(1,s*.05);
      plate(s,depth,thin,[],[0,thin/2,depth/2],[Math.PI/2,0,0]);
      box(s,s*.2,thin,[0,s*.1,0]);
      for(const x of [-s*.3,0,s*.3])box(s*.12,s*.15,thin,[x,-s*.075,depth-thin/2]);
    } else if(kind==='PANEL_FIX_CONNECTOR') {
      const outline=d.rounded?roundedRectangle(s,s*2,s*.45):rectangle(s,s*2);
      plate(s,s*2,t,[circle(0,s*.45,r)],[0,s,0],[0,0,0],outline);
      plate(s,s*2,t,[circle(0,s*.55,r)],[0,t/2,s],[Math.PI/2,0,0],outline);
      for(const mesh of boredBlock(s,s*.7,s*.7,[{axis:0,center:[0,0,0],radius:r}],material)){mesh.position.set(0,s*.35,s*.35);group.add(mesh);}
    } else {
      const ports=angleBracketLayout(d);
      const leg=kind==='SHELF_BRACKET'?d.length:s,w=ports?.width||(kind==='L_BRACKET'?s*.45:Math.max(s,Number(d.height||s))),depth=ports?.depth||(kind==='HEAVY_CORNER'?d.length:leg);
      const height=ports?.height||(kind==='HEAVY_CORNER'?depth:s);
      const holes=kind==='HEAVY_CORNER'?[circle(0,depth*.35,r)]:(ports?.sourcePorts||(d.holeCount>=3?[-w*.22,w*.22]:[0]).map(offset=>({point:[offset,0,depth/2]}))).map(port=>circle(port.point[0],port.point[2]-depth/2,r));
      plate(w,depth,t,holes,[0,t/2,depth/2],[Math.PI/2,0,0]);
      const uprightHoles=kind==='HEAVY_CORNER'?[circle(0,height*.35,r)]:(ports?.targetPorts||(d.holeCount===4?[-w*.22,w*.22]:[0]).map(offset=>({point:[offset,height/2,0]}))).map(port=>circle(port.point[0],port.point[1]-height/2,r));
      const angle=(d.angle||90)*Math.PI/180;plate(w,height,t,uprightHoles,[0,height*Math.sin(angle)/2,height*Math.cos(angle)/2],[Math.PI/2-angle,0,0]);
      if(kind==='HEAVY_CORNER'||kind==='CORNER_CUBE')for(const x of [-(w-t)/2,(w-t)/2])plate(s,s,t,[],[x,0,0],[0,Math.PI/2,0],[point(0,0),point(-depth+t,0),point(0,height-t)]);
    }
    if(!group.children.length)throw new Error(`未实现组件几何：${kind||d.panelShape}`);
    // 构件不参与地面距离淡出，适配远处的大模型仍保持清晰。
    group.traverse(x=>{if(x.isMesh)x.userData.profileRoot=group;for(const m of [].concat(x.material||[]))m.fog=false;});
    if(!group.children.some(x=>x.material===material))material.dispose();return group;
  }
}
const point=(x,y)=>({x,y});
function rectangle(w,h){return [point(-w/2,-h/2),point(w/2,-h/2),point(w/2,h/2),point(-w/2,h/2)];}
function chamferedRectangle(w,h,b){return [point(-w/2+b,-h/2),point(w/2-b,-h/2),point(w/2,-h/2+b),point(w/2,h/2-b),point(w/2-b,h/2),point(-w/2+b,h/2),point(-w/2,h/2-b),point(-w/2,-h/2+b)];}
function roundedRectangle(w,h,r){const points=[];for(const [cx,cy,start] of [[w/2-r,h/2-r,0],[-w/2+r,h/2-r,Math.PI/2],[-w/2+r,-h/2+r,Math.PI],[w/2-r,-h/2+r,Math.PI*1.5]])for(let i=0;i<=8;i++){const angle=start+i*Math.PI/16;points.push(point(cx+r*Math.cos(angle),cy+r*Math.sin(angle)));}return points;}
function circle(x,y,r,n=48){return Array.from({length:n},(_,i)=>point(x+Math.cos(i*Math.PI*2/n)*r,y+Math.sin(i*Math.PI*2/n)*r));}
function pointInside(outer,x,y){let inside=false;for(let i=0,j=outer.length-1;i<outer.length;j=i++){const a=outer[i],b=outer[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
function shapeFrom(outer,holes=[]) {const shape=new THREE.Shape(outer.map(p=>new THREE.Vector2(p.x,p.y)));for(const ring of holes)shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(p.x,p.y))));return shape;}
function extrude(outer,holes,depth){const geometry=new THREE.ExtrudeGeometry(shapeFrom(outer,holes),{depth,bevelEnabled:false,steps:1,curveSegments:24});geometry.translate(0,0,-depth/2);return geometry;}

/**
 * 实体块的正交通孔：外表面按孔轮廓三角化，孔壁在相交孔内部裁除。
 * 不用黑色圆片假装钻孔，也不引入运行期布尔库；尺寸为设计参考毫米，不生成宿主加工事实。
 */
function boredBlock(width,height,depth,bores,material) {
  const size=[width,height,depth],meshes=[];
  const bases=[[[0,0,-1],[0,1,0]],[[1,0,0],[0,0,-1]],[[1,0,0],[0,1,0]]];
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]) {
    const u=new THREE.Vector3(...bases[axis][0]).multiplyScalar(sign),v=new THREE.Vector3(...bases[axis][1]);
    const normal=new THREE.Vector3().crossVectors(u,v);
    const spanU=size.reduce((sum,n,i)=>sum+n*Math.abs(u.getComponent(i)),0),spanV=size.reduce((sum,n,i)=>sum+n*Math.abs(v.getComponent(i)),0);
    const holes=bores.filter(b=>b.axis===axis).map(b=>{
      const center=new THREE.Vector3(...b.center);return circle(center.dot(u),center.dot(v),b.radius);
    });
    const geometry=new THREE.ShapeGeometry(shapeFrom(rectangle(spanU,spanV),holes));
    const matrix=new THREE.Matrix4().makeBasis(u,v,normal).setPosition(normal.clone().multiplyScalar(size[axis]/2));
    geometry.applyMatrix4(matrix);meshes.push(new THREE.Mesh(geometry,material));
  }
  for(const bore of bores) {
    const direction=new THREE.Vector3().setComponent(bore.axis,1);
    const tube=new THREE.CylinderGeometry(bore.radius,bore.radius,size[bore.axis],48,24,true);
    tube.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction));
    tube.translate(...bore.center);
    const positions=tube.attributes.position,index=tube.index.array,kept=[],center=new THREE.Vector3();
    for(let i=0;i<index.length;i+=3) {
      center.set(0,0,0);
      for(let j=0;j<3;j++)center.add(new THREE.Vector3().fromBufferAttribute(positions,index[i+j]));
      center.multiplyScalar(1/3);
      // 孔交会处不应残留另一根圆筒的壁面，否则主孔看得见却仍会挡住光轴。
      const insideOther=bores.some(other=>{
        if(other===bore)return false;
        let radial=0;
        for(let k=0;k<3;k++)if(k!==other.axis)radial+=(center.getComponent(k)-other.center[k])**2;
        return radial<other.radius**2-1e-6;
      });
      if(!insideOther)kept.push(index[i],index[i+1],index[i+2]);
    }
    // 孔壁与外表面共用受光材质，亮面/背光面由法线决定；黑色背景只从真实孔口透出。
    tube.setIndex(kept);meshes.push(new THREE.Mesh(tube,material));
  }
  return meshes;
}
