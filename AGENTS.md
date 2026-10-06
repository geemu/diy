# AGENTS.md — DIY / 在线铝型材 DIY 设计器智能体开发指南

> 任何新 AI/智能体接手仓库时先读本文件，并继续阅读根目录 `IDEABUILDER_PARITY.md`。每次版本交付必须同步更新 `AGENTS.md`、`docs/HANDOFF.md`、`docs/ROADMAP.md`、`docs/CHANGELOG.md`，文档不得落后于代码。

## 1. 项目目标

DIY 是一个**浏览器端铝型材 DIY 3D/CAD 在线设计器**。产品体验参考 LewanDIY 与嘉立创 FA 的在线型材设计流程，但代码、数据模型、约束、加工、工程图和导出链独立实现。

核心链路：

```text
在线绘制/拖拽型材
  -> Feature Snap
  -> Auto Connection / 手工连接
  -> 约束 / 装配
  -> 连接件
  -> MachiningFeature
  -> Dimension
  -> EngineeringDrawingModel
  -> SVG / DXF
  -> BOM / cut-list / machining
  -> Factory Package
```

当前不是商城、支付、订单、社区或 AR 项目。

## 2. 当前版本

- 代码版本：**v0.75.5**
- Project Schema：**62**
- 当前主题：**视角立方体光照/轻透视层次与空白画布原点居中**
- 上一版：**v0.75.4 底栏悬停提示与独立状态区**
- 下一版：**继续补齐精确尺寸直改、框架复制/阵列语义与更完整的连接随动（不含报价）**




### v0.75.5 已完成

- ViewCube 使用轻透视相机、Lambert 材质、半球/定向光和独立外轮廓，上前两个面不再是等宽、同色的平面块；标签加深，画布增加轻阴影，96 px 卡片/88 px 画布尺寸不变。
- 导航方向仍逐帧严格跟随主相机，不为显示第三个面而偏转上前方向；6 面 / 12 边 / 8 角仍为原 26 个真实射线区域，展示轮廓不参与拾取，拖动正反语义保留。
- 启动及新建空白工程的观察中心由 (0,500,0) 改为世界原点 (0,0,0)，使红绿坐标轴交点位于实际 canvas-stage 中心；空白切换视角/小房子/适配也使用原点，上前方向 (0,1,1) 和初始距离 3000 不变。适配现有模型仍按模型包围范围，不移动任何构件。
- 新增真实构造/材质/相机/射线回归与多比例原点投影检查；版本/缓存 0.75.5、Schema 62 不变，运行验证见 docs/VALIDATION.md。

### v0.75.4 已完成

- 按用户反馈移除底栏常驻操作说明和长构件名称，全部主操作/视图开关使用统一深色悬停 tip；同时移除原生 title，避免两个提示叠加。
- 操作按钮仅在 workbench-footer-scroll 内横向滚动，右侧 workbench-footer-status 独立占位并常驻提示入口/单位，不被按钮挤压或盖住。底栏仍 48 px 单行，不增加画布浮层。
- 提示入口显示选择说明/当前构件及快捷键；绘制时只显示“起点/终点”短状态，完整步骤移入 tip。结束按钮、确认/取消、Esc/右键和快捷旋转不变。
- Tip 使用 Teleport 到 body 和实际尺寸视口夹边；悬停、键盘聚焦与点击提示入口均可显示，离开/点击操作/滚动/调整尺寸/Esc/卸载清理。过期 nextTick 不得恢复旧提示，更多菜单不受影响。
- 版本/缓存 0.75.4，Schema 62 不变；146 个语法检查、45 个回归及浏览器操作检查见 VALIDATION。通用封边入口范围本轮不扩展。

### v0.75.3 已完成

- 封边只关闭侧面槽口，原槽腔转为贯通内孔；设计几何的 sectionSlotDefinitions 与安装 slotDefinitions 分离，默认封面和手工封边都保留孔腔，不恢复封闭面的槽位吸附。
- 具体型号参考孔避免跨入保留的槽腔；圆角参考中心孔置于两槽之间的实体区，避免孔/槽相交。数据库/DXF 精确截面优先返回，不附加通用孔，不改变其定义。
- 无限 XZ 地面增加贯穿原点的红色 X 轴和绿色 Z 轴，正负半轴同色；按像素抗锯齿和远景淡出，随网格开关控制，不参与工程、吸附或碰撞。
- 主操作、快捷旋转和视图开关合并为 48 px 单行底栏；窄屏横向滚动，不再双行占画布。更多菜单使用固定视口定位，并在聚焦/滚动完成后重定位，避免裁切及误关闭。
- 版本/缓存 0.75.3，Schema 62 不变；608 组真实截面组合、孔腔/外壁射线、浏览器保存重开和窄屏操作检查见 docs/VALIDATION.md。内置截面仍为设计参考级。

### v0.75.2 已完成

- 用户确认主工具条和状态栏归工作台底部，不作为画布浮层。中央列拆成 canvas-stage + workbench-footer，Three.js 容器只覆盖上方画布；底栏使用实色和分隔线，实际占位，不覆盖模型。
- 主操作、绘制连续/确认/取消、快捷旋转与状态按钮全部停靠底栏；窄窗口允许自然换行。画布使用剩余空间，ResizeObserver 同步实际渲染尺寸，退出操作和更多菜单仍可达。
- 主工具条取消拖动手柄，忽略旧 toolbar 浮动坐标；面板/视角导航仍可拖动，导航限于实际 canvas-stage。组件拖放只在上方画布提交，不把底栏点击/拖放当作模型操作。
- 版本/缓存 0.75.2，Schema 62 不变；新增底栏契约与旧布局检查，运行交互验证见 docs/VALIDATION.md。

### v0.75.1 已完成

- 用户指定初始化上前视角：启动和空白新建使用上/前 45°，不偏向右；小房子三维复位和适配保留原有三维方向，不改变业务坐标或工作平面。
- 去除遮挡画布的独立绘制卡片；连续添加、确认这一根、取消当前段并入底部主工具条，起点/终点及 Esc / 右键提示移入状态栏。结束绘制按钮始终可达；已完成构件保留。
- 只读查看官方 TXCJ/TXCK/TXCL 截面 PDF，确认 2020A/B、3030A/B/H/T、3060A/B、4040H/T 的封闭面；4040F 仍四面开槽。具体型号默认封闭侧同时进入共用几何、槽位和特征，圆角型号保留圆弧外形。不得跨系列凭 A/B/H/T 后缀猜测。
- 内置型号的外轮廓不再统一回退为四面开槽；参考内腔在槽轮廓内约束，防止相交孔破坏端面三角化，数据库/DXF 精确截面不被收缩。预览朝向优先露出封闭面，页面明确显示封闭侧。
- 属性/批量替换切换型号会移除旧型号自带封闭面，保留用户额外封边并加入新型号默认封面。共用预览不创建工程构件，制造配置仍独立；内置参考内腔不是供应商精确图档。
- 版本/缓存 0.75.1，Schema 62 / 绘制工具版本 7 不变；验证范围见 docs/VALIDATION.md，原始资料索引见 reference/README.md。

