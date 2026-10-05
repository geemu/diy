export default class DxfExporter {
  constructor(){this.e=[];}
  line(x1,y1,x2,y2,l='PROFILE'){this.e.push(`0\nLINE\n8\n${l}\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n`);}
  arc(x,y,r,startDeg,endDeg,l='BEND'){this.e.push(`0\nARC\n8\n${l}\n10\n${x}\n20\n${y}\n30\n0\n40\n${r}\n50\n${startDeg}\n51\n${endDeg}\n`);}
  circle(x,y,r,l='HOLE'){this.e.push(`0\nCIRCLE\n8\n${l}\n10\n${x}\n20\n${y}\n30\n0\n40\n${r}\n`);}
  text(x,y,h,t,l='TEXT'){const value=this.asciiText(t);this.e.push(`0\nTEXT\n8\n${l}\n10\n${x}\n20\n${y}\n30\n0\n40\n${h}\n1\n${value}\n`);}
  asciiText(value){const cleaned=String(value??'').replaceAll('\n',' ').replace(/[^\x20-\x7E]/g,'').trim();return cleaned||'TEXT';}
  rect(x,y,w,h,l='PROFILE'){this.line(x,y,x+w,y,l);this.line(x+w,y,x+w,y+h,l);this.line(x+w,y+h,x,y+h,l);this.line(x,y+h,x,y,l);}
  polyline(points,cx=0,cy=0,l='SECTION'){if(!points?.length)return;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];this.line(cx+Number(a.x),cy+Number(a.y),cx+Number(b.x),cy+Number(b.y),l);}}
  section(section,cx,cy){if(!section?.outer?.length)return false;this.polyline(section.outer,cx,cy,'SECTION_OUTER');for(const ring of section.holes||[])this.polyline(ring,cx,cy,'SECTION_INNER');return true;}
  slot(cx,cy,length,width,orientation='ALONG_PROFILE',layer='SLOT'){
    let l=Math.max(Number(length||0),Number(width||0)),w=Math.min(Number(length||0),Number(width||0));
    if(!(l>0&&w>0))return;
    const r=w/2,straight=Math.max(0,l-w);
    if(orientation==='CROSS_PROFILE'){
      this.line(cx-r,cy-straight/2,cx-r,cy+straight/2,layer);this.line(cx+r,cy-straight/2,cx+r,cy+straight/2,layer);
      this.arc(cx,cy+straight/2,r,0,180,layer);this.arc(cx,cy-straight/2,r,180,360,layer);
    }else{
      this.line(cx-straight/2,cy-r,cx+straight/2,cy-r,layer);this.line(cx-straight/2,cy+r,cx+straight/2,cy+r,layer);
      this.arc(cx+straight/2,cy,r,-90,90,layer);this.arc(cx-straight/2,cy,r,90,270,layer);
    }
  }
  milling(cx,cy,length,width,orientation='ALONG_PROFILE',layer='MILLING'){
    const l=orientation==='CROSS_PROFILE'?Number(width||0):Number(length||0),w=orientation==='CROSS_PROFILE'?Number(length||0):Number(width||0);
    this.rect(cx-l/2,cy-w/2,l,w,layer);
  }
  header(){return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`;}
  footer(){return `0\nENDSEC\n0\nEOF\n`;}

  buildCutDrawing(d){this.e=[];const h=Math.max(30,Math.max(...d.sectionSize)),half=h/2,a=d.endCuts?.START||{angleDeg:0,axis:'X'},b=d.endCuts?.END||{angleDeg:0,axis:'X'},startShift=Math.tan(Number(a.angleDeg||0)*Math.PI/180)*half,endShift=Math.tan(Number(b.angleDeg||0)*Math.PI/180)*half,y=0;this.text(0,h+35,6,`${d.drawingId} ${d.profile} L=${d.length} QTY=${d.quantity}`);this.line(-startShift,y-half,d.length-endShift,y-half,'PROFILE');this.line(d.length-endShift,y-half,d.length+endShift,y+half,'PROFILE');this.line(d.length+endShift,y+half,startShift,y+half,'PROFILE');this.line(startShift,y+half,-startShift,y-half,'PROFILE');this.text(0,-h/2-22,4,`A CUT ${Number(a.angleDeg||0)}DEG ${a.axis==='Y'?'Y':'X'}`,'DIMENSION');this.text(Math.max(0,d.length-130),-h/2-22,4,`B CUT ${Number(b.angleDeg||0)}DEG ${b.axis==='Y'?'Y':'X'}`,'DIMENSION');this.line(0,-h/2-40,d.length,-h/2-40,'DIMENSION');this.text(d.length/2-12,-h/2-35,4,d.length,'DIMENSION');return this.header()+this.e.join('')+this.footer();}

  buildBendDrawing(d){this.e=[];this.text(0,d.radius+80,8,`${d.drawingId} ${d.profile} R=${d.radius} ANGLE=${d.angleDeg} PLANE=${d.plane} QTY=${d.quantity}`);const half=d.angleDeg/2;this.arc(d.radius,0,d.radius,180-half,180+half,'BEND');this.text(d.radius*2+40,40,5,`DEVELOPED ${Number(d.developedLength.toFixed(2))} mm`);this.text(d.radius*2+40,25,5,`CHORD ${Number(d.chord.toFixed(2))} mm`);this.text(d.radius*2+40,10,5,`SECTION ${d.sectionSize[0]}x${d.sectionSize[1]} T=${d.wallThickness}`);const y=-Math.max(120,d.radius*.35);this.line(0,y,d.developedLength,y,'DEVELOPED');this.text(0,y-14,4,'A S=0','DIMENSION');this.text(Math.max(0,d.developedLength-80),y-14,4,`B S=${Number(d.developedLength.toFixed(2))}`,'DIMENSION');for(const item of d.machiningItems||[]){if(String(item.type).startsWith('END_'))continue;const x=Number(item.stationS??item.distanceFromStart??0);if(['SLOT','OBROUND_SLOT'].includes(item.type))this.slot(x,y,item.length,item.width,item.orientation,'SLOT');else if(item.type==='MILLING_REGION')this.milling(x,y,item.length,item.width,item.orientation,'MILLING');else{const dia=Number(item.type==='COUNTERSINK'?(item.majorDiameter??0):(item.diameter||6));this.circle(x,y,Math.max(2,dia/2),item.type==='COUNTERSINK'?'COUNTERSINK':'HOLE');}const stage=item.processStage==='BEND_AFTER'?'AFTER_BEND':'BEFORE_BEND';this.text(x+5,y+8,3,`S=${Number(x.toFixed(2))} ${item.face||''} ${stage}`,'TEXT');}return this.header()+this.e.join('')+this.footer();}

  buildDrawing(d){
    this.e=[];let y=0;this.text(0,40,7,`${d.drawingId} ${d.profile} T=${d.wallThickness} SLOT=${d.slotWidth} L=${d.length} QTY=${d.quantity}`);
    y-=70;
    for(const v of d.views){
      const h=Math.max(v.height,30);this.text(0,y+h+12,5,v.face||v.faceName);this.rect(0,y,d.length,h);
      for(const u of v.units){
        const x=u.distanceFromStart,cy=y+h/2+u.offset;
        if(u.type==='HOLE_UNIT'){
          for(const item of [u.primary,...u.secondary]){const dia=Number(item.type==='COUNTERSINK'?(item.majorDiameter??item.diameter??0):(item.diameter||0));if(dia)this.circle(x,cy,dia/2,item.type==='COUNTERSINK'?'COUNTERSINK':item.type==='COUNTERBORE'?'COUNTERBORE':item.type==='TAPPED_HOLE'?'THREAD':'HOLE');}
          this.line(x-8,cy,x+8,cy,'CENTER');this.line(x,cy-8,x,cy+8,'CENTER');
        } else if(u.type==='SLOT_UNIT') this.slot(x,cy,u.length,u.width,u.orientation,u.primary.type==='OBROUND_SLOT'?'OBROUND_SLOT':'SLOT');
        else if(u.type==='MILLING_UNIT') this.milling(x,cy,u.length,u.width,u.orientation,'MILLING');
        this.text(x+10,cy+10,4,this.unitLabel(u));this.line(0,y-22,x,y-22,'DIMENSION');this.text(x/2-5,y-17,4,Number(x.toFixed(2)),'DIMENSION');
      }
      this.line(0,y-45,d.length,y-45,'DIMENSION');this.text(d.length/2-12,y-40,4,d.length,'DIMENSION');y-=h+90;
    }
    for(const ev of d.endViews){
      this.text(0,y+ev.height+12,5,`${ev.end==='START'?'A':'B'} END`);const cx=ev.width/2,cy=y+ev.height/2;if(!this.section(d.section,cx,cy))this.rect(0,y,ev.width,ev.height);
      for(const u of ev.units){const px=cx+Number(u.offsetX||0),py=cy+Number(u.offsetY||0),item=u.primary;const dia=Number(item.type==='END_COUNTERSINK'?(item.majorDiameter||0):(item.diameter||8));this.circle(px,py,Math.max(2,dia/2),item.type==='END_TAP'?'THREAD':item.type==='END_COUNTERBORE'?'COUNTERBORE':item.type==='END_COUNTERSINK'?'COUNTERSINK':'HOLE');this.text(px+8,py+4,4,this.unitLabel(u));}
      y-=ev.height+70;
    }
    return this.header()+this.e.join('')+this.footer();
  }
  unitLabel(u){const i=u.primary;if(i.type==='THROUGH_HOLE')return`D${i.diameter} THRU`;if(i.type==='COUNTERSINK')return`CSK D${i.majorDiameter??i.diameter}${i.angleDeg?` ${i.angleDeg}DEG`:''}`;if(i.type==='COUNTERBORE')return`CBORE D${i.diameter} DEPTH ${i.depth}`;if(i.type==='TAPPED_HOLE')return`${i.tappingSize} TAP DEPTH ${i.depth}`;if(i.type==='SLOT'||i.type==='OBROUND_SLOT')return`${i.type} ${i.length}x${i.width}`;if(i.type==='MILLING_REGION')return`MILL ${i.length}x${i.width} DEPTH ${i.depth}`;if(i.type==='END_TAP')return`${i.tappingSize} TAP DEPTH ${i.depth}`;if(i.type==='END_HOLE')return`END D${i.diameter} DEPTH ${i.depth}`;if(i.type==='END_COUNTERBORE')return`END CBORE D${i.diameter} DEPTH ${i.depth}`;if(i.type==='END_COUNTERSINK')return`END CSK D${i.majorDiameter} ${i.angleDeg}DEG`;return i.type;}
}
