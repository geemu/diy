import * as THREE from 'three';
import {panelContours} from '../model/PanelShapeModel.js';

/** 通用参数化组件几何，预览与实际构件共用。通孔使用带孔轮廓挤出，不依赖远程图片和模型。 */
export default class ComponentGeometryFactory {
  static create(part) {
    const group=new THREE.Group(),d=part.dimensions||{},kind=d.geometryKind;
    group.userData.part=part;
    const material=new THREE.MeshStandardMaterial({color:part.color||'#a8aaad',metalness:.35,roughness:.48,side:THREE.DoubleSide});
    const add=(geometry,pos=[0,0,0],rot=[0,0,0],color=null)=>{
      const m=color?material.clone():material;if(color)m.color.set(color);
      const mesh=new THREE.Mesh(geometry,m);mesh.position.set(...pos);mesh.rotation.set(...rot);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
    };
    const box=(w,h,t,pos=[0,0,0],color=null)=>add(new THREE.BoxGeometry(w,h,t),pos,[0,0,0],color);
    const cyl=(r,h,pos=[0,0,0],color=null)=>add(new THREE.CylinderGeometry(r,r,h,48),pos,[0,0,0],color);
    const plate=(w,h,t,holes=[],pos=[0,0,0],rot=[0,0,0],outline=null)=>add(extrude(outline||rectangle(w,h),holes,t),pos,rot);
    const s=Number(d.size||20),t=Number(d.thickness||Math.max(2,s*.12)),r=s*.12;
    if(part.type==='PANEL') {
      const shape=d.panelShape||'rectangle',p=d.shapeParameters||d;
      if(shape==='sphere')add(new THREE.SphereGeometry(p.radius,p.segments,p.segments));
      else if(shape==='cylinder'||shape==='cone')add(new THREE.CylinderGeometry(shape==='cone'?0:p.topRadius,p.bottomRadius,p.height,p.segments));
      else if(shape==='torus')add(new THREE.TorusGeometry(p.radius,p.tubeRadius,p.radialSegments,p.tubularSegments));
      else {const c=panelContours(shape,p);add(extrude(c.outer,c.holes,d.thickness));}
    } else if(kind?.startsWith('SHAFT_')) {
      const type=kind.slice(6),a=d.diameter,b=d.secondDiameter||a,h=a*5,w=a*3;
      if(type==='LIMIT_RING'){
        add(extrude(circle(0,0,w*.32),[circle(0,0,a/2)],d.thickness));cyl(a*.25,a*.55,[w*.30,0,0],'#38393b');
      }else if(type==='VERTICAL_SK'){
        plate(w*1.6,a*1.3,a*.65,[circle(-w*.52,0,a*.2),circle(w*.52,0,a*.2)],[0,-h*.4,0],[Math.PI/2,0,0]);
        plate(w,h*.85,a*1.3,[circle(0,-a*.25,a/2),circle(w*.23,h*.22,a*.22)]);box(a*.10,h*.3,a*1.32,[0,h*.3,0],'#38393b');
      }else if(type==='HORIZONTAL_SHF'){
        const outline=[point(-w*.7,-w*.5),point(w*.7,-w*.5),point(w*.5,w*.35),point(0,w*.65),point(-w*.5,w*.35)];
        plate(w,w,a,[circle(0,0,a/2),circle(-w*.48,-w*.27,a*.2),circle(w*.48,-w*.27,a*.2)],[0,0,0],[0,0,0],outline);box(a*.08,w*.55,a*1.01,[0,w*.42,0],'#37383a');
      }else{
        const parallel=type.startsWith('PARALLEL'),spacing=d.spacing||a*2,hh=parallel?spacing+a*1.6:h;
        const bores=parallel?[circle(0,-spacing/2,a/2),circle(0,spacing/2,b/2)]:[circle(0,-h*.24,a/2),circle(-w*.28,h*.35,a*.18),circle(w*.28,-h*.37,a*.18)];
        plate(w,hh,a*2,bores);
        if(!parallel){
          // 第二轴钻孔入口示意；宿主轴的加工语义不由这个组件网格生成。
          add(new THREE.CircleGeometry(b/2,48),[w/2+.015,h*.20,0],[0,Math.PI/2,0],'#0c0d0f');
          add(new THREE.CircleGeometry(a*.2,24),[-w/2-.015,-h*.35,0],[0,-Math.PI/2,0],'#151619');
        }
        if(type==='L_FIX')box(w,a*.8,a*2,[w*.7,-h*.4,0]);
        if(type==='T_FIX')plate(w*1.8,a,a*.8,[circle(-w*.6,0,a*.16),circle(w*.6,0,a*.16)],[0,-h*.42,0]);
      }
    } else if(kind?.startsWith('SCREW_')) {
      const diameter=d.diameter,length=d.length,head=d.headDiameter,type=kind.slice(6),hh=diameter*(type==='PAN_HEAD'?.55:type==='FLAT_COUNTERSUNK'?.55:1);
      cyl(diameter/2,length,[0,-length/2,0]);
      for(let y=-Math.max(.7,diameter*.18);y>-length;y-=Math.max(.7,diameter*.18))add(new THREE.TorusGeometry(diameter/2,.08*diameter,4,24),[0,y,0],[Math.PI/2,0,0]);
      if(type==='FLAT_COUNTERSUNK')add(new THREE.CylinderGeometry(head/2,diameter/2,hh,48),[0,hh/2,0]);else cyl(head/2,hh,[0,hh/2,0]);
      add(new THREE.ShapeGeometry(shapeFrom(circle(0,0,diameter*.3,6))),[0,hh+.01,0],[-Math.PI/2,0,0],'#0c0d0f');
      if(type==='KNURLED_THUMB')for(let i=0;i<36;i++){const a=i*Math.PI/18;cyl(diameter*.035,hh,[Math.cos(a)*head/2,hh/2,Math.sin(a)*head/2],'#66696d');}
    } else if(kind==='SLIDE_RAIL') {
      // 三层槽型轨道、安装孔与翻边，长度减阶与实际放置模型保持一致。
      for(let i=0;i<3;i++){
        const h=d.height-i*10,l=d.length-i*12,x=(i-1)*4;
        plate(l,h,1.2,[circle(-l*.36,0,3.2),circle(0,0,3.2),circle(l*.36,0,3.2)],[x,0,0],[0,Math.PI/2,0]);
        box(4,1.5,l,[x+2,h/2,0]);box(4,1.5,l,[x+2,-h/2,0]);
      }
    } else if(kind==='END_CAP') {
      plate(d.width,d.height,t,d.capMaterial==='PLASTIC'?[]:[circle(0,0,Math.min(d.width,d.height)*.12)]);
      if(d.capMaterial==='PLASTIC')for(const x of [-1,1])for(const y of [-1,1])box(d.width*.16,d.height*.16,4,[x*d.width*.30,y*d.height*.30,-t/2-2]);
    } else if(kind==='FOOT_CUP') {
      const base=d.footDiameter,stem=d.stemDiameter,len=d.stemLength;
      cyl(base/2,8,[0,-len/2-4,0],'#272a2e');cyl(base*.37,4,[0,-len/2,0]);cyl(stem/2,len);
      add(new THREE.CylinderGeometry(stem,stem,stem*.65,6),[0,-len/2+stem,0]);
    } else if(kind==='ELASTIC_NUT') {
      plate(s*.60,s*.35,s*.22,[circle(0,0,d.diameter/2)]);cyl(s*.08,s*.15,[0,0,-s*.22]);
      add(new THREE.TorusGeometry(s*.23,s*.015,6,32),[0,-s*.02,-s*.16],[Math.PI/2,0,0]);
    } else if(['FLAT_PLATE','T_PLATE','L_PLATE','CROSS_PLATE'].includes(kind)) {
      const arm=s*.7,span=s*3,a=arm/2,b=span/2;let outline=rectangle(arm,span),holes=[circle(0,-s,r),circle(0,0,r),circle(0,s,r)];
      if(kind==='FLAT_PLATE'&&d.holeCount===2){outline=rectangle(arm,s*2);holes=[circle(0,-s/2,r),circle(0,s/2,r)];}
      if(kind==='T_PLATE'){outline=[point(-b,b),point(b,b),point(b,b-arm),point(a,b-arm),point(a,-b),point(-a,-b),point(-a,b-arm),point(-b,b-arm)];holes=[circle(-s,s,r),circle(0,s,r),circle(s,s,r),circle(0,0,r),circle(0,-s,r)];}
      if(kind==='L_PLATE'){outline=[point(-b,-b),point(b,-b),point(b,-b+arm),point(-b+arm,-b+arm),point(-b+arm,b),point(-b,b)];holes=[circle(-s,-s,r),circle(0,-s,r),circle(s,-s,r),circle(-s,0,r),circle(-s,s,r)];}
      if(kind==='CROSS_PLATE'){outline=[point(-a,-b),point(a,-b),point(a,-a),point(b,-a),point(b,a),point(a,a),point(a,b),point(-a,b),point(-a,a),point(-b,a),point(-b,-a),point(-a,-a)];holes=[circle(0,0,r),circle(-s,0,r),circle(s,0,r),circle(0,-s,r),circle(0,s,r)];}
      plate(span,span,t,holes,[0,0,0],[0,0,(d.angle-90)*Math.PI/180],outline);
    } else if(['CORNER_CUBE','THREE_WAY','TWO_WAY','THREE_D_CONNECTOR','THREE_WAY_RADIAL'].includes(kind)) {
      box(s,s,s);
      for(const rot of [[0,0,0],[0,Math.PI/2,0],[-Math.PI/2,0,0]]){
        const m=add(new THREE.CircleGeometry(s*.24,48),[0,0,0],rot,'#66686b');m.position.copy(new THREE.Vector3(0,0,s/2+.025).applyEuler(m.rotation));
      }
      if(kind==='THREE_WAY_RADIAL')add(new THREE.CylinderGeometry(s*.5,s*.5,s,32,1,false,0,Math.PI/2),[0,0,0],[Math.PI/2,0,0]);
    } else if(kind==='UNIVERSAL_JOINT') {
      plate(s,s*1.3,t,[circle(0,s*.2,r)],[0,s*.65,0]);plate(s,s*1.3,t,[circle(0,-s*.2,r)],[0,-s*.65,t*2],[0,Math.PI/10,0]);
      add(new THREE.CylinderGeometry(s*.28,s*.28,s*1.2,32),[0,0,t],[0,0,Math.PI/2]);
    } else if(['INNER_BRACKET','SLIDE_BLOCK'].includes(kind)) {
      plate(s*.35,s*2,t,[circle(0,-s*.5,r),circle(0,s*.5,r)]);if(kind==='SLIDE_BLOCK')box(s*.24,s*1.5,t*1.6);
    } else if(kind==='A_PILLAR_BRACKET') {
      const len=d.length,side=d.side==='left'?-1:1;
      plate(len,30,3,[circle(-len*.4,0,3.5),circle(len*.35,0,3.5)],[len*.45,0,side*8],[Math.PI/2,0,0]);plate(15,60,4,[circle(0,-20,3),circle(0,20,3)],[0,12,0]);
      plate(len,42,3,[],[0,-1,0],[0,0,0],[point(0,0),point(len*.8,0),point(0,-42)]);
    } else {
      const leg=kind==='SHELF_BRACKET'?d.length:s,w=kind==='L_BRACKET'?s*.45:s,depth=kind==='HEAVY_CORNER'?d.length:leg;
      const holes=d.holeCount===4?[circle(-w*.22,0,r),circle(w*.22,0,r)]:[circle(0,0,r)];
      plate(w,depth,t,holes,[0,t/2,depth/2],[Math.PI/2,0,0]);
      const angle=(d.angle||90)*Math.PI/180;plate(w,s,t,[circle(0,0,r)],[0,s*Math.sin(angle)/2,s*Math.cos(angle)/2],[Math.PI/2-angle,0,0]);
      if(kind==='HEAVY_CORNER')for(const x of [-w*.4,w*.4])plate(s,s,t,[],[x,0,0],[0,Math.PI/2,0],[point(0,0),point(s*.8,0),point(0,s*.8)]);
      if(kind==='PANEL_FIX_CONNECTOR'&&d.rounded)add(new THREE.CylinderGeometry(w/2,w/2,t,32),[0,s/2,0],[Math.PI/2,0,0]);
    }
    if(!group.children.length)throw new Error(`未实现组件几何：${kind||d.panelShape}`);
    group.traverse(x=>{if(x.isMesh)x.userData.profileRoot=group;});
    if(!group.children.some(x=>x.material===material))material.dispose();return group;
  }
}
const point=(x,y)=>({x,y});
function rectangle(w,h){return [point(-w/2,-h/2),point(w/2,-h/2),point(w/2,h/2),point(-w/2,h/2)];}
function circle(x,y,r,n=48){return Array.from({length:n},(_,i)=>point(x+Math.cos(i*Math.PI*2/n)*r,y+Math.sin(i*Math.PI*2/n)*r));}
function shapeFrom(outer,holes=[]) {const shape=new THREE.Shape(outer.map(p=>new THREE.Vector2(p.x,p.y)));for(const ring of holes)shape.holes.push(new THREE.Path(ring.map(p=>new THREE.Vector2(p.x,p.y))));return shape;}
function extrude(outer,holes,depth){const geometry=new THREE.ExtrudeGeometry(shapeFrom(outer,holes),{depth,bevelEnabled:false,steps:1,curveSegments:24});geometry.translate(0,0,-depth/2);return geometry;}
