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

- 代码版本：**v0.75.23**
- Project Schema：**62**
- 当前主题：**页面内删除确认、统一右键菜单与型材表面编号**
- 上一版：**v0.75.22 加工提示按需显示与深色孔口展示**
- 下一版：**继续补未适配接头、自动框口和复杂安装；不宣称全型号或制造精度一致**




### v0.75.23（交互层统一与只读表面印字）

- 鼠标删除入口使用 WorkbenchConfirm 深色页面内确认，显示所选编号；取消默认焦点、Esc/遮罩取消、Tab 焦点约束和背景快捷键隔离。确认后复用原 Editor.deleteSelected，一次撤销；确认期间选择变化则拒绝误删。D/Del 保留参考快捷键直接删除行为；清除全设计连接复用同一确认层。
- 主右键、接头快捷和轮廓关系菜单的选中/悬停/禁用、快捷键、分隔线、输入和下拉统一深色；右键长度编辑守卫与实际端点约束一致，不以可点击外观绕过连接/锁定。删除绑定显式调用，避免 MouseEvent 被当作确认参数。
- ProfileSurfaceNumber 使用已有 displayId，在真实外壁三角面裁剪透明印字，不架跨槽/孔平板、不使用悬浮 DOM/Sprite；矩阵随动、实体遮挡、黑色型材浅色字。四个实际平面各选一条实心带，短杆/弧形参考段按真实可用长度缩小；无足够实心带不伪造印字面。
- 默认开启“型材表面编号”，顶部显示和底栏显示菜单可关闭，保存/刷新沿用；旧 Schema62 缺失此显示选项时默认为 true。印字资源归展示层，不进入构件树、拾取、包围盒、BOM/加工/工程图或历史；编号仍为原 displayId，非新增制造字段或真实激光刻字。
- Schema62/116模块身份0.75.23；检查范围见 VALIDATION。未改变用户原工程/草稿、未升级依赖；其他原生重命名/文件替换弹窗、全参考站一致性仍非本轮完成范围。

### v0.75.22（加工展示修复，不是实体布尔加工）

- 加工标签改为18px内最近一个可见孔位的11px深色悬停提示，移开、按下、拖动和加工放置期间隐藏；反面/遮挡不隔着主体显示。提示夹在实际画布内，不恢复绿色大卡片；同时抑制普通侧面文字的重复提示，不改特征选择事实。
- 孔位尺寸链默认关闭，显示菜单可独立开启；“加工悬停提示”可独立关闭。旧工程明确保存的显示选项保留，不清localStorage、不默改已有尺寸/加工。
- 圆孔使用深色孔口及中性金属边缘，透明反馈之后绘制、实体深度遮挡仍有效，选中金色不覆盖孔口。通孔入口/出口、沉头/沉孔复合入口和端孔偏移使用共用展示坐标；悬停放置为细蓝灰轮廓，不写工程。
- 这些是独立加工示意网格，仍不做型材材料实体布尔开孔；不把黑孔口当制造精度、碰撞空腔或真正透视证据。加工参数/工程图/制造门禁不改，Schema62及114模块身份统一0.75.22，验证见VALIDATION。

### v0.75.21（本轮七项审核修复，复杂安装仍有边界）

