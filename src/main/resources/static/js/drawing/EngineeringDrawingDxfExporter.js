/**
 * DXF renderer for EngineeringDrawingModel + EngineeringDrawingLayout.
 *
 * The DXF is an editable 2D drawing sheet in millimetres. It intentionally
 * consumes the exact same model/layout as the SVG exporter so both outputs
 * stay geometrically consistent.
 */
export const ENGINEERING_DRAWING_DXF_VERSION = 1;

export const ENGINEERING_DXF_LAYERS = Object.freeze({
  PROFILE:{name:'PROFILE',color:7,lineType:'CONTINUOUS'},
  CENTER:{name:'CENTER',color:8,lineType:'CENTER'},
  DIMENSION:{name:'DIMENSION',color:2,lineType:'CONTINUOUS'},
  TEXT:{name:'TEXT',color:7,lineType:'CONTINUOUS'},
  TITLEBLOCK:{name:'TITLEBLOCK',color:7,lineType:'CONTINUOUS'},
  VIEW:{name:'VIEW',color:4,lineType:'CONTINUOUS'},
  HIDDEN:{name:'HIDDEN',color:8,lineType:'DASHED'}
});

export default class EngineeringDrawingDxfExporter {
  export(model,layout,options={}) {
    if (!model?.views || !layout?.views || !layout?.paper) throw new Error('工程图模型或版面无效');
    this.entities=[];
    this.paperHeight=Number(layout.paper.height||0);

    this.paperBorder(layout);
    for (const view of Object.values(layout.views)) this.view(view);
    this.titleBlock(model,layout,options);

    return this.document();
  }

  layerManifest() {
    return Object.values(ENGINEERING_DXF_LAYERS).map(item=>({...item}));
  }

  paperBorder(layout) {
    const x=layout.margin,y=layout.margin,w=layout.paper.width-layout.margin*2,h=layout.paper.height-layout.margin*2;
    this.rectPaper(x,y,w,h,'TITLEBLOCK');
  }

  view(view) {
    const {cell,scale,origin}=view.layout;
    this.textPaper(cell.x+2,cell.y+4,3.6,view.label,'VIEW');

    for (const entity of view.entities) {
      for(const ring of entity.rings?.length?entity.rings:[entity.polygon])this.polylinePaper(ring.map(p=>this.modelToPaper(view,p)),'PROFILE',true);
    }

    for (const centerLine of view.centerLines||[]) {
      const a=this.modelToPaper(view,centerLine.from),b=this.modelToPaper(view,centerLine.to);
      this.linePaper(a.x,a.y,b.x,b.y,'CENTER');
    }

    for (const tag of view.tags||[]) {
      const a=this.modelToPaper(view,tag.anchor),b=this.modelToPaper(view,tag.labelPoint);
      this.linePaper(a.x,a.y,b.x,b.y,'TEXT');
      this.textPaper(b.x,b.y,2.8,tag.label,'TEXT',{align:tag.side==='LEFT'?'RIGHT':'LEFT'});
    }

    if (view.viewType!=='ISO') for (const dim of view.dimensions||[]) this.dimension(dim,view);
  }

