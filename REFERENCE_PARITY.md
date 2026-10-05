# 参考编辑器对齐状态 · v0.60.0

> 80/20 IdeaBuilder 已升级为主要产品标杆。完整功能矩阵、版本路线和验收标准见根目录 `IDEABUILDER_PARITY.md`。本文件继续记录 LewanDIY / 嘉立创 FA 与专业 CAD 能力层面的差距。

参考目标：LewanDIY 在线编辑器、嘉立创 FA 在线型材设计器。目标不是复制页面截图，而是对齐核心工作流：**在线画型材 → 吸附/装配 → 连接件 → 加工 → 尺寸 → 工程图/DXF**。
- v0.59 参数化轮廓的等长/平行/点对齐关系直接显示为画布图标，图标与属性关系可双向定位。
- v0.59 工程中心新增可翻页/打印的整套装配说明书，复用 Cxxx 二维安装示意与统一制造编号。
- v0.58 参数化轮廓增加玩家式简单关系：边等长、边平行、点横向/纵向对齐。
- v0.58 连接二维安装示意增加安装方向、螺钉插入方向、1→2→3 安装步骤与 3→2→1 拆卸顺序。
- v0.57 参数化轮廓支持点击边长直接修改、右键边插点/点删除，并提供 L/U/阶梯快捷轮廓。
- v0.57 装配 Cxxx 连接增加二维安装示意，继续复用现有 Connection/Hardware 事实源。
- v0.56 轮廓框升级为参数化编辑：轮廓点/边长为事实源，支持点拖动、边长输入、正交锁定、整框重算。
- v0.56 装配步骤增加平滑相机过渡，并可展开连接两端构件/五金信息后做三维局部聚焦。




## v0.54 Manufacturing Guidance / Tagged Drawing

- 统一 P/B/S/A/H/C/M/G 制造编号，并贯穿 BOM、属性、工程图、制造包和装配步骤。
- Tagged Drawing 默认标主体构件，自动螺钉/T 螺母留在 BOM/装配步骤，避免总装图过载。
- 装配步骤按组件安装顺序生成；跨步骤连接归到后安装步骤并显示前置步骤。
- 三维可定位当前步骤并进行非破坏性分步爆炸。


## v0.53 Unified Placement / Builder UX 3.0

- 新增 `AccessoryPlacementManager`，标准配件采用 Ghost 吸附放置，不再要求先选中宿主后直接安装。
- 配件 Ghost 在提交前做目标兼容和快速干涉检查：绿色可放，红色不可放。
- 右键型材/板材打开配件库时保留右键位置，选择配件后在该位置预览。
- 连接、配件、加工统一为“移动只预览、单击提交、退出键取消”。
- Transform Snap Preview 同步画布“即将吸附”状态。
- 顶部一级菜单收敛为文件 / 设计 / 制造 / 更多。

## v0.52 Interaction Feedback / Builder UX 2.0

- Transform 拖动过程中增加实时干涉反馈；干涉构件显示红色包围线，落位后问题未解除则持续提示。
- 型材吸附在提交前显示绿色源点、目标点和连接线，用户能看清即将吸附的位置。
- 右键菜单按型材/板材/配件提供上下文操作，型材端部可直接作为连接第一 Anchor。
- 顶部菜单收敛为文件/设计/视图/制造/帮助；左侧竖栏不再重复移动/旋转/复制等画布工具。
- 实时干涉只做设计反馈；正式制造碰撞仍以 FactoryValidator 为准。

## v0.50 Manufacturing Configuration / Design-Manufacturing Split 2.0

- 设计连接只保存 `designType`，自动连接和手工连接都不再提前绑定 M6/M8 等真实制造规则。
- 新增独立制造配置中心：设计型材批量映射真实制造型材，设计连接映射真实连接规则。
- 两端真实型材未配置时制造连接不可选；T 螺母按真实制造槽宽校验。
- 制造型材变化会重新校验已配置连接，不兼容时自动退回待配置。
- 正式制造包导出要求制造配置完成；报价、价格、订单仍不在范围内。


## v0.46 Auto Connection / IdeaBuilder Interaction 1.0