- 失效旧关系单列 INVALID_EXISTING 和失效数量，离开吸附邻域也不漏报、不计有效已有；定位只调视角。原记录、手工姿态与制造方案保留。
- ConnectionManager派生设计组件加入实时第三方旋转包络检查，排除自身宿主/同关系；标红并明确“包络检查”，仍保留目标位置，不伪造Part/BOM或空腔布尔精度。
- 90度角码几何/安装共用ConnectionComponentPorts，逐孔核对槽、孔轴、面距离、端范围；长角码列距按系列。3060示例40接触可预览40件（旧24件），16处真实不适配仍拒绝，不移主体、不扩大旧中心容差；正式制造独立。
- 展示和安装统一0.1mm贴合门槛，较大近邻只显示NEAR/间隙，不染已贴合接头；原碰撞与制造容差不放宽。
- 单侧自动、未修改、无制造方案的直角设计关系可只补相反侧，原ID/主面/型号不变，逐侧勾选/预览/取消/一次撤销。手工/修改/制造/空间冲突/指定不同型号不补。
- 四选框口验证边覆盖净开口和四角接触，拒绝断开的短杆、偏移和斜框；仍非自动点框口。
- 新统一框架保存LAYERED_RACK参数/成员映射：右侧“编辑整架尺寸”→左侧改宽深高/层数/承托梁→预览→确认。共同ID/颜色/型号保留，增删层重算自动关系、同步普通框口板，一次历史、刷新续改；预览/取消不写工程/草稿。支持整体刚性姿态，不用旧参数覆盖逐件自由编辑、加工、约束、手工或制造关系、被删层板引用、复杂门/宿主配件。旧无参数/普通副本不迁移，换型材另走替换工具。
- Schema62/114模块统一0.75.21，验证见VALIDATION；原用户JSON和参考不改，不复制专有代码/网格、不扩商城范围。

### v0.75.20（双侧连接件与框架预设，不是全类型安装验收）

- 用户明确同一接头两侧能安装时各放1个；批量默认 BOTH，逐侧检查真实安装面足迹、槽位、主体及已有/本批连接件空间。每侧独立勾选，端部外侧悬空或被障碍遮挡不强放第二件；一处接头保留一条关系，实际组件数量另计。
- 批量类型由现有目录安装映射投影，不再硬编码三个：九类与动态规格（含3/4孔、长截面）及AUTO；自动尝试同系列可用规格/安装面。未配置三通、铰链、滑块、15系列等仍目录手动添加，不伪造安装规则；保守OBB不算复杂件实体布尔。
- 只读扫描区分真实零间隙端面接头与附近未贴合候选，非目标面的越界邻杆排除；不自动挪动主体。已有手工/已修改关系、实体组件和正式制造方案保留；纯自动抽象关系原ID升级，一次提交/历史，失败整图回滚。预览、取消不写工程/草稿。
- 同一关系保存可选 designComponentMountFace/designComponentMountFaces，加载/随动重建每侧独立姿态并复核宿主足迹，移到端边失去支撑明确INVALID；切换设计方式清理旧字段，拒绝非法/非反面的双侧。正式制造按独立选定规则，不把两个设计参考件算成两套已认证五金/加工；Schema62不变。
- 快速框架仅一套宽/深/高/层数/每层中间梁表单，基础框、置物架、鱼缸架、设备架只填预设，改参数变自定义；全部走同一 addLayeredRack，基础框不再忽略层数/中间梁，取消基础/高级重复表单。旧六方截面白名单移除、矩形截面可选，U形A柱排除；画布/异形框工具按需展开保留。
- 3060等矩形截面中间梁长度改为 depth-sy-sx，1000×500示例410mm而非380mm，消除两端各15mm漏接缝；非法尺寸、非整数层数或层/梁重叠在创建前拒绝。不迁移/移动既有工程；矩形多槽面中轴接头的完整安装映射仍待补，不能放宽槽位容差掩盖。
- Schema62、111本地模块同身份0.75.20；验证见VALIDATION，继续保留自动续作、已确认绘制/快捷键/干涉规则与独立制造边界，原用户JSON/原始参考不改。

### v0.75.19（已确认审阅问题修复，不是全功能一致验收）