  dimension(dim,view) {
    const {scale,origin}=view.layout;
    const off=Number(dim.offset||0)*scale;
    if (dim.axis==='H') {
      const x1=origin.x+Number(dim.from.x||0)*scale;
      const x2=origin.x+Number(dim.to.x||0)*scale;
      const y=origin.y-Number(dim.from.y||0)*scale-off;
      const baseY=origin.y-Number(dim.from.y||0)*scale;
      this.linePaper(x1,baseY,x1,y,'DIMENSION');
      this.linePaper(x2,baseY,x2,y,'DIMENSION');
      this.linePaper(x1,y,x2,y,'DIMENSION');
      this.linePaper(x1,y-2,x1,y+2,'DIMENSION');
      this.linePaper(x2,y-2,x2,y+2,'DIMENSION');
      this.arrowPaper(x1,y,x2>=x1?0:180,'DIMENSION');
      this.arrowPaper(x2,y,x2>=x1?180:0,'DIMENSION');
      this.textPaper((x1+x2)/2,y-1.1,2.7,formatValue(dim.value),'DIMENSION',{align:'CENTER'});
      return;
    }

    const x=origin.x+Number(dim.from.x||0)*scale+off;
    const y1=origin.y-Number(dim.from.y||0)*scale;
    const y2=origin.y-Number(dim.to.y||0)*scale;
    const baseX=origin.x+Number(dim.from.x||0)*scale;
    this.linePaper(baseX,y1,x,y1,'DIMENSION');
    this.linePaper(baseX,y2,x,y2,'DIMENSION');
    this.linePaper(x,y1,x,y2,'DIMENSION');
    this.linePaper(x-2,y1,x+2,y1,'DIMENSION');
    this.linePaper(x-2,y2,x+2,y2,'DIMENSION');
    this.arrowPaper(x,y1,y2>=y1?90:-90,'DIMENSION');
    this.arrowPaper(x,y2,y2>=y1?-90:90,'DIMENSION');
    this.textPaper(x+3.2,(y1+y2)/2,2.7,formatValue(dim.value),'DIMENSION',{rotation:90,align:'CENTER'});
  }

  titleBlock(model,layout,options) {
    const b=layout.titleBlock,x=b.x,y=b.y,w=b.width,h=b.height;
    const split=x+w*.58,row=y+h/2;
    const project=options.projectName||model.metadata?.projectName||'未命名工程';
    const revision=options.revision||model.metadata?.revision||'A';
    const sideName=layout.views.LEFT?'左视':'右视';
    this.rectPaper(x,y,w,h,'TITLEBLOCK');
    this.linePaper(split,y,split,y+h,'TITLEBLOCK');
    this.linePaper(split,row,x+w,row,'TITLEBLOCK');
    this.textPaper(x+3,y+7,5,project,'TEXT');
    this.textPaper(x+3,y+13,2.8,`总装工程图 宽${formatValue(model.overall.width)} × 深${formatValue(model.overall.depth)} × 高${formatValue(model.overall.height)} mm`,'TEXT');
    this.textPaper(x+3,y+19,2.8,`单位 mm  比例 ${layout.scaleLabel}  视图 正视/俯视/${sideName}/等轴测`,'TEXT');
    this.textPaper(split+3,y+7,2.8,`图幅 ${layout.paper.name}`,'TEXT');
    this.textPaper(split+3,y+13,2.8,`版本 ${revision}`,'TEXT');
    this.textPaper(split+3,row+7,2.8,`构件 ${model.scope.partCount}`,'TEXT');
    this.textPaper(split+3,row+13,2.8,'铝型材设计器','TEXT');
  }

  modelToPaper(view,p) {
    const {scale,origin}=view.layout;
    return {x:origin.x+Number(p.x||0)*scale,y:origin.y-Number(p.y||0)*scale};
  }

  rectPaper(x,y,w,h,layer) {
    this.linePaper(x,y,x+w,y,layer);
    this.linePaper(x+w,y,x+w,y+h,layer);
    this.linePaper(x+w,y+h,x,y+h,layer);
    this.linePaper(x,y+h,x,y,layer);
  }

  polylinePaper(points,layer,closed=false) {
    if (!points?.length) return;
    for(let i=0;i<points.length-1;i++) this.linePaper(points[i].x,points[i].y,points[i+1].x,points[i+1].y,layer);
    if (closed && points.length>2) this.linePaper(points.at(-1).x,points.at(-1).y,points[0].x,points[0].y,layer);
  }

  linePaper(x1,y1,x2,y2,layer='PROFILE') {
    const a=this.toCad(x1,y1),b=this.toCad(x2,y2);
    this.entities.push(entity('LINE',[
      [8,layer],[10,n(a.x)],[20,n(a.y)],[30,0],[11,n(b.x)],[21,n(b.y)],[31,0]
    ]));
  }

