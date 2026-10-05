const LABELS=Object.freeze({
  ANGLE_BRACKET:'角码连接',
  INTERNAL_CONNECTOR:'内置连接',
  ANCHOR_CONNECTOR:'锚式连接',
  CONNECTION_PLATE:'连接板',
  END_SCREW:'端面连接'
});

const STEP_TEXT=Object.freeze({
  ANGLE_BRACKET:['将角码贴合两根型材槽面','沿箭头方向装入 T 螺母和螺钉','确认角度后依次锁紧'],
  INTERNAL_CONNECTOR:['将内置连接件插入型材端部','将另一根型材槽位推入连接位置','从槽侧锁紧固定螺钉'],
  ANCHOR_CONNECTOR:['将锚式连接件装入型材端部','沿槽口方向推入目标型材','调整到位后锁紧'],
  CONNECTION_PLATE:['将连接板对准两侧安装面','按箭头方向穿入螺钉','交替锁紧两侧螺钉'],
  END_SCREW:['端面对齐并保持贴合','沿轴向穿入端面螺钉','锁紧后复查垂直度']
});

export function getConnectionInstallationSteps(connection={}){
  const type=normalizeType(connection);
  const steps=STEP_TEXT[type]||STEP_TEXT.ANGLE_BRACKET;
  return steps.map((text,index)=>({step:index+1,text}));
}

