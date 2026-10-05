/** SVG renderer for EngineeringDrawingModel + EngineeringDrawingLayout. */
export default class EngineeringDrawingSvgExporter {
  export(model,layout,options = {}) {
    const W=layout.paper.width,H=layout.paper.height;
    const marker='alu-arrow';
    const body=[];
    body.push(`<rect x="${layout.margin}" y="${layout.margin}" width="${W-layout.margin*2}" height="${H-layout.margin*2}" fill="white" stroke="black" stroke-width="0.45"/>`);
    for(const view of Object.values(layout.views)) body.push(this.view(view,marker));
    body.push(this.titleBlock(model,layout,options));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><defs><marker id="${marker}" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 z" fill="black"/></marker></defs><rect width="100%" height="100%" fill="white"/>${body.join('')}</svg>`;
  }

  view(view,marker){
    const {cell,scale,origin}=view.layout;const out=[];
    out.push(`<g data-view="${view.viewType}">`);
    out.push(`<text x="${fmt(cell.x+2)}" y="${fmt(cell.y+4)}" font-size="3.6" font-weight="700">${esc(view.label)}</text>`);
    for(const entity of view.entities){
      const path=(entity.rings?.length?entity.rings:[entity.polygon]).map(ring=>ring.map((p,i)=>`${i?'L':'M'} ${fmt(origin.x+p.x*scale)} ${fmt(origin.y-p.y*scale)}`).join(' ')+' Z').join(' ');
      out.push(`<path d="${path}" fill="none" stroke="#111" stroke-width="0.42" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`);
    }
    for(const line of view.centerLines){const a=map(line.from),b=map(line.to);out.push(`<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}" stroke="#777" stroke-width="0.24" stroke-dasharray="2,1.2" vector-effect="non-scaling-stroke"/>`);}
    for(const tag of view.tags||[]){const a=map(tag.anchor),b=map(tag.labelPoint);const boxW=Math.max(10,String(tag.label||'').length*2.4+5);const boxX=tag.side==='LEFT'?b.x-boxW:b.x;out.push(`<g class="part-tag"><line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}" stroke="#111" stroke-width="0.25" vector-effect="non-scaling-stroke"/><circle cx="${fmt(a.x)}" cy="${fmt(a.y)}" r="1.1" fill="white" stroke="#111" stroke-width="0.25"/><rect x="${fmt(boxX)}" y="${fmt(b.y-2.6)}" width="${fmt(boxW)}" height="5.2" rx="1.2" fill="white" stroke="#111" stroke-width="0.25"/><text x="${fmt(boxX+boxW/2)}" y="${fmt(b.y+0.95)}" text-anchor="middle" font-size="2.8" font-weight="700">${esc(tag.label)}</text></g>`);}
    if(view.viewType!=='ISO') for(const dim of view.dimensions) out.push(this.dimension(dim,view,marker));
    out.push(`</g>`);return out.join('');
    function map(p){return{x:origin.x+p.x*scale,y:origin.y-p.y*scale};}
  }

  dimension(dim,view,marker){
    const {scale,origin}=view.layout;const off=Number(dim.offset||0)*scale;
    if(dim.axis==='H'){
      const x1=origin.x+dim.from.x*scale,x2=origin.x+dim.to.x*scale,y=origin.y-dim.from.y*scale-off;
      const baseY=origin.y-dim.from.y*scale;
      return `<g class="dimension"><line x1="${fmt(x1)}" y1="${fmt(baseY)}" x2="${fmt(x1)}" y2="${fmt(y)}" stroke="black" stroke-width="0.18"/><line x1="${fmt(x2)}" y1="${fmt(baseY)}" x2="${fmt(x2)}" y2="${fmt(y)}" stroke="black" stroke-width="0.18"/><line x1="${fmt(x1)}" y1="${fmt(y)}" x2="${fmt(x2)}" y2="${fmt(y)}" stroke="black" stroke-width="0.25" marker-start="url(#${marker})" marker-end="url(#${marker})"/><line x1="${fmt(x1)}" y1="${fmt(y-2)}" x2="${fmt(x1)}" y2="${fmt(y+2)}" stroke="black" stroke-width="0.2"/><line x1="${fmt(x2)}" y1="${fmt(y-2)}" x2="${fmt(x2)}" y2="${fmt(y+2)}" stroke="black" stroke-width="0.2"/><text x="${fmt((x1+x2)/2)}" y="${fmt(y-1.1)}" text-anchor="middle" font-size="2.7">${fmt(dim.value)}</text></g>`;
    }
    const x=origin.x+dim.from.x*scale+off,y1=origin.y-dim.from.y*scale,y2=origin.y-dim.to.y*scale;
    const baseX=origin.x+dim.from.x*scale;
    return `<g class="dimension"><line x1="${fmt(baseX)}" y1="${fmt(y1)}" x2="${fmt(x)}" y2="${fmt(y1)}" stroke="black" stroke-width="0.18"/><line x1="${fmt(baseX)}" y1="${fmt(y2)}" x2="${fmt(x)}" y2="${fmt(y2)}" stroke="black" stroke-width="0.18"/><line x1="${fmt(x)}" y1="${fmt(y1)}" x2="${fmt(x)}" y2="${fmt(y2)}" stroke="black" stroke-width="0.25" marker-start="url(#${marker})" marker-end="url(#${marker})"/><line x1="${fmt(x-2)}" y1="${fmt(y1)}" x2="${fmt(x+2)}" y2="${fmt(y1)}" stroke="black" stroke-width="0.2"/><line x1="${fmt(x-2)}" y1="${fmt(y2)}" x2="${fmt(x+2)}" y2="${fmt(y2)}" stroke="black" stroke-width="0.2"/><text x="${fmt(x+3.2)}" y="${fmt((y1+y2)/2)}" font-size="2.7" transform="rotate(-90 ${fmt(x+3.2)} ${fmt((y1+y2)/2)})">${fmt(dim.value)}</text></g>`;
  }

  titleBlock(model,layout,options){
    const b=layout.titleBlock,x=b.x,y=b.y,w=b.width,h=b.height;const split=x+w*.58,row=y+h/2;
    const project=options.projectName||model.metadata.projectName||'未命名工程';const revision=options.revision||model.metadata.revision||'A';const sideName=layout.views.LEFT?'左':'右';
    return `<g class="title-block"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="0.35"/><line x1="${split}" y1="${y}" x2="${split}" y2="${y+h}" stroke="black" stroke-width="0.25"/><line x1="${split}" y1="${row}" x2="${x+w}" y2="${row}" stroke="black" stroke-width="0.25"/><text x="${x+3}" y="${y+7}" font-size="5" font-weight="700">${esc(project)}</text><text x="${x+3}" y="${y+13}" font-size="2.8">总装工程图 · W${fmt(model.overall.width)} × D${fmt(model.overall.depth)} × H${fmt(model.overall.height)} mm</text><text x="${x+3}" y="${y+19}" font-size="2.8">单位：mm　比例：${esc(layout.scaleLabel)}　投影：正/俯/${sideName}/等轴测</text><text x="${split+3}" y="${y+7}" font-size="2.8">图幅 ${layout.paper.name}</text><text x="${split+3}" y="${y+13}" font-size="2.8">版本 ${esc(revision)}</text><text x="${split+3}" y="${row+7}" font-size="2.8">构件 ${model.scope.partCount}</text><text x="${split+3}" y="${row+13}" font-size="2.8">铝型材设计器</text></g>`;
  }
}

function fmt(v){return Number(Number(v||0).toFixed(3));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
