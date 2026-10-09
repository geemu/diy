# 80/20 IdeaBuilder 功能对标与实现基线

> 项目版本：v0.75.25
> 对标对象：80/20 IdeaBuilder  
> 对标日期：2026-10-05
> 产品目标：做一个面向玩家、创客和不会 CAD 用户的铝型材 DIY 设计器，而不是复制通用机械 CAD。

## 1. 产品结论

v0.75.25修复本地续作的镜头体验：视角独立保存，刷新恢复；无旧视角时框住结构主体，避免远处自由件把框架压小；透视/正交均以鼠标位置缩放并支持1mm近距离。工程事实、远处构件与“适配全部”语义不改，不把相机状态混入Project。

v0.75.24按用户真实工程修复15角码静默自由落地和手工安装方向遗漏；有实际孔/槽及两腿支撑的两梁内角可自动转向预览、单击安装，原立柱关系保留。已装侧/其他型号/制造方案不覆盖，显式自由摆放先取前方实际表面。SIDE_CORNER仅目录设计参考关系，全部内角自动扫描和制造映射仍有边界，不称为全类型/全功能一致。

v0.75.23按用户新截图统一删除确认与快捷菜单的深色交互层；P-002 等既有编号印在真实材料面，随模型而非相机旋转、受实体遮挡且可关闭/保存。只改交互与只读展示，不改变型号、碰撞、BOM 或制造刻字；全站弹窗和参考站全功能仍未宣称一致。

v0.75.22按用户截图收敛加工展示：常驻绿色大文字变为可见孔位的单个悬停小提示，孔位尺寸链默认关闭且可单独开启，深色孔口不受选中金色覆盖。参数/工程图/制造链不改；孔口仍是展示示意，不宣称真实实体布尔或全部加工视觉一致。

v0.75.21改进连接可靠性与整架回改：失效关系不算已有，设计组件参与实时第三方包络干涉，共用孔位逐孔校验，四选框口验证真实闭合，已有自动单侧可预览补侧。新框架保存参数/成员ID，预览→一次确认→撤销/刷新续改，保护加工/约束/手工/制造。多槽不适配位置、点选框口、复杂空腔和制造映射仍有边界，不称为全功能一致。

v0.75.20按用户确认默认两侧可装各1件，九类目录/动态规格复用真实安装校验，接头与组件计数分开且逐侧勾选；足迹/旋转OBB空间检查、保存每侧姿态与一次提交保留独立领域链。快速搭建用单一参数生成器，用途仅预设；3060中间梁两端缝修正。多槽中轴孔位安装、复杂类型/实体碰撞和制造映射仍待补，不把本轮数量与表单修复称为全功能一致。

v0.75.19 按用户已确认审阅修复组件阵列/镜像内部图、锁定/重叠保护、主体与连接件/配件的隐藏同步和连接实体直接点选。工作台常用工具保留文字，其他动作和显示归同风格菜单，默认减少标签/细格、折叠重复替换入口。普通组件图不再只复制外观，但复杂镜像和向导参数延续仍明确受限，自动框口、复杂安装及制造映射继续列入ROADMAP；不将这轮修复写成全功能一致。

2026-10-08 用户最新要求“参照嘉立创和乐玩，互相借鉴，取好的实现”，基础搭建优先采用更清楚且可取消的工作流，不再仅以机械复制单一站点判定好坏。v0.75.18 修复长度输入中断，补右侧固定基准/多轴/直角贴合预览，并将整体补连接改为共用目录模型的扫描、逐接头勾选和一次提交。几何接触、可保存设计组件与制造五金/加工仍分层；智能框口、复杂连接和完整组件图复制尚未完成。原快捷键与已确认用户定制保持，匿名公开观察记录见 reference/basic-building-review-2026-10-08-v07518.md。

v0.75.17 按本轮真实首击/第二击参考纠正多出的添加流程，普通选材与拖放共用一支橙色瞄准画笔、首击前短预览，完成一根返回选择；接头实际贴合用黄色、待吸附仍绿色、干涉红色优先。v0.75.14的固定长度连续放置观察不能当成完整参考流程，内部兼容API保留但不占普通入口；新记录见reference/lewan-profile-drawing-review-2026-10-07-v07517.md。完整对齐目标和制造边界不变。

