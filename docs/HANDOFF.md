# 项目交接文档 — v0.74.0

## v0.74.0 当前重点

- SceneManager.compactTranslationGizmo 只作用于 translate gizmo/picker 的 X/Y/Z。WebJar 烘焙几何包围盒中心负值表示反向件；移除并释放几何，保留共享材质。不能只设 visible=false，因为 vendor 每帧重置显示，也不能残留隐藏 picker。
- 仅显示 X+/Y+/Z+ 的单象限箭头，局部坐标下跟随构件旋转。三平面和中心柄、旋转工具不变；同一正向箭头允许 signed delta，两方向仍经现有 Editor Transform 事务。
- RoomEnvironment 必须同时在 Maven unpack/copy 与 index importmap 中本地交付。PMREM 只在主场景初始化时生成一次；临时 Room 和 PMREMGenerator 释放，studioEnvironment target 由当前 SceneManager 生命周期持有。
- ProfileSurfaceAppearance 以截面凸包到侧壁的内缩距离估算槽内暗部，仅产生 color attribute；端面不染暗、凸圆弧面不因矩形 bbox 被误判。ProfileGeometryFactory 的位置/法线、截面 Registry、端切和制造模型不改变；预览 Lambert 转换保留 vertexColors。
- 金属参数 metalness=.68 / roughness=.36 / envMapIntensity=.65；边缘线 0x4a535d、opacity=.32。展示暗部不是精确 AO 或制造建模，不承诺专有模型/制造尺寸一致。
- 版本/缓存 0.74.0，Schema 62 / 8081 不变，四象限无限地面和 v0.73.3 交互修复保留。

## v0.73.3 当前重点

- ViewCube.handleMove 使用 theta-=dx*.012、phi-=dy*.012：拖动物体视觉同向，相机轨道相反。此前 phi+=dy 导致向下拖动时面向上移动；不能把已正确的 theta 一并反转。
- 48 个拖动回归直接调用真实 handleMove，投影可见点验证四个屏幕方向，并检查观察中心和距离不变。面/边/角的点击选择仍为 26 个方向。
- 主型材预览不再使用 profile-asset-row；仅保留 catalog-profile-preview、draggable 与原 dragstart/click 行为。五类共享 :is(:hover,:active,:focus-visible,.selected-profile) 深色背景与橙边框，键盘焦点有独立 outline。
- 版本/缓存 0.73.3，Schema 62 / 8081 不变；XZ 四象限线色与无限地面保留。

## v0.73.2 当前重点

- InfiniteGround 四个 uniform 线色：X+ Z+ 蓝 0x587fb5，X− Z+ 紫 0x8e6da8，X− Z− 橙 0xa17d54，X+ Z− 青 0x438c92。GLSL 根据 hit.x / hit.z 的世界符号分区，不使用屏幕象限。
- 原点轴使用原 lineColor=0x7b91a7；像素导数控制轴线抗锯齿，仅 lines 覆盖处混合色。地面底色、无限求交、像素格距与业务坐标不变。
- 底部网格按钮 title 解释颜色；运行页 8081 保留。版本/缓存 0.73.2，Schema 62 不变。

## v0.73.1 当前重点

- InfiniteGround 线色改为 0x7b91a7，细格/粗格强度 0.72/0.40；smoothstep 保留线芯并抗锯齿。线条 pow(fade,0.75) 比地面晚淡出，中远景保持可辨。
- 仅改地面着色，不改无限求交、工作面、尺寸或吸附。版本/缓存 0.73.1，运行页仍为 8081。

## v0.73.0 当前重点

- InfiniteGround 为 renderer-only 全屏片元地面：逆投影矩阵/相机世界矩阵计算 XZ 平面交点，不扩大全局网格来伪造无限远。固定世界坐标，常规 200 mm 展示细格与十倍粗格按像素覆盖平滑过渡。
- SceneManager.ground 是无深度遮挡的全屏网格；grid 保留 visible 状态接口，onBeforeRender 更新相机和线条开关。scene.fog 已移除；远处渐变只在地面着色器。
- 不能把展示网格间距写入吸附参数，也不能把 quad 当建模平面用于拾取。世界求交/模型单位/26 视角均沿用现有流程。
- WorkPlaneVisualizer 在 XZ 不再叠加有限密网格，否则会重新出现方形边界与双层线条；XY/YZ 蓝色工作面提示与开关保留。
- 版本 0.73.0 / Schema 62 / 端口 8081；更新 target/classes 静态资源后检查页面。历史有限地面实现仅保留在下方版本记录。

