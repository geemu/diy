# 项目交接文档 — v0.75.23

## v0.75.23 删除、右键与表面编号

- 鼠标点删除（底栏/编辑/更多/右键）打开深色页面内确认，列出 P-xxx 等编号，默认取消；Esc/遮罩取消，Tab 仅在弹窗内循环，后台建模快捷键不执行。确认复用原删除/关系清理/历史链，选择变更时拒绝误删；D/Del 按既有参考快捷键仍直接删除，Ctrl+Z 可恢复。清除全部设计连接使用同一层；其他原生提示不宣称全替换。
- 三种快捷菜单统一深色输入、下拉、快捷键小牌、分隔线、选中/悬停和禁用。长度按钮按实际移动端检查连接/约束/锁定，可编辑时仍走原 setSelectedProfileLengthFromEnd；Enter 优先调整 B 端，B 固定时才改 A 端，不能两端都被固定还静默移动。
- 默认实际表面印字 P-002 等 displayId：四个有实心材料平面的外壁各选一条带，沿长度方向，随型材旋转/移动；黑色材质用浅字，槽/空洞不填平。顶部“显示 → 型材表面编号”和底栏“显示”可以关闭，偏好保存/刷新恢复。
- ProfileSurfaceNumber 独立拥有几何/字纹理，不挂到工程构件树，不改变包围盒/拾取/碰撞/BOM/工程图/制造字段/历史。按几何与编号缓存；截面/长度重建、编号更新、隐藏/删除/取消显示释放资源。极窄外壁/很短弧形分段字会缩小或不显示，不放大实际零件、不伪造宽面，也不承诺真实加工刻印。
- v0.75.23/Schema62/116模块；验证见 VALIDATION。本机8080和8083均已返回新资源，服务不重启，不写用户实际浏览器草稿/原JSON。

## v0.75.22 加工展示与使用路径

- 画布不再常驻绿色加工大标签；鼠标靠近可见孔位18px范围只显示一个11px深色提示，移开/按下/拖动/加工放置隐藏。反面及被其他构件挡住的孔不显示；提示在画布内夹边，同位置普通侧面文字不叠加。
- 默认关闭孔位尺寸链；顶部“显示 → 孔位尺寸链”可打开，“加工悬停提示”可关闭。旧工程保存的true不强制覆盖；若旧图仍有黄色孔位数字，关闭孔位尺寸链即可，保存/刷新沿用选择。
- MachiningManager与SceneAnnotationManager共用machiningLocalPose；圆孔为深色孔口和金属细边，通孔两侧均显示，复合孔入口不重复，端孔X/Y偏移与原加工事实一致。金色/绿色透明表面提示之后绘制孔口，但实体深度有效，不能透过其他构件。预放置只有细蓝灰圈，点表面才新增原加工项、一次历史。
- 当前仍是加工展示示意，没有型材实体布尔切除/真实内孔壁；原截面、加工参数、工程图、导出/碰撞和制造门禁不改。槽/腰孔/铣削区域仍为原线框示意，进一步实体级展示另做，不宣称完整加工视觉已与参考一致。
- 0.75.22/Schema62/114模块。隔离Chrome实际打孔、撤销/重做、反面悬停和刷新续作通过；检查证据见VALIDATION，不改用户Chrome草稿或原JSON。

## v0.75.21 当前路径和边界

- 自动生成连接件的失效关系不再算“已有”，单列失效数量、红色行与定位，离开邻域也不漏；定位仅调相机，扫描/取消/勾选不写工程。原记录/手工/制造事实保留。
- 默认勾选补齐已有自动件的缺少侧，只补单侧、自动、未修改、无正式制造方案的直角关系的相反侧，原ID/定义/主面不变。指定不同类型/型号、空间冲突不补；一次历史、异常恢复，不等于实际制造配套。
- 已配置正式方案的接头即使保留旧designComponent字段、无设计helper，也按实际五金Part保留；不误报缺件，不将正式显示helper重复计入设计包络。实际7个五金保留/0新生成回归通过。
- 设计组件从helperMeshes加入检查快照，不新增Part/BOM；与自身宿主/同关系排除，第三方重叠标红且说明“安装空间重叠（包络检查）”，不把通孔/空腔包围体当实体布尔。干涉红色保留位置、平面以下允许等已确认规则不改。
- ConnectionComponentPorts是90度角码共用孔位，几何与安装按同一列距；逐孔匹配实际槽、孔轴/面距离与stationS。3060/1000×500×1800/4层1承托梁，40处接触、40个组件可装，16处孔槽或支撑不匹配仍跳过（旧24件/24处受阻）。不靠移动主体或扩大容差假安装；正式规则独立。
- 0.1mm以上近邻不再显示贴合；FrameOpeningResolver检查四条实体边覆盖与四角接触，断开短杆不生成板/门。仍四选轴向矩形，点选自动识别和斜框待补。
- 新框架由LayeredRackModel共用生成/回改布局；FrameParameterManager依据保存的参数与成员ID检查完整性/共同刚性姿态，保护自由编辑/加工/约束/手工和制造连接。确认更新共同成员、必要增删、重算自动关系、同步框口板，一次历史；预览不动原几何、不写草稿。
- 使用：B生成后自动选中框架；右侧“编辑整架尺寸”，左侧改宽深高/层数/承托梁，再“预览尺寸修改”→“确认修改”。也可点其一根杆进入；Esc/右键取消、一次撤销、刷新续改。保持当前型号，旧无参数/普通副本不猜测；删除被板引用的层、复杂门/安装配件、已加工/受约束板材要先处理，不静默抹除。
- 0.75.21/Schema62/114模块；localStorage续作、独立制造边界和原JSON保留。复杂自动安装、空腔碰撞、自动框口仍不是全部完成。

## v0.75.20 当前重点与使用路径

