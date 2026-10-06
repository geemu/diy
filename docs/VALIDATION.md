# Validation / Regression — v0.75.2

## v0.75.2 当前检查范围

2026-10-06：144 个 JS/MJS 语法检查、43 个 verify 回归全部通过；JDK 21.0.11 Maven -o clean test 成功，1 项测试、0 失败、0 错误。随后 process-resources 更新最终窄屏 CSS；Schema 62 不变。

- verify-workbench-footer-v0752 检查 viewport 在 canvas-stage 中、主工具/快捷旋转/状态栏在独立 footer 中、组件拖放只作用于 stage、旧 toolbar 坐标不再恢复、View Cube 位置保留，以及 ResizeObserver 创建/清理。原 v051 契约同步为主工具条停靠，不再要求可拖动。
- Chrome 1600×1000 实测画布高度 866 px，底栏从 Y=914 到 1000、高度 86 px；实际 WebGL canvas 和 stage 完全一致，画布下边缘与底栏上边缘 gap=0。没有用视觉遮挡充当占位。
- 实测 1920 / 1360 / 1000 / 900 / 700 px 窗宽，空白、绘制和选择后状态下可见底栏按钮均位于底栏内，无页面横向溢出；底栏换行会自动更新 WebGL 尺寸，未改变模型单位/坐标。关闭的 details 菜单不作为可见按钮统计。
- 独立 900×700 / DPR 2 浏览器注入旧 toolbar 浮动坐标与 View Cube 位置：主工具条无 inline left/top 或 layout-custom-position，View Cube 保留自定义位置。绘制时底栏高 112 px、操作提示可见，WebGL 像素尺寸匹配实际画布；Esc 清理未完成段，无工程构件提交。
- 实际通过底栏确认 500 mm 型材，完成后退出 FREE、保留 1 根构件；快捷旋转位于 footer 内并可用。更多菜单向上展开且处于窗口内，点击测量启动真实工具并自动收起菜单。
- 测试使用独立浏览器工程，不修改用户主 Chrome；应用 pageerror=[]。截图 v0752-workbench-footer.png、v0752-footer-narrow-drawing-dpr2.png、v0752-footer-selected-dpr2.png 位于本轮 Codex visualizations 目录。

## v0.75.1 当前检查范围

2026-10-06：143 个 JS/MJS node --check、42 个 verify 回归全部通过；JDK 21.0.11 Maven -o clean test 成功，1 项测试、0 失败、0 错误。Schema 62 不变。验证在独立 Chrome 工程进行，不修改用户主浏览器工程。

- verify-profile-selector-v075 增加 11 个已核实型号 × 4 个侧面 = 44 个几何/槽位用例。封闭侧必须真实射线命中外壁且没有槽位，开放侧保留槽位；参考孔位于外轮廓内。包括 2020A/B、3030A/B/H/T、3060A/B、4040F/H/T。A/B 外轮廓不能相同，批量 B→A 清除旧默认封面但保留额外手工封边；预览朝向露出封面。
- 独立浏览器实际复看标准 3030、3030A/B/H/T/R、2020A/B、4040F/H/T 的预览和封面提示，几何差异可见；4040F 四面开槽、4040H 上下封闭、4040T 三侧封闭。截面为参考级，未对全部型号做制造精度验证。
- 实际绘制 500 mm 的 3030A 与 4040T，工程保留具体 ID/默认封面。勾选连续添加后确认仍在 FREE；点击取消当前段清除当前起点并保留已完成构件；主工具条结束后 active=false、draw-hud 数量=0。A→B→A 属性切换不残留 RIGHT，保存 JSON / 加载恢复 A 与其默认 BACK。
- 启动/新建空白的相机归一化方向为 (0,0.70710678,0.70710678)，没有右向偏移；小房子和适配原有三维语义不变。静态真实 setView 方法亦验证观察距离为 3000。
- 1600×1000 下绘制工具栏高 48 px，唯一 draw-hud 处于该工具栏内且 position=static，没有独立大卡片。900×700 / DPR 2 下工具条 312×48 px，处于画布内，结束文字可见；Esc 一次退出并移除绘制行。
- 应用 pageerror 为 0；仅有原有 favicon.ico 404，不将此表述为 console 全部无错误。预览截图 v0751-preview-*.png、v0751-compact-drawing-bar.png、v0751-compact-drawing-narrow-dpr2.png 位于本轮 Codex visualizations 目录。
- 官方 PDF 通过下载/Poppler 渲染逐页只读检查；封闭面依据和局部方向转换见 reference/profile-section-review-2026-10-06-v0751.md。未改数据库/DXF 精确 section，不自动完成制造配置，不宣称专有模型或目录所有型号已经精确复刻。

## v0.75.0 当前检查范围

2026-10-06：143 个 JS/MJS 语法检查、42 个 verify 回归；JDK 21.0.11 Maven clean test 成功，1 项测试、0 失败、0 错误。Schema 62 不变。

- 新 verify-profile-selector-v075 检查 20 个外尺寸组、42 个内置可选设计几何、3030 二级型号、尺寸切换重置、同项不重复提交、具体型号参考内腔差异与封边轮廓、槽位单一来源、制造属性隔离、真实几何有限性及 Schema JSON 往返。动态目录按尺寸归组，数据库 section 优先，显式无槽不提供虚构槽位。标准 DesignProfileList 仍为 23 项。
- Chrome 8081 独立窗口实际选择 3030 → 3030A，预览标题/槽宽跟随；画布绘制 500 mm，完成退出 FREE，属性显示 EU30-3030A。属性切换 3030B 保持长度；exportProject → JSON 序列化 → loadProject 实际恢复具体 ID/长度，manufacturingProfile=null。
- 实际改选 4040 后二级回到标准 4040，显示该组已有 F/H/T/R 等项，无残留 3030A；未完成段切换为 4040F，在规格框聚焦时 Esc 退出，原已完成构件保留，无额外构件提交。
- 初次进入、新建空白、切到正面再点小房子，归一化方向均恢复 (0.6164,0.4900,0.6164)；正面方向为 (0,0,1)。同时可见上/前/右，不强制覆盖用户后续手动操作。
- 连接、光轴、板材、配件实际切换后均有级联选择和一个三维预览；未增改其目录定义。当前 browser pageerror/console error=[]。v075-profile-family-selector.png 和 v075-model-draw-and-axis-direction.png 位于当前 Codex visualizations 目录。
- 3030N1 没有现存目录/截面；不宣称已支持。型号的内置参考截面不是制造精确图档，生产仍须实际截面与制造配置。所有浏览器测试使用独立工程，不修改用户主 Chrome 中的工程。

