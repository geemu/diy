# 项目交接文档 — v0.75.92

## v0.75.92 共用板材框口分格/轮廓避让，多层多排抽屉

- 水平层入口优先上方；顶部没有上梁时尝试最近下方真实框口，两侧都没有则拒绝。不会因只选顶框而造框外空间，实际选择的相邻区间在Ghost中确认，尚未运行验收。

- divideFrame且非T_SLOT时，在原多面展平入口按真实四边稳定ID/净区间去重，避免不同厚度梁的框面中点差制造重复空间及虚高数量；原T槽板位键/合法平行不同槽保持。只做源码阅读，不是实际当前工程数量验收。

- 用户要求抽屉选择和适配与板材一致，并确认多排缺中间导轨支撑自动加固定隔板，原型材不动；不直接操作旧JSON/浏览器存储或已有架子/抽屉。本轮源码实施，无新运行或截图案例数量证据，不能沿用v90填板20块或v91原点诊断当本版生成证明。
- FrameOpeningResolver新增显式divideFrame与normalAxis消费者选项，复用原真实四边/同面分隔梁/共柱闭合/长边局部区间。活动抽屉不要求T槽，板材不带新选项的原T_SLOT/INSET和门框规则不变。新DrawerSelectionPlanner接受4～64根，可外框/含中梁/多层/全选；水平层外框用实际立柱和最近上下梁进入相邻框口，不推测不存在的顶层空间。
- 统一Z/X正负朝外选项，同投影只留外侧目标防前后装入重复空间；当前层数×排数应用到每个识别格，不是逐格不同层/排编辑器。默认AUTO/3层1排，逐格净宽高深分别适配；MANUAL尺寸对每格应用原输入，层/排和目录轨长不偷偷修改。真实包住本格的后框/保守材料面深度，最多512后框组合、2048源框候选及合计64抽屉，未知或缺失不原点兜底。
- DrawerGroupModel支持上下/左右缝隙、隔板厚度与逐排轨占宽，外盖仅整组两外边各10mm。固定隔板和活动抽屉分别建组件，AssemblyManager.create普通仍2件，仅内部allowSingle支持单块隔板组件；kind= DRAWER/DRAWER_SUPPORT/DRAWER_GROUP均沿原字段。既有完整覆盖/同位同厚的非活动PANEL可复用，原尺寸/归属不改、不重复计BOM，不认证该旧板已具备实际固定螺钉。
- 新DrawerPanelAdaptation与填板共用真实连接件轮廓裁边和材料轮廓，仍不裁内部梁/中央障碍或将裁口方框化。前板/箱板/新隔板可有edgeNotches；中央40mm接合设计带和实际轨体接触区域须完整，不满足保留红色原因。没有全行程扫掠、木板接合强度或供应商装配认证，不能据此称可实际抽拉。
- DrawerPlacementManager逐格预览/尺寸/新旧支撑/裁角数与突出，临时Ghost与行号不保存。fresh重新分格/定位/裁角/复用身份后commitDrawerPlans统一事务，原预检查加正式网格复验、一次历史/完整回滚/编号保护；InterferenceFeedbackManager插入复验仅去掉同稳定ID自检，所有不同实体/同组件/宿主仍查。Esc/右键/参数失效/关闭/换工具/选择与工程变化/卸载和BuilderReview隔离保持。
- v0.75.92 / Schema62 / 145模块，新增DrawerSelectionPlanner、DrawerPanelAdaptation并完整importmap映射，无新依赖/根字段。63份身份文件含59份verifier仅版本同步，无新增/运行测试或断言修改。原默认3根、连接静默/v90填板/清单/Factory保持，既有dirty和用户资料保留，未提交/推送。按约定仅人工源码/差异与资源交付，未运行生成算法/语法检查/Java编译/启动/HTTP/浏览器/实际生成/保存/运动验收，见VALIDATION/ROADMAP及reference/shared-panel-drawer-fit-2026-10-15-v07592.md。

## v0.75.91 抽屉选框口、定位预览、一次确认

- 当前用户工程鱼缸架示例 (1).json只读512115字节、2026-10-14 23:16:56保存、v90/Schema62、29根PROFILE/108关系/0板材。此前1000宽/610深/400高/1个/缝0/内置/400轨通过布局，但addDrawerGroup未读选择、默认世界原点；原材料诊断首先面板与P007冲突，箱体z到-601、架后外边-305。该证据是修改前只读诊断，不是v91运行验收；原文件/浏览器存储不修改。
- 新DrawerOpeningPlacement使用原FrameOpeningResolver.resolvePanel(INSET,resolveSlots:false)/describePanelMember，严格选本层正面左右柱+上下梁4根，允许长柱跨层但不跨中间横梁选整架；必须有匹配投影边界的闭合后框，有限256组合/缺失或歧义拒绝。原框口板/T槽/门解析不改，未支持任意斜框、错台后框或只选四根水平层梁。
- 正/负朝外方向按实际Z或X，面板底部=下梁顶+间隙，INSET正面在前框外面以内，OVERLAY背面在前框外；箱体朝内、深度保守取后框内侧包络。DrawerGroupModel新rotationY仅整90°整组旋转，原左右轨朝内/占宽、面板及箱体板厚和精确导轨长度守卫保持。
- 新DrawerPlacementManager拥有Ghost/源四边/signature/pending，仅页面内存。左侧两按钮分别显式填净空间宽高深并预览、保留输入直接预览；数量/导轨/面板和手改不暗改。净空间参考未保证避开五金，预览原InterferenceFeedbackManager查整组内部+旧件+目录连接；超空间/真冲突显示红色禁确认，确认fresh核对后仍原Editor预检查/整组一次历史和回滚，无忽略宿主或先装部分。
- 生命周期接Editor.BuilderReview/右键、app选择和工程变化、参数watch失效、Esc/关闭/换工具/卸载；Gizmo暂禁，取消恢复原使能。Ghost不进入Part/interactionMeshes/历史/BOM/自动保存，新方向/目标/报告不写Schema；抽屉没有新增宿主mountReference或自动随框架参数回改能力，原自由定位API保留。
- v0.75.91 / Schema62 / 143模块，新增2本地模块且完整importmap映射，无新依赖/持久字段。63份身份文件含59份verifier只机械版本同步，无测试断言修改或运行。原默认3根、连接静默、v90全选填板/清单/Factory及dirty保持；本轮仅人工源码/差异和资源阶段，未改后算法/语法检查/编译/启动/HTTP/浏览器或实际安装/撤销/保存，待验见ROADMAP/VALIDATION及reference/drawer-opening-placement-2026-10-14-v07591.md。

## v0.75.90 Ctrl+A 全选填板框口修正

- 用户补最新鱼缸架示例.json和12框面/30候选/12未适配截图并确认修正；512115字节/v89/Schema62、29型材/108关系/0板材，已保存5层/每层1承托不改。前轮只读原框口/槽位重算定位12个跨槽面候选、4重复及顶部2格漏识别；左立柱槽x=-515，中间内收侧梁槽x=-485，不能平均成x=-500的板面。
- PanelSlotPlacement在原无fit且无具体插入失败时给原共面错误附PANEL_SLOT_PLANES_MISMATCH。selectedPanelFrames只对该码跳过自动组合；有共同槽面但板厚/槽深/封槽等其他错误仍留原红色预览，显式单面入口原错误保持，不改任何平面/槽宽/槽深容差或裁剪。
- 自动候选四边只预筛真实四角接触或同一立柱，然后仍调用原resolvePanel闭合；移除v89额外panelMemberCovers前置门槛及其无用助手，保留原分格覆盖/插槽有效边规则。恢复顶框柱间侧梁490与宽梁550净口经立柱闭合，不自动伸长/移动型材。
- 分格展平新增panelCellKey：法向、四边ID、实际槽面/槽ID；无槽引用附原法向坐标。重复板位不入计划，保留同杆不同槽面，去重后框面标签连续/空组不计。新码/键均临时，原单板四边/槽引用、Schema62/历史/自动保存/复制/回改保持；原PanelFillManager裁角/材料与同批相交、fresh/整批事务不改。
- 修改后同一JSON只读框口/槽位复算为9框面/20候选、0槽位失败/重复/未纳入，顶部P025/P026/P027/P029及P025/P026/P029/P028两格约499.6×564.6mm；未建实际材料网格/调用裁角/相交/confirm或存储，不是实际20块生成/撤销或浏览器验收。数目只案例输出，不在代码写死。
- v0.75.90 / Schema62 / 141模块，无新模块/依赖/字段，默认每层3根及v87自动连接静默/清单/制造保持。63份身份文件含59份verifier只机械同步，无新测试/断言修改；只本案例只读计算和源码/资源交付，未测试/独立语法检查/编译/启动/HTTP/浏览器或真实生成/保存验收，见VALIDATION/ROADMAP及reference/select-all-panel-faces-2026-10-14-v07590.md。

## v0.75.89 多面选择分别识别框口和板材

- 用户确认截图这类正面/侧面围框同时选择应自动分组；只源码/截图阅读，没有当前保存JSON或浏览器复现，不写死板数。FrameOpeningResolver新入口优先原单面分格，必要时按所选轴向和真实包络/覆盖/四角闭合组合各面的四条边，立柱可重复归属。板材之外的门框、保存单板解析/整架回改仍走原方法。
- 每候选复用resolvePanel(resolveSlots:false)证明真实闭合，开放槽适配平面用于同面子框去重；同面包含子框交原分格器，平行错层保持独立，重复外边歧义拒绝。不补未选的虚拟外边，场景其他型材只按原规则证明角部或作为同面分隔梁，仍限轴对齐/方切/单位缩放。选择64根、总分格64块，闭合候选2048上限。
- PanelDoorConfigurator把各面cells展平成原计划数组，每格继续实际槽/板厚/槽深和连接件轮廓裁角，frameIndex/frameLabel/unusedPartIds只附临时计划，不写draft/panelSpec。PanelFillManager沿原真实同批相交、fresh重算/一次确认/回滚，新增框面计数和逐板方向标签；不适配格仍红色禁整批确认，不能装一部分再报错。
- 左智能填板文案说明多面/共享立柱，右预览显示框面数/板数、所属框面和未纳入选择的数量；开始/参数变化/失败/取消清frameCount与原Ghost。已有工程/板材/型材位置和用户JSON/真实Chrome存储不操作，默认每层3根及v87自动连接静默保持。
- v0.75.89 / Schema62 / 141模块，无新模块/依赖/持久字段，63份身份文件含59份verifier只机械同步，无新测试/断言修改。仅人工源码/差异阅读和资源交付，未测试/语法检查/编译/启动/HTTP/浏览器、截图工程实际板数/生成/保存或实物装配验收；待验见VALIDATION/ROADMAP及reference/multi-plane-panel-selection-2026-10-14-v07589.md。

## v0.75.88 快速搭建每层默认三根承托杆

- 用户取消PVC水管后要求默认三根层托杆；唯一业务修改在DiyTemplateCatalog.js公开GENERIC_FRAME默认createQuickFrameDefaults(5,3)，其余5层/1060×610×1800、走向和各部位选配保持。app初始表单及DiyGenerator缺省参数共用此入口，逐层未覆盖数量沿用3。
- 不重写已保存工程/本地自动保存/常用方案，整架编辑仍读取原assembly.parameters，兼容旧模板调用及显式数量不改；全局和逐层0～4根可选，布局/支撑检查、历史/连接/板材/清单及制造门禁保持。不增加任何水管功能。
- v0.75.88 / Schema62 / 141模块，无新依赖/字段。63份身份文件含59份verifier只机械同步，不新增/运行测试或改断言；仅人工源码/差异阅读及资源交付，未语法检查/编译/启动/HTTP/浏览器或实际新建/保存验收。交付状态与待验见VALIDATION/ROADMAP及reference/three-default-support-beams-2026-10-14-v07588.md。

## v0.75.87 自动生成只反馈新增数量，未适配静默跳过

- 用户最新明确所有不适配情况都跳过安装，不需要告知，覆盖原自动生成三类报告/失败定位的呈现要求。最新鱼缸架示例 (1).json为512423字节/v86/29根/108关系、0保存失效，底部12枚隐藏件均上側，没有朝下件记录；保存状态不是完整实物合法性或浏览器验收。
- 本次只读Node局部诊断使用临时逻辑根/原Manager候选校验，不调用scan/plan/confirm/生成/历史/存储或浏览器：P008→P004与P006→P004下侧各3锚点、P028→P004上侧1锚点。真实槽±15mm为零剩余槽长、超端23.8mm并已正常跳过；默认中心0锚点先报源槽壁相交，v86错误码条件没剔除它，留下红色未生成预览。不是剩余几毫米或实际非法安装。
- app.confirmConnectionBatch不取diagnostics或保存分类报告；已装件保留，原可生成候选走原confirm，结果只有实际新增数/可撤销或本次未新增/已有不变。clearConnectionBatchReport在入口/提交前/完成清rows、打开状态、签名/原因索引和临时定位，原条件渲染报告无入口，旧红色Ghost清理；保留内部诊断/历史模板与手动检查，不做无关删除。
- 不改变目录选型/孔槽/完整脚长/真实槽腔/空间或SINGLE/补件/原件/制造/失效/锁定保护，fresh和一次提交/回滚保持。真正扫描/工程变化/事务错误仍提示，不将不适配件当已装或声明全部成功；制造/干涉/手动连接提示不全局关闭。
- 0.75.87 / Schema62 / 141模块，无新模块/依赖/持久字段；默认/层高/板材/清单/Factory与v85多槽/v86原政策保持。63份身份文件含59份verifier仅同步，无新测试/断言修改；只执行本次局部只读诊断及源码/资源交付，未运行测试/独立语法检查/编译/启动/HTTP/浏览器或修改后生成/存储验收，见VALIDATION/ROADMAP及reference/quiet-connection-generation-2026-10-14-v07587.md。

## v0.75.86 顶 / 底端齐平零槽长正常跳过

- 用户提供底部朝下/顶部朝上的红色内置件候选截图，明确无槽长方向本不需要生成或提醒。本轮直接实现该报告/政策规则，不执行截图工程扫描或修改原用户JSON/真实Chrome；截图无当前保存工程，不能据此写死编号或减少数量。
- AutoPolicy.emptyEndSlotChoice复用checked.transform、原目录槽定义、Section与目标柱局部Z和源面槽向，识别水平梁/竖直柱方切/单位缩放端齐平朝外可用长度为零（0.0001mm原数值边界）。只认现有端部/孔站位/支撑范围失败，未知/封槽/斜切/缩放、真实方向/贴合/穿透优先；有正槽長但不足或安装点已在柱端外不跳过。不改HiddenConnectionPlacement/孔槽/完整脚长/材料/包络合法性。
- 内置件、角码与90度候选附SLOT_END_NO_AVAILABLE_LENGTH/expectedSkip且valid=false；legalChoices在原合法过滤前标政策，原因提取再同源读取并排除。已有一侧且相反侧确认为零槽长时，原因仅审阅实际待补相反侧，避免无关安装面轴向错误被当缺侧；仍保留同方向自己的真实失败。承托面政策继续仅AUTO，零槽长用于批量目录选型，不改变手动安装拒绝。
- isExpectedConnectionSkip共享报告/定位正常政策码；缺侧数量/失败姿态不包含正常候选，提交后实际分类丢弃有效件纯跳过。实际整处未装/已有失效或缺实体继续处理，失效优先；不静默所有端距错误或整个顶/底层，临时政策不持久化。
- 0.75.86 / Schema62 / 141模块，无新模块/依赖/字段；v85逐槽选型/fresh槽对及原事务、默认1060×610×1800/层高/板材/清单/Factory保持。63份身份文件机械85→86同步，59份verifier无新测试/断言修改；人工源码/资源交付，默认未语法检查/测试/编译/启动/HTTP/浏览器或实际用户工程计数/生成/存储验收，见VALIDATION/ROADMAP及reference/zero-end-slot-expected-skip-2026-10-14-v07586.md。

## v0.75.85 同面多槽内置件与已有空槽补充

- 用户确认同一面每组合法梁槽/柱槽各装一枚。最新桌面鱼缸架示例.json只读为v84/29根/104关系：P006→P004接柱宽面有两组槽仅C046，P008→P004接柱窄面仅一组对齐C100，另一梁槽错位30mm。这里只是保存数据/姿态与源码证据，不能将后者强装两枚或声称前者实际空间已经运行通过。
- ConnectionBatchManager.hiddenSlotPair只读原componentPorts.ok及单一匹配sourceSlots/targetSlots，以面+槽ID去重。legalChoices排除已装同槽对；selectHiddenSlots沿原合法/政策排序，在已有或本次选中隐藏件的面挑所有不重叠独立槽，首次生成原相反侧选型后调用，原件补充即使existing≥2也可调用。不新造槽、型号、脚长或安装姿态，不改其他面的数量策略。
- SINGLE、supplement=false、锁定/制造/失效/缺实体与原侧贴/单面外角/侧槽边界保持；指定类型仍原规格候选，不混入AUTO型号。多件保留原row+面+局部锚点ID、排除与预览生命周期，空闲位文案附源/目标槽序号。
- confirm逐件fresh原安装检查，并比较预览槽对/已装及本批槽对占用，再检查原新旧包络；原create/install/编号/历史一次提交和异常整批回滚保持，无新工程/自动保存字段。v84正常留平统计、默认1060×610×1800及层高/板材/清单/Factory不改。
- 0.75.85 / Schema62 / 141模块，无新模块/依赖；63份身份文件含59份verifier仅机械84→85同步，无新测试或断言修改。人工源码与资源交付，默认未语法检查/测试/编译/启动/HTTP/浏览器或实际工程生成/存储验收，见VALIDATION/ROADMAP及reference/hidden-multislot-placement-2026-10-14-v07585.md。

## v0.75.84 正常承托面留平不报缺另一侧

- 用户确认只修异常报告：上侧外置候选按承托面规则主动排除，不是安装失败；保持原候选/槽位/支撑/空间/承托面判据、排序、上槽合法隐藏补件及fresh提交和原件保护，不执行用户工程扫描或直接修改文件/真实Chrome。
- AutoPolicy在原SUPPORT_PLANE_OBSTRUCTED结果附expectedSkip=true并说明主动跳过，原valid=false/阈值不变。unavailableSideReasons只在AUTO过滤该明确政策，UNKNOWN和真实孔槽/端部等失败保持；相关候选全为跳过才设policySkippedOnly，失败详情为空，不存被跳过外置件红色Ghost。缺侧计数只在真实原因非空时为1，原安装分支/placements不改。
- diagnostics附临时policySkippedOnly，正常跳过行仍进入只读实际安装/失效分类，不直接当问题。classifyDiagnostics先按实际同源连接判失效/已装，再丢弃已有有效件的纯跳过行；提交后再读仍沿用。完全未装保留但只提示需其他允许接法/无禁用候选预览，失效原件优先并读取真实错误/空实体原因，不用正常留平掩盖其他失效记录。
- app成功/无新增提示用save后实际report.rows.length，而非提交前issues数量；全消除时不留下空计数/异常入口。showDiagnostic对旧/直接传入正常跳过候选不创建红色Ghost/点标；SUPPORT_PLANE_UNKNOWN独立说明，其他原因/姿态、三类聚合/定位和状态清理保持。所有新标识只报告快照，不进Project/历史/BOM/自动保存。
- 0.75.84 / Schema62 / 141模块，无新模块/依赖/持久字段，默认/层高/板材/清单/Factory保持；入口/importmap/pom/样例及59份verifier仅身份同步，未新增测试/改断言。只人工源码与资源阶段，默认未测试/语法检查/编译/启动/HTTP/浏览器或实际计数/生成/存储验收，详见VALIDATION/ROADMAP及reference/support-plane-expected-skip-2026-10-14-v07584.md。

## v0.75.83 紧凑结果区、结构化原因与实际失败对象定位