### v0.75.0 已完成

- 用户确认按外截面尺寸归组：3030A/B/R 等进入 3030 一级组，再选具体型号；其他尺寸同规则。右侧创建、修改、批量替换、快捷框架、DIY 模板与门框共用 ProfileSelector，不恢复左侧重复绘制入口。
- DesignProfileCatalog 从已有目录投影具体型号的几何字段；保留真实 profileId、槽位和截面 Registry 优先级，不合并工程型号，不自动绑定 manufacturingProfile 或暴露合金、壁厚、价格。数据库启用项进入二级选择；已有停用型号可在属性正确显示。3030N1 当前无定义，不凭名称伪造截面。
- 世界/局部在玩家界面标为画布方向/构件方向，说明仅决定操作轴朝向，不是鼠标中心/旋转中心。旋转条可直接切换轴方向；X 快捷键与既有 Transform 事务不变。封边按钮同步深色全状态可读。
- 初次进入、空白新建和小房子复位使用同一上/前/右三维方向；保留 26 视角、用户手动切换与视角动画。仅改变默认展示方向，不修改业务模型或吸附平面。
- Schema 62 / profileDrawToolVersion 7 不变；具体型号内置截面仍为参考图形，生产需实际目录截面/DXF 与制造配置。检查范围见 docs/VALIDATION.md。

### v0.74.0 已完成

- 移动工具每轴只保留一个正向箭头，移除三个负向显示件及 picker；中心和三平面柄保留。正向箭头仍经原 TransformControls/Editor 事务支持正反移动，世界/局部、约束、连接随动、干涉回滚和撤销不旁路。
- 仅从现有本地 Three.js WebJar 解包 RoomEnvironment，PMREM 初始化柔光反射；无需 HDR 图片、网络素材或版本升级。型材使用较柔和的金属参数和更清楚的边缘线。
- ProfileSurfaceAppearance 仅添加渲染顶点颜色，以截面凸包估算凹槽暗部；端面/凸圆弧外表面保持原色，不改位置、法线、截面事实或制造尺寸。此为展示近似，不是实体布尔/精确环境遮蔽求解。
- 新增真实 WebJar 移动拾取/双向拖动和顶点不变回归；版本/缓存 0.74.0，Schema 62 不变，验证见 docs/VALIDATION.md。

### v0.73.3 已完成

- 修正 ViewCube 球坐标 phi 的纵向拖动符号，可见面跟随鼠标上下方向；保留已正确的左右方向、观察中心、缩放距离及 26 面/边/角选择。
- 型材三维预览移除旧 profile-asset-row 类，避免浅色 hover 背景和位移动画泄漏；五类目录卡片 hover/active/selected/focus-visible 保持黑底，键盘聚焦有橙色轮廓。
- 新增 48 个真实拖动实现的屏幕投影方向用例；版本/缓存 0.73.3，Schema 62 不变，验证见 docs/VALIDATION.md。

### v0.73.2 已完成

- XZ 展示网格按世界 X/Z 正负分成蓝、紫、橙、青四种线色，原点两轴保持灰蓝中性色；底色不分区染色。
- 象限归属只取世界交点，不随相机平移/旋转换位；保留无限远淡出、抗锯齿、网格开关与透视/正交。仅展示着色，不改绘制、吸附、模型或 Schema。
- 底部网格按钮提供颜色对应提示；版本与缓存同步 0.73.2，验证见 docs/VALIDATION.md。

### v0.73.1 已完成

- 按用户反馈加深网格线颜色，提高细格/粗格对比；像素中心保留实线覆盖，边缘抗锯齿，避免线条整体过淡。
- 线条淡出慢于地面渐变，中远景格子更容易辨识；无限延伸、世界坐标、模型尺寸与吸附行为保持不变。
- 版本与缓存同步 0.73.1，Schema 62 不变，验证见 docs/VALIDATION.md。

### v0.73.0 已完成

- 用户要求画布具有 LewanDIY 的无限远感觉；用 InfiniteGround 屏幕射线与世界 XZ 面求交，替换有限 GridHelper/PlaneGeometry 和固定距离雾。
- 网格固定在世界坐标，常规展示间距 200 mm；按像素覆盖平滑切换粗细格，远处融入浅蓝地平线。平移、缩放和相机远裁剪面外均无网格矩形边界。
- 透视/正交/26 视角共用逆投影；网格开关只隐藏线条。地面不写深度、不参与业务模型、拾取或吸附，模型尺寸/默认落地不变。
- 版本/缓存 0.73.0，Schema 62 不变；验证与运行截图见 docs/VALIDATION.md。

### v0.72.0 已完成

- 按用户要求将修正扩展到五类主目录，而非只修 L 型夹。逐项浏览 16 型材、18 连接、10 光轴、11 板材/几何体、4 配件及五种紧固件头型；选项基线保留，不引入远程模型或品牌素材。
- ComponentGeometryFactory 修正 SK/SHF、十字/平行/T 夹的真实孔口和主孔安装偏移、固定环、层板托、A 柱托架、板材固定件、插接臂、角码筋、脚杯和紧固件。预览与实际新增复用同一几何；正交孔交会仍是设计参考网格，不是制造实体布尔。
- CatalogPresentation 集中管理展示朝向、留白和同类小件观察尺度，只移动预览相机/展示根节点，不缩放工程零件。统一柔光、哑光、黑底 238 px 卡片；R 型材恢复 R 名称并展示圆弧面，板材正面色与尺寸标签统一。
- SceneManager 增加独立灰蓝地面、100 mm 展示网格和远处淡出，初始观察位置降低为正面透视。地面不写深度、不参与业务或导出；不遮挡跨过工作面的安装件。26 视角、工作面、吸附和构件落地规则保留。
- Schema 62 / 绘制工具版本 7 不变；137 个语法检查、39 个回归、95 个光轴主孔射线用例、JDK 21 构建及浏览器添加/取消/随动/下载/重开见 docs/VALIDATION.md。全类型复看不等于专有模型或制造尺寸完全一致。

### v0.71.1 已完成