## v0.74.0 当前检查范围

2026-10-06：141 个 JS/MJS 语法检查、41 个 verify 回归；JDK 21 Maven clean test 成功，1 项测试、0 失败、0 错误。Schema 62 不变。

- 新 verify-viewport-presentation-v074 使用真实 Three.js WebJar 的 TransformControls：world/local × X/Y/Z × 正负两方向，共 12 个真实射线拾取/拖动用例，位移均为 ±60 mm。translate gizmo 从 13 个 mesh 减为 10 个（每轴一个箭头和原轴杆），picker 从 10 减为 7；中心/三平面保留，rotate 数量不变。
- 显示暗部回归：384 个内槽侧壁顶点变暗、600 个端面顶点保持原色；位置/法线数组及截面 JSON 完全不变。凸圆形外表面无错误暗部。本地 RoomEnvironment 实际存在且 importmap/POM 均有映射。
- Chrome 8081 实测同一正向箭头的六个世界轴正反移动，每次对应坐标 ±60 mm，其他两坐标不变；Ctrl+Z 均恢复 (30,20,-10)。撤销沿既有逻辑清除选择，测试重新选择后再验证下一轴，未更改该选择语义。
- 实际绘制 800 mm 的 40×40 型材，完成后退出绘制；复看 20×40、40×40、40×40R 三种短型材，凹槽、孔口与圆弧反光正常。最终 console error / pageerror=[]，运行版本 v0.74.0；测试仅使用独立浏览器，不修改用户主浏览器工程。
- v074-three-arrows-profile.png、v074-three-arrows-detail.png、v074-profile-surface.png、v074-profile-section-materials.png、v074-profile-material-detail.png 保存于当前 Codex visualizations 目录。柔光/暗部是独立展示近似，未复制参考模型或承诺照片级/制造尺寸完全一致。

## v0.73.3 当前检查范围

2026-10-06：139 个 JS/MJS 语法检查、40 个 verify 回归；JDK 21 Maven clean test 成功，1 项测试、0 失败、0 错误。Schema 62 不变。

- ViewCube 真实 handleMove 投影回归覆盖 4 个方位角 × 3 个俯仰角 × 4 个拖动方向，共 48 用例；可见点屏幕位移与鼠标同向，观察中心、缩放距离不变，拖动取消视角 tween；26 面/边/角方向断言保留。
- Chrome 8081 实际鼠标向右/左/下/上拖动各 18 px，正面中心归一化屏幕位移分别约 (+0.0762,0)、(-0.0762,0)、(0,+0.0762)、(0,-0.0762)。修正前下拖对应屏幕 Y=-0.0762，证明原反向；修正后 console error / pageerror=[]。
- 实际逐项检查铝材、连接、光轴、板材、配件：默认、hover、按下、点击后、键盘 focus-visible 均为 rgb(3,7,12)；hover 橙边、transform=none，键盘焦点 outline=solid。点击仍进入既有绘制/放置，Esc 可退出；未改领域模型。
- 运行版本已确认为 v0.73.3；悬停截图 v0733-profile-hover-dark.png 保存在当前 Codex visualizations 目录。资源缓存、样例和版本同步，XZ 四象限无限网格保留。

## v0.73.2 当前检查范围

2026-10-06：139 个 JS/MJS 语法检查、40 个 verify 回归；JDK 21 Maven clean test 成功，1 项测试、0 失败、0 错误。Schema 62 不变。

- InfiniteGround 回归检查四种独立颜色 uniform、GLSL 世界 X/Z 符号分支、中心轴像素抗锯齿、中性色以及仅线条混色；原 51 个逆矩阵射线与 30 个远裁剪面外交点检查保留。
- Chrome 8081 在 1600×1000 / DPR 1 复看透视和正交俯视，1200×800 / DPR 2 复看滚轮缩放；最终着色器成功渲染，console error / pageerror=[]。首轮实际浏览器发现 GLSL min 缺少第二实参，修正为两个轴距离分量后重新复看，不能以文本断言替代编译验证。
- 网格关闭 showGrid=0，地面仍可见且不写深度；重新开启 showGrid=1。实际绘制 800 mm 的 30×30 型材，中心 Y=15 mm，完成后 mode=OFF，已完成件保留。
- v0732-quadrant-grid.png、v0732-quadrant-grid-top.png、v0732-quadrant-grid-dpr2.png 保存在当前 Codex visualizations 目录。仅展示颜色改变，地面底色、无限远、模型单位与吸附不变。

## v0.73.1 当前检查范围

2026-10-06：139 个 JS/MJS 语法检查、40 个 verify 回归；JDK 21 Maven clean test 成功，1 项测试、0 失败、0 错误。Schema 62 不变。

- 网格线色、实线中心覆盖率及渐变调整后，在 1600×1000 / DPR 1 和 1200×800 / DPR 2 的真实 Chrome 页面复看；滚轮拉远/拉近可用，console error / pageerror=[]。
- 51 个无限地面逆矩阵射线及世界坐标/无深度遮挡检查保留；新增实线抗锯齿与线条晚于地面淡出的回归断言。
- 原无限求交、网格尺寸、模型单位和吸附未改。v0731-clear-grid.png 与 v0731-clear-grid-dpr2.png 保存于当前 Codex visualizations 目录。