- 新增 `AutoConnectionResolver`，作为 Feature Snap / DIY 生成与 `ConnectionManager` 之间的统一编排层。
- 已有型材移动、A/B 端拉伸、零件库拖放、在线画线、BOX 和 DIY Template 都可以在吸附后自动创建推荐连接。
- 自动连接仍由原 `ConnectionManager` 派生角码/T 螺母/螺钉、MachiningFeature 和 BOM。
- 自动连接可关闭；失败不阻止 Snap；手工连接入口保留。
- 批量模板场景会折叠 A->B / B->A 互反候选，并防止同一源端自动连多个目标。
- 当前对标重点：实时干涉、可视吸附、右键上下文操作与精简工作台；随后补 Tagged Drawing 和装配指导。

## v0.45 DIY / 新手路径

当前产品不再只追求“专业 CAD 功能对齐”，同时增加面向非 CAD 用户的模板入口：基础空间框、多层置物架、鱼缸/龟缸架、设备机架。

参考成熟型材配置器的方向：

- 先选用途和尺寸，再生成骨架；
- 生成结果仍是标准工程对象，可继续拖拽、吸附、连接和加工；
- 后续优先补自动连接件/五金、逐层参数重算和装配步骤；
- 不为了功能数量直接引入完整通用 B-Rep/Sketcher 内核。

## 当前已经具备

### 在线建模
- 型材 / 光轴 / 板材 / 五金资源库。
- v0.36：直型材 A/B 端 Grip 单端拉伸，支持固定对端、精确输入、网格/Feature Snap。
- 资源拖放、移动、旋转、多选、框选、复制、阵列、镜像、成组。
- 3D 画布直接绘制 LINE / POLYLINE / RECTANGLE / BOX。
- XZ / XY / YZ 工作平面、正交、网格、固定长度。
- 端点续画。

### Feature Snap / Constraint
- 端点、端面、侧面、槽中心特征。
- 多槽型材使用稳定 `slotId`。
- Coincident/Mate/Align、距离、角度、平行、垂直、共面、同轴。
- Slider / Revolute / Cylindrical 剩余自由度。
- 多约束 DOF 交集、冲突候选和受限拖拽。
- 3D DOF 箭头/圆弧。

### Assembly
- 总成 → 子装配 → 构件树。
- 整体移动/旋转、锁定、隐藏、隔离。
- 安装顺序。
- 非破坏性爆炸视图。
- 基础装配关系诊断。

### Connector
- 20/30/40 系列连接规则。
- 显式槽位与 T 螺母槽匹配。
- 角码自动朝向。
- 端面螺钉、内置/锚式、连接板。
- 连接派生加工与五金。
- 脚轮、调节脚、底脚标准附件。
- 五金 BOM。

### Machining
- 通孔、盲孔、攻丝、沉头、沉孔。
- 槽、腰孔、矩形铣削、端面加工。
- Feature Group。
- 线性/矩形阵列、镜像、批量加工面。
- A/B 端、面中心、目录槽中心加工基准。
- 基础越界和 Feature footprint 冲突检查。

### Dimension · v0.34
- W/D/H 总尺寸。
- 型材长度、构件距离、槽中心距、夹角。
- 加工 station / offset 驱动尺寸。
- A 端 / B 端加工基准链。
- `BASELINE` 基准尺寸链。
- `CONTINUE` 连续尺寸链。
- `ORDINATE` 坐标尺寸。
- 构件净间距尺寸链。
- 弯型材半径 `R` 驱动。
- 弯型材圆弧角度驱动。
- 3D 尺寸线 lane 自动排布 + 屏幕空间标签避让。

### Manufacturing / Export
- 型材 BOM、五金 BOM、加工 BOM、子装配 BOM、项目汇总 BOM。
- 逐件 cut-list.csv 与逐 Feature machining.csv。
- BOM 一致性报告与 Factory Gate。
- SVG / DXF 制造导出。
- v0.37 总装/子装配工程图 DXF，统一 PROFILE/CENTER/DIMENSION/TEXT/TITLEBLOCK/VIEW/HIDDEN 图层。
- Factory Validator / Factory Package 基础链路。
- v0.39：直型材 OBB-SAT 体积穿透检查、连接完整性 WARNING、生产检查问题一键定位。

