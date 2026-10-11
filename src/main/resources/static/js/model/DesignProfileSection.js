/** 参数化设计截面：真实开口 T 槽、分格中心孔、R 弧面及 U 通道，生产仍需实际图档核对。 */
export function buildDesignProfileSection(profile,faceClosures=[],options={}) {
  if(profile.shape==='T_SLOT'&&(profile.sectionStyle==='DESIGN_REFERENCE'||options.integralReference))return buildIntegralReference(profile,faceClosures,options);
  const w=profile.width,h=profile.height,s=Number(profile.series),slot=profile.slotWidth;
  const closed=new Set([...(profile.defaultFaceClosures||[]),...faceClosures]);
  const p=(x,y)=>({x,y}),outer=[],holes=[],closedSlotHoles=[];
  if(profile.shape==='U_CHANNEL')return {outer:[p(-4,-4),p(4,-4),p(4,4),p(2.8,4),p(2.8,-2.8),p(-2.8,-2.8),p(-2.8,4),p(-4,4)],holes};
  // 每条边沿逆时针遍历；凹槽沿边的左法向进入材料。槽位数量沿用目录事实源。
  const addSide=(a,b,face)=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),tx=dx/len,ty=dy/len,nx=-ty,ny=tx;
    const pt=(u,v)=>p(a.x+tx*u+nx*v,a.y+ty*u+ny*v);
    outer.push(a);
    {
      const slots=(profile.sectionSlotDefinitions||profile.slotDefinitions||[]).filter(x=>x.face===face);
      const centers=slots.map(x=>len/2+(face==='FRONT'||face==='LEFT'?-x.offset:x.offset)).sort((a,b)=>a-b);
      for(const c of centers){
        const mouth=slot/2,cavity=Math.min(s*.28,slot*.85),lip=Math.max(.8,s*.055),depth=Math.min(s*.3,s/2-slot/2-1.2);
        if(closed.has(face)) {
          // 封边只补上外壁；深于唇口的槽腔转为贯通内孔，不填实整个截面。
          const chamber=[[c-cavity,lip],[c-cavity,depth-lip],[c-slot*.48,depth],[c+slot*.48,depth],[c+cavity,depth-lip],[c+cavity,lip]].map(([u,v])=>pt(u,v));
          holes.push(chamber);closedSlotHoles.push(chamber);
        } else for(const [u,v] of [[c-mouth,0],[c-mouth,lip],[c-cavity,lip],[c-cavity,depth-lip],[c-slot*.48,depth],[c+slot*.48,depth],[c+cavity,depth-lip],[c+cavity,lip],[c+mouth,lip],[c+mouth,0]])outer.push(pt(u,v));
      }
    }
  };
  addSide(p(-w/2,-h/2),p(w/2,-h/2),'BACK');
  if(profile.shape==='ROUND_CORNER'){
    for(let i=0;i<=48;i++){const a=i*Math.PI/96;outer.push(p(-w/2+w*Math.cos(a),-h/2+h*Math.sin(a)));}
    addSide(p(-w/2,h/2),p(-w/2,-h/2),'LEFT');
    // 圆角参考中心孔留在两槽之间的实体区，不能与开放槽或封边槽腔相交。
    holes.push(circle(0,0,s*.11));
  }else{
    addSide(p(w/2,-h/2),p(w/2,h/2),'RIGHT');addSide(p(w/2,h/2),p(-w/2,h/2),'FRONT');addSide(p(-w/2,h/2),p(-w/2,-h/2),'LEFT');
    const nx=Math.max(1,Math.round(w/s)),ny=Math.max(1,Math.round(h/s));
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++){
      const cx=(ix-(nx-1)/2)*s,cy=(iy-(ny-1)/2)*s;
      holes.push(circle(cx,cy,s*.105));
      // 对角空腔保持在中心圆孔和 T 槽之外，避免旧“几块矩形孔”遮掉槽壁。
      for(const sx of [-1,1])for(const sy of [-1,1]){
        const q=s*.5-s*.08,a=s*.31,b=s*.40;
        holes.push([p(cx+sx*a,cy+sy*q),p(cx+sx*q,cy+sy*q),p(cx+sx*q,cy+sy*a),p(cx+sx*b,cy+sy*b)]);
      }
    }
  }
  return {outer,holes,closedSlotHoles};
}
function circle(cx,cy,r){return Array.from({length:32},(_,i)=>({x:cx+Math.cos(i*Math.PI/16)*r,y:cy+Math.sin(i*Math.PI/16)*r}));}

