/**
 * Profile Catalog 2.0 的可视化截面模板。
 *
 * 这里输出的仍然是统一 Section Model：outer + holes。3D 建模、SVG、DXF 等后续链路只消费
 * Section Model，不需要知道截面是由表单模板、数据库 JSON 还是 DXF 导入得到的。
 */
export const ProfileSectionTemplateOptions = Object.freeze([
  {value:'T_SLOT',label:'工业铝型材 / T 槽参考'},
  {value:'RECT_TUBE',label:'矩形管 / 方管'},
  {value:'ROUND_TUBE',label:'圆管'},
  {value:'SOLID_RECT',label:'矩形实心材'},
  {value:'SOLID_ROUND',label:'圆形实心材'},
  {value:'CHAMFER_RECT',label:'倒角异型材'},
  {value:'CUSTOM_JSON',label:'高级：自定义 Section JSON'}
]);

/**
 * 根据可视化表单生成统一截面数据。
 *
 * @param {object} form Profile Catalog 编辑表单
 * @returns {object|null} Section Model；T 槽等模板会直接生成可预览截面
 */
export function buildSectionFromEditor(form) {
  const template=String(form?.sectionTemplate||'T_SLOT').toUpperCase();
  const width=positive(form?.width,'截面宽度');
  const height=template==='ROUND_TUBE'||template==='SOLID_ROUND' ? width : positive(form?.height,'截面高度');
  const wallThickness=positive(form?.defaultWallThickness,'默认壁厚');
  const slotWidth=Math.max(0.1,Number(form?.slotWidth||8));
  const centerHoleDiameter=Math.max(0,Number(form?.centerHoleDiameter||0));
  const chamfer=Math.max(0,Number(form?.cornerChamfer||0));

  if(template==='CUSTOM_JSON') {
    const text=String(form?.sectionJson||'').trim();
    if(!text)return null;
    let parsed;
    try { parsed=JSON.parse(text); }
    catch { throw new Error('真实截面 JSON 格式无效'); }
    if(!parsed?.outer?.length||parsed.outer.length<3)throw new Error('真实截面 JSON 缺少 outer 轮廓');
    return {
      ...parsed,
      editor:{...(parsed.editor||{}),template:'CUSTOM_JSON'}
    };
  }

  let outer=[];
  let holes=[];
  if(template==='RECT_TUBE') {
    ensureWallFits(width,height,wallThickness);
    outer=rectangleRing(width,height);
    holes=[rectangleRing(width-wallThickness*2,height-wallThickness*2).reverse()];
  } else if(template==='ROUND_TUBE') {
    ensureWallFits(width,width,wallThickness);
    outer=circleRing(width/2,64);
    holes=[circleRing(width/2-wallThickness,56).reverse()];
  } else if(template==='SOLID_RECT') {
    outer=rectangleRing(width,height);
  } else if(template==='SOLID_ROUND') {
    outer=circleRing(width/2,64);
  } else if(template==='CHAMFER_RECT') {
    const safeChamfer=Math.min(chamfer,width/2-0.1,height/2-0.1);
    outer=chamferedRectangleRing(width,height,Math.max(0,safeChamfer));
    if(centerHoleDiameter>0)holes.push(circleRing(centerHoleDiameter/2,40).reverse());
  } else {
    outer=tSlotOuter(width,height,slotWidth);
    if(centerHoleDiameter>0)holes.push(circleRing(centerHoleDiameter/2,40).reverse());
  }

  return {
    id:`EDITOR-${String(form?.id||'PROFILE')}`,
    catalogId:String(form?.id||''),
    name:`${String(form?.variant||'自定义型材')} 可视化截面`,
    sourceType:'VISUAL_SECTION_EDITOR',
    sourceName:'Profile Catalog 2.0 可视化截面编辑器',
    accuracy:'CATALOG',
    referenceOnly:template==='T_SLOT',
    outer,
    holes,
    editor:{
      template,
      wallThickness,
      slotWidth,
      centerHoleDiameter,
      cornerChamfer:chamfer
    }
  };
}