- 用户确认同时修复截图中的结果卡/分类重叠、原因聚合与精准定位、AUTO尝试90度直角件；先前v82只改结果分类，本版扩展自动候选而不放宽安装条件。原用户工程和浏览器存储不直接操作，已有修改保留。
- index将结果入口收为紧凑标题/三类小计数；connection-report-entry不参与flex压缩，library-resource-scroll独立滚动，原创建/修改tabs及builder-review独立滚动保持。详情三类筛选继续，按主要失败原因分组（一个接头只计一次）、本组上一处/下一处与每个有真实姿态的失败候选预览；无新模态或持久UI字段。
- ConnectionPlacementManager.evaluateCandidate只附failureCode，原判断与消息优先级保持；AUTO政策失败也附code。unavailableSideReasons保留最多三种当前候选失败（同类型/面/代码去重），按可解析姿态及当前上槽/侧贴偏好排序，不按毫米数/ID拆组。diagnostics保存failures与目录定义/Vector及Quaternion数组副本，confirm后分类保留这些失败快照并重新取得失效记录ID；既有缺安装实体情况也归失效。
- app按connectionFailureGroup(code)的稳定原因类聚合，其他失败保留详情，不把多个候选当多个接头统计。临时索引/焦点/说明仅当前页面；过期工程/截面不能定位，操作前检查原宿主存在/可见与进行中工具/手势/播放/爆炸/模态，不取消半完成工具来强行定位。
- ConnectionBatchManager.showDiagnostic/clearDiagnosticPreview拥有独立临时Group：失效记录若有实际可见几何走原selectConnection，没实体则点标；其他类只显示实际失败候选红色Ghost或接头点，未选择/染红有效原角码，不进interactionMeshes/Part/Project/历史/BOM。关闭/类别切换、选择/工程/截面变化、cancel和卸载释放几何。定位后保留结果页，失效件“检查/替换”再进原修改页，沿原ConnectionReplacementManager预览/确认，不自动替换。
- AUTO类型为ANGLE_BRACKET/CORNER_CUBE/HIDDEN_CORNER，共用原目录安装映射。合法SIDE_MOUNT直角件评分优先同侧角码；普通端接维持原梁下角码/其他角码顺序，直角件备用，隐藏件及空闲上槽定向补件保持。unknownSupport/上表面凸出仍拒绝所有外置件，所有候选继续原孔槽/完整支撑/真实材料/已装和第三方空间检查，fresh确认再次同源政策复验；显式类型/旧有效或制造件不替换。
- 侧贴隐藏件提示不再把外置推荐当已适配。没有新增供应商实物数据、跨错台隐藏模型、自动移柱/抬梁或制造豁免，不能承诺原44全部解决。
- 0.75.83 / Schema62 / 141模块，无新模块/依赖/持久字段；入口/importmap/pom/样例及59份verifier仅机械版本同步，原默认/层高/板材/清单/Factory保持。只人工源码阅读/差异和资源交付，未测试/语法检查/编译/启动/HTTP/浏览器或实际生成/存储验收，待验见VALIDATION/ROADMAP及reference/connection-reason-auto-right-angle-2026-10-14-v07583.md。

## v0.75.82 连接件报告三类数量与提交后真实分类

- 用户确认前轮建议，只调整报告分类、数量与文字。最新来源鱼缸架示例 (2).json为Schema62/v0.75.81、39根/144条（124角码/20内置件），前轮已只读所有已保存安装槽匹配/宿主/状态；44对应已装接头的另一侧候选，不将源码分组当原页面报告逐条复现。本轮不运行生成或改用户JSON/真实Chrome。
- 原ConnectionBatchManager导出ConnectionReportCategories统一ID/短标题/完整说明；app分组/计数与模板共用，不另造数值源。UNINSTALLED、PARTIAL、INVALID仅临时报告状态，不进Schema62、Project/历史/草稿/BOM，不替换原blockedCount或原READY/确认条件。
- diagnostics原筛选未变，保留尚未贴合/失效/真实接触未安装/缺另一侧行；增加sourceEnd/targetFace/scanStatus/blockedSide/jointKind/侧贴/侧槽局部引用副本及原reason，用于confirm清rows之后仍能找同一物理接头。旧ID/实际点/宿主定位保持，消息不再先套“一侧已有或可以生成”。
- classifyDiagnostics只读ConnectionManager.connectionsAtJoint：失效记录/INVALID_EXISTING优先，其次有效designComponent或actualPartIds中存在的generatedHardwareIds；纯抽象关系不算已装。前一快照可以在扫描时分类，app.saveConnectionBatchReport在实际提交后再分类，READY不当事实；成功与无ready两路共用，没有额外扫描、几何检查或安装/替换操作。
- 创建面板有需处理快照时显示三类计数（零类也显示0），点击有数据的类进同一结果详情；详情原生按钮/aria-pressed切换所有类，零类有说明，不显示合计失败。默认选第一个有数据的类，关闭保留当前类、重扫重选，空工程清数据/类别；新增computed/类别UI无额外监听或领域写入。
- 未新增/成功消息只列实际非零分类数，原错误/取消不冒充完成；原进行中工具/模态保护、Esc/关闭、签名/截面变化过期及过期禁止定位保持。只能说明本次识别范围，不保证未知接头完整、实物装配/承载或制造合格；不写死44，不自动打开结果。
- 0.75.82 / Schema62 / 141模块，无新模块/依赖/持久字段。v81参考件适配、空闲上槽补件与所有安装/事务、默认/层高/板材/清单/Factory均保持；入口/importmap/pom/仓库样例及59份verifier只机械身份同步。默认未测试/语法检查/编译/启动/HTTP/浏览器或实际报告/生成/存储验收，资源与待验见VALIDATION/ROADMAP及reference/connection-result-categories-2026-10-14-v07582.md。

## v0.75.81 内置角槽件适配与缺上槽定向补件

- 用户要求以最新鱼缸架示例 (1).json为准并确认修正；只读该工程39根/128关系、124角码/4抽象关系/0隐藏件，没有保存批量类型选项。此前源码/数值诊断发现30系列宽脚在深6.8mm处半宽6.6超过槽6.34，不能从此判定实物都不能装；原用户文件和浏览器工程不直接修改。
- ConnectionComponentPorts只改新选配30系列bevel=0.7，保持hiddenGeometryVersion2、宽13.2/深7.2/孔位/腿长；40系列仍0.4。新宽脚角点深6.5处槽半宽6.64，留0.04横向参考余量；ComponentGeometryFactory和HiddenConnectionPlacement共用原layout。显式保存bevel不重写，既有已知旧薄板规范化条件未扩大，没有精确供应商图档或实际安装证明。
- HiddenConnectionPlacement保留hiddenConnectorFits布尔调用约定，新增同源hiddenConnectorFit结构化原因；原0.0001mm外包/1e-12共轴/真实多边形材料检查不放宽。完整两端支撑先查宿主A/B越界，给实际超出毫米数；ConnectionManager逐孔/槽宽/实际面/完整材料判断不跳过，具体hidden错误在端口错误中优先显示。
- ConnectionBatchManager缺上槽只由AUTO、存在真实向下安装面、相反上面未占用且未封槽确定。优先合法上槽HIDDEN_CORNER；已有两件允许这一件定向补件，其他方向仍旧数量规则。源/目标锁定、失效/制造保护、现有件占位和reserved包络、fresh确认/原事务保持，无自动替换或模型位置修改。
- SideMountConnection按真实sideMountJoints和轴向解释侧贴/外侧内置件不适配，ConnectionManager切换同一说明；未新增可跨30mm错台的内置件。批量SIDE_MOUNT隐藏选项不再先过滤使位置无原因，失败候选只含临时消息、不携有效transform/envelope、不会进入确认。外侧OUTER_CORNER单面安装停止假报另一侧，梁下侧贴上下候选仍原规则。
- unavailableSideReasons读取当前相反侧/未占用侧，优先隐藏件具体错误，再承托面政策/第三方空间；上/下标签取当前世界法向，最多三条原因。sideFailures只本轮rows，diagnostics不覆盖具体消息，原app报告签名/过期/定位/Esc保持，无Project/历史显示字段。
- 最新工程顶梁顶与柱顶1800mm，当前朝上立腿长23.8会到1823.8；该侧继续拒绝并说明，不抬梁/延柱。此前默认1060×610×1800、层高、板材、材料/图纸和Factory边界保持。
- 0.75.81 / Schema62 / 141模块，无新模块/依赖/持久字段；入口/importmap/pom/仓库样例及59份verifier仅机械身份同步。人工源码/差异阅读与资源交付，未新增/运行测试/语法检查/编译/启动/HTTP/浏览器或补件数量/Undo/实际存储验收，参见VALIDATION/ROADMAP与reference/hidden-corner-fit-2026-10-13-v07581.md。

## v0.75.80 贴边层高与对应层编辑入口

- 用户确认上轮展示方案，并给宽1060/深610/高180；进一步回复1800毫米（180厘米）。DiyTemplateCatalog唯一默认尺寸改1060×610×1800，5层、每层1承托、原角色/接法保持；只影响默认新建/缺省，显式保存参数优先，不迁移工程或常用方案。
- SceneAnnotationManager rackDetailMode/selected/hover/focus/highlight均显示状态，原options和Schema62不新增字段。默认短标签（如1–2层 462）与一组净高·mm，细竖线/短刻度；当前段才箭头和实际上下梁临时有深度外框，完整开关还原长说明。固定线缓冲/原有限屏幕避让复用，不够空间隐藏、侧表仍可查，无每帧重建BoxHelper或业务测量。
- 标签改原生button，type=button/ARIA/Tab/Enter/Space、pointerdown和click守卫；普通修饰键不进入详情，正在绘制/放置/预览/框选/拖动/特征/标尺/播放/爆炸/模态禁用，不取消在做的工具。fresh实际层数据/真实宿主ID查询后选择下层成员、展开右侧详情；不是尺寸实体或直接净高驱动，不写历史/草稿。
- 详情显示净高、上层intervalMm（两个顶面差）与下层heightMm（离地）；表格净高也可点，当前行突出。编辑入口用原beginFrameEdit及参数副本、展开并定位原frame-layer-height-N，顶层定位frame-height；输入实际change才设置手工层高，原预览/保护/确认/一次历史与失败回滚不改。
- 工程/选择变化清查看段；DOM刷新、隐藏/工具忙/卸载释放临时框。帧回调可移除，dispose幂等与排队刷新守卫防复建；新增交互不替换实体材质/干涉/选择，不加入拾取/Part/BOM。完整版开关只当前页面、刷新回紧凑，原showRackLayers仍走原保存选项。
- v0.75.80 / Schema62 / 141模块，无新模块/依赖/工程字段；入口/importmap/pom/样例及59份verifier仅机械版本身份同步，不运行/新增测试或改断言。旧草稿文案/导航/预设与相关默认期望待授权同步，本轮默认未语法检查/编译/启动/HTTP/浏览器/实际存储下载；已有dirty/staged和用户文件/真实浏览器记录保留，资源及待验见VALIDATION/ROADMAP与reference/compact-rack-layer-labels-2026-10-13-v07580.md。

## v0.75.79 本地自动保存术语

- 用户问“草稿是啥”后确认将本地自动保存称呼说清楚；文件分组/三动作、工程状态提示、恢复/备份/清除与损坏记录覆盖确认同步新名称。菜单仍9动作/3组，没有增加另一套保存入口；侧栏按钮保持简短，title解释恢复工程/清除记录。
- 状态卡下说明只保留当前浏览器的一份工程记录、不是云端保存，清网站数据可能丢失、重要工程另存JSON；顶栏tooltip同口径。新备份文件名为本地自动保存工程.json，备份仍getAutosaveText原文，不修复/重写损坏工程。
- app函数名和控制流程不变；LocalProjectDraft文件/类与工程、时间、视角key保持，启动恢复/失败保留/覆盖保护、确认清除及后续自动保存继续原逻辑。无迁移或用户浏览器/桌面文件操作，“我的常用方案”独立key不受影响，不改清单表单等临时草稿。
- v0.75.79 / Schema62 / 141模块，无新模块/字段/依赖；入口完整版本映射、pom、仓库样例及59份verifier仅机械版本身份同步，旧文案断言/8菜单/4预设断言待授权更新。本轮人工源码/差异阅读与资源交付，未测试/语法检查/Java编译/启动/重启/HTTP/浏览器/实际存储下载，已有dirty/staged保留；见VALIDATION/ROADMAP和reference/local-autosave-wording-2026-10-13-v07579.md。

## v0.75.78 前三项日常搭架优化

- 授权为上一轮建议确认，开工已说明仅前三项+填板tooltip，未做净高驱动、联动回改或按层隔离；无测试/启动/浏览器授权。原默认/4标签/File9动作/主菜单7个、部位朝向/逐层/生成/板/制造逻辑保持，不加用途菜单、供应链或依赖。
- ConnectionBatchManager.diagnostics在扫描完成/确认前读原rows，提取INVALID_EXISTING、NEEDS_ALIGNMENT、真实接触SKIPPED且非preserved与blockedSideCount；报告不是全接头审计、不将自由端/原有效保留件当失败。快照仅稳定宿主ID、标签、原因/类型、实际点，缺点聚焦宿主；不复算/放宽安装判据或改变选型/分帧/提交/回滚。
- app在成功confirm后或无ready时保存页面内存报告及fresh工程签名，取消/失败不假报成功；按需打开，生成前仍原类型/规格→生成。结果显示本次规格与新增数，工程/截面变化过期、空工程清理、Esc收起；定位fresh签名/宿主可见检查，选择两宿主并按实际点、当前视向/视口/截面范围透视/正交聚焦，不移动模型或写工程历史。没有真实鼠标/点位/过期/性能验收。
- QuickFramePresetStore使用独立diy-quick-frame-presets-v1，不读写工程/草稿key，version1/20份/64K字符；字段白名单覆盖所有新建参数（6部位、逐层左右、承托走向数量、接法/高度与联排），不含memberIds/位置/组件/板/连接/加工。读只校验记录结构，不依赖初始化前数据库目录；保存/套用才共用当前layeredRackLayout v3，未知型号/无效布局拒绝，原数据异常不自动清空或重写。
- app在onMounted只读库、错误捕获不阻断Editor启动。套用先fresh读库与完整布局检查再Object.assign新建表单、显式syncDiyLayers（数组长度为新层数，原顶层同步规则不改）；不会生成/改旧工程或改变初始默认，整架编辑禁用。另存不重名、替换/删除明确确认，不进工程Undo；写前fresh合并、所选旧快照变化拒绝，页面刷新/新建不清库，清网站数据会丢本机方案。没有操作实际Chrome/localStorage或运行存储功能。
- PanelDrawingExporter挂在Editor，读取全部PANEL的完整dimensions/materialSpec/加工/备注签名，不以世界姿态或内部ID分组；代表板克隆后panelMaterialContours/panelNotchPolygons，共用cleanContour/简单闭环检查，零长接点/共线清理不回写。SVG使用版面缩放+毫米尺寸，不作1:1切割；DXF CONTOUR/HOLE为实际mm1:1闭合线段，DIMENSION/NOTES独立，原点实际轮廓外包左下。PANEL-xx为本次图纸/清单样式，非持久构件ID。
- 图纸列原板尺寸与裁后轮廓范围、厚度/数量/材质、N避让记录/边/定位端/距端/宽深范围；沿轮廓缺口不方框化，范围不是矩形加工，原轮廓孔环保留。曲线为当前折线参考、非精密CNC/公差或正反面认证，立体PANEL/无效未知轮廓/未适配板材加工明确不出假图。普通单种/全部ZIP fresh物理组键重查，部分支持的全部包清单标未适配；正式Factory Gate后同一addFiles输出工厂汇总/板材加工图，旧原始轮廓/缺口/BOM/加工/装配等不删。
- index/CSS接创建面板报告、快搭可折叠本机方案、统一图纸标签板材列表/打包按钮，长说明换行；Vue公开bindings已人工核对，新增refs不在未声明时immediate watch访问，填板tooltip同步多块/轮廓预览。没有编译Vue模板或执行这些函数，不将人工阅读当实际Console/Network/下载/CAD打开通过。
- v0.75.78 / Schema62 / 141模块，新增2本地模块无依赖/工程字段，入口/importmap/pom/仓库样例及59份帶版本verifier仅身份同步，旧8菜单/4预设断言仍待授权改逻辑。模块表工具仅产生apply_patch文本；默认未测试/验证器/语法检查/Java编译、启动/重启、HTTP/浏览器、真实存储/下载打开。原用户文件、真实Chrome/存储不操作，旧dirty/untracked保留；资源和待验见VALIDATION/ROADMAP与reference/connection-report-presets-panel-drawings-2026-10-13-v07578.md。

## v0.75.77 工厂汇总视图 / 加工样式图 / 移除安装指导入口

- 用户确认“工厂不关心内部编号”和“安装指导作用有限”的精简方案。统一资料窗口材料/accessories/machining/drawing四标签，删除assembly标签、整块说明书/播放步骤模板与打印按钮；不删除AssemblyManager/组合解组/爆炸播放底层或正式包装配记录。原文件9动作/3组、7主菜单、统一资料焦点/辅助层/材料草稿保护保持，旧assembly tab请求按原未知tab兜底材料页。
- BomExporter.buildFactoryAccessoryList读取同一buildDesignMaterialList，不再单独数ACCESSORY_CATALOG；ACCESSORY散件/CONNECTION套装/待选型、完整dimensions/规格分组、失效/两端体系提醒沿原源。可见cells只输出类别/名称/规格型号/尺寸/数量/单位/备注，待选型量列—、备注明确处数不计采购，隐藏partIds/connectionIds用于原focusMaterialEntry/选中高亮。
- 原材料machiningSignature副本排除manufacturingCode/id/连接来源/孔组随机身份及pattern/patternSource/mirror编辑来源，保留normalizeMachiningFeature后完整物理参数/工序/基准；复合孔引用转成目标参数签名、孔组成员签名，未解析引用保守分开。排序对象键/特征集合，不按四舍五入参数合并；材料key还纳入实际sectionSize/wallThickness，型号/制造规格/封槽/路径/端切/备注继续区分。没有改原Feature、编号、图案关系或旧生产groups/逐件方法。
- factoryMachiningGroups从同一材料组取完整克隆，仅含有加工或非零端切的PROFILE，STYLE-xx本次顺序标签不持久化。buildFactoryMachiningList显示型号/制造材料、长度/数量/A/B端切/孔面/距A端S/横向或端面XY偏移/孔径螺纹深度/槽铣方向/阶段/基准，原自动ID/组件路径不作可见列；本次样式与同名SVG/DXF对应，不拿旧M组或首件displayId假装整组要求。
- DrawingGenerator的buildMachiningDrawings/buildCutDrawings仅增加显式组入参，默认调用保持旧分组；新buildFactoryStyleDrawings复用相同绘制器、使用STYLE/-CUT并清空可见partIds，加参考脚注。直料已知加工图复用现有边界；弯料/未知特征清单明确未适配且不出假图，不声明补齐精确CNC、复杂端面复合、公差、真实截面或弯料加工图。
- app结构化行从row.cells渲染，key来自完整规格，定位不再正则解析可见编号；按钮可键盘定位/下载，长加工说明换行。配件/加工CSV及单样式CSV+SVG/DXF ZIP下载前fresh取组，过期加工键拒绝/完整图数不符拒绝，文本公式防护；这些是设计参考，不触发Factory配置或假称可生产。原材料Excel/CSV文档格式不变。
- FactoryPackageExporter原validateForFactory阻断后增加工厂汇总/配件清单.csv、加工清单.csv、加工样式图/与阅读说明，样式组同一快照；原生产报告/工程/板材轮廓/BOM/逐件切割与加工/装配/总装子装/弯曲与斜切图全保留，Gate/制造配置/警告确认不放宽。底层身份用于追溯，不因默认清单隐藏而删除。
- v0.75.77 / Schema62 / 139模块，无新模块/依赖/持久字段；页面/importmap/pom/样例和59份带版本verifier仅身份同步，旧8菜单/4预设断言仍待授权改逻辑。按默认未测试/验证器/语法检查/Java编译、启动/重启、HTTP/浏览器/真实下载和Excel/CAD打开；用户原文件/真实Chrome/localStorage未操作，dirty/staged保留，资源结果见VALIDATION、待验见ROADMAP及reference/factory-facing-list-simplification-2026-10-13-v07577.md。

下面v0.75.76五标签/装配打印为历史交付，本版四标签覆盖其资料入口；底层装配/组件仍保留。

## v0.75.76 清单与导出单入口 / 单资料窗口

