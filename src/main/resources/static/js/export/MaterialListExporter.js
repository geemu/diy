/** 清单文件只格式化BomExporter的同一快照，不读Scene或推算未配置五金。 */
export function materialListSections(model,projectName='未命名工程') {
  const material=model.entries.filter(entry=>!['连接件套装','待选型连接'].includes(entry.category));
  const kits=model.entries.filter(entry=>entry.category==='连接件套装');
  const pending=model.entries.filter(entry=>entry.pending);
  const statistics=model.statistics.map(stat=>{
    const variants=model.statistics.filter(other=>other.model===stat.model);
    const label=variants.length>1?`${stat.model} · ${stat.variant} · ${stat.spec}`:stat.model;
    return [label,stat.lengthMm,stat.taps,stat.through,stat.countersinks];
  });
  const sections=[
    {title:'材料清单',header:['类别','名称','规格','型号','长度（mm）','数量','备注'],rows:material.map(entry=>[
      entry.category,entry.name,entry.spec,entry.model,entry.lengthMm==null?entry.size:round(entry.lengthMm),entry.quantity,entry.note])},
    {title:'型材统计',header:['型号','总长度（mm）','攻丝（个）','通孔（个）','沉头孔（个）'],rows:statistics},
    {title:'连接件（方案一：购买套装）',header:['类别','名称','规格','型号','数量','备注'],rows:kits.map(entry=>[
      '连接件',entry.name,entry.spec,entry.model,entry.quantity,entry.note])}
  ];
  if(pending.length)sections.push({title:'待选型连接（不计购买套装）',header:['类别','名称','规格','型号','数量','备注'],rows:pending.map(entry=>[
    entry.category,entry.name,entry.spec,entry.model,entry.quantity,entry.note])});
  if(model.virtualItems.length)sections.push({title:'虚拟构件',header:['类别','名称','规格','长度/型号','数量','单位','备注'],rows:model.virtualItems.map(entry=>[
    '虚拟构件',entry.name,entry.spec,entry.model,entry.quantity,entry.unit,entry.note])});
  const notes=[
    '说明：铝型材规格默认根据模型识别，可在清单中选配国标或欧标；选配不修改三维截面或制造配置。',
    '说明：连接件规格随相连型材读取；不一致或待核实时，购买前应核对。',
    '说明：目录连接件按独立安装侧统计套装需求，未配置螺丝/螺母不推算；已配置制造五金按明确散件列出，不重复计套装。',
    '说明：同长但截面、加工、端切或板材裁剪不同的构件分别列项；数量和加工来自当前工程。',
    '说明：这是设计材料清单，不是通过制造校验的生产图纸或已确认套装料号。'
  ];
  return {title:`${projectName} - 材料清单 - 方案一：购买套装`,notes,sections};
}

function rowsFor(document) {
  const rows=[[document.title],...document.notes.map(note=>[note]),[]];
  for(const [index,section] of document.sections.entries()){
    if(index)rows.push([],[`--- ${section.title} ---`]);
    rows.push(section.header,...section.rows);
  }
  return rows;
}

export function materialListCsv(document) {
  // 引号、换行与中文BOM沿参考文件；用户补充文字按文本写入，避免表格公式注入。
  const escape=cell=>{
    let text=String(cell??'');
    if(typeof cell==='string'&&/^\s*(?:[=+@]|-(?!-))/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+rowsFor(document).map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n';
}

/** 本地已有JSZip封装真实OOXML工作簿，不以HTML/CSV冒充xlsx，无宏/公式。 */
export async function materialListXlsx(document) {
  if(typeof JSZip==='undefined')throw new Error('未加载本地ZIP组件，仍可导出CSV');
  const zip=new JSZip(),rows=rowsFor(document),merges=[];
  const data=rows.map((row,index)=>{
    const number=index+1,heading=index===0||document.sections.some(section=>section.header===row);
    const isNote=index>0&&index<=document.notes.length,isSection=row.length===1;
    const style=index===0?1:isNote?2:heading||isSection?3:0;
    if(isSection)merges.push(`<mergeCell ref="A${number}:G${number}"/>`);
    else if(row.length===6)merges.push(`<mergeCell ref="F${number}:G${number}"/>`);
    const cells=row.map((value,column)=>{
      const ref=String.fromCharCode(65+column)+number;
      if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value??'')}</t></is></c>`;
    }).join('');
    const height=index===0?30:isNote?32:row.some(value=>String(value??'').length>90)?66:28;
    return `<row r="${number}" ht="${height}" customHeight="1">${cells}</row>`;
  }).join('');
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="材料清单" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/styles.xml','<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="12"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F5F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  zip.file('xl/worksheets/sheet1.xml',`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:G${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="28"/><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="4" width="22" customWidth="1"/><col min="5" max="6" width="16" customWidth="1"/><col min="7" max="7" width="65" customWidth="1"/></cols><sheetData>${data}</sheetData><mergeCells count="${merges.length}">${merges.join('')}</mergeCells><pageSetup orientation="landscape" paperSize="9"/></worksheet>`);
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}

function xml(value){return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function round(value){return Number(Number(value).toFixed(2));}