- 左轨自动生成连接件：默认AUTO、两侧能安装各1个；九种已映射目录类型和动态规格可选，全结构/所选范围保留。右侧逐实际组件勾选，显示真实接头数、实际生成数、已有保留、不可安装和未勾选；附近未贴合候选单独展开且不计入生成。不移动主体，不覆盖已有手工/实体/制造关系。
- ConnectionBatchManager独立只读Snap作用域扫描、每型材端/目标面缓存安装候选，枚举源侧面及同系列目录规格。ConnectionPlacementManager使用组件局部OBB与现有SAT，直角类两腿的宿主投影必须完整受支撑；端边/第三方障碍只挡相应侧。已有和本批组件包络参与预留，取消释放全部Ghost；确认全部重新校验后一次历史，异常整图/选择恢复。
- 一个物理接头最多一条关系，直角类可持久化两个互为反面的安装面。helper每侧独立生成，刷新/宿主移动不掉回默认面，移动到端边失去支撑时明确INVALID；切换设计方式清旧面，非法列表加载前拒绝。Schema62可选字段，不做旧工程迁移。正式制造不继承双侧设计数量，不算真实五金/孔位已经配套。
- 快速搭建框架B仅一套统一参数，用途预设填默认尺寸、层数、中间梁；手改转自定义。四个预设都用DiyGenerator→Editor.addLayeredRack，4+层数×(4+中间梁数)根型材。同参数只有组件名称不同，不再基础框忽略层数。画布矩形/空间/异形框与快捷轮廓仍折叠保留，抽屉表单不合并。
- 非方截面中间梁长度depth-sy-sx，新3060/500深度为410mm，消除旧380mm两端各15mm空隙；非法尺寸或明显层/梁重叠在创建前拒绝。只改变新生成框架，不移动用户已有杆件，不代表鱼缸/设备承重已验算。
- 明确剩余：3060等多槽面中轴接头虽已真实接触，中心与两条槽±15mm不匹配仍跳过并解释；需要实际多孔/槽安装端口规则，不扩大容差。多通/铰链/滑块/斜接/15系列、复杂实体碰撞待补；既有实体关系整处保护，暂不补该关系缺少的第二件。当前改进不等于两站全功能或全部连接位置已完成。
- 0.75.20/Schema62/111模块；新增verify-connection-batch-v07520及本轮浏览器/构建证据见VALIDATION。只更新本机8083静态资源，隔离浏览器检查，不写用户Chrome草稿/原JSON，不提交/推送。

## v0.75.19 当前重点与边界

- 用户已确认修复本轮审阅问题。线性/圆周阵列、镜像复制现在共用 copySelectedForDrag 的完整内部关系复制：新组件/嵌套层级独立，连接、约束、加工引用与安装宿主重映射，自动生成五金经原连接重建。部分选择仍只复制所选范围的内部关系，外部安装引用解除，不改变原件；一个批次一次历史，失败恢复原图及选择。
- 镜像采用反射乘局部Z反向的正旋转，避免负scale无法正确保存。A/B、semantic feature stationS 和目标轴向偏移一并变换，重新捕获刚性相对矩阵；连接源端交换后由原规则重算槽位及目录组件姿态。原地镜像对锁定/有效约束/参数化对象拒绝，完全重叠镜像和零间距阵列也拒绝，并给可理解的原因。
- 重要边界：批量副本中的向导组件转为独立普通组件（界面明确说明），原向导参数不动；不声称框架/抽屉生成器能重新生成任意旋转/镜像结果。弯曲、手工加工/斜切型材、异形板和配件的精确镜像尚未支持，保守拒绝而不是丢加工或只镜像外框。线性/圆周复制仍保留已有这些部件的数据与安装引用。
- AssemblyManager.isPartEffectivelyHidden 处理组件祖先、mountReference 与 generatedByConnectionId；ConnectionManager.refreshVisibility 让宿主隐藏时连接实体/五金同隐，原各部件 hidden 不被继承状态覆盖。显示、撤销与重新加载走同一判断；无需删除关系来隐藏模型。
- 鼠标点击可见连接实体/派生五金，Editor.selectConnection 选取两宿主并打开右侧对应连接卡，卡片有连接编号、高亮与滚动定位。SceneManager.resolveRoot 优先连接 ID，避免 ComponentGeometryFactory 的嵌套预览 part 抢拾取。普通点击不修改 Project/历史；绘制、测量、安装等独占工具的优先级不改。
- 右侧唯一常用截面选择保留，额外“批量替换截面”折叠。底栏常用选择/绘制/移动/旋转与结束绘制有文字；其他动作在更多菜单，视图开关在显示菜单。主工具与状态独立占位48px；菜单固定视口定位，不能被底栏滚动裁切，显示菜单全状态采用深底亮字而非继承浅色开关。
- 默认长度标签只显示所选/鼠标经过项，显示菜单仍能打开全部；旧JSON或localStorage保存的 showPartDimensions 设置不改。总尺寸灰蓝与接头黄/候选绿/齐平紫/干涉红分开，四色无限网格粗细按屏幕密度收敛，View Cube 明暗更清楚但不假造第三个面。
- Schema62、111本地模块统一0.75.19；新增 verify-workbench-repairs-v07519 与现有回归、JDK21、浏览器范围见VALIDATION。原8083服务无监听后恢复本机预览，绑定127.0.0.1；没有关闭用户Chrome或改其localStorage，检查使用独立上下文。
- 最后一轮实际取消/再绘制发现底栏曾引用未注册的 selectDrawMode，已改为已注册 startProfileDraw/FREE 并显式关闭固定长/连续放置；目录与底栏仍为同一画笔。ProfileSectionPreview3D 的旧查询版 import 改为无查询的相对引用，经 importmap 获取19；实际110条本地JS请求均19，不能只看111条静态映射就宣称缓存一致。

## 后续优先级