- 用户确认单入口、统一窗口、分标签导出方案；文件资料相关9个原按钮合为1个“清单与导出”，项目5动作及本地草稿3动作保留，总9动作/3组、顶部仍7菜单。当前视图导出移图纸标签，项目工具/底部截图快捷入口保留；无新制造顶栏或删除实际功能。
- app删除materialListVisible，材料模型以统一engineeringCenterVisible读取；五个固定tab ID复用materials/accessories/machining/assembly/drawing，selectEngineeringCenterTab只更新UI，openEngineeringCenter/旧openMaterialList别名都同一弹层。模板删除第二个资料外壳，原材料卡表/规格/统计/虚拟补充表单内容保留；非材料表只读原BOM数据，旧materials简表分支不再使用。
- 切标签不关闭窗口、保留materialListView与临时补充项；watch仅整个窗口关闭清理表单/错误，浏览不写历史，已保存补充项仍原MaterialListManager。材料CSV/xlsx实现/fresh快照不改，打印原函数仅装配固定底栏一份，PNG用原renderer画布、SVG/DXF和Factory包全部原函数；格式/BOM/制造规则未扩展。
- 固定标题/横向标签/底栏，材料与其他内容各自滚动，小屏标签可横滚/统计两列/图纸单列。资料层4990、原配置/检查5000，其间资料section inert/aria-hidden，关闭辅助层回主窗口active tab焦点；查看制造资料仍可明确回材料标签。Esc优先原检查/配置，其次材料补充表单、主窗口；主面板Tab/Shift+Tab仅可见可用控件循环，不接管辅助层。普通定位及检查项定位关闭主面板，实际定位逻辑不改。
- 制造配置/导出前引导/Factory错误阻断/警告确认不改，普通清单无需配置原规则保持；不写Schema字段或操作原JSON/实际浏览器存储，原抽屉/框架/连接/板材/加工/历史及dirty/staged保持。v72其他一比一导出仍待真实样例，不能因统一UI说已解决。
- v0.75.76 / Schema62 / 139模块，无新增依赖/模块/字段，入口/importmap/pom/样例及59份带版本verifier仅身份同步，旧8菜单/4预设断言待授权同步、不改测试逻辑或执行。默认未测试/语法检查/Java编译、启动/重启、HTTP/浏览器/下载/打印/实际文件验收；资源复制和源码不证明Vue模板/初始化/单窗/焦点/输出通过，见VALIDATION、ROADMAP及reference/unified-list-export-center-2026-10-12-v07576.md。

## v0.75.75 制造导航并入文件

- 用户先询问制造菜单与文件重复，再明确要求去掉制造、全部合到文件；实际范围是导航迁移/去重，不是删除制造业务。index移除独立制造details及右上制造输出，仅保留原撤销/重做，主菜单8→7。
- 文件17个动作按项目、清单与装配、导出与制造、本地草稿四组；原项目/视图导出/样例/草稿入口保留，新增直达原配件/加工/装配、制造配置/检查/制造包动作，材料清单与工程图各一份。所有@click直接调用原函数，无新增代理、菜单业务状态或输出路径。
- 仅追加cad-menubar下cad-file-menu限高/内滚动/子项不缩/overscroll样式，不改其他顶部或底部弹层。原hoverCadMenu/keepCadMenuOpen/native details和click后关闭复用，未改pointerdown时机或快捷键；工程中心/材料清单内标签、选中连接去配置按钮等上下文流程保持。
- 原ManufacturingConfigurator/FactoryValidator、导出缺配置时引导配置、错误阻断与警告确认未改；工程/历史/草稿/镜头和抽屉/通用框架/BOM全部保持，原用户JSON/真实Chrome/localStorage未操作，已有dirty/staged改动不回退。
- v0.75.75 / Schema62 / 139模块，无新依赖/模块/字段，页面/importmap/pom/样例及59份带版本verifier仅身份同步；verify-catalog-workbench-v069旧8菜单断言、v73旧4预设断言仍待授权同步，不改测试逻辑/不执行。默认未测试/语法检查/Java编译/启动/重启/HTTP/浏览器；资源阶段与点击/滚动/键盘/初始化待验见VALIDATION、ROADMAP和reference/file-manufacturing-menu-merge-2026-10-12-v07575.md。

## v0.75.74 抽屉导轨 / 箱体 / 整组提交

- 用户提供默认500/450/600/3/3/内置/450轨截图，报告B-965/A-970材料重叠另有5处并确认修正。当前源码原轨内体偏局部X5.76、宽9、外体宽12，外包[-6,10.26]；旧两轨同朝向使每个左轨与前板/左侧板分别交叉，旧公式3组6对与截图数量一致，但无工程JSON/本地运行逐ID证明，不操作现有抽屉、原文件或真实浏览器存储。
- 新model/DrawerSlideGeometryModel提取原两实体尺寸/局部边界，PrimitiveGeometryFactory仅共用参数、旧形状未改。diy/DrawerGroupModel纯布局/严格输入：导轨完整设计占位16.26/侧、右Yπ朝内、按面板内面和箱背界定深度，侧板/背板/底板对接；不以固定7mm偏移/最近规格/min长夹导轨或过小箱体强行夹40mm。
- 深度含面板，默认18mm/箱板12mm，总宽含双轨；外盖面板左右各多10mm仍保持。导轨前后各1mm为设计避碰间隙，不是供应商尺寸。D450初始配L400；用户显式L450保留并提示D至少470，默认变更只新表单。app/index共用布局错误/箱体与面板高摘要、缺导轨时禁长度输入、无效状态禁生成；数量1～12整数/空值/非有限/不足高度宽深均拒绝。
- InterferenceFeedbackManager抽出原physicalItems只读快照，实时反馈行为/阈值/豁免未变；findInsertionInterference用同一classify检查新件内部和新旧宽阶段相交，包含可见真实Part及目录连接helper、与enabled独立，旧件彼此已有问题不检查。Editor生成前临时场景外普通板/导轨网格，检查后finally释放，不增Scene假实体或mountReference/同组件豁免。
- 全部通过才原addPanel/addHardware插入，AssemblyManager.create建各抽屉、createParent建多抽屉父总成，单抽屉直接真实子ID。selectionGraphMutation覆盖插入/历史及失败restore，半组不通知草稿；一次历史和最终工程通知，回滚还原工程/选择/旧历史/partSequence，clear(false)保持剪贴板。暂态预检查不消耗制造/显示编号；源代码事务不等于实际异常/Undo验收。
- v0.75.74 / Schema62 / 139模块，新增2纯模型无依赖/字段，版本/importmap/样例及59份verifier仅身份同步，不改测试逻辑；原v73过时四预设断言仍待授权工作。默认未测试/语法检查/Java编译、启动/重启、HTTP/浏览器，资源阶段另记；实际无冲突/边界/旧工程/BOM/历史/Console/性能及采购尺寸待验见ROADMAP、VALIDATION和reference/drawer-slide-layout-2026-10-12-v07574.md。

## v0.75.73 合并用途预设为通用框架

- 用户问各用途是否只是默认参数，源码确认四类均LAYERED_RACK、主要区别层数/承托数量后，明确确认合并方案。只修改快搭入口/名称与默认身份，没有新生成器或物理结构规则，没读/改桌面JSON、用户Chrome/真实草稿。
- DiyTemplateCatalog公开列表仅GENERIC_FRAME，DEFAULT_DIY_TEMPLATE_ID为新建/初始化统一来源；旧四个完整记录私有，只支持getDiyTemplate旧ID直接调用/原loadSample，不显示在快搭、不执行Schema历史迁移。默认createQuickFrameDefaults(5,1)完全沿原用户结构，670×610×2000、5层1承托及3060柱/平底框、3030其他层/底承托、顶底侧梁FRAME、中层INSET。
- index移除用途/自定义下拉，普通新建标题与组件名通用框架，编辑整架仍标题框架参数；app移除diyTemplateId/CUSTOM、selectedDiyTemplate、selectDiyTemplate/diyPresetEdited和仅改身份的事件。基本字段仍v-model、层数及深层watch，结构事件仍显式改layoutVersion；beginFrameEdit只移除CUSTOM赋值，原加载/默认缺省保护/FrameParameterManager预览和确认未变。打开面板不重设用户输入，所有部位/朝向/接法/逐层高度/承托走向/联排和连接/板材/制造保护保持。
- Schema62/137模块/0.75.73，无新模块/依赖/持久字段，入口/importmap/pom/样例及59份既有带版本verifier仅机械身份同步，不写新测试或改逻辑。人工读到verify-diy-v045的“四模板”、鱼缸公开项、app旧UI标记断言已过时，授权测试时需同步，不将未跑脚本写为通过。
- 默认未测试/语法检查/Java编译、启动/重启、HTTP/浏览器；资源阶段另记，不宣称实际界面/生成/旧工程回改/性能通过。原v72材料清单及未完成导出范围不在本次扩展；保留所有dirty/staged历史，见VALIDATION、ROADMAP与reference/unified-quick-frame-2026-10-12-v07573.md。

## v0.75.72 独立材料清单 / 套装 CSV 与 Excel

- 本轮范围来自“材料清单和导出参照乐玩”及真实套装CSV。先公开匿名UI正常交互，再只读CSV；参考文件原样留存于reference，30型材/22513mm/83套为样例核对，不是应用硬编码。表格技能使用现有缓存运行库导入CSV，未修改/导出来源工作簿；浏览公开参考站不是本地功能验收，未绕过登录、复制私有源码或采集用户工程。
- index/app/CSS增加独立材料窗口：分类卡片/表格、型号实际截面SVG与其他符号、模型数量/待选型、按ID定位与已有选择对应、虚拟补充表单、分类/统计、固定下载栏。材料入口共用openMaterialList；模态期间原背景快捷键守卫保持，Esc先取消补充表单再关闭清单，三维定位关闭窗口。安装指导只调用旧printAssemblyGuide，不冒充参考站新模板。
- BomExporter.buildDesignMaterialList共用业务Part/Connection，不读helperMeshes。已选未制造目录件按designComponentMountFaces独立侧数计套装需求，制造派生Part已计则不再算设计件，抽象方式待选型不购入；不删除失效记录、提醒规格/几何。路径计算仅副本，型材不同加工/封面/制造/端切、板材不同dimensions/裁角分组，旧生产报表/实例链保持，hasMachining为组内OR。截面SVG按型号本次汇总复用，不逐帧重建，未性能实测。
- 新MaterialListManager规范化根可选materialList={profileSystems,virtualItems}，Schema62缺省为空；新建清空、加载/Undo恢复、保存/草稿沿Editor，UI不直接写业务数组。制造已配置型号不能清单覆盖规格；虚拟名称/规格/长度型号/数量/9种单位/备注、最多200项，修改一次历史/提交，不建Part、BOM总量不混加虚拟米数，浏览/下载不capture。
- 新MaterialListExporter只格式化同一fresh模型快照；真实样例7/5/6列及分段CSV，中文BOM/全引号/CRLF、文字公式注入保护，备注保留不同参考尺寸/加工与失效。Excel同一数据以本地既有JSZip封装OOXML xlsx，非伪扩展名；未取得乐玩xlsx样例，未在Excel/LibreOffice打开或执行新下载链。普通BOM不走Factory Gate，但完整制造ZIP仍须原配置/校验；图纸旧0.75.10元信息统一读当前版本。
- 0.75.72 / Schema62 / 137模块，2新增模块无依赖，页面/importmap/pom/样例及59份带身份verifier只版本同步、未写新测试/改逻辑。默认未运行测试/语法检查/Java编译、启动/重启、HTTP/本地浏览器或实际下载文件验收，未直接操作桌面JSON/用户Chrome/localStorage，既有dirty/staged改动保留；源码、参考CSV核对和资源阶段不等于新功能运行通过。
- 完整“一比一导出”尚未完成：需要安装指导/板材与框架图纸实际样例；MayCAD.scene必须合法格式证据和真实导入条件，不改JSON扩展名假装互通。实际待验见ROADMAP/VALIDATION，完整规则与原始文件见reference/lewan-material-list-2026-10-12-v07572.md。

## v0.75.71 点击处平移手柄 / 视线轴入口

- 用户确认普通点击型材哪里，移动手柄就定位哪里；选中后另处可重新定位，拖动跟随，只改移动手柄不改业务中心或旋转中心。原选中流程丢弃了命中点，新普通无修饰键点击保留真实hit.point并转本体局部点，SelectionGestureManager直接拖动主选也在事务前取实际命中；Ctrl/Meta/Shift多选及Alt穿透/复制不重新锚定，不改原选域。
- 新ClickAnchoredTransformControls继承本地Three0.155，不改vendor，object仍真实Part根，原attach/detach/selected等API保持；updateMatrixWorld先执行原本体/父级/相机计算，再仅translate把worldPosition、eye及_gizmo/_plane重定位。原_positionStart本体位置不变，pointerDown对worldPositionStart加局部点世界偏移、pointStart减同偏移，位移差不受新显示原点影响；原网格步长和约束作用在真实本体，不围绕点击点量化。
- 旋转/缩放不采用锚点，原主选中心/朝向/世界或局部轴保持；切回移动可沿同根局部点，移动中不自动回中心。换主选/解绑/根重建或非拖动形状变化清除临时锚点，工程加载/清空走原detach；无真实点击仍中心。isTransforming回调冻结原Gizmo、程序移动/直接拖动和抓手期间的锚点变化，不把暂时点击位置写入Part/Project/历史/草稿/尺寸或制造。
- SceneManager正轴picker横向扩大25%，只改拾取网格；原显示箭头尺寸、负轴裁减、双向位移和XYZ平面不变。与当前世界/局部轴方向绝对点积≥0.95的最近视线轴有一个24px圆字母按钮，标记仅在锚点处可见视口内、普通可移动PROFILE选择中显示，不能截获放置/评审/抓手/测量/框选/播放/模态。按钮调用原AxisClearanceManager.update / focusDistance，带正负号输入的是原移动量，不是v70最终净距，不偷偷实现屏幕深度拖动或直接移动。
- 轴按钮原生Enter/Space/Tab不传后台框选/邻距快捷键，实际输入仍原Manager事务；按钮位置/轴/空间未变不重复重建DOM文字，v70邻距框屏幕避让和缓存签名纳入临时轴按钮，避免标签压住入口。整个回调不触发业务写入，实际拖动/距离提交仍原作用域、约束/吸附/连接重建/失效解除、配件及红色干涉保留位置/撤销/草稿策略，没有新制造映射或碰撞判据，缓存不等于性能验证。
- 135模块 / Schema62 / v0.75.71，新增1本地模块无依赖/Project字段，入口身份与pom/样例和59份带版本verify机械同步；未新增/运行测试、语法检查、Java编译、启动/重启、HTTP/浏览器。v70初始化热修保持但其运行记录不能当本版控制器已通过；离线资源记录、真实±XYZ/本地轴/量化/手势/取消/近视轴/密集性能待验见VALIDATION、ROADMAP及reference/click-anchored-translation-2026-10-12-v07571.md。

## v0.75.70 初始化同名声明热修复

- 用户明确请求同时看Console / Network。隔离Chrome访问127.0.0.1:8080复现axisVector重复声明：新Editor命名导入与原3540行顶层函数同名，浏览器在模块解析时拒绝整个Editor。入口、app和Editor实际HTTP200，资源下载没有导致这一语法错误。
- 仅删除Editor第16行导入中的axisVector，保留profileDistanceRelation导入；原轴向函数及既有尺寸绑定调用不变，新净距命令复用已有函数。ProfileNeighbourDistances与显示Manager仍原模块接口，0.75.70 / Schema62 / 134模块及其他代码/依赖不变。
- 2026-10-12 08:49:22（UTC+8）离线资源复制成功，HTTP返回Editor与源内容及SHA-256完全相同。新隔离Chrome上下文冷启动和同页普通刷新各观察9秒：初始化成功/boot消失/Vue挂载/三个canvas/一个距离层，pageerror和Network失败0，Editor / app / 新两模块 / OrbitControls200；普通刷新boot304属于正常缓存验证。
- CDP Network冷启动144项响应/133个本地JS响应，唯一HTTP / Console错误是favicon.ico404；普通刷新143响应/133本地JS响应，Console警告/错误、pageerror、HTTP错误和请求失败全0。没有屏蔽图标请求，也未扩大到无关favicon修复。
- 只为此初始化问题运行浏览器/HTTP诊断，未运行Java编译、功能验证器、服务启动/重启、单选距离编辑/约束/撤销或性能验收，未读取修改用户原工程、现有Chrome/实际浏览器存储。下面原交付的“未浏览器验收”不否定本次初始化证据，也不能将本次启动成功当所有功能通过；详见VALIDATION及reference/initialization-axis-vector-hotfix-2026-10-12-v07570.md。

## v0.75.70 单选型材的长度 / 同框面邻距

- 用户确认参考所附嘉立创“单选后出现周边距离输入、Tab换输入”交互。本轮只读截图与当前选择/Gizmo/OBB/侧面/抓手/约束/历史代码后实现，没有采集对方代码、读取或修改桌面工程/用户Chrome/实际存储。距离定义为原外包络的轴向净间距，不宣称与参考站中心距/槽内距离口径一致。
- 新ProfileNeighbourDistances从业务截面、真实世界姿态和profileSidePlanes求同框面：四角偏差≤0.1mm，平行长轴只认同向侧面，垂直长轴允许相向框侧面，且测量方向与共同平面平行；原sweepObbContact要求其余投影交叠。按世界±X/Y/Z每方向一根最近明确参照ID，最多六项，不测投影斜向杆、另一层或印字/抓手。已知T_SLOT直杆 / 方切 / 单位缩放 / 世界正交才给邻距，长度仍原直杆路径。
- 新SelectedProfileDistanceManager只读临时Scene组和DOM，长度 + 净距框共用延长线/双端小箭头，有限屏幕档位避主体包络及尺寸标签；背向/实际其他实体和连接五金遮挡/出视口/无空位不硬显。实际参照端点不随标签避让改值；输入/临时线不加入Editor.meshes、选择raycast、模型包围盒、Project、永久Dimensions、BOM或工程图。几何固定缓冲，模型变化才重算候选，相机变化只重投影/查遮挡，不等于帧率已测。
- Tab和Shift+Tab仅普通画布选择或本组输入内循环可见可编辑项；Enter提交最终目标、Esc撤销当前草稿并返画布焦点，不清选择/永久关系。输入框保留Ctrl文字剪贴板/方向键，按钮/其他表单正常Tab；Ctrl/Meta/Alt+Tab不截获。显示整毫米但只读不改真实参数，小数显式提交、未编辑Enter不取整；切框不提交，成功编辑刷新本组，换选/工具/工程变化丢弃过期草稿。
- 净距命令输入非负最终距离，显式世界轴单根平移，不套用户CONNECTIVITY/ASSEMBLY作用域或局部轴。保留这些偏好与当前工具；Gizmo原约束解算前后重查全部型材朝向/其他位置和所选全位置、参照关系与目标值。约束牵动其他杆或参照不能保持就完整回滚，不松约束。原连接随动及SINGLE失效接头解除/提示、配件随宿主与红色干涉保留位置规则保持，不以邻距值当无干涉认证。
- 长度框跟随右侧profileLengthForm的固定A/B端，移动端受原锁定/连接/端点约束不可编辑；Editor包装原ProfileGripEditor长度事务/加工A/B基准重算，成功一次历史/工程提交，异常还原工程/选择/历史，selectionGraphMutation阻止半成品草稿。原方向键相机相对移动/底栏XYZ相对移动量及其他工具Tab保持；多选、放置/绘制、评审、抓手/Gizmo拖动、标尺/框选/特征、播放/爆炸及模态不启用本组。
- 两个新模块带入静态importmap，0.75.70/134模块/Schema62无新依赖或Project字段；页面、pom、样例与59份已有带身份verify机械同步，新增快捷说明。按规则未新增/运行测试、语法检查、Java编译、服务启动/重启、HTTP/浏览器；离线资源阶段见VALIDATION，实际交互/约束回滚/遮挡/性能等待授权验收见ROADMAP和reference/selected-profile-neighbour-distances-2026-10-12-v07570.md。此前v69暖金黄、分格插槽板、截面/加工、默认架与镜头保持。

## v0.75.69 已贴合接头的参考金黄色带

