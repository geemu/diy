import BomExporter from './BomExporter.js';
import {getSectionDefinition, getSectionInfo, sectionToSvg} from '../model/ProfileSectionRegistry.js';
import FactoryValidator from '../validation/FactoryValidator.js';

export default class FactoryPackageExporter {
  constructor(editor) {
    this.editor = editor;
  }

  async export() {
    if (typeof JSZip === 'undefined') throw new Error('未加载 JSZip');
    const validation = this.editor.validateForFactory();
    if (validation.errors.length) {
      const message = validation.errors.slice(0,5).map(item => `${item.subject}: ${item.message}`).join('；');
      throw new Error(`加工校验未通过：${message}${validation.errors.length > 5 ? `；另有 ${validation.errors.length - 5} 项` : ''}`);
    }

    const zip = new JSZip();
    zip.file('生产检查报告.txt',FactoryValidator.toText(validation));
    zip.file('生产检查报告.json',JSON.stringify(validation,null,2));
    zip.file('工程.json',JSON.stringify(this.editor.exportProject(),null,2));
    const bomConsistency=this.editor.bomExporter.validateConsistency();
    zip.file('BOM一致性报告.txt',BomExporter.consistencyText(bomConsistency));
    zip.file('BOM一致性报告.json',JSON.stringify(bomConsistency,null,2));
    const bomFolder=zip.folder('BOM');
    bomFolder.file('项目汇总.csv',BomExporter.fileText(this.editor.bomExporter.buildProjectSummaryRows()));
    bomFolder.file('型材BOM.csv',BomExporter.fileText(this.editor.bomExporter.buildProfileBomRows()));
    bomFolder.file('五金BOM.csv',BomExporter.fileText(this.editor.bomExporter.buildHardwareBomRows()));
    bomFolder.file('配件BOM.csv',BomExporter.fileText(this.editor.bomExporter.buildAccessoryBomRows()));
    bomFolder.file('加工BOM.csv',BomExporter.fileText(this.editor.bomExporter.buildMachiningBomRows()));
    bomFolder.file('子装配BOM.csv',BomExporter.fileText(this.editor.bomExporter.buildSubassemblyBomRows()));
    bomFolder.file('材料清单.csv',BomExporter.fileText(this.editor.bomExporter.buildMaterialRows()));
    const assemblySteps=this.editor.buildAssemblyInstructions?.()||[];
    const assemblyRows=[['步骤','步骤名称','说明','构件编号','连接编号','五金编号']];
    for(const step of assemblySteps)assemblyRows.push([step.step,step.title,step.note||'',step.parts.map(item=>item.code).join(' / '),step.connections.map(item=>item.code).join(' / '),step.hardware.map(item=>item.code).join(' / ')]);
    bomFolder.file('装配步骤.csv',BomExporter.fileText(assemblyRows));
    bomFolder.file('装配步骤.json',JSON.stringify(assemblySteps,null,2));
    zip.file('cut-list.csv',BomExporter.fileText(this.editor.bomExporter.buildCutListRows()));
    zip.file('切割汇总.csv',BomExporter.fileText(this.editor.bomExporter.buildCutSummaryRows()));
    zip.file('machining.csv',BomExporter.fileText(this.editor.bomExporter.buildMachiningDetailRows()));
    zip.file('加工分组.csv',BomExporter.fileText(this.editor.bomExporter.buildMachiningRows()));

    const assemblyDrawings = zip.folder('装配工程图');
    const drawingPayload = this.editor.engineeringDrawingService.build({appVersion:'0.75.10'});
    const drawingPaper = this.editor.drawingSettings?.paper || 'A3';
    assemblyDrawings.file(`总装工程图_${drawingPaper}.svg`,this.editor.engineeringDrawingService.svgExporter.export(drawingPayload.model,drawingPayload.layout,this.editor.drawingSettings));
    assemblyDrawings.file(`总装工程图_${drawingPaper}.dxf`,this.editor.engineeringDrawingService.dxfExporter.export(drawingPayload.model,drawingPayload.layout,this.editor.drawingSettings));
    assemblyDrawings.file('总装工程图_model.json',JSON.stringify({model:drawingPayload.model,layout:drawingPayload.layout},null,2));
    assemblyDrawings.file('DXF图层说明.json',JSON.stringify(this.editor.engineeringDrawingService.dxfExporter.layerManifest(),null,2));
    const subFolder = assemblyDrawings.folder('子装配');
    let subDrawingIndex = 1;
    for (const sheet of this.editor.engineeringDrawingService.buildSubassemblySheets({appVersion:'0.75.10'})) {
      const prefix = String(subDrawingIndex++).padStart(2,'0');
      const subBase=`${prefix}_${this.safeName(sheet.name)}_${String(sheet.assemblyId).slice(0,6)}`;
      subFolder.file(`${subBase}.svg`,sheet.svg);
      subFolder.file(`${subBase}.dxf`,sheet.dxf);
    }

    const machiningSvg = zip.folder('SVG加工图');
    const machiningDxf = zip.folder('DXF加工图');
    for (const drawing of this.editor.drawingGenerator.buildMachiningDrawings()) {
      const base = this.safeName(`${drawing.drawingId}_${drawing.profile}_${drawing.length}`);
      machiningSvg.file(`${base}.svg`,this.editor.drawingGenerator.exportSvg(drawing));
      machiningDxf.file(`${base}.dxf`,this.editor.dxfExporter.buildDrawing(drawing));
    }

    const bendSvg = zip.folder('SVG弯曲图');
    const bendDxf = zip.folder('DXF弯曲图');
    for (const drawing of this.editor.drawingGenerator.buildBendDrawings()) {
      const base = this.safeName(`${drawing.drawingId}_${drawing.profile}_R${drawing.radius}_${drawing.angleDeg}deg`);
      bendSvg.file(`${base}.svg`,this.editor.drawingGenerator.exportBendSvg(drawing));
      bendDxf.file(`${base}.dxf`,this.editor.dxfExporter.buildBendDrawing(drawing));
    }

    const cutSvg = zip.folder('SVG斜切图');
    const cutDxf = zip.folder('DXF斜切图');
    for (const drawing of this.editor.drawingGenerator.buildCutDrawings()) {
      const base = this.safeName(`${drawing.drawingId}_${drawing.profile}_L${drawing.length}`);
      cutSvg.file(`${base}.svg`,this.editor.drawingGenerator.exportCutSvg(drawing));
      cutDxf.file(`${base}.dxf`,this.editor.dxfExporter.buildCutDrawing(drawing));
    }

    this.addSectionFiles(zip);
    zip.file('README.txt',this.readme());

    const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '铝型材加工包.zip';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  addSectionFiles(zip) {
    const root = zip.folder('截面定义');
    const jsonFolder = root.folder('JSON');
    const svgFolder = root.folder('SVG预览');
    const dxfFolder = root.folder('DXF原图');
    const rows = [['截面型号','目录ID','来源','精度标记','识别宽度(mm)','识别高度(mm)','备注']];
    const usedCatalogIds = [...new Set(this.editor.parts
      .filter(part => part.type === 'PROFILE')
      .map(part => part.designProfile?.profileId)
      .filter(Boolean))];

    for (const catalogId of usedCatalogIds) {
      const section = getSectionDefinition(catalogId);
      const info = getSectionInfo(catalogId);
      if (!section || !info) continue;
      const variant = this.editor.parts.find(part => part.designProfile?.profileId === catalogId)?.name || catalogId;
      const base = this.safeName(`${variant}_${catalogId}`);
      const jsonSection = structuredClone(section);
      delete jsonSection.sourceText;
      jsonFolder.file(`${base}.json`,JSON.stringify(jsonSection,null,2));
      svgFolder.file(`${base}.svg`,sectionToSvg(section));
      if (section.sourceType === 'DXF_IMPORTED' && section.sourceText) dxfFolder.file(`${base}.dxf`,section.sourceText);
      rows.push([
        variant,
        catalogId,
        info.sourceName,
        info.accuracy,
        Number(info.width.toFixed(3)),
        Number(info.height.toFixed(3)),
        section.note || ''
      ]);
    }
    root.file('截面清单.csv',BomExporter.fileText(rows));
  }

  readme() {
    return [
      '铝型材工厂加工包',
      '',
      '单位：mm。型材局部Z轴为长度方向；A端=START=local Z-，B端=END=local Z+。',
      '本版本设计阶段只保存截面与连接语义；真实材料型号请在制造配置阶段选择。',
      '截面定义/ 中保存本工程实际使用的截面几何；若该 SKU 已绑定自定义 DXF，DXF原图/ 会保留原文件。',
      '“BUILT_IN_REFERENCE / REFERENCE” 只表示编辑器内置参考截面，用于视觉区分和建模预览，不应作为工厂精确截面依据。',
      '“DXF_IMPORTED / SOURCE_DXF” 表示几何直接来自用户绑定的 DXF；仍应核对 DXF 单位、版本和实际料号。',
      '弯型材图纸给出中心线半径、角度、弯曲平面、展开长度、弦长和拱高。',
      '直型材端部斜切会输出 SVG斜切图/ 与 DXF斜切图/，0° 表示方切。',
      'BOM/ 下提供项目汇总、型材、五金、配件、加工、子装配 BOM 与装配步骤；所有行均使用统一制造编号追溯到三维构件。',
      'cut-list.csv 按每一根实际型材输出切割/展开长度和 A/B 端切信息；machining.csv 按每一个实际加工 Feature 输出。',
      '本项目不管理 3m/4m/6m 原料长度、锯缝排料、余料库存或采购库存；这些能力不属于当前产品范围。',
      '弯型材最小半径、截面变形、槽口朝向和回弹补偿必须由加工厂结合具体截面确认。',
      '弯型材加工统一使用沿中心线的 S 坐标，并明确区分 BEND_BEFORE（弯前）与 BEND_AFTER（弯后）工序。',
      'BEND_AFTER 弯后加工必须结合弯后空间姿态和夹具复核；软件给出的 S 坐标只作为中心线工艺基准。',
      '参数化连接会派生角码/内置件/锚式件/连接板及螺钉、T螺母、垫片到 五金BOM.csv；槽位引用使用型材目录 slotId。',
      '加工数据采用统一 MachiningFeature 模型，可表达孔/攻丝/沉头、槽/腰孔、铣削区域和端面加工；阵列与镜像仍输出可追溯的加工实例。',
      '加工基准支持 A/B端、面中心与槽中心；SLOT_CENTER 基准使用型材目录 slotId，切换其他基准时不会继续携带旧槽引用。',
      '加工碰撞检查目前基于特征正交包络/足迹做快速生产门禁；复杂轮廓、刀具路径和真实夹具干涉仍需加工端复核。',
      '构件碰撞检查对直型材使用 OBB-SAT 体积穿透判定；正常端面接触不视为碰撞。弯型材和复杂附件暂不宣称完成精确实体布尔碰撞。',
      '端点与其他型材几何接触但没有连接件或启用约束时会给出连接完整性 WARNING，并可在编辑器中直接定位相关构件。',
      '装配工程图/ 使用 工程图模型 统一生成正视、俯视、左/右视和等轴测二维投影，包含统一构件编号引线标记、A3/A4 图框、标题栏与总体尺寸；SVG 与 DXF 使用同一 工程图模型/版面。',
      '总装/子装配 DXF 为毫米工程图纸坐标，按 PROFILE、CENTER、DIMENSION、TEXT、TITLEBLOCK、VIEW、HIDDEN 图层组织，可在 CAD 中继续编辑。',
      '连接件的参数化几何用于设计和BOM联动；具体采购 SKU、孔距、开口和加工要求仍需按实际实物/图纸确认。',
      '生产前请先查看 生产检查报告.txt；报告覆盖加工、直型材体积碰撞、连接完整性、装配、BOM 与约束；ERROR 会阻止导出，WARNING 仍需人工确认。',
      '生产前请再次核对实际截面图/DXF、壁厚、槽宽、材质、数量及加工方向。',
      ''
    ].join('\n');
  }

  safeName(value) {
    return String(value).replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_');
  }
}