- 可点选的自动框口/净尺寸预览、复杂连接安装规则、旧无参数/复杂框架及抽屉参数回改、复杂加工/异形/配件镜像，以及真正的制造映射仍未全面完成。新统一框架的整架参数回改已具备，不把它扩大为任意旧框架或自由编辑结果都可重新生成。

## v0.75.18 当前重点与使用路径

- 最新要求是借鉴两站优点改进基础搭建，不是恢复重复添加入口或撤销既有快捷键。普通绘制仍为右侧选材/拖放拿起唯一画笔，首击起点、鼠标/数值终点、单次完成；现在零长度附近不隐藏输入，清空草稿立即回到指针长度，避免失焦和旧数值残影。
- Shift 多选 → E → 右侧快速对齐：选保持不动的基准，再选中心多轴、端点、统一长度、排列或直角贴合。最后一选为默认基准，锁定基准可不动；需要移动的锁定/安装件和有效约束受保护，参数化组件不允许单独破坏，长度改变保护已有加工/斜切。
- 直角贴合只支持两根直线型材，源 A/B 端、目标真实侧面和 0–100% 站位明确；自动姿态和完整端面足迹共用 SnapManager。靠端边会退让半截面，过小接触面/斜切拒绝；原工程不动，青色目标/红色干涉预览，确认一次历史，取消/无变化不记历史。允许红色目标确认仍不自动冒充合法连接。
- 左侧“自动生成连接件” → 选择角码/内置角槽/一字连接板、全结构或所选范围 → 黄透明目录组件预览 → 勾选接头 → 生成。ConnectionBatchManager 创建只读 Snap 扫描作用域，使用实际 ConnectionPlacementManager 规则与 ConnectionManager 安装变换；不临时改 placement 模式，不把现有多选排除规则用于整体扫描。
- 不移动未贴合型材，不覆盖手工/已修改连接、已有实体组件或正式制造方案；纯自动抽象关系可原 ID 升级。逐行解释间隙、系列、锁定、法向/实体干涉和安装包络；整批重新校验、失败恢复工程与选择，一次撤销。已有 helper 与新组件包络检查保守，未启用类型仍手动安装/自由放置。
- designComponent 的目录实体与 Ghost 共用几何，保存、刷新、重算接头位置使用原 Manager；不产生 manufacturingRuleId，也不等于紧固件/加工已生成。预览时模型、历史和本地草稿不变；随动配件仍由原安装管理器在确认后刷新，快速对齐预览并未显示所有随动件。
- 审阅位于现有右侧轨道，不加画布浮卡；进入先清其他选择/测量工具，Gizmo/端点编辑/背景快捷键隔离，视角可旋转。退出后 canvas 重新挂载必须重建目录预览，不只依赖规格变化 watch。Esc 即使焦点在字段也能取消。Schema62/111模块0.75.18，验证见VALIDATION。
- 仍需补：自动找框口、完整组件镜像/阵列图复制、框架/抽屉向导与参数直改、三通/斜接/曲杆等复杂组件安装，以及更精确配件碰撞和制造映射。不要将本次三个改进记成全部基础搭建与参考完全一致。

## v0.75.17 当前重点

- 用户指出多出的添加流程、接头应黄色，并进一步明确画笔为瞄准器、首击前型材不应很长。实际观察公开参考首击出现空的聚焦长度输入，第二击完成并显示所选构件属性；v0.75.14“固定长连续放置”的结论不充分，由本轮新参考记录纠正，旧原始记录不覆盖。
- quickAddProfile和拖到画布统一拿起FREE画笔，不创建默认500mm长料。首击前40–120mm截面相关短段；32px橙色瞄准光标随真实指针，不随缩放变大、不参与拾取。第一击只存临时起点，第二击/输入确认才插入一根并一次历史，默认停止无下一根Ghost。Tab和一次Esc/右键保留。
- 普通目录移除默认长度，展开设置的指定长度/弯杆能力保留。ProfilePlacementManager仍是内部兼容API，不再作为普通预览点击的独立工作流。长度框是紧凑输入，不恢复遮挡画布的大提示卡。
- 显式FREE遇干涉允许确认红色位置，不调用自动连接冒充成功，原制造门禁不变。实际局部接头黄带使用原真实面裁剪；gap>0.1mm不显示已贴合黄色，候选绿、干涉红优先和齐平紫保留，不能根据黄色宣称真实五金完成。
- 未确认起点/短预览/输入不写本地草稿；已提交绘制仍走Editor通知、原v16自动保存/恢复链。Schema62/110模块身份0.75.17，完整测试与浏览器证据见VALIDATION。原用户JSON不改，不重启已有8083，不提交/推送；全流程一比一仍未完成。

## v0.75.16 当前重点

- 最新用户工程三根2040/500mm：P-001底面原为-10mm；P-002与P-003包络间隙2.539908mm，与P-001为3.384851mm。隔离读取复现Y拖动到19.31后旧Snap回Y10；不是保存精度或相机改变实际坐标。不得直接抬升导入件或把已有间隙当已贴合。
- Snap按补偿距离排序，同分才用原特征优先级。面候选投影整个源截面到目标坐标，最大接触足迹拟合及3mm邻边齐平；不把中心点落在端边界算完整支撑。此为直型材设计包络/规范面规则，不是复杂件实体布尔认证。
- 删除平移时90°欧拉取整；法向相对阈值0.999999。预览/松手共享候选范围、稳定特征键、2mm切换滞回；当前干涉位置继续保留红色。提交及约束后isSnapSatisfied核对接头，错误提示清除，自动连接仍复用Manager。
- 预览显示将补偿的XYZ和明确目标；真实贴合以后零间隙。SceneManager与FeatureHover点均5px Points，移除世界尺寸球/圆环，选择清旧提示；孔槽和真实绿/蓝/紫面不变。端部13px拉伸箭头不变。
- LocalProjectDraft仅保存标准Project，使用已有alu-cad-autosave和独立时间键。onProjectChanged提交立即capture/flush；启动目录注册后read并走Editor.loadProject，恢复过程门闩关闭保存。初次空白不覆盖旧草稿，显式打开/新建/示例保存空工程或新工程。
- pagehide/beforeunload/隐藏页面只flush最后已提交快照，不export当前拖动Mesh。撤销/重做触发正常Project通知并同步草稿；Ghost、选择、悬停无业务快照。存储失败保留上一条，损坏/Schema失配草稿保留原文、提示导出，明确确认覆盖/清除才放开。
- localStorage为同一origin一份最近草稿，不跨端口/浏览器/电脑；清浏览器数据会丢，JSON仍是独立备份。清除有确认，取消不清，清除不删除画布，下一次编辑会重建草稿。无第三方账号/专有源码/用户文件写入。
- 版本0.75.16/Schema62/110个本地模块；验证和原文件哈希见VALIDATION。完整Lewan流程差距仍见ROADMAP，不宣称本轮实现所有功能。