- 依据用户两张对照图修正 L 型直角固定夹：低前台阶、高后块，主 Z 孔、上方 Y 孔、侧 X 孔和小紧固孔，不再复用高立板与外挂底脚。
- 通孔的面轮廓和内壁来自本地几何；相交孔裁掉交会处内壁。7 种孔径增加真实射线穿孔、台阶空位及实体保留断言，主孔偏移共用目录安装参数。
- 夹具预览用中性哑光与独立留白比例，切换型材恢复原灯光；仅相机改变显示大小，不改变实际构件尺寸。五类表单统一 14 px / 500 标签与 6 px 标签间距。
- 本次修正不代表其他九类光轴或全部连接形状已逐一达到视觉一致；独立设计参考模型仍需制造前核对。Schema 62 / 绘制工具版本 7 不变。

### v0.71.0 已完成

- 匿名浏览参考编辑器，保存版本化选项事实到 reference；16 个参考型材 + 7 个扩展截面、18 类连接及 134 个二级规格、10 类光轴、11 种板材/几何体、4 类主配件及动态规格均有独立本地实现。
- 预览和实际添加复用 ComponentGeometryFactory；R 圆弧截面、U 型 A 柱、封边后的截面都进入实际几何。A 柱提供自由添加与常用长度；型材默认仍为唯一 FREE 绘制入口。
- 光轴夹按主轴孔中心和 stationS 安装，随宿主姿态刷新；端盖、脚杯、滑轨沿用宿主安装。复杂连接组件暂为自由放置；只有已支持的角槽、直角、一字内置、四种连接板进入接头 Manager，15 系列暂为自由放置。
- 板材轮廓/曲面参数作为 PANEL.dimensions 的事实保存并校验；属性编辑走 Editor，SVG/DXF 使用异形轮廓与孔，不把圆环板画成实心矩形。球/圆柱/圆锥/圆环体是设计参考模型，不能当作普通薄板制造承诺。
- 本地参数化模型不是参考站专有网格，也不是供应商制造图；FactoryValidator 保留参考件核对提示和既有正式制造门禁。未承诺复杂连接件全部自动安装或制造尺寸一比一。
- 最新用户要求同名下拉项：设计阶段允许“欧标20x40”等作为截面显示标签；不因此预填 manufacturingProfile、真实料号、壁厚、合金、供应商或价格。这是显示名称例外，不取消设计/制造分层。
- Schema 62 / 绘制工具版本 7 不变；交付检查见 docs/VALIDATION.md。
- 放置连接/配件/加工时拉伸手柄必须隐藏并让出确认点击；属性坐标修改需 emitProjectChanged，同步随动组件和清单。回滚删除临时构件后必须同步选择、属性与 Gizmo，不得保留悬空选中对象。

### v0.70.0 已完成

- 修复旧浅色 hover/focus 样式覆盖深色规格框的问题；输入、选择、禁用和原生选项统一深底亮字、橙色焦点，不能只定义默认态。
- 左轨使用单层轻选中态，不再叠加伪元素指示条和 inset 阴影；显示/吸附菜单与视图菜单共享深色行样式，状态勾选右对齐并暴露 aria-pressed。
- 实际观察 LewanDIY 型材、连接、光轴、板材和配件：均为三维 canvas 预览，未发现独立产品图片。五类右库统一规格选择、黑底三维卡片、点击使用，不依赖其远程素材。
- 组件预览复用 ProfileGeometryFactory / PrimitiveGeometryFactory，不创建工程构件；切换分类释放渲染器和上下文，包围球按画布比例自适应。连接仅展示抽象设计方式，不能把示意五金当作制造承诺。
- 框口填板/门组件、连接管理/精确配合按需展开，既有 Manager 保留；配件分类、搜索、规格、安装和自由添加继续有效。修复快捷搭建、属性只读字段及管理卡片残留浅色底。
- 光轴和板材拒绝非正数/非有限尺寸；板材预览和新增件共用材质配色。Schema 62 / 绘制工具版本 7 不变；验证见 docs/VALIDATION.md。

### v0.69.0 已完成

- 用户确认删除重复的左侧自由绘制入口与表单；左侧仅负责快捷搭建、批量、补连接、组合、检查、测量和适配。右侧规格选择与真实截面 3D 预览共用唯一截面选择器，点击预览才开启 FREE。
- E / 底部绘制按钮在首次未选材时定位到右侧组件库；已经选材后复用当前规格开始绘制。整框和异形框仍归左侧快捷搭建，不恢复模式区分。
- 实际浏览器观察 LewanDIY 编辑器，统一 48 px 深色顶部、64 px 左轨、344 px 右库、浅蓝画布、橙色状态和底部玻璃工具条；品牌保留 DIY，图标为本地独立 SVG。紧凑 26 方向 View Cube 与快捷旋转保留。
- 顶部八组菜单沿用真实 Editor/Manager：新建空白工程与示例分离，命名/打开/保存同步名称，替换未保存工程有确认，空撤销/重做有反馈。修正菜单在窄窗口被左面板遮挡的问题。
- 帮助、工程中心、制造配置和检查支持 Esc 关闭；模态窗口禁止背景建模快捷键。其他目录编辑弹窗保留自身关闭流程。
- 适配全部按包围球、实际画布比例和视场角计算；正交缩放不再被 resize 重复应用。预览跟随右面板尺寸变化并清理渲染资源，预览仍不写业务数据。
- Schema 保持 62 / 绘制工具版本 7，缓存、样例、制造导出与回归同步版本。新增右库/菜单/适配回归，验证范围见 docs/VALIDATION.md；不承诺参考站全部功能或像素级复制。

### v0.68.0 已完成

- 不再区分 BEGINNER / EXPERT，工程不保存 workbenchMode；精确连接、更多加工、端部斜切和几何关系按需展开，不删除领域能力。
- FREE 默认完成一根自动回到选择并打开所选构件属性；连续添加是显式选项，不新增第二套绘制模式。
- 画布常驻“连续添加 / 确认这一根 / 取消当前段 / 结束绘制”；收起左侧表单后仍可结束。Esc 在长度输入框和侧栏字段聚焦时也能一次退出，保留已完成构件。
- 右键单击结束绘制，右键拖动继续平移视图；非左键不得进入几何提交链。选择、移动、测量、标注、框选及右侧创建/修改切换清理临时放置工具。
- 工作台统一浅色面板、橙色操作强调、表单与菜单样式；绿/红保留几何合法性语义。Toast 移离主工具条，紧凑 26 方向 View Cube 保持不变。
- 主工具条只常驻选择、绘制、移动、旋转、复制、删除；测量、标注、框选、套索、组合、坐标切换归入“更多操作”，菜单选择后自动收起。
- 主菜单和更多菜单必须在 click 后收起，禁止在 pointerdown 隐藏，避免吞掉选择或让 pointerup 误落画布。
- 901–1100 px 窗口给左面板预留实际轨道，避免遮挡画布工具；更窄窗口保留浮动面板及独立结束按钮。
- Schema 62 不变，profileDrawToolVersion = 7；继续使用既有自动连接、干涉回滚、历史与业务事实源，不扩展商业范围。