- 线性/圆周阵列和镜像复制复用已有组件子图复制：完整组件形成独立层级，内部连接、约束、手工加工特征 ID 和安装宿主重映射；派生五金由原 ConnectionManager 重建，不把副本挂回原组件。整批一次历史，异常恢复原工程与选择。向导组件的批量副本明确转为普通组件，保留原件参数，不承诺变换后的生成器仍能用旧坐标重建。
- 镜像不持久化负缩放，直型材的 A/B 端和槽位站点同步反转，刚性相对矩阵/四元数重算；几何完全重叠的副本和零间距阵列明确拒绝。原地镜像尊重零件/组件锁定、有效约束和参数化保护；弯曲、手工加工/斜切型材、异形板和配件镜像仍明确拒绝，不通过近似姿态伪装精确反射。
- 隐藏零件/组件同步隐藏连接辅助实体、派生五金和安装配件；继承隐藏不覆盖配件自身 hidden 值，显示、撤销和刷新重新判定。可见连接件的实体直接拾取连接 ID，右侧打开并高亮对应卡片，点选不写历史/草稿；生成组件的嵌套预览标签不能抢走连接拾取。
- 常用选择/绘制/移动/旋转以及绘制中的结束按钮保留短文字；复制/删除、镜像、快捷旋转、对齐/拉伸等保留在更多菜单，次要视图开关归入同风格显示菜单。底栏仍实际占位 48px 单行，窄屏横向滚动，菜单按视口定位；右侧批量替换截面折叠，属性标签增大，不删除批量领域能力。
- 新工程默认仅给所选/悬停型材显示长度，旧工程保存的显示设置不覆盖，全部尺寸仍可主动开启；总尺寸采用灰蓝，候选绿/接头黄/齐平紫/干涉红保持。网格细线按像素密度收敛、粗格保留四象限色，View Cube 增强明暗/轮廓，不改真实相机方向、26区域拾取或原点。
- Schema62不变，111个本地模块同身份0.75.19；语法、63项回归、JDK21 Maven 与隔离浏览器证据见 VALIDATION。本地原8083监听已停止后才恢复预览，不终止已有进程；不修改用户原JSON/原始参考，不复制专有代码/网格或绕过账户/PRO。
- 相对模块 import 不追加 `?v=`，由统一 importmap 管理身份；新增/改变引用须同时核对实际网络请求，不能只验证映射表。底栏重新绘制复用已注册的 startProfileDraw/FREE，不保留不存在的事件方法。

### v0.75.18（基础流程改进，不是全功能一致验收）

- 用户最新要求借鉴嘉立创与乐玩各自好的基础搭建实现；不再把逐项机械复制单站作为唯一取舍。已确认快捷键、唯一画笔、地下允许/干涉红色保留、底栏停靠、自动续作及独立制造边界保持。实际公开观察与未观察范围见 reference/basic-building-review-2026-10-08-v07518.md。
- 修复首击后零长度附近输入框隐藏/失焦，以及清空输入后 Ghost 仍保留旧数值长度；空/无效草稿刷新到指针预览。首击前短段、瞄准器、Tab 换轴和单次完成不改，预览仍不写 Project/BOM/历史/localStorage。
- E 快速对齐改为右侧审阅：明确固定基准、中心 X/Y/Z 多选、A 对 A/B 对 B、统一长度和排列。直角贴合仅两根直型材，自动转向到指定侧面/站位，复用完整端面足迹落位；过小接触面和斜切拒绝。青色/红色目标模型只读，确认一次历史、无变化不记历史、取消原位；约束/参数化组件/加工长度保护不绕过。
- 左侧自动生成连接件先扫描并预览目录角码/内置角槽/一字连接板，按现有系列、法向、槽位、零间隙、宿主与第三方安装空间守卫，逐项勾选后一次提交。多选构件不被移动工具的排除规则漏扫；未贴合不挪型材，已有实体、手工/已修改连接、正式制造方案保持。纯自动抽象关系可在原 ID 上升级，失败整批恢复。
- 预览与确认共用 ConnectionPlacementManager / ConnectionManager 的几何和安装变换；designComponent 保存/恢复且随接头更新，不是制造五金/螺钉/孔位已配置。复杂安装空间仍是保守包络，三通/斜接/曲杆与未适配系列不冒充自动支持。审阅期间保留相机旋转、禁用背景建模；Esc 在表单中可取消，退出恢复目录 canvas 与 Gizmo。
- Schema62不变，111个本地模块统一0.75.18；174项语法、62项verify、JDK21 clean test及实际浏览器范围见VALIDATION。未修改用户原工程/参考原始资料、未重启用户8083进程、未复制专有源码/网格或绕过账户/PRO。

### v0.75.17（全功能对齐尚未完成）