## v0.72.0 当前重点

- 五类全目录复看与修正，不再仅修 L 型夹。具体覆盖与不可推断的制造边界见 reference/lewan-visual-review-2026-10-06-v072.md；原始 v071 选项记录不可覆盖。
- CatalogPresentation 是唯一预览展示策略；分类/几何种类决定朝向、留白和参考观察跨度。小件不因 Box3 自动适配全部撑满卡片，也不能用 mesh.scale 修改真实毫米尺寸。
- ProfileSectionPreview3D 统一中性 MeshLambert 柔光，转换旧 MeshStandard 材质仅限预览并释放旧材质；切换组件必须复位灯光位置和强度。R 型材预览旋转只在展示根节点，实际安装坐标不变。
- ComponentGeometryFactory 与实际新增仍共用；SK/SHF 主孔轴为 local Z，十字/平行/T 夹主孔中心 local Y=-axisOffsetY。任何修改需同时检查 AccessoryMountManager 的主孔站位与真实穿孔射线。
- 新灰蓝地面是 SceneManager 展示层，depthWrite=false，不能加入 editor.meshes / Project / BOM。网格显示间距 100 mm 不改变建模吸附步长。初始正面透视不改变 home/26 视角的已有方向定义。
- 版本 0.72.0 / Schema 62，保留用户端口 8081。当前服务读取 target/classes；源修改后需要 process-resources。实际 6 构件工程已下载重开并保留安装关系，未改用户主浏览器工程。
- 外形是独立参数化设计参考，不宣称复制专有网格或全部供应商制造尺寸，也不以回归通过代替视觉验收。

## v0.71.1 当前重点

- 用户指出 L 型固定夹与参考截图显著不同；v0.71 的选项和非空网格验证不能证明形状一致。现修正为前低后高的阶梯块，三向主孔和紧固孔为真实孔面与内壁，不是黑色圆片。
- ComponentCatalog 的 L_FIX 尺寸为 width=2d、height=4d、length=4d、axisOffsetY=d；ComponentGeometryFactory 与实际安装共用这些事实。孔相交处裁除内壁，主 Z 孔中心 local Y=-d。
- ProfileSectionPreview3D 对此夹具使用中性哑光、前低后高方向与 2.4 的留白系数；调整相机而非缩放实际网格。其他组件灯光及适配恢复原值。表单标签使用 14 px、500 字重、6 px 底间距。
- 构建后再看运行页：当前 Spring 服务读取 target/classes 静态资源，源文件修改本身不会更新页面。资源缓存和当前版本同步到 0.71.1；不改用户的 8081 端口。
- 本次重点是用户指出的 L 型夹具，不宣称所有目录模型与参考站像素或制造尺寸一致。验证证据见 docs/VALIDATION.md。

## v0.71 当前重点

- 用户要求五类组件不只是样式相同，还要类型、下拉项、级联规格和预览形状对应。原始匿名页面观察记录位于 reference/lewan-component-options-2026-10-05-v071.json；只保存选项和尺寸控件事实，不保存凭据、会话或参考站代码/模型。
- ComponentCatalogData / ComponentCatalog 共用选项与规格，ComponentGeometryFactory 复用预览及实际构件；几何为本地独立参数化参考模型，不宣称专有网格或制造级尺寸一致。16 个参考型材另加 7 个扩展；连接 18 类 / 134 规格；光轴 10 类；板材/几何体 11 类；配件 4 类，脚杯 42 规格。
- 型材仍从右侧预览进入 FREE；U88 自由添加在选定长度后使用同一放置器，关闭自由添加才绘制。R 圆弧面天然关闭，封边从其剩余可安装面起算。封边截面必须传 faceClosures 给 ProfileSectionRegistry，不能只改连接标志不改实体。
- 七个连接目录类型映射已有设计连接 Manager；15 系列与其他复杂组件目前自由放置，UI 明确限制。designComponent 是本地几何描述，不是 manufacturingRuleId；切换设计类型清除描述，制造绑定仍经过既有规则。
- 新板材 shapeParameters 保存在 PANEL.dimensions；PanelShapeModel 是尺寸/轮廓单一来源，ProjectSchema 校验一致性，属性编辑用 Editor API。薄板 SVG/DXF 保留轮廓和内孔，曲面实体只是设计参考，暂不是完整机械制图。
- 光轴夹 mountReference 使用 SHAFT_AXIS + stationS，dimensions.axisOffsetY 与真实主轴孔中心一致；随宿主变换重算，非同径拒绝安装。自由放置最低点落工作面，Ghost 不进入业务数组。
- 五类主目录之外，数据库配件/管理折叠保留，加工仍从顶部模型库进入。单次确认结束，Esc / 右键短单击 / 切换类别取消；右键拖动保持平移。切换规格取消旧 Ghost，释放克隆前后的材质。
- 当前版本 0.71.0 / Schema 62 / drawToolVersion 7；不要为了参考目录引入价格、真实供应商料号或历史迁移。浏览器与回归范围见 docs/VALIDATION.md。
- 安装到端点时 ProfileGripEditor.selectedMesh / pointerdown 必须让出连接/配件/加工放置；端盖安装不能触发拉伸。removePartByIdSilently 的干涉回滚同步选中 UI，属性变换通知 Project 变化以刷新工程摘要。

