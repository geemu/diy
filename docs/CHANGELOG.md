# Changelog

## v0.75.9

- 新增只读真实表面提示：吸附候选面绿、结束接触带蓝、选择橙金；保留孔槽/红色干涉优先，清理提示不影响工程。
- 精简移动柄显示几何并保留正反双向事务；五金增加本地环境金属反射，通用角码细化孔和侧肋，安装角点保持。
- 修改页连接内卡和加工卡统一深色；修复下拉框各状态、状态徽章、窄面板排版及过期加工入口说明。
- 新增真实三角面/贯通孔/局部裁剪/只读/资源释放回归；全量静态版本映射更新，Schema 62 不变。

## v0.75.8

- 镜像改为“镜像方向 / 对称位置 / 以画布原点为基准 / 以所选构件中心为基准”，圆周复制明确实际中心；移除相关用户提示中的世界/局部轴术语。
- 批量面板新增未选中原因、Shift 多选提示和动态选择数量；执行按钮仍只处理当前选择，不更改原禁用条件或领域算法。
- 新增术语/选择范围回归；版本及全部本地模块缓存参数 0.75.8，Schema 62 不变。

## v0.75.7

- 移除带孔挤出上的重复纯黑圆筒，正交夹具的孔内壁与外表面共用受光金属材质，消除浅色画布上不随光照变化的黑孔覆盖。
- 右侧出料口、预放置和正式构件仍复用同一几何工厂；实际通孔/相交孔裁剪不变，不添加白色封口。保留盲槽底、黑件配色与合法性预览颜色。
- 新增 95 组夹具、134 组连接规格及 5 组带孔配件检查；版本与全部本地模块缓存参数同步 0.75.7，Schema 62 不变。参考站白孔的具体选中状态尚待用户补图核对。

## v0.75.6

- 主画布显示锚点改为横向 50%、纵向 47%，匹配用户标记；透视、正交与 resize 一致，不移动原点、旋转中心或模型。
- 对所有 101 个本地 JS 使用统一 importmap 版本，解决只更新 HTML/app.js 却继续运行旧内部模块；JS/CSS 增加 no-cache 校验，vendor 映射不变。
- 实际缓存复现：旧交点约 65.3%，更新 HTML 后普通刷新到 47%，无需反复清缓存。
- 滑轨预览显示开放槽轨侧，统一右上斜向和留白；脚杯金属/橡胶区分高光，黑色小件轮廓更清楚；端盖明确显示实际适配截面。
- 461 组配件预览/提交几何与材质一致检查，版本/缓存 0.75.6，Schema 62 不变。

## v0.75.5

- 视角立方体改为轻透视及受光材质，加入方向明暗、外轮廓和轻阴影，强化上前两个面的立体感；加深文字，保留紧凑尺寸。
- 展示轮廓不参与拾取；原 6 面、12 边、8 角及拖动/点击功能保留，导航朝向不伪造第三个可见面。
- 初始化/新建空白的观察中心改为原点，红绿轴交点居中；空白切换视角/小房子/适配也保留原点，上前 45° 方向和初始观察距离不变，不移动工程构件或改动已有模型适配。
- 新增导航构造/射线/投影回归；版本/缓存 0.75.5，Schema 62 不变。

## v0.75.4

- 移除底栏常驻快捷键/长构件名称，将按钮说明、绘制步骤、选择详情移入统一深色 tip；原生 title 同步移除，避免重复浮层。
- 操作按钮独立横向滚动，右侧提示入口和单位真实固定占位。底栏仍 48 px 单行，窄屏状态区不被按钮覆盖。
- Tip 支持悬停、键盘聚焦和点击提示入口，Teleport 到 body 并按实际尺寸限制到视口；滚动/点击操作/resize/Esc/卸载清理，过期 nextTick 不再显示旧提示。
- 绘制时可见起点/终点短状态；结束/确认/取消、规格框内 Esc、快捷旋转和更多菜单继续有效。新增提示事件/布局回归，版本/缓存 0.75.4，Schema 62 不变。

## v0.75.3

- 修复封边误填整个 T 槽内腔；侧面保持封闭，端面保留真实贯通槽腔、中心孔和其他参考孔。默认封闭型号及手工封边共用同一生成链，预览与画布一致。
- 分离几何槽定义和可安装槽位；封闭面仍不提供安装槽位。具体型号参考孔避开新保留槽腔，R 中心孔避开槽轮廓；数据库/DXF 精确截面不变。
- 无限 XZ 画布增加红色 X 轴、绿色 Z 轴，正负半轴贯穿原点，四象限网格配色保留；网格开关同时控制轴线，不参与模型事实。
- 主操作、快捷旋转、视图开关合并为 48 px 单行独立底栏；窄屏横向滚动。更多菜单改视口定位，处理滚动/聚焦时序，避免裁切或误关闭。
- 新增 608 组封边组合、3536 条贯通孔射线、1360 条封闭壁面射线及端面面积检查；完整验证范围见 VALIDATION。版本/缓存 0.75.3，Schema 62 不变。

## v0.75.2

- 主工具条、绘制确认/取消、快捷旋转和状态按钮移入独立工作台底栏；真实画布在底栏上方结束，不再覆盖模型。
- 底栏使用实色和分隔线，窄窗口自然换行；通过 ResizeObserver 同步 Three.js 渲染尺寸，更多菜单仍向上展开。
- 移除主工具条拖动手柄并忽略旧 toolbar 浮动位置，视角导航/面板布局保留；组件只在 canvas-stage 拖放落位。
- 新增底栏位置契约、旧布局忽略及生命周期检查；版本/缓存 0.75.2，Schema 62 不变，浏览器验证见 VALIDATION。

## v0.75.1