/**
 * 从已保存 section 恢复可视化编辑参数。老数据没有 editor 元数据时继续按 DATABASE_CUSTOM 处理。
 */
export function readSectionEditorState(section,crossSectionStyle='') {
  const editor=section?.editor||{};
  const style=String(crossSectionStyle||'').toUpperCase();
  const template=String(editor.template||styleToTemplate(style)||'T_SLOT').toUpperCase();
  return {
    sectionTemplate:template,
    centerHoleDiameter:Number(editor.centerHoleDiameter||0),
    cornerChamfer:Number(editor.cornerChamfer||0),
    sectionJson:template==='CUSTOM_JSON'&&section ? JSON.stringify(section,null,2) : ''
  };
}

export function sectionStyleForTemplate(template) {
  const value=String(template||'T_SLOT').toUpperCase();
  return `DATABASE_${value}`;
}

function styleToTemplate(style) {
  if(!style)return '';
  return style.startsWith('DATABASE_') ? style.substring('DATABASE_'.length) : style;
}

function tSlotOuter(width,height,slotWidth) {
  const halfWidth=width/2;
  const halfHeight=height/2;
  const halfSlot=Math.min(slotWidth/2,Math.min(halfWidth,halfHeight)*0.45);
  const slotDepth=Math.max(1.4,Math.min(Math.min(width,height)*0.17,5));
  return [
    point(-halfWidth,-halfHeight),point(-halfSlot,-halfHeight),point(-halfSlot,-halfHeight+slotDepth),point(halfSlot,-halfHeight+slotDepth),point(halfSlot,-halfHeight),point(halfWidth,-halfHeight),
    point(halfWidth,-halfSlot),point(halfWidth-slotDepth,-halfSlot),point(halfWidth-slotDepth,halfSlot),point(halfWidth,halfSlot),point(halfWidth,halfHeight),
    point(halfSlot,halfHeight),point(halfSlot,halfHeight-slotDepth),point(-halfSlot,halfHeight-slotDepth),point(-halfSlot,halfHeight),point(-halfWidth,halfHeight),
    point(-halfWidth,halfSlot),point(-halfWidth+slotDepth,halfSlot),point(-halfWidth+slotDepth,-halfSlot),point(-halfWidth,-halfSlot)
  ];
}

function rectangleRing(width,height) {
  const halfWidth=width/2;
  const halfHeight=height/2;
  return [point(-halfWidth,-halfHeight),point(halfWidth,-halfHeight),point(halfWidth,halfHeight),point(-halfWidth,halfHeight)];
}

function chamferedRectangleRing(width,height,chamfer) {
  const halfWidth=width/2;
  const halfHeight=height/2;
  if(chamfer<=0)return rectangleRing(width,height);
  return [
    point(-halfWidth+chamfer,-halfHeight),point(halfWidth-chamfer,-halfHeight),point(halfWidth,-halfHeight+chamfer),
    point(halfWidth,halfHeight-chamfer),point(halfWidth-chamfer,halfHeight),point(-halfWidth+chamfer,halfHeight),
    point(-halfWidth,halfHeight-chamfer),point(-halfWidth,-halfHeight+chamfer)
  ];
}

function circleRing(radius,segments) {
  const points=[];
  for(let index=0;index<segments;index++) {
    const angle=index/segments*Math.PI*2;
    points.push(point(Math.cos(angle)*radius,Math.sin(angle)*radius));
  }
  return points;
}

function ensureWallFits(width,height,wallThickness) {
  if(wallThickness*2>=Math.min(width,height)) {
    throw new Error('壁厚必须小于截面最小尺寸的一半');
  }
}

function positive(value,name) {
  const number=Number(value);
  if(!Number.isFinite(number)||number<=0)throw new Error(`${name}必须大于 0`);
  return number;
}

function point(x,y) {
  return {x:Number(x),y:Number(y)};
}