## v0.70 历史重点

- 深色控件必须覆盖 hover / focus / disabled / option，不能再被 app.css 前面的浅色规则覆盖。包括侧栏、快捷面板和弹窗，原生选择器采用 color-scheme:dark，控件聚焦不叠加厚 outline。
- rail-tool.active 清除 ::before 和 inset 双指示；菜单 active 不使用浅底，右侧 menu-state 表示勾选，aria-pressed 表示真实开关状态。View / Display / Step 共享同一行尺寸与悬停风格。
- catalogProfileCanvas 在五个互斥类别模板中复用 ref，每次只出现一个。refreshCatalogPreview 在 nextTick 后解析当前 canvas；离开创建页或无 canvas 必须 dispose 并置空，不能持有隐藏 WebGL 上下文。
- ProfileSectionPreview3D.setObject / fitCatalogObject 支持 PrimitiveGeometryFactory 的光轴、板材、连接和配件示意。Box3 居中、包围球适配、小视场角约束，不改变真实尺寸。所有预览与工程、历史、BOM 隔离。
- 连接库仍使用 DesignConnectionList 五种语义，不引入参考站供应商规则；END_SCREW 预览用螺钉示意，安装继续走 ConnectionPlacementManager。制造规格仍在制造阶段绑定。
- 配件沿用 SQLite 目录、accessoryDefinition 和 AccessoryPlacementManager；selectedCatalogAccessory 在筛选后退回首个可用规格。无匹配结果提供空状态，不能沿用旧配件误安装。
- 板材仅开放当前真实支持的矩形，不复制参考站尚未实现的形状；框口填板和门组件仍在折叠区。新增板材和预览使用同一 panelMaterialColors，尺寸提交有有限/正数检查。
- 浏览器现场访问 127.0.0.1:8080，真实 REST 读取配件、实际 UI 添加/取消；不是仅静态页面截图。参考站预览为 canvas 而非产品图片，不新增远程资源依赖。完整结果见 docs/VALIDATION.md。

## v0.69 历史重点

- 用户批准移除重复左侧自由绘制面板，右侧统一选材和使用；要求整体风格与 LewanDIY 编辑器保持一致。实际参考站在浏览器中核对，不复制品牌、账号功能或商业入口。
- 右侧只有 design-profile-choice 截面选择器；catalogProfileCanvas 使用 ProfileSectionPreview3D，长槽与端面可同时看见。ResizeObserver 随面板尺寸刷新，dispose 清理。预览不创建 Project Part。
- hasChosenProfile 是交互状态，不持久化。未选材 E 定位右侧；选择规格或点击卡片后允许 FREE。底部工具条复用同一个绘制工具，左侧 quickPanel 仅 build / batch。
- 新主题集中在 app.css 的 v0.69 区域，深色 shell/弹窗 + 浅蓝 canvas + 单一橙色。布局默认 48 px header / 64 px rail / 344 px library；用户保存的自定义布局不强制抹掉。本地 WorkbenchIcons 不接收任意 SVG 输入。
- 顶部八组菜单均调用既有 Editor / Manager。新建是 clear + 新名称/绘制状态 + reset 历史，不再等于 loadSample；示例另设明确入口。打开、新建、示例替换 dirty 工程会确认；保存为下载 JSON，不是云端保存。
- 命名、导入、撤销/重做同步 engineeringDrawingForm；没有可撤销项时反馈。菜单 click 后关闭规则沿用 v0.68，header stacking 保证窄屏左侧操作面板不能遮住菜单。
- Esc 关闭帮助/工程中心/制造配置/生产检查，模态窗口期间阻止背景快捷键。目录编辑弹窗仍经过自身关闭处理。
- Editor.fitView 使用包围球和较小视场角，兼顾实际 viewport aspect；SceneManager.resize 正交 frustum 固定 2200，zoom 只应用一次。不要重新使用最大边长固定倍数作为完整适配承诺。
- 验证覆盖 18 个透视/正交与长梁/高杆/框架适配情况；浏览器真实导出 JSON、PNG、SVG、DXF、39 条目的 ZIP。完整结果、静态预览与 REST 边界见 docs/VALIDATION.md。
- Schema 62 / profileDrawToolVersion 7 不变，不扩展报价/供应商/订单/库存，不保存参考站凭据。