- 启动和空白新建改为用户指定的上前 45° 视角，无右向偏移；三维复位和其他命名视角保持原语义。
- 去除独立绘制大卡片，连续添加、确认这一根、取消当前段并入主工具条，状态栏显示起终点和退出提示；主工具条结束、Esc、右键继续有效。
- 官方目录核实 2020A/B、3030A/B/H/T、3060A/B、4040F/H/T 的封闭面与槽位；内置共用外轮廓保留型号差异和圆弧。预览优先露出封面，不能再仅换标题。
- 修正参考内孔与 T 槽相交导致的端面破裂，精确目录/DXF 不受影响；型号切换移除旧默认封面并保留额外手工封边。制造材料依然单独配置。
- 新增 44 个真实几何面/槽位检查、上前视角与紧凑绘制栏检查；版本/缓存 0.75.1，Schema 62 不变。资料与精度边界见 reference/README.md。

## v0.75.0

- 型材按外截面尺寸归组，A/B/R 等具体型号放在第二级；复用已有目录几何，保留真实 ID 和槽位。右侧创建/修改/替换与框架/模板/门框使用同一 ProfileSelector。
- 具体型号只投影设计几何，不提前完成制造配置；数据库截面/DXF 继续优先，显式无槽不会凭空提供吸附槽位。目录没有的 3030N1 不伪造。
- 世界/局部改为画布方向/构件方向，并解释轴向与旋转中心独立；旋转条支持直接切换。修正属性封边按钮残留白底。
- 首次进入改为上/前/右三维方向，与新建工程和小房子复位一致；26 视角和手动查看保留。
- 新增两级联动、真实型号几何/槽位、保存恢复与默认三维方向回归；版本/缓存 0.75.0，Schema 62 不变。

## v0.74.0

- 平移手柄从六支箭头减为三支正轴箭头；移除负轴隐藏 picker，中心/平面柄和旋转不改。世界/局部三轴均支持同柄正反方向移动。
- 构建期从现有 WebJar 本地交付 RoomEnvironment，主画布生成 PMREM 柔光金属反射；调整型材金属度/粗糙度与边缘线。
- 新增截面凸包内槽展示暗部，仅改变顶点色，不移动顶点或改截面/制造尺寸；凸圆弧外表面、端面保持原色。预览转换保留 vertexColors。
- 新增双向拾取拖动和几何不变回归；版本/缓存 0.74.0，Schema 62 不变。

## v0.73.3

- ViewCube 上下拖动改为可见面跟随鼠标，左右拖动不反转；观察中心、缩放距离和 26 方向点击选择保留。
- 型材预览移除旧浅色列表样式，修复 hover 白底与卡片位移；五类预览 hover/active/selected/focus-visible 统一黑底，橙色边框和键盘焦点轮廓。
- 增加 48 个屏幕投影方向回归和预览状态断言；版本/缓存 0.73.3，Schema 62 不变。

## v0.73.2

- XZ 网格四象限分别用蓝、紫、橙、青线色，中心轴保留灰蓝；只改变线条，不染地面底色。
- 世界交点决定颜色，透视/正交和旋转/平移均保持象限归属；网格开关、无限远与抗锯齿保留。网格按钮增加配色提示。
- 版本/缓存同步 0.73.2，Schema 62 不变，不改变吸附、绘制或持久化模型。

## v0.73.1

- 加深无限网格线色，提高细格与粗格对比；保留实线中心、边缘抗锯齿，修正整体线条过淡。
- 中远景线条较地面渐变更晚淡出，仍在地平线连续融合；版本/缓存 0.73.1，Schema 62 不变。

## v0.73.0

- 新增 InfiniteGround，屏幕射线求交渲染无边界 XZ 地面；移除固定 20 米网格、100 米底板与场景距离雾。
- 网格按世界坐标延伸至地平线，展示格距 200 mm，远处渐变及像素级抗锯齿/粗细过渡随相机调整。缩放和平移不暴露固定边缘。
- 保留透视/正交、26 视角与网格开关；地面不写深度、不参与选择或模型保存，吸附步长与绘制尺寸不变。
- 新增逆矩阵射线回归，版本与缓存更新 0.73.0，Schema 62 不变。

## v0.72.0

- 从单个 L 夹修正扩展到五类全目录复看，保留 16 型材 / 18 连接 / 10 光轴 / 11 板材及几何体 / 4 配件与既有动态规格。
- 修正光轴夹本体、SK/SHF 安装台和真实主孔、固定环、角码筋、层板托、曲线 A 柱托架、半圆面板固定件、开槽插接臂、叉形铰链、脚杯与不同螺钉头型。
- 五类预览统一中性哑光、孔内暗壁、相机朝向和留白；新增 CatalogPresentation，独立控制同类小件观察尺度。卡片为 238 px 黑底画布，标题和点击选中信息悬浮，不压缩模型区域。
- 恢复 R 型材的 R 标签；展示圆弧面而不是背面槽。板材使用一致蓝灰材质并展示实际尺寸。
- 主画布增加非遮挡灰蓝地面、100 mm 展示网格、远处雾化淡出与较低正面透视，保持毫米模型、吸附及 26 方向导航不变。
- 新增 95 个光轴主孔射线回归，全部检查与浏览器实际六构件保存/重开通过；版本及缓存同步 0.72.0，Schema 62 不变。独立模型仍需制造前核对。

## v0.71.1

- 修正 L 型直角固定夹的错误通用立板：实际构件与预览共同使用前低后高阶梯块，主轴孔、顶孔、侧孔与小紧固孔。
- 正交通孔构造真实外表面开口和内壁，删除孔交会处的内壁；目录主孔偏移同步安装。新增 7 种孔径的射线穿孔、空台阶和实体保留检查。
- 调整此夹具的观看方向、中性哑光、孔内暗面及预览留白；调整相机而不是缩小实际零件。切换其他组件时恢复灯光。
- 五类目录表单标签统一 14 px / 500 字重、6 px 下间距与 16 px 行间距；组件选择框使用 14 px 文字。
- 缓存/版本标识同步到 0.71.1，Schema 62 不变；不宣称其他组件已达到像素一致或制造尺寸一致。

## v0.71.0