/**
 * 一体挤出的设计参考截面：外围槽一次成环，长截面的筋间空腔独立生成，不能拼接方形外壁。
 * 20/30/40 的结构对照用户截图及已有系列图；其他系列按同类拓扑派生，不作为采购尺寸。
 * 真实 DXF/数据库截面在 Registry 中优先返回，不进入这个参考生成器。
 */
function buildIntegralReference(profile,faceClosures,options) {
  const w=Number(profile.width),h=Number(profile.height),s=Number(profile.series),slot=Number(profile.slotWidth);
  const nx=Math.max(1,Math.round(w/s)),ny=Math.max(1,Math.round(h/s)),stepX=w/nx,stepY=h/ny;
  const style=referenceStyle(s),closed=new Set([...(profile.defaultFaceClosures||[]),...faceClosures]);
  const slots=profile.sectionSlotDefinitions||profile.slotDefinitions||[];
  const outer=[],holes=[],closedSlotHoles=[],referenceBores=[];
  const parameters=depthSpan=>{
    const lip=style.skin,cavity=Math.min(s*.275,slot*1.03),root=slot*.48;
    const hub=style.bore+style.relief+lip*.65;
    const depth=Math.min(depthSpan*.31,depthSpan/2-hub);
    return {lip,cavity,root,depth,chamber:Math.max(lip+.3,depth-cavity+root)};
  };
  const xParameters=parameters(stepX),yParameters=parameters(stepY);
  const addSide=(a,b,face,parameters)=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),tx=dx/len,ty=dy/len;
    const pt=(u,v)=>({x:a.x+tx*u-ty*v,y:a.y+ty*u+tx*v});
    outer.push(a);
    const centers=slots.filter(item=>item.face===face).map(item=>len/2+(face==='FRONT'||face==='LEFT'?-Number(item.offset):Number(item.offset))).sort((a,b)=>a-b);
    const {lip,cavity,root,depth,chamber}=parameters;
    for(const c of centers) {
      if(closed.has(face)) {
        const ring=[[c-cavity,lip],[c-cavity,chamber],[c-root,depth],[c+root,depth],[c+cavity,chamber],[c+cavity,lip]].map(([u,v])=>pt(u,v));
        holes.push(ring);closedSlotHoles.push(ring);
      } else {
        for(const [u,v] of [[c-slot/2,0],[c-slot/2,lip],[c-cavity,lip],[c-cavity,chamber],[c-root,depth],[c+root,depth],[c+cavity,chamber],[c+cavity,lip],[c+slot/2,lip],[c+slot/2,0]])outer.push(pt(u,v));
      }
    }
  };
  addSide({x:-w/2,y:-h/2},{x:w/2,y:-h/2},'BACK',yParameters);
  addSide({x:w/2,y:-h/2},{x:w/2,y:h/2},'RIGHT',xParameters);
  addSide({x:w/2,y:h/2},{x:-w/2,y:h/2},'FRONT',yParameters);
  addSide({x:-w/2,y:h/2},{x:-w/2,y:-h/2},'LEFT',xParameters);
  const roundedOuter=roundOutsideCorners(outer,w,h,style.cornerRadius);
  // 只接受留在真实材料域内且不交叠的孔腔，不收缩或移位来伪造一个可装孔。
  const addCavity=ring=>{
    if(!containedCavity(ring,roundedOuter,holes))return false;
    holes.push(ring);return true;
  };
  const addBore=(cx,cy,radius,relief=0)=>{
    const ring=relievedBore(cx,cy,radius,relief);
    if(addCavity(ring))referenceBores.push({holeIndex:holes.length-1,offsetX:cx,offsetY:cy,radius});
  };
  for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)addBore((ix-(nx-1)/2)*stepX,(iy-(ny-1)/2)*stepY,style.bore,style.relief);
  if(style.cornerKind==='ROUND') {
    // 3060/3090等仍只有四个外围角孔，不在每个30mm分格重新造四角。
    for(const x of [-w/2+style.inset,w/2-style.inset])for(const y of [-h/2+style.inset,h/2-style.inset]) {
      if(options.omittedCorner==='LEFT_FRONT'&&x<0&&y>0)continue;
      addBore(x,y,style.cornerSize/2);
    }
  } else if(style.cornerKind==='RECT') {
    for(const x of [-w/2+style.inset,w/2-style.inset])for(const y of [-h/2+style.inset,h/2-style.inset])addCavity(roundedRectangle(x,y,style.cornerSize,style.cornerSize,.6));
    // 方腔系列的长边筋节点有独立小空腔；它们不是两根型材各自的外侧壁。
    for(let ix=1;ix<nx;ix++)for(const y of [-h/2+style.inset,h/2-style.inset])addCavity(roundedRectangle(-w/2+ix*stepX,y,style.cornerSize*1.5,style.cornerSize,.6));
    for(let iy=1;iy<ny;iy++)for(const x of [-w/2+style.inset,w/2-style.inset])addCavity(roundedRectangle(x,-h/2+iy*stepY,style.cornerSize,style.cornerSize*1.5,.6));
  }
  for(let ix=1;ix<nx;ix++)for(let iy=0;iy<ny;iy++) {
    const ring=webCavity(stepX,stepY,xParameters,style);
    addCavity(ring.map(p=>({x:p.x-w/2+ix*stepX,y:p.y+(iy-(ny-1)/2)*stepY})));
  }
  for(let iy=1;iy<ny;iy++)for(let ix=0;ix<nx;ix++) {
    const ring=webCavity(stepY,stepX,yParameters,style);
    addCavity(ring.map(p=>({x:-p.y+(ix-(nx-1)/2)*stepX,y:p.x-h/2+iy*stepY})));
  }
  return {outer:roundedOuter,holes,closedSlotHoles,referenceBores,integralReference:true};
}

