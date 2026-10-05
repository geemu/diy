import MachiningUnitBuilder from '../machining/MachiningUnitBuilder.js';
import {getPathMetrics} from '../model/ProfilePath.js';
import {getSectionDefinition,getSectionBounds} from '../model/ProfileSectionRegistry.js';
import {isEndMachiningFeature} from '../machining/MachiningFeatureCatalog.js';
import {profileDisplayName,profileNominal} from '../model/DesignProfileCatalog.js';

export default class DrawingGenerator {
  constructor(editor){this.editor=editor;}

  buildMachiningDrawings(){
    let idx=1;
    return this.editor.bomExporter.groups(true).filter(g=>g.parts[0]?.profilePath?.type!=='ARC').map(g=>{
      const p=g.parts[0],s=p.dimensions.sectionSize,items=p.machiningItems||[],section=getSectionDefinition(p.designProfile?.profileId),views=[];
      for(const face of ['FRONT','BACK','LEFT','RIGHT']){
        const fis=items.filter(i=>i.face===face&&!isEndMachiningFeature(i));
        if(fis.length)views.push({face,faceName:{FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'}[face],height:(face==='FRONT'||face==='BACK')?s[0]:s[1],units:MachiningUnitBuilder.build(fis)});
      }
      const endViews=[];
      for(const end of ['START','END']){
        const e=items.filter(i=>isEndMachiningFeature(i)&&i.end===end);
        if(e.length)endViews.push({end,name:end==='START'?'A端':'B端',width:s[0],height:s[1],units:MachiningUnitBuilder.build(e)});
      }
      return {drawingId:`M-${String(idx++).padStart(3,'0')}`,profile:profileDisplayName(p),nominal:profileNominal(p),slotWidth:Number(p.designProfile?.slotWidth||0),material:p.manufacturingProfile?.name||'制造材料待配置',length:Number(p.dimensions.length),quantity:g.parts.length,partIds:g.parts.map(x=>x.displayId),views,endViews,section,endCuts:structuredClone(p.endCuts||{})};
    });
  }

  buildCutDrawings(){let idx=1,result=[];for(const g of this.editor.bomExporter.groups(false)){const p=g.parts[0];if(p.profilePath?.type==='ARC')continue;const cuts=p.endCuts||{},a=Number(cuts.START?.angleDeg||0),b=Number(cuts.END?.angleDeg||0);if(Math.abs(a)<.001&&Math.abs(b)<.001)continue;result.push({drawingId:`C-${String(idx++).padStart(3,'0')}`,profile:profileDisplayName(p),sectionSize:[...(p.dimensions.sectionSize||[30,30])],length:Number(p.dimensions.length),endCuts:structuredClone(p.endCuts),quantity:g.parts.length,partIds:g.parts.map(x=>x.displayId)});}return result;}

  exportCutSvg(d){const W=980,H=360,m=80,scale=Math.min(.9,780/Math.max(d.length,1)),L=d.length*scale,section=Math.max(30,Math.max(...d.sectionSize)*scale),y=155,half=section/2,a=d.endCuts?.START||{angleDeg:0,axis:'X'},b=d.endCuts?.END||{angleDeg:0,axis:'X'},startShift=Math.tan(Number(a.angleDeg||0)*Math.PI/180)*half,endShift=Math.tan(Number(b.angleDeg||0)*Math.PI/180)*half,x0=m,x1=m+L,poly=[[x0-startShift,y-half],[x1-endShift,y-half],[x1+endShift,y+half],[x0+startShift,y+half]].map(p=>p.join(',')).join(' ');return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="white"/><text x="40" y="40" font-size="22" font-weight="bold">${d.drawingId} - ${this.xml(d.profile)} 端部斜切图</text><text x="40" y="68" font-size="13">L=${d.length}mm · 截面 ${d.sectionSize[0]}×${d.sectionSize[1]} · 数量 ${d.quantity}</text><polygon points="${poly}" fill="none" stroke="black" stroke-width="1.5"/><line x1="${x0}" y1="${y-half-35}" x2="${x1}" y2="${y-half-35}" stroke="black"/><text x="${(x0+x1)/2}" y="${y-half-42}" text-anchor="middle" font-size="12">${d.length}</text><text x="${x0-5}" y="${y+half+42}" font-size="12">A端 ${this.cutLabel(a)}</text><text x="${x1-145}" y="${y+half+42}" font-size="12">B端 ${this.cutLabel(b)}</text><text x="40" y="330" font-size="12">构件：${this.xml(d.partIds.join(' / '))}</text></svg>`;}
  cutLabel(cut){return `${Number(cut?.angleDeg||0)}° / ${cut?.axis==='Y'?'Y':'X'}`;}

  buildBendDrawings(){let idx=1,map=new Map();for(const part of this.editor.parts.filter(item=>item.type==='PROFILE'&&item.profilePath?.type==='ARC')){const key=this.editor.bomExporter.sig(part,true);if(!map.has(key))map.set(key,{parts:[]});map.get(key).parts.push(part);}const result=[];for(const group of map.values()){const p=group.parts[0],m=getPathMetrics(p),sec=p.dimensions.sectionSize;result.push({drawingId:`B-${String(idx++).padStart(3,'0')}`,profile:profileDisplayName(p),nominal:profileNominal(p),slotWidth:Number(p.designProfile?.slotWidth||0),material:p.manufacturingProfile?.name||'制造材料待配置',sectionSize:[...sec],radius:m.radius,angleDeg:m.angleDeg,plane:m.plane,developedLength:m.developedLength,chord:m.chord,sagitta:m.sagitta,innerRadius:m.innerRadius,outerRadius:m.outerRadius,quantity:group.parts.length,partIds:group.parts.map(x=>x.displayId),machiningItems:structuredClone(p.machiningItems||[])});}return result;}

  exportBendSvg(d){const W=980,H=760,cx=260,cy=300,scale=Math.min(.42,245/(d.radius+d.sectionSize[0])),r=d.radius*scale,a=d.angleDeg*Math.PI/180,start=-a/2,end=a/2,p=(t,R=r)=>[cx+R*(1-Math.cos(t)),cy+R*Math.sin(t)],p1=p(start),p2=p(end),path=`M ${p1[0]} ${p1[1]} A ${r} ${r} 0 ${d.angleDeg>180?1:0} 1 ${p2[0]} ${p2[1]}`,items=(d.machiningItems||[]).filter(i=>!isEndMachiningFeature(i)),x0=55,y0=610,usable=840,devScale=usable/Math.max(1,d.developedLength),marks=items.map((item,index)=>{const x=x0+Number(item.stationS??item.distanceFromStart??0)*devScale,stage=item.processStage==='BEND_AFTER'?'弯后':'弯前';return `<line x1="${x}" y1="${y0-18}" x2="${x}" y2="${y0+18}" stroke="${item.processStage==='BEND_AFTER'?'#15967d':'#c0392b'}" stroke-width="2"/><text x="${x+4}" y="${y0-24-(index%3)*14}" font-size="10">S=${this.n(item.stationS??item.distanceFromStart)} ${this.xml(item.face||'')} ${this.xml(item.type)} ${stage}</text>`;}).join('');return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="white"/><text x="40" y="45" font-size="24" font-weight="bold">${d.drawingId} - ${this.xml(d.profile)} 弯曲/加工图</text><text x="40" y="78" font-size="14">截面 ${d.sectionSize[0]}×${d.sectionSize[1]} · 槽宽 ${d.slotWidth} · 制造材料 ${this.xml(d.material||'待配置')} · 数量 ${d.quantity}</text><path d="${path}" fill="none" stroke="black" stroke-width="4"/><text x="560" y="150" font-size="15">中心线半径 R = ${this.n(d.radius)} mm</text><text x="560" y="180" font-size="15">圆心角 = ${this.n(d.angleDeg)}°</text><text x="560" y="210" font-size="15">弯曲平面 = ${d.plane}</text><text x="560" y="240" font-size="15">展开长度 = ${this.n(d.developedLength)} mm</text><text x="55" y="560" font-size="14" font-weight="700">展开加工基准（S 从 A 端沿中心线累计）</text><line x1="${x0}" y1="${y0}" x2="${x0+usable}" y2="${y0}" stroke="black" stroke-width="2"/>${marks}<text x="40" y="725" font-size="12">构件：${this.xml(d.partIds.join(' / '))}</text></svg>`;}

  exportSvg(d){
    const m=55,scale=d.length>1000?900/d.length:.8,L=d.length*scale;let y=110,els=[];
    els.push(`<text x="${m}" y="34" font-size="22" font-weight="bold">${d.drawingId} - ${this.xml(d.profile)} L=${d.length}mm 数量=${d.quantity}</text>`);
    els.push(`<text x="${m}" y="62" font-size="13">槽宽：${d.slotWidth}mm　制造材料：${this.xml(d.material||'待配置')}　A端:${this.cutLabel(d.endCuts?.START)}　B端:${this.cutLabel(d.endCuts?.END)}</text>`);
    for(const v of d.views){
      const vh=Math.max(v.height*scale,30);els.push(`<text x="${m}" y="${y-12}" font-size="16" font-weight="bold">${v.faceName}</text><rect x="${m}" y="${y}" width="${L}" height="${vh}" fill="none" stroke="black" stroke-width="1.5"/><line x1="${m}" y1="${y+vh/2}" x2="${m+L}" y2="${y+vh/2}" stroke="#888" stroke-dasharray="5,5"/>`);
      let lane=0;
      for(const u of v.units){
        const x=m+u.distanceFromStart*scale,cy=y+vh/2-u.offset*scale;
        if(u.type==='HOLE_UNIT'){
          const ds=[u.primary,...u.secondary].map(i=>Number(i.type==='COUNTERSINK'?(i.majorDiameter??i.diameter??0):(i.diameter||0))).filter(Boolean).sort((a,b)=>b-a);for(const dia of ds)els.push(`<circle cx="${x}" cy="${cy}" r="${Math.max(3,dia*scale/2)}" fill="none" stroke="black"/>`);els.push(`<line x1="${x-9}" y1="${cy}" x2="${x+9}" y2="${cy}" stroke="#777"/><line x1="${x}" y1="${cy-9}" x2="${x}" y2="${cy+9}" stroke="#777"/>`);
        } else if(u.type==='SLOT_UNIT') els.push(this.slotSvg(x,cy,u.length*scale,u.width*scale,u.orientation));
        else if(u.type==='MILLING_UNIT') els.push(this.millSvg(x,cy,u.length*scale,u.width*scale,u.orientation));
        const label=MachiningUnitBuilder.label(u),ly=cy-12-(lane%3)*15;els.push(`<text x="${x+10}" y="${ly}" font-size="12">${this.xml(label)}</text>`);const dy=y+vh+30+(lane%2)*22;els.push(`<line x1="${m}" y1="${dy}" x2="${x}" y2="${dy}" stroke="black"/><text x="${(m+x)/2}" y="${dy-4}" font-size="11" text-anchor="middle">${this.n(u.distanceFromStart)}</text>`);lane++;
      }
      const ty=y+vh+78;els.push(`<line x1="${m}" y1="${ty}" x2="${m+L}" y2="${ty}" stroke="black"/><text x="${m+L/2}" y="${ty-5}" font-size="12" text-anchor="middle">${d.length}</text>`);y+=vh+125;
    }
    for(const ev of d.endViews){const sectionBounds=d.section?getSectionBounds(d.section):null,sw=sectionBounds?.width||ev.width,sh=sectionBounds?.height||ev.height,w=Math.max(45,sw*scale),h=Math.max(45,sh*scale),cx=m+w/2,cy=y+h/2;els.push(`<text x="${m}" y="${y-12}" font-size="16" font-weight="bold">${ev.name}端面</text>`);if(d.section)els.push(`<path d="${this.sectionPath(d.section,cx,cy,scale)}" fill="none" stroke="black" stroke-width="1.5" fill-rule="evenodd"/>`);else els.push(`<rect x="${m}" y="${y}" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="1.5"/>`);for(const u of ev.units){const px=cx+Number(u.offsetX||0)*scale,py=cy-Number(u.offsetY||0)*scale;els.push(`<circle cx="${px}" cy="${py}" r="6" fill="none" stroke="black"/><text x="${px+12}" y="${py+4}" font-size="12">${this.xml(MachiningUnitBuilder.label(u))}</text>`);}y+=h+80;}
    const W=L+m*2,H=y+30;return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="white"/>${els.join('')}</svg>`;
  }

  slotSvg(cx,cy,length,width,orientation){const l=orientation==='CROSS_PROFILE'?width:length,w=orientation==='CROSS_PROFILE'?length:width,r=Math.max(2,w/2),straight=Math.max(0,l-w),x=cx-l/2,y=cy-w/2;return `<rect x="${x}" y="${y}" width="${l}" height="${w}" rx="${r}" ry="${r}" fill="none" stroke="black"/>`;}
  millSvg(cx,cy,length,width,orientation){const l=orientation==='CROSS_PROFILE'?width:length,w=orientation==='CROSS_PROFILE'?length:width;return `<rect x="${cx-l/2}" y="${cy-w/2}" width="${l}" height="${w}" fill="none" stroke="#333" stroke-dasharray="4,3"/>`;}
  sectionPath(section,cx,cy,scale){const ringPath=ring=>ring.map((p,i)=>`${i?'L':'M'} ${this.n(cx+p.x*scale)} ${this.n(cy-p.y*scale)}`).join(' ')+' Z';return [ringPath(section.outer),...(section.holes||[]).map(ringPath)].join(' ');}
  xml(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
  n(v){return Number(Number(v).toFixed(2));}
}