- 实际核对公开参考编辑器五类目录，保留版本化原始选项事实；主类型、规格顺序、封边和级联选择不再使用此前精简目录。
- 型材含 16 个参考选项、7 个扩展型号，新增 R 圆角和 U 型 A 柱截面；槽口与封边进入实际几何，A 柱提供常用长度和自由添加。
- 新增 18 类连接、134 个二级规格、10 类光轴组件、11 种板材/几何体及滑轨/紧固件/端盖/脚杯级联参数，保留扩展数据库配件和既有高级工具。
- ComponentGeometryFactory 统一独立本地预览与实际添加；黑底卡片、观看角度、预览占比及参数布局同步收敛。不是复制参考站图片或专有模型。
- 区分带筋角码、重型长角码、滑块长孔、三向插接臂与叉形铰链；L 板斜角规格改变实际臂夹角，不用通用方块或整体旋转替代。
- 光轴夹新增按主孔中心的 SHAFT_AXIS 安装与站位随动；复杂连接件明确自由放置边界，已有七类目录映射接头流程，15 系列暂为自由放置。
- 板材形状参数支持属性编辑、保存校验和异形 SVG/DXF 轮廓/内孔；曲面设计参考模型、通用组件保留制造前核对提示，不冒充完整加工方案。
- 组件放置支持 Esc / 右键短单击 / 切换取消，确认一次后结束；自由添加按实际包围盒落工作面，Ghost 与业务数据分离并清理资源。
- 修复安装端盖时拉伸手柄抢点击、属性变换后摘要不刷新及干涉回滚后悬空选中；端盖轮廓沿用实际 R/U 截面，规格框聚焦时 Esc 也能取消放置。
- Schema 62 / 绘制工具版本 7 不变，版本和资源缓存更新至 0.71.0；新增 verify-component-catalog-v071.mjs，验证实际 Three.js 几何和形状序列化。

## v0.70.0

- 修复深色表单被旧 hover/focus 规则覆盖，统一原生选项、禁用、占位符和键盘焦点可读性。
- 左轨清除重复橙色标记与厚阴影；显示和吸附菜单统一深色行、右对齐勾选及 aria-pressed，不再出现浅色大选中块。
- 连接、光轴、板材和配件改为与型材一致的规格选择、三维预览、点击使用；框口/门组件和连接管理按需展开，保留既有领域链。
- 复用实际几何工厂生成本地预览，自适应长宽比、居中和释放 WebGL 上下文；不使用参考站的远程图片或品牌素材。
- 补齐快捷搭建、只读属性、目录管理与连接状态块的深色样式；新增件材质配色与板材预览一致，拒绝无效尺寸。
- 新增 tools/verify-catalog-consistency-v070.mjs；Schema 62 / 绘制工具版本 7 不变。

## v0.69.0

- 删除左侧重复的自由绘制入口与表单，右侧统一规格选择、真实截面 3D 预览和点击绘制；首次 E 提示选材。封边/弯型设置不再重复截面选择。
- 参照 LewanDIY 实际编辑页统一深色顶部/左轨/右库、浅蓝网格、橙色选中、底部玻璃工具条；保留 DIY 品牌、独立本地 SVG 图标、紧凑 26 方向立方体及快捷旋转。
- 新建空白工程与鱼缸架示例分离；补充重命名、保存反馈、名称同步、替换未保存工程确认与空撤销/重做反馈。
- 修正窄窗口左侧面板遮挡菜单；帮助/工程中心/制造配置/检查支持 Esc 关闭，阻止模态窗口背后的建模快捷键。
- 统一弹窗、工程表格、制造配置和提示配色；目录 3D 预览支持随宽度变化刷新并清理资源。
- 适配全部根据包围球、视场角、实际画布比例留出余量；修正窗口 resize 对正交 zoom 重复应用。
- 新增 verify-catalog-workbench-v069，包含唯一选材、菜单真实入口、替换确认、18 个适配情况；Schema 62 / 工具版本 7 不变。

## v0.68.0

- 取消简单/专业模式和工程中的 workbenchMode；精确连接、扩展加工、斜切与几何关系改为按需展开。
- FREE 默认完成一根即退出，连续添加是显式开关；选中成品并自动打开右侧属性，进入绘制时显示组件库。
- 画布常驻确认、取消当前段和结束按钮；Esc、右键单击一次退出，输入框聚焦时行为一致，已完成构件不受影响。
- 修复非左键 pointerup 误入点击提交链；右键拖动保留视图平移，不误结束或提交型材。
- 选择/移动/测量/标注/框选/右侧页签切换统一退出临时放置工具；就地输入值优先于旧键盘长度缓存。
- 统一浅色面板、橙色操作强调、菜单/表单/工程中心和浮动工具；状态色保留，通知不再遮住主工具条。
- 修复笔记本窄窗口操作侧栏遮挡工具与结束按钮；保持紧凑 26 方向导航和快捷旋转。
- 主工具条保留高频六项，“更多操作”承载其余工具并复用菜单自动收起；总尺寸概览移开工具条，避免重叠。
- 修复菜单 pointerdown 提前收起导致按钮 click 丢失/画布误触；顶部菜单和更多菜单统一在 click 后关闭。
- Schema 保持 62，绘制工具版本 7；增加交互退出回归，同步样例与缓存版本至 0.68.0。

## v0.67.0

- 绘制界面收敛为自由绘制；移除独立斜角、单根、连续绘制按钮与 A 快捷键，右键与按长度绘制同步使用 FREE。
- 自由绘制支持 8° 屏幕近轴吸附和离轴斜杆；X/Y/Z 锁轴、Alt 强制斜向、Shift 临时正交，按下/松开修饰键时立即刷新。
- 输入长度保留当前斜杆方向；未锁轴允许吸附空间端点，锁轴拒绝偏轴候选。
- 右侧“按此长度绘制”也使用真实切料长度，端部转向不从指定长度中扣掉搭接预留量。
- 矩形框、空间框、轮廓框和 L/U/阶梯模板归入快捷搭建，绘制面板不再列出多个模式。
- Schema 保持 62、绘制工具版本 6；保留统一 Manager、预览/提交与连接/干涉保护，不扩展斜切制造方案。

## v0.66.0