## v0.68 历史重点

- 用户要求不再区分简单/专业模式，统一样式并解决画完后退出不便。删除 Editor/app 中模式状态；Schema 当前工程规范化丢弃展示字段 workbenchMode，不新增历史迁移。
- ProfileDrawTool.options.continueDrawing 默认 false。FREE 成功提交后 stop；开启连续添加才保持 FREE。退出清理 Ghost、Snap 和光标并恢复所选构件操作，不删除已提交件、不额外写历史。
- Esc 在工具、就地长度输入和全局侧栏字段三处统一 stop。取消当前段仍走 cancelStep，保留等待起点状态；Enter 在 FREE 等待起点时结束。
- SceneManager 非左键 pointerup 不进入 clickHandler；仅右键短距离单击调用 secondaryClickHandler。Editor 只在绘制活动时处理为 stop，并抑制随后的普通菜单；拖动右键仍由 OrbitControls 平移。
- 画布 action HUD 不依赖左侧展开；确认按钮优先读取就地输入的实际值，避免已编辑输入被旧 typedLength 覆盖。其他工具与右侧页签通过统一取消临时放置入口切换。
- 开始绘制显示右组件库；单次完成/主动结束后有选择则显示属性。不要用 UI 直接删改领域数组。
- 统一主题在 app.css 的工作台主题区管理，浅色面板 + 单一橙色操作强调；红/绿仍是几何状态色。901–1100 px 侧栏预留轨道，更窄屏保留结束 HUD。
- 主工具条收敛高频六项，低频工具归入 details.cad-menu.toolbar-more，复用全局菜单自动收起，不再要求玩家横向滚动找工具。
- 修复全局菜单提前收起：pointerdown 只关闭其他菜单，click 的 microtask 才关闭当前菜单，必须让 Vue 的按钮 click 先完成。
- 当前 Schema 62、toolVersion 7。验证结果与浏览器边界见 docs/VALIDATION.md；未承诺一般非正交连接与自动斜切制造。

## v0.67 历史能力

- 用户确认单一自由绘制入口。FREE 同时覆盖三轴搭建与斜杆；不只是隐藏 DIAGONAL 按钮。
- ScreenAxisResolver 可接收屏幕角度容差；FREE 使用 8° 近轴吸附，离轴通过当前面解析。Alt 绕过方向吸附，Shift 使用最近可投影轴，显式 X/Y/Z 锁轴优先于 Alt。
- 候选 axis / shiftKey 决定是否正交；typedCandidate 不再对所有 FREE 候选强制正交。Feature 只在显式锁轴时拒绝偏轴，避免阻断直接取空间端点。
- handleModifierChange 在按下/释放 Alt、Shift 时刷新当前鼠标候选。modifier 状态属于工具，不进入 Project。
- 快捷搭建负责 RECTANGLE / BOX / CONTOUR 与 L/U/阶梯模板。startProfileDraw 根据 mode 选择左侧面板；单根绘制入口、右侧按长度绘制、右键和 E 均使用 FREE，独立 A 入口已移除。
- 原有 LINE / POLYLINE / DIAGONAL 保留为底层能力，不为移除界面入口做无关架构重构。
- Schema 62、工具版本 6；仍不承诺任意非正交接头或斜切制造自动化。检查结果见 docs/VALIDATION.md。
- 已检查 125 个 JS/MJS、34 项回归和 JDK21 Maven clean test；实际浏览器确认 FREE 中 500 mm 斜杆、撤销/重做、静止鼠标下 Alt 切换、600 mm 搭接连接和快捷搭建面板入口，未验证独立 Tomcat/REST 服务现场启动。

