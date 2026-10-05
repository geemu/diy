/**
 * EngineeringDrawingModel v1
 *
 * Converts the current project model into stable 2D engineering-view primitives.
 * The output is renderer-agnostic and is intentionally reusable by SVG/DXF exporters.
 */
export const ENGINEERING_DRAWING_MODEL_VERSION = 1;
import {panelContours,SolidPanelShapes,solidPanelPoints} from '../model/PanelShapeModel.js';

export const DRAWING_VIEWS = Object.freeze({
  FRONT:'FRONT', BACK:'BACK', TOP:'TOP', BOTTOM:'BOTTOM', LEFT:'LEFT', RIGHT:'RIGHT', ISO:'ISO'
});

export default class EngineeringDrawingModel {
  constructor(editor) { this.editor = editor; }

  buildProject(options = {}) {
    this.editor?.manufacturingIdentityManager?.reconcile?.();
    const parts = this.collectParts(options);
    const views = {};
    for (const type of options.views || [DRAWING_VIEWS.FRONT,DRAWING_VIEWS.TOP,DRAWING_VIEWS.RIGHT,DRAWING_VIEWS.ISO]) {
      views[type] = this.buildView(type,parts);
    }
    const bounds3d = worldBounds(parts);
    return {
      modelVersion:ENGINEERING_DRAWING_MODEL_VERSION,
      drawingType:'ASSEMBLY',
      scope:{assemblyId:options.assemblyId || null,partCount:parts.length},
      metadata:{
        projectName:options.projectName || '未命名工程',
        revision:options.revision || 'A',
        unit:'mm',
        appVersion:options.appVersion || '',
        note:options.note || ''
      },
      bounds3d,
      overall:{width:round(bounds3d.max.x-bounds3d.min.x),height:round(bounds3d.max.y-bounds3d.min.y),depth:round(bounds3d.max.z-bounds3d.min.z)},
      views
    };
  }

  buildSubassembly(assemblyId,options = {}) {
    return this.buildProject({...options,assemblyId});
  }

  collectParts(options = {}) {
    const assemblyId = options.assemblyId || null;
    let ids = null;
    if (assemblyId && this.editor?.assemblyManager) {
      const assembly = this.editor.assemblyManager.get?.(assemblyId);
      if (!assembly) throw new Error(`装配不存在：${assemblyId}`);
      ids = new Set(this.editor.assemblyManager.partIds?.(assemblyId,true) || []);
    }
    if (this.editor?.meshes) this.editor.meshes.forEach(mesh => this.editor.syncPartFromMesh?.(mesh));
    return (this.editor?.parts || [])
      .filter(part => !ids || ids.has(part.id))
      .filter(part => options.includeHidden === true || part.hidden !== true)
      .filter(part => options.includeGenerated === true || !part.generatedByConnectionId)
      .map(part => ({part,corners:partWorldPoints(part)}));
  }

  buildView(type,parts) {
    const entities = [];
    for (const item of parts) {
      const projected = item.corners.map(point => projectPoint(type,point));
      const hull = convexHull(projected);
      if (!hull.length) continue;
      const center = projectPoint(type,centerOf(item.corners));
      entities.push({
        entityType:'PART_OUTLINE', partId:item.part.id, displayId:item.part.displayId || '', manufacturingCode:item.part.manufacturingCode || item.part.displayId || '', tag:item.part.manufacturingCode || item.part.displayId || '',
        partType:item.part.type, name:item.part.name || item.part.displayId || '',
        polygon:hull, rings:panelDrawingRings(item.part,type), center, bounds:bounds2d(hull), lineType:'VISIBLE'
      });
    }
    const bounds = bounds2d(entities.flatMap(entity => entity.polygon));
    const dimensions = [...buildOverallDimensions(type,bounds),...buildInternalDimensions(type,bounds,entities)];
    return {
      viewType:type,
      label:viewLabel(type),
      projection:type === DRAWING_VIEWS.ISO ? 'AXONOMETRIC' : 'ORTHOGRAPHIC',
      entities,
      centerLines:buildCenterLines(entities),
      tags:buildDrawingTags(entities,bounds),
      bounds,
      dimensions
    };
  }
}

export function partWorldPoints(part) {
  const local = partLocalPoints(part);
  const p = part.position || {};
  const r = part.rotation || {};
  return local.map(point => {
    const rotated = rotateXYZ(point,Number(r.x||0),Number(r.y||0),Number(r.z||0));
    return {x:rotated.x+Number(p.x||0),y:rotated.y+Number(p.y||0),z:rotated.z+Number(p.z||0)};
  });
}