- 实际观察嘉立创自由绘制和斜向绘制流程，以独立临时草稿操作，不修改原始参考工程，不保存登录信息。
- 右侧选择型材改为进入自由绘制：起点、鼠标方向、真实截面实体 Ghost、输入长度、确认提交；选择和悬浮不创建零件。
- E/A 分别进入自由/斜向绘制；自由绘制可从屏幕鼠标方向选择正负 X/Y/Z，支持 X/Y/Z 锁轴，沿用 Ctrl 临时绕过吸附。
- 新增就地 mm 输入框，Enter 确认、Esc 取消当前段；原有画布数字输入与矩形/箱体/轮廓工具继续保留。
- 空白地面竖杆从地面起，横梁端部转向立柱从实体表面起。预览与提交共用搭接计算；输入 600 mm 即生成真实 600 mm 新件。
- 端部转向搭建后复用现有自动连接链创建设计连接，发生真实实体穿透则回滚，不增加提交历史。
- Ghost 仅存在于显示层，复用同一个预览对象，不参与工程保存、BOM 或制造事实。
- 绘制反馈长度与实体/输入统一，搭接后的中心线距离不再混入底部长度提示。
- Schema 62 保持不变，profileDrawToolVersion 升级为 5，应用及静态缓存版本同步至 0.66.0。
- 保持左右面板职责、紧凑 26 方向 View Cube 和快捷旋转；不引入报价、供应商、订单、库存或历史兼容。

## v0.65.0

- 导航尺寸微调：卡片宽 158 → 96 px、画布 148 → 88 px，移除常驻说明与独立复位行；复位放在右上角，26 方向菜单侧向弹出。更新 CSS 缓存标记，面/边/角拾取逻辑保留。

- 左侧改为快捷搭建、绘制搭建、批量操作、补全连接、组合组件、检查、测量、适配；搭建/绘制/阵列表单迁移到左侧可收起操作面板。
- 右侧新增创建/修改页签；型材、连接、光轴、板材、配件、加工分类集中到组件库，原属性编辑继续保留；库和属性共用右侧停靠轨道。
- 新增实际三维 View Cube，6 面、12 边、8 角均可拾取；同步相机朝向、拖动旋转，增加全部 26 视角文字入口和三维复位。
- 新增 X/Y/Z +90° 按钮与 Alt+X/Y/Z，沿用世界/局部坐标与移动作用域，并复用约束、随动、干涉回滚、历史和连接刷新。
- 修复空白工作面绘制时型材中心线落在网格上的问题：中心线偏移半个截面厚度，型材外表面贴在工作面上。
- 统一矩形截面绘制、预览、搭接修剪及轮廓重建朝向；已有接头吸附坐标优先，BOX 保持底面定位。
- Schema 保持 62；新增 26 方向和 15 组矩形截面贴面几何回归。32 项脚本与 JDK21 Maven 测试通过。

## v0.64.0

- 项目对外名称统一为 DIY / DIY 铝型材设计器；Maven artifact、Spring 应用名、页面标题与新工程 generator 同步为 diy / DIY Web。
- 保留 Java 包名、SQLite 文件 ./data/aluminum-cad.db 与既有浏览器存储键，避免本地数据或布局偏好因改名丢失。
- 连接页新增全部、纯自动、手工/已改、几何失效四项状态总览。
- 新增“扫描整个结构并补全连接”：扫描现有 PROFILE 接触关系，复用 AutoConnectionResolver/ConnectionManager，只补缺失设计连接，不移动构件。
- 用户主动扫描可绕过“新建构件自动连接”开关；开关语义收敛为只控制后续绘制、拖放和模板生成。
- 新增“清除纯自动连接”：只移除仍为 autoGenerated=true 的连接；手工和已人工切换方案的连接保留，派生五金/加工统一由 ConnectionManager 清理。
- 补全/清除均进入现有 Undo/ProjectChanged/Stats 链；编辑菜单提供同名快捷入口。
- 新增 verify-builder-connection-v064.mjs，覆盖显式强制扫描、设计连接分层、安全清除与状态统计。
- 连接安装图卡恢复“拆卸顺序：3 → 2 → 1”，打印装配说明继续复用同一图卡。
- 修复 StaticResourceSmokeTest 少传断言参数以及仍检查旧 Schema 的陈旧断言，并改用 MockMvc 进程内请求，避免测试依赖本机端口。
- 全部历史回归断言同步到 v0.64.0 / Schema 62 当前契约。
- autoConnectionSystemVersion 升级为 2；Project Schema 保持 62；报价、单价、成本继续暂缓。

## v0.63.0

- Project Schema 升级为 62，current-only。
- TransformControls 接入自由 / 1 / 5 / 10 / 50 mm 平移步长和旋转步长，拖动时显示轴向位移/角度 HUD。
- SnapManager 增加端面/槽中心/端点优先级、候选滞回锁定与 Ctrl 临时绕过，减少吸附目标抖动。
- 实时实体关系升级：绿色表示有效面接触/吸附，红色表示真实 PROFILE OBB 穿透；红色落位默认自动恢复拖动前状态。
- 连续折线、矩形与参数化轮廓改用端面-侧面真实搭接派生，修复中心线角点直接生成实体导致正常闭框误报干涉的问题。
- 绘制预览增加穿透预判：即将发生干涉时预览线和提示直接变红，并给出目标构件和估算穿透量。
- 移动增加单个 / 保持连接 / 整个装配三种作用域；组内构件不会被误当成外部吸附目标。
- 顶部 CAD 菜单按用户参考界面重排；右键/接头/关系浮层统一使用真实尺寸做视口避让，高频操作放第一屏。
- 连续/轮廓绘制支持直接数字输入长度并回车提交；退格可撤回连续绘制上一段，Esc 结束；Ctrl 真正临时绕过几何/网格吸附，Shift 可临时正交。
- RECTANGLE / CONTOUR / BOX 提交前统一做实体干涉阻断，避免红色方案写入工程。
- 空白画布右键与构件右键分流；型材右键增加内联长度编辑，可选择固定 A 端或固定 B 端。
- 单个移动后自动移除因几何分离失效的连接；保持连接/整装配移动不拆连接。
- 修复 `Editor.updateSelectedGeometry()` 中未定义 `options` 的遗留分支。
- Ctrl+S 接入当前 JSON 工程保存。
- 全中文；报价、单价、成本继续暂缓。

## v0.61.0