## v0.66 保留能力

- 经登录实际观察嘉立创编辑器的独立临时草稿；原始参考工程未修改，登录信息只用于本次会话，不写入仓库。
- 右侧选择型材进入 FREE 自由绘制，不立即创建零件。点击起点、鼠标确定 X/Y/Z 方向、输入真实切料长度、Enter 或点击确认；完成一根后重新选起点。
- E = 自由绘制，A = 斜向绘制；FREE 内 X/Y/Z 可锁定/解除轴。DIAGONAL 使用当前工作平面，保留既有矩形、箱体、连续和闭合轮廓入口。
- ScreenAxisResolver 使用屏幕投影及射线与轴的最近距离解析空间方向；投影退化的轴不参与自动竞争。ProfileDrawOverlay 只负责就地长度输入。
- FREE/DIAGONAL/LINE/POLYLINE 预览复用实际型材截面挤出实体；Ghost 和输入不进入 Project、BOM 或历史。
- linearSegment() 是预览与提交共同的实体搭接事实源。空白地面竖杆从地面起、从横梁端部转向立柱则从宿主实体表面起；用户输入仍表示新件真实长度。
- 自由绘制的自动连接只调用现有 AutoConnectionResolver / ConnectionManager；候选集合包含新件和吸附宿主，否则 batch 扫描会漏掉接头。
- Schema 保持 62，profileDrawToolVersion = 5。本版回归和浏览器观察见 docs/VALIDATION.md；参考站部分工具尚未开放，不宣称所有功能 1:1 对齐。
- 本版交付检查：124 个 JS/MJS 语法检查、33/33 回归、JDK21 Maven clean test 通过；实际浏览器确认 600 mm 竖杆落地、撤销/重做、轴锁定、输入框取消、500 mm 斜杆和两根 600 mm 型材形成有效设计连接。静态预览不等价于独立 Tomcat/REST 现场验证。

## v0.65 保留能力

- 用户反馈导航过大后，缩为 96 px 卡片 / 88 px 画布；三维复位放到右上角，移除常驻“面·边·角”说明，26 方向菜单侧向展开，不撑大导航本体。CSS 缓存标记为 v0.65.0-ui2，本次仅调整尺寸/排版，未重新运行前版交互回归。

- `quickPanel` 管理左侧可收起的搭建/绘制/批量表单，`rightPanelMode` 管理右侧创建/修改；组件选择必须走 `openResource()`，包括同类别重新打开时。
- `WorkbenchLayoutManager` 将 library 停靠改为 right；库与属性共用右侧轨道，已有浮动/宽度偏好保留。左右开关变化后通知 Three.js resize。
- `ui/ViewCube.js` 提供 26 个真实拾取块；面/边/角方向映射必须与 SceneManager 的 front=+Z、right=+X、top=+Y 保持一致。拖动导航位置与拖动正方体旋转视角分别使用标题手柄/立方体本体。
- `Editor.viewDirection()` 使用标准相机过渡；全部 26 方向菜单供文字选择，不能用 6 个面按钮替代边角拾取。
- `Editor.rotateSelectionQuarterTurn()` 复用 Gizmo mouseDown/objectChange/mouseUp 完整事务；离散旋转跳过平移 Snap，防止点击旋转后意外挪动。
- 空白工作平面首次绘制偏移截面半高；从已有接头续接使用 Feature 世界坐标。`ProfileOrientation` 为绘制、预览、矩形/轮廓和重建统一截面 local Y 朝向。
- 静态 Three.js 浏览器验证：26/26 拾取成功；1010 mm、3030 实际绘制中心 Y=15；12 型材/16 连接框架整体四次 Y+90° 归位且连接有效；干涉旋转回滚且不增加历史；创建/修改和批量面板可用。
- 自动检查：32/32 回归通过，JDK21 Maven clean test 通过；Tomcat 启动仍因环境 UnixDomainSockets/PipeImpl 的 Invalid argument: connect 失败。浏览器为静态资源预览，未将其视为 REST 服务现场验证。

## v0.64 保留能力