## v0.73.0 当前检查范围

2026-10-06：139 个 JS/MJS 语法检查、40 个 verify 回归；JDK 21 Maven clean test 成功，1 项测试、0 失败、0 错误。Schema 62 不变。

- InfiniteGround 真实 Three.js 逆矩阵回归：51 个透视/正交及正负 100 米平移射线，30 个交点在相机远裁剪距离之外；无固定距离截断，网格世界坐标不随视点漂移。地面仅四顶点、无深度读写。
- XZ 工作面不再叠加有限密网格；XY 提示及显示开关回归保留。
- 8081 实际 Chrome 渲染着色器，console error / pageerror=[]。平移相机与目标各 100 米后，地面网格仍连续显示；真实滚轮拉远/拉近、俯视和正交投影可用。
- 网格关闭后 uniform showGrid=0，地面仍可见，depthWrite=false。点击预览实际绘制 800 mm 型材，中心 Y=15 mm，确认后绘制退出，毫米尺寸与落地行为不变。
- 当前整页截图 v073-infinite-workbench.png、正交俯视图 v073-infinite-top-ortho.png 保存在本轮 Codex visualizations 目录。参考页复位视角已实际观察；无限远是展示效果，不扩大业务制造范围或修改吸附步长。

## v0.72.0 当前检查范围

2026-10-06：137 个 JS/MJS 语法检查，39/39 verify 回归通过；JDK 21 Maven clean test BUILD SUCCESS，1 项测试、0 失败、0 错误。后续相机留白微调再执行相关回归。Schema 62 不变。

- 浏览器逐项复看五类 59 个主项：16 型材、18 连接、10 光轴、11 板材/几何体、4 配件，另检查五种紧固件头型。公开参考页预览缩放随状态变化；同时采用用户截图的小件留白基准，不把自动适配状态声明为像素一致。
- verify-component-catalog-v071 原有 349 个实际 Three.js 有限网格用例、7 个 L_FIX 台阶/正交通孔检查仍通过。新 verify-catalog-presentation-v072 检查 95 个不同夹具孔径的主 Z 孔中心射线无阻挡、R 名称/预览朝向、独立地面与纯展示尺度。
- 独立浏览器空白工程实际绘制 800 mm 型材，中心 Y=15 mm、30 mm 截面落地，确认后 FREE 退出；光轴、圆环板、三向插接件与脚杯实际添加。连接 Ghost Esc 取消，构件数不变。
- Φ8 光轴上实际安装 L 型夹，合法提示与确认产生第六个构件，保存 SHAFT_AXIS、stationS=62.160703465176994。通过真实属性输入移动宿主 X+100 mm、旋转 Y=90°，主孔与宿主站位距离为 0 mm。
- 真正下载 v072-catalog-project.json；metadata.version=0.72.0，6 构件和 1 安装关系。在新浏览器上下文重新打开，全部类型/形状及安装关系保留，JSON 不含展示地面。
- 两个当前检查页面 pageerror=[]。画布地面 depthWrite=false，构件向工作面以下延伸不会被地面裁掉。只改变展示网格，不改变吸附步长。
- 型材、通用构件及 CAD 边线材质关闭距离雾；大型工程适配到远处后，淡出仅作用于地面与网格，不能让构件消失。
- 实际浏览器截图 v072-workbench.png、v072-铝材-catalog.png、v072-连接-catalog.png、v072-光轴-catalog.png、v072-板材-catalog.png、v072-配件-catalog.png 保存在本轮 Codex visualizations 目录；后五张为本地真实卡片汇总，不伪装为参考站或制造图。
- 相交孔内壁使用细分网格裁除，组件为独立设计参考，不是制造级实体布尔或专有供应商模型。未验证全部复杂组件的自动装配；制造映射、干涉与 FactoryValidator 边界仍保留。

## v0.71.1 当前检查范围

2026-10-06：135 个 JS/MJS 语法检查通过，38/38 verify 回归通过；JDK 21.0.11 Maven clean test 成功，1 项测试，0 失败 / 0 错误。git diff --check 通过（本地 CRLF 转换提示不属于检查失败）。

- 用户对照图作为本轮 L 型固定夹的外形与预览占比基准，另在公开参考页观察阶梯形和孔向。参考页自动适配时的模型大小与用户截图不同，因此按用户图中的小模型留白修正，不声称参考页所有状态像素一致。
- 原有 349 个实际 Three.js 有限网格用例通过；新增 7 种 L_FIX 孔径用例，验证 2d × 4d × 4d 包围盒、主孔偏移 d、Z/Y/X 三向孔中心射线无阻挡、上前台阶空位及下层实体保留。孔壁交会以细分三角片裁除，是设计参考几何，不是制造级实体布尔。
- 8081 当前服务重新生成静态资源后实测：点击卡片添加 Φ8 × 100 光轴，再在光轴上安装 L 型夹，确认为有效并新增 ACCESSORY；确认后放置退出。实际夹具尺寸为 16 × 32 × 32 mm、主孔偏移 8 mm，保存 SHAFT_AXIS 与 stationS=31.798895739742193。
- 真正下载 v0711-l-clamp-project.json，metadata.version=0.71.1；在新浏览器上下文重新打开，两构件及安装关系保留。宿主平移 100 mm 并旋转 Y=90° 后，夹具主孔与宿主站位误差约 2.6e-7 mm（工程坐标序列化舍入），小于 1e-6 mm。
- 规格框聚焦后 Esc 取消，不增件。五类目录往返切换，标签均为 14 px / 500，所有预览 contextLost=false，pageerror 0；切回型材恢复原灯光。
- 实际页面截图 v0711-l-clamp-panel.png / v0711-l-clamp-library.png 与 JSON 均保存在当前 Codex visualizations 目录。此次没有逐一修正其他九类光轴模型或所有连接，不把目录选项一致、非空网格或回归通过当成视觉一致证据。

