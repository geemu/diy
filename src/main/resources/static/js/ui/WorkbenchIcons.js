/** 本地线框图标共用尺寸与笔画；只接受固定键，不将用户数据拼入 SVG。 */
const paths={
  build:'<rect x="4" y="3" width="16" height="18"/><path d="M4 9h16M4 15h16M9 3v18M15 3v18"/>',
  batch:'<rect x="8" y="8" width="13" height="13"/><path d="M16 8V3H3v13h5"/>',
  connection:'<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  clearConnection:'<path d="m3 3 18 18M8 15l-1 1a4 4 0 0 1-6-6l4-4m8 3 1-1a4 4 0 0 1 6 6l-3 3"/>',
  drawer:'<path d="M3 4h18v16H3Zm0 5h18M3 15h18M9 6h6M9 12h6M9 18h6"/>',
  panelAdd:'<rect x="3" y="3" width="13" height="18" rx="1"/><path d="M16 12h7m-3.5-3.5v7"/>',
  shaftSmart:'<path d="m4 18 12-12m-9 9 3 3m3-9 3 3M2 16l6 6M14 4l6 6m-1-8 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"/>',
  dimension:'<path d="M4 3v18M20 3v18M4 12h16M8 9l-4 3 4 3m8-6 4 3-4 3"/>',
  mirror:'<path d="M12 2v20M3 6l6 6-6 6Zm18 0-6 6 6 6Z"/>',
  hide:'<path d="m3 3 18 18M10 5a12 12 0 0 1 11 7 15 15 0 0 1-3 4M6 6a15 15 0 0 0-5 6c3 6 9 8 15 5"/>',
  show:'<path d="M1 12C6 3 18 3 23 12c-5 9-17 9-22 0Z"/><circle cx="12" cy="12" r="3"/>',
  stretch:'<rect x="7" y="7" width="10" height="10"/><path d="m3 8 5-5M3 3h5M3 3v5m13 13 5-5m-5 5h5m0 0v-5"/>',
  align:'<path d="M12 2v20M2 7h8v5H2Zm12 5h8v5h-8Z"/>',
  reset:'<path d="m3 11 9-8 9 8M6 9v12h12V9m-8 12v-7h4v7"/>',
  group:'<rect x="3" y="3" width="18" height="18"/><rect x="8" y="8" width="8" height="8"/>',
  check:'<path d="m4 12 5 7L20 4"/>',
  measure:'<path d="m3 8 18 8M7 7l-2 5m8-3-2 5m8-3-2 5"/>',
  fit:'<path d="M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4M1 12h22M12 1v22"/>',
  profile:'<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M3 7l9 5m0 0v10"/>',
  shaft:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5"/>',
  panel:'<rect x="3" y="3" width="18" height="18" rx="1"/>',
  accessory:'<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M3 7l9 5m0 0v10M8 4l9 5v5"/>',
  machining:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/>',
  select:'<path d="m4 3 5 17 3-7 7-3Z"/>',
  draw:'<path d="m4 15 11-11 5 5L9 20l-6 1Zm9-9 5 5"/>',
  move:'<path d="M2 12h20m-5-5 5 5-5 5M7 7l-5 5 5 5"/>',
  rotate:'<path d="M20 7V2m0 5h-5m5 0a9 9 0 1 0 1 9"/>',
  delete:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'
};
export function workbenchIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.profile}</svg>`;
}