- 项目对外名称为 DIY / DIY 铝型材设计器；artifactId 和 spring.application.name 为 diy。Java 包名、SQLite 文件名和浏览器旧存储键故意保留，避免迁移风险。
- Editor.completeProfileConnections() 是“扫描整个结构并补全连接”的领域入口；显式命令使用 force=true，不受“新建构件自动连接”开关影响。
- 扫描只读取现有 PROFILE 几何候选，不移动构件、不替换已有 Connection、不提前绑定制造规则。
- Editor.clearAutoGeneratedConnections() 只清理仍为 autoGenerated=true 的纯自动连接。人工 Quick Change 会先把该标记改为 false，因此不会被批量清除。
- 批量删除仍必须逐个进入 ConnectionManager.removeConnection()，保证派生五金、加工和 Helper 同步清理。
- 连接页状态总览来自 AutoConnectionResolver.connectionOverview()，是即时派生视图，不写入 Project Schema。
- `StaticResourceSmokeTest` 通过 MockMvc 在进程内验证静态资源与 Catalog API；不要重新引入随机端口和本机 loopback 依赖。
- 当前优先级是基础 DIY 建模体验，不继续优先扩装配手册或零件种类：用户必须能明确看出“是否对齐、是否贴合、是否干涉、松手后会发生什么”。
- `SnapManager` 只负责几何候选、锁定和位移；红/绿实体关系由 `InterferenceFeedbackManager` 负责。绿色接触不是 Connection 事实，Cxxx 仍只能由 ConnectionManager/AutoConnectionResolver 创建。
- 拖动真实穿透时默认阻止落位并回滚。任何后续新增的联动移动必须进入同一拖动快照，否则会出现主件回滚而从件残留的问题。
- 连续轮廓的 `Assembly.parameters.points` 是逻辑设计尺寸事实；实体 PROFILE 可以为端面-侧面搭接而派生修剪，禁止为了消除角部碰撞反写逻辑轮廓点。
- SINGLE / CONNECTED / ASSEMBLY 是移动编排策略，不新增 Part/Connection 类型。CONNECTED 通过已有 connections[] 图遍历。
- 右键/接头/关系浮层全部必须做 viewport-safe 定位；删除、移动、复制等高频操作保持第一屏可达。
- 空白画布右键必须保持空白上下文，不能因为场景仍有 selected 而回退到旧构件菜单。
- `ProfileDrawTool` 的键盘输入属于当前绘制状态机：数字+Enter 精确长度，Backspace 撤回上一段，Esc 结束；撤回必须同步清理该段 Connection/Constraint。
- SINGLE 移动只自动移除更新后状态为 INVALID 的关联 Connection；CONNECTED/ASSEMBLY 不执行该清理。
- Schema 62 current-only；全中文；不做报价。

## 1. 当前基线

- 应用版本：**v0.67.0**
- Project Schema：**62**
- Schema 策略：**current-only；不维护历史兼容**
- JDK：21
- Spring Boot：4.1.1
- 数据库：SQLite
- 持久层：MyBatis + XML
- 前端：Vue 3 Global Build + Three.js + ES Modules
- 当前主题：**单一自由绘制入口 / 近轴吸附与离轴斜杆 / 整框快捷搭建**

## 1.0 v0.58 简单关系与安装示意基线

- 轮廓简单关系保存于 `Assembly.parameters.simpleConstraints`，当前支持边等长、边平行和点对齐。
- 这些关系属于 Contour Configurator 的玩家层能力，不得复制进全局 Constraint/Solver 形成第二套通用约束系统。
- `Assembly.parameters.points` 继续是唯一轮廓几何事实源；简单关系只约束/联动 points 的编辑。
- 插点/删点改变拓扑时清空简单关系；不要猜测旧边索引在新拓扑中的含义。
- `ConnectionInstallationDiagram` v2 只生成展示 SVG，安装箭头、螺钉方向和拆卸顺序不得写回 Connection/Hardware。

## 1.1 v0.57 轮廓直接编辑基线

- `Assembly.parameters.points` 仍是参数化轮廓唯一事实源；派生 PROFILE 可以整框重建。
- `ContourFrameManager` 负责点拖动、边长修改、边插点、点删除和覆盖层尺寸标签。
- 正交轮廓修改边长时必须保持相邻边正交，不允许单独拉一根派生 PROFILE。
- L/U/阶梯快捷模板只能调用 `ProfileDrawTool.createContourFrame()`，不得新建第二种轮廓 Part 类型。
- `ConnectionInstallationDiagram` 只生成展示 SVG；连接和五金事实仍来自 Connection + ManufacturingIdentity。

