export const ENGINEERING_DRAWING_LAYOUT_VERSION = 1;
export const PAPER_SIZES = Object.freeze({
  A4:{width:297,height:210,label:'A4'},
  A3:{width:420,height:297,label:'A3'}
});

export default class EngineeringDrawingLayout {
  static layout(model,options = {}) {
    const paper=PAPER_SIZES[options.paper]||PAPER_SIZES.A3;
    const landscape=options.landscape!==false;
    const width=landscape?Math.max(paper.width,paper.height):Math.min(paper.width,paper.height);
    const height=landscape?Math.min(paper.width,paper.height):Math.max(paper.width,paper.height);
    const margin=10,titleHeight=36,gap=8;
    const content={x:margin,y:margin,width:width-margin*2,height:height-margin*2-titleHeight-gap};
    const leftWidth=content.width*.64,rightWidth=content.width-leftWidth-gap;
    const topHeight=content.height*.47,bottomHeight=content.height-topHeight-gap;
    const cells={
      TOP:{x:content.x,y:content.y,width:leftWidth,height:topHeight},
      FRONT:{x:content.x,y:content.y+topHeight+gap,width:leftWidth,height:bottomHeight},
      RIGHT:{x:content.x+leftWidth+gap,y:content.y+topHeight+gap,width:rightWidth,height:bottomHeight},
      LEFT:{x:content.x+leftWidth+gap,y:content.y+topHeight+gap,width:rightWidth,height:bottomHeight},
      ISO:{x:content.x+leftWidth+gap,y:content.y,width:rightWidth,height:topHeight}
    };
    const orth=['FRONT','TOP',model.views.LEFT?'LEFT':'RIGHT'].map(k=>model.views[k]).filter(Boolean);
    const rawScale=Math.min(...orth.map((view,index)=>fitScale(view,cells[view.viewType]||Object.values(cells)[index],8)),10);
    const commonScale=standardScale(rawScale);
    const views={};
    for(const [key,view] of Object.entries(model.views)){
      const cell=cells[key]; if(!cell) continue;
      const scale=key==='ISO'?fitScale(view,cell,7):commonScale;
      views[key]={...view,layout:{cell,scale,origin:originFor(view,cell,scale)}};
    }
    return {
      layoutVersion:ENGINEERING_DRAWING_LAYOUT_VERSION,
      paper:{name:paper.label,width,height,landscape},margin,titleBlock:{x:margin,y:height-margin-titleHeight,width:width-margin*2,height:titleHeight},views,
      scale:commonScale,scaleLabel:scaleLabel(commonScale)
    };
  }
}

function fitScale(view,cell,padding){return Math.max(.001,Math.min((cell.width-padding*2)/Math.max(view.bounds.width,1),(cell.height-padding*2-8)/Math.max(view.bounds.height,1)));}
function originFor(view,cell,scale){return{x:cell.x+cell.width/2-(view.bounds.min.x+view.bounds.width/2)*scale,y:cell.y+cell.height/2+(view.bounds.min.y+view.bounds.height/2)*scale+3};}
function standardScale(raw){const values=[10,5,2,1,.5,.2,.1,.05,.04,.02,.01,.005,.002,.001];return values.find(value=>value<=raw+1e-9)||Math.max(.0001,raw);}
function scaleLabel(scale){if(scale>=.99)return`${Math.max(1,Math.round(scale))}:1`;return`1:${Math.max(1,Math.round(1/scale))}`;}