## v0.71 当前检查范围

2026-10-06 本地检查：135 个 JS/MJS 语法检查通过，38/38 verify 回归通过；新增 verify-component-catalog-v071 使用实际 Maven WebJar Three.js，不伪造几何返回值。JDK 21.0.11 的 Maven clean test 成功，1 项 MockMvc 静态资源/Catalog 测试，0 失败 / 0 错误；git diff --check 通过。

- 原始目录事实保存在 reference/lewan-component-options-2026-10-05-v071.json。实际浏览器比对 16 个参考型材、18 个连接主项及所有 134 个二级规格、10 类光轴对应孔径、11 种板材形状、4 类配件主项与所有螺钉头型/螺纹/长度，未发现选项不匹配。型材和杆径的独立扩展分组保留。
- 349 个实际 Three.js 几何用例全部有非空、有限坐标的实体；包括所有连接规格、夹具孔径、42 个脚杯、滑轨长度、螺钉/端盖与截面（含 R/U 端盖）。预览与构件共用工厂；仅此检查不能证明所有形状与参考站专有网格或实际制造尺寸一致。
- 补查复杂连接外形：角码连接件为带侧加强筋角码，滑块有长孔，三维连接件有三个方向的插接臂，万向铰链有叉形座/销轴；45° / 135° L 板改变真实两臂夹角，而非整体旋转直角板。独立模型仍没有复制参考站专有网格或制造细节。
- 9 类光轴夹主孔站位，在任意宿主姿态下与轴中心线误差小于 1e-8 mm。实际浏览器添加 Φ8 × 200 光轴、安装限位环，再平移 / 旋转宿主；真实下载 JSON 的限位环位置与姿态随动，站位 104.7267 mm 保持，重新打开后仍有 SHAFT_AXIS 安装关系。
- 实际添加圆环板 100/50/5，预览不创建 Part，单击后才提交；工作面最低点为 0。属性栏把外径改成 150 成功，非法内径 180 被拒绝并恢复为 50；保存 / 重新打开保留 panelShape / shapeParameters 和形状尺寸。
- A 柱默认长度 1800，常用长度 800 的自由添加真实生成 PROFILE + U88 截面，最低点为 0；三通自由添加生成本地组件 ACCESSORY，确认后放置状态结束。
- 空白工程从右侧选 3030、一面封边，再实际 FREE 数字输入 600 + Enter；长度和 profilePath.length 均为 600，FRONT 封边保存，最低点误差约 3e-14 mm，单次完成后 active=false。随后在真实 A 端单击安装 3030 端盖，确认新增 ACCESSORY 并退出放置；端点拉伸手柄不再抢走组件安装点击。
- 规格框聚焦时 Esc、右键短单击、切换规格均能取消放置，不新增构件；右键拖动仍是视图平移。干涉阻止落位仍有效，回滚时同步清理已经撤回的选中对象与属性/Gizmo。
- 真实导出五构件的 JSON，以及 SVG（27607 字节）、DXF（41462 字节）。文件和截图保存于当前 Codex visualizations 工作目录，文件名 v071-component-project / v071-component-drawing / v071-workbench；所有页面检查无 pageerror，三处 canvas 的 contextLost 均为 false。非矩形板材的内外轮廓另有结构断言，不宣称完整曲面机械制图。

启动环境记录：本机默认 JDK 21 Unix-domain 临时路径发生 `Unable to establish loopback connection / Invalid argument: connect`。验证服务保持 application.yml 中的 8081 端口，仅在本次 JVM 使用 `-Djdk.net.unixdomain.tmpdir=E:/workspace/diy/target` 后成功启动；没有修改系统环境或项目默认启动配置。命令为 `mvn -o spring-boot:run "-Dspring-boot.run.jvmArguments=-Djdk.net.unixdomain.tmpdir=E:/workspace/diy/target"`。浏览器复测禁用缓存以避免同版本迭代期间的旧 ES Module；用户查看交付版时应 Ctrl+F5。

边界：目录和级联选项按公开页面核对；预览为独立本地参数化设计模型，不是参考站授权网格或供应商尺寸图。复杂多通、铰链等以及 15 系列暂自由放置；正式制造仍有原有配置门禁及参考模型提示。本次未验证全部复杂组件的自动装配或正式制造包，不保存参考站账号/会话。

## v0.70 历史检查范围

2026-10-05 最终本地结果：129 个 JS/MJS 语法检查全部通过，37/37 回归通过，git diff --check 通过；新增 tools/verify-catalog-consistency-v070.mjs。JDK 21.0.11 Maven clean test 成功，1 项静态资源/Catalog MockMvc 检查，0 失败/0 错误。

实际 Chromium 与参考页检查：

- 实际打开 LewanDIY 编辑器并逐一切换型材、连接、光轴、板材、配件：页面只加载站点 favicon 图片，主场景与右侧产品预览均为 canvas，未发现可直接复用的独立产品图片或 CSS 背景图。因此本项目使用自己的 Section/Primitive Geometry 生成预览，不依赖远程资源。
- 五类本地组件库均显示“规格选择 + 黑底三维预览 + 点击使用”。型材可看到完整挤出长度和端面槽；连接、光轴、板材、配件复用实际几何工厂。15 组长宽比/构件尺寸的包围球适配均未裁切，重复适配不累计缩放。
- 连接/光轴/板材/配件切换时各只有一个 catalogProfileCanvas。连续切换 20 次没有 WebGL 上下文过多警告；五类创建/修改反复切换后 WebGL contextLost 均为 false。修复了 v-show 复用 canvas 时错误 forceContextLoss 导致预览白屏的问题。
- 实际检查五类表单 28 个 hover/focus 状态，最低文字对比度 14.80:1，没有白底浅字。型材选择器聚焦为 rgb(26,26,26) 深底、rgb(243,244,246) 亮字、橙色边框。
- 左轨选中态 ::before 为 none、box-shadow 为 none；显示菜单所有状态项保持透明深色行，勾选右对齐且 aria-pressed 与真实值一致。快捷搭建可见区域未发现残留浅色卡片。
- 非法光轴长度 -1 不创建构件；随后实际添加 Ø20 × 720 mm 光轴。实际添加 450 × 300 × 5 mm 亚克力板，工程构件的 materialSpec 和 #b4d7e9 配色与预览一致。
- 配件“3030 黑色端盖”进入放置时不新增构件，Esc 后 active=false 且构件数不变；自由添加后新增 1 个 ACCESSORY。END_SCREW 进入连接放置后 Esc 退出，未产生连接。放置中更换连接方式或配件规格会先退出旧放置状态。
- 实际点击型材预览，画布取起点与斜向候选，输入 600 并 Enter；生成 PROFILE dimensions.length/profilePath.length 均为 600，FREE 自动结束。返回组件库后预览仍正常，页面无 JS 异常。
- 880 × 700 下页面无横向溢出，主工具条 6 个本地 SVG 图标均保留 16 px 可见；1600 × 1000 下五类右库、显示菜单、左轨和快捷面板完成截图复核。

