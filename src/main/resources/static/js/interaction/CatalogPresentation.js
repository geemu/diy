/**
 * 出料口的展示规则。小件按同类别的毫米比例观看，大尺寸再适配；不缩放工程网格。
 * 方向/留白来自公开页面的视觉对照，不是制造尺寸或供应商模型。
 */
export function catalogPresentation(part={}) {
  const kind=part.dimensions?.geometryKind||'',style={direction:[-5,4,-6],rotation:[0,0,0],margin:1.35,referenceSpan:0};
  if(part.type==='PROFILE') {
    if(/R$/.test(part.dimensions.profileId||''))return {...style,margin:1.4,rotation:[0,0,Math.PI/2]};
    const closed=new Set(part.designProfile?.faceClosures||[]);
    let best=style.direction,bestScore=-1;
    // 固定朝向可能把唯一封面藏在背面；目录展示优先露出封面，不转动工程构件。
    for(const direction of [[-5,4,-6],[5,4,-6],[-5,-4,-6],[5,-4,-6]]) {
      const score=Number(closed.has(direction[0]>0?'RIGHT':'LEFT'))+Number(closed.has(direction[1]>0?'FRONT':'BACK'));
      if(score>bestScore){best=direction;bestScore=score;}
    }
    return {...style,direction:best,margin:1.4};
  }
  if(part.type==='SHAFT')return {...style,margin:1.2};
  if(part.type==='PANEL')return {...style,direction:[5,4,6],margin:1.2,referenceSpan:({sphere:300,cylinder:200,cone:170,torus:140})[part.dimensions.panelShape]||400};
  if(kind.startsWith('SHAFT_'))return {...style,referenceSpan:kind==='SHAFT_LIMIT_RING'?60:80,margin:1.25};
  if(['FLAT_PLATE','T_PLATE','L_PLATE','CROSS_PLATE','A_PILLAR_BRACKET','END_CAP','ELASTIC_NUT'].includes(kind))style.direction=[5,4,6];
  if(['L_BRACKET','ANGLE_BRACKET','CORNER_CUBE','HEAVY_CORNER','SHELF_BRACKET','PANEL_FIX_CONNECTOR'].includes(kind))style.direction=[-5,4,6];
  if(['THREE_WAY_RADIAL','THREE_D_CONNECTOR'].includes(kind))style.direction=[5,4,6];
  if(['THREE_WAY','TWO_WAY'].includes(kind))return {...style,direction:[-5,4,6],margin:1.05};
  if(['INNER_BRACKET','SLIDE_BLOCK'].includes(kind))style.rotation=[Math.PI/2,0,0];
  if(kind==='A_PILLAR_BRACKET')return {...style,rotation:[Math.PI/2,0,0],referenceSpan:220};
  if(['INNER_BRACKET','SLIDE_BLOCK'].includes(kind))return {...style,referenceSpan:120,margin:1.2};
  if(kind==='HEAVY_CORNER')return {...style,direction:[5,4,6],margin:1.2};
  if(['ANGLE_BRACKET','CORNER_CUBE','L_BRACKET','SHELF_BRACKET','PANEL_FIX_CONNECTOR'].includes(kind))style.margin=1.12;
  if(kind==='FLAT_PLATE')style.rotation=[0,0,Math.PI/2];
  if(kind==='T_PLATE')style.rotation=[0,0,Math.PI];
  if(kind==='ELASTIC_NUT')style.rotation=[-Math.PI/2,0,0];
  if(kind==='SLIDE_RAIL')return {...style,direction:[-5,4,-8],margin:1.55};
  if(kind.startsWith('SCREW_'))return {...style,referenceSpan:32,margin:1.2};
  if(kind==='FOOT_CUP')return {...style,margin:1.15};
  if(kind==='END_CAP')return {...style,margin:1.25};
  return style;
}