## v0.75.15 继续对齐与明确剩余差距

- 中心对齐已补平行方向检查，非平行选择不写坐标/历史。参考中心轴是复选项而非本项目当前三个立即执行按钮，确切锚点/组合操作尚未取得完整证据，仍不算全对齐完成。
- 用户仍要求全功能/内容/样式/操作一比一，不把本轮若干修正当作整个目标完成；基线是 Lewan 公开 v2.0.0。观察记录见 reference/lewan-shaft-smart-review-2026-10-07-v07515.md。
- S 现在是双向生成模态：SHAFT→9类夹具，百分比位置及多孔选择；夹具→SHAFT，选孔、长度、起点偏移。不要恢复此前只打开 SK 安装目录的过渡实现。孔位来自 ComponentCatalog.shaftFixturePorts，预览/构件真实孔一致，正反向旋转均扣除对应孔心偏移。
- 正向安装 reference.holeId 保存/刷新/检查异径一致；旧无holeId工程仍取原主孔。反向为普通可编辑光轴，可独立编辑或编组，不加未观察到的约束链。Editor两个提交命令各一次历史，取消不创建，锁定/尺寸/孔径守卫保留。S对自由和已安装夹具都可用。
- L夹Φ8公开属性17.6×32×32：宽度2.2d，其他尺寸/孔源不改。设计参考模型不是第三方专有网格或制造精度认证。
- 左轨分组按公开布局，四种快捷面板分离；底栏补镜像方向、隐藏/显示、标尺与复位，常用图标紧凑有tip/aria。全清除设计连接先确认，再走ConnectionManager派生清理，手工加工/主体保留且可撤销。纯自动清除原方法继续可用。
- 顶部hover与click共用details，鼠标菜单项click后才关闭，键盘/触屏保留原生行为。创建型材按目录展示规格尺寸；只有真实多型号组展示二级型号框，不合并工程身份或制造绑定。
- 尚未完成：参考快速对齐90度连接/确切基准及复合勾选，整体拉伸的复杂/参数框架，智能板材自动框口识别（现需人工四选），框架/抽屉向导与PRO连接策略，镜像/阵列内部图复制，全部目录几何/材质/画布/菜单内容逐项一致。底栏停靠、上前默认、四象限配色仍与公开默认不同；必须如实报告，不用测试通过冒充对照验收。
- 已保留先前向用户请求受限流程录屏的问询，不再要求重复确认快捷键，不索取密码或复用嘉立创凭据。只更新现有8083静态资源；没有重启服务、改用户JSON、提交或推送。

## v0.75.14 第一阶段与后续任务

- 最新用户目标是所有搭建/编辑功能、内容、样式和操作体验按 Lewan 对齐，快捷键也全部跟随参考。这不是“补几个按钮即可完成”的任务；目前第一阶段落地，整个目标仍未完成。
- ProfilePlacementManager 共用真实截面工厂，以临时 Ghost 预放置。普通点击预览不再进入 FREE；Tab轮换方向、重复点击落位、Esc/右键退出，正式提交走 placeProfileWithSnap。FREE保留菜单/绘制按钮，不占E。
- SelectionGestureManager 捕获已选构件直接拖动和Ctrl/Alt复制，4px阈值后才创建副本。原mouseDown/objectChange/mouseUp事务继续约束、吸附、连接随动、干涉红色及历史。取消恢复完整工程快照，点击仍回原选择/Alt穿透链，不把Alt单击当作复制。
- copySelectedForDrag重映射完整组件及内部连接/约束/宿主引用；部分组件副本独立，不继续挂原assemblyId。连接生成件由ConnectionManager派生重建；取消时副本和关系均恢复。普通复制已共用图复制，阵列/镜像仍待统一；完整轮廓的复制与平移同步参数点，未完整复制的外部框口参数关系解除。
- QuickAlignmentManager/深色面板：末选构件为基准，中心对齐、平行型材端面对齐、统一长度、均分和黄金比例排列。约束/安装/加工守卫不能绕过；垂直连接及参考端点选择/排列规则未完整核对，不宣称全菜单完全一致。
- WholeStretchManager独立TransformControls只变形选取区域，Enter转为移动阶段；区域内一端移动改变长度、两端移动平移整根。真实Part长度/姿态重建，不scale型材截面。已加工/有效约束/参数化装配/弯杆明确拒绝，目前直杆主链可用，扩展仍待做。
- S目前按所选光轴孔径定位现有夹具安装入口，不等同于参考智能生成器；B目前打开现有快捷搭建，不等同于其登录后的框架向导。登录/PRO后的框架、抽屉、智能板材、自动连接、云端/MayCAD流程需继续观察和独立实现，不能推测成完成。
- 新快捷键1~6顺序经参考视图菜单实际勾选确认；新增SHIFT+B整体拉伸。原箭头/Tab精确移动可继续作为不冲突补充。页面文字与提示同步，旧E自由绘制及X方向切换文档属于历史。
- 同步0.75.14模块importmap全部109项、Schema62。未改用户原JSON、未重启已有8083服务。实际检查结果见VALIDATION。