v0.75.16 按用户当前工程修正松手下沉和点提示：最近真实贴面不再被较远槽中心抢走，平移不改角度，预览/提交共享候选且约束后核实三维接触。用户新增 localStorage 需求已接入提交即保存/打开自动续作/失败保护。此轮是这些具体问题的修复，不是全部参照功能验收；完整对齐待办继续保留。

v0.75.15 继续对齐实际公开流程：S 双向智能生成、所选通孔/站位/偏移、左轨分组、底部镜像/隐藏工具与顶部悬停菜单。九类夹具安装与反向生成共用真实孔轴事实；独立代码和制造门禁保持。v0.75.14 快速对齐、复杂整体拉伸、完整搭建向导和全页面样式仍有差距，当前上前视角/四色网格/停靠底栏也不是参考站默认布局；不宣称所有功能已经一致。公开观察见 reference/lewan-shaft-smart-review-2026-10-07-v07515.md，待补项见 ROADMAP。

2026-10-07 用户最新将搭建/编辑及快捷键目标明确修订为 Lewan 完整对齐，覆盖下面历史交互冲突。本轮v0.75.14为预放置、选择/拖拽复制、快速对齐与区域拉伸第一阶段；全功能差距列入ROADMAP，不把原有近似功能、PRO按钮或独立参考模型算作完全复刻。保持Schema62与独立领域链，不引入对方私有代码/素材或商城报价。

v0.75.11 用户明确干涉保留目标位置并标红，允许进入地面以下但要明显反馈。移动方向距离和主动贴合/落地置于工作台底栏，几何接触、设计连接、真实五金配置继续分开；后续搭建和一键补连接重点参考嘉立创工作流。此约定覆盖早期交互碰撞回滚，正式制造碰撞门禁不变。

v0.69 用户确认将选材/绘制收敛到右组件库，左侧只承担快捷搭建与批量等操作；样式以实际观察的 LewanDIY 编辑器为准。采用深色工具区、浅蓝画布、橙色交互和底部玻璃工具条，但保留 DIY 品牌、26 方向导航及独立领域实现。新建与示例分离，顶部菜单、下载文件、窄屏命中和自适应适配需要验证；不将视觉参照误写为全部功能或像素级复刻完成。

v0.68 用户要求统一工作台，不再区分简单/专业。当前优先完成玩家可理解的操作闭环：默认画完退出、显式连续添加、常驻结束操作、一次 Esc/右键退出，以及一致样式与窄窗口可达性；不以增加专业参数入口数量代替体验改进。

v0.67 用户进一步确认只保留自由绘制入口。近轴与斜杆合并在 FREE 内，整框/模板放回快捷搭建；不要求玩家先理解多个绘制模式。原有领域能力与商业范围不变。

用户于 2026-10-05 明确要求型材绘制参照嘉立创 FA。v0.66 已实际观察并采用其自由搭建、实体预览和就地长度输入工作流；左快捷操作 / 右组件库按用户此前确认保持。IdeaBuilder 的连接、配置、BOM 与装配指导优先级继续保留，不因绘制对标而扩展商业范围。当前斜向绘制基于所选工作平面，不宣称所有参考功能已经 1:1 实现。

IdeaBuilder 与本项目的目标高度一致。后续产品设计优先采用以下路径：

```text
选零件 / 选模板
    -> Click / Drag / Snap
    -> 自动识别连接关系
    -> 自动补连接件 / 紧固件 / 加工
    -> 自由修改尺寸、型材和连接方式
    -> 实时 BOM / 设计检查
    -> 爆炸图 / Tagged Drawing / 组装说明
    -> DXF / STEP / 制造包
```

专业 CAD 能力继续保留在底层，但默认界面不得要求普通用户理解 Feature、Constraint、MachiningFeature、Drawing Model 等内部概念。

## 2. 官方已确认的 IdeaBuilder 能力

依据 80/20 官方 IdeaBuilder 页面及官方产品说明，当前可确认的核心能力包括：