- Project Schema 升级为 60，current-only。
- 新增独立于当前连接工具的接头几何解析：鼠标靠近/右键接头直接显示真实可用的连接候选，不再要求先去左侧选连接工具。
- 快捷连接候选来自 `ConnectionManager.recommendDesignFor()`；选择后可在当前接头直接安装，存在歧义时才回退到已有两点选择。
- 开放型材端部显示匹配设计截面的端盖候选，并复用配件 Ghost 预览/单击提交链。
- `＝ / ∥ / 横 / 纵` 关系标记增加画布就地编辑卡，可调整对象、切换关系、删除关系，并与右侧属性同步。
- `ConnectionInstallationDiagram` 升级：每个 Cxxx 同卡展示接头局部放大、二维安装方向、安装步骤和本接头五金。
- 全中文；报价、单价、成本继续暂缓。

## v0.60.0

- Project Schema 升级为 59，current-only。
- 轮廓编辑画布新增简单关系图标：等长、平行、横向/纵向对齐可直接点击定位。
- 属性面板关系列表支持反向高亮对应画布图标。
- 新增 `AssemblyGuideDocument`：工程中心提供一页一步的装配说明书阅读模式。
- 装配说明支持上一页/下一页以及整套打印；打印页包含构件、连接二维示意、五金、前置步骤和安装/拆卸顺序。
- 报价、单价、成本继续暂缓。

## v0.58.0

- Project Schema 升级为 58，current-only。
- 参数化轮廓新增 `simpleConstraints`，支持边等长、边平行和点横向/纵向对齐。
- 等长关系在边长修改时联动；平行/对齐关系会阻止破坏关系的轮廓提交。
- 插入或删除轮廓点会清除拓扑相关简单关系，避免旧索引错绑。
- `ConnectionInstallationDiagram` 升级为 v2：增加安装方向、螺钉插入方向、1→2→3 安装顺序和 3→2→1 拆卸顺序。
- 报价、单价、成本继续暂缓。

## v0.57.0

- Project Schema 升级为 57，current-only。
- 参数化轮廓编辑覆盖层增加可点击尺寸标签；点击尺寸直接输入精确边长。
- 编辑模式支持右键轮廓边插入转折点、右键控制点删除，并继续执行短边/自相交/正交合法性校验。
- 修正正交轮廓边长修改：位移沿后续垂直边传播，矩形/L/U 轮廓不会因改一条边产生斜边。
- 新增 `ContourPresetFactory`：L 型 / U 型 / 阶梯型快捷生成，继续复用 PROFILE + Assembly + Auto Connection。
- 新增 `ConnectionInstallationDiagram`：装配 Cxxx 连接显示二维安装示意、两端构件编号和当前连接五金。
- 报价、单价、成本继续暂缓。

## v0.55.0

- Project Schema 升级为 55，current-only。
- `ProfileDrawTool` 新增闭合轮廓绘制：任意转折点生成标准 PROFILE 框架，并复用 Assembly/Auto Connection。
- 闭合轮廓增加短边和自相交阻断。
- 新增 `AssemblyPlaybackManager`：装配步骤支持播放/暂停、上一步、下一步和单步动画装入。
- 播放时后续构件临时隐藏，退出后完整恢复；播放不修改业务 Part transform。
- 报价、单价、成本继续暂缓。

## v0.54.0

- Project Schema 升级为 54，current-only；统一制造编号成为当前工程正式数据。
- 新增 `ManufacturingIdentityManager`，统一 P/B/S/A/H/C/M/G 编号并贯穿属性面板、BOM、工程图、制造包和装配步骤。
- Tagged Drawing：SVG/DXF 总装图使用同一制造编号引线标签；默认排除自动连接派生五金，减少图面拥挤。
- 新增 `AssemblyInstructionGenerator`：按组件安装顺序生成装配步骤，未分组工程提供主体型材/板材/独立配件建议顺序。
- 跨步骤连接归属到后安装步骤，连接派生五金只出现一次，并显示前置步骤。
- 工程中心装配步骤支持三维定位、当前步骤高亮、分步爆炸和还原。
- 制造包新增 `装配步骤.csv` / `装配步骤.json`。
- 报价、单价、成本继续暂缓。

## v0.53.0

- 新增 `AccessoryPlacementManager`：端盖、脚杯、脚轮、滑轨等标准配件改为“选择 -> Ghost 预览 -> 单击安装”。
- 配件 Ghost 绿色表示合法安装，红色表示目标不兼容或与其他构件发生明显干涉；确认前不写入 Project。
- 右键型材/板材“添加配件”保留右键位置，选配件后直接在该处预览并单击确认。
- 连接 / 配件 / 加工三类放置工具统一为 hover-only preview / click commit / Esc cancel。
- 型材 Transform 拖动时将 Snap Preview 同步到界面，显示“即将吸附”，完成吸附后才显示提交提示。
- 顶部菜单从 5 个继续收敛为 4 个：文件 / 设计 / 制造 / 更多；视图与帮助归入更多。
- 延续 v0.52 实时干涉红框和右键上下文操作，延续 v0.51 可拖动工作台。
- 保持 Schema 50；报价功能继续暂缓。

## v0.51.0

- 工作台左右面板支持停靠、浮动拖拽和宽度调整。
- 顶部三维工具条、视图导航支持拖拽和双击复位。
- 布局状态使用浏览器本地存储，不进入工程 JSON。
- 新增“复位工作台布局”。
- 工程中心材料/配件/加工清单支持双击定位三维构件。
- 保持 Schema 50；报价功能继续暂缓。

## v0.50.0

- Project Schema 升级为 50，继续 current-only，不兼容历史工程。
- 新增 DesignConnectionCatalog，设计连接不再绑定 M6/M8 等真实制造规则。
- Connection 使用 `designType + manufacturingRuleId` 两层模型；自动/手工连接只创建设计连接。
- 新增 ManufacturingConfigurator：设计截面批量绑定真实制造型材，设计连接绑定真实制造规则。
- 未配置两端制造型材时禁止配置真实连接规则；T 螺母按真实制造槽宽校验。
- 更换制造型材后重新校验相关制造连接，不兼容时自动清除制造规则。
- 制造包导出增加配置完成门禁；FactoryValidator 增加制造材料/连接未配置阻断。
- BOM/材料清单按真实制造规格分组；制造检查用户文案中文化。
- 报价、单价、成本估算继续暂缓。

