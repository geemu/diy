import {getDiyTemplate} from './DiyTemplateCatalog.js';

/**
 * DIY 模板到 Editor 领域操作的适配层。
 *
 * 这里不直接创建 Mesh，也不直接修改 parts/connections 数组；所有实体仍交给 Editor 创建，
 * 以保证 Undo、BOM、工程图和 Project JSON 继续消费同一套业务模型。
 */
export default class DiyGenerator {
  constructor(editor) {
    this.editor = editor;
  }

  generate(templateId, input = {}) {
    const template = getDiyTemplate(templateId);
    if (!template) throw new Error(`未知快速设计模板：${templateId}`);

    const parameters = normalizeParameters(template, input);
    const beforePartCount = this.editor.parts.length;
    let assemblyId = null;

    if (template.generator === 'FRAME') {
      assemblyId = this.editor.addFrame({
        ...parameters,
        name:template.label,
        captureHistory:false
      });
    } else if (template.generator === 'LAYERED_RACK') {
      assemblyId = this.editor.addLayeredRack({
        ...parameters,
        name:template.label,
        captureHistory:false
      });
    } else {
      throw new Error(`暂不支持模板生成器：${template.generator}`);
    }

    const createdParts = this.editor.parts.slice(beforePartCount).filter(part => !part.generatedByConnectionId);
    const createdProfileIds = createdParts.filter(part => part.type === 'PROFILE').map(part => part.id);
    const autoConnection = parameters.autoConnect !== false && this.editor.autoConnectProfiles
      ? this.editor.autoConnectProfiles(createdProfileIds,{source:'DIY_TEMPLATE'})
      : {status:'SKIPPED',createdCount:0,existingCount:0,failureCount:0,created:[],existing:[],failures:[]};
    this.editor.historyManager?.capture();
    this.editor.emitProjectChanged?.();

    return {
      template,
      parameters,
      assemblyId,
      createdPartCount:createdParts.length,
      createdProfileIds,
      autoConnection
    };
  }
}

function normalizeParameters(template, input) {
  const defaults = template.defaults || {};
  const width = positiveNumber(input.width, defaults.width, '宽度');
  const depth = positiveNumber(input.depth, defaults.depth, '深度');
  const height = positiveNumber(input.height, defaults.height, '高度');
  const levels = integerInRange(input.levels, defaults.levels, 2, 12, '层数');
  const centerBeamCount = integerInRange(input.centerBeamCount, defaults.centerBeamCount, 0, 4, '中间承托梁数量');
  const catalogId = String(input.catalogId || '').trim();
  if (!catalogId) throw new Error('请选择设计型材截面');

  const autoConnect = input.autoConnect !== false;
  return {catalogId, width, depth, height, levels, centerBeamCount, autoConnect};
}

function positiveNumber(value, fallback, label) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label}必须大于 0`);
  return number;
}

function integerInRange(value, fallback, min, max, label) {
  const number = Math.round(Number(value ?? fallback));
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label}必须在 ${min}~${max} 之间`);
  }
  return number;
}