1. 浏览器运行，无需安装。
2. 面向少量或零 CAD 经验用户。
3. Click / Drag / Snap 快速设计。
4. 使用 T-slot 型材和其他标准组件构建设计。
5. 自动硬件放置和快速切换紧固件。
6. 快速增加板材、脚轮、轴承等组件。
7. 自动将紧固件相关加工加入型材和板材。
8. 自动生成 itemized BOM。
9. 生成详细设计文档 / 装配相关图纸。
10. 项目价格估算，并在设计变更后更新。
11. 爆炸图和 Tagged Drawing。
12. 保存与分享设计。
13. STEP 导出。
14. XML 采购导出和经销商协作。
15. 设计检查，帮助发现弱点、错位或不合适的零件。
16. 装配说明。

其中采购、经销商和供应商闭环属于 80/20 自身商业体系，不作为本项目复制目标。

## 3. 状态定义

| 状态 | 含义 |
|---|---|
| `DONE` | 当前工程已经具备可用实现 |
| `PARTIAL` | 底层能力已有，但用户体验、覆盖度或自动化不足 |
| `NEXT` | 下一版本优先实现 |
| `PLANNED` | 已纳入路线，但不是当前最高优先级 |
| `OUT OF SCOPE` | 明确不实现 |

## 4. IdeaBuilder Parity Matrix