## v0.49.1

- Project Schema 升级为 49，当前版本只接受 Schema 49，不做历史工程迁移。
- 新增 DesignProfile 设计目录，制造规格后置，PROFILE 默认 `manufacturingProfile=null`。
- 新增封边语义，封闭侧面不再提供槽位连接 Anchor。
- 玩家式连接支持单击接头吸附，歧义时退回两点选择；加入 Ghost Connector。
- 新增目标侧面独立解析，修复框架角点靠近端部时角码目标面难以选择。
- 玩家式加工按点击位置创建并显示 Ghost Machining。
- 默认简易模式，顶部菜单自动收起，用户可见工作台继续中文化。
- 报价、价格、成本估算暂缓。

## v0.48.0

- Panel / Door Configurator 1.0：4 根矩形直线型材识别净框口。
- 框口自动填板支持留缝、材质、厚度、法向偏移及重新适配。
- 门组件自动生成 4 根门框型材、门芯、通用铰链/拉手、Assembly，并复用 Auto Connection。
- Profile Replacement：当前选择 / 当前组件 / 工程同型号替换，保持 Part ID/中心线/长度/装配。
- 替换后重算 Connection，必要时复用 Quick Change 自动修复；失败接头保留 INVALID。
- 新增 `panelDoorConfiguratorVersion=1`、`profileReplacementVersion=1`；Schema 仍为 41。

## v0.47.0

- 新增连接方案原地 Quick Change：角码 / 内置 / 锚式 / 连接板 / 端面螺钉可按当前几何兼容性切换。
- Connection ID 保持不变；切换自动重建紧固件、加工和 BOM，失败自动回滚。
- 自动连接被用户修改后记录 `userOverridden` / `autoOrigin`；新增 `connectionQuickChangeVersion=1`。

## v0.46.0

- 新增 IdeaBuilder 风格 `AutoConnectionResolver`，统一编排拖拽/拉伸/绘制/模板生成后的自动连接。
- 自动连接继续复用 `ConnectionManager -> Hardware/Machining -> BOM`，不建立第二套连接或加工模型。
- TransformControls、Profile Grip、零件库拖放、ProfileDraw LINE/BOX、DIY Template 全部接入。
- DIY 模板增加自动安装连接件开关；批量解析避免双向候选和同源端重复连接。
- `editorState.autoConnectionSystemVersion = 1`；自动连接开关写入 `autoConnectionEnabled`，Connection 增加可选自动来源元数据。
- 新增 `verify-auto-connection-v046.mjs`；Project Schema 保持 41。

## v0.45.1

- 正式将 80/20 IdeaBuilder 设为主要产品标杆。
- 新增根目录 `IDEABUILDER_PARITY.md`，逐项映射官方能力、现状、缺口和目标版本。
- 后续路线收敛为 Auto Connection、Quick Change、Configurator、Live BOM、Design Check、Tagged Drawing、Assembly Instructions。
- 明确采购 XML、经销商、商城、供应商体系、原料排料与库存仍为 OUT OF SCOPE。
- Project Schema 仍为 41；无数据库结构变化。

## v0.45.0

- 数据库从 MySQL 切换为 SQLite，默认文件 `./data/aluminum-cad.db`。
- `pom.xml` 改用 `org.xerial:sqlite-jdbc:3.53.4.0`。
- DDL、初始化数据和 Profile Catalog Upsert 全部改为 SQLite 语法。
- 新增 DIY 快速设计模块：基础空间框、多层置物架、鱼缸/龟缸架、设备机架。
- 新增 `Editor.addLayeredRack()`，支持层数与每层中间承托梁。
- DIY 模板只调用 Editor 领域 API，不建立第二套 Part/BOM/Three.js 模型。
- 新增 `verify-sqlite-v045.mjs`、`verify-diy-v045.mjs`。
- Project Schema 保持 41。

## v0.44.0

- 工作台重构为专业 CAD 信息架构：深色顶部菜单、操作型左侧工具栏、浅色建模画布。
- 新增文件/编辑/视图/显示/工程/模型库/零件库/帮助菜单。
- 左侧工具栏改为移动、旋转、自由选择、镜像复制、组合组件、创建子装配、测量、标注和视图适配。
- 新增工程中心，可直接查看型材材料清单、标准配件清单、逐 Feature 加工清单。
- 工程中心新增 SVG/DXF 工程图和制造包导出入口，继续复用原有工程图与 Factory Package 领域服务。
- 视觉参考用户提供的 LewanDIY 编辑器截图：深色工具区 + 浅色画布 + 橙色强调色。
- 应用版本升级为 v0.44.0；Project Schema 继续保持 41。

## v0.43.5

- CAD 顶部“套索”改为“自由选择”，并补充不规则区域选择的中文悬浮说明。
- “成组”改为“组合组件”，“取消分组”改为“取消组合”，明确该操作只建立组件关系、不合并几何实体。
- “镜像”改为“镜像复制”，生成器和右键菜单同步中文化，并保留原地镜像模式。
- “建子装配”改为“创建子装配”，补充子装配层级含义说明。
- 状态栏和 Toast 同步使用新的中文交互术语。
- 应用版本升级为 v0.43.5；Project Schema 继续保持 41。

## v0.43.4

- 新增 `AccessoryMountManager`，标准配件安装后可跟随宿主移动、旋转和尺寸变化。
- Profile Grip 拉伸、TransformControls、属性变换、几何重建、工程恢复均刷新安装关系。
- 已安装配件禁用直接 Gizmo/XYZ/RXYZ 世界 Transform 编辑；新增“解除安装”。
- 复制已安装配件时自动清除 `mountReference`。
- 安装位置显示中文 A端/B端/正面/背面。
- `accessoryMountingVersion` 升级为 2；应用版本更新为 v0.43.4，Project Schema 仍为 41。

## v0.43.3