- 重新实际观察 Lewan 首击前、首击后长度输入和第二击完成：v0.75.14 将“添加构件中”误读为固定长度连续落位，观察不充分。普通选材和拖到画布现在共用 FREE：先拿起画笔，第一击只定起点，鼠标拉长、第二击或输入长度确认一根，默认完成回选择；不另落500mm构件，不保留第二个添加/绘制入口。
- 画笔采用固定32px橙色瞄准器式光标，不是世界尺寸球或工程对象。首击前只显示按截面生成的40–120mm短段，不能由默认500mm长度控制；普通目录移除默认长度字段，显式指定长度留在展开设置。Tab换Z/X/Y方向、Esc/右键退出，临时实体不进Project/BOM/历史/localStorage。
- 长度框首击后为空且聚焦，鼠标终点和数值共用原绘制事务；确认只新增一次历史，取消不创建。用户明确的干涉保留红色延伸到显式FREE确认，红色落位不冒充自动吸附/连接；原制造门禁不降低。
- 实际贴合的局部接头带改为黄色，存在大于0.1mm间隙不画已贴合黄带；待吸附绿色、干涉红色优先、齐平紫色保持。只读真实三角面提示不填孔槽，颜色不是正式制造五金完成的证据。
- 内部ProfilePlacementManager API保留，普通选材不再进入固定长重复放置；Schema62不变、110本地模块身份0.75.17。原v0.75.16吸附释放修复和提交即保存/启动续作保留，检查证据见VALIDATION；完整一致性仍见ROADMAP。

### v0.75.16（全功能对齐尚未完成）

- 用户最新工程复现横梁 Y=19.31 松手回到 Y=10 / 底面 -10 mm：槽优先级高于零间隙贴面所致。现在按实际补偿距离选候选，侧面落位考虑完整端面足迹及邻近齐平边；同距离才按特征优先级。不是地面硬限位，主动负离地位置仍允许。
- 平移不再将已有欧拉角取整到90度；端面/槽要求法向相对。预览和提交共享捕获/释放范围，锁定面/槽身份而非每0.1mm变化的站位；明显靠近另一特征可换候选。约束求解后再验证三维贴合，不能遗留假绿色/自动连接。
- 吸附预览显示松手补偿的XYZ毫米值、目标编号与当前/未来齐平；成功显示零间隙。提示球/圆环移除，吸附点及普通特征悬停点统一5px Points，普通选择清理过期提示，不参与业务/拾取/历史。
- 用户确认需要 localStorage 续作。沿用当前 alu-cad-autosave 键，编辑提交立即保存标准 Project；启动目录注册完成后自动恢复，打开/新建/示例明确保存，撤销/重做同步。离开只重试最后提交快照，不保存未确认拖动/预放置。
- 草稿损坏/Schema不支持时保留原文并禁止启动空白覆盖；配额/访问错误显示失败，不冒充已保存。文件菜单可恢复、导出原文和确认清除；原JSON下载仍独立，localStorage只属于同一浏览器/同一origin的一份最近工程，不是跨端云存储。
- Schema62不变、110个本地模块身份0.75.16；两个新增回归与真实浏览器证据见VALIDATION。未改用户原工程、未重启已有8083进程，未宣称完整Lewan一致。

### v0.75.15（全功能对齐尚未完成）