边界：参考站核对为匿名、只读界面观察；未复制品牌素材、账号功能或商业入口。连接预览只表达设计连接意图，不代表最终制造料号；实际料号仍在制造配置阶段绑定。

## v0.69 历史检查范围

2026-10-05 最终本地结果：128 个 JS/MJS 语法检查全部通过，36/36 回归通过，git diff --check 通过；新增 tools/verify-catalog-workbench-v069.mjs。JDK 21.0.11 Maven clean test 成功，1 项静态资源/Catalog MockMvc 检查，0 失败/0 错误。

实际 Chromium 界面与文件结果：

- 未选材 E 不生成构件且定位右组件库；点击预览进入 FREE，构件仍为 0。左轨无自由绘制，右侧仅一个规格选择器。
- 首次使用“按此长度绘制”可直接进入 FREE / 固定 500 mm；设置 FRONT 封边后点击预览仍保留该设置，不静默重置。
- 确认实际 600 mm 型材后 mode=OFF、Ghost 清空、右侧自动修改属性；复制 1→2、撤销 2→1、重做 1→2。
- 八组菜单实际检查：网格开关、5 mm 移动步长、正交/透视切换、六面相机方向、帮助弹窗、模型库及快捷搭建、工程中心、制造配置与检查。六个方向经动画完成后单位向量核对，误差 <0.0001。
- 命名后实际下载 JSON，含 Schema 62、构件、工程名称；新建后为 0 件/未命名，不加载示例；文件选择后恢复 2 件及名称。最新版本另确认 metadata.version=0.69.0。
- 脏工程新建时取消确认，13 个现有构件和“我的 DIY 框架”名称保持不变；接受确认才清空。最后通过快捷搭建生成 12 根型材、16 个抽象设计连接的基础空间框。
- 实际 PNG 下载签名为 89504e470d0a1a0a；SVG 含 svg，DXF 含 SECTION/ENTITIES。制造推荐绑定 2 根真实材料、检查 0 错误/0 警告，生成 39 条目 ZIP，包含 cut-list.csv 和总装工程图。
- 1600×1000 与 1024×768 页面无横向溢出；窄屏“确认这一根/取消当前段/结束绘制”中心均实际可命中。展开左侧快捷面板后，视图菜单按钮仍可命中。
- 透视/正交适配以及调整窗口后框架 8 个包围盒角全部位于画布内；336 px 窄画布也通过。回归另覆盖 3 种长宽比 × 框架/长梁/高杆 × 2 种投影，共 18 个适配情况，重复 resize 不改变正交投影。
- 帮助期间按 E 不开始绘制、不增加构件，Esc 关闭帮助；用户的紧凑 26 方向导航和快捷旋转保留。页面无 JS 异常。

参考页已在独立浏览器实际观察；未修改其工程、未保存凭据。浏览器为本地静态预览，Maven 使用 MockMvc，不等价于独立 Tomcat/REST 现场部署；不宣称参考站全部功能或像素级复刻。

## v0.68 历史检查范围

2026-10-05 本地结果：126 个 JS/MJS 语法检查、35/35 回归通过；JDK 21.0.11 Maven clean test 成功（1 项静态资源/Catalog MockMvc 检查，0 失败）。

实际 Chromium 界面确认：

- 默认绘制 600 mm 后 mode=OFF，Ghost 清空，光标恢复，选中成品并切至修改属性；再次进入绘制显示创建组件库。
- 未完成段右键单击退出，不创建新件、不弹普通菜单；右键拖动后仍 FREE，继续平移。长度输入框与左侧固定长度字段聚焦时一次 Esc 均退出，成品保留。
- 连续添加开启后，两根实际 600 mm 横梁/立柱形成 DESIGN_VALID / ANGLE_BRACKET 连接，无真实穿透；完成后仍 FREE 等待起点。
- “取消当前段”保持 FREE 并清空起点，已完成的 2 根保留；左表单收起后结束按钮仍可用，结束后 mode=OFF 且无 Ghost。
- 切到测量时绘制 OFF；“选择”退出测量。右侧修改页签退出绘制。画布“确认这一根”能提交 400 mm；先键入 600 再人工改输入为 400 时仍以 400 为准。
- 撤销 4 → 3、重做 3 → 4；导出 Schema 62 / toolVersion 7，无 workbenchMode。
- 1024×768 下为左面板预留轨道，“连续添加”和“结束绘制”中心均实际可命中，无页面横向溢出；1600×1000 工作台检查无 JS 异常。
- 1024×768 下主工具条高频按钮和“更多操作”均实际可命中；从更多菜单进入测量后菜单自动关闭且绘制 OFF。尺寸概览与主工具条无重叠。
- 顶部“显示 → 网格辅助”实际关闭网格且菜单收起；更多菜单测量生效，构件仍为 2，未误触画布。菜单必须在 click 后关闭，不能在 pointerdown 提前隐藏。