- 配件目录新增管理页，可新建、编辑、复制、启停和删除数据库配件。
- 配件编辑器按端盖、脚杯、脚轮、抽屉滑轨显示中文参数字段，并统一生成目录 JSON。
- 左侧配件卡片拆分“添加 / 安装”：自由添加不绑定宿主；安装按 `mountRule` 自动定位。
- Editor 新增 `mountHardware()`：端盖支持型材规格校验，脚杯/福马轮自动选择较低端，滑轨安装到板材侧面。
- 自动安装写入 `mountReference`，属性面板增加安装关系展示。
- `app.css`、`boot.js`、`app.js` 入口增加 `v=0.43.3` 资源版本参数。
- 应用版本更新为 v0.43.3；Project Schema 仍为 41。

## v0.43.2

- 数据库统一为 MySQL，Profile Catalog 持久层从 JdbcTemplate/H2 收口到 MyBatis + XML。
- 新增 `BaseMapper.xml` 公共 SQL 元数据体系，统一维护表名、完整字段、写入字段、更新片段和排序。
- 新增 `ProfileCatalogMapper.xml`、完整 `AccessoryCatalogMapper.xml` 及 JSON TypeHandler。
- 新增 `/api/accessories` CRUD 和 `accessory_catalog` 启动初始化数据。
- 标准配件库第一批支持端盖、M8/M10/M12 调节脚杯、60/75 福马轮、450/500 三节滑轨。
- 左侧新增“配件”入口，数据库配件可筛选、搜索并直接添加到 3D 工程。
- Factory Package 新增 `BOM/配件BOM.csv`，与连接自动派生的五金 BOM 分开。
- View Cube 中文化并移动到画布安全区；输入框、下拉框和数字框统一视觉样式。
- 应用版本更新为 v0.43.2；Project Schema 仍为 41。

## v0.42.2

- Java 编译基线从误设的 JDK 26 修正为 **JDK 21**，与实际运行/开发环境保持一致。
- `pom.xml`、AGENTS、README、HANDOFF、VALIDATION、代码规范与专项验证脚本统一锁定 JDK 21。
- 保留 v0.42.1 的 `MachiningUnitBuilder` 语法修复、Jackson 3 迁移、`com.paic.stock` 包结构与 Profile Catalog 2.0 功能。
- Project Schema 保持 41，不涉及工程数据迁移。

## v0.42.1

- 修复 `MachiningUnitBuilder.js` 中 `??` 与 `||` 无括号混用导致的浏览器解析错误。
- 加工距离统一使用 `stationS ?? distanceFromStart ?? 0`，保持 `0` 为合法加工位置。
- 重构 `MachiningUnitBuilder` 为可读格式并抽取加工位置、标签生成逻辑，避免超长单行代码掩盖语法问题。
- 完整执行静态 JS/MJS `node --check` 与全部 `verify-*.mjs` 回归后重新打包。
- Project Schema 仍为 41，本次仅为运行时语法修复，不修改工程数据结构。

## v0.42.0

- Java 基线对齐 JDK 21 + Spring Boot 4.1.1 + Lombok，并按 controller/domain/repository/service/service.impl/config 分层。
- 修复 Spring Boot 4 下 Jackson 2 包名导致的编译错误：业务代码统一迁移到 Jackson 3 `tools.jackson.*`，显式声明 `tools.jackson.core:jackson-databind`。
- Profile Catalog API 支持 `includeDisabled`，数据库目录可查询停用型号；停用型号不参与新建选择，但仍可用于历史工程解析。
- 清理型材目录运行时代码中的 `SUPPLIER` / `VENDOR_VARIANT` 历史语义，改为通用 `CATALOG_EXPLICIT` / `CATALOG_VARIANT`。
- 新增型材目录管理：编辑、复制、启停、删除。
- 新增可视化截面编辑器：T 槽、矩形管、圆管、实心矩形、实心圆、倒角矩形和高级 Section JSON。
- 新增截面实时 SVG + 独立 Three.js 3D 挤出预览；预览不创建 Project Part，也不污染 Undo/BOM/Scene 业务状态。
- 保持 Project Schema = 41；Profile Catalog 2.0 属于目录/UI 能力，不引入历史 Schema migration。
- 新增 Java 代码规范文档与 v0.42 专项回归。

## v0.41.0

- 新增自由套索选择；与矩形框选互斥。
- 新增 Alt + 单击穿透/循环选择。
- 新增 FeatureHoverManager：端点、侧面、slotId 槽中心预高亮。
- 新增 WorkPlaneVisualizer：XY/XZ/YZ 工作平面可视化。
- TransformControls 支持 World / Local 坐标切换。
- View Cube 增加 BACK/BOTTOM。
- 右键菜单按对象类型分层，型材可直接 A/B 端精确拉伸。
- 新增 CAD Interaction HUD / 套索样式 / 状态栏快捷提示。
- Schema = 41；新增 `cadInteractionVersion=2`。
- 清理供应商相关产品规划，继续保留通用自定义型材和数据库型材目录。
- `AGENTS.md` 新增强制中文注释与代码风格规范。

## v0.40.0

- 在线 CAD 交互优化：Part hover 预高亮、浮动标签、平滑相机视图切换。
- 页面视觉与动效优化：topbar/rail/panel/型材卡片/Modal/Toast/ContextMenu。
- 型材库卡片改为 SVG 截面示意图。
- ProfileCatalog 支持运行时动态注册数据库自定义型号。
- ProfileSectionRegistry 新增 database catalog section 层。
- 新增 Spring JDBC + H2 持久化 profile_catalog。
- 新增 /api/profile-catalog CRUD 和前端自定义型材 Modal。
- 默认 H2，可通过 Spring Datasource 切换 MySQL/OceanBase。
- Schema = 40；继续仅支持当前 Schema。
- 新增 docs/UI-INTERACTION-AND-PROFILE-CATALOG.md 与 verify-profile-catalog-v040.mjs。

## v0.39.0