- 用户确认参考所附乐玩对齐后的黄色条。截图中心四点RGB均#D7A13C，只作为最终视觉方向，不当作对方源代码材料值。InterferenceFeedbackManager集中CONTACT_BAND_STYLE={color:0xd7a13c,opacity:.9,forceSinglePass:true}，仅options.live为false且原合法贴合通过时使用；live绿色仍0x25c778/.36。
- SurfaceFeedback新增可选forceSinglePass，仅明确true才用本地Three0.155已有单次双面绘制，其他反馈false与原默认一致。继续MeshBasicMaterial/toneMapped:false/DoubleSide/透明/不写深度/深度测试/原polygonOffset，只改变提示色及叠加方式，不把哑光效果说成实体PBR或发光。
- 真实三角面和原clipObb/margin4mm、贴合gap判据、孔槽、遮挡、raycast空函数、随动/资源释放不变；红色干涉、绿色候选、紫色齐平、橙色选中、尺寸孔字及板材/其他预览保持。Project/历史/BOM/制造不增加字段，不操作用户原JSON或真实浏览器存储。
- 0.75.69/132模块/Schema62无新模块/依赖/持久字段，页面/importmap/pom/样例及59份verify仅身份同步。按默认未新增/运行测试、语法检查、Java编译、服务启动/重启、HTTP或浏览器；离线资源与GPU/贴合色差、多角点叠色/其他状态待验见VALIDATION、ROADMAP和reference/contact-band-gold-2026-10-12-v07569.md。

## v0.75.68 分格插槽与创建前裁角预览

- 用户确认单格四边即便共用连续长梁也要按角码/连接实体裁角，选整层外四边或连同中间梁应适配图中的三块板。最新T_SLOT分格规则覆盖v64一整块及v65只拒绝穿梁的限制；原桌面JSON、用户Chrome/localStorage未直接操作，本轮只读截图/源码，没有该截图工程的运行证明。
- FrameOpeningResolver.resolvePanel仍用于已保存单板/整块非插槽语义，新增resolvePanelCells供新T_SLOT：先所选外边限定净口，找范围内与当前板厚平面相交的可见直杆（包含未选中梁），递归选完整跨且真实闭合的分隔梁。连续长梁不拆不移，各格使用其本格区间；有限64候选/64块，半截/斜杆/错层/闭槽/未知材料不外推成虚构矩形。resolvePanelSlots运行时slotPlaneMm限定本批共同槽面，不持久化世界槽坐标。
- 每格只有自己的四边sourcePartIds及原slotFit局部ID/面/槽/插入量；共用中梁两侧槽，各板各自尺寸/中心/缺口。参数架回改通过原单板resolver即可重算局部框口，原完整复制重映射/单板解除、Schema62及工程图/清单统一轮廓保持。旧保存板加载不分裂；INSET/ON_FRAME仍整块，门resolve严格四边不改。
- PanelDoorConfigurator把板材计划与插入分开，planPanelsFromSelection在正式插入前得到全部领域副本。PanelFillManager统一生成前预览，右侧逐格宽高/缺口数/四边编号/错误，点击突出相应黄色或红色幽灵板；无可用槽的矩形只是红色框口示意。修改厚度/余量/材质/放法/避让间隙同步废弃待确认计划，更新后再确认，不再使用添加后才打开的previewRelief。
- scanPanelConnectorRelief共用真实板厚外轮廓；槽内板扩大的插入边可使五金轮廓变成内部孤岛，只有离最近边不超过本边实际插入量+避让间隙才沿轮廓向板边补入口带，不改内侧斜边/圆弧或以包围矩形替代。新计划按对象采集失败/中部障碍原因，保留其余可读预览；旧板扫描仍严格失败，不掩盖实际相交或绕过有限轮廓、四边插槽料检查。
- PanelReliefGeometry.sectionContours的真正平面顶点采用1e-9mm，不再复用板内切面1e-6mm偏移判据，以免同时加入平面外贴面顶点与真交点、跳过三点三角导致丢段；不改变1e-5mm环焊点/轮廓有限门槛或0.001mm实际相交判据。没有该截图的精确几何复现或闭合实测。
- 预览仅Scene临时组，不进Editor.meshes/Project/历史/草稿/选择拾取；共享isBuilderReviewActive屏蔽抓手、框选、放置和选择，Gizmo按原状态恢复。Esc/短右键/切工具/改选择/工程变化/清空/卸载取消；允许转动镜头与正常按钮键盘导航。签名变化拒绝，fresh计划须与预览的尺寸/姿态/槽位/裁剪相等。
- commitPanelPlans复用selectionGraphMutation静默提交守卫，原addPanel分配独立ID/编号，全部新板再按实际实体（含相互之间）和四边检查；最终一次历史/提交，失败整批还原工程/选择/历史，不留下半批或半成品草稿。直接Editor创建API也使用同一分格计划，UI入口必经预览。
- Schema62/132模块0.75.68，新增1本地PanelFillManager无依赖/新持久字段，59份既有verify仅版本身份机械同步。未新增/运行测试、语法检查、Java编译、启动/重启、HTTP/浏览器，离线资源交付见VALIDATION；本轮没有截图三块的实际几何/GPU/鼠标或安装顺序、制造验收，详细规则与待验见reference/panel-cell-slot-preview-2026-10-12-v07568.md和ROADMAP。

## v0.75.67 系列原孔与一体截面

- 用户要求补四角原孔、纠正3060像两个3030拼接，提供嘉立创3030/3060/4040/4080图并确认其他型号类比。只读附图、当前Section/几何/原孔拾取链与此前留存的官方20/30/40图页；本轮未采集专有网格/代码、未读改工程JSON、用户Chrome或实际草稿。20PDF可网络读取，30/40网络工具受限，采用既有本地渲染图，尺寸仍声明参考。
- DesignProfileSection的19个常规T_SLOT默认一次生成外轮廓：canonical槽面/ID/宽度/偏置与封闭面保持，参考槽腔用斜向壁/外角弧，20无角孔、30外围圆孔、40方角腔。中心原孔有四瓣释放轮廓；加长截面的外围节点腔和筋间腔独立派生，不重复每格四角，也不保存单元间封板。45/60/80及非整数分格是参数类比，不代表特定制造型号。候选孔腔须实际在材料内且不交叠/相切，不通过就不缩孔或移动凑数。
- Registry仍custom→database→builtin-reference。只有明确列出的内置型号进入新参考，未知变体/CUSTOM/DATABASE无原图兜底、R/U保持既有路径；实际数据库Section本身绝不改写。EU30-3060B按TXCK图映射局部LEFT/FRONT缺角孔，不能全部强制四孔。accuracy/referenceOnly不变，外尺寸/槽事实不变化，但真实参考材料域已变，不得描述成纯着色。
- 临时Section.referenceBores仅新内置参考输出孔环索引/中心/名义半径，不写Project/profileSections，不作为制造参数；正常圆孔继续实际拟合。MachiningFeatureCatalog仅对BUILT_IN_REFERENCE且referenceOnly接受四瓣提示，仍用实际孔口outline交射线，原前方遮挡/端面姿态/2mm且8px/Alt自由保持。方腔、槽和未知非圆DXF不扩展猜测；旧加工偏移/直径/深度不重置。
- ProfileGeometryFactory显示geometry.userData.profileOutline保存实际环/长度/切角（仅Three几何），两端环与>=24°硬折母线直接生成CAD线，平面三角化桥接线/圆壁面片线不加入。斜切端点与原切角同式；没有Section的其他几何仍旧EdgesGeometry。ThroughHoleGeometry用原轮廓裁孔，source.clone保留标记，删孔恢复仍原链；新增孔口取实际材料交线，不从裁后网格猜轮廓。
- 131模块/Schema62/0.75.67，无新模块/依赖/Project字段；59份已有verify仅机械身份同步，现有importmap工具只输出补丁，不执行应用。默认未新增/运行测试、语法检查、Java编译、服务启动/重启、本地HTTP或浏览器。资源复制与新孔实际数量/闭合材料/截面预览和实物/攻丝鼠标/槽配件与旧插槽板/导出/GPU性能待验分开，见VALIDATION、ROADMAP和reference/integral-profile-sections-2026-10-11-v07567.md。

## v0.75.66 型材金属质感与孔壁

- 用户的两张乐玩端面/侧面图片是视觉参照，不是尺寸或供应商截面事实。修改ProfileSurfaceAppearance、ProfileGeometryFactory、ThroughHoleGeometry及MachiningHoleAppearance显示链，不修改实际Part配色、截面Registry、孔径/加工/位置/安装/制造，不操作原JSON或真实浏览器存储。
- 工程型材MeshStandardMaterial共用局部表面标记：切面略亮/更粗，外壁哑光金属，低幅纵纹与切割纹只在可分辨时显示。现有凸棱约0.16mm的反光带从实际轮廓边派生，使用表面导数取切向，仅扰动着色法向，不增加圆角实体、缩槽/孔或隐蔽填料。保留现有RoomEnvironment/全局灯光、曝光/深度退让；原CAD轮廓opacity .32→.22，不改变边几何。
- 以当前截面轮廓与Float32相同点键定位侧壁，材料在环左侧确定朝外/朝腔法向，相邻小于30°的圆弧分段连续、其他硬转折不合并。侧壁起止棱角描述共用WeakMap，不跨端面平均法向；斜切重算端面后恢复原圆壁法向。材质clone丢失onBeforeCompile，createSectionMesh显式补回；缺截面Box兜底也有着色属性，不扩大已有未知截面支持。
- profileSurface(vec2)/profileRim(vec4)只在显示网格中，两个vec4 varying不存Project。ThroughHoleGeometry make/interpolate/transform/eachTriangle/geometryFrom同步携带属性，保留原实际有限孔体裁剪、材料棱柱孔壁和原始轮廓裁孔，删除加工时恢复完整外观；加工面单独标记，不因孔轴朝Z被当成端面。三角切分内部线不重新加入。
- 虚拟盲孔/攻丝仍原64步射线凹腔、已知牙形展示边界；读取原Part配色，降低尖亮高光并增加柔和补光，工具纹按主函数的孔口屏幕导数过滤，避免在命中分支内求导。不表示已切宿主材料、精确螺纹、穿孔碰撞或制造公差。目录中原中性Lambert技术预览转换保持；共享网格有平滑圆壁，但不承诺目录与工作台光照相同。
- Schema62/131模块0.75.66，无新模块/依赖或持久字段；59份已有verify只身份更新。按默认未新增/运行测试、语法检查、Java编译、启动/重启、HTTP或浏览器，资源阶段见VALIDATION；没有本轮Console/Network、实际图片或GPU/帧率证明。后续需先确认着色器编译/近远视角/已有孔和裁孔恢复、黑色/自定义配色、斜切/弧形/副本/影子/辅助标注与设备兼容，不能把源码当观感已达参考站。详细规则见reference/profile-aluminum-appearance-2026-10-11-v07566.md。

## v0.75.65 四边插槽尺寸与旧板预览适配

- 用户明确“板边插进四周T槽”，再确认实现。v64新水平板ON_FRAME是意图误解，已被新默认T_SLOT覆盖；旧ON_FRAME/INSET/v1保存板不在加载时自动移动。保留单框四/多根取外边、柱闭合和内部杆完整跨检查；门框仍旧resolve严格四边，承托走向/截面90°/默认670×610×2000不改。
- 新PanelSlotPlacement从canonical开放槽与实际截面外轮廓求每条向内槽，四槽中心世界平面需在0.0001mm内重合；板厚加0.1mm须可入槽，在整个厚度带用分段轮廓第一道材料壁计算槽深，再减0.1~20mm槽底余量。插入至少0.5mm，不能穿壁跳到内部孔；外尺寸=净框口+两侧插入，深浅不对称移动的是派生板中心而非型材。多槽仅从真实槽选最近框中面，同距低坐标；旧槽引用在回改中优先，显式重新适配重选。
- PanelDoorConfigurator新板先领域规划真实缺口/四边板料与实际全部可见实体相交，再一次创建；板角可按真实角部柱（同时贴合两条外边）与连接件板厚轮廓避让，内部柱/承托不自动切。PanelReliefManager抽取共用对象清单/轮廓扫描/碰撞计划，新板/旧板/参数回改不绕过统一材料轮廓；T_SLOT使用0.001mm数值穿透容差，不沿用0.5mm项目显示容差来掩盖槽口碰撞。未知/中央障碍/断板/整条插槽边切空拒绝。
- 旧板适配通过Manager.begin({fitSlots:true})：锁定/缩放/已有加工/安装守卫先检查，再生成副本；预览隐藏原显示但不写Project，取消恢复，参数变化/工程签名/fresh正式槽与轮廓检查后一次提交完整尺寸/姿态/元信息，失败恢复工程和历史。明确适配会重算旧缺口、法向偏移改0，旧零间隙至少0.1mm。普通裁角仍只改轮廓、不改变尺寸/位置。UI标题/外尺寸/确认文案区分适配与裁角，T_SLOT禁法向偏移；没有强制抬板兜底。
- Schema62可选openingVersion3/placementT_SLOT/slotFit.version1及四条edge/profileId/face/slotId/insertionMm；不存瞬时世界槽点/网格。完整业务子图复制重映射，单板/脱离宿主复制删全部插槽来源；整架计划/确认更新元信息、保留合法原缺口，真实型材相交拒绝，正式连接更新后再查实体与四边，失败还原历史/工程。轮廓与工程图/BOM/制造包继续现有统一链，没有新增制造认证。
- 0.75.65/131模块/Schema62，无新依赖；59份既有verify只身份同步，现有importmap生成器仅输出补丁。按规则未新增/运行测试、语法检查、Java编译、服务启动/重启、HTTP/浏览器，未读取/改写本轮用户JSON或实际Chrome/localStorage；资源阶段与授权后待验见VALIDATION。详见reference/panel-four-slot-fit-2026-10-11-v07565.md。v64梁顶缺省以下仅作历史说明。
- 适配额外保护当前有效几何约束、尺寸引用及板上已安装配件；须先处理关系，不绕过约束移动板。正式重建前同步旧显示root姿态，避免Editor先从旧root同步而把新槽位置覆盖；fresh几何事实若与预览不同也要求重新预览，不提交用户未见的新尺寸。

## v0.75.64 整层板、实际轮廓裁边与左右向承托

- 用户明确承托梁要从前后改为左右走向；不是截面quarterTurns。新增centerDirection=DEPTH/WIDTH，逐层空值继承，缺省仍DEPTH。UI上方全架选项和逐层覆盖分别调用原显式结构编辑，v3共用布局/预览/数量/层高/生成/回改；顶层整组方向随层数迁移。WIDTH按实际左右侧梁内面算净长、沿深度分布、梁顶齐平和双端宿主，CENTER键不变；往返方向重新指向侧梁或前后横梁，原纯自动重定向/手工与制造保护保持。
- FrameOpeningResolver新增resolvePanel，与门的resolve严格四边分开。使用业务尺寸和单位正缩放/世界正交本体包络，不算印字/标注/helper；4~64根同框选取外边，内部杆须完整覆盖净跨。水平按梁顶齐平、竖面按共同框面，角部实际接触或同一真实垂直柱桥接，跨层/斜切/重叠拼接/缺边拒绝。没有截图当前P-199~215的保存工程，不能宣称精确四根失败已实测。
- PanelDoorConfigurator共用panelOpeningLayout，新水平板ON_FRAME高度在梁顶+半厚，竖面INSET，用户可显式框内；净宽高减间隙仍原口径。先查板与实际型材穿透，再由原裁角预览处理连接件，承托不能被裁掉；panelSpec可选openingVersion=2/placement供refit和FrameParameterManager共用，旧板原resolve/位置不改。单独复制板解除完整v2宿主元信息，完整复制重映射引用；删选中内部承托仍受原引用保护。
- PanelReliefGeometry投影板厚内实体表面并用两侧截平面补外环，填连接件孔内孤岛，只取外部避让轮廓。新PanelContourMath二维分边/并/差/间隙扩张有限运算，不保存Three三角面；缺口outline为自身板边定位端u/v毫米点，bounds宽深向外0.1mm只是UI范围。最多32项/256点，中央障碍/材料分裂/切空/零宽/未闭合/过密拒绝。间隙0~20默认1mm，圆角为保守外切采样，并非B-Rep或精密刀补。
- PanelShapeModel共用实际减缺口轮廓，Primitive几何/拾取、PanelRelief碰撞、领域工程图和制造包读取同一事实；缺口CSV带实际局部点与“轮廓/矩形”标识，BOM区别轮廓件。既有矩形逻辑保持，仅明确“按连接件计算”再预览/确认才替换；原板尺寸/姿态、连接件、取消/fresh/一次历史/回滚保持。框口或参数回改保留合法边端轮廓，越界拒绝，用户原JSON/Chrome/localStorage不直接操作。
- 130个本地模块、Schema62、0.75.64无新依赖；importmap用现有补丁生成器，不手拼JSON。59份既有verify仅身份同步，按用户规则没有测试/语法检查/编译/启动/HTTP/浏览器；资源过程与待验在VALIDATION，详细规则在reference/whole-level-panel-contour-and-support-direction-2026-10-11-v07564.md。保留v63截面转动/安装面对应、v62外侧角、原默认/顶层/层高/底栏，不把本版当全接头/板材固定或承载认证。

## v0.75.63 横梁截面旋转与既有连接

- 用户确认横梁转90度也要支持。单根水平直型材 / SINGLE作用域 / 可变换 / 单位正缩放下，原旋转弹层提供“截面 +90°”，绕本件局部Z长轴，端点和中心不移动，3030换槽面、3060立平切换；原连续弹层和XYZ / 快捷键 / 作用域保持。显式截面转动被约束改成平移或其他角度时恢复快照并提示，不提交半成品连接 / 历史。
- 新ProfileRollConnection在明确旋转提交时对比临时旧 / 新世界矩阵，只接受同中心、同向水平长度轴、单位正缩放、整90°倍数。旧安装侧法向映射到新局部FRONT / BACK / LEFT / RIGHT，保持世界安装意图而非梁下件转到梁上；源 / 目标安装面、designAnchorOffset多槽偏置、SIDE_MOUNT接触 / 源槽 / OUTER_CORNER目标接触面、SIDE_SLOT双方槽偏置和记忆型号同源对应。
- 只有映射过的角码 / 90度件 / L型 / 隐藏角槽件与SIDE_SLOT原生两孔板自动对应，原ID / 型号 / 全部尺寸 / 源端与源站位 / 人工或自动状态不改。制造方案、抽象连接、未知件和遗留多侧合并记录不冒充完成新制造或重安装；不移动柱 / 邻梁或将单根改动反写同类部位参数。普通加载 / 移动 / 倾斜 / 整架转向不猜新的安装面。
- Editor Gizmo / XYZ快捷旋转和app右侧角度输入实际满足长轴整90°时共用；截面提交跳过会抢槽 / 移梁的自动位置吸附。相关连接先统一重建，再用原Placement对本件 / 实际新其他helper检查，只有本件忽略；孔轴 / 接触 / 开放槽 / 完整腿或槽腔 / 第三方及已有件空间仍严格。失败保留已对应的局部意图与编号，标INVALID / 去掉错误helper / 显示原因，不按SINGLE移动清理；原Editor提交一次历史 / 草稿，取消未对应，撤销按原快照。
- 原v62内收侧梁外侧方向、梁下角码、AUTO角码 / 隐藏件及承托面留平、六部位快搭朝向与v3槽对布局 / 默认 / 顶层 / 层高 / 连续底栏保持。原JSON / 用户Chrome / 实际localStorage不直接操作；Schema62无新增持久字段 / 依赖，129模块0.75.63，59份既有verify只身份同步。按规则未测试 / 语法校验 / 编译 / 启动 / HTTP / 浏览器，资源和待验见VALIDATION，细节见reference/beam-section-quarter-roll-2026-10-11-v07563.md。

## v0.75.62 内收侧梁外侧角，纠正正面替代