function referenceStyle(series) {
  if(series===15)return {bore:1.3,relief:0,skin:.9,cornerKind:'NONE',cornerRadius:.6};
  if(series===20)return {bore:2.5,relief:0,skin:1.4,cornerKind:'NONE',cornerRadius:1.5};
  if(series===30)return {bore:3.4,relief:.6,skin:1.8,cornerKind:'ROUND',cornerSize:4.2,inset:3.5,cornerRadius:2};
  if(series===40)return {bore:3.4,relief:.6,skin:2,cornerKind:'RECT',cornerSize:6,inset:6,cornerRadius:1.5};
  const skin=series*.05,cornerSize=series*.16;
  return {bore:5.1,relief:.4,skin,cornerKind:'RECT',cornerSize,inset:skin+cornerSize/2,cornerRadius:Math.min(3,series*.04)};
}

/** 两个原孔之间的连续筋间空腔；长边壁只留一次，不保留单元间封板。 */
function webCavity(pitch,span,parameters,style) {
  const {lip,cavity,root}=parameters,hub=style.bore+style.relief+lip*.65;
  const tip=pitch/2-hub-lip;
  const outside=span/2-(style.cornerKind==='RECT'?style.inset+style.cornerSize/2+lip:lip);
  if(tip<=root||outside<=root)return [];
  const neck=Math.min(pitch/2-cavity-lip,tip-lip);
  const shelf=root+tip-neck;
  if(neck<=0)return [];
  if(outside<=shelf) {
    const top=Math.max(.1,tip-(outside-root));
    return [[-tip,-root],[-top,-outside],[top,-outside],[tip,-root],[tip,root],[top,outside],[-top,outside],[-tip,root]].map(([x,y])=>({x,y}));
  }
  return [[-tip,-root],[-neck,-shelf],[-neck,-outside],[neck,-outside],[neck,-shelf],[tip,-root],[tip,root],[neck,shelf],[neck,outside],[-neck,outside],[-neck,shelf],[-tip,root]].map(([x,y])=>({x,y}));
}