| IdeaBuilder 能力 | 本项目状态 | 当前实现 / 对应模块 | 主要缺口 | 目标版本 |
|---|---|---|---|---|
| Web-based | DONE | Spring Boot 静态 Web + Three.js | 无 | 已完成 |
| 面向零 CAD 用户 | PARTIAL | 统一工作台、单次完成/一键退出、快速模板、现有结构一键补连接、点击接头放置连接/加工 | 精确尺寸直改和成组复制后的关系维护仍需简化 | 持续 |
| Click / Drag / Snap | DONE基础 | `SnapManager`、Grip、资源库拖放、Feature Snap、拖动中绿色吸附预览与“即将吸附”提示 | 已接自动连接；复杂多构件交叉/非正交仍需继续扩展 | v0.53交互增强 |
| 现有结构批量补连接 / 清理 | DONE(v0.64) | AutoConnectionResolver + Editor 显式扫描；纯自动连接安全清理；状态总览 | 非正交和一端多接头仍需继续扩展 | v0.64 |
| 型材目录 | DONE 基础 | `ProfileCatalog` / DB Catalog | 自定义 DXF 槽拓扑识别未完成 | 后续 |
| 快速切换型材 | DONE基础 | `ProfileReplacementManager` + Inspector 快速替换 | 已支持当前选择/当前组件/工程同型号并重算连接；复杂异系列加工迁移继续完善 | v0.48基础完成 |
| Box / Frame Configurator | DONE 基础 | `DiyTemplateCatalog` / `DiyGenerator` / `addLayeredRack()` | 已自动补连接；参数重算仍是一次性生成 | v0.46基础完成 / v0.48重算 |
| Door Configurator | DONE基础 | `FrameOpeningResolver` / `PanelDoorConfigurator` / Assembly | 已支持矩形轴对齐框口、门框/门芯/铰链/拉手及重算；斜框/异形门后续 | v0.48基础完成 |
| Contour Configurator | DONE基础(v0.56) | 任意闭合轮廓 -> PROFILE + Assembly + 自动连接 | 支持轮廓点拖动、边长输入、点增删、正交锁定、等长/平行/点对齐和整框重算；圆弧边后续增强 | v0.56+ |
| 自动硬件放置 | DONE基础 | `DesignConnection -> ManufacturingConfigurator -> ConnectionManager -> HardwareCatalog` | 设计阶段只建立连接意图；制造配置后才生成真实五金 | v0.50分层完成 |
| Quick-change Fasteners | DONE基础 | 设计连接快速切换 + 制造连接配置 | 设计连接原地切换会使旧制造配置失效；真实连接方案在制造配置中重建派生 | v0.50分层完成 |
| 角码 / 内置 / 锚式 / 连接板 | DONE 基础 | `ConnectionRuleCatalog` | 非正交和复杂场景覆盖不足 | 持续 |
| 自动紧固件 BOM | DONE 基础 | `ManufacturingConfigurator` + `ConnectionManager` + `BomExporter` | 设计连接不提前生成五金；制造配置完成后统一进入 BOM | v0.50完成 |
| 自动连接加工 | DONE | `manufacturingRuleId` -> `ConnectionManager.rebuild()` -> `MachiningManager` | 真实加工只在制造方案确定后派生；设计连接变化会使制造方案失效 | v0.50完成 |
| 板材 | DONE基础 | `PANEL` + `PanelDoorConfigurator` | 已支持四边框口识别、自动留缝和重适配；板材固定件规则后续 | v0.48基础完成 |
| 脚轮 | DONE 基础 | Accessory Catalog / `AccessoryMountManager` | 仍需进入更多 DIY Configurator 可选项 | 后续 |
| 脚杯 / 端盖 / 滑轨 | DONE 基础 | Accessory Catalog + `AccessoryPlacementManager` + `AccessoryMountManager` | 已支持红/绿 Ghost、右键位置种子、点击安装；自动补件/批量安装继续完善 | v0.53交互增强 |
| 轴承 | MISSING | 无专用目录和装配规则 | 不是近期核心 | v0.52+ |
| 实时 BOM | DONE基础 | `BomExporter` / 工程中心 | 工程清单随 Project 实时重算；后续补常驻侧边摘要 | v0.51基础完成 |
| BOM 反查模型 | DONE基础 | 工程中心 + Selection | 双击清单行定位三维；三维选择反向高亮清单；后续补隔离/批量操作 | v0.51基础完成 |
| 实时价格估算 | DEFERRED | 无正式价格模型 | 用户明确报价相关暂不做 | 暂缓 |
| 设计变更后实时成本 | DEFERRED | 无 | 用户明确成本估算暂不做 | 暂缓 |
| Design Check | PARTIAL | `FactoryValidator`、`PartCollisionDetector`、`InterferenceFeedbackManager`、连接完整性、制造配置门禁 | v0.52 已增加设计阶段实时干涉红框；经验性结构提示继续补 | v0.52基础增强 |
| 弱点 / 错位 / 不合适零件提示 | PARTIAL | 实时干涉 / Collision / ConnectionCompleteness / 制造槽宽兼容 | 不做 FEM 结论；继续增加领域规则型提示 | v0.52基础增强 |
| 爆炸图 | DONE增强 | `AssemblyPresentationManager` + 装配步骤播放器 | 已支持分步爆炸、装入动画和步骤相机过渡 | v0.56增强 |
| Tagged Drawing | DONE基础 | `EngineeringDrawingModel` + `ManufacturingIdentityManager` | 已使用统一制造编号生成主体构件标签；后续继续优化布局避让 | v0.54完成 |
| 自动装配说明 | DONE增强(v0.59) | 自动步骤、制造编号、前置步骤、定位/爆炸、动画播放、相机过渡、二维连接安装示意 | 已增加安装/拆卸方向、关系示意，并提供一页一步的可翻页/打印装配说明书 | v0.59完成 |
| 保存工程 | DONE | SQLite + Project JSON | 无 | 已完成 |
| 分享工程 | PLANNED | 可导出工程/制造包基础 | 暂不做云账号；可先做单文件分享包 | v0.52 |
| STEP Export | MISSING | 当前 DXF/SVG/CSV/Factory Package | 需要独立 STEP 生成方案，不允许 Scene 粗暴导出替代业务模型 | v0.52 |
| XML 采购 | OUT OF SCOPE | - | 商业采购闭环不属于当前产品范围 | - |
| 经销商共享 / 订单 | OUT OF SCOPE | - | 不做供应商/商城/订单体系 | - |
| 自动教程 / 设计支持 | PLANNED | 文档存在 | 可在 UI 做上下文帮助，不建立人工服务体系 | 后续 |

## 4.1 v0.46 已完成的 Auto Connection 范围

统一入口：

```text
TransformControls mouseUp
Profile Grip commit
Library Drop
ProfileDraw LINE / BOX
DIY Template Batch
        |
        v
AutoConnectionResolver
        | recommendFor / createConnection
        v
ConnectionManager
        |
        +-- Hardware
        +-- Machining
        +-- BOM
```

关键约束：

