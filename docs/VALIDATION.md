# Validation / Regression — v0.69

## v0.69 当前检查范围

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