### v0.67.0 已完成

- 用户确认绘制入口只保留自由绘制；左轨、主工具条、右侧型材卡片、右键菜单与按长度绘制均进入 FREE。取消独立 A/斜角、单根和连续绘制入口，底层 Manager 能力不做无关删除。
- FREE 在屏幕轴线附近 8° 内自动吸附；离轴转为所选工作面的斜杆。X/Y/Z 显式锁轴优先，Alt 强制斜向、Shift 临时正交；修饰键松开会立即刷新预览。
- 未锁轴可吸附空间接头；锁轴时拒绝偏离目标轴的 Feature。精确长度、预览与提交使用同一个候选方向，不把斜杆掰直。
- 矩形框、空间框、轮廓框和 L/U/阶梯型放入快捷搭建；绘制面板不再显示模式网格或整框生成器。
- 斜杆方向面与网格设置默认折叠；保留实际实体预览、落地、搭接、自动连接、干涉回滚和撤销。
- Schema 62 不变，profileDrawToolVersion = 6。斜向接头仍受当前几何/连接能力约束，不自动承诺任意斜切或非正交连接制造方案。

### v0.66.0 已完成

- 登录后只读查看参考草稿，另开未保存空白页观察自由绘制、斜角绘制、画布长度输入和型材高亮；未修改或保存用户原草稿。账号、密码和会话不得写入项目。
- 右侧型材卡片点击只选择截面并进入 FREE，不再立即在默认位置添加零件；左侧提供自由绘制 E、斜角 A、单根、连续、矩形框、空间框、轮廓框。
- FREE 以相机投影选择 X/Y/Z 空间轴，不要求预先切换工作面；X/Y/Z 可锁定方向，再按解除。DIAGONAL 在所选工作面绘制斜杆，不受默认正交开关强制掰直。
- 直线绘制复用 ProfileGeometryFactory 显示真实截面实体 Ghost；画布长度输入框支持点击编辑、回车确认、Esc 取消。预览对象不进入 Project / BOM / 历史。
- 空白面竖杆从工作面起步；端点转向复用现有搭接偏移规则，FREE 数字输入以真实切料长度为准。端部关系由 AutoConnectionResolver 统一建立设计连接。
- 原有矩形、箱体、连续、轮廓、连接/加工、26 视角与快捷旋转保留。参考站单根/矩形/箱体当时仍提示开发中，不照搬禁用状态；不宣称全部行为一比一覆盖。
- Schema 保持 62；绘制工具版本为 5；不做报价或旧工程兼容。

### v0.65.0 已完成

- 左侧工具轨只承载快捷搭建、绘制、批量、补连接、组合、检查、测量和适配；操作表单在左侧可收起面板展开。
- 右侧创建/修改共用停靠轨道；组件分类包含型材、连接、光轴、板材、配件和加工，属性/连接/加工编辑在修改页保留。
- `ViewCube` 使用 26 个真实射线拾取区域：6 面 / 12 边 / 8 角。与主相机同步，拖动可转到背面；全部方向菜单同时支持文字选择。
- 视角导航默认紧凑显示：96 px 卡片、88 px 立方体画布；省略常驻说明，全部 26 视角以侧向弹出菜单展示。
- X/Y/Z +90° 与 Alt+X/Y/Z 复用 TransformControls 事务，遵守世界/局部坐标与 SINGLE/CONNECTED/ASSEMBLY 作用域，保留约束、干涉回滚、安装随动和撤销。
- 空白工作面绘制中心线偏移半个截面厚度，`ProfileOrientation` 统一截面 local Y 与工作面法向。已有 Feature 续接保持真实坐标，BOX 保持原有底面定位。
- 矩形/轮廓生成、预览和参数化重建共用截面朝向规则；Project Schema 保持 62。

### v0.64.0 已完成

- 项目对外名称统一为 DIY / DIY 铝型材设计器；Maven artifact 与 Spring 应用名使用 diy。
- Java 包名、./data/aluminum-cad.db 和浏览器旧存储键继续保留，避免无业务收益的迁移与本地数据丢失。
- 连接页增加全部、纯自动、手工/已改、几何失效状态总览。
- 新增“扫描整个结构并补全连接”：显式命令强制扫描现有 PROFILE，复用 AutoConnectionResolver -> ConnectionManager，不移动几何、不覆盖已有关系。
- 新增“清除纯自动连接”：只删除仍为 autoGenerated=true 的关系；手工连接和已人工切换方案的关系保留，删除继续通过 ConnectionManager 清理派生五金/加工。
- “新建构件自动连接”开关只控制后续绘制、拖放和模板生成，不阻止用户主动扫描。
- 连接安装图卡同时展示安装步骤与 3 → 2 → 1 反向拆卸顺序，装配说明打印复用同一展示模型。
- autoConnectionSystemVersion=2；Schema 保持 62；不做报价、价格、成本。

### v0.63.0 已完成

- 连续/轮廓绘制支持数字+Enter 精确长度；Backspace 撤回上一段；Esc 结束。
- 空白画布右键必须使用空白上下文菜单；构件菜单不能沿用旧 selected 伪装为命中。
- 型材右键长度编辑明确端点锚定：A 固定则拉 B，B 固定则拉 A。
- SINGLE 拖离导致已有连接失效时自动解除失效连接；CONNECTED/ASSEMBLY 保持关系整体移动。

- Schema 升级为 62，current-only。
- `SceneManager + TransformControls` 接入平移/旋转步长与拖动 HUD；`Editor` 支持 SINGLE / CONNECTED / ASSEMBLY 三种移动作用域。
- `SnapManager` 增加候选优先级、锁定/释放距离和 Ctrl 临时绕过，端面/槽中心/端点吸附具备明确中文语义反馈。
- `InterferenceFeedbackManager` 将真实 PROFILE OBB 穿透与近距离有效面接触分开：红色优先表示禁止落位，绿色表示有效贴合。
- Transform 拖动若最终发生真实干涉，恢复拖动前完整几何快照，不写入历史；连接/约束联动造成的附带移动也会被一并回滚。
- `ProfileDrawTool / ContourFrameManager` 对连续折线、矩形和闭合轮廓派生真实搭接段；设计轮廓点仍是逻辑尺寸事实，不把搭接修剪写回参数点。
- 绘制阶段增加穿透预判：预览线遇到实体干涉转红并显示目标与估算穿透量；几何吸附为绿色，普通网格/轴锁定为蓝色。
- 顶部菜单和右键上下文按高频 CAD 操作重排；浮动菜单以实际 DOM 尺寸做 viewport clamp，底部/右侧不再丢失删除等操作。
- 全中文；不做报价、价格、成本；不维护历史工程兼容。