### Engineering Drawing · v0.35
- 正视 / 俯视 / 右视 / 等轴测总装视图。
- 正式 Drawing Model，中间层与 Three.js Scene 解耦。
- A3/A4 自动排版和标准比例。
- 总 W/D/H + 基础层间尺寸链。
- 图框/标题栏。
- 总装/子装配 SVG 写入 Factory Package。

## 与参考站点仍有差距

### 在线编辑体验
- 工具图标、快捷键体系、hover/pre-highlight、右键菜单仍未完全达到成熟 CAD 编辑器一致性。
- 还缺更完整的三维轴锁、草图式连续建模体验。
- 绘制吸附后自动建立正确的永久点重合约束仍需完善。

### 型材 / 五金真实性
- 当前目录槽位是结构化标准定义，不是所有自定义 DXF 截面的自动拓扑解析。
- 五金主要是规则化模型，不是各厂商完整 SKU CAD 库。

### 装配 / 连接
- 复杂非正交连接规则仍有限。
- 尚未做工具空间、装配可达性、真实安装顺序可行性分析。
- 爆炸图还没有 BOM 气泡、自动引出线和完整安装动画。

### 加工
- 复杂任意轮廓铣削、真实刀具补偿、夹具碰撞、实际工艺规则尚未实现。
- 当前加工碰撞主要是 2D footprint/AABB 快速检查。

### 尺寸 / 工程图
- v0.35 已有正式二维 Drawing Model 和基础自动排版，但全部 DimensionSystem 实体尚未完整映射到 2D。
- 还没有真正 hidden-line removal、剖视切割和局部放大。
- BOM 气泡/自动引出线尚未实现。

### DXF
- v0.37 已打通 Drawing Model -> 总装/子装配 A3/A4 DXF，图层、中心线、尺寸和标题栏基础可编辑。
- 仍缺 hidden-line removal、剖视/局部图、BOM 气泡、associative DIMENSION、加工详图 layer 统一和分组导出。

## 当前阶段：v0.45 SQLite + DIY Quick Design

v0.45 将本地持久化数据库基线统一为 SQLite，并在既有专业 CAD 能力上新增面向非 CAD 用户的 DIY 快速设计入口。当前模板生成结果直接落入同一套 Project / Editor / BOM / Drawing 链路，不创建第二套几何真相。

下一阶段优先补：模板生成后的自动连接件与派生加工、模板实例参数重算、自定义层高和常用附件；不优先扩展通用 B-Rep/Sketcher。

原料长度、库存、余料和 cutting-stock 排料已明确 OUT OF SCOPE，不要重新加入。

当前不扩展商城、支付、订单、社区、AR 等非核心方向。

### 本轮外部产品/开源参考

- 80/20 IdeaBuilder：借鉴面向零 CAD 经验用户的 click / drag / snap、自动五金/加工、BOM 和爆炸装配思路。
- Open Frame Studio：借鉴模板库、参数化配置、Three.js 预览、DXF/车间图以及自然语言配置器的产品组织方式。
- ToubkalCAD：仅借鉴参数重算与模型/渲染分离思路；其完整 OpenCascade + Sketcher 能力当前不引入。
- PartMode：仅借鉴 canonical document model 与 Three.js 只作为视图的架构原则；其 B-Rep 通用 CAD 路线当前不引入。

这些项目用于产品与架构对照，不复制其源码；第三方代码仍按各自许可证处理。


## v0.40 在线交互与型材库（已完成）

- 型材库卡片改为截面 SVG 缩略图，对齐成熟在线设计器的“型号可视化选择”体验。
- 增加 Part hover 预高亮、标签和相机平滑切换。
- 增加数据库自定义型材目录；无需重新编译即可扩充型号。
- 当前仍未完成自由套索、feature-level hover 和完整 Gizmo 视觉重绘。

## v0.41 CAD Interaction 2.0

已补：自由套索、Alt 穿透循环选择、Feature 级预高亮、World/Local Gizmo、工作平面可视化、增强 View Cube、对象类型右键菜单。

仍有差距：统一可点选 Machining/Dimension 实体、完全自绘 CAD Gizmo、大工程空间索引与 Instancing。
