# Architecture · v0.65

## 工作台交互

- 左侧快捷搭建/绘制/批量表单复用现有 Editor 领域入口；右侧组件库与属性通过创建/修改模式共用停靠轨道。
- ViewCube 独立渲染相机方向，26 个区域只触发 Editor.viewDirection；Cube Mesh 不进入 Project。
- 90°旋转复用 TransformControls 事务，保留作用域、约束、安装随动、连接刷新、干涉回滚和 History；离散旋转不触发平移 Snap。
- ProfileOrientation 统一绘制截面朝向：local Y 对齐工作面法向；空白工作面落点使用截面半高偏移。世界坐标与旋转仍保存在标准 Part 中。

## 1. 总体数据流

```text
Project JSON (schema 62 only)
   │
   ├─ Parts / Assemblies / Connections
   ├─ Constraints
   ├─ Dimensions
   ├─ Profile Sections
   └─ Manufacturing / Editor State
        │
        ▼
Editor domain state
        │
        ├─ Three.js rendering / interaction
        ├─ Constraint solver
        ├─ DimensionSystem
        ├─ Connection derivation
        ├─ Machining Feature system
        └─ Validation
              │
              ▼
     Drawing / DXF / Factory Package
```

核心边界：**业务模型不是 Three.js 场景对象**。Mesh、Helper、Gizmo、爆炸图副本都属于展示层；Project JSON、BOM、加工、尺寸和 DXF 只依赖业务数据。

## 2. 当前 Schema 策略

从 v0.34 开始，项目处于快速演进阶段，**不维护旧历史工程兼容**。v0.63 当前 Schema 为 62；只维护当前工程模型。

- `ProjectSchema.js` 只接受 `schemaVersion = 62`。
- 不存在 `ProjectMigrator`。
- 不维护 v33/v32/... 的迁移链。
- 数据模型需要重构时，可以直接调整当前 Schema。
- 加载非当前 Schema 时明确报错，不做隐式兜底。

这样可以避免尺寸、工程图、DXF 等核心模型被历史兼容层长期绑住。

## 2.1 v0.63 基础 DIY 交互链

```text
TransformControls / ProfileDrawTool
        │
        ├─ movement step / axis lock
        ├─ SnapManager -> 端面 / 槽中心 / 端点候选 + 滞回锁定
        ├─ InterferenceFeedbackManager -> CONTACT(绿) / INTERFERENCE(红)
        └─ mouseUp
             ├─ 红色真实穿透 -> restore transform snapshot，拒绝提交
             └─ 合法 -> Constraint / Connection / Accessory mount 刷新 -> History
```

关键边界：Snap 是几何编辑辅助，CONTACT 是展示态，Connection 才是装配业务事实。移动整个连接组只是根据既有 Connection 图派生 follower，不复制连接关系。连续轮廓中 `parameters.points` 保存逻辑轮廓尺寸，真实 PROFILE 段可根据端面搭接规则派生修剪。

## 3. 约束架构

```text
ConstraintTypes
      │
ConstraintGraph ──> affected subgraph
      │
ConstraintManager
      ├─ SemanticConstraintSolver
      ├─ ConstraintResiduals
      ├─ ConstraintMobility
      ├─ ConflictAnalyzer
      └─ ConstraintDiagnostics
```

求解流程：

```text
changed parts
  -> ConstraintGraph.collectAffected
  -> semantic projection iteration
  -> residual evaluation
  -> converged ? done : repeat
  -> not converged -> conflict analysis
```

拖拽流程：

```text
TransformControls candidate pose
  -> ConstraintMobility null-space projection
  -> allowed candidate pose
  -> mouse up
  -> semantic solve
  -> refresh connection/dimensions/history
```

## 4. 在线型材绘制

```text
Pointer / Click
  -> ProfileDrawTool
     -> working-plane intersection
     -> ProfileFeatureCatalog / SnapManager
     -> orthogonal / grid / fixed-length rules
     -> Editor.addProfileBetweenPoints
     -> PROFILE business object
```

`ProfileDrawTool` 只负责交互和预览，不拥有第二套型材数据模型。

## 4.2 Parametric Contour · v0.57

```text
Assembly.parameters.points   ← 唯一轮廓事实源
       │
ContourFrameManager
  ├─ 点拖动
  ├─ 点击尺寸修改边长
  ├─ 右键边插点 / 点删除
  └─ 正交规则
       │
       ▼
整框 PROFILE 重建
       │
       └─ AutoConnection 重建
```

L/U/阶梯快捷模板只生成 points，然后调用同一 `ProfileDrawTool.createContourFrame()`。二维连接安装示意属于展示层，不创建第二套连接/五金模型。

## 4.1 Profile Grip Editing · v0.36

```text
selected linear PROFILE
  -> ProfileGripEditor A/B handles
  -> drag plane -> scalar length
  -> grid / feature snap
  -> fixed opposite endpoint
  -> ProfileGeometryFactory.rebuildLinearGroup
  -> machining datum remap
  -> constraint/connection refresh
  -> one History capture
```