## v0.75.13 当前重点

- ConnectionPlacementManager 在鼠标42px接头邻域寻找规范端点/侧槽，保留56px候选锁定距离；空隙无射线命中也可识别。候选必须满足原连接推荐、系列、源端与目标面相对、实际间隙及宿主OBB非干涉。只有合法候选参与Tab切换；确认重新判定，不以绿色外观冒充成功。
- ComponentCatalog.connectionDesignType 集中路由支持的角槽、90度直角、角码、重型角码、内置与四种连接板；不支持的15系列、45度或复杂几何仍是显式自由放置。安装空间与第三方件的包围盒重叠会拒绝，属于保守空间检查，不是精确孔槽布尔碰撞。
- ConnectionManager.resolveDesignComponentTransform 共用于Ghost/正式设计连接件；角码底腿法向与源材料面、立腿法向与目标面一致，根部位于源外表面加安装厚度，而不是中心线。同源端同接头复用关系，不覆盖已有制造方案或其他目标占用。
- beginExisting 只预览，取消不动自由件；确认成功才通过Editor移除原自由件并以designComponent存储在连接关系，一次历史/撤销。锁定、约束、尺寸引用守卫防止悬空事实。该转换不等于制造五金/BOM已配置。
- AxisClearanceManager 新增底栏±mm输入和键盘路由：方向键依相机投影选择操作轴；Shift十倍步长，PageUp/Down剩余轴。Tab从移动画布聚焦输入，输入内Tab循环轴、Enter确认、Esc取消拖动；拖动数字是起点以来总距离。刷新距离栏保持输入焦点/草稿，不新增工程字段。
- Editor.moveSelectionByDistance 复用原mouseDown/objectChange/mouseUp事务，拖动中复用已有快照；cancelPrecisionMove恢复完整快照及随动/提示，无历史。约束拒绝仍取消，实体干涉仍保留位置并红色。绘制/放置/模态/表单/可编辑文本不抢方向键；连接安装Tab优先。
- 162项语法、56项verify、JDK21/Maven clean test和真实Chrome通过；保存重开设计连接仍DESIGN_VALID，安装变换无可观测变化。版本0.75.13、Schema62，用户原工程不改、不重启已有8083进程。详见VALIDATION。

## v0.75.12 当前重点

- 用户指出端部两颗球太大。ProfileGripEditor 的 Sphere/Ring/Sprite 改为两段轻量箭头，按当前相机 worldPerPixel 换算约13px。默认两端隐藏，屏幕端点18px邻域独立拾取，悬停只显示当前端，拖动只显示活动端；远离/放置工具/非单选隐藏。长短、缩放或尺寸不写回工程。
- Editor 普通 hover 先让端部拉伸区域使用小箭头，清除 FeatureHover 的另一层球/标签，不让放大后的普通预高亮重新遮住端部；实际放置工具仍优先于端部编辑。
- 右侧属性顶部 profile-length-editor 是直型材唯一长度输入。profileLengthForm 为 UI 草稿，固定 START 表示保持 A、移动 B；固定 END 反之。确认经 Editor.setSelectedProfileLengthFromEnd → ProfileGrip 原事务；受保护移动端的选项禁用，多选/锁定在 UI 及 Editor 入口双重守卫。输入无效恢复真实数值，重复 Enter/change 不重复提交。
- 双击端部 onEditRequested 切换修改/属性页、设置正确固定端、focus/select 输入；不再 window.prompt。实际拖动确认后同步固定端和数值；原数值键入、Feature/Grid、加工基准、连接随动、Esc 取消继续复用旧链。
- 真实 Chrome 在用户第二份工程隔离副本验证 P-003：470→570 固定 A 不动，570→670 固定 B 不动；每次 history+1。端部双击历史不变且聚焦输入；拖 B +70 得到540、history+1，Esc 取消后仍540。P-002 已连接 A 端，对应移动 A 选项被禁用。原 JSON 不改。
- Schema62/业务版本字段不变；所有本地缓存映射0.75.12。验证结果见 VALIDATION，当前8083由用户进程提供，只同步静态资源、不重启进程。

## v0.75.11 当前重点

- 用户先提出不低于地面，随后明确修订为“也可以低于平面，只是在进出平面的时候有明显的变化”。最终实现允许负 Y 底面，GroundClearance 使用直型材业务包络和当前矩阵计算最低真实表面；非直型材回退到自身几何，辅助标签排除。没有导入抬高、地面碰撞阻止或额外业务字段。
- AxisClearanceManager 放在现有 workbench-tools-row，保持 48 px 单行底栏，不覆盖画布。单击移动箭头出现轴方向、正反目标及表面毫米间距，最多显示每侧最近八个方向目标；完整旋转 OBB swept SAT 排除不在移动走廊/身后的目标。底面到地面蓝色，低于地面橙色；0.5 mm 跨平面去抖，竖直分量方向可显式落地。
- 单击箭头无移动时不执行吸附和历史；SceneManager 消费真实 Gizmo pointerup，不再走构件重复选择。程序贴合复用 Editor.moveSelectionToSurface 事务，指定目标 snapToTarget 在 0.1 mm 内确认端面，不自动切换到另一个目标或槽中心。
- 用户明确取消碰撞弹回：最终位置保留，InterferenceFeedbackManager 红色原实体三角面及红框持续；一次撤销恢复。当前位置干涉时跳过自动吸附，求解后再查干涉，红色不能生成绿色候选/自动连接。约束不允许的程序贴合仍可取消，正式 FactoryValidator 碰撞门禁不变。
- 用户第二份工程的原坐标保持：P-002→P-001 DESIGN_VALID、接触间隙 0；立柱最低 -5 mm。一键补连接实测补出 P-001→P-003，不移动三根型材；目标指定 P-003 的 60 mm 沿 Z 贴合可生成 P-002→P-003。设计连接不等于已配置制造五金，不静默改已占用端部的连接。
- 已有 8083 IDE 服务读取 target/classes 静态资源；同步 process-resources，不重启用户进程。完整语法、回归、JDK21/Maven 和 Chrome 证据见 VALIDATION。v0.75.10 以下回滚记录是历史，不是当前交互约定。