## 1.1 v0.53 交互基线

- `AccessoryPlacementManager` 是标准配件的统一交互入口；不要重新做“选中宿主后立即安装”的第二套 UI。
- 左侧配件库和右键“添加配件”都必须走同一 Placement Manager。
- 连接/配件/加工统一约定：鼠标移动只预览，单击提交，退出键取消。
- 配件 Ghost 必须在提交前做兼容/干涉快速判断；绿色可安装、红色不可安装。
- `mountReference` 仍由 `AccessoryMountManager` 维护，Placement Manager 只编排交互。
- v0.53 曾收敛为 4 个一级入口；**当前 v0.64 按基础 CAD 高频操作使用 文件 / 编辑 / 视图 / 显示 / 移动步长（吸附） / 模型库 / 制造，以当前实现为准。**


## 1.2 v0.56 参数化轮廓基线

- `ContourFrameManager` 是轮廓框后续修改的唯一入口。
- `Assembly.configurator=CONTOUR_FRAME`，`Assembly.parameters.points` 是轮廓事实源。
- 禁止把单根轮廓派生型材的长度当作参数化事实源；点位/边长变化必须整框重建。
- 整框重建时必须移除旧连接和连接派生五金，再由 `AutoConnectionResolver` 重建。
- 装配播放的相机过渡只是 Presentation，禁止写回 Part transform。
- 装配连接局部信息来自现有 Connection + ManufacturingIdentity，不创建第二套连接详情模型。

## 2. 产品定位

目标不是“小型 SolidWorks”，而是面向玩家和不会 CAD 用户的铝型材 Builder。80/20 IdeaBuilder 是主要产品交互标杆。

```text
设计截面
 -> 拖放/绘制
 -> 吸附
 -> 设计连接
 -> 板材/门/配件
 -> 制造配置（真实材料 + 真实连接件/加工）
 -> BOM / 加工 / 工程图 / 制造包
```

## 3. 当前架构决策

### 3.1 每个版本按全新工程维护

- `ProjectSchema.load()` 只接受 schema 62；
- 不写 migration chain；
- 不为旧 `profileSpec / ruleId` 做自动转换；
- sample / tests / docs 必须和当前 Schema 同步。

### 3.2 设计型材与制造型材分离

设计阶段以 `DesignProfileCatalog.js` 为唯一设计目录：截面宽高、系列、槽位、槽宽、封边。

PROFILE：

```text
designProfile.profileId   必填
manufacturingProfile       设计阶段默认 null
```

制造配置由 `ManufacturingConfigurator.configureProfileGroup()` 按设计截面批量绑定真实 Profile Catalog 规格。

### 3.3 设计连接与制造连接分离

设计阶段合法连接类型：

```text
ANGLE_BRACKET
INTERNAL_CONNECTOR
ANCHOR_CONNECTOR
CONNECTION_PLATE
END_SCREW
```

Connection 核心字段：

```text
designType                 必填
manufacturingRuleId         设计阶段默认 null
sourceProfileId / targetProfileId
sourceEnd / targetFace
sourceSlot / targetSlot
```

AutoConnection 和 ConnectionPlacement 只能创建 `designType`，不得偷偷选择 M6/M8 规则。

只有 `ManufacturingConfigurator -> ConnectionManager.configureManufacturingRule()` 才允许绑定真实连接规则，并由 `ConnectionManager.rebuild()` 生成真实五金与连接派生加工。

### 3.4 制造配置顺序

真实连接方案依赖真实型材：

1. 先配置连接两端型材的 `manufacturingProfile`；
2. 再选择 `manufacturingRuleId`；
3. T 螺母等硬件按制造型材真实 `slotWidth` 校验；
4. 更换制造型材后自动重新校验相关连接；
5. 不兼容时清除旧制造规则并回到“待配置”。

### 3.5 制造导出门禁

`exportFactoryPackage()` 先检查 `manufacturingConfigurator.status().ready`。任何型材/连接尚未配置时打开制造配置页面并阻止正式制造包导出。

`FactoryValidator` 继续作为正式生产检查：

- `MANUFACTURING_PROFILE_UNCONFIGURED`：真实型材未映射；
- `MANUFACTURING_CONNECTION_UNCONFIGURED`：真实连接方案未配置；
- 配置完成后继续验证五金、加工、槽位、碰撞和装配完整性。

### 3.6 手动连接仍是玩家操作