### v0.61.0 已完成

- Schema 升级为 60，current-only。
- `ConnectionPlacementManager.resolveJointContext()` 脱离当前工具模式解析真实接头；悬浮/右键快捷菜单只展示 `ConnectionManager.recommendDesignFor()` 判定为当前几何可用的连接候选。
- 接头候选可直接 `installAtContext()` 复用既有连接创建链；开放型材端部支持匹配截面的端盖候选，并继续进入 `AccessoryPlacementManager` Ghost 预览。
- 轮廓关系图标打开画布浮动编辑卡；调整、切换、删除都只修改 `Assembly.parameters.simpleConstraints` 与 `parameters.points`，右侧属性同步刷新。
- `ConnectionInstallationDiagram` 升级为当前 Cxxx 专属说明卡，组合接头局部放大、二维安装方向、安装步骤和本接头五金。
- 全中文；不做报价、价格、成本；不维护历史工程兼容。

### v0.60.0 已完成

- Schema 升级为 59，current-only。
- `ContourFrameManager` 在画布直接显示等长、平行、横向/纵向对齐关系图标；图标和属性列表可双向定位。
- 新增 `AssemblyGuideDocument`，工程中心支持一页一步的装配说明书阅读模式。
- 装配说明支持上一页/下一页和整套打印，打印页包含统一构件编号、连接二维示意、五金、前置步骤和安装/拆卸顺序。
- 装配说明与连接关系图均为展示层，事实源仍是 Project / AssemblyInstruction / Connection / Hardware。
- 报价、价格、成本继续不做。

### v0.58.0 已完成

- Schema 升级为 58，current-only。
- `ContourFrameManager` 增加 `simpleConstraints`：`EQUAL_LENGTH / PARALLEL / ALIGN_POINTS`。
- 简单关系只服务玩家常用几何意图，不替代专业 Constraint/Solver；等长可联动改边长，平行/对齐用于防止后续编辑破坏关系。
- 插入/删除轮廓点会清除拓扑相关简单关系，禁止静默把旧索引套到新轮廓。
- `ConnectionInstallationDiagram` 升级为 v2：包含安装方向、螺钉插入方向、安装步骤和反向拆卸顺序。
- 报价、价格、成本继续不做。

### v0.57.0 已完成

- Schema 升级为 57，current-only。
- `ContourFrameManager` 编辑覆盖层增加可点击边长标签；点击尺寸直接修改边长。
- 编辑模式支持右键轮廓边插入点、右键控制点删除；修改始终以 `Assembly.parameters.points` 为事实源并整框重建。
- 正交边长编辑会沿垂直边传播位移，保持 L/U/矩形等轮廓的正交拓扑。
- 新增 `ContourPresetFactory`，提供 L 型、U 型、阶梯型快捷轮廓；仍生成普通 PROFILE + Assembly。
- 新增 `ConnectionInstallationDiagram`，装配步骤中的 Cxxx 连接可查看二维安装示意和当前连接五金。
- 报价、价格、成本继续不做。


### v0.55.0 已完成

- Schema 升级为 55，current-only。
- `ProfileDrawTool` 新增 `CONTOUR`，任意闭合轮廓直接生成标准 PROFILE + Assembly。
- 轮廓生成前校验短边与自相交；完成后继续使用 `AutoConnectionResolver`。
- 新增 `AssemblyPlaybackManager`，支持播放/暂停/上一步/下一步/单步播放。
- 播放时未来步骤隐藏、当前步骤从爆炸位置动画装回；展示状态不得写回业务模型。
- 报价、价格、成本继续不做。


### v0.54.0 已完成

- Schema 升级为 54，current-only；统一制造编号成为当前工程正式字段。
- `ManufacturingIdentityManager` 统一维护 P/B/S/A/H/C/M/G 编号，并在工程保存前 reconcile。
- `EngineeringDrawingModel` 使用同一制造编号生成 Tagged Drawing；默认排除连接自动派生五金，防止总装图标签过载。
- `AssemblyInstructionGenerator` 按组件安装顺序生成步骤；跨步骤连接归到较晚步骤，五金不会跨步骤重复。
- 工程中心“装配步骤”支持定位、当前步骤高亮、分步爆炸、还原以及前置步骤提示。
- 制造包新增装配步骤 CSV/JSON；BOM、工程图、装配步骤共用同一编号。
- 报价、价格、成本继续不做。

### v0.53.0 已完成

- Schema 保持 50，current-only；交互系统升级不建立历史兼容层。
- 新增 `interaction/AccessoryPlacementManager.js`：配件采用“选配件 -> hover 吸附预览 -> click 安装”的统一工作流。
- 配件 Ghost 预览绿色表示合法、红色表示不兼容或会与其他构件发生明显干涉；预览不写入业务模型。
- 右键型材/板材打开配件库时保留 `partId + worldPoint + end`，选择配件后优先在右键位置预览；用户单击画布确认。
- `ConnectionPlacementManager / AccessoryPlacementManager / MachiningPlacementManager` 均遵守 hover-only preview / click commit / Esc cancel。
- Transform 拖动中的 Snap Preview 会同步到界面“即将吸附”提示；正式吸附后才产生完成提示。
- 顶部一级菜单收敛为“文件 / 设计 / 制造 / 更多”，视图/帮助归并；画布视图导航继续保留常用视图。
- 实时干涉红框、右键上下文操作、v0.51 可拖动工作台继续保留。
- 报价、价格、成本继续不做。

### v0.49.1 已完成

- Schema 升级为 49，并采用 current-only 策略：每个版本按全新工程维护，不做历史 Project migration。
- 新增 `DesignProfileCatalog`；设计型材只包含截面、槽位和封边，不包含欧标/国标、壁厚、米重、合金、供应商或价格。
- PROFILE 新建时写 `designProfile`，`manufacturingProfile` 默认 `null`；制造属性只允许在后续制造配置阶段绑定。
- `ConnectionPlacementManager` 支持“选连接方式 -> 点接头 -> 单击吸附”；唯一候选直接安装，有歧义时退回两点选择。
- `resolveProfileSurfaceFeature()` 独立解析目标侧面/槽位，修正框架角点靠近 A/B 端时侧面无法选择的问题。
- 封边面不提供槽位 Anchor；角码/T 螺母不能安装到封闭面。
- `MachiningPlacementManager` 支持在点击位置添加孔/沉头/槽/端面加工，并提供 Ghost 预览。
- 默认 `BEGINNER` 简易模式；用户可见界面优先中文；顶部菜单统一自动收起。
- 用户明确：报价、单价、成本估算暂不做。

