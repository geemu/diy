import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const staticDir = path.join(root, 'src/main/resources/static');
const html = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(staticDir, 'js/app.js'), 'utf8');
const editor = fs.readFileSync(path.join(staticDir, 'js/core/Editor.js'), 'utf8');
const scene = fs.readFileSync(path.join(staticDir, 'js/core/SceneManager.js'), 'utf8');
const snap = fs.readFileSync(path.join(staticDir, 'js/snap/SnapManager.js'), 'utf8');
const css = fs.readFileSync(path.join(staticDir, 'css/app.css'), 'utf8');

const requiredUiText = [
  '型材', '光轴', '板材', '生成器', '连接', '加工', '工程',
  '成组抽屉', '立体框架', '线性阵列', '镜像', '圆周阵列', '配件库',
  '制造汇总', '工程树', '自动保存', '导出加工包', '正交', '吸附', '网格', '测量', '框选', '自由选择', '局部', '自定义型材', '保存到数据库'
];
const requiredAppMethods = [
  'startProfileDrag', 'dropAsset', 'addShaft', 'addPanel', 'generateFrame',
  'generateDrawers', 'smartConnect', 'toggleProjection', 'runFactoryValidation',
  'exportFactoryPackage', 'capturePng', 'duplicateArray', 'groupSelection', 'toggleMeasure', 'restoreAutosave',
  'mirrorSelection', 'circularArray', 'addHardware', 'toggleBoxSelect', 'toggleLassoSelect', 'toggleTransformSpace', 'toggleWorkPlane', 'loadDatabaseProfiles', 'saveCustomProfile', 'profileThumbSvg'
];
const requiredEditorMethods = [
  'addProfile', 'addShaft', 'addPanel', 'addAccessory', 'addFrame', 'addDrawerGroup',
  'duplicateArray', 'groupSelection', 'setMeasureMode', 'updateSelectedEndCuts',
  'addHardware', 'mirrorSelected', 'circularArray', 'cycleSnapCandidate', 'setMarqueeMode'
];
const requiredSceneCapabilities = [
  'OrthographicCamera', 'PerspectiveCamera', 'worldPointOnGround', 'capturePng',
  'setProjection', 'setView', 'setSelection', 'setSelections', 'pickHit', 'showMeasurement',
  'pickInScreenRect', 'pickInScreenPolygon', 'setMarqueeMode', 'setLassoMode', 'pickRoots', 'setTransformSpace', 'setHover', 'updateCameraTween'
];
const requiredSnapCapabilities = [
  'END_TO_SLOT', 'END_TO_FACE', 'END_TO_END', 'targetFace', 'sourceEnd', 'candidateCount', 'cycleCandidate'
];
const requiredCss = [
  '.tool-rail', '.library-panel', '.canvas-shell', '.inspector-panel', '.view-cube',
  '.canvas-bottom-bar', '.context-menu', '.project-tree', '.measure-hud', '.scene-marquee', '.hardware-list', '.bom-summary-card', '.profile-section-thumb', '.profile-catalog-modal', '.scene-hover-label', '.scene-lasso', '.feature-hover-hud'
];

const missing = [];
for (const text of requiredUiText) if (!html.includes(text)) missing.push(`ui:${text}`);
for (const name of requiredAppMethods) {
  const functionPattern = new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=)`);
  if (!functionPattern.test(app)) missing.push(`app:${name}`);
}
for (const name of requiredEditorMethods) if (!editor.includes(`${name}(`)) missing.push(`editor:${name}`);
for (const name of requiredSceneCapabilities) if (!scene.includes(name)) missing.push(`scene:${name}`);
for (const name of requiredSnapCapabilities) if (!snap.includes(name)) missing.push(`snap:${name}`);
for (const name of requiredCss) if (!css.includes(name)) missing.push(`css:${name}`);

const result = {
  ok: missing.length === 0,
  missing,
  uiModules: requiredUiText.length,
  appMethods: requiredAppMethods.length,
  editorCapabilities: requiredEditorMethods.length,
  sceneCapabilities: requiredSceneCapabilities.length,
  snapCapabilities: requiredSnapCapabilities.length
};
console.log(JSON.stringify(result, null, 2));
if (missing.length) process.exit(1);