新增 tools/verify-workbench-usability-v068.mjs 覆盖默认单次、显式连续、一次 Escape、取消保留历史、输入框退出及无模式门槛。延续方向、长度、实体搭接、自动连接与干涉回滚回归。

浏览器是本地静态预览，不等价于独立 Tomcat/REST 现场启动；不宣称任意设备下的所有交互或商业 CAD 几何能力已完整验证。

## v0.67 历史检查范围

2026-10-05 本地结果：125 个 JS/MJS 语法检查、34/34 回归通过；JDK 21.0.11 Maven clean test 成功（1 项 MockMvc 检查，0 失败），git diff --check 通过。

实际 Chromium 界面确认：FREE 内 300/400 mm 方向输入 500 mm 生成实际 500 mm 斜杆，方向为 [0.6,0,0.8]，提交后仍处于 FREE 等待下一起点；撤销 1 → 0、重做 0 → 1。近轴默认 X，鼠标静止时按 Alt 转为斜向，松开恢复 X；同一工具生成两根 600 mm 横梁/立柱及 DESIGN_VALID 连接，实体无穿透。快捷搭建保留矩形/空间/轮廓按钮和异形框，点击矩形后面板为 build，E 返回 FREE / draw。页面无 JS 异常。浏览器是本地静态预览，不等价于独立 Tomcat/REST 现场验证。

- tools/verify-unified-free-draw-v067.mjs：近轴容差、离轴斜杆、精确长度不掰直、Alt/Shift/锁轴优先级、Feature 锁轴拒绝、修饰键释放刷新、Esc 两阶段退出、单一绘制入口与快捷搭建保留。
- 延续 v0.66 的实际长度、地面定位、实体 Ghost、自动连接与穿透回滚回归；Schema 保持 62，工具版本 6。

## v0.66 当前检查范围

2026-10-05 本地结果：124 个 JS/MJS 语法检查通过；33/33 个 verify 脚本通过；JDK 21.0.11 下 Maven clean test 成功（1 项静态资源/Catalog MockMvc 检查，0 失败）。git diff --check 通过。

实际 Chromium 界面确认：右侧选择不创建构件；空白地面竖杆实际长度 600 mm、实体最低 Y = 0；撤销移除/重做恢复；X 轴锁定与输入框 Esc 取消生效；斜向 300/400 分量产生实际 500 mm 构件；600 mm 横梁端部转向生成实际 600 mm 立柱及 1 个 DESIGN_VALID / ANGLE_BRACKET 设计连接，无实体穿透；页面无 JS 异常。Ghost 存在时 exportProject 仍只包含已提交的 2 根构件和 1 个连接，Schema 62 / toolVersion 5。

- 新增 tools/verify-profile-drawing-v066.mjs：透视/正交相机下正负三轴、退化轴过滤、竖杆落地、真实长度、Ghost 不创建业务对象、搭接宿主参与自动连接、穿透回滚及斜向长度。
- 真实重叠绘制在实际 Editor 内被拒绝，构件数 2 → 2、历史索引 2 → 2；底部绘制反馈与画布输入均显示实际长度 600 mm，不使用搭接中心线距离 615 mm。
- 浏览器采用本地静态资源与实际 Three.js / Editor，不将静态预览视为独立 Tomcat / REST 服务现场验证。
- 参考站在独立临时草稿观察，不修改用户提供的原始参考工程，不保存账号、密码或会话到仓库。

## 1. 原则

不维护旧 Schema 兼容。当前回归重点：
- Schema 62 严格性。
- Profile Grip A/B 固定对端语义。
- A_END/B_END 加工基准联动。
- Engineering Drawing SVG 与 DXF 共享 Drawing Model/Layout。
- DXF AC1015/mm/图层/实体/Unicode 可解析。
- 黄金 sample W/D/H 正确。
- Factory Validator 正常。
- 静态资源无运行时 CDN。

## 2. 自动脚本

首次运行 v0.65 几何回归前先执行 `mvn process-resources`（或 `mvn clean test`），将构建期 Three.js WebJar 解包到 target；几何回归使用这个实际版本，不安装另一份 npm 依赖。

```bash
for f in $(find src/main/resources/static/js tools -type f \( -name '*.js' -o -name '*.mjs' \)); do node --check "$f"; done
for f in tools/verify-*.mjs; do node "$f"; done
```

当前脚本：
- `verify-player-workbench-v065.mjs`：26 方向唯一性/反向完整性；3 工作面 × 5 方向的非方形截面贴面几何，使用项目实际 Three.js。
- `verify-engineering-dxf.mjs`：DXF header/layers/entities/Unicode/UI/Factory Package contract。
- `verify-profile-grip.mjs`：A/B 固定语义、精确输入合同、Feature Snap、约束保护、加工基准重映射。
- `verify-project-schema.mjs`：Schema 62 current-only + Production Inspection/Profile Catalog settings。
- `verify-builder-connection-v064.mjs`：现有结构强制扫描、纯自动连接安全清理、状态总览和 DIY 品牌。
- `verify-engineering-drawing.mjs`：Drawing Model / views / A3 layout / SVG / Factory Package contract。
- `verify-validator.mjs`：黄金 sample + 非法加工。
- `verify-fish-rack.mjs`：W/D/H = 610/670/2050。
- `verify-ui-contract.mjs`：关键 UI/Editor/Scene/Snap 能力。
- `verify-static.mjs`：本地静态依赖、无运行时 CDN、无启动脚本。

## 3. Spring Boot

```bash
mvn clean test
```

`StaticResourceSmokeTest` 已检查：
- ProjectSchema / schema 62。
- ProfileGripEditor / ProfileGripMath。
- EngineeringDrawingModel/Layout/Service/SVG + DXF Exporter。
- 其他关键静态资源。
- 使用 Spring MockMvc 进程内请求静态资源和 Catalog API，不依赖本机端口或 loopback 网络。