export function buildConnectionInstallationDiagram(connection={}){
  const type=normalizeType(connection);
  const source=escapeXml(connection.sourceCode||'构件 A');
  const target=escapeXml(connection.targetCode||'构件 B');
  const code=escapeXml(connection.code||'C---');
  const title=escapeXml(LABELS[type]||'连接安装');
  const sourceEnd=connection.sourceEnd==='END'?'B端':'A端';
  const targetFace=faceLabel(connection.targetFace);
  const markerKey=String(connection.code||connection.id||type).replace(/[^a-zA-Z0-9_-]/g,'');
  const installMarker=`install-arrow-${markerKey||'joint'}`;
  const screwMarker=`screw-arrow-${markerKey||'joint'}`;
  const hardware=(connection.hardware||[]).slice(0,5).map(item=>`${escapeXml(item.code||'')} ${escapeXml(item.name||'五金')}`.trim());
  const steps=getConnectionInstallationSteps({type});
  const body=diagramBody(type,source,target);
  const arrows=directionOverlay(type,installMarker,screwMarker);
  const stepText=steps.map((item,index)=>`<g transform="translate(302 ${82+index*42})"><circle cx="10" cy="-4" r="10" class="stepCircle"/><text x="10" y="0" class="stepNumber">${item.step}</text><text x="29" y="0" class="stepText">${escapeXml(item.text)}</text></g>`).join('');
  const hardwareText=hardware.length?hardware.map((item,index)=>`<text x="302" y="${244+index*16}" class="hardware">${item}</text>`).join(''):'<text x="302" y="248" class="muted">制造五金待配置</text>';
  return `<svg class="connection-installation-svg" viewBox="0 0 540 340" role="img" aria-label="${code} ${title}">
    <defs>
      <marker id="${installMarker}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" class="installArrowHead"/></marker>
      <marker id="${screwMarker}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" class="screwArrowHead"/></marker>
    </defs>
    <style>
      .panel{fill:#fbfdff;stroke:#dce6ef;stroke-width:1.2}.profile{fill:#d9e2eb;stroke:#60768b;stroke-width:2}.slot{stroke:#93a5b5;stroke-width:2}.connector{fill:#f6a23a;stroke:#b9680d;stroke-width:2}.bolt{stroke:#4f6070;stroke-width:3;stroke-linecap:round}.boltHead{fill:#4f6070}.label{font:700 11px system-ui,sans-serif;fill:#32485d}.title{font:800 14px system-ui,sans-serif;fill:#234d79}.subTitle{font:800 11px system-ui,sans-serif;fill:#3e5a73}.hardware{font:10px system-ui,sans-serif;fill:#52677a}.muted{font:10px system-ui,sans-serif;fill:#8a98a6}.meta{font:10px system-ui,sans-serif;fill:#687b8d}.guide{stroke:#d3dfeb;stroke-width:1}.installArrow{fill:none;stroke:#2e71ff;stroke-width:2.5}.screwArrow{fill:none;stroke:#e4811b;stroke-width:2.5}.installArrowHead{fill:#2e71ff}.screwArrowHead{fill:#e4811b}.stepCircle{fill:#2e71ff}.stepNumber{font:700 10px system-ui,sans-serif;fill:#fff;text-anchor:middle}.stepText{font:10px system-ui,sans-serif;fill:#40566b}.directionLabel{font:700 9px system-ui,sans-serif;fill:#2e71ff}.screwLabel{font:700 9px system-ui,sans-serif;fill:#c66d11}.zoomRing{fill:none;stroke:#ff922b;stroke-width:2;stroke-dasharray:5 4}.zoomLine{stroke:#ff922b;stroke-width:1.5}.codeBadge{fill:#eaf2ff;stroke:#bed7fb}.codeText{font:800 11px system-ui,sans-serif;fill:#245fcf;text-anchor:middle}
    </style>
    <rect x="14" y="14" width="512" height="312" rx="12" class="panel"/>
    <rect x="24" y="24" width="58" height="24" rx="7" class="codeBadge"/><text x="53" y="40" class="codeText">${code}</text>
    <text x="92" y="41" class="title">${title}</text>
    <text x="302" y="42" class="meta">${source} ${sourceEnd} → ${target} ${escapeXml(targetFace)}</text>

    <rect x="24" y="58" width="254" height="156" rx="9" class="panel"/>
    <text x="36" y="78" class="subTitle">${code} 接头局部放大</text>
    <g transform="translate(15 68) scale(.98)">${body}</g>
    <ellipse cx="157" cy="151" rx="43" ry="32" class="zoomRing"/><line x1="195" y1="128" x2="245" y2="95" class="zoomLine"/><text x="204" y="88" class="meta">当前连接区域</text>

    <rect x="24" y="224" width="254" height="92" rx="9" class="panel"/>
    <text x="36" y="244" class="subTitle">二维安装方向</text>
    <g transform="translate(38 232) scale(.58)">${body}${arrows}</g>

    <line x1="290" y1="58" x2="290" y2="316" class="guide"/>
    <text x="302" y="66" class="subTitle">安装步骤</text>
    ${stepText}
    <text x="302" y="200" class="meta">拆卸顺序：3 → 2 → 1</text>
    <line x1="302" y1="215" x2="512" y2="215" class="guide"/>
    <text x="302" y="232" class="subTitle">本接头五金</text>
    ${hardwareText}
  </svg>`;
}