### v0.48.0 已完成

- 新增 `FrameOpeningResolver`：4 根矩形直线型材 -> 稳定净开口描述，供板材/门生成共用。
- 新增 `PanelDoorConfigurator`：框口填板和门组件都生成标准 Project Part，不新增 `DOOR` PartType。
- 自动填板记录宿主 `sourcePartIds / clearanceMm / normalOffsetMm`，支持宿主变化后重新适配。
- 门组件由 4 根 PROFILE + PANEL + 通用 HINGE/HANDLE ACCESSORY + Assembly 组成；门框内部连接继续委托 `AutoConnectionResolver -> ConnectionManager`。
- 新增 `ProfileReplacementManager`：保持 Part ID/中心线/长度/Assembly，一次替换当前选择、当前组件或工程同型号。
- 型材替换后的 Connection 继续由现有 `ConnectionManager.rebuild()` 和 Quick Change 推荐规则重算，不允许新增第二套兼容逻辑。
- 无法自动修复的 Connection 必须保留 INVALID 状态，不得静默删除。
- `panelDoorConfiguratorVersion=1`、`profileReplacementVersion=1`；Project Schema 保持 41。

### v0.45.1 已完成

- 正式将 80/20 IdeaBuilder 作为主要产品标杆。
- 根目录新增 `IDEABUILDER_PARITY.md`，所有后续 Agent 必须优先阅读。
- 产品优先级固定为：Click/Drag/Snap -> Auto Connection -> Quick Change -> Configurator -> Live BOM -> Design Check -> Assembly Instructions。
- 明确不因为对标 IdeaBuilder 而引入供应商、订单、商城、原料排料或库存能力。
- v0.46 优先实现模板/拖放后的语义连接识别与统一自动连接编排。

### v0.45.0 已完成

- 数据库从 MySQL 切换到 SQLite，本地文件默认 `./data/aluminum-cad.db`。
- 保持 MyBatis + XML SQL；SQLite 使用 `ON CONFLICT` 幂等初始化。
- 新增 `diy/DiyTemplateCatalog.js`、`diy/DiyGenerator.js`。
- 新增基础空间框、多层置物架、鱼缸/龟缸架、设备机架 4 个新手模板。
- 新增 `Editor.addLayeredRack()`，模板仍生成标准 Project Part，不直接操作 Mesh。
- Project Schema 仍为 41。

### v0.44.0 已完成

- 顶部改为专业 CAD 主菜单：文件 / 编辑 / 视图 / 显示 / 工程 / 模型库 / 零件库 / 帮助。
- 左侧工具栏职责改为 CAD 操作，不再承担资源分类；资源库通过顶部模型库/零件库菜单进入。
- 新增工程中心页面入口，可查看材料、配件、加工清单并导出工程图/制造包。
- 工作台视觉参考 LewanDIY 截图：深色菜单与工具区、浅色画布、橙色操作强调色。
- 只重组 UI 和入口，不新增第二套 BOM/工程图/导出业务模型。
- Project Schema 仍为 41。

### v0.43.5 已完成

- CAD 编辑器交互术语进一步中文化：“自由选择 / 镜像复制 / 组合组件 / 创建子装配”。
- “组合组件”悬浮说明明确只建立组件组织关系，不进行几何布尔合并。
- 状态栏、右键菜单、Toast 和用户可见错误提示同步使用新术语。
- 快捷键、Editor/AssemblyManager API、Project Schema 均保持不变。

### v0.43.4 已完成

- 新增 `AccessoryMountManager`，安装后的标准配件跟随宿主移动、旋转和尺寸变化。
- Profile Grip 拉伸、属性 Transform、TransformControls、工程恢复都会刷新安装关系。
- 已安装配件禁止直接修改世界 Transform；先解除安装后再自由移动。
- 复制标准配件时清除 `mountReference`，避免副本继续绑定原宿主。
- 安装位置中文化；`accessoryMountingVersion = 2`，Project Schema 仍为 41。

### v0.43.3 已完成

- 标准配件目录增加管理页：新建、编辑、复制、启停、删除。
- 配件参数使用中文表单维护，并自动生成 geometry/mount/BOM JSON。
- 配件支持“自由添加”和“安装到选中构件”两种操作。
- Editor 新增配件安装入口：端盖/脚杯/脚轮定位到型材端部，滑轨定位到板材侧面。
- 安装关系通过 `mountReference` 写入 Project Part，Three.js Scene 仍不是业务事实来源。
- 主前端资源增加版本参数，降低旧 JS 缓存导致页面加载旧代码的风险。

### v0.43.2 已完成

- v0.43.2 当时曾以 MySQL + MyBatis XML 替换旧 Profile Catalog JdbcTemplate/H2；v0.45.0 已进一步切换为 SQLite。
- BaseMapper.xml 集中维护公共数据库 SQL 元数据，业务 Mapper 通过 include 引用。
- 新增 Accessory Catalog CRUD、启动初始化和数据库标准配件库。
- 标准配件继续使用 ACCESSORY PartType，并新增独立配件 BOM。
- 页面增加配件入口、中文 View Cube、安全区布局和统一表单控件。
- Project Schema 继续为 41。

### v0.42 已完成

- 数据库型材独立管理页：新增、编辑、复制、启停、删除。
- 可视化截面模板：T 槽、矩形管/方管、圆管、实心矩形、实心圆、倒角矩形。
- 高级 Section JSON 作为特殊截面兜底入口。
- 截面实时 SVG + 独立 Three.js 3D 挤出预览；预览不创建 Project Part。
- 停用数据库型号不参与新建选择，但保留目录定义用于当前工程解析。
- Java 后端按 `controller/domain/mapper/service/service.impl/config` 分层。
- Java 版本固定 JDK 21；数据类使用 Lombok；依赖使用构造注入。
- Spring Boot 4 JSON 统一使用 Jackson 3 `tools.jackson.*`，禁止新增 Jackson 2 `com.fasterxml.jackson.databind.*` 业务引用。
- Schema 继续为 41。

### v0.41 已完成（保留基线）

- 自由套索、Alt 穿透循环选择、Feature 级预高亮。
- World/Local Gizmo、XY/XZ/YZ 工作平面可视化、View Cube BACK/BOTTOM。
- 对象类型右键菜单和 A/B 端精确拉伸。

## 3. 用户明确的范围约束

### 不兼容旧工程

当前开发阶段**不维护历史 Schema 兼容**，并且用户明确每个版本都按全新工程处理：
- `ProjectSchema.load()` 只接受当前 schema 62；
- 不新增历史 migration chain；
- 不为旧 `profileSpec` 或旧 Schema 做自动转换；
- 可以直接重构当前数据结构，但 sample / tests / docs 必须同步。