## v0.75.10 当前重点

- 用户要求接触绿色与上表面齐平颜色分开，并指出“即将吸附”与“已阻止干涉”同时显示。新增 CoplanarSurfaceFeedback，复用 ProfileFeatureCatalog 规范平面和 SurfaceFeedback 实体三角面，双方角点偏差 <=0.1 mm 才显示紫色；长杆微倾斜、不同截面厚度、竖杆不以中心线误报。
- 紫色表达当前实际表面齐平，不承诺槽中心吸附后仍然齐平。SceneManager 比较候选平移后的只读平面，可能产生高差时同时说明“吸附后上表面未齐平”。未知/圆弧实体面不填板冒充平面。展示不修改 Part、约束、连接或历史。
- SnapManager.sortedCandidates 对每个几何候选调用原 InterferenceFeedbackManager.classify，虚拟平移整个当前移动范围，对全部可见实体检查；沿用现有安装接触豁免和容差。applyCandidate 再检查新障碍，错误方向端面排除。不用提高容差解决穿透。
- Editor 回退同时清 lastSnap 与 onSnapChanged(null)，app 阻止落位回调同步清 UI；合法连接推荐 error=null。浏览器已通过合法提交、Ctrl 绕过吸附造成穿透回退、第三块板候选冲突、连接鼠标预览/取消/单击提交检查。
- Lewan 当前公开页自动生成连接为 PRO，手动连接可进入选型和预放置并拒绝无宿主；未核实其内部干涉算法。alu-studio 明确无几何吸附/碰撞，实际拖拽事务可作为设计对照；ALPDesigner 当前源码目录只有 README，相关连接检测为规格文档。两仓库未发现明确许可证，不复制源码，不改变 Vue/local JS 技术栈。
- 本轮原 8083 服务检查时未监听，使用已有任务验证服务 8081；不重启用户 IDE。运行和参考证据见 VALIDATION 与 reference/lewan-opensource-interaction-2026-10-06-v07510.md。

## v0.75.9 当前重点

- 用户要求候选吸附面整体绿色、落位蓝色接触带和金属选中效果，以及修改页加工/连接白底和下拉样式修复。新增 SurfaceFeedback 从实体三角面生成独立展示 Mesh，不用平面板填孔，不改 Part/Connection/History。
- Snap.preview 与绘制候选共用真实外表面覆盖；InterferenceFeedbackManager 保留已有 SAT/OBB 分类和红色优先，对直型材真实 CONTACT 做另一构件 OBB 局部裁剪，live 绿色、结束蓝色。视觉 margin 不修改接触容差，不代表制造连接已经完成；近似 AABB 接触不渲染精确蓝面。
- 选择覆盖橙金色，不覆盖原金属材质；surfaceGeometryKey 在截面/长度/子网格重建后重建覆盖。提示 raycast 禁用，嵌套释放正确 removeFromParent，不参与业务根网格拾取。端面孔和槽保持开放。
- 通用五金使用 Standard 金属反射，右库仍经预览层中性照明；脚杯 Phong/橡胶特殊材质保留。旧 ANGLE_BRACKET 方块示意增加通孔和侧肋，原 X/Y 安装角点和范围不变，孔径为视觉比例，不能当制造孔径。
- 连接 quick-change 取消白底；加工卡、下拉 hover/focus/disabled/option、徽章统一深色。加工动作换行，窄连接卡单列；现有领域切换逻辑不变。浏览器检查和全量回归见 VALIDATION。

## v0.75.8 当前重点

- 用户看不懂“世界原点平面”：镜像显示“对称位置”，两选项改为“以画布原点为基准 / 以所选构件中心为基准”，方向标签同步。原点提示指红绿坐标轴交点，选择中心指整体范围，不是鼠标或屏幕中心。圆周阵列描述改为“围绕下方选定的中心”，避免默认原点却声称选择中心。
- 轴方向 Toast/tip、快捷旋转 aria、网格与轮子安装说明去掉相关专业词，内部数据、方向、旋转中心与业务逻辑不变。
- 用户询问批量为何不可点：独立 Chrome 确认入口未禁用，三个执行按钮由 !selectionCount 禁用。面板增加动态选择数量/无选择原因与 Shift 多选说明，提示只占左面板，不覆盖画布；保留选中才能执行的规则。
- 新增 verify-player-terminology-v0758 检查文案和原参数/禁用守卫保留，版本映射同步全部本地模块。不得为了使灰按钮可点击而无选择复制整个工程。

## v0.75.7 当前重点

- 用户指出点击后模型孔为黑色而参考亮色。定位到 ComponentGeometryFactory 的两条路径：plate 对已经含孔壁的挤出额外覆盖黑色 MeshBasic 圆筒；boredBlock 正交通孔另用纯黑 MeshBasic。前者删除冗余覆盖，后者复用实体受光材质。内壁不封盖、不改尺寸，相交孔裁剪与安装坐标保持。
- 孔口能透出背景，不能保证在所有方向/背景下都是白色；参照页实际出料口仍有黑孔口。用户当前截图只有类别页签，尚缺其所指白孔的完整状态截图，不能宣称全部模型 1:1 或所有选中状态一致。
- 灯光由预览/场景负责；通孔不能强制染黑，也不能用白圆片替代。黑色螺钉盲槽底与黑色配件保留，合法/不合法 Ghost 仍按绿/红状态，领域模型不改。
- verify-bore-material-v0757 检查 95 组夹具主孔、134 组连接规格、2 种金属端盖与 3 组弹性螺母，有限坐标/受光材质/孔贯通/不重复圆筒/保留盲槽。既有 461 组预览与提交一致检查保留。版本 importmap 全量同步。