- 自动连接默认开启，但用户可关闭；
- 自动失败只跳过，不影响正常 Snap/建模；
- 同一源端只自动建立一个连接；
- DIY 批量候选会折叠同一型材对的双向重复候选；
- 自动生成的连接仍是标准 `connections[]` 条目；
- 下一版本不重写 Auto Connection，而是在同一 Connection 上实现 Quick Change。


## 4.2 v0.48 已完成的 Configurator / Replacement 范围

```text
4 selected linear profiles
        |
        v
FrameOpeningResolver
        |
        +--> FRAME_OPENING_PANEL -> standard PANEL -> refit
        |
        +--> DOOR_CONFIGURATOR
              -> 4 standard PROFILE
              -> PANEL
              -> HINGE / HANDLE ACCESSORY
              -> Assembly
              -> Auto Connection
```

型材替换：

```text
Selected / Assembly / Same Model
        -> ProfileReplacementManager
        -> preserve Part ID / centerline / length / assembly
        -> rebuild affected connections
        -> reuse Quick Change recommendation if needed
        -> unresolved joints remain INVALID
```

当前框口解析范围先收敛为四根轴对齐、共面的直线型材；不把斜框/任意拓扑猜测塞进首版。


## 4.3 v0.52 已完成的交互反馈范围

- 拖动构件时实时检查空间干涉，红色包围线和 HUD 在落位前就给出反馈；
- 正常端面贴合由容差自然放行；连接派生五金、宿主安装配件不会作为干涉误报；
- 型材接近可吸附位置时显示绿色源点/目标点/连接线，松手后再真正提交吸附；
- 右键菜单根据 PROFILE / PANEL / ACCESSORY 显示下一步操作，不再堆通用 CAD 命令；
- 顶部一级菜单进一步收敛为 4 个：文件 / 设计 / 制造 / 更多。

## 4.4 v0.53 已完成的统一放置范围

- 标准配件从“先选宿主再点安装”改为“选配件 -> hover 预览 -> click 安装”；
- Ghost 绿色表示可安装，红色表示目标不兼容或会发生明显空间干涉；
- 右键型材/板材“添加配件”保留右键位置，选择配件后在该处直接预览；
- 连接 / 配件 / 加工统一为 hover-only preview / click commit / Esc cancel；
- 拖动型材时 Snap Preview 会同步“即将吸附”提示，用户能看到连接方向和目标；
- 顶部菜单固定为 4 个一级入口，减少重复目录。

## 4.5 v0.64 已完成的玩家连接闭环

- “新建构件自动连接”只控制后续绘制、拖放和模板生成，语义不再与主动修复混淆；
- 用户可以扫描整个现有结构，补齐当前几何能够明确判断的缺失设计连接；
- 显式扫描使用 force=true，即使自动连接开关关闭也会执行，但不会移动构件或覆盖已有连接；
- 批量清理只删除仍为 autoGenerated=true 的纯自动结果，手工连接和人工切换过的连接保留；
- 连接页直接显示全部、纯自动、手工/已改和几何失效数量；
- 所有新增/删除继续进入现有 ConnectionManager、Undo、BOM、加工和制造检查链，不新建第二套连接模型。

## 5. 我们不照搬 IdeaBuilder 的部分

### 5.1 不绑定单一厂商

本项目不是 80/20 商品配置器。型材、连接件和附件应保持通用目录能力，不增加供应商作为核心数据维度。

### 5.2 不做订单 / 支付 / 商城

当前产品目标是设计与制造数据，不做：

- 商城；
- 支付；
- 订单；
- 经销商工作流；
- 供应商库存；
- 采购 XML 对接。

### 5.3 不做原料排料和余料库存

用户已经明确排除：

- 3m / 4m / 6m 原料定尺；
- cutting-stock；
- 锯缝优化；
- 余料库存；
- 项目间余料复用。

BOM / cut-list 只回答设计需要什么，不负责仓储和排料。

### 5.4 不优先做通用 B-Rep CAD

不为了“更像 SolidWorks”引入完整 Sketcher / B-Rep / FEM。优先级始终是：

```text
普通用户能不能快速搭出来
> 自动连接是否正确
> BOM / 加工是否可信
> 最终能不能照着装
> 通用 CAD 能力数量
```