v0.64.0 本次实测：
- JS/MJS `node --check`：118/118 通过。
- `tools/verify-*.mjs`：31/31 通过。
- `mvn clean test`：1/1 通过，JDK 21 / Spring Boot 4.1.1 / SQLite 上下文成功启动。
- Chrome 浏览器生成基础框架后得到 40 个纯自动连接；清除后为 0；再次扫描恢复到 40，几何失效始终为 0。

## 4. 浏览器手测

1. 添加 3030 L500。
2. 选中后确认 A/B Grip。
3. 拖 B，A 不动；拖 A，B 不动。
4. 拉伸中输入 `1050` + Enter。
5. Esc 取消并恢复。
6. 双击 Grip 精确输入长度。
7. 验证网格与 Feature Snap。
8. A/B 基准孔位分别验证。
9. source-end 已连接/约束时 Grip 受保护。
10. 鱼缸架、工程图、Factory Package 继续通过。
11. 尝试打开 schema 59，应明确拒绝。

## 5. v0.37 DXF 基线实测

- JS/MJS `node --check`：66/66 通过。
- `tools/verify-*.mjs`：8/8 通过。
- 鱼缸架黄金样例：W610 × D670 × H2050。
- 真实生成 `v037-assembly-drawing.dxf` 后使用独立 `ezdxf 1.4.4` reopen 成功：
  - DXF version: AC1015
  - INSUNITS: 4 (mm)
  - 目标 layer 7/7 存在
  - LINE: 1026
  - TEXT: 27
  - SOLID: 32
- 当前执行环境 JDK 21 / Node 22 可用，但 `mvn` 不可用，因此未执行 Maven/Spring Boot test；`StaticResourceSmokeTest` 已同步更新，接手环境必须补跑。

## 6. v0.38 历史新增验证（保留记录）

- `verify-bom-v038.mjs`：项目汇总、型材分组、五金 BOM、加工 BOM 聚合、子装配路径、逐件 cut-list、逐 Feature machining、一致性检查。
- 当时的 `verify-project-schema.mjs` 验证 Schema 38 current-only；当前已升级为 Schema 39。raw-material 字段仍不得进入 manufacturing；历史 CONNECTOR Part 类型仍必须拒绝。
- `verify-ui-contract.mjs`：制造汇总 UI 存在，Stock 排料 UI/API 已移除。
- 当时 Java `StaticResourceSmokeTest` 已移除 StockCutOptimizer/StockLayoutExporter 检查；当前已继续升级到 Schema 39 并加入生产检查模块。

交付前还应全仓搜索 `StockCutOptimizer|StockLayoutExporter|stockLengthMm|sawKerfMm|minReusableOffcutMm`，除文档中明确的“禁止恢复”说明外不应存在运行代码。

## 7. v0.38 历史交付实测

- JS/MJS `node --check`：65/65 通过。
- `tools/verify-*.mjs`：9/9 通过。
- BOM / cut-list / machining 专项：通过。
- 当时 Project Schema 38 current-only：通过；当前基线为 Schema 39。
- 黄金鱼缸架：W610 × D670 × H2050，28 根 PROFILE。
- 原料/库存/余料运行模块：已移除；仅在文档与反向回归断言中保留“禁止恢复”的文字说明。
- 当前执行环境：JDK 21、Node 22 可用；`mvn` 命令不可用，因此本次交付未执行 Maven/Spring Boot test。接手环境必须补跑 `mvn clean test`。

## 8. v0.39 新增验证

- `verify-production-v040.mjs`：端面接触不算碰撞；超过容差的体积穿透可检出；交叉直型材可检出。
- 几何接触但无 Connection/Constraint 给 WARNING；补 Connection 后消失。
- FactoryValidator collision ERROR 进入 Gate。
- UI 必须包含“生产检查”“定位模型”。
- `StaticResourceSmokeTest` 增加 `PartCollisionDetector` / `ConnectionCompletenessInspector`。

生产碰撞的当前精度边界见 `docs/PRODUCTION-INSPECTION.md`。

## 9. v0.39 最终交付实测

- JS/MJS `node --check`：68/68 通过。
- `tools/verify-*.mjs`：10/10 通过。
- `verify-production-v040.mjs`：OBB-SAT、连接完整性、可定位 issue、Factory Gate 通过。
- 黄金鱼缸架：W610 × D670 × H2050，28 根 PROFILE；碰撞 ERROR=0。
- 黄金 sample 因尚未建 Connection/Constraint，会产生约 48 个几何接触未连接 WARNING，这是当前数据本身的真实状态，不是碰撞误报。
- 原料/库存/余料运行模块：仍不存在。
- 当前执行环境：JDK 21、Node 22 可用；`mvn` 命令不可用，因此本次未执行 Maven/Spring Boot test。接手环境必须补跑 `mvn clean test`。

## 10. v0.40 新增验证

- `verify-profile-catalog-v040.mjs`：动态注册/注销 ProfileDefinition、database section、SVG 缩略图、REST/DDL 合同、hover/camera tween。
- `verify-ui-contract.mjs`：自定义型材、数据库保存、profile section thumbnail、scene hover、camera tween。
- `StaticResourceSmokeTest`：Schema 57、ProfileCatalogApi、`/api/profile-catalog`。
- 当前执行环境若无 Maven，不得声称运行过 Spring Boot/JDBC integration test；接手环境必须执行 `mvn clean test`。

## 11. v0.41 新增验证

- `verify-cad-interaction-v041.mjs`：套索、穿透选择、Feature Hover、World/Local Gizmo、工作平面、类型化右键菜单。
- `verify-ui-contract.mjs`：新增套索/局部坐标/UI class 合同。
- `verify-project-schema.mjs`：Schema 57 + `cadInteractionVersion=2`。
- `StaticResourceSmokeTest`：新增三个 interaction 模块资源检查。