function relievedBore(cx,cy,radius,relief) {
  return Array.from({length:64},(_,i)=>{
    const angle=i*Math.PI/32,r=radius+relief*Math.pow((1-Math.cos(angle*4))/2,8);
    return {x:cx+Math.cos(angle)*r,y:cy+Math.sin(angle)*r};
  });
}

function roundedRectangle(cx,cy,width,height,radius) {
  const points=[],hw=width/2,hh=height/2,r=Math.min(radius,hw,hh);
  for(let corner=0;corner<4;corner++) {
    const x=cx+(corner===0||corner===3?hw-r:-hw+r),y=cy+(corner<2?hh-r:-hh+r);
    for(let i=0;i<=4;i++) {
      const angle=(corner+i/4)*Math.PI/2;
      points.push({x:x+r*Math.cos(angle),y:y+r*Math.sin(angle)});
    }
  }
  return points;
}

function roundOutsideCorners(ring,width,height,radius) {
  const result=[],r=Math.min(radius,width/8,height/8);
  for(let i=0;i<ring.length;i++) {
    const b=ring[i];
    if(Math.abs(Math.abs(b.x)-width/2)>1e-7||Math.abs(Math.abs(b.y)-height/2)>1e-7){result.push(b);continue;}
    const a=ring[(i+ring.length-1)%ring.length],c=ring[(i+1)%ring.length];
    const before=Math.hypot(a.x-b.x,a.y-b.y),after=Math.hypot(c.x-b.x,c.y-b.y),cut=Math.min(r,before*.4,after*.4);
    const start={x:b.x+(a.x-b.x)*cut/before,y:b.y+(a.y-b.y)*cut/before};
    const end={x:b.x+(c.x-b.x)*cut/after,y:b.y+(c.y-b.y)*cut/after};
    const center={x:start.x+end.x-b.x,y:start.y+end.y-b.y};
    const angle=Math.atan2(start.y-center.y,start.x-center.x);
    for(let k=0;k<=8;k++)result.push({x:center.x+cut*Math.cos(angle+k*Math.PI/16),y:center.y+cut*Math.sin(angle+k*Math.PI/16)});
  }
  return result;
}

function containedCavity(ring,outer,holes) {
  if(ring.length<3)return false;
  const inside=(p,list)=>{
    let value=false;
    for(let i=0,j=list.length-1;i<list.length;j=i++) {
      const a=list[j],b=list[i];
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)value=!value;
    }
    return value;
  };
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const onSegment=(p,a,b)=>Math.abs(cross(a,b,p))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7;
  const intersect=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<-1e-10&&cross(c,d,a)*cross(c,d,b)<-1e-10||onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b);
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(!inside(a,outer)||!inside(mid,outer))return false;
    for(let j=0;j<outer.length;j++)if(intersect(a,b,outer[j],outer[(j+1)%outer.length]))return false;
    for(const hole of holes) {
      if(inside(a,hole)||inside(mid,hole)||inside(hole[0],ring))return false;
      for(let j=0;j<hole.length;j++)if(intersect(a,b,hole[j],hole[(j+1)%hole.length]))return false;
    }
  }
  return true;
}