## v0.75.6 当前重点

- 用户标记位置为画布中央略上方。SceneManager.applyViewportAnchor 用 setViewOffset(width,height,0,height*.03,width,height) 同时设置透视/正交投影，原点/观察目标仍是 (0,0,0)，投影位置为 (50%,47%)；init 和 resize 都调用。不得通过移动构件或伪造红绿轴坐标满足截图。
- index importmap 对 js 下全部 101 个文件做规范 URL→当前版本 query 映射。相对 import 的解析仍由浏览器完成，所有引用归于同一版本模块实例；bare three/vendor 映射保持。build-module-importmap 只输出 apply_patch，不写文件；verify-static-delivery 检查新增文件/当前版本覆盖，版本交付必须更新整张映射。
- StaticVendorResourceConfig 为 /js/**、/css/** 设置 CacheControl.noCache。此 Java 配置需后端重启才在已有服务生效；静态 importmap 本身无需 Java 重启即可解决旧内部模块缓存。不能将普通 HTTP 接口检查误写成用户当前 Chrome 的相机状态。
- 临时只读 HTTP 镜像以 max-age=3600 缓存旧未版本化 SceneManager，实测旧 target=(0,500,0) / 交点 65.309%；更新 HTML 后普通 reload 请求 100 个当前版本 JS，target=(0,0,0) / 交点 47%。镜像和独立浏览器均需关闭。
- CatalogPresentation 滑轨 direction=(5,4,8)、margin=2.2，面向 +X 翻边开放侧。ComponentGeometryFactory 脚杯 MeshPhong / 金属 shininess=40，橡胶克隆材质 shininess=8，不改几何参数；黑色件仅加亮预览 CAD 边线。端盖 footer 显示实际适配尺寸，不强行显示泛用方形图。
- verify-accessory-preview 执行真实 addHardware 构件组装并哈希实际 Three.js 网格/材质，覆盖 461 组脚杯、全部紧固件长度、16 参考截面三种端盖和滑轨。与参考站外观更接近，不宣称其专有模型或制造精度被完全复制。

## v0.75.5 当前重点

- ViewCube 导航相机改为 38° 轻透视，仍沿主相机 target→position 方向观察。Lambert + 半球/定向光提供面明暗；EdgesGeometry 外轮廓不进入 targets，标签色加深，CSS drop-shadow 不改变命中范围或卡片尺寸。
- 26 个真实区域、悬停橙色、释放复位、拖动方向、点击切换和资源释放保持；导航独立光照/线框属于展示层，不写入 Project。
- SceneManager 初始化 OrbitControls.target/resetInitialView 改为原点 (0,0,0)。启动/空白新建原点投影为中心，仍是 (0,1,1) 上前方向/3000 距离；Editor.getCenterAndSize 的无模型分支同样改为原点，避免切换视角/小房子/适配后再次偏下。已有模型分支不变，不得将有模型工程强制移到原点或替换模型适配。
- 新增 verify-view-cube-depth-v0755，使用实际 Three.js 构造/投影/拾取，只替代无 GPU 渲染器；26 个区域逐个点击/恢复检查，四个画布比例验证原点中心。完整语法、回归、Maven 与浏览器记录见 VALIDATION。

## v0.75.4 当前重点

- Footer 增加 workbench-footer-scroll 和固定的 workbench-footer-status，前者 flex:1/min-width:0/overflow-x:auto，后者 flex:0 0 auto；提示入口和单位不与操作按钮共用滚动/压缩空间，底栏仍实际占位 48 px。
- 长 status-label/status-hint 不再进入 DOM，footerContextTip 读取当前选择、FREE 起点/终点、轴锁定及快捷键。可见提示入口只显示 ⓘ 或“起点/终点”，正式操作保留原 Editor/Manager API。
- Footer 控件 title 改 data-tip，避免原生和自定义重复提示。事件委托处理 pointerover/out、focusin/out；Teleport 提示到 body，用 nextTick 后实测尺寸计算固定坐标，sequence 防止旧异步覆盖。鼠标在按钮内部图标间移动不能闪退。
- 滚动/resize/菜单打开/操作点击清理 tip；handleKeyboard 在字段/Grip 提前返回前清理 Esc，卸载取消等待中的提示。更多菜单仍通过既有 fixed 定位，不被滚动容器裁掉。
- 146 个 JS/MJS、45 个 verify 和 JDK 21 Maven 检查见 VALIDATION；8081 为验证页，未中断用户 8080 IDE 实例。上一轮封边几何和红绿轴保持，本轮不修改 3060 型号或通用封边入口。

## v0.75.3 当前重点

- DesignProfileCatalog.sectionSlotDefinitions 保留内置封闭面的原几何槽；安装 slotDefinitions 仍仅包含开放面，数据库不凭尺寸猜测无槽面的孔。DesignProfileSection.closedSlotHoles 将 lip 以下的槽腔从外轮廓凹口转换为内部闭合孔，侧壁保持连续，端面和 A/B 贯通腔均保留。
- Registry 的标准/R 截面直接使用生成孔；具体型号将 closedSlotHoles 与不相交的参考孔合并。精确数据库/DXF 在此前已返回，不修改或加孔。R 参考中心孔调整至 (0,0)，避免旧孔与槽轮廓相交；这不是供应商精确截面。
- InfiniteGround 的 X 轴为 Z=0 红线，Z 轴为 X=0 绿线，两条完整轴划分四象限。独立 axisCoverage/axisFade 不依赖网格细分级别，保留原象限网格色、抗锯齿、无限延伸及网格开关。
- 底栏仍与 canvas-stage 同级且真实占位，固定 48 px 单行 flex。窄屏 overflow-x:auto，不再换行；非绘制快捷键提示收起，绘制提示/结束保持可达。更多菜单改 fixed 并使用 requestAnimationFrame 在聚焦滚动后定位，横向滚动调用 repositionFooterMenus，不得关闭刚打开的菜单。
- 145 个 JS/MJS、44 个 verify 与 JDK 21 Maven 检查及浏览器证据见 VALIDATION；验证运行页 8081 为 v0.75.3。8080 是用户 IDE 启动的旧实例，本轮未停止或重启它。

## v0.75.2 当前重点

- canvas-shell 仅作中央列纵向 flex 容器；canvas-stage 为 flex:1/min-height:0 的独立画布区域，包含 viewport 与就地 HUD。workbench-footer 是其同级、flex:0 0 auto 的真实底部占位，不用绝对定位留在 canvas-stage 内。
- canvas-transform-bar、quick-rotate-bar、canvas-bottom-bar 进入底栏；作用域 CSS 覆盖历史定位/透明背景/transform，允许窄屏换行。更多菜单向上展开，可临时覆盖画布，但常驻底栏不覆盖。
- app 生命周期创建 viewportResizeObserver 观察真实 viewport：底栏高度因绘制、选择旋转和窄屏换行变化时自动调用 SceneManager.resize，卸载时 disconnect；不能仅监听 window.resize。
- WorkbenchLayoutManager.canvas 改为 canvas-stage；不再 bindFloater(toolbar)，删除读入状态中的旧 toolbar 项，但保留其他面板/导航布局。主工具条移除拖动手柄，不允许旧浮动坐标将它拉回画布。
- @dragover/@drop 从 main 限制到 canvas-stage，底栏不是组件落位目标；原 Editor/Manager 提交、快捷键、撤销、坐标和 Schema 不改变。
- 版本/缓存 0.75.2、Schema 62、运行页 8081。完整检查记录见 VALIDATION；仅 UI 布局调整，无制造或目录规则变更。

## v0.75.1 当前重点

- SceneManager.resetInitialView 使用方向 (0,1,1)、观察中心 (0,500,0)、距离 3000；启动和新建空白走此入口。小房子/Editor.viewIso 和适配仍沿用三维方向；不得再把初始化改为上/前/右。
- draw-hud 只剩主工具条中的静态行，不再是独立浮层；确认/取消当前段按 start 显示，连续添加继续经过 configure。状态栏承担操作提示，Esc / 右键和主工具条结束按钮保留。CSS 静态覆盖必须同时压过原移动端定位规则。
- ProfileCatalog.defaultFaceClosures 采用逐型号、逐系列核实的数据并过滤槽位；DesignProfileCatalog 投影 shape/slotDefinitions/defaultFaceClosures，只包含设计几何。2020A/B、3030A/B/H/T、3060A/B、4040F/H/T 已核对官方目录。3060 横向源图需旋转到 30×60 局部截面，详见 reference 新记录。
- ProfileSectionRegistry 所有内置外轮廓由 buildDesignProfileSection 统一生成，圆角和封面不能丢失。fitReferenceHoles 仅约束内置参考孔防止与 T 槽相交；数据库、自定义 DXF section 在此前已经返回，不改用户精确截面。30/40 已核实部分内腔仍为独立简化图形，不标成生产精度。
- CatalogPresentation 使用预览 part 的 faceClosures 选择可见封闭侧，不改工程旋转。右侧预览下方显示封闭面，sectionRevision 触发目录注册后的刷新。
- ProfileSelector.change 带 previousId；属性和 ProfileReplacementManager 移除旧型号默认封面后再加入新默认，保留额外手工封边。数据库删除使用检查同时覆盖 designProfile / manufacturingProfile，避免删掉已使用的设计定义。
- 版本/缓存 0.75.1、Schema 62、运行页 8081。检查记录见 VALIDATION；无限地面、四象限线色、单象限移动和两级选材继续保留。

## v0.75.0 当前重点

- ProfileSelector 共用外尺寸分组与二级型号；一级 value 使用默认设计截面 ID，v-model 始终是具体型号 ID。切换尺寸重置二级为该组默认项，不能把二级选中的 A/B/R 写回默认 3030。
- DesignProfileList 的 23 个标准截面保持不变；getDesignProfileChoices 叠加已有目录的几何投影，按尺寸归为 20 组。具体型号不包含合金、壁厚或供应商字段，manufacturingProfile 新建仍为 null。内置同名标准项避免重复，数据库启用项保留；停用项在已使用构件中继续可解析。
- CATALOG_REFERENCE 几何投影复用原 ProfileCatalog 型号参考截面；Registry 的自定义 DXF/数据库精确 section 仍优先。具体型号的参考轮廓封边跟随 faceClosures；显式无槽目录不能通过 ProfileFeatureCatalog 的标准回退凭空生成槽特征。内置参考图形不等于供应商制造精度。
- 右侧创建/修改/替换和左侧框架/模板/门框统一两级选择。连接、光轴、板材、配件沿用既有类型/规格级联；不得为了本次归组擅自新增目录项。3030N1 没有可用定义。
- 画布方向=world，构件方向=local，存储键不改；只解释轴向而不改变旋转中心或变换作用域。旋转条切换复用 toggleTransformSpace，X 快捷键保留。
- SceneManager.init 直接调用 setView('iso',target,2500,{immediate:true})；不再在最后覆盖为水平正面。新建工程和小房子仍走 Editor.viewIso，归一化方向 (0.6164,0.4900,0.6164)，对应上/前/右三面。
- 版本/缓存 0.75.0、Schema 62、运行页 8081。交付检查见 VALIDATION；上一版手柄、材料和无限网格保持。

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

- 应用版本：**v0.75.18**
- Project Schema：**62**
- Schema 策略：**current-only；不维护历史兼容**
- JDK：21
- Spring Boot：4.1.1
- 数据库：SQLite
- 持久层：MyBatis + XML
- 前端：Vue 3 Global Build + Three.js + ES Modules
- 当前主题：**稳定绘制 / 可预览基础对齐 / 批量目录设计连接件**

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