## 6. 本项目要比 IdeaBuilder 更进一步的能力

### 6.1 DIY Configurator

除了 Box，还应有：

- 基础空间框；
- 多层置物架；
- 鱼缸 / 龟缸架；
- 设备机架；
- 门框 / 围板；
- 工作台；
- 展示架。

生成结果必须仍是标准 Project Part，可以继续自由编辑。

### 6.2 一键更换型材

提供：

```text
更换当前型材
更换当前装配组内同型号
更换整个项目中的同型号
```

替换后保持中心轴、长度、装配关系，并重新检查 Slot / Connector / Hardware Compatibility。

### 6.3 一键更换连接方式

连接关系保持不变，只替换连接方案：

```text
外置角码
<-> 内置连接
<-> 锚式连接
<-> 连接板
```

切换必须事务化：

```text
删除旧 connector 派生数据
-> 生成新 connector
-> 生成新 hardware
-> 生成新 machining
-> 刷新 BOM
-> 刷新 Validation
```

不能残留旧加工或旧五金。

### 6.4 BOM 与 3D 双向联动

BOM 行点击后：

- 高亮对应构件；
- 可隔离同规格构件；
- 可定位单个 Part；
- 显示该项数量和所在装配组。

3D 点击构件后，BOM 自动定位对应项。

### 6.5 LEGO 式组装指导

最终装配指导应支持：

```text
步骤 1：底框
步骤 2：立柱
步骤 3：第二层横梁
步骤 4：板材
步骤 5：脚轮
...
```

每一步显示：

- 本步骤新增零件；
- 紧固件数量；
- 3D 高亮；
- 前一步/下一步；
- 可选爆炸动画。

## 7. 版本路线

### v0.46 — IdeaBuilder Interaction 1.0

目标：让“拖过去”就尽量完成正确位置和连接候选。

P0：

1. DIY 模板生成连接拓扑。
2. 新增统一 Auto Connection Orchestrator。
3. Drag / Snap 后识别 `END_TO_FACE / END_TO_END / FACE_TO_FACE` 等语义关系。
4. 自动调用现有 `ConnectionManager`，禁止另写第二套连接规则。
5. 自动派生 Hardware / Machining / BOM。
6. 连接候选以简单中文 UI 呈现，不暴露内部 Feature 数据。

建议新增模块：

```text
interaction/SemanticPlacementResolver.js
connection/AutoConnectionOrchestrator.js
connection/ConnectionCandidate.js   # 如继续使用纯 JS，可用普通对象工厂而非 class
```

### v0.47 — Fastener / Connection Quick Change

1. 连接方式快速切换。
2. 连接事务重建，彻底清理旧 Hardware / Machining。
3. 自动连接失败时给出明确原因。
4. 支持“整组替换连接方式”。
5. 完善 20 / 30 / 40 系列兼容规则。

### v0.48 — Configurator & Components

1. Panel 自动生成。
2. Door Configurator。
3. 脚轮 / 脚杯 / 端盖批量安装。
4. 一键更换型材。
5. DIY 参数重算，不再只能一次性生成。
6. 多层架逐层高度。

### v0.49.1 — Player Workbench / Design-Manufacturing Split

1. 设计型材与制造型材分离。
2. 封边参与槽位/连接语义。
3. 角码等连接方式采用“点接头 -> 自动吸附”，歧义时两点选择。
4. 加工采用“选工具 -> 点实际位置”，hover 只 Ghost 预览。
5. 统一中文工作台，复杂参数按需展开，不分简单/专业模式。
6. 报价/单价/成本暂缓。

### v0.50 — Manufacturing Configuration（DONE，无报价）

1. DesignProfile -> ManufacturingProfile。
2. 设计 Connection 的 `designType` 与真实 `manufacturingRuleId` 分离。
3. 真实材料未配置前禁止选择真实连接制造规则。
4. T 螺母等按制造型材实际槽宽校验兼容性。
5. 更换制造型材后自动使不兼容制造连接回到待配置。
6. 制造配置未完成时阻止正式制造包导出。
7. 不把制造字段重新暴露到设计入口。

### v0.51 — Workbench Layout / Live Engineering List（DONE基础）