- 按公开快速对齐行为补上中心对齐平行检查：非平行构件明确拒绝，坐标和历史不变；不把这一条修正当成完整锚点/复选轴/排列语义已对齐。
- 实际观察参考 S 双向生成：选光轴生成 9 类配套夹具，站位百分比、多孔对齐选择；选夹具生成光轴，孔选择、长度和带符号起点偏移。448px 深色紧凑模态，生成才提交，取消/模态快捷键隔离；不再把打开 SK 目录算作智能生成。
- shaftFixturePorts 与真实共用几何一致，所选孔 ID 写入已有 SHAFT_AXIS 安装引用，孔轴和孔心共同转向/定位。宿主移动、加载刷新及异径校验使用所选孔，不只检查未使用的主孔。反向生成普通可编辑光轴，不臆造参考尚未核实的附加约束/随动关系；两种生成各一次历史。
- 参考公开 Φ8 L夹属性宽/高/长为17.6/32/32，设计参考宽度改为2.2倍直径；预览/构件复用几何。仍不是供应商制造精确网格，其他组件材质/光照/比例未宣称全部像素一致。
- 左轨按连接件、框架/抽屉/板材、光轴智能、选型、标注分组；框架、抽屉、板材、批量表单分开。底栏按移动/旋转/镜像/复制/删除/隐藏/标尺/拉伸/对齐/复位排列，图标 tip 和可读 aria 名称；高级批量/检查/编组仍在更多，不删领域能力。
- 镜像弹出 X/Y/Z 方向；隐藏无选择时变为显示隐藏件。新增明确确认的全设计连接清除命令，经 ConnectionManager 清派生五金/加工，一次历史，手工加工和主体保留；旧纯自动清除仍存在。参考 PRO 自动连接/向导内部算法未取得证据，原生成器不算等价。
- 顶部菜单悬停展开、跨菜单切换，鼠标点击不会立刻合上；键盘/触屏保留原生展开。创建型材显示规格尺寸，单型号组不显示多余二级框，多型号/封面版本仍保留真实身份。上前默认、四象限网格、底栏停靠等剩余视觉差距仍列在 ROADMAP，不宣称本轮已改完。
- Schema62不变、109个本地模块身份0.75.15；新增双向孔轴/贯通/站位/守卫回归，检查范围见 VALIDATION。未复制专有源码/网格、未绕过登录/PRO、未修改用户原工程文件。

### v0.75.14 第一阶段（全功能对齐尚未完成）

- 用户最新确认所有搭建/编辑功能及操作体验以 Lewan 为准，快捷键全部跟随其公开表；这覆盖此前 E 自由绘制、B 框选、G 网格、X 方向切换等冲突定制。无须再次询问这些已确认选项，不复制专有源码/模型、不绕过登录/PRO，也不擅自扩展商城/报价。
- 型材预览默认固定长度预放置，Tab 切换 Z/X/Y、连续点击添加，Esc/右键退出；Ghost 共用几何、Snap/Connection 提交且不写 Project/BOM/历史。两点 FREE 保留显式入口但不占 E。
- W/M 移动、R 旋转、E 快速对齐、G/X 组合/解组、B 快捷搭建、T 标尺、S 所选光轴配件、D/Del 删除、Esc 取消选择、1~6 前/后/左/右/顶/底、V 复位。Space 临时框选、Ctrl/Alt 拖拽复制；补充旧方向键/Tab距离不抢表单、放置与模态。
- 构件直接拖动与复制复用 Transform 事务；阈值后创建副本，鼠标松手一次历史，Esc 完整取消。完整组件及内部连接/约束重映射新 ID，部分复制解除外部安装/参数宿主，不把副本继续写回原组件。
- 快速对齐已实现中心、平行端面/长度、均分及黄金比例排列；垂直连接、参考选择基准/排列细节仍需进一步逐操作核对，不能宣称全菜单一比一。区域整体拉伸采用独立范围工具，确认范围后移端点，不缩放截面；已加工/有效约束/参数化组件明确保护，更多类型待补。
- Schema62不变、109个本地模块同身份0.75.14；验证见 VALIDATION。更完整的待办和参考观察边界见 HANDOFF/ROADMAP 与 reference，不把受限 PRO 流程写成已验证完成。

### v0.75.13 已完成

- 支持的角槽/90度直角/角码/重型角码、内置和连接板靠近已有接头自动识别，鼠标在小空隙内也可拾取；原 ConnectionManager 规则、实际面法向、系列及接触间隙共同校验，Tab 只切换合法候选。预览和安装共用外表面角点/朝向，不再把角码根部放在型材中心线。
- 已自由放置的支持连接件可显式“吸附到接头 · 自动调整方向”；取消保留原件，确认后转为设计连接、一次撤销恢复。已有约束/尺寸引用/正式制造方案不被静默替换；第三方安装空间采用保守包围盒，不宣称复杂件实体布尔精度。15系列、45度及未配置复杂组件仍明确自由放置。
- 移动工具下方向键按可见画面选择画布/构件操作轴；使用移动步长，0步长时1mm，Shift十倍，PageUp/Down使用剩余前后轴。Tab 聚焦底栏带符号毫米输入，再次Tab/Shift+Tab切换X/Y/Z，Enter复用Editor事务；拖动途中从起点计算总距离，Esc取消且不增加历史。
- 不劫持表单/可编辑文本、绘制、安装、测量/选择工具或模态窗口；连接件Tab候选优先。锁定、多选、约束、安装随动、干涉保留红色、连接重算与撤销仍遵循原链；Schema62/105个模块身份同步0.75.13，检查见VALIDATION。