### 不做原料/库存/余料

这是明确产品范围，后续智能体不得自行恢复：
- 不做 3m/4m/6m 原料长度管理；
- 不做锯缝/端损 cutting-stock 排料；
- 不做余料库存、余料优先；
- 不做项目间余料复用；
- 不做采购新料/旧余料区分；
- 不做库存快照。

`cut-list.csv` 仅描述“设计需要哪些型材件、长度多少、端部怎么切”，不是原料排料结果。

### 设计阶段不暴露制造规格

- 设计入口展示截面尺寸、槽位、封边、长度和具体截面型号名称（尺寸 → 型号）；型号名称用于选择几何，不等于绑定真实制造材料；
- 壁厚、米重、合金、真实料号等只属于后续制造配置/材料查看/导出阶段；v0.71 因用户要求目录同名，允许“欧标”作为参考截面显示标签，不将其当作真实制造绑定；
- 报价、单价、成本估算暂不实现；
- 不做供应商商城、订单、库存体系。

## 4. 技术栈和硬约束

### 后端
- JDK 21
- Spring Boot 4.x
- Maven
- 静态资源承载 + Catalog REST / MyBatis XML / SQLite

### 前端
- Vue 3
- JavaScript / ES Modules
- Three.js
- 浏览器直接运行

### 禁止事项
- 不用 TypeScript。
- 不用 Vite。
- 不用 npm/webpack 前端运行链。
- 不使用运行时 CDN。
- 不改成 React/Angular。
- 不要求 Node dev server。
- 不把 Three.js Mesh 当持久化业务模型。
- 不允许 `Three.js Scene -> 直接 dump DXF` 代替 Drawing Model。
- 不绕过 `FactoryValidator` 正式导出 Factory Package。
- 不直接从 UI 修改装配/连接/加工领域数组；优先经过 Manager / Editor API。
- 不恢复 StockCutOptimizer / offcut inventory。

Three.js 通过 Maven 构建期 WebJar 解包成本地静态资源；浏览器运行期不依赖 CDN。

Profile / Accessory Catalog 使用 SQLite；数据库属于本地目录主数据层，**不能直接作为 Three.js Mesh 或 Project Part 持久化模型**。


### 4.1 代码风格与中文注释（强制）

Java 代码必须与用户现有工程规范一致，完整规则见 `docs/JAVA-CODE-STYLE.md`：
- `controller` 只做 HTTP 协议适配；实体统一放 `domain/entity`。
- Service 接口放 `service`，实现类必须放 `service/impl`，禁止重新把接口和实现放在同一包。
- Mapper 接口只声明数据库操作，SQL 全部位于 XML；公共表名/字段统一维护在 BaseMapper.xml。
- 使用 Lombok 简化实体和构造器；Bean 依赖优先 `final` + `@RequiredArgsConstructor` 构造注入。
- 禁止使用 `var`；局部变量使用显式类型。
- 不为了短代码滥用 Stream/Lambda，尤其是复杂业务流程、可变局部状态和需要诊断信息的逻辑，优先普通 `for`。
- Spring Boot 4 使用 Jackson 3：业务代码 import `tools.jackson.*`；不得重新引用 `com.fasterxml.jackson.databind.*`。
- 核心类、公共方法、复杂状态机、几何/坐标算法、约束/加工/工程图/DXF 逻辑必须写**中文注释**。
- Javadoc 描述与 `@param/@return/@throws` 之间不额外插空白行。
- 注释解释“为什么”、坐标/单位/边界，不逐行翻译代码。
- UI 不直接改领域数组，优先走 Editor / Manager API；相同几何/槽位/特征逻辑保持单一事实来源。
- 修改功能时同步测试与交接文档。

## 5. 启动与验证

```bash
mvn clean test
mvn spring-boot:run
```

浏览器：`http://localhost:8080/`

前端回归：

```bash
for f in $(find src/main/resources/static/js tools -type f \( -name '*.js' -o -name '*.mjs' \)); do node --check "$f"; done
for f in tools/verify-*.mjs; do node "$f"; done
```

交付前至少：
1. 全部 JS/MJS `node --check`。
2. 全部 `tools/verify-*.mjs`。
3. 有 Maven 时 `mvn clean test`。
4. 浏览器手测当前核心交互。

## 6. 关键目录

```text
src/main/resources/static/
├─ index.html
├─ css/app.css
├─ js/
│  ├─ app.js
│  ├─ core/                  # Editor / SceneManager
│  ├─ drawing/               # 在线绘制 + Drawing Model/Layout + SVG/DXF
│  ├─ interaction/           # Profile Grip
│  ├─ dimension/             # DimensionSystem
│  ├─ model/                 # 型材/装配/槽/连接规则/五金
│  ├─ snap/
│  ├─ constraint/
│  ├─ connection/
│  ├─ machining/
│  ├─ annotation/
│  ├─ export/                # BOM / Factory Package / DXF 等
│  ├─ io/                    # ProjectIO / ProjectSchema
│  └─ validation/
└─ samples/

tools/                       # 当前版本回归

docs/                        # 架构、专题、交接
```

注意：v0.38 已不存在 `js/manufacturing/StockCutOptimizer.js` 和 `StockLayoutExporter.js`。

## 7. 核心架构原则

### 7.1 业务模型 != Three.js

```text
Project Model
   ↓
Editor Domain / Managers
   ↓
Renderer / THREE.Object3D
```

Renderer-only 状态不得写进 Project JSON。

### 7.2 型材制造局部坐标稳定

直型材：
- local Z：A → B
- START：A 端 / Z-
- END：B 端 / Z+
- local X/Y：截面方向

加工主坐标：`stationS + face + offset`。不要把偶然世界坐标保存为制造事实。

### 7.3 Feature / Slot 单一事实来源

- `ProfileFeatureCatalog.js`：端点/端面/槽特征。
- `ProfileCatalog.slotDefinitions`：目录槽位。
- `SlotMatcher.js`：连接件/T 螺母槽位匹配。

Snap、Feature Selection、Connection、Machining 不得各写一套槽中心近似。

### 7.4 装配层级不依赖 Scene Graph

`AssemblyManager` 管理持久化层级。父级锁定/隐藏有继承语义；爆炸图为 presentation-only。

### 7.5 MachiningFeature 是制造语义

当前加工统一经过：
- `MachiningFeatureCatalog`
- `MachiningManager`
- `MachiningPatternManager`
- `FactoryValidator`
- Drawing / DXF / BOM

### 7.6 Dimension 是语义实体

永久尺寸引用 Anchor / Binding；不要退化成两个静态世界点。