1. 左右面板可停靠/浮动/调整宽度，工具条和视图导航可拖动。
2. 布局保存在浏览器本地，不污染 Project JSON。
3. 工程清单继续实时计算。
4. 清单 -> 3D 定位，3D -> 清单反向高亮。
5. 统一制造编号和 Tagged Drawing 延续到下一阶段。
6. 不做报价。

### v0.52 — Interaction Feedback（DONE）

1. 实时干涉红框。
2. 型材拖动吸附预览。
3. 右键上下文操作。
4. 菜单与左栏收敛。

### v0.53 — Unified Placement（DONE）

1. 配件 Ghost 吸附放置。
2. 红/绿合法性与干涉预判。
3. 右键位置作为配件放置种子。
4. 连接/配件/加工统一“hover 预览、click 提交、Esc 取消”。
5. 顶部菜单收敛为文件/设计/制造/更多。

### v0.54 — Manufacturing View / Assembly Instructions（DONE基础）

1. 统一制造编号。
2. Tagged Drawing / Balloon 标签。
3. 从 Assembly / Connection 推导装配步骤。
4. 3D 当前步骤高亮与爆炸图联动。
5. 干涉问题点击定位与批量隔离。

### v0.55+ — Interchange & Sharing

1. STEP Export 方案。
2. 单文件工程分享包。
3. Contour Configurator 基础。
4. 更完整的附件类型。

### AI — 在领域 API 稳定后进入

AI 不应先于上述领域能力。理想链路：

```text
自然语言
-> 生成 DiyTemplate 参数 / Editor 命令
-> AutoConnectionOrchestrator
-> Validation
-> BOM / Drawing / Assembly Instructions
```

AI 只能调用稳定领域 API，不允许直接构造 Three.js Scene 或绕过 Project Model。

## 8. v0.46 验收标准

v0.46 不以“新增多少按钮”为验收，而以以下用户场景为准：

### 场景 A：模板生成

用户选择四层架，输入宽/深/高，点击创建：

- 框架生成；
- 识别所有确定连接节点；
- 连接候选正确；
- 一键自动安装后产生完整 Hardware；
- 需要加工的连接自动产生 MachiningFeature；
- BOM 数量与模型一致。

### 场景 B：手工拖一根型材

用户将一根 3030 拖到另一根 3030 的端部：

- 自动吸附到合理位置；
- 识别 90° / T 型连接语义；
- 给出连接方案；
- 普通用户无需手工选择 Feature / Slot ID。

### 场景 C：删除连接

删除 Connection 后：

- connector 视觉对象删除；
- 派生 Hardware 删除；
- 派生 Machining 按 ownership 正确删除；
- BOM 回退；
- 不留下孤儿数据。

## 9. 架构硬约束

后续所有 IdeaBuilder 对标实现必须遵守：

1. Project Model 是唯一业务事实，Three.js 只是视图。
2. UI 不直接 push/修改 Connection、Machining、Assembly 领域数组。
3. 自动连接必须复用 `ConnectionManager`。
4. 加工必须复用 `MachiningManager` / `MachiningPatternManager`。
5. Feature / Slot 必须复用 `ProfileFeatureCatalog` / `SlotMatcher`。
6. BOM 不建立第二套数据源。
7. 工程图必须继续走 Drawing Model。
8. Factory Package 必须通过 `FactoryValidator`。
9. 不引入供应商体系、商城、订单、原料排料和库存。
10. 面向玩家的 UI 应按需展开复杂参数，不能删掉既有精确编辑能力或另设专业模式门槛。

## 10. 后续 Agent 开发原则

接手项目时优先查看本文件，再看 `AGENTS.md`、`docs/HANDOFF.md` 和 `docs/ROADMAP.md`。

收到“继续完善”“参照 IdeaBuilder”“让普通人更好用”等模糊需求时，默认优先级为：

```text
Click / Drag / Snap
-> Auto Connection
-> Quick Change
-> Configurator
-> Live BOM
-> Design Check
-> Assembly Instructions
```

不得默认转向：

```text
完整 Sketcher
B-Rep
FEM
CAM
ERP
商城
供应商
库存
```

除非用户后续明确改变产品范围。