  arrowPaper(x,y,angleDeg,layer='DIMENSION') {
    const size=1.8,a=angleDeg*Math.PI/180;
    const tip=this.toCad(x,y);
    const left=this.toCad(x-size*Math.cos(a-Math.PI/7),y-size*Math.sin(a-Math.PI/7));
    const right=this.toCad(x-size*Math.cos(a+Math.PI/7),y-size*Math.sin(a+Math.PI/7));
    this.entities.push(entity('SOLID',[
      [8,layer],[10,n(tip.x)],[20,n(tip.y)],[30,0],
      [11,n(left.x)],[21,n(left.y)],[31,0],
      [12,n(right.x)],[22,n(right.y)],[32,0],
      [13,n(right.x)],[23,n(right.y)],[33,0]
    ]));
  }

  textPaper(x,y,height,value,layer='TEXT',options={}) {
    const p=this.toCad(x,y);
    const rotation=-Number(options.rotation||0);
    const pairs=[[8,layer],[10,n(p.x)],[20,n(p.y)],[30,0],[40,n(height)],[1,dxfText(value)],[50,n(rotation)]];
    if (options.align==='CENTER') pairs.push([72,1],[11,n(p.x)],[21,n(p.y)],[31,0]);
    else if(options.align==='RIGHT') pairs.push([72,2],[11,n(p.x)],[21,n(p.y)],[31,0]);
    else if(options.align==='LEFT') pairs.push([72,0],[11,n(p.x)],[21,n(p.y)],[31,0]);
    this.entities.push(entity('TEXT',pairs));
  }

  toCad(x,y) { return {x:Number(x||0),y:this.paperHeight-Number(y||0)}; }

  document() {
    return [
      '0','SECTION','2','HEADER',
      '9','$ACADVER','1','AC1015',
      '9','$INSUNITS','70','4',
      '9','$MEASUREMENT','70','1',
      '0','ENDSEC',
      this.tables(),
      '0','SECTION','2','ENTITIES',
      ...this.entities,
      '0','ENDSEC','0','EOF',''
    ].join('\n');
  }

  tables() {
    const out=['0','SECTION','2','TABLES'];
    out.push('0','TABLE','2','LTYPE','70','3');
    out.push(...linetype('CONTINUOUS','Solid line',[]));
    out.push(...linetype('CENTER','Center ____ _ ____ _ ____',[1.25,-.25,.25,-.25]));
    out.push(...linetype('DASHED','Dashed __ __ __',[.6,-.3]));
    out.push('0','ENDTAB');

    const layers=Object.values(ENGINEERING_DXF_LAYERS);
    out.push('0','TABLE','2','LAYER','70',String(layers.length));
    for (const layer of layers) {
      out.push('0','LAYER','2',layer.name,'70','0','62',String(layer.color),'6',layer.lineType);
    }
    out.push('0','ENDTAB','0','ENDSEC');
    return out.join('\n');
  }
}

function entity(type,pairs){return ['0',type,...pairs.flatMap(([code,value])=>[String(code),String(value)])].join('\n');}
function linetype(name,description,pattern){
  const total=pattern.reduce((sum,v)=>sum+Math.abs(v),0);
  const out=['0','LTYPE','2',name,'70','0','3',description,'72','65','73',String(pattern.length),'40',String(total)];
  for (const value of pattern) out.push('49',String(value),'74','0');
  return out;
}
function n(value){return Number(Number(value||0).toFixed(4));}
function formatValue(value){return Number(Number(value||0).toFixed(2));}

/** DXF text is intentionally ASCII with Autodesk Unicode escapes for portability. */
export function dxfText(value){
  let out='';
  for (const ch of String(value??'').replace(/[\r\n]+/g,' ')) {
    const code=ch.codePointAt(0);
    if (code>=0x20 && code<=0x7E) out+=ch==='\\'?'\\\\':ch;
    else if (code<=0xFFFF) out+=`\\U+${code.toString(16).toUpperCase().padStart(4,'0')}`;
    else out+='?';
  }
  return out.trim()||'TEXT';
}