## 12. v0.42 新增验证

- `verify-profile-catalog-v042.mjs`：可视化截面模板、停用目录语义、管理 UI、Jackson 3、Lombok、JDK21、Service/impl 分层。
- `verify-profile-catalog-v040.mjs`：保留 v0.40 动态目录和 SVG 缩略图回归，并已更新 Java Controller 新包路径。
- `StaticResourceSmokeTest`：增加 ProfileSectionEditor / ProfileSectionPreview3D 静态资源检查。
- 项目正式编译目标为 JDK 21。验证环境必须使用 JDK 21（或兼容的更高版本但以 `--release 21`/Maven `java.version=21` 编译）进行最终构建验证。


## 13. v0.42 本次交付实测

- JS/MJS `node --check`：77/77 通过。
- `tools/verify-*.mjs`：13/13 通过。
- `verify-profile-catalog-v042.mjs`：通过。
- Java 静态合同检查：无 `com.fasterxml.jackson.databind` import、无 `var`、无 `.stream(`；POM XML 可解析。
- Spring Boot 目标版本 4.1.1，项目正式编译目标 JDK 21。
- 当前执行容器为 OpenJDK 21，但未安装 Maven，因此本次不能声称已经执行 `mvn clean test`。接手环境使用 JDK21 + Maven 3.6.3+ 补跑即可。


## v0.49.1 专项

`tools/verify-design-workbench-v0491.mjs` 检查设计目录无制造字段、Schema 57 current-only、单击接头吸附/两点回退、Ghost Connector/Ghost Machining、封边语义、简易模式、菜单自动收起和中文工作台。

## v0.50 制造配置专项（v0.51 基线继续执行）

`tools/verify-manufacturing-config-v050.mjs` 检查：

- 设计连接目录只保存抽象连接意图，不携带螺钉/T 螺母/加工参数；
- Project Schema 57 / 应用版本 0.57.0；
- `ConnectionManager` 分离 `designType` 与 `manufacturingRuleId`；
- 未配置制造规则时只显示设计连接提示，不生成真实五金；
- 制造连接要求两端真实型材已配置，并按实际制造槽宽校验 T 螺母；
- `ManufacturingConfigurator` 覆盖型材材料映射、连接制造规则映射、一键推荐和状态统计；
- `FactoryValidator` 对未配置制造型材/连接进行阻断；
- 制造包导出存在制造配置门禁；
- BOM 按真实制造规格区分；
- 制造配置页面不包含报价能力。


## v0.52 交互反馈专项

`tools/verify-interaction-feedback-v052.mjs` 检查：

- `InterferenceFeedbackManager` 已接入 Editor Transform 生命周期；
- PROFILE×PROFILE 复用 OBB SAT，其他物理构件存在快速干涉反馈；
- 正常端面贴合由碰撞容差自然放行；连接派生五金和宿主安装关系具备排除逻辑；已建立 Connection 的型材若真实穿透仍必须报告；
- `SnapManager.preview()` 与 `SceneManager.showSnapPreview()` 已接入拖动过程；
- 右键型材可直接进入角码/内置/连接板、配件、加工、板材/门工作流；
- 顶部一级菜单固定为文件 / 设计 / 视图 / 制造 / 帮助；
- 报价能力仍不存在。

本版最终交付要求同时执行所有 `tools/verify-*.mjs`、JS/MJS `node --check`、MyBatis XML 解析以及 SQLite 双次初始化验证。

## v0.53.0 Unified Placement

`tools/verify-placement-system-v053.mjs` 检查：

- `AccessoryPlacementManager` 已接入 Editor pointer move / click；
- 配件 Ghost 支持合法/非法红绿反馈与快速干涉预判；
- 右键位置 seed 可进入配件放置；
- Snap Preview 有“即将吸附”用户反馈；
- 顶部一级菜单固定为 4 个；
- `placementSystemVersion=1`、`interactionPolishVersion=2`；
- 报价逻辑仍未进入当前范围。


## v0.54 Manufacturing Guidance

`tools/verify-manufacturing-guidance-v054.mjs` 验证：

- P/B/S/A/H/C/M/G 统一制造编号；
- 跨步骤连接只归属较晚安装步骤；
- 前置步骤计算；
- 连接派生五金只在所属步骤出现一次；
- Tagged Drawing 使用制造编号；
- 总装图默认排除连接自动派生五金标签。


## v0.55 回归

- `verify-contour-assembly-v055.mjs`：轮廓绘制入口、闭合生成、自相交保护、标准 PROFILE/Assembly 链路、装配播放控制、未来步骤隐藏、动画装入、Schema 57。

- `verify-contour-parametric-v056.mjs`：轮廓参数事实源、点拖动/边长/正交、整框重建、装配相机过渡、连接局部信息、Schema 57。


## v0.57 回归

- Project Schema 57 / 应用版本 0.57.0；
- 轮廓尺寸标签点击编辑；
- 轮廓边插点 / 控制点删除；
- L/U/阶梯快捷轮廓；
- 二维连接安装示意；
- 报价逻辑仍不存在。


## v0.58.0 回归补充

- Project Schema 58 / 应用版本 0.58.0；
- `verify-contour-relations-v058.mjs` 验证等长/平行/点对齐、连接安装方向、螺钉插入方向和反向拆卸顺序；
- 报价相关仍不得进入用户界面和制造输出。


## v0.60.0 回归补充

- Project Schema 59 / 应用版本 0.60.0。
- JS/MJS `node --check`：117/117 通过。
- `tools/verify-*.mjs`：30/30 通过。
- `verify-assembly-guide-v059.mjs`：关系图标、关系列表互定位、装配说明翻页 UI、可打印说明 HTML、无报价逻辑。
- MyBatis XML：3/3 可解析；SQLite 初始化连续执行两次仍为 10 条基础配件、0 重复，JSON1 正常。
- 当前环境 Maven 缺失，未执行 Spring Boot/JUnit。