function normalizeType(connection){return String(connection.type||connection.designType||'ANGLE_BRACKET').toUpperCase();}
function faceLabel(face){return ({FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'})[String(face||'FRONT').toUpperCase()]||'安装面';}

function diagramBody(type,source,target){
  if(type==='CONNECTION_PLATE')return `
    <rect x="28" y="58" width="78" height="36" rx="4" class="profile"/><rect x="150" y="58" width="78" height="36" rx="4" class="profile"/>
    <rect x="92" y="49" width="72" height="54" rx="5" class="connector"/><circle cx="108" cy="76" r="5" class="boltHead"/><circle cx="149" cy="76" r="5" class="boltHead"/>
    <text x="43" y="116" class="label">${source}</text><text x="170" y="116" class="label">${target}</text>`;
  if(type==='INTERNAL_CONNECTOR')return `
    <rect x="28" y="66" width="104" height="38" rx="4" class="profile"/><rect x="132" y="30" width="40" height="108" rx="4" class="profile"/>
    <line x1="132" y1="85" x2="172" y2="85" class="slot"/><rect x="111" y="77" width="52" height="16" rx="5" class="connector"/>
    <circle cx="149" cy="85" r="4.5" class="boltHead"/><text x="46" y="126" class="label">${source}</text><text x="183" y="72" class="label">${target}</text>`;
  if(type==='ANCHOR_CONNECTOR')return `
    <rect x="26" y="66" width="106" height="38" rx="4" class="profile"/><rect x="148" y="30" width="40" height="108" rx="4" class="profile"/>
    <line x1="148" y1="85" x2="188" y2="85" class="slot"/><path d="M123 85 L158 85 L169 74" fill="none" class="connector" stroke-width="8" stroke-linecap="round"/>
    <text x="44" y="126" class="label">${source}</text><text x="198" y="72" class="label">${target}</text>`;
  if(type==='END_SCREW')return `
    <rect x="26" y="66" width="106" height="38" rx="4" class="profile"/><rect x="148" y="30" width="40" height="108" rx="4" class="profile"/>
    <line x1="188" y1="85" x2="110" y2="85" class="bolt"/><circle cx="192" cy="85" r="7" class="boltHead"/>
    <text x="44" y="126" class="label">${source}</text><text x="198" y="72" class="label">${target}</text>`;
  return `
    <rect x="26" y="66" width="106" height="38" rx="4" class="profile"/><rect x="148" y="30" width="40" height="108" rx="4" class="profile"/>
    <path d="M128 100 L128 77 L157 77 L157 103 L143 103 L143 91 L128 91 Z" class="connector"/>
    <circle cx="136" cy="83" r="4.5" class="boltHead"/><circle cx="151" cy="94" r="4.5" class="boltHead"/>
    <text x="44" y="126" class="label">${source}</text><text x="198" y="72" class="label">${target}</text>`;
}

function directionOverlay(type,installMarker,screwMarker){
  const install=`marker-end:url(#${installMarker})`;
  const screw=`marker-end:url(#${screwMarker})`;
  if(type==='CONNECTION_PLATE')return `<path d="M128 30 L128 48" class="installArrow" style="${install}"/><text x="136" y="40" class="directionLabel">贴合</text><path d="M78 36 L107 68" class="screwArrow" style="${screw}"/><path d="M180 36 L153 68" class="screwArrow" style="${screw}"/><text x="160" y="28" class="screwLabel">螺钉插入</text>`;
  if(type==='INTERNAL_CONNECTOR')return `<path d="M86 85 L110 85" class="installArrow" style="${install}"/><text x="76" y="75" class="directionLabel">插入</text><path d="M211 85 L174 85" class="installArrow" style="${install}"/><text x="190" y="74" class="directionLabel">推入槽位</text><path d="M149 48 L149 75" class="screwArrow" style="${screw}"/><text x="157" y="56" class="screwLabel">锁紧</text>`;
  if(type==='ANCHOR_CONNECTOR')return `<path d="M88 85 L121 85" class="installArrow" style="${install}"/><text x="76" y="75" class="directionLabel">装入端部</text><path d="M216 85 L174 85" class="installArrow" style="${install}"/><text x="190" y="74" class="directionLabel">沿槽推入</text><path d="M169 48 L169 70" class="screwArrow" style="${screw}"/><text x="177" y="55" class="screwLabel">锁紧</text>`;
  if(type==='END_SCREW')return `<path d="M132 48 L146 66" class="installArrow" style="${install}"/><text x="104" y="42" class="directionLabel">端面对齐</text><path d="M224 85 L190 85" class="screwArrow" style="${screw}"/><text x="191" y="75" class="screwLabel">螺钉插入方向</text>`;
  return `<path d="M111 46 L132 74" class="installArrow" style="${install}"/><text x="76" y="41" class="directionLabel">角码贴合</text><path d="M111 113 L134 92" class="screwArrow" style="${screw}"/><path d="M196 104 L158 94" class="screwArrow" style="${screw}"/><text x="165" y="118" class="screwLabel">螺钉插入</text>`;
}

function escapeXml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));}