- 用户纠正v61生成在正面，目标是内收侧梁外面部分。只读原未命名工程.json仍为469867字节/2026-10-11 13:55:29/metadata0.75.60/Schema62，29型材/92关系/8组件；P-095长550、X=290，两柱P-080/081中心X=320/Z=±275。原JSON、实际草稿与用户Chrome未操作，保存有效状态不当运行证明。
- 正确直角是P-095 RIGHT(X=305)与P-080 BACK(Z=-245)/P-081 FRONT(Z=245)，交线A端站位30/520；该侧梁与柱内面的原30mm搭接提供边界，不是梁端0/550，也不把柱外面X=335当安装面。30角码原孔可分别落在梁侧槽和柱相邻槽，原梁下C079/C080的targetFace=LEFT/sourceMountFace=BACK仍独立保留。
- sideMountJoints复用原真实接触，枚举朝梁中段的开放柱面，mode=OUTER_CORNER / targetContactFace保存接触身份；源安装面取接触外侧，宽方向沿竖向、两腿水平。原生90度ANGLE_BRACKET/CORNER_CUBE/L_BRACKET适配，外侧不派生梁下的改孔/缩腿参考规格；未知、斜切/缩放、槽封闭、站位/孔轴/完整足迹/障碍不通过则不安装。
- Placement附近/Tab/右键及目录两点源可为实际侧面、梁柱顺序不限定；Batch按同一外侧方向键独立扫描，fresh重查站位、分帧/取消/一次历史/失败回滚保持。Manager安装/替换/重建共用，Schema62及variants区分原生外侧与v1梁下参考；镜像沿原sourceStationS反转，端占用与参数回改保护保留。制造入口继续拒绝误绑梁端方案。
- AUTO移除SIDE_SLOT额外正面板并恢复CORNER_CUBE/HIDDEN策略，每层承托面留平、完整安装面和原空间守卫不变；显式两孔一字板共面能力保留，已添加件不暗删。Schema62/128模块0.75.62，无新依赖；59份verify仅身份同步，未新增/运行测试、语法校验、Java编译、启动/重启、HTTP或浏览器验收。资源与待验见VALIDATION和reference/inset-side-beam-outer-corner-2026-10-11-v07562.md。

## v0.75.61 立柱侧槽共面连接板

> 本节是安装对象误解后的历史：用户目标为内收侧梁，不是正面P-092/P-093；AUTO加板现已撤回，不作需求基线。

- 用户明确要立柱侧槽面而非梁上方，并确认保留已有梁下角码、手动和一键补独立新件。只读最新未命名工程.json（469867字节/13:55:29/metadata0.75.60/Schema62）有29型材/92关系/8组件；12个SIDE_MOUNT梁下角码已保存有效，其中P-095→P-080/081为C079/C080。原工程/浏览器草稿不操作，保存有效不等于重建或本版运行证明。
- P-095是内收侧梁，可见面与柱错台30mm；合法共面位置实际为P-092/P-093宽向梁外侧与柱槽面。新增SIDE_SLOT+sideSlot(sourceFace/sourceSlotOffset/targetSlotOffset)，与普通梁端、SIDE_CORNER、SIDE_MOUNT分别去重，不覆盖原角码或错绑宿主。只适配两孔FLAT_PLATE、水平方切梁和竖直柱、单位缩放 / 同系列 / 开放槽，源梁端和双方孔心定位，完整半板支撑、0.15mm孔轴 / 0.1mm面差与第三方 / 原件空间继续严格检查。
- ConnectionComponentPorts.flatConnectionPlateLayout与原目录几何共用孔心/轮廓：30板60×21×3.6mm、两孔间30mm，40板同规则；不通过改孔或移动宿主凑连接。Placement附近/Tab/两点/右键、Batch独立分帧与fresh、Replacement / Manager加载重建共用同一定位。两点允许先柱后梁但只对已适配的一字板，不改变其他连接的原端部选择。
- AUTO仅SIDE_SLOT可选两孔一字板并限制不凸出当前层承托面，原端面/梁下仍普通角码或隐藏件；指定一字板类型只使用所选原型号，不静默换角码。新件独立记录/选择/修改/删除，一处侧槽只一块，不假报缺失第二侧；原端占用、普通两梁内角与参数回改不混入新关系。
- 完整子图复制自然保留局部引用；镜像原正缩放反射沿局部Z反转源端，X/Y槽偏移不变，重新匹配目标槽站位。Schema62校验sideSlot与variants、错误方式/混用定位/旧制造绑定拒绝；制造配置不复用四孔板规则，不是采购尺寸、加工或承载认证。原用户JSON、草稿、历史和已确认默认/层高/顶层/旋转/底栏不暗改。
- Schema62/128模块0.75.61，无新依赖；59份既有verify仅身份同步。按规则未新增/运行测试、语法校验、Java编译、启动/重启、HTTP或浏览器验收；资源复制不是新增数量/拾取/替换/复制镜像或性能通过，待验见VALIDATION，实际几何与边界见reference/column-side-slot-plate-2026-10-11-v07561.md。

## v0.75.60 直接查看每层高度

- 用户确认架外一列净高尺寸链、右侧离地/层间距/净高表。选中参数架中的任意型材即可在属性下直接读表，不必进入整架编辑；表单逐层补当前规划的梁间间距与净高。默认画布常驻1–2层/2–3层等文字及细线/箭头，顶层开放不画虚构上梁；毫米只取整显示，原尺寸不改。
- 新RackLayerMeasurements读取当前Part的领域姿态、截面和长度，只借原profileObb规范化展示副本，不改原模型；成员键只辨认层归属、不读旧生成高度作实际值。离地按世界Y=0、间距按相邻梁顶差、净高按本层最高支撑到上层最低界，矩形截面转90度、实际移动/回改与联排同源；已关联同层水平板计真实厚度，未关联/倾斜板和连接件凸出不假报已计。
- 侧链靠包络投影选择有空间的外侧，用固定缓冲/静止投影缓存与原占位避让；不占工作台行高、不拦截拾取或写语义尺寸。狭窄/近看出画布等不能容纳时保留右侧列表，不往模型中间塞标签。倾斜/缺失/弯杆拒绝自动完整层高，梁顶不齐/重叠及未映射杆明确提示；孤立旧组件不显示。
- 新showRackLayers展示偏好默认true，显示菜单与表内开关共用，Schema62加载副本补缺省、已有选择优先；没有改组合/解组、原几何/连接/参数回改守卫、顶层迁移或连续旋转。Schema62/127模块0.75.60无新依赖，59份已有verify仅机械身份同步，按规则未测试/语法校验/编译/启动/重启/HTTP或浏览器验收；资源与实际待验见VALIDATION及reference/rack-layer-measurements-2026-10-11-v07560.md。

## v0.75.59 增减层数保留顶层角色

- 用户两份工程实际现存成员分别29/34根，五层顶层FRAME/490mm；六层第5层FRAME/490mm、顶层INSET/550mm。默认目录/生成器并未写死5，错误来自表单只在末尾追加/截断，使默认顶层覆盖停留在旧索引。原文件只读、历史空组件不作为当前结构证据。
- syncDiyLayers只在真实层数变化且数组长度等于前层数时移动顶层整行，在顶层下方增减中间层；底层/保留中间行、手动左右接法/型号/承托数量保持，新中间行沿用默认。显式选预设/载入已存参数只补齐，不猜测/修正已有错误记录；原布局和Editor/Manager确认链不改。
- 原六层架修正：编辑整架尺寸与选配，在逐层设置把顶层左右改为“柱间（沿用框架接法）”、第5层左右改沿用默认，先预览后确认；若原手工连接/加工等拒绝回改，原保护仍生效，不通过后台挪杆解除。新的层数切换不再把顶层柱间留在第五层。
- Schema62/布局v3/126模块0.75.59，无新模块/依赖或持久字段，保留连续旋转/底栏与初始化修正。59份已有verify仅机械同步身份，按规则未新增/运行测试、语法校验、Java编译、启动/重启、HTTP或浏览器验收；源码/资源不是运行证明，见VALIDATION和reference/top-layer-settings-2026-10-11-v07559.md。

## v0.75.58 连续旋转交互修正（2026-10-11）

- 用户希望无需每转一次重新开弹层。此前存在两条收起路径：quickRotate再次setMode→cancelPlacementTools，以及通用handleCadMenuClick的click后收起。仅旋转弹层轴按钮请求keepMenuOpen：已在旋转模式且弹层打开时跳过重复切工具，仍调用原Editor事务；通用菜单点击处理排除footerRotateMenu，其他菜单照旧。
- XYZ轴点击后保留弹层与该按钮焦点，可连续同轴或跨轴操作；原生Enter/Space保留，避免临时框选截获。外部/再点入口/Esc/换工具/无选择/卸载继续关闭，Esc仅关闭不清选择；角度、world/local、中心/作用域、约束/锁定/安装/干涉及历史/草稿不改。
- 保持0.75.58/Schema62/126模块，无新模块/依赖或版本身份重写；只改app.js/模板及当前说明，用户工程/实际草稿不直接操作。未运行测试、语法校验、编译、启动/重启、HTTP或浏览器验收，资源和待验见VALIDATION。

## v0.75.58 旋转入口的三轴快捷弹层

- 用户要求选中组件后点旋转，上方直接显示XYZ快捷按钮。固定入口换为原生details summary，共用原transform-tool/primary-tool样式；有构件选择才展开X/Y/Z +90°，空选择仍可进入旋转工具但不弹空操作层。沿用原每次90度与Alt+X/Y/Z，R工具入口和已有更多/自适应快捷动作不删改。
- activateFooterRotation只切工具与允许原生展开，不自动旋转；轴按钮调用原quickRotate→Editor.rotateSelectionQuarterTurn。当前world/local轴、原多选主选中心/作用域、约束/安装/锁定及干涉、历史/工程提交保持，不另造旋转算法或更改组件成员选择。
- 沿用fixed菜单、滚动/视口变化重定位，旋转弹层单独居中锚在触发按钮上方并限于视口，不新增常驻行/底栏高度。按用户后续要求，轴按钮点击后保留展开和按钮焦点，其他菜单仍click后收起；再点入口/外部、切工具、空选择/卸载关闭，Esc仅关闭/返回入口焦点、不清空选中。
- Schema62/126模块0.75.58，无新模块/依赖。v57隐藏测量区保持在footer内且不接操作，v56importmap及selectedPart初始化顺序修复保留；身份同步含59份已有verify，不新增测试或修改测试逻辑。未运行测试、语法校验、Java编译、启动/重启、HTTP或浏览器验收，资源和实际待验见VALIDATION及reference/footer-rotation-shortcuts-2026-10-11-v07558.md。

## v0.75.57 底栏重复行热修复（2026-10-11）

- 截图上排是新增测量按钮，不是预期的第二行或真实更多菜单。测量区被放到footer结束标签后，未命中.workbench-footer范围内的隐藏、定位和按钮宽度规则，既意外浮在画布上又使宽度估算失真。
- 只移动footer结束标签，把测量区留在底栏内、滚动区之外；零占位/隐藏/不可交互和与真实按钮相同的CSS恢复作用，现有单行与溢出收纳逻辑不改。保留0.75.57/Schema62，不改模块映射、快捷键、工程、用户JSON或实际草稿。
- 按用户规则未测试、编译、启动/重启、HTTP或浏览器验收；资源复制记录见VALIDATION，需授权后确认重复行消失及实际宽度行为。此前零占位/隐藏表述为设计目的，不能视作首次交付的运行证明。

## v0.75.57 底栏按实际余量展开操作

- 用户确认有空间就展开、放不下才收纳。固定选择/绘制/移动/旋转和进行中工具的确认/取消；其余23项操作共用footerActions，常用剪贴板/删除/对齐/框选/组合优先，原镜像三轴、+90度三轴、标尺/永久标注/拉伸/隐藏/阵列/检查/轴方向完整保留。菜单仅剩未展开项，全容纳时隐藏更多入口。
- 原单行字号和高度保持；根据footerScroll实际宽度、固定部分、显示开关、gap/padding及更多入口计算，不按window断点误判。相同CSS的零占位aria-hidden/inert测量节点，ResizeObserver与rAF合并、Vue变更后再定位、卸载释放；极窄横向滚动，操作转移的键盘焦点保留。
- 原操作/快捷键/禁用/选中状态/tip共用，不直接移DOM或自动执行操作、不写Project/历史/草稿。v56合法importmap与selectedPart监听初始化顺序保留，无新模块/依赖，Schema62/126模块0.75.57。
- 按用户规则本轮未新增/运行测试、语法校验、Java编译、启动/重启、服务调用或浏览器验收；源码与资源复制不代表宽窄/面板/文字/工具/键盘焦点通过。v56的启动实测不能归为v57运行证据，资源与待验见VALIDATION和reference/footer-adaptive-actions-2026-10-11-v07557.md。

## v0.75.56 初始化热修复（2026-10-11）

- importmap 插入 SideMountConnection 时遗留额外 `{`，导致整张映射解析失败及 three bare specifier 错误。已修正入口JSON，129项映射保留原路径和版本。
- Console 复查另发现 selectedPart 尚未声明就被 immediate watch 读取；已把该监听器移到所依赖 computed 声明之后，不改变目录规格选择行为。
- 02:38:42（UTC+8）最后一次离线资源复制成功，HTML/app.js 源文件与运行目录一致，实际HTTP入口与源HTML一致。隔离 Chrome 刷新/无缓存冷启动及8秒后检查均正常：135项响应无HTTP错误或失败请求，Console/error/warning和pageerror为空，画布与工具入口出现；three/OrbitControls/app.js/SideMountConnection均成功加载。
- 没有操作用户当前 Chrome 草稿或原JSON，没有运行连接功能测试、Java编译或启动/重启服务。版本保持0.75.56/Schema62；以下原交付的未验声明不覆盖这次初始化检查，侧贴安装、完整回归、性能与制造依旧待验。

## v0.75.56 梁侧贴柱连接安装

- 用户圈出内收梁与立柱的侧贴位置并确认修改。只读桌面未命名工程 (1).json：381221字节/2026-10-11 01:56:32/metadata0.75.55/Schema62，29 PROFILE、80连接、1组件；P-012左侧X=-305与P-001右侧同面，Z搭接[-275,-245]，并非源端轴朝向目标面的END_TO_FACE。现有C001/C021等保留，原JSON与实际草稿未直接操作。
- 新SideMountConnection提供sideMountContacts/Contexts/Transform及参考规格，独立jointKind=SIDE_MOUNT、sideMount局部源接触面/A端站位/源槽偏移。Manager按真实侧面检查，不沿用错误端轴/full端面守卫，但系列、闭槽、逐孔0.15mm、完整腿支撑与第三方/原件包络仍检查。普通端占用和两梁内角不混入侧贴键；存储记录无世界姿态。
- 原角码横腿沿梁长，侧贴横腿改跨梁宽；30系列通用模型原孔差1.8mm/腿超出1.8mm，不能只平移孔轴或扩大支撑门槛。ANGLE_BRACKET/CORNER_CUBE/L_BRACKET显式派生depth/sourceHoleStation/targetHoleStation和sideMountGeometryVersion=1，几何与端口共用；标签注明梁侧安装参考，原目录定义/既有实体不改。多孔、过大或空间不足仍可拒绝，非采购尺寸/螺钉加工/承载认证。
- Placement附近/Tab/两点及右键候选传完整局部参考，Ghost/确认实际用同一派生规格。Batch新增独立侧贴扫描，按目标槽枚举真实梁长站位、每接触位置/安装侧占位；分帧、取消、快照、fresh重查、一次历史和失败回滚保持。AUTO只普通角码/隐藏件，下方角码合法优先、凸出当前承托面的角码仍拒绝，未映射槽内侧贴不伪生成。
- 单件替换仅开放已映射的三种侧贴模型，保存/加载和variants保留sideMount，重建使用原尺寸/站位不暗改。图复制保持局部引用，镜像反转站位；AutoConnectionResolver和参数回改排除SIDE_MOUNT端占用/旧端宿主重定向。新Schema62可选字段严格验收且不迁移/覆盖旧文件，制造入口拒绝误绑旧梁端方案。
- Schema62/126模块0.75.56，无新依赖；既有59份verify仅身份同步。未新增/运行测试、语法校验、Java编译、启动/重启、服务调用或浏览器验收，不声称已实测新增数量/实际拾取/性能。资源和待验见VALIDATION，细节见reference/beam-side-column-installation-2026-10-11-v07556.md。

## v0.75.55 用户五层架的完整默认配置

- 本轮用户说默认喜欢最新JSON的670/610/2000及各面横竖配置，替代上一版690/650/2000。只读桌面未命名工程.json：275861字节、2026-10-11 01:37:38、metadata0.75.53/Schema62、29型材/46关系/41组件；29实际Part均属5b66787f-d126-4a08-acf9-eda3a12c76c8，旧组件参数不作为当前样例。原文件与真实草稿/浏览器不操作。
- 当前参数v3、统一3030、外670×610×2000/5层/1承托/1格SHARED、顶底BETWEEN/离地0/自动层高；post3060 turn0，bottom3060 turn1，side/center继承，底层center明确3030；默认INSET而顶底左右覆盖FRAME。实际立柱2000，宽梁610，顶底侧梁490，中间侧梁550，底承托490/其余550；几何和参数吻合，不需要手工架反推迁移。
- DiyTemplateCatalog.createQuickFrameDefaults集中结构默认，四用途共享670×610×2000及样例部位/接法，各自2/0、4/1、5/1、2/1；新表单初始TURTLE_TANK_RACK。角色只预置post/bottom，app合并createRackRoleSettings的6空白项；默认选择3030及原单根选材不变。顶/底梁柱间、单格、层高自动等也由同一默认带入，不重复手写旧值。
- 元数据角色/逐层行冻结；app初始化和明确选预设structuredClone，逐层修改不污染其他预设，选择自定义保持当前值。明确选预设指定RACK_LAYOUT_VERSION并同步行；DiyGenerator带完整默认并按有效levels建立顶/底FRAME行，输入显式结构/逐层优先。表单手改层数继续原按行保留规则，不隐式重排用户逐层覆盖，可在逐层设置改新顶/中层。
- 不把createRackRoleSettings或旧布局的角色缺省变为3060，避免已存架漂移；v1/v2原尺寸缺省和实际保存参数保持，v3缺尺寸读新外尺寸。FrameParameterManager原自由编辑/手工/加工/制造守卫保持，实际孔槽/贴合/支撑/空腔/空间及同系列槽宽不放宽；其他系列需显式调整预置3060/底承托3030，不能静默跨系列安装。
- v54正面稍俯视、X宽横向、例子二次取景及本机镜头/明确视角保持；默认样式仅新建/选预设/示例，不导入或重建当前用户文件。Schema62/125模块0.75.55，无新依赖，59份已有verify仅身份同步，不新增测试或测试逻辑；未测试/语法校验/Java编译/启动/重启/服务调用/浏览器验收。资源与待验见VALIDATION，详见reference/preferred-frame-defaults-2026-10-11-v07555.md。

## v0.75.54 新快捷架默认尺寸与宽向正面

- 用户要求新建默认外尺寸690×650×2000mm，宽应为正面左右。DiyTemplateCatalog导出只读DEFAULT_FRAME_DIMENSIONS，四用途预设共用；app新建表单读取当前STORAGE_RACK预设，loadSample不再重复写1000mm等旧值，DiyGenerator仍按显式输入优先、缺省读预设。层数/承托数仍2/0、4/1、5/2、2/1，统一型材默认3030不变。
- LayeredRackModel的v3缺省尺寸读同一常量，v1的1000/600/1800及v2对应旧缺省保持；显式尺寸与旧保存参数不改。原v3实际槽对定位、3060平放、六部位、顶底搭接/侧梁/逐层和联排规则与FrameParameterManager自由编辑/手工/加工/制造守卫保持，没有新布局版本或历史Schema迁移。
- 源码原因是addLayeredRack生成完成总调用斜iso的fitView，并非宽深坐标交换。新v3传(0,1,1)上前方向；fitView/fitPrimaryView接受方向参数，iso保留原向量长度补偿，向量/标准方向用真实拟合距离。仍按主体/全体包围球、较小视场角和正交缩放取景，X相机偏移为0，不旋转宿主/组件或写入视角到Project。
- loadSample最后fitPrimaryView也明确上前，避免第二次适配回到斜iso。其他无参数适配、三维home、26视角及导入/本机镜头恢复保持；默认值不自动调整当前架或用户最后镜头。右侧只补外尺寸方向一句说明，参数预设标签改为“只填参数”，不加画布文字。
- Schema62/125模块0.75.54，无新依赖；59份既有verify只版本身份同步，不改测试逻辑。按用户规则未新增/运行测试、语法校验、Java编译、启动/重启、服务调用或浏览器验收；旧源码提取式fitView()校验尚待授权适配可选参数签名，资源与待验见VALIDATION及reference/frame-defaults-front-view-2026-10-11-v07554.md。原JSON/实际草稿/用户浏览器没有直接操作。