function panelDrawingRings(part,type) {
  const d=part.dimensions||{},shape=d.panelShape;
  if(part.type!=='PANEL'||!shape||SolidPanelShapes.includes(shape))return null;
  const contours=panelContours(shape,d.shapeParameters),rings=[contours.outer,...contours.holes];
  const p=part.position||{},r=part.rotation||{};
  return rings.map(ring=>ring.map(point=>{
    const rotated=rotateXYZ({x:point.x,y:point.y,z:d.thickness/2},Number(r.x||0),Number(r.y||0),Number(r.z||0));
    return projectPoint(type,{x:rotated.x+Number(p.x||0),y:rotated.y+Number(p.y||0),z:rotated.z+Number(p.z||0)});
  })).filter(ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.x*q.y-q.x*p.y;},0))>.001);
}

function partLocalPoints(part) {
  if (part.type === 'PROFILE') {
    const section = part.dimensions?.sectionSize || [30,30];
    const hx=Number(section[0]||30)/2, hy=Number(section[1]||30)/2;
    if (part.profilePath?.type === 'ARC') {
      const radius=Math.max(1,Number(part.profilePath.radius||1000));
      const angle=Math.max(.1,Number(part.profilePath.angleDeg||90))*Math.PI/180;
      const plane=part.profilePath.plane==='YZ'?'YZ':'XZ';
      const points=[];
      const expand=Math.max(hx,hy);
      for(let i=0;i<=24;i++){
        const theta=-angle/2+angle*i/24;
        const bulge=radius*(1-Math.cos(theta)),z=radius*Math.sin(theta);
        const c=plane==='YZ'?{x:0,y:bulge,z}:{x:bulge,y:0,z};
        for(const dx of [-expand,expand])for(const dy of [-expand,expand])for(const dz of [-expand,expand])points.push({x:c.x+dx,y:c.y+dy,z:c.z+dz});
      }
      return points;
    }
    return boxPoints(hx,hy,Number(part.dimensions?.length||500)/2);
  }
  if (part.type === 'SHAFT') {
    const rr=Number(part.dimensions?.diameter||12)/2;
    return boxPoints(rr,rr,Number(part.dimensions?.length||500)/2);
  }
  if (part.type === 'PANEL') {
    const d=part.dimensions||{},shape=d.panelShape;
    if(shape&&!SolidPanelShapes.includes(shape))return panelContours(shape,d.shapeParameters).outer.flatMap(p=>[{...p,z:-d.thickness/2},{...p,z:d.thickness/2}]);
    if(shape)return solidPanelPoints(shape,d.shapeParameters);
    return boxPoints(Number(d.width||400)/2,Number(d.height||400)/2,Number(d.thickness||18)/2);
  }
  const d=part.dimensions || {};
  const sx=Number(d.width||d.footDiameter||d.wheelDiameter||d.size||30),sy=Number(d.height||d.stemLength||d.size||30),sz=Number(d.length||d.width||d.size||30);
  return boxPoints(Math.max(1,sx/2),Math.max(1,sy/2),Math.max(1,sz/2));
}

function boxPoints(hx,hy,hz){const out=[];for(const x of [-hx,hx])for(const y of [-hy,hy])for(const z of [-hz,hz])out.push({x,y,z});return out;}

function rotateXYZ(p,rx,ry,rz){
  const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz);
  const m=[[c*e,-c*f,d],[b*d*e+a*f,a*e-b*d*f,-b*c],[b*f-a*d*e,b*e+a*d*f,a*c]];
  return{x:m[0][0]*p.x+m[0][1]*p.y+m[0][2]*p.z,y:m[1][0]*p.x+m[1][1]*p.y+m[1][2]*p.z,z:m[2][0]*p.x+m[2][1]*p.y+m[2][2]*p.z};
}

export function projectPoint(type,p) {
  switch(type){
    case DRAWING_VIEWS.BACK:return{x:-p.x,y:p.y};
    case DRAWING_VIEWS.TOP:return{x:p.x,y:-p.z};
    case DRAWING_VIEWS.BOTTOM:return{x:p.x,y:p.z};
    case DRAWING_VIEWS.LEFT:return{x:p.z,y:p.y};
    case DRAWING_VIEWS.RIGHT:return{x:-p.z,y:p.y};
    case DRAWING_VIEWS.ISO:return{x:(p.x-p.z)*0.8660254,y:p.y*0.82+(p.x+p.z)*0.35};
    default:return{x:p.x,y:p.y};
  }
}

