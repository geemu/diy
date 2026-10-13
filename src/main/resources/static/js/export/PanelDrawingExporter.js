import {panelMaterialContours,panelNotchPolygons,PanelShapeFields,SolidPanelShapes} from '../model/PanelShapeModel.js';
import {contourBounds,assertSimpleContour,cleanContour} from '../model/PanelContourMath.js';
import {dxfText} from '../drawing/EngineeringDrawingDxfExporter.js';
import BomExporter from './BomExporter.js';

/** 单板平面图只读领域轮廓。SVG为尺寸示意；DXF轮廓为毫米1:1，不反推展示网格。 */
export default class PanelDrawingExporter {
  constructor(editor){this.editor=editor;}
  build(){
    const groups=new Map();
    for(const part of (this.editor.parts||[]).filter(item=>item.type==='PANEL')){
      const key=signature([part.dimensions,part.materialSpec||{},part.machiningItems||[],part.note||'']);
      if(!groups.has(key))groups.set(key,{key,part:structuredClone(part),partIds:[]});
      groups.get(key).partIds.push(part.id);
    }
    return [...groups.values()].map((group,index)=>{
      const part=group.part,d=part.dimensions||{},shape=d.panelShape||'rectangle';
      const row={...group,id:`PANEL-${String(index+1).padStart(2,'0')}`,label:`板材样式${String(index+1).padStart(2,'0')}`,
        quantity:group.partIds.length,material:part.materialSpec?.material||'材质待配置',width:Number(d.width),height:Number(d.height),
        thickness:Number(d.thickness),notches:structuredClone(d.edgeNotches||[]),supported:false,reason:'',note:part.note||''};
      row.sizeLabel=[row.width,row.height,row.thickness].map(value=>Number.isFinite(value)?fmt(value):'待确认').join(' × ')+' mm';
      try{
        if(SolidPanelShapes.includes(shape))throw new Error('立体构件不作为平面板材加工图');
        if((part.machiningItems||[]).length)throw new Error('含未适配的板材加工记录，不能仅导出轮廓冒充完整加工图');
        if(![row.width,row.height,row.thickness].every(value=>Number.isFinite(value)&&value>0))throw new Error('板材外尺寸或厚度无效');
        const material=panelMaterialContours(part);
        // 与材料轮廓运算共用去重/共线清理，圆弧分段接点不输出零长度切割段；不回写原板。
        row.contours={outer:cleanContour(material.outer),holes:material.holes.map(cleanContour)};
        for(const ring of [row.contours.outer,...row.contours.holes])assertSimpleContour(ring);
        row.bounds=contourBounds(row.contours.outer);row.notchPolygons=panelNotchPolygons(part);
        if(!Object.values(row.bounds).every(Number.isFinite)||row.bounds.maxX<=row.bounds.minX||row.bounds.maxY<=row.bounds.minY)throw new Error('板材材料轮廓范围无效');
        const parameters=d.shapeParameters||d;
        const shapeNote=(PanelShapeFields[shape]||[]).filter(([key])=>!['width','height','thickness'].includes(key)&&parameters[key]!=null)
          .map(([key,label])=>`${label} ${fmt(parameters[key])}`).join(' · ');
        row.note=[shapeNote,row.note,['circle','ellipse','ring','obround'].includes(shape)?'圆弧按当前领域轮廓的折线表达，实际工艺需复核':''].filter(Boolean).join('；');
        row.supported=true;
      }catch(error){row.reason=error.message;}
      return row;
    });
  }
  list(groups){
    return {headers:['板材样式','材质','原板宽（mm）','原板高（mm）','厚度（mm）','数量（张）','避让记录（项）','图纸 / 状态','备注'],
      rows:groups.map(group=>({cells:[`${group.label}（${group.id}）`,group.material,
        finiteValue(group.width),finiteValue(group.height),finiteValue(group.thickness),group.quantity,group.notches.length,
        group.supported?`${group.id}.svg / .dxf`:group.reason,group.note]}))};
  }
  addFiles(folder,groups=this.build()){
    folder.file('板材清单.csv',BomExporter.fileText(BomExporter.factoryListRows(this.list(groups))));
    for(const group of groups.filter(row=>row.supported)){
      folder.file(`${group.id}.svg`,this.svg(group));folder.file(`${group.id}.dxf`,this.dxf(group));
    }
    folder.file('阅读说明.txt',[
      '同一材质、完整尺寸和裁剪参数的板材按数量汇总，板材样式对应同名SVG/DXF，不是内部构件编号。',
      'SVG示意图包含原板尺寸、实际轮廓外形尺寸、厚度、数量和N编号避让记录；不要按打印缩放比例下料。',
      'DXF的CONTOUR/HOLE图层使用实际领域轮廓，单位mm、1:1；DIMENSION/NOTES仅为说明，不作为切割路径。',
      'DXF坐标原点为实际材料轮廓外包范围的左下角，X向右、Y向上；原点可能位于已裁掉的角内。',
      '避让记录宽/深是沿边与内切包络范围，沿轮廓裁剪并非矩形缺口；请以CONTOUR实际轮廓为准。',
      'N记录对应保存的缺口，不代表独立刀具工序，重叠缺口的材料轮廓已取并集。',
      '圆弧沿当前领域轮廓用折线表达；立体构件/未知轮廓/未适配板材加工明确列出，不输出假二维图。',
      '普通下载是设计参考，正式制造仍须制造配置/检查；材料、插槽余量、实际截面、装配顺序、刀具及公差须复核。',
      '工程变更后请重新导出整套清单和图纸。'
    ].join('\n'));
  }
  svg(group){
    if(!group.supported)throw new Error(group.reason||'该板材尚未适配');
    const b=group.bounds,w=b.maxX-b.minX,h=b.maxY-b.minY,scale=Math.min(225/w,115/h),cx=148.5,cy=96;
    const x=value=>cx+(value-(b.minX+b.maxX)/2)*scale,y=value=>cy-(value-(b.minY+b.maxY)/2)*scale;
    const left=x(b.minX),right=x(b.maxX),top=y(b.maxY),bottom=y(b.minY);
    const text=(px,py,value,size=3.1,anchor='start')=>`<text x="${px}" y="${py}" font-size="${size}" text-anchor="${anchor}">${xml(value)}</text>`;
    const line=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="0.25"/>`;
    const path=[group.contours.outer,...group.contours.holes].map(ring=>ring.map((point,index)=>`${index?'L':'M'} ${x(point.x)} ${y(point.y)}`).join(' ')+' Z').join(' ');
    const elements=[text(12,12,`${group.id} · 板材平面图`,4.6),
      text(12,20,`原板 ${fmt(group.width)} × ${fmt(group.height)} mm · 厚度 ${fmt(group.thickness)} mm · 数量 ${group.quantity} 张`),
      text(12,27,'单位：mm。图中尺寸为实际轮廓外形范围；裁剪按实线轮廓。',2.8),
      `<path d="${path}" fill="#f5f5f5" stroke="#222" stroke-width="0.35" fill-rule="evenodd"/>`,
      line(left,bottom+8,right,bottom+8),line(left,bottom+2,left,bottom+10),line(right,bottom+2,right,bottom+10),
      text(cx,bottom+13,fmt(w),3.2,'middle'),line(left-8,top,left-8,bottom),line(left-10,top,left-2,top),line(left-10,bottom,left-2,bottom),
      text(left-10,cy,fmt(h),3.2,'end')];
    for(let index=0;index<group.notchPolygons.length;index++){
      const points=group.notchPolygons[index],center={x:0,y:0};
      for(const p of points){center.x+=p.x/points.length;center.y+=p.y/points.length;}
      elements.push(text(x(center.x),y(center.y),`N${index+1}`,2.6,'middle'));
    }
    let rowY=177;
    for(const materialLine of wrap(`材质：${group.material}`,84)){elements.push(text(12,rowY,materialLine,2.9));rowY+=5;}
    elements.push(text(12,rowY,`避让记录 ${group.notches.length} 项（沿轮廓裁剪时宽/深仅为范围，不是矩形切口）`,3.2));rowY+=7;
    for(let index=0;index<group.notches.length;index++){
      const n=group.notches[index];
      elements.push(text(12,rowY,`N${index+1} ${edgeName(n.edge)} · 距${anchorName(n)} ${fmt(n.offsetMm)} mm · 沿边范围 ${fmt(n.widthMm)} mm · 内切范围 ${fmt(n.depthMm)} mm`,2.9));
      rowY+=5;
      if(n.outline){elements.push(text(17,rowY,'沿保存轮廓避让：见实线轮廓及DXF的CONTOUR图层。',2.7));rowY+=5;}
    }
    if(!group.notches.length){elements.push(text(12,rowY,'无边缘避让；内孔/异形边界按图示材料轮廓。',2.9));rowY+=5;}
    if(group.note){for(const line of wrap(group.note,84)){elements.push(text(12,rowY+3,line,2.7));rowY+=5;}}
    rowY+=7;elements.push(text(12,rowY,'设计参考：不按打印比例下料，材料、槽余量、装配顺序与加工公差需复核。',2.8));
    const height=Math.max(210,rowY+10);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="${height}mm" viewBox="0 0 297 ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial,Microsoft YaHei,sans-serif" fill="#222">${elements.join('')}</g></svg>`;
  }
  dxf(group){
    if(!group.supported)throw new Error(group.reason||'该板材尚未适配');
    const b=group.bounds,w=b.maxX-b.minX,h=b.maxY-b.minY,entities=[];
    const line=(a,c,layer)=>entities.push(entity('LINE',[[8,layer],[10,a.x],[20,a.y],[30,0],[11,c.x],[21,c.y],[31,0]]));
    const text=(x,y,value,size=4)=>entities.push(entity('TEXT',[[8,'NOTES'],[10,x],[20,y],[30,0],[40,size],[1,dxfText(value)],[50,0]]));
    const shift=p=>({x:p.x-b.minX,y:p.y-b.minY});
    for(const [index,ring] of [group.contours.outer,...group.contours.holes].entries())
      for(let i=0;i<ring.length;i++)line(shift(ring[i]),shift(ring[(i+1)%ring.length]),index===0?'CONTOUR':'HOLE');
    text(0,h+27,`${group.id} · ${group.material} · QTY ${group.quantity}`,6);
    text(0,h+18,`原板 ${fmt(group.width)}x${fmt(group.height)} / 厚度 ${fmt(group.thickness)} mm / 轮廓1:1`);
    text(0,h+10,'原点=实际轮廓外包左下角；说明/尺寸图层不作为切割路径。');
    line({x:0,y:-15},{x:w,y:-15},'DIMENSION');line({x:0,y:-12},{x:0,y:-18},'DIMENSION');line({x:w,y:-12},{x:w,y:-18},'DIMENSION');
    text(w/2,-25,fmt(w));line({x:-15,y:0},{x:-15,y:h},'DIMENSION');text(-30,h/2,fmt(h));
    let noteY=-40;
    for(let index=0;index<group.notches.length;index++){
      const n=group.notches[index];text(0,noteY,`N${index+1} ${edgeName(n.edge)} 距${anchorName(n)} ${fmt(n.offsetMm)} 沿边范围${fmt(n.widthMm)} 内切范围${fmt(n.depthMm)} mm ${n.outline?'沿轮廓':'矩形缺口'}`);noteY-=8;
      const points=group.notchPolygons[index],p=shift(points[0]);text(p.x,p.y,`N${index+1}`,3);
    }
    text(0,noteY-8,'设计参考；圆弧按当前轮廓折线表达；正式生产需配置、检查及实物/公差复核。');
    const layers=['CONTOUR','HOLE','DIMENSION','NOTES'];
    return ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','9','$MEASUREMENT','70','1','0','ENDSEC',
      '0','SECTION','2','TABLES','0','TABLE','2','LTYPE','70','1','0','LTYPE','2','CONTINUOUS','70','0','3','Solid line','72','65','73','0','40','0','0','ENDTAB',
      '0','TABLE','2','LAYER','70',String(layers.length),
      ...layers.flatMap((name,index)=>['0','LAYER','2',name,'70','0','62',String(index+1),'6','CONTINUOUS']),
      '0','ENDTAB','0','ENDSEC','0','SECTION','2','ENTITIES',...entities,'0','ENDSEC','0','EOF'].join('\n');
  }
}

function signature(value){const sort=item=>Array.isArray(item)?item.map(sort):item&&typeof item==='object'?Object.fromEntries(Object.keys(item).sort().map(key=>[key,sort(item[key])])):item;return JSON.stringify(sort(value));}
function xml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function fmt(value){return Number(Number(value).toFixed(3));}
function finiteValue(value){return Number.isFinite(value)?value:'待确认';}
function entity(type,pairs){return ['0',type,...pairs.flatMap(([code,value])=>[String(code),String(value)])].join('\n');}
function edgeName(edge){return {LEFT:'左边',RIGHT:'右边',TOP:'上边',BOTTOM:'下边'}[edge]||'边待确认';}
function anchorName(notch){return ['LEFT','RIGHT'].includes(notch.edge)?notch.anchor==='END'?'上端':'下端':notch.anchor==='END'?'右端':'左端';}
function wrap(value,length){const chars=Array.from(String(value)),lines=[];for(let i=0;i<chars.length;i+=length)lines.push(chars.slice(i,i+length).join(''));return lines;}