## v0.75.53 3060 平放梁快捷搭建

- 用户确认底部3060平放及快捷搭建支持；只读桌面未命名工程.json（160260字节、2026-10-11 00:32:19本机修改时间）：0.75.51/Schema62，19根型材/19关系/32组件，实际成员归bd35c8b2-a0e3-41b2-8882-e96c7dfc2118。底宽梁610mm、侧梁530mm为3060平放，承托3030/530mm，约Y15且顶面30；保存bottom.quarterTurns=0未随手工几何更新。原文件、实际localStorage和用户浏览器不直接操作。
- 工作期间原文件由外部再次保存：2026-10-11 01:18:19、160256字节、metadata0.75.52。只读复核19型材/19关系、同一有效组件、顶底/侧接法及P-100～104关键尺寸/姿态与上述平放证据一致，保存参数仍quarterTurns=0；这不是智能体写文件或运行浏览器验收。
- RACK_LAYOUT_VERSION=3；LayeredRackModel仍分别解释旧v1/v2，不按新算法重新解读原参数。v3 rackLane枚举开放面实际相对槽，按X向/Z向及矩形turn映射槽偏移，中心=目标槽-源槽，优先外缘齐平；梁较柱面宽时只向框内延伸，匹配槽须在双方接触交叠范围。不补虚构中槽，旧v2完整端截面lane原样保留。
- 层顶面及真实厚度/宽度继续计算宽梁、柱间/内收侧梁与承托净长；新布局前后梁无净深拒绝，侧梁/承托互叠及INSET完整支撑保护保持。共享/独立联排继续实际成员计数和原键；新stacked侧梁中心取前后梁内面中点，不改变旧v2保存布局。
- DiyGenerator新生成统一v3；app的diyLayoutInput令新建表单数量/错误/自动层高与生成器一致，编辑旧架则读其原版本，diyStructureEdited显式转v3。FrameParameterManager原共用布局、成员ID/颜色、预览/签名/确认/回滚与自由编辑/加工/手工制造等守卫不改；原手改底架不能按旧参数覆盖。
- 朝向选项按真实截面显示立放/平放及宽×高，立柱显示宽×深；侧/承托继承时显示跟随层梁。仅朝向列改120px，同系列/槽宽、3030和高级折叠不变。用户底层可3060平放并单独设3030承托，不能据此宣称所有采购规格安装认证。
- 自动关系及一键实体仍分开；宽梁的槽对布局不跳过抽象关系完整端面或实际组件的孔槽/0.1mm贴合/足迹/空腔/第三方守卫。部分端面仅局部搭接时可能不生成抽象关系，真实角码需原目录安装重查，不假报全接头成功。
- Schema62/125模块0.75.53，无新模块/依赖；页面/importmap/pom/样例与59份既有verify只身份同步，无新增测试或测试逻辑。按用户规则未测试/语法校验/编译/启动/重启或浏览器验收，实例数字为原文件及公式分析，不是运行证明；资源与待验见VALIDATION，详见reference/flat-rack-beam-layout-2026-10-11-v07553.md。

## v0.75.52 具体目录连接件更换与板材避让

- 用户两张截图指出已安装接头可换90度直角件等，板材角与连接件冲突应裁角；确认实施。没有本次截图对应的最新保存工程，不能给出其实际漏件/冲突数量或运行成功结论；没有改写桌面JSON、真实localStorage或操作用户浏览器。
- ConnectionManager.getCatalogSwitchChoices读取ConnectionComponentOptions及connectionSpecs/component，按源型材系列与已有connectionDesignType过滤；类型与规格不再混成5种抽象方式，真实90度件/L槽条/角码/加强角码/板件/角槽件进入选择。END/ANCHOR仍独立标为设计方式，复杂未映射件不新增安装或制造承诺。
- ConnectionReplacementManager保存工程签名，选型调用designSwitchCandidate及原evaluateCandidate，createDesignHelper的preview入口共用正式姿态/几何，只隐藏当前helper且不注册/改关系。类型/规格变化清旧预览再检查，confirm fresh检查并经switchDesignType重建/原记录回滚，成功一次历史/草稿；制造配置先解除、原局部锚点及兄弟件占位保持。
- PanelReliefManager的原板/预览资源独立，begin拒绝锁定/安装保护或已有加工；scan取可见目录/真实派生实体与板厚的真实三角表面交线投影，边角按间隙生成矩形缺口，中央障碍不伪造裁角。已保存缺口先原样预览，只有显式“按连接件计算”才重算；手改边、定位端、宽/深/离端与间隙需要更新预览，取消/Esc不改原轮廓。
- edgeNotches归dimensions，以LEFT/RIGHT/TOP/BOTTOM、START/END及offsetMm/widthMm/depthMm保存；不是世界位置/mesh/连接缓存。PanelShapeModel矩形网格并集提取唯一材料外轮廓，非法/分裂拒绝；Component/Primitive工厂、ProjectSchema62加载及FactoryValidator、EngineeringDrawingModel共用。板边端定位随尺寸/姿态而变，框口refit及FrameParameterManager更新shapeParameters且保留缺口，非法缩小拒绝；门组件重建不得覆盖已有裁角门芯板。
- PanelReliefGeometry以局部XY/Z厚度三角棱柱和实际实体网格细化板材干涉；InterferenceFeedback及ConnectionPlacement宽阶段重叠后共用，未适配仍保守处理。只减少已裁空处的包络误报，仍有材料穿透不能confirm；签名变化拒绝旧预览，确认一次历史/提交且异常还原领域图/历史，原件高亮不叠预览。
- FactoryPackage新增“板材切割轮廓.json”（局部XY、mm、厚度、材料环与缺口）和“板材缺口.csv”；SVG/DXF沿领域rings而不是Scene，材料/子装配BOM按缺口区分。没有CNC/刀路/采购公差/承载认证，正式制造门禁保持，预览不出BOM或持久数据。
- 新增3个本地模块，Schema62/125模块0.75.52，页面/importmap/pom/样例及59份已有verify仅身份同步；无新依赖。按用户规则未新增/运行测试、语法校验、编译、启动/重启或浏览器验收，资源与待验见VALIDATION，详情见reference/connector-replacement-panel-relief-2026-10-11-v07552.md。

## v0.75.51 侧梁接法与逐层左右选配

- 用户确认530mm左侧梁实例；只读桌面未命名工程.json，0.75.50/Schema62、19根型材/25关系。P-531第2层左侧3030、X=-290、530mm，由默认X=-320/470mm向内调整；两端几何接前后横梁，仅一端DRAG关系保存。原文件及实际浏览器草稿不改写或自动导入。
- LayeredRackModel.RackSideMountOptions统一FRAME / INSET，v2 parameters.sideMount缺省FRAME、各levelSettings.leftSideMount/rightSideMount缺省空继承。新字段不加历史Schema迁移；旧v1布局不受影响，v2缺字段原位置净长保持。内收X从柱内面加侧梁半宽、Z从前后梁内面中点，净长从内面距离；层上表面齐平，完整支撑/侧梁互叠/承托重叠守卫保持。
- 联排左右按每格定义；共享中柱FRAME按原DEPTH成员键去重，INSET中柱方向分键各格独立，外侧/独立柱成员键不变。实际成员及roleCounts决定数量，旧默认列位置/顶底自然搭接保持，不自动移动承托梁或原自由编辑结果。
- sideJoints是只读派生布局，不进Project参数或持久连接；rackSideJointPlan映射memberIds供DiyGenerator与FrameParameterManager使用。AutoConnectionResolver仅对这些源端限于预期宿主，分别加入真实零移动候选；profileEndContact完整端面和recommendDesignFor孔槽继续检查，实际关系由Manager创建。未适配不能以参数证明可装，框架提示未连接数量，连接件简洁生成入口不变。
- 参数回改计划携带同一接头规划，确认移除受显式改接法影响的纯自动旧宿主后更新/重查；未变编号颜色、加工/自由/手工制造/约束引用保护、预览→一次历史草稿及失败回滚保持。已手移P-531的原架仍受自由编辑守卫，不推断或暗改参数。
- Schema62/122模块0.75.51，无新依赖，59份已有verify仅机械版本同步；未新增/运行测试、语法校验、Java编译、启动/重启或浏览器验收。资源与待验见VALIDATION，细节见reference/side-beam-mount-options-2026-10-11-v07551.md。

## v0.75.50 Shift 追加拖框与构件剪贴板

- SelectionGestureManager在普通选择/移动/旋转时优先捕获Shift左键，从构件或空白起拖均复用SceneManager.begin/update/endMarquee及Editor.marqueeHandler；小于6px按原点击，按下时修饰键传至松手，左→右包含/右→左相交和追加去重不变。临时禁用TransformControls/Orbit，不创建构件或历史；完成/取消/失焦/丢捕获恢复，Space释放先于鼠标时只恢复其原模式，不关闭原显式框选。轮廓编辑/绘制/放置/测量等独占工具不接管。
- Editor剪贴板是不可随原件变化的领域快照，selectionClipboard/clipboardPasteIndex/onClipboardChanged不导出。captureSelectionGraph保留所选真实Part、完整组件与内部连接/约束；insertSelectionGraph供原拖拽/阵列和剪贴板共用，复制ID、手工孔/孔组/阵列、组件层级/生成器成员映射；新制造编号归IdentityManager。连接派生数据重建，不重复复制或带入外部宿主。剪贴板尺寸仅选域内Part/手工孔语义引用，无外部WORLD锚点；正常阵列/镜像不新增尺寸复制规则。
- V从快照插入，世界X/Z各50mm×粘贴次数；只保留正确范围内安装引用，轮廓参数点及尺寸start/end缓存平移。复制后原件编辑/删除不重新取原数据；当前截面源变化拒绝旧快照，不偷偷加载/覆盖截面。clear(true)/loadProject成功清剪贴板，restoreProject/撤销保留；当前页面内存不支持跨应用/刷新持久粘贴。
- X先校验完整选择：有效锁定拒绝，非派生安装Part必须连同宿主一起选或先解除安装；随后原deleteSelected的连接/约束/派生清理链执行，清已删Part/加工尺寸引用与选域完整组件。没有选择派生连接时的暗选宿主或自由件克隆。commitSelectionGraphPaste一次历史/工程提交，异常还原领域图/历史游标/选择；selectionGraphMutation在图构造和派生重建中延迟emitProjectChanged，避免本机草稿收到半批副本。
- app键盘保留表单文字C/V/X、普通X解组、Ctrl+D直接复制；Ctrl/Meta+C/V/X不重复触发、不处理IME组合或Alt变体，模态/工程报表/独占工具和未完成手势隔离。clipboardCount驱动菜单禁用，顶部编辑/底部更多/主体与空白右键/帮助/底栏tip同步；主复制按钮改为先复制，粘贴仍显式操作。
- Schema62/122模块0.75.50，无新依赖；59份已有verify仅机械身份同步，未新增/运行测试、语法校验、编译、启动/重启或浏览器验收，原用户文件/实际草稿不操作。资源和待验见VALIDATION，确认规则与未覆盖边界见reference/selection-clipboard-shortcuts-2026-10-10-v07550.md。

## v0.75.49 多槽搭接补件与结构部位选配

- ConnectionAnchor是纯局部定位模型：normalize/key/same及由第一实际组件孔和源开放槽推导X/Y横移；只沿所选安装面横向，不能法向移动。ConnectionManager保存designAnchorOffset，recommend/matchComponentPorts/resolveDesignComponentTransform/rebuild和designComponentVariants共用；缺失=零，非法/越界/未映射方式拒绝，偏置禁止套中心正式制造方案。ProjectSchema62增可选字段检查，不迁移历史Schema，不操作原JSON/实际localStorage。
- Placement.resolveJointContact按端轴相对的目标面法向解析接触，避免柱顶/端角最近面等距误选；anchorContexts显式逐槽，direct/两点预览、Tab、确认使用同一锚点。Batch保留Snap候选，额外读取ProfileEndContact已贴合端面作零移动候选，按源ID/end/目标ID/face分组而非整对/整端占用；SIDE_CORNER沿原物理角点去重。完整组件孔轴、槽位/站位、腿足迹、真实贴合及第三方包络仍是最终门槛。
- Batch同接头已有手工设计实体可保留并补独立合法缺侧，不重选/修改旧件；默认最多两件，相反侧优先，其余方向须端口/足迹/包络合法。确认逐件fresh重查显式偏置和AUTO留平，不使用扫描缓存作为合法性；取消不写工程，异常原图回滚，一次历史。真正10mm偏槽的P-099等不补假件、不挪梁。界面仍类型/可选规格→生成，不恢复细节清单。
- LayeredRackModel保留无layoutVersion的旧布局，v2共用parameters/members/roleCounts/layerHeights：profileRoles六角色catalogId/quarterTurns，topMount/bottomMount/bottomClearance，levelSettings高度/宽向型号/承托型号与根数及bayCount/bayMode。实际矩形朝向、每层顶面与立柱开放对面槽求坐标/净长；相同系列槽宽、足够支撑、层序/净长/重叠检查；柱顶/柱下同厚，柱下从地面起。SHARED为N+1组前后柱和共用侧梁，INDEPENDENT为每格四柱及独立侧梁，顶部/底部搭接在共用模式下用整排连续宽梁。
- app三组details默认折叠，基础3030/用途预设保留，数量读真实成员；层高以梁上表面距地，首次改单层自动改成手动层高，未改层沿当前等分值填入。旧参数框架基本改尺寸保持v1，显式高级选配切v2；不能推测自由搭架角色。FrameParameterManager同型号副本预览/提交、未增删ID/颜色保留，已制造材料换型/移除及原人工/加工/约束/引用保护保持；DiyGenerator/Editor新建和回改异常回滚，成功一次历史。
- 122本地JS模块0.75.49，新增ConnectionAnchor须由index importmap统一版本。59份已有verify只机械身份同步，无新依赖；未新增/运行测试、语法校验、编译、启动/重启或浏览器验收。资源复制及待验见VALIDATION，用户原文件证据和限制见reference/frame-role-and-slot-installation-2026-10-10-v07549.md。

## v0.75.48 孔位贴字与孔口箭头关联

- ProfileSurfaceNumber在原孔字材料带候选内同时规划短直线/单折线，文字边缘到原孔口半径的小箭头；当前同位置关联复合孔入口仍一份合并文字，出口沿通孔实际径。原A/B基准、整毫米站位和精确Φ/M文字、常驻型号三字段与字号不变。
- 路线最长45mm，字/线/箭头避开同面已有印字、其他孔及已放引线；全文→短基准距离→无可用材料/路线时右侧与悬停查看。没有路线时不放无法对应的孤立文字；有限局部排布不是任意密集场景自动布线，也不保证全孔全视角可读。
- numberPatches保存只读leaderPaths和holeLink；细笔画三角形追加到同一stamp，stampGuide区分印字/常驻线箭头/悬停孔缘，材质uniform只改变对应色，不重造纹理或放大。文字仍真实材料三角面，笔画在孔口局部平面稍退让，明确是深度受限注释而非补槽/封孔或制造实体；raycast为空，不进入业务包围盒、BOM/工程图/碰撞。
- orient复用原相机正读与遮挡链，同时检查文字和目标孔口；缓存当前实际可见的文字四边形/孔缘投影。SceneAnnotationManager沿原画布pointer跟踪，只在当前可见投影内匹配文字或孔口，再核对指针处前方Part/helper；仅最接近一组变橙，清pointer/工具放置/拖动/隐藏/重建/删除清理。镜头/视口/遮挡/指针未变复用结果，不逐帧重建几何或反复场景射线。
- 无新显示开关，原showMachiningSurface与完整线互斥保持；Project/Schema62/加工/驱动/导出/历史不改，原JSON/实际localStorage不操作。121模块0.75.48及既有verify身份同步，无新依赖；未新增/运行测试、语法校验、编译、启动/重启或浏览器验收，资源复制与待验记录在VALIDATION。

## v0.75.47 孔位印字与完整线按需查看

- ProfileSurfaceNumber仍为编号/型号/长度单行真实印字，名义字高3→4mm，选中/悬停不放大；孔旁新增原S/基准和Φ/M表面文字，位置到整毫米，孔径/螺纹保持原精确规格。关联同位置复合孔合并入口，通孔出口独立Φ径，端孔标A/B端；路径归一只处理展示副本，不为印字改Part。
- 孔文字在当前实体三角面上用孔口局部标架搜索完整材料足迹，不用平板/DOM/Sprite，不跨槽和孔。全部孔口、同面其他贴字及当前型号贴字保留间距；全文失败再尝试短基准距离，仍无完整材料面则不印，悬停和右侧保留。端面/弧形/斜切仅实际同平面材料支持才印，不在错误位置用中段面兜底。
- showMachiningSurface默认true；顶部/底部显示与场景标注提供“孔位表面信息”和“完整孔位尺寸线”，互斥。完整线才显示自动和MACHINING_STATION/OFFSET驱动线与孔径引线，切换只改变显示，不删Dimension/绑定或修改驱动值/手工位置，其他永久标注仍原规则。显式新建S/偏移/基准链自动进入完整线。
- ProjectSchema当前62加载副本若无新表面开关首次以贴面替代旧浮动线；有新字段后保存/刷新尊重选择，不升级Schema或触碰用户原JSON/实际草稿。显示偏好沿既有editorState.annotations导出/草稿链，显示几何/纹理/占位不保存。
- 型号和孔字共用stamp纹理/世界尺寸/180度翻正/实际遮挡资源链，当前Part和连接helper遮挡，几何/内容/其他印字足迹变化才重建孔文字；关闭/隐藏/删孔/删除/卸载释放，不参与拾取/业务包围盒。Schema62/121模块0.75.47，无新依赖；未新增/运行测试、语法校验、编译、启动/重启或浏览器验收，不以源码缓存证明帧率或全视角效果，交付与待验见VALIDATION。

## v0.75.46 孔位距离按整毫米展示

- 图中距A端S和横向偏移不再直接v-model原始浮点值，改为machiningMmText整毫米格式；端面X/Y偏移同规则。一个Vue本地草稿保留编辑中输入，选中孔项/字段/Part/原值守卫拒绝过期覆盖，空值和非有限数字不写入；原生change才调用原machiningChanged/Manager/历史，不把聚焦/失焦当实际修改。切换选择、删除/替换孔数组时清理草稿；用户明确输入的小数仍保留实际加工值，失焦恢复整毫米显示。
- MachiningPlacementManager放置HUD、SceneAnnotationManager自动站位及MACHINING_STATION/OFFSET默认文本同步整毫米；只改派生文本，不改站位/偏移/基准/驱动值/几何/工程图或制造。孔径、沉头大径、深度、角度、螺纹规格、用户自定义尺寸文字和其他表面印字不强制取整，前版完整线错层/小孔径继续。
- Schema62/121模块0.75.46，无新依赖；同步ProjectSchema.CURRENT_APP_VERSION（此前仍0.75.43）、页面缓存/资源/样例与已有verify身份，不改测试逻辑。原JSON/实际草稿不直接操作；未新增/运行测试、语法校验、编译、启动/重启或浏览器验收，资源与待验见VALIDATION。

## v0.75.45 加工距离线错层与孔径可读

