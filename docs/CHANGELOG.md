# Changelog

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