Grip 编辑修改的是业务长度和构件中心，不允许用 Mesh scale 代替长度。拖动预览期间保持同一个 root Group，避免 Selection/Transform/Feature 引用失效。


## 5. Feature Snap

```text
ProfileCatalog.slotDefinitions
       ↓
ProfileFeatureCatalog
       ├─ PROFILE_END
       ├─ PROFILE_FACE
       └─ PROFILE_SLOT(slotId, offset)
       ↓
SnapManager / FeatureSelection / Constraints / Connections / Dimensions
```

槽位必须通过目录 `slotId` 引用；后续接用户自定义真实截面时替换目录几何来源，不让消费方自行估算槽中心。

## 6. Assembly

- `Assembly.parentId` 构成总成/子装配树。
- Part 通过 `assemblyId` 归属组件。
- `AssemblyManager` 是层级变更入口。
- 父级锁定/隐藏向下生效。
- 整体移动/旋转仍落到 Part 的持久化 Transform。
- `AssemblyPresentationManager` 的爆炸图使用临时副本，绝不写回正式坐标。
- `AssemblyInspector` 使用 Connection + active Constraint 关系图检查悬空/断开。

## 7. Connector

```text
ProfileCatalog.slotDefinitions
        ↓
ProfileFeatureCatalog
        ↓
SlotMatcher
        ↓
ConnectionRuleCatalog
        ↓
ConnectionManager
   ├─ geometry validation
   ├─ slot matching
   ├─ machining derivation
   └─ hardware derivation
        ↓
FactoryValidator / Hardware BOM
```

Connection 是持久化规则对象；自动加工/五金是可重建派生事实。T 螺母等槽内附件引用 `slotId + face + offset + stationS`。

### 7.1 Auto Connection · v0.46

```text
Drag / Grip / Library Drop / Profile Draw / DIY Template
        ↓
Feature Snap / exact candidate collection
        ↓
AutoConnectionResolver        <- only orchestration
        ↓
ConnectionManager.recommendFor
        ↓
ConnectionManager.createConnection
        ├─ persistent Connection
        ├─ generated hardware
        └─ generated machining
             ↓
          BOM / Drawing / Factory Package
```

边界：`AutoConnectionResolver` 不维护第二份 Connection 数据、不直接创建 Mesh/五金/加工，也不绕开几何校验。`editorState.autoConnectionSystemVersion=2`；`autoConnectionEnabled` 只控制后续新建构件，玩家主动扫描现有结构使用显式 force 命令。

## 8. Machining Feature

```text
UI / Connection Rules
       ↓
MachiningManager
       ↓
MachiningFeatureCatalog.normalize
       ↓
Persistent machiningItems
   ├─ feature metadata / datum
   ├─ pattern / mirror / featureGroup
   └─ manufacturing coordinates
       ↓
FactoryValidator ── featureFootprint
       ↓
MachiningUnitBuilder
       ↓
DrawingGenerator / DxfExporter / BOM
```

稳定制造坐标：直型材使用 `stationS + face + offset`，端面使用 `end + offsetX + offsetY`；弯型材仍以中心线累计 S 为主。

场景中的孔环、槽平面等只是编辑提示，不是制造事实。

## 9. Dimension System · v0.34

```text
UI / Auto dimension commands
       ↓
DimensionSystem
       ↓
Persistent Dimension entity
   ├─ type
   ├─ anchors
   ├─ binding
   ├─ chain
   ├─ layout
   └─ semantic
       ↓
Editor resolve/value/set
       ├─ part transform
       ├─ profile geometry/path
       └─ machining feature
       ↓
SceneAnnotationManager
       ↓
3D dimension graphics / labels
```

### 支持的核心表达

- `LINEAR`
- `ANGULAR`
- `RADIAL`
- `ORDINATE`
- `BASELINE` 基准尺寸链
- `CONTINUE` 连续尺寸链
- `ORDINATE` 坐标尺寸链
- `PART_CLEARANCE` 净间距链
- A/B 端加工基准链
- 弯型材半径和圆弧角度驱动

### 尺寸驱动原则

Dimension 不直接缓存“世界空间最终答案”，而是保存：

```text
Anchor + Binding + semantic metadata
```

读取尺寸时解析当前模型；修改驱动尺寸时修改业务参数/Part Transform/加工 Feature，再统一刷新几何、标注、约束和历史。

### 自动排布

`SceneAnnotationManager` 根据 `chain.layout.axis/lane/side` 做基础尺寸线分层，并继续使用屏幕空间标签避让。v0.35 工程图会复用 Dimension 实体，而不是另外维护第二套尺寸定义。


## 10. Engineering Drawing · v0.35

```text
Project / Parts / Assemblies
        ↓
EngineeringDrawingModel
   ├─ PART_OUTLINE
   ├─ CENTER line
   ├─ overall dimensions
   └─ layer dimensions
        ↓
EngineeringDrawingLayout
   ├─ A3/A4
   ├─ standard scale
   └─ TOP/FRONT/RIGHT/ISO cells
        ↓
EngineeringDrawingSvgExporter
        ↓
SVG / Factory Package
```