- 新增直型材制造包络 OBB-SAT 体积碰撞检查。
- 新增几何接触但无 Connection/Constraint 的连接完整性 WARNING。
- FactoryValidator 合并 AssemblyInspector、碰撞与连接完整性。
- Production issue 支持 `partIds`，UI 可直接定位模型。
- Factory Package 报告统一为 `生产检查报告.txt/json`。
- Schema 39 新增 collision/contact tolerance 和 production inspection 版本标记。
- 新增 `docs/PRODUCTION-INSPECTION.md` 与 `verify-production-v039.mjs`。

# Changelog

## v0.55.0

- Project Schema 升级为 55，current-only。
- `ProfileDrawTool` 新增闭合轮廓绘制：任意转折点生成标准 PROFILE 框架，并复用 Assembly/Auto Connection。
- 闭合轮廓增加短边和自相交阻断。
- 新增 `AssemblyPlaybackManager`：装配步骤支持播放/暂停、上一步、下一步和单步动画装入。
- 播放时后续构件临时隐藏，退出后完整恢复；播放不修改业务 Part transform。
- 报价、单价、成本继续暂缓。

## v0.38.0

### BOM / Manufacturing Reports
- BomExporter 升级为项目制造报表统一入口。
- 新增项目汇总、型材 BOM、五金 BOM、加工 BOM、子装配 BOM。
- 新增逐件 `cut-list.csv` 与逐 Feature `machining.csv`。
- 新增切割汇总/加工分组辅助 CSV。
- 新增 BOM 一致性报告，并接入 FactoryValidator / Factory Gate。
- UI 原“原料排料”替换为“制造汇总”。
- 删除 StockCutOptimizer / StockLayoutExporter 及所有原料排料运行代码。
- Project manufacturing 删除 stockLength/sawKerf/endTrim/offcut 等字段。
- Schema = 38；仅接受当前 Schema，并严格拒绝旧 CONNECTOR/END_CAP/SCREW 等历史 Part 类型。
- 用户明确：原料长度、库存、余料、排料、采购库存全部 OUT OF SCOPE。

## v0.37.0

### Engineering Drawing DXF / CAD Export
- 新增 `EngineeringDrawingDxfExporter`，直接消费 Drawing Model/Layout。
- 总装/子装配 DXF 与 SVG 使用同一视图、比例和 A3/A4 版面。
- DXF 使用 AC1015 + mm，写入 LTYPE/LAYER table。
- 固定 PROFILE/CENTER/DIMENSION/TEXT/TITLEBLOCK/VIEW/HIDDEN 图层。
- 尺寸输出 extension lines、dimension line、SOLID 箭头和 TEXT。
- 中文文本使用 `\U+XXXX` DXF Unicode escape。
- Drawing Model 中心线按投影长轴/短轴生成；方形投影输出十字中心线。
- UI 新增 CAD/DXF 单独导出。
- Factory Package 新增总装/子装配 DXF 和 DXF 图层说明。
- Schema = 37；只支持当前 Schema。


## v0.36.0

### Profile Grip Editing
- 新增 A/B 端 3D Grip；拖 B 固定 A，拖 A 固定 B。
- 新增长度实时 HUD、拖动中键盘精确输入、Enter 提交、Esc 取消、双击 Grip 输入总长。
- 新增网格长度吸附与端点/面/slot center Feature Snap。
- 新增 source-end 连接/约束保护，避免绕过装配关系。
- A_END/B_END 加工 station 在长度变化后保持各自端部距离语义。
- `ProfileGeometryFactory.rebuildLinearGroup()` 支持保持 root Group 的实时几何重建。
- 新增 `ProfileGripMath.js` 纯业务回归。
- Schema = 36；仍只支持当前 Schema。

## v0.35.0

### Engineering Drawing 1.0
- 新增 `EngineeringDrawingModel`，从 Part 业务数据/Transform 生成稳定二维工程图实体。
- 新增 FRONT/TOP/RIGHT/ISO 四视图总装图；模型层支持 LEFT/BACK/BOTTOM。
- 新增 `EngineeringDrawingLayout`：A3/A4 横向、统一正投影比例、标准工程比例。
- 新增自动总体尺寸 W/D/H 与正/侧视图层间尺寸链。
- 新增图框、标题栏、项目名、Revision、比例、单位、总体尺寸、构件数。
- 新增 `EngineeringDrawingSvgExporter` / `EngineeringDrawingService`。
- 工程面板新增二维工程图参数与总装 SVG 导出。
- Factory Package 新增 `装配工程图/总装工程图_<A3|A4>.svg`、Drawing Model JSON、子装配 SVG。
- Schema = 35；仍只支持当前 Schema。

## v0.34.0

### Dimension System 2.0
- 新增 `dimension/DimensionSystem.js`。
- 新增 LINEAR / ANGULAR / RADIAL / ORDINATE 尺寸类型标准化。
- 新增 BASELINE / CONTINUE / ORDINATE 多构件尺寸链。
- 新增 PART_CLEARANCE 净间距链。
- 新增 PART_BOUNDARY 语义锚点。
- 新增 PART_AXIS_COORDINATE 坐标驱动。
- 新增 PROFILE_RADIUS 弯曲半径驱动。
- 新增 PROFILE_ARC_ANGLE 圆弧角驱动。
- 加工 station 基准链支持 A/B 端切换。
- SceneAnnotationManager 增加尺寸链自动 lane 和圆弧角绘制。
- Project JSON 永久尺寸字段统一为 `dimensions`。

### Schema strategy
- Project Schema = 34。
- 删除 `ProjectMigrator.js`。
- 删除 legacy sample。
- 删除历史版本 migration 回归脚本。
- 当前阶段不维护旧工程兼容，旧 schema 直接拒绝。

## v0.33.0
- Machining Feature 1.0：槽/腰孔/铣削、端面加工、矩形阵列、加工基准、2D footprint 冲突检查。

## v0.32.0
- Connector System 2.0：目录 slotId、T 螺母匹配、连接规则、五金 BOM。

## v0.31.0
- Assembly System：层级、继承锁定/隐藏、爆炸图、安装步骤与关系检查。

## v0.30.0
- 在线型材绘制 + Feature Snap。

## v0.29.0
- Constraint Solver 2.0 基础。


## v0.43.0
- 引入 MyBatis XML 与 BaseMapper 公共 SQL 片段。
- 增加 Accessory Catalog 基础模型。