### v0.75.12 已完成

- 直型材两端取消常驻球体、大圆环和圆形 A/B 标签；只在鼠标距端点18px内或拖动时显示约13px的小箭头。显示尺寸随当前相机换算，透视/正交缩放不改变屏幕尺寸，纯展示不写入型号或工程尺寸。
- 右侧属性顶部新增唯一长度输入与固定 A/B 端选择；编辑草稿在 Enter/change 时走 Editor.setSelectedProfileLengthFromEnd，保持对端世界坐标、加工基准、连接/约束检查及一次撤销。输入不直接修改 Part.length，旧重复长度入口移除。
- 双击可编辑端部不再打开浏览器 prompt，而是定位右侧输入、选择正确固定端并选中数值；移开隐藏箭头，Esc 取消拖动仍恢复原几何。已连接/约束端红色小箭头，侧栏禁用对应移动方向；多选/锁定不允许通过数值入口绕过。
- 原放置工具端点点击屏蔽保留，端部箭头不抢 Gizmo 拖动。Schema 62 不变，模块缓存和交付文档同步；真实输入、鼠标悬停/拖动/取消验证见 VALIDATION。

### v0.75.11 已完成

- 用户最终确认允许进入 Y=0 平面以下；不做地面硬限位或导入自动抬升。按移动范围最低真实外表面显示带符号离地距离，底面到地面蓝色、平面以下橙色，跨平面有去抖提示；竖直方向提供显式“落地”。
- 用户明确干涉不再弹回：Gizmo/沿轴贴合/快捷旋转保留目标位置、真实材料面标红、一次撤销恢复。此决定覆盖 v0.63–v0.75.10 的碰撞回滚规则；约束仍有效，FactoryValidator 实体干涉门禁不放宽。
- 单击正轴箭头显示工作台底栏距离，不触发自动吸附/历史，也不被画布二次选择吞掉。正反方向使用完整旋转 OBB 沿轴扫掠计算表面间距，目标明确到构件编号；当前方向无目标直接说明。
- 显式选择目标后沿轴贴合，提交只检查该目标，不被附近另一槽位抢走；干涉位置不自动跳到其他候选、不冒充绿色吸附/自动连接。成组范围、约束、安装随动、连接重算与历史经过既有 Editor 事务。
- 使用用户工程的隔离副本检查已有 P-002→P-001 零间隙设计连接、选定立柱目标贴合、一键补 P-001→P-003；不改原文件，不承诺真实五金已生成。Schema 62 保持不变，交付验证见 VALIDATION。

### v0.75.10 已完成

- 上表面齐平使用规范侧面法向、平面距离及双方角点偏差判断；实际齐平的两侧材料面紫色，存在高差则显示毫米值。中心线/屏幕投影不作为齐平证据，竖杆、未知实体表面不误报；只读展示，不新增约束。
- 吸附候选使用原干涉分类器预判整根构件及随动件的虚拟落位，包含第三方障碍；提交和 Tab 切换重查。源端与目标面必须法向相对，不能把伸入实体的反面当可用候选。
- 干涉回退清除 Mesh 和 UI 吸附状态，合法连接候选不再携带不满足几何的错误文本。槽中心吸附可能改变当前齐平高度，提示明确区分当前状态与吸附后高差，不暗中改变候选/制造槽位规则。
- 只读观察 Lewan 选型/预放置/无宿主拒绝流程；自动生成连接件为 PRO 边界，不宣称验证其内部算法。核对两个用户提供的 GitHub 仓库，已实现能力与规划文档分开，未发现明确许可证，不复制外部代码。
- Schema 62 不变；版本映射全量更新，验证和参考记录见 docs/VALIDATION.md 与 reference 索引。