`ConnectionPlacementManager.js`：选角码/内置/连接板等设计意图 -> hover Ghost -> 单击接头优先自动推断 -> 歧义时两点选择。

普通用户不拖动/旋转真实角码模型。

### 3.7 工作台布局不属于 Project Schema

`WorkbenchLayoutManager.js` 只把面板宽度、浮动位置和工具条位置保存到 `localStorage`。这些属于用户本机界面偏好，禁止写入 Project JSON。布局变化必须触发浏览器 `resize`，保证 Three.js 相机/渲染器尺寸与新的画布区域一致。


### 3.8 v0.52 交互反馈

- `InterferenceFeedbackManager` 只负责设计阶段快速提示；正式制造碰撞仍以 `FactoryValidator` 为准。
- 移动构件时红色 `BoxHelper` 表示干涉；落位后全局重新检查，问题未解除则红框继续保留。
- 型材吸附预览由 `SnapManager.preview()` 计算候选，`SceneManager.showSnapPreview()` 只负责显示绿色源点/目标点/连接线，不提前改变业务坐标。
- 右键菜单是“当前对象下一步能做什么”的入口，禁止再堆通用 CAD 命令；复杂编辑仍放浮动工具条或属性面板。
- 顶部一级菜单固定收敛为 5 个：文件 / 设计 / 视图 / 制造 / 帮助。

## 4. 当前关键领域链

```text
Project Model
  -> DesignProfile / Anchor / Snap
  -> Design Connection
  -> ManufacturingConfigurator
       -> ManufacturingProfile
       -> ManufacturingRule
  -> ConnectionManager rebuild
       -> Hardware
       -> Machining
  -> Validation / BOM / Drawing / Factory Package
```

Three.js Mesh 只是视图和几何计算载体，不是持久化业务事实源。

## 5. UI 原则

- 页面用户文案使用中文；内部 enum/class/source 可英文。
- 设计页不显示欧标/国标、壁厚、米重等制造属性。
- 制造属性集中在“制造配置”页面。
- 连接页只表达设计连接方式；真实角码、螺钉、螺母和加工在制造配置中确定。
- 文件格式名 SVG/DXF/JSON 可作为技术格式名保留，但普通按钮/状态/检查文本不得直接显示 Warning/Error/Feature/Snap 等内部词。

## 6. 报价范围

用户明确：**报价相关先不要。**

不做单价、总价、成本估算、供应商价格比较、订单和库存。

## 7. v0.54 当前制造与装配基线

1. `ManufacturingIdentityManager` 是制造编号唯一分配入口；禁止各导出器自行生成另一套编号。
2. 编号前缀：P 型材、B 板材、S 光轴、A 独立配件、H 连接派生五金、C 连接、M 加工、G 组件。
3. `AssemblyManager.normalizeAssembly()` 必须保留 `manufacturingCode`，保证保存/重开后组件编号稳定。
4. `AssemblyInstructionGenerator` 先建立完整步骤，再把跨步骤连接归到较晚步骤；同一连接/五金不得在多个步骤重复。
5. `EngineeringDrawingModel` 的 `tags` 使用制造编号；默认不标自动连接派生五金，五金通过 BOM/装配步骤追溯。
6. 工程中心装配步骤支持定位、步骤高亮、分步爆炸和还原。
7. v0.55 已完成 Contour Creator 基础版和装配步骤播放器；下一步优先轮廓编辑增强、连接详图和装配说明可读性，STEP 继续后置。

### 7.1 v0.55 轮廓与装配播放基线

- `ProfileDrawTool` 的 `CONTOUR` 是轮廓框唯一入口；不要另建独立 Mesh/Project 类型。
- 轮廓完成后必须生成普通 PROFILE + Assembly，并复用 AutoConnection。
- 闭合前必须至少 3 点；短边和自相交必须阻断。
- `AssemblyPlaybackManager` 只属于 Presentation 层：禁止把播放偏移写回 Part transform。
- 播放数据来源只允许使用 `AssemblyInstructionGenerator`；不要维护第二套步骤模型。
- 未安装步骤可以临时隐藏，但退出播放必须完整恢复原可见性。

## 8. 交付验证

```bash
find src/main/resources/static tools -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | xargs -0 -n1 node --check
for f in tools/verify-*.mjs; do node "$f"; done
mvn clean test
```

若执行环境没有 Maven，必须明确写“未执行”，不得当成通过。