当前核心驱动：
- `PROFILE_LENGTH`
- `PROFILE_RADIUS`
- `PROFILE_ARC_ANGLE`
- `MACHINING_STATION`
- `MACHINING_OFFSET`
- `PART_AXIS_DISTANCE`
- `PART_AXIS_COORDINATE`
- `PART_CLEARANCE`
- `SLOT_CENTER_DISTANCE`
- `PROFILE_ANGLE`

尺寸修改必须走 `Editor.setUserDimensionValue()`。

### 7.7 Drawing Model 独立

```text
3D Design Model
  -> Geometry / Constraint / Machining / Dimension
  -> EngineeringDrawingModel
  -> Layout
  -> SVG / DXF
```

工程图不得从 Three.js Scene 直接拼线。

### 7.8 BOM 也只读业务数据

`BomExporter` 从 Part / Assembly / Hardware / MachiningFeature 生成报表。

必须同时保留两种粒度：
- 汇总：Profile/Hardware/Machining/Subassembly BOM；
- 实例：`cut-list.csv` / `machining.csv`。

Assembly path 必须来自 `AssemblyManager`，不能从 Scene Graph 推断。

## 8. Project Schema 62

根字段：

```text
schemaVersion
metadata
coordinateSystem
manufacturing
editorState
parts
connections
constraints
assemblies
profileSections
dimensions
```

合法 Part 类型：

```text
PROFILE
SHAFT
PANEL
ACCESSORY
```

`manufacturing` 当前只保留：

```text
unit
strictExport
minimumEndDistanceMm
duplicatePositionToleranceMm
collisionToleranceMm
contactToleranceMm
```

禁止把 stock/offcut/inventory 字段重新写回 Project JSON。

`editorState` 当前关键版本：

```text
designModelVersion = 1
manufacturingConfigurationVersion = 1
connectionAnchorVersion = 1
connectionPlacementVersion = 2
machiningPlacementVersion = 1
autoConnectionSystemVersion = 2
connectionQuickChangeVersion = 1
panelDoorConfiguratorVersion = 1
profileReplacementVersion = 1
hardwareBomVersion = 2
bomReportVersion = 1
productionInspectionVersion = 1
engineeringDrawingSystemVersion = 2
engineeringDrawingDxfVersion = 1
profileGripEditingVersion = 1
dimensionSystemVersion = 2
```

## 9. 当前能力摘要

### 在线绘制
LINE / POLYLINE / RECTANGLE / BOX；XZ/XY/YZ 工作平面；正交、网格、固定长度、端点续画。

### Profile Grip
A/B 单端拉伸、固定对端、实时 HUD、精确输入、网格/Feature Snap、连接/约束保护、加工基准联动。

### 约束
Coincident/Distance/Angle/Parallel/Perpendicular/Coplanar/Coaxial/Slider/Revolute/Cylindrical；多约束 DOF、冲突分析、受限拖拽、DOF Gizmo。

### 装配
总成/子装配、整体 Transform、继承锁定/隐藏、隔离、安装顺序、非破坏爆炸图、关系检查。

### 连接
设计阶段保存抽象 `designType`；制造阶段再绑定 `manufacturingRuleId`。支持端面连接、20/30/40/45/60/80 系列角码、内置/锚式、连接板、slotId/T 螺母、脚轮/脚杯和紧固件 BOM。

### 加工
孔/攻丝/沉头/沉孔、槽/腰孔/铣削、端面加工、孔组、阵列、镜像、基准、2D footprint 冲突检查。

### 尺寸
W/D/H、长度、孔位、轴距、槽中心距、夹角、Baseline/Continue/Ordinate/净间距、弯曲 R/Angle。

### 工程图 / DXF
EngineeringDrawingModel；正/俯/侧/ISO；A3/A4；标准比例；总尺寸/层间尺寸；标题栏；总装/子装配 SVG + DXF；DXF layer 分层。

### v0.38 制造报表（仍保留）
- 项目汇总 BOM
- 型材 BOM
- 五金 BOM
- 加工 BOM
- 子装配 BOM
- `cut-list.csv`
- `machining.csv`
- BOM 一致性报告


### v0.39 生产检查（仍保留）
- 直型材 OBB-SAT 体积穿透检查。
- 几何接触但无连接/约束的连接完整性 WARNING。
- AssemblyInspector / ConstraintDiagnostics / BOM consistency / Machining validation 合并进统一 Factory Gate。
- 问题可在 UI 中直接定位相关构件。

### v0.40 在线交互 / 型材目录（历史能力）
- Part hover 预高亮与浮动标签。
- 平滑相机切换。
- 型材 SVG 截面缩略图。
- SQLite 保存 Profile / Accessory Catalog 目录主数据；Project Part 仍以工程 JSON 为事实来源。
- 页面/REST/直接 SQL 三种方式扩充自定义型材。


### v0.41 CAD Interaction 2.0
- 自由套索 + 矩形框选；Shift/Ctrl 追加选择。
- Alt + 单击在同一射线候选中循环穿透选择。
- FeatureHoverManager 统一端点/侧面/槽中心预高亮。
- WorkPlaneVisualizer 显示 XY/XZ/YZ 当前工作平面。
- TransformControls 支持 World/Local 坐标空间。
- 右键菜单按对象类型展示型材拉伸、加工、连接等入口。
- UI 增加 Feature HUD、套索轮廓、坐标空间状态和 CAD 快捷键提示。

## 10. 已知边界

- 约束求解仍不是通用商业 CAD 全局非线性求解器。
- 槽位是目录显式模型，不是任意外部 DXF 自动拓扑解析。
- 加工碰撞主要是制造面 2D footprint，不是完整刀具/夹具实体仿真。
- 构件碰撞的精确承诺当前仅覆盖直型材 OBB；弯型材/复杂附件尚未做真实实体布尔。
- 几何接触未连接检查是启发式 WARNING，不会自动替用户选择连接件。
- HIDDEN layer 已保留，但真正 HLR 尚未完成。
- 未完成剖视、局部放大、BOM 气泡/自动引出线。
- Profile Grip 当前主要面向 LINE 型材；ARC 由 R/Angle 驱动。
- BOM 一致性当前是基础 reconciliation，后续还可加入 Drawing balloon/BOM id 对齐。

## 11. 下一步

主线：**工程制造视图 + 玩家装配指导**。

优先：
1. 统一制造编号，清单、工程图、装配说明共用同一编号。
2. Tagged Drawing / BOM 气泡和自动引出线。
3. 装配步骤生成、步骤零件清单和当前步骤三维高亮。
4. 制造检查继续增加领域规则，但不做 FEM 结论。
5. 继续完善小屏和浮动工作台交互。

不要实现报价/供应商体系；不要恢复原料/库存/余料；不要恢复旧 Schema migration。