### v0.75.9 已完成

- SurfaceFeedback 只读复制实体三角面：候选面绿色、已判定贴合的局部接触带蓝色、所选实体橙金色。孔槽不填平；红色真实干涉优先；近似 AABB 不冒充精确接触面。提示网格不进入工程、BOM、选择和历史。
- 接触带使用已有 SAT/OBB 结果，视觉扩展宽度不能成为制造容差或自动连接成功的证据。选择提示跟随矩阵与几何重建，退出绘制清理提示，嵌套展示资源正确释放。
- 移动工具仍仅保留三个正轴显示/拾取柄，箭杆和锥尖细化；五金材质增加本地环境反射，通用角码保留原安装角点并细化通孔/侧肋，不宣称制造精确孔径。
- 修改页连接内卡、加工卡、状态标签和下拉框全状态统一深色；加工按钮换行、窄面板信息改为单列。连接推荐/禁用校验、加工 Manager 不变；暂无加工提示修正为右侧创建入口。
- 新增真实表面/通孔/裁剪/只读/释放回归；Schema 62 不变，全量版本映射更新。交付证据见 VALIDATION。

### v0.75.8 已完成

- 镜像改用“镜像方向 / 对称位置 / 以画布原点为基准 / 以所选构件中心为基准”；圆周阵列、轴方向提示、旋转无障碍标签和网格说明同步去掉“世界 / 局部轴”，但 WORLD_ORIGIN / SELECTION_CENTER / world / local 内部值不改。
- 批量面板显示未选中原因与 Shift 多选提示，选中后显示数量。三个执行按钮仍只在 selectionCount=0 时禁用，不改成对整个工程执行，也不改变镜像/阵列算法。
- 浏览器已确认批量入口可打开，选中一根构件后三个按钮可用；交付检查见 VALIDATION。版本/模块缓存参数 0.75.8，Schema 62 不变。

### v0.75.7 已完成

- ComponentGeometryFactory 的带孔挤出直接保留已有真实内壁，移除重叠的黑色圆筒；正交夹具孔壁与外表面共用受光金属材质，不再使用纯黑 MeshBasicMaterial。预览、预放置和正式构件仍复用同一工厂，不新增制造字段。
- 主孔和相交孔原有裁剪保持，不能以白色圆片填孔；盲槽底、橡胶和黑色紧固件不是通孔覆盖层，保留其真实配色。绿色/红色安装预览继续表达合法性。
- 实际参考站出料口的孔口仍有深色背景；用户“点击后白孔”的具体参考状态需补完整截图，不据此宣称所有模型和所有状态像素级完全一致。新增全部夹具/连接规格的孔壁材质与贯通回归。
- 版本/全部本地模块映射同步 0.75.7，Schema 62 不变；验证见 docs/VALIDATION.md。

### v0.75.6 已完成

- 按用户圈出的搭建区，主场景投影锚点调整到画布横向 50% / 纵向 47%；透视/正交和 resize 共用 applyViewportAnchor。只改变投影，不移动原点、模型或 OrbitControls.target，上前初始方向保留。
- index importmap 对全部 101 个本地 JS 统一版本化，避免新 HTML/app.js 混用旧相机、导航或配件模块；同一个模块只保留同一个版本身份。新增模块后用 tools/build-module-importmap.mjs 输出 apply_patch，回归检查映射覆盖率，禁止只改 app.js 的版本。
- JS/CSS 静态资源使用 no-cache 重新校验，本地 vendor 保持原有映射。已在真实 HTTP 缓存中复现旧交点约 65.3% 高度，再普通刷新验证变为 47%；不要求用户反复清缓存。
- 对照参考页四类配件：滑轨从开放槽轨侧、右上斜向展示并增加留白；脚杯金属使用高光、橡胶底低高光，预览和画布共用。黑色小件增加预览轮廓对比，端盖显示实际适配截面，不把泛用参考缩略图当成所选截面。
- 新增 461 组配件预览与真实 addHardware 构件几何/材质一致回归，浏览器分别放置四类配件。版本/缓存 0.75.6、Schema 62 不变；完整验证见 VALIDATION。

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