- SceneAnnotationManager将自动孔位及未手工移动整线的MACHINING_STATION/OFFSET显示接入machiningLaneGroups。按型材/测量方向排序，各线独立屏幕档位，实际主体包络决定外侧位置、文字宽高决定间隔；投影反算仅生成展示顶点。标签碰撞使用未占档位同时移动整条线/小箭头/引出线，数字不再单独漂到另一条线附近。
- station/A-B基准/offset及驱动值保持原事实源；直型材站位引出线指实际孔所在面，弧形保留原路径示意。自动与已有同基准站位驱动重复只略去自动显示，实体尺寸不删除；已有手工整线位置不重排，手工文字用短引线关联。Shift拖动自动显示时从当前显示中点转换到原offsetWorld链，仍原历史/提交规则，普通相机转动不写工程。
- 原孔小悬停继续；只在孔位尺寸显示或该孔有可见MACHINING驱动时增加10px紧凑孔径。通孔/盲孔Φ、已关联沉头/沉孔大小径合并、攻丝原M规格，未知径/螺纹不猜，源尺寸可保留三位小数；端面复合只保留当前实际面的一份关联说明，背面通孔显示其实际通孔径。
- 短引线从孔口投影引出，文字避让并限制完整画布空间；正交/透视均检查面朝向与全部可见Part/设计helper遮挡，不受选择过滤影响。过密未放下的小孔径回退原悬停，不修改型材常驻表面信息或实际孔几何，也不宣称全视角永不遮挡。
- 新固定线缓冲随顶点Float32变化才上传；相机/投影/视口/实体矩阵、几何版本/可见性快照变化才清孔口遮挡缓存，静止不逐孔重复全场射线。缓存/记录/线材质/DOM由clearGraphics/dispose释放，不新增Project/Part字段或依赖。
- Schema62/121模块0.75.45；原用户JSON和实际草稿不直接操作，已有verify仅身份同步，未新增/运行测试、语法校验、编译、启动/重启或浏览器验收，资源交付与待验见VALIDATION。既有真孔口/端孔定位、选择、连接/制造、印字和本机续作规则保持。

## v0.75.44 端面原有圆孔可定位攻丝

- machiningEndBores读取当前实际截面holes，按全轮廓近圆拟合/完整同向周向检查返回只读孔心与孔口多边形；拒绝矩形、T槽、局部圆弧及不完整近圆轮廓。以截面对象WeakMap缓存，不用目录单元中心猜已有孔，不把缓存/孔心写入Part。
- MachiningPlacementManager的端孔入口先取得所有可见Part/设计helper的前方网格射线，再在方切直型材朝向相机的A/B端面解析实际孔口。整个孔内可定位到该孔心，孔外仅2mm且8 CSS px内辅助；Alt原位自由偏移，其他端面铝材仍整体/单元中心辅助。深处孔壁/近端侧壁不再通过34mm热区假冒端盖，普通选取和侧面加工不变。
- 指针不能穿过前方板材/连接件去选背后端孔，选择过滤不移除遮挡物；没有新增隐形Scene网格。预览与确认共用原machiningLocalPose，写原end/offsetX/offsetY，经Manager/历史/emitProjectChanged续作；小十字、原孔提示和毫米偏移只属当前预览。既有孔/中心攻丝、螺纹规格/深度、派生加工不自动迁移或重置。
- 新圆孔目标仅直型材方切端面；弧形、斜切、非圆/未知空腔不生成轴向圆盘目标。孔形识别是显示截面近似，不是螺纹制造适配或实体B-Rep证明，原虚拟攻丝牙形及制造规则不改变。
- Schema62/121模块0.75.44，无新依赖；原用户文件/实际localStorage不直接操作，已有verify仅身份同步，不新增/运行测试、语法校验、编译、启动/重启或浏览器验收。资源与待验见VALIDATION，原因/边界见reference/end-bore-targeting-2026-10-10-v07544.md；v0.75.43世界轴绘制/端面贴合/孔边/相机等保持。

## v0.75.43 基础搭建与加工观感修正

- ThroughHoleGeometry不再从裁后三角网格猜边界。cutEdgeGeometry裁剪原EdgesGeometry轮廓，并添加原材料面与有限孔体的真实交线；重叠孔裁掉已处于其他孔体内部的边线。孔壁、原几何uuid缓存/释放、改孔/删孔恢复保持，不改B-Rep或包络碰撞。
- machiningCenterOffsets从目录显式单元槽位置加整体0生成辅助参考，不视为开放槽合法性。MachiningPlacementManager仅8px/2mm内提示，Alt绕过；3060长边-15/0/+15（从边15/30/45），端面Cartesian参考及自由X/Y共用machiningLocalPose。仅当前中心显示小十字，圆孔长度位置仍点击决定、SLOT不锁，已有/显式/派生加工不重置；API未指定偏移仍原默认。
- ProfileDrawTool.requiresOrthogonal控制FREE默认世界轴、数字输入和特征接受；直接命中/近点不能绕过轴线，仅1e-6mm浮点误差可接受。候选复制保留axis/Alt/Shift，Tab与显式轴锁保持，明确Alt/关闭正交可斜向。draftContactError只读临时Object3D检查端面，未贴平是中性定位而不是绿色成功；允许保留自由绘制目标，自动连接仍拒绝不合法几何。
- 新ProfileEndContact从实际截面outer、端斜切和世界矩阵计算法向、所有端面点的最大间隙及目标范围。Snap候选排序、显式贴合、松手/切换和约束后isContactValid共用；ConnectionManager设计推荐/重建也要求0.1mm真实贴平。组件端口合法后仍由完整两腿footprint保证SIDE_CORNER支撑，其他孔槽/第三方空间门槛不改，正式制造配置原规则保留。
- 用户原鱼缸架P-091端差Y约11.7836mm/Z约1.6162mm，角误差约1.12°；旧中心间隙/6°抽象容差误报C003/C004为DESIGN_VALID。现在重建标失效但保留原关系/编号与主体位置，不直接编辑用户原JSON/实际草稿；其他真实贴平30角码仍走原目录端口/足迹检查，不将3060整体判成不支持。
- SceneManager每帧只读已有实体包围盒，按相机深度带余量收紧裁剪，排除无限地面/反馈/印字；不逐帧扫描顶点。perspective近看0.05mm、minDistance1、zoomToCursor等保持，正交范围也跟实体；ProfileGeometryFactory金属面polygonOffset(1,1)，Orbit不带松手惯性。仍有实际渲染/多孔CPU预算/密集框架观感未验收，不冒充性能优化实测结果。
- Schema62/121模块0.75.43；身份/样例/旧verify仅机械版本同步，无新依赖/测试或测试逻辑改写。按用户规则未运行语法校验、Java编译、服务启动/重启或浏览器验收，资源交付与授权后待验见VALIDATION。原表面信息、两侧收起、选择、连接单件、AUTO留平、草稿与镜头续作保持。

以下v0.75.42点击强制居中和从裁后网格重算CAD边线为历史，已由本版覆盖；显示通孔和API默认边界保持。

## v0.75.42 新孔横向居中，直型材通孔切开显示

- centeredHoleOffset复用getSlotDefinitionsForFace（真实型号/封槽判定），无槽取0、多槽取指针最近偏移。MachiningPlacementManager用侧面解析而非端点优先解析，保留stationS点击站位，圆孔预览使用machiningLocalPose居中后的位置；端孔预览尊重实际A/B中心。SLOT不改自由位置。
- Manager.add只为无显式offset、非连接派生的新圆孔填中心默认；普通API默认offset不再提前硬写0，使多槽可取真实槽。明确给定0或其他偏移/引用不改，加载与刷新已有加工不再居中。默认保留原A端长度基准、不新增永久槽约束；右侧标“横向偏移”，仍可人工输入，已有SLOT_CENTER的显式基准守卫不改变。
- ThroughHoleGeometry在原直型材未加工网格上逐三角面减去有限凸40面孔体，位置/轴/半径来自原加工和machiningLocalPose；端面外延仅显示裁剪余量0.02mm，原径/尺寸不回写。有效同心通孔+沉头分锥段/孔段，沉孔分宽段/窄段与台阶，同组不重复盖虚拟孔口。
- 实际孔壁面先裁入截面outer/holes的材料三角棱柱，再按端斜切范围及其他孔体裁剪；不把整根圆管塞进既有T槽/中心空腔。孔壁归__machining__派生显示，保留真实网格深度、阴影、正常宿主拾取，没有新增Part或BOM；原主体渲染法线、UV和颜色沿裁剪插值，CAD边线重算。
- originalGeometries按uuid兼容Vue代理和原Three对象，生成网格dispose清缓存并释放其未加工副本；刷新从副本重算而不是重复扩大孔，移除最后一孔恢复原网格。源几何不写userData/Project，其他域的制造/约束/保守包络碰撞不改；选中/齐平/印字自动取裁后实际材料面。
- 当前仅直型材、有效同心复合孔。弧形和未适配/非法复合参数继续原孔位示意，openMachiningHoleIds是临时显示状态，悬停明确“孔位示意”；攻丝/盲孔/独立沉头仍原虚拟凹腔，不假装全类实体加工或精确B-Rep/孔内碰撞支持。
- Schema62/120模块0.75.42，无新依赖；旧59份verify只同步版本，未新增/运行测试、语法校验、编译、启动/重启或浏览器验收。用户原JSON/实际草稿不操作；三角裁剪/孔壁/重建/代理释放/性能等授权后待验见VALIDATION。

以下v0.75.41通孔虚拟腔描述对已适配直型材由本版可视开口覆盖；其他外观与两侧收起继续保持。

## v0.75.41 加工孔型外观与左右收起

- 新MachiningHoleAppearance只读提取孔型/直径/深度/孔组和螺纹规格。MachiningManager入口仍复用machiningLocalPose的stationS/face/offset、端面及弯曲标架，出口继续单独画通孔，关联沉头/沉孔接管入口，不叠两张圆片。
- Shader在孔口圆面内按局部相机视线描绘负Z虚拟腔，64步有限深度查找和5次细化，锥面/直壁/沉孔台阶/盲孔底面各异；攻丝同时按圆周角和深度生成右旋牙形，不用多层平环。深暗空腔与金属光照随视角变化，正交使用平行射线。未知螺距/不适配底孔不画已配置牙；单独沉头不发明关联小孔。
- 这是展示近似，不改宿主网格、孔内真实GPU深度、阴影、碰撞、截面空腔、加工参数或制造模型，不能从黑孔/牙形判定通孔真正透视或精确公差。已知M2至M16粗牙子集来源为官方公开参考，优先已有显式pitch/threadPitch或MxP；展示估算不写回Part。
- 孔口Shader采用本地r155色彩/色调映射，renderOrder1600在透明反馈/印字后画，depthTest仍开启；raycast为空，原machiningGroup释放材质/几何。中文小tip只在原悬停范围出现，端攻丝明确A/B端及深度，无新增大标签。
- WorkbenchLayoutManager沿用aluminum-cad-workbench-layout-v1，仅增加collapsed.left/right；两个原生按钮在canvas-shell边缘，CSS实际收缩轨道，左右独立。表单保留挂载/当前模式，隐藏侧inert，用户再次展开继续原输入，布局重置恢复两侧；不取消绘制、放置或审阅，不写工程/历史/草稿。
- 显式资源/快捷面板/对齐/整架编辑/端点输入等命令展开必要侧；普通点选仍保留用户收起偏好。浮动隐藏面板不被零尺寸clamp改坐标，窗口resize和本管理器合成resize区分，避免自激循环；快捷键不越过按钮抢走箭头/确认。
- Schema62/119模块0.75.41，无依赖升级。只源码和参考阅读/编辑、资源复制，未新增/运行测试、语法校验、编译、启动/重启或浏览器验收；旧verify仅同步版本，圆片/圆环等旧期望待授权变更。实际Shader编译、视觉、性能、遮挡及伸缩/刷新/浮动/窄屏状态待验见VALIDATION。用户原JSON/实际草稿未直接操作。

## v0.75.40 内置角槽件的T形槽脚与朝向

- 用户对照安装图确认修正，公开原图TPEM/TPFT存于reference/raw/hidden-corner-2026-10-09-v07540，原文件不改；PDF首整页渲染阅读用于区分窄颈宽脚角槽件与端孔内置件，不复制厂商CAD网格/专有代码，也不据此推断编辑器内部算法。
- hiddenCornerDimensions/hiddenCornerLayout共用v2参数、两孔、凹T轮廓与三段支撑；ComponentGeometryFactory生成有孔窄颈、四片T脚翼、转角及两枚实际内六角凹口紧定螺钉。两面交线为安装原点，+Z横腿入源梁、+Y立腿沿目标槽，内沉方向分别-Y/-Z。螺钉属于原设计helper，不生成Hardware、宿主加工或BOM事实。
- 本地30/40槽8槽腔宽13.6mm，公开对应宽脚14.5/18mm不能直接适配；当前用宽脚13.2/颈7.6mm，30系列高31/总长38/深7.2mm，40系列高32/总长38/深8mm。孔站位及过渡均从同一布局计算，尺寸明确是本地设计适配，不是采购料号/承载认证，不修改全局DesignProfileSection。
- HiddenConnectionPlacement将实际凹T轮廓变换到各宿主截面，检查挤出两端、完整站位、材料岛与边界交叉；先要求槽向共轴，不用斜向投影冒充放得下。未知材料、封槽、斜切、缩放、非共轴槽、悬空仍拒绝，宿主排除第三方包络只发生在完整空腔检查通过之后。
- 手动有实体INTERNAL_CONNECTOR像角码一样枚举真实安装侧，候选仍共用resolveJointContact/ConnectionManager，Ghost与落位一致。目录、自动批量、切换型号、helper及随动都使用同一几何/孔槽布局；不移动宿主、不改AUTO每层留平与已有件保护规则。
- ProjectSchema在当前Schema62副本上精确匹配v0.75.39简化HIDDEN_CORNER全参数签名并更正为v2，也更正designComponentVariants；ID/编号、颜色、局部安装侧及其他件不改，不转换未知自定义模型或历史Schema。加载仍重新检查合法性，新尺寸装不下标失效，不承诺每个旧位置都能用新模型。用户原JSON和实际localStorage未直接写入。
- Schema62/118模块0.75.40，无新依赖。采购/真实紧固加工映射仍未完成，原端孔内置制造规则继续禁绑；简单类型/规格→生成、单件选择/编辑、一次历史/回滚、草稿/镜头保持。已有59份verify只机械同步身份，未新增/运行测试、语法校验、编译、服务启动/重启或浏览器验收；资源状态与授权后待验见VALIDATION。

以下v0.75.39的宽6薄板/立腿-Y形状为历史，v0.75.40已覆盖；AUTO选型策略仍保留。

## v0.75.39 每层承托面选型与槽内角槽件

- ConnectionAutoPolicy按当前两宿主水平梁实际上向侧面/高度判断，每层独立、不看镜头或整架最高点。普通角码包络高于承托面0.1mm即从AUTO排除，合法梁下角码优先；自动目录仅CORNER_CUBE/HIDDEN_CORNER，相反安装侧独立规划，可混合角码和隐藏件。指定目录类型不套AUTO策略。
- ComponentCatalog新增独立HIDDEN_CORNER（30/40系列槽8），原始ComponentCatalogData不改。ConnectionComponentPorts共用两腿/孔心/支撑区，ComponentGeometryFactory生成带通孔的内沉L型实体；不复用INNER_BRACKET长条或HardwareCatalog占位块。安装原点为两安装面交线，+Z进源梁、-Y进目标槽；宽6/厚4/退让2/腿长20或24mm均为本地参考参数，不是采购图纸尺寸。
- HiddenConnectionPlacement按getSectionDefinition的outer/holes检查完整腿区的材料归属、边界交叉及材料岛，并检查全部端范围和目标纵轴共线；槽匹配/孔轴继续共用SlotMatcher/Manager。封槽、未知空腔、斜切/缩放或站位悬空拒绝，不移动两宿主，贴合/第三方保守OBB不放宽。
- Batch旧未修改自动单侧可补不同型号的合法缺侧，原件保留；已有另一侧不重复生成。fresh确认重查策略和侧占用，分帧/签名/代次、取消、整批一次历史/失败整图恢复保持。手工/已改/实体/制造保护，不自动替换旧梁上角码或长条，不编辑用户JSON/直接修改实际草稿。
- 原INNER_BRACKET取消新直角安装映射，保留显式自由放置和当前Schema62旧记录/variants原模型；显式切到内置采用新合法槽内件。SIDE_CORNER仅实际端口/两腿槽腔通过时可为ANGLE或新隐藏件，仍无旧端面制造映射。新隐藏件getManufacturingOptions为空，configureManufacturingRule/Schema拒绝套旧圆柱内置/攻丝规则。
- 简单类型/规格→生成只短提示跳过，不新增技术列表。Schema62/118模块0.75.39，新增两个本地模块，无依赖升级；已有verify仅身份同步，旧AUTO/INNER等期望待授权更新，未新增/运行测试、编译、启动/重启或浏览器验收，资源与待验见VALIDATION。

## v0.75.38 双侧角码独立编辑与型号恢复

- 用户确认下侧角码应单独选中/修改/删除、上侧不动，切换回来仍为同型号真实角码。原v0.75.37选择关系而非单件的问题来自一条Connection的双侧helper；当前目录设计组件按安装侧保存独立Connection，各helper只有一件，原拾取/临时选择/详情/聚焦/删除和历史链复用，不伪造可自由移动Part。
- ConnectionManager.load在当前Schema62记录副本上将无正式制造方案的双側目录组件拆分，主安装侧保留原ID/manufacturingCode，另一侧新ID/待分配编号；每侧重建sourceSlot/姿态，位置/型号/宿主不改。制造关系不拆，不改用户原文件；导出和再次加载单侧记录不会继续增件，草稿由正常提交链保存。
- 创建和批量确认逐件安装，两側能装仍各1件；addDesignComponentMountFace生成缺侧的新记录，不改原件。install/evaluate按接头+真实安装侧查询，另一目标的源端占用不被新增兄弟记录掩盖；重复侧/保护记录拒绝。所有既有组件仍参加安装空间检查，整批一次历史和异常整图恢复保留。
- 可选designComponentVariants保存每种已用方式的目录定义/sourceMountFace；切回原类型恢复原型号，未记忆的ANGLE/INTERNAL/PLATE从同系列已映射真实目录定义选择，其余仍设计意图。designSwitchCandidate复用几何/孔轴/槽/足迹/包络，只忽略替换当前件，其他件仍真实占位；不允许为了切换移动主体或放宽制造门禁，失效切换恢复原对象并重建。
- sourceMountFace在设计意图及正式重建中保留，制造推荐尊重所选侧，不回退默认第一面。切换清除当前件旧制造绑定和派生字段，保存模型记忆而非旧世界坐标/制造参数；SIDE_CORNER按新候选重判，不将内角套旧端面制造方案。
- app切换与推荐加入emitProjectChanged，原历史/立即保存/反馈刷新接入。右侧显示当前件编号、安装侧和实际型号；候选列表在工程状态内复用，重建、删除、提交/加载清空，实际提交仍新鲜检查。
- Schema62/116模块0.75.38，无新依赖或模块。用户原JSON/实际localStorage不直接操作；未新增/运行测试、Java编译、服务启动/重启或浏览器验收。旧“两个安装面一条记录”等verify期望待授权更新，资源同步和待验见VALIDATION。以下v0.75.37双侧共同选择描述为历史，由本版用户确认覆盖。

## v0.75.37 连接件点选与悬停边界

- 用户确认修复角码难点选和鼠标悬停自动弹出“接头/端部快捷菜单”。Editor普通pointerMove不再解析安装候选，app移除悬浮安装菜单DOM及自动开启回调；明确右键型材的安装候选仍在。SceneManager对连接实体复用真实三角面浅蓝预高亮及小tip，移开/离开画布、隐藏、删除和重建清理，不在孔槽上造填平面。
- interactionMeshes/pickInteractionHit合并可选Part与可见helper，连接ID优先解根保留；悬停、单击、右键和直接拖动使用同一前方命中，Alt穿透循环可包含连接。SceneManager.raycast排除隐藏祖先，SelectionGestureManager与ProfileGripEditor拒绝用后方型材/端点热区覆盖角码的前方命中，不将全部连接件设成穿透优先级。
- Editor.selectedConnectionId为临时选择事实。selectConnection清空Part选择和Gizmo，仅高亮本关系helper/派生实体，onConnectionSelected打开单独相关卡片；宿主不染选中色、不进入多选。普通select/selectMany、清空及历史恢复取消连接选择；连接重建/可见性/提交刷新重绑提示，不写Project或保存选择状态。
- app.selectedConnection/label独立于selectedPart，右侧连接卡片只显示当前关系、编号/宿主；属性/加工不拿宿主冒充所选件。底栏tip、删除按钮、右键详情/聚焦/删除与D/Del保持连接选择可操作，当前关系双侧实体共同选择。自由配件保持原Part操作，安装派生件仍通过连接配置修改，不允许孤立移动绕过安装规则。
- Editor.removeConnection共用Manager派生项清理、统计/总尺寸、一次历史及工程提交；鼠标删除用原WorkbenchConfirm，键盘直接删可撤销。Manager实际删除清空选中状态，重建不清连接ID，隐藏/移除释放悬停资源；不删除宿主型材或其他连接。
- Schema62/116模块0.75.37，单根/Shift/Ctrl+A、紫色齐平、草稿/镜头及独立制造边界保持；用户原JSON/实际localStorage不操作。没有新增/运行测试、Java编译、服务启动/重启或浏览器验收。旧v07519“点击连接选两根宿主”回归期望待按新合同更新，资源交付及待授权场景见VALIDATION。