function centerOf(points){if(!points.length)return{x:0,y:0,z:0};const s=points.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y,z:a.z+p.z}),{x:0,y:0,z:0});return{x:s.x/points.length,y:s.y/points.length,z:s.z/points.length};}

export function bounds2d(points){
  if(!points.length)return{min:{x:0,y:0},max:{x:1,y:1},width:1,height:1};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  return{min:{x:minX,y:minY},max:{x:maxX,y:maxY},width:Math.max(.001,maxX-minX),height:Math.max(.001,maxY-minY)};
}

function worldBounds(parts){
  const points=parts.flatMap(item=>item.corners);
  if(!points.length)return{min:{x:0,y:0,z:0},max:{x:1,y:1,z:1}};
  let min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
  for(const p of points){for(const k of ['x','y','z']){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}}
  return{min,max};
}

export function convexHull(points){
  const pts=[...points].sort((a,b)=>a.x===b.x?a.y-b.y:a.x-b.x);
  if(pts.length<=2)return pts;
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lower=[];for(const p of pts){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
  const upper=[];for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
  lower.pop();upper.pop();return lower.concat(upper);
}


function buildDrawingTags(entities,bounds){
  const visible=(entities||[]).filter(entity=>entity.tag).slice(0,60);
  if(!visible.length)return[];
  const centerX=(bounds.min.x+bounds.max.x)/2;
  const offset=Math.max(20,bounds.width*.09);
  const groups={LEFT:[],RIGHT:[]};
  for(const entity of visible)(entity.center.x<centerX?groups.LEFT:groups.RIGHT).push(entity);
  const tags=[];
  for(const side of ['LEFT','RIGHT']){
    const list=groups[side].sort((a,b)=>b.center.y-a.center.y);
    const span=Math.max(bounds.height,Math.max(20,list.length*12));
    list.forEach((entity,index)=>{
      const y=bounds.max.y-span*(index+1)/(list.length+1);
      const x=side==='LEFT'?bounds.min.x-offset:bounds.max.x+offset;
      tags.push({partId:entity.partId,label:entity.tag,anchor:{...entity.center},labelPoint:{x,y},side});
    });
  }
  return tags;
}

function buildCenterLines(entities){
  const lines=[];
  for(const entity of entities){
    const b=entity.bounds,c=entity.center;
    const horizontal=b.width>=b.height*.75;
    const vertical=b.height>=b.width*.75;
    if(horizontal) lines.push({partId:entity.partId,axis:'H',from:{x:b.min.x,y:c.y},to:{x:b.max.x,y:c.y}});
    if(vertical) lines.push({partId:entity.partId,axis:'V',from:{x:c.x,y:b.min.y},to:{x:c.x,y:b.max.y}});
  }
  return lines;
}

function buildOverallDimensions(type,b){
  if(type===DRAWING_VIEWS.ISO)return[];
  return[
    {kind:'LINEAR',axis:'H',value:round(b.width),from:{x:b.min.x,y:b.min.y},to:{x:b.max.x,y:b.min.y},offset:-Math.max(20,b.height*.08)},
    {kind:'LINEAR',axis:'V',value:round(b.height),from:{x:b.min.x,y:b.min.y},to:{x:b.min.x,y:b.max.y},offset:-Math.max(20,b.width*.08)}
  ];
}


function buildInternalDimensions(type,b,entities){
  if(!['FRONT','BACK','LEFT','RIGHT'].includes(type)) return [];
  const levels=[];
  for(const entity of entities){
    if(entity.partType!=='PROFILE') continue;
    const eb=entity.bounds;
    if(eb.width < Math.max(20,eb.height*2.2)) continue;
    const y=entity.center.y;
    if(!levels.some(value=>Math.abs(value-y)<2)) levels.push(y);
  }
  levels.sort((a,b)=>a-b);
  if(levels.length<2||levels.length>12) return [];
  const offset=Math.max(14,b.width*.045);
  const dims=[];
  for(let i=0;i<levels.length-1;i++){
    const a=levels[i],c=levels[i+1],value=Math.abs(c-a);
    if(value<5) continue;
    dims.push({kind:'CHAIN',axis:'V',value:round(value),from:{x:b.max.x,y:a},to:{x:b.max.x,y:c},offset});
  }
  return dims;
}
function viewLabel(type){return{FRONT:'正视图',BACK:'后视图',TOP:'俯视图',BOTTOM:'仰视图',LEFT:'左视图',RIGHT:'右视图',ISO:'等轴测图'}[type]||type;}
function round(v){return Number(Number(v||0).toFixed(2));}