关键原则：
- Drawing Model 只引用 `partId/displayId` 和二维几何，不持有 Three.js Mesh。
- 正/俯/右三视图使用统一比例；ISO 单独 fit-to-cell。
- 总装二维投影来自 Part 业务尺寸 + Part Transform。
- v0.37 DXF 已直接消费同一 Drawing Model/Layout；后续禁止再次从 Scene 重算。
- 单根型材加工详图暂由现有 `DrawingGenerator` 继续负责；总装/子装配由 Engineering Drawing System 负责。

当前边界：无真正 hidden-line removal；弯型材总装为采样包络；真剖视/局部放大/BOM 气泡尚未实现。

## 11. 导出架构原则

目标链路：

```text
Project domain model
   -> Drawing Model
   -> Drawing Layout
   -> SVG / DXF
```

禁止从 Three.js Scene 直接“截图式”生成正式 CAD。工程图/DXF 应从 Part、MachiningFeature、Dimension、Connection 等业务对象计算。

## 9. Engineering Drawing DXF · v0.37

```text
EngineeringDrawingModel
      ↓
EngineeringDrawingLayout
      ├─ SVG Exporter
      └─ DXF Exporter (AC1015/mm)
```

DXF 与 SVG 共享一套二维几何和纸张布局。DXF layer contract 固定为 PROFILE/CENTER/DIMENSION/TEXT/TITLEBLOCK/VIEW/HIDDEN。`HIDDEN` 当前仅预留，真实 HLR 未实现。

## 10. BOM / Manufacturing Reports · v0.38

制造报表不依赖 Scene Graph，也不包含原料库存/余料/排料语义。

```text
Project Parts / Assemblies / MachiningFeature / Hardware
        ↓
BomExporter
        ├─ Project / Profile / Hardware / Machining / Subassembly BOM
        ├─ cut-list.csv (profile instance)
        ├─ machining.csv (feature instance)
        └─ consistency validation
        ↓
FactoryValidator / Factory Package Gate
```

`cut-list.csv` 描述设计零件的切割/展开长度；禁止把它扩展成 3m/4m/6m 原料 cutting-stock。Assembly 路径必须通过 `AssemblyManager` 解析。


## 11. Production Inspection · v0.39

```text
FactoryValidator
  ├─ Machining validation
  ├─ Connection validation
  ├─ Constraint diagnostics
  ├─ BOM consistency
  ├─ AssemblyInspector
  ├─ PartCollisionDetector (straight PROFILE OBB-SAT)
  └─ ConnectionCompletenessInspector
```

碰撞检查基于业务 Part 的制造包络，不读取 Three.js helper/annotation。UI 定位使用 issue.partIds -> Editor.focusDiagnosticIssue()，属于 presentation 行为，不写回 Project。

## 12. Profile Catalog / Database · v0.40

型材目录是独立主数据层，不与 Three.js Mesh 耦合：

```text
profile_catalog (DB)
  -> /api/profile-catalog
  -> runtime ProfileCatalog registry
  -> Editor.addProfile()
  -> Part.profileSpec / dimensions
  -> ProfileGeometryFactory
```

v0.45.0 起目录主数据固定使用 SQLite + MyBatis XML；默认数据库文件为 `./data/aluminum-cad.db`，启动时执行 `sql/schema.sql` / `sql/data.sql` 幂等初始化。
`ProfileSectionRegistry` 的截面优先级：Project custom DXF > Database catalog section > Built-in reference section。

## 13. Interaction Polish · v0.40

`SceneManager` 新增 hover helper、hover label 和 camera tween。普通 hover 会在绘制/测量/尺寸/框选/Grip 等模式主动关闭，避免多交互模式抢占事件。

## 14. CAD Interaction 2.0 · v0.41

- `FeatureHoverManager` 只消费 `ProfileFeatureCatalog`。
- `SelectionCycleManager` 维护 Alt 穿透选择状态，不修改模型。
- `WorkPlaneVisualizer` 是 presentation-only。
- `SceneManager` 统一处理 marquee/lasso 屏幕选择与 world/local TransformControls。
- `Editor` 只负责编排模式互斥与 Selection，不把临时交互状态写进制造模型。


## v0.55 轮廓与装配播放

- `ProfileDrawTool.CONTOUR` 只负责收集平面轮廓点、预览、校验和生成标准 PROFILE；不新增业务 Part 类型。
- 轮廓边生成后统一归入 Assembly，并复用现有 AutoConnection。
- `AssemblyPlaybackManager` 属于 Presentation 层，只允许临时控制可见性和 `AssemblyPresentationManager` 克隆，不允许修改 Part transform。
- 播放步骤唯一来源是 `AssemblyInstructionGenerator`。


## v0.59 展示层边界

- 轮廓关系图标由 `ContourFrameManager` 从 `Assembly.parameters.simpleConstraints` 即时生成，不进入 Project。
- `AssemblyGuideDocument` 从 `AssemblyInstructionGenerator` 输出与 `ConnectionInstallationDiagram` 生成可打印说明，不维护第二套装配数据。