## v0.75.36 全可见型材齐平反馈

- 用户确认紫色齐平说明，并要求不直接接触的同平面型材也显色。InterferenceFeedbackManager.render在原红色干涉/黄色接触带之后，以editor.selected为基准检查物理快照中所有其他可见PROFILE，不再在CONTACT循环内局限于邻梁。选中或干涉成员不被紫色覆盖，基准自身干涉或实时拖动时不发布静态齐平集合。
- CoplanarSurfaceFeedback复用profileSidePlanes和0.1mm双方角点偏差、同向法向判断，基准面只算一次，实际材料支持探测每面一次并立即释放。目标仅创建真实材料三角面提示；隐藏、弧形、竖直杆端盖与未知面不伪报。现有吸附候选的compareProfileTopPlanes/addCoplanarSurfaceFeedback接口及预测补偿语义保持。
- onChanged/clear同步coplanarCount/partIds/referenceId/label；app底栏增加小紫色色标、实际着色数量与统一tip，明确基准编号、齐平不是多选或一起移动。无常驻模型文字，不新增选择/约束/连接、工程字段、历史或草稿；普通单击/Shift/Ctrl+A规则保留。
- Schema62/116模块0.75.36，无新依赖或模块；用户原JSON/实际localStorage不操作。按全局规则未新增/运行测试、Java编译、服务启动/重启或浏览器验收，资源同步见VALIDATION。待验：远处后梁真实共面、不同层/倾斜/0.1mm外不着色，单选/多选橙金及红色优先，隐藏/取消选择/几何重建/刷新、底栏tip和一次移动/撤销后的清理。

## v0.75.35 单根、多选与全选

- 用户确认修复单击型材误选34根整架，并要求Shift逐个多选、Ctrl+A全选。Editor.select不再根据assemblyId提升为顶层组件；普通单击替换选择，Shift追加且不重复，Ctrl/Meta切换单件。selectByPartId不再需要individual例外，画布/清单/右键遵循同一规则；组件成员与参数不解除。
- 显式selectAssembly继续选择组件，通过selectMany更新全部反馈；SINGLE默认、CONNECTED/ASSEMBLY明确移动范围保留，选了多根仍按当前多选移动，不把“单个移动”解释为默默丢弃用户多选。Alt穿透与拖动/复制复用原事务。
- Editor.selectAll通过selectableMeshes取得可见且符合类型过滤的Part，复用selectMany；不选择地面/印字/接头helper，不自动显示隐藏件。app的Ctrl/Meta+A与编辑菜单共用入口，帮助及底栏tip同步。字段/可编辑文本保留原生全选，模态/绘制/安装/审阅及进行中拖动、框选/套索不会改变后台选择。
- isSelectionTransformable检查每个已选成员，锁定/继承锁定/安装配件只可查看；选择、组件锁定、锁定切换和网格重建保持Gizmo守卫。SelectionGestureManager也拒绝不可编辑多选的直接拖动/复制，不依赖最后一个成员是否可编辑。
- Schema62/116模块0.75.35，不新增依赖，不改用户JSON/localStorage。没有新增/运行测试、Java编译、服务启动/重启或浏览器验收；资源同步状态见VALIDATION。待验：整架中普通单击/拖动仅一根、Shift追加/Ctrl取消、Ctrl+A/Esc、输入框与模态隔离、锁定/已安装多选、显式整架移动、撤销和连接随动。

## v0.75.34 自动生成连接件：简洁操作与分帧计算

- 用户新增要求覆盖旧扫描审阅UI：打开“自动生成连接件”只显示类型、可选目录规格和生成/取消；不展示数量/范围/补侧开关、接头统计、逐项列表/勾选/定位、重新扫描及技术说明。初次打开不扫描，改类型/规格也不扫描，点击生成才进行检查并自动提交，不再二次确认。零新增时仅显示简短原因，不把未适配位置说成已齐全。
- app调用begin的interactive=true/scanImmediately=false；生成时固定BOTH/supplement=true/profileIds=null。沿用全体可见直型材、可装双侧各一件、手工/修改/制造/已有实体保护，原主体不移动。scan完成返回为空、任务代次变化、取消/忙碌时不继续confirm；有合法新增才经原Manager整批一次提交/撤销，异常回滚不变。
- ConnectionBatchManager.scanSteps/solutionSteps/sideCornerSteps/planSteps/previewSteps共用同步及UI分帧驱动；UI先绘制，再以8ms预算让出事件循环（非不可分割调用的硬上限）。每次运行/cancel更新runRevision，旧任务不能迟到发布状态或提交；扫描/规划结束核对工程快照，忙碌结果不作为可提交行。转动视角不进入Project签名。
- 类型/规格、实际工厂几何的局部包络及可见主体包络按本轮复用；主体距离只做保守筛选，不放宽孔槽/足迹/干涉门槛。已有保留关系和未贴合邻域不重复试全规格；evaluateCandidate返回envelope供规划/确认复用，取消不留几何缓存。supplement检查在同一快照内缓存，预览按安装ID/型号/姿态复用；confirm仍用新鲜安装及场景空间检查，不复用旧合法性。
- 原鱼缸架JSON、手动C061/C062与实际草稿不改，v0.75.33SIDE_CORNER与独立制造边界保留。Schema62/116模块0.75.34，无新增依赖/模块；已有verify仅机械同步版本，未新增/运行测试、Java编译、服务启动/重启或浏览器验收，没有实测速度/数量结论，资源同步见VALIDATION。
- 待用户授权验收：打开不阻塞、类型/规格选择后单击生成；密集工程处理时相机/取消响应；关闭/新建/再打开不提交旧任务；零新增简短反馈、原件保留、实际方向/双侧数量与一次撤销/保存刷新。下列v0.75.33逐项审阅入口为历史，不恢复到当前普通UI。

## v0.75.33 横梁侧面内角自动扫描

- 用户当前文件为C:/Users/chenfangming/Desktop/鱼缸架示例.json，34根3030型材/62关系。两处手动CORNER_CUBE 30为C061（P-048→P-051，END/LEFT/LEFT）与C062（P-049→P-048，START/LEFT/RIGHT）；原文件只读，不移动主体/改写草稿。旧端中心扫描漏掉这类接头，并会被普通端部占用判定挡住。
- ConnectionPlacementManager.resolveJointContact共用原侧面角点查询，normal projection仅用于物理角点去重，不修改源/目标实体或安装容差。ConnectionBatchManager增加独立SIDE_CORNER扫描，先排除不可能触及端边的远处目标，再用原evaluateCandidate逐规格校验孔轴/槽/站位、两腿完整支撑、主体及第三方包络。
- 候选按型材对/材料面交点去重，正反识别选原关系方向；普通端面与内角不混在pair-only旧关系查询中。内角不参与本批usedEnds，不覆盖既有立柱接头；原手工/修改/制造记录保持，已有内角即使当前类型不覆盖也显示保留或失效原因。
- context重建与确认复用同一角点查询、安装面和目标面；确认重查SIDE_CORNER身份与安装空间，通过原installDesignComponent、markAutomatic、History一次整批提交，失败整图恢复。已有/本批角码参加空间检查，不强放第二件、不忽略障碍；普通双侧规则不变。
- UI预览列标明“两梁内角”，消除已找到合法内角时同对型材的虚假端中心间距，黄色实体数量仍是实际待提交组件数。入口：左轨“自动生成连接件”→整个结构→自动选择适配连接件（或目录角码/对应规格）→重新扫描→审阅→生成。
- Schema62/116模块0.75.33，3030默认值、表面印字自然缩放、草稿/视角续作保持。SIDE_CORNER仍不能直接绑定旧端中心制造方案；复杂多向/斜接/15系列、空腔实体精度和完整制造映射不在本轮范围。
- 按用户全局AGENTS，未新增/运行测试、Java编译、服务启动/重启或浏览器验收；没有实测新增数量或宣称全角点覆盖。原两处手动件保留、再次扫描不重装、选择范围/取消/一次撤销/保存刷新等仍待实际验收，资源同步见VALIDATION。

## v0.75.32 型材选型默认3030

- 用户要求选择型材时默认3030；app.js的创建目录newProfile.nominal及catalogId同步改为3030/标准3030，默认空封边保持。绘制、框架、替换表单已有3030默认值，不改流程或目录排序。
- 只改变创建选材初始值，手动改选继续保留；不替换现有构件、不迁移用户工程/localStorage、不改变门框独立默认规格或印字自然缩放。
- Schema62/116模块0.75.32；已有verify只机械同步版本，未新增/运行测试、Java编译、服务启动/重启或浏览器验收。资源同步与待验见VALIDATION。

## v0.75.31 固定表面尺寸，正常随型材缩放

- 用户确认：保留表面固定实际尺寸、随型材自然缩放；选中/悬停不额外放大。这覆盖v0.75.30错误的9 CSS px上限，所有型材仍常驻编号/具体型号/长度，不隐藏或改成选中才显示。
- ProfileSurfaceNumber按3mm名义字高确定模型足迹，窄带/短杆在生成几何时等比限缩；宽度只按纹理纵横比确定，不再用杆长65%扩展采样区域。印字仍裁剪真实外壁三角面，孔槽不填平，不新增表面板。
- textMaterial使用原表面UV和普通透视插值，移除stampScreens/stampRegions/stampAxes及gl_Position屏幕重采样。stampFaces只控制可见面与180度翻正；onBeforeRender不调字号，内接矩形仅评分，缩放不重建纹理。
- 自然遮挡、单根单面、内容随编号/型号/长度/颜色更新、资源释放和旧showPartNumbers偏好保留。网格/镜头续作、Project/历史/BOM/制造事实、原JSON/localStorage不改；Schema62/116模块0.75.31。
- 已有verify仅机械同步版本；没有新增/运行测试、Java编译、服务启动/重启或浏览器验收。待验透视/正交自然缩放、UV翻正/孔槽/遮挡/近裁剪和密集架体效果，资源同步状态见VALIDATION。

## v0.75.30 历史方案（9px屏幕上限已取消）

- 用户进一步明确不要放大，覆盖v0.75.29的单根12px读字；仍要所有型材常驻编号/具体型号/长度，不默认隐藏，不改成选中才显示。showPartNumbers和旧偏好保持。
- 所有印字共用紧凑沿杆单行样式，最大9 CSS px、空间不足按真实材料面积限缩；选中和悬停不参与字体大小/方向选择。阅读方向继续翻正，每根仍仅一份真实贴面字，保留三角面/孔槽裁剪和实体遮挡。
- ProfileSurfaceNumber移除readingMaterial、辅助Plane、readingFocus及宿主前包络读字深度；SceneAnnotationManager移除surfaceReadingFocus调用/方法，恢复无参数update。保留贴字矩阵/遮挡缓存、隐藏/关闭/删除资源释放及内容刷新链，不将辅助浮字改成其他提示框。
- 不改工程坐标、构件、历史、BOM、制造事实、网格/镜头续作或用户JSON/localStorage。Schema62/116模块0.75.30，现有verify仅机械同步版本；没有新增/运行测试、编译、服务启动/重启或浏览器验收。资源同步状态与待验范围见VALIDATION。

## v0.75.29 历史方案（单根放大已由v0.75.30取消）

- 用户明确所有型材仍要平时显示；禁止将本轮理解成“默认隐藏，悬停才显示”。showPartNumbers开关及旧偏好保持，所有可见型材仍显示编号/具体型号/长度，不删字段或改工程数据。
- 常驻信息沿杆投影方向单行紧凑贴在真实材料面，最大9 CSS px、实际空间不足时限缩；采样轴随杆投影调整并翻正，透视插值补偿/孔槽裁剪/实体遮挡仍有效。真实贴字不靠扩展背景板或悬浮三行填满画布。
- SceneAnnotationManager按当前画布指针及现有FeatureHover/SceneHover优先选一根，再回退Editor.selected主选中；ProfileSurfaceNumber只给该根12px水平单行读字，必要时使用既有无底框表面锚点辅助阅读。非关注根始终保留常驻贴字；多选不全体放大，离开画布不使用过期悬停。
- 单行透明纹理替代单行/三行图集；聚焦改变只更新排版与uniform，复用纹理。所有展示资源不进入业务构件层级、包围盒、拾取、历史、BOM或制造数据，辅助读字不作为实际刻字证据。
- Schema62/116模块0.75.29；现有verify仅机械同步身份，按用户规则未新增/运行测试、编译、服务启动/重启或浏览器验收。待验常驻贴面/关注切换/背面与近裁剪、密集结构观感及shader，见VALIDATION。

## v0.75.28 转动时可读字号

- 原因是v0.75.27把水平文字压进狭长材料带的投影矩形，转斜后投影面积变小，字号跟着变小。现统一12 CSS px，随视角横向正读；真实贴面足迹使用完整可用实心带和更多杆长，不再限高8mm。
- 每根选一个朝向相机且真实中心未被遮挡的面，优先可读性，分数接近时保留当前面，减少相邻面的重复文字与转动跳换。单行/三行共用既有透明纹理，字体大小不跟随投影面积压缩或放大。
- 真实材料投影能容纳12px时走原三角面贴字/孔槽裁剪；不能容纳时走无底框的表面锚点读字。后者是辅助阅读而非严格物理印字，使用真实构件射线核实锚点可见性，宿主前包络深度避免自身斜面截断，depthTest继续有效；不以文字覆盖区域证明材料或制造刻字。
- 遮挡状态按每个渲染帧的真实构件矩阵/可见性更新，布局在相机/投影/视口/宿主/遮挡变化时重算。印字区域跨近裁剪面但中心可见时可用读字；中心离屏/遮挡或没有朝向相机的实际面则不显示。
- 显示入口/三字段/缓存/旧showPartNumbers偏好保留。读字资源不加入构件层级、包围盒、拾取、BOM、历史或Project；隐藏/删除/关闭释放所有展示资源。Schema62/116模块0.75.28，原用户工程和本机草稿不改。
- 未新增或运行测试、编译、启动/重启或浏览器验收。固定字号切换、shader编译、近裁剪/正交/DPI、密集结构重叠与复杂实体遮挡仍待实际验收，见VALIDATION。

## v0.75.27 表面信息与横向正读

- 原表面编号扩展为编号/具体型号/毫米长度，如P-002 · 3030A · 850 mm。标准设计截面使用尺寸型号，目录变体保留A/B/R等具体名称；圆弧展示实际展开长，长度最多两位小数。读取现有业务字段，不新增制造身份、材料绑定或真实刻字加工。
- “显示 → 型材表面信息”和底栏“显示 → 型材表面信息”控制三项一起显示，沿用showPartNumbers并保留旧true/false偏好。更改编号、尺寸、型号、颜色或几何后重建纹理/贴面资源；相机转动只更新布局uniform。
- 真实外壁裁剪/FrontSide/depthTest和不可拾取保持。四个真实面各按投影实心带内的最大水平矩形，选择单行或三行排版；屏幕采样补偿透视插值，使转动视角时仍横向正读、不镜像倒置。当前绘制前更新uniform，避免顶点缓冲下一帧才上传造成朝向延迟。
- 短杆/弧段保留可用带宽并独立限长；槽/孔仍为空，不扩展实际材料面。远景或侧面近乎成线时字会随真实面积缩小，穿过近裁剪面的印字区域隐藏；不能以“正读”承诺所有视角/所有倍率都清晰可见。
- Schema62/116模块0.75.27；未改原用户JSON/localStorage或上一版网格/镜头实现。现有v07523纹理期望及版本常量已同步，按用户规则未新增/运行测试、编译、启动/重启或浏览器验收，见VALIDATION。

## v0.75.26 无限网格红底修复

- 用户截图整片红色与网格X轴红色一致；源代码场景背景仍为浅蓝。上一版near=0.05/far=2000000后，最远裁剪点反投影的齐次w在GPU单精度下可能相消为零，导致网格交点/轴线覆盖无效。本轮为这条确定的数值缺陷修正，尚未作浏览器复现与验收。
- InfiniteGround只使用近点和投影内部点，在相机空间求方向并把起点移到眼平面，再转到画布坐标；避免最远端齐次除零、世界大坐标相减，以及正交大范围起点的抵消误差。无有效射线时回到场景浅蓝底，原淡出、网格开关、四象限与红绿轴保持。
- v0.75.25的鼠标位置缩放和本机镜头保存继续使用，Project Schema62/116模块统一0.75.26。用户原工程、构件、草稿和吸附/干涉逻辑不改。按用户全局规则未新增/运行测试、编译、服务启动/重启或浏览器验证，后续验收范围见VALIDATION。

## v0.75.25 刷新视角与鼠标位置缩放

- 刷新恢复当前 localStorage 草稿时，同时从独立 `alu-cad-viewport-state` 恢复相机位置、观察中心、透视/正交模式及正交缩放。相机状态不进入 Project JSON/Schema/历史；页面离开和相机停止变化约140ms后保存。
- 若旧版本尚无镜头记录，首次恢复优先按可见 PROFILE/SHAFT/PANEL 主体取景；当前用户工程的远处自由A-025仍存在，但不会让1000×500×1800框架被压成小点。底栏/菜单“适配全部”仍包含A-025等所有可见构件，语义不改。
- 新建、打开其他JSON或打开示例会清掉上一工程的镜头，再按新工程主体取景；手动恢复同一草稿则继续使用其镜头。清除本地草稿也同步清除镜头记录，当前画布和导出的JSON不受影响。
- 透视与正交OrbitControls统一启用zoomToCursor，滚轮沿鼠标所在射线推进；切换投影不会丢失。透视near为0.05mm、minDistance为1mm、maxDistance为1000000mm；正交zoom范围0.0001–100000，解决原40mm硬停止，仍保留有限数值以避免相机奇点和浮点失稳。
- 0.75.25/Schema62/116模块；没有移动、删除或改写用户原构件。本轮依照用户替换后的AGENTS未主动运行测试、编译、启动或浏览器验证，后续如需验收按VALIDATION所列场景执行。

## v0.75.24 手动角码不再穿透到地面

- 用户最新JSON实际为24根3030架体杆 + 1个自由15×15角码A-025，40设计关系/64目录组件。A-025在4886.49/0/3615.40，来自15规格被静默转FREE后的工作面射线；原文件与这个旧件均保留，不自动删除或抬升。
- 打开“创建 → 连接”，选角码类型时优先所选型材/当前选材系列的已映射规格（用户工程为欧标30×30）。点击预览，靠近两根横梁的内角，绿色且提示“两梁内角”后单击即可自动转向安装。Tab切换合法候选，Esc/右键取消；15系列或未映射类型明确提示，需主动勾“自由放置”才摆模型。
- 已覆盖用户P-010/P-011内角：两腿孔轴与实际槽/站位、完整安装面支撑共同通过，安装约在605mm层高；原40关系/64实体保留，新增1关系/1实体、一次撤销。预览/确认共用源面，普通刷新恢复SIDE_CORNER关系和姿态，原25构件未变化。
- 手工补同一接头的另一侧保留原关系ID/主面/型号，已安装侧不重复，不覆盖其他型号/正式方案。全部现有设计helper参与保守OBB安装空间检查，不能因不在editor.parts中而忽略。
- SIDE_CORNER是两条角码腿的目录设计安装，不是端中心误吸附；不占原立柱端面关系，复用原关系加载/随动/删除/内部图复制链。旧端面/制造连接仍检查原中心站位；内角暂不能直接套旧制造规则，不承诺供应商实际尺寸、五金/加工已完成。
- 显式自由放置连接件优先鼠标命中构件表面（取实际子网格世界法向/几何最低支撑），空白处才落工作面；不新增安装约束，板材/光轴自由流程保持。用户实测点到620mm横梁顶部时预览仍620mm，不落0mm。
- v0.75.24/Schema62/116模块；当时检查见VALIDATION。v0.75.33已接入目录直角内角扫描，复杂多向/斜接/15系列、完整覆盖验收及制造映射仍列ROADMAP，不宣称全功能一致。

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
