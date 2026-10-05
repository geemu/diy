import {buildConnectionInstallationDiagram} from './ConnectionInstallationDiagram.js';

/** 生成可直接打印的装配说明书 HTML。只消费现有装配步骤，不建立第二套装配数据。 */
export function buildAssemblyGuidePrintHtml(steps=[],options={}){
  const title=escapeHtml(options.projectName||'铝型材装配说明');
  const version=escapeHtml(options.appVersion||'');
  const pages=(steps||[]).map(step=>buildStepPage(step)).join('\n');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${title} · 装配说明</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#24384a;font:14px/1.55 system-ui,-apple-system,"Microsoft YaHei",sans-serif}.book{max-width:960px;margin:24px auto}.cover,.step-page{background:#fff;border:1px solid #d9e1e8;border-radius:16px;box-shadow:0 10px 32px rgba(37,56,75,.08);padding:28px;margin:0 0 20px}.cover h1{margin:0 0 10px;font-size:28px}.cover p{margin:4px 0;color:#6c7b89}.step-head{display:flex;align-items:flex-start;gap:16px;border-bottom:1px solid #e4eaf0;padding-bottom:16px;margin-bottom:18px}.step-no{width:56px;height:56px;border-radius:16px;background:#2e71ff;color:#fff;display:grid;place-items:center;font-size:22px;font-weight:800}.step-head h2{margin:0 0 4px;font-size:22px}.muted{color:#7b8a97}.prereq{display:inline-flex;padding:4px 9px;border-radius:999px;background:#fff5e8;color:#9b5b10;font-weight:700}.section-title{font-weight:800;margin:18px 0 8px}.chips{display:flex;flex-wrap:wrap;gap:7px}.chip{padding:6px 9px;border-radius:8px;background:#f4f7fa;border:1px solid #dfe6ed}.connections{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}.connection{border:1px solid #dfe6ed;border-radius:12px;padding:12px;break-inside:avoid}.connection h3{margin:0 0 6px;font-size:15px}.connection svg{width:100%;height:auto;display:block}.hardware{margin:8px 0 0;padding-left:20px}.empty{padding:16px;border:1px dashed #ccd7e2;border-radius:10px;color:#7b8a97}@media print{body{background:#fff}.book{max-width:none;margin:0}.cover,.step-page{border:0;box-shadow:none;border-radius:0;margin:0;padding:12mm}.cover{page-break-after:always}.step-page{page-break-after:always;min-height:270mm}.step-page:last-child{page-break-after:auto}.no-print{display:none!important}}@page{size:A4 portrait;margin:10mm}
  </style></head><body><main class="book"><section class="cover"><h1>${title}</h1><p>装配说明书</p><p>${steps.length} 个装配步骤${version?` · 版本 ${version}`:''}</p><p>构件编号、连接编号、接头局部放大、二维安装方向和五金均来自当前工程数据。</p></section>${pages||'<section class="step-page"><div class="empty">当前工程暂无装配步骤。</div></section>'}</main></body></html>`;
}

function buildStepPage(step){
  const parts=(step.parts||[]).map(item=>`<span class="chip">${escapeHtml(item.code)} · ${escapeHtml(item.name)}</span>`).join('');
  const hardware=(step.hardware||[]).map(item=>`<span class="chip">${escapeHtml(item.code)} · ${escapeHtml(item.name)}</span>`).join('');
  const connections=(step.connections||[]).map(connection=>`<article class="connection"><h3>${escapeHtml(connection.code)} · ${escapeHtml(connection.sourceCode)} ↔ ${escapeHtml(connection.targetCode)}</h3>${buildConnectionInstallationDiagram(connection)}</article>`).join('');
  const prerequisite=(step.prerequisiteSteps||[]).length?`<span class="prereq">前置步骤：${step.prerequisiteSteps.map(item=>String(item).padStart(2,'0')).join('、')}</span>`:'';
  return `<section class="step-page"><header class="step-head"><div class="step-no">${String(step.step||0).padStart(2,'0')}</div><div><h2>${escapeHtml(step.title||'装配步骤')}</h2>${step.note?`<div class="muted">${escapeHtml(step.note)}</div>`:''}${prerequisite}</div></header><div class="section-title">本步构件</div><div class="chips">${parts||'<span class="muted">无主体构件</span>'}</div><div class="section-title">连接安装</div>${connections?`<div class="connections">${connections}</div>`:'<div class="empty">本步骤没有新增连接。</div>'}<div class="section-title">本步五金</div><div class="chips">${hardware||'<span class="muted">无独立五金或制造五金待配置</span>'}</div></section>`;
}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
