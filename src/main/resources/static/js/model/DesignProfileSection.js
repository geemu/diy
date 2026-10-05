/** 参数化设计截面：真实开口 T 槽、分格中心孔、R 弧面及 U 通道，生产仍需实际图档核对。 */
export function buildDesignProfileSection(profile,faceClosures=[]) {
  const w=profile.width,h=profile.height,s=Number(profile.series),slot=profile.slotWidth;
  const closed=new Set([...(profile.defaultFaceClosures||[]),...faceClosures]);
  const p=(x,y)=>({x,y}),outer=[],holes=[];
  if(profile.shape==='U_CHANNEL')return {outer:[p(-4,-4),p(4,-4),p(4,4),p(2.8,4),p(2.8,-2.8),p(-2.8,-2.8),p(-2.8,4),p(-4,4)],holes};
  // 每条边沿逆时针遍历；凹槽沿边的左法向进入材料。槽位数量沿用目录事实源。
  const addSide=(a,b,face)=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),tx=dx/len,ty=dy/len,nx=-ty,ny=tx;
    const pt=(u,v)=>p(a.x+tx*u+nx*v,a.y+ty*u+ny*v);
    outer.push(a);
    if(!closed.has(face)){
      const slots=(profile.slotDefinitions||[]).filter(x=>x.face===face);
      const centers=slots.map(x=>len/2+(face==='FRONT'||face==='LEFT'?-x.offset:x.offset)).sort((a,b)=>a-b);
      for(const c of centers){
        const mouth=slot/2,cavity=Math.min(s*.28,slot*.85),lip=Math.max(.8,s*.055),depth=Math.min(s*.3,s/2-slot/2-1.2);
        for(const [u,v] of [[c-mouth,0],[c-mouth,lip],[c-cavity,lip],[c-cavity,depth-lip],[c-slot*.48,depth],[c+slot*.48,depth],[c+cavity,depth-lip],[c+cavity,lip],[c+mouth,lip],[c+mouth,0]])outer.push(pt(u,v));
      }
    }
  };
  addSide(p(-w/2,-h/2),p(w/2,-h/2),'BACK');
  if(profile.shape==='ROUND_CORNER'){
    for(let i=0;i<=48;i++){const a=i*Math.PI/96;outer.push(p(-w/2+w*Math.cos(a),-h/2+h*Math.sin(a)));}
    addSide(p(-w/2,h/2),p(-w/2,-h/2),'LEFT');
    holes.push(circle(-w*.2,-h*.2,s*.11));
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
  return {outer,holes};
}
function circle(cx,cy,r){return Array.from({length:32},(_,i)=>({x:cx+Math.cos(i*Math.PI/16)*r,y:cy+Math.sin(i*Math.PI/16)*r}));}
