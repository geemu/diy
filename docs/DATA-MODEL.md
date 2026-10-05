# Data Model · Schema 62

## 0. v0.65.0 当前模型边界

本版 26 方向视角正方体、左右工作台职责和快捷旋转不增加持久化业务实体；绘制贴面使用标准 Part.position/rotation，Schema 保持 62。

当前版本按全新工程维护，不兼容旧 Schema。PROFILE 必须包含 `designProfile.profileId`，设计阶段 `manufacturingProfile` 默认为 `null`；设计连接的 `manufacturingRuleId` 也默认为 `null`。设计型材只描述截面、槽、封边、长度和几何关系，设计连接只描述结构意图；真实材料、真实五金和连接派生加工后置到制造配置。

> v0.34 起仅维护当前 Schema，不提供旧工程迁移。

## 1. Project

当前根字段：

```text
metadata
schemaVersion = 62
parts
assemblies
connections
constraints
dimensions
profileSections
manufacturing
editorState
```

`dimensions` 是正式持久化字段；内部 UI 变量名可能仍使用 `userDimensions` 表示“用户/驱动尺寸集合”，但 Project JSON 不存在 `userDimensions` 根字段。

## 1.1 参数化轮廓框

`Assembly.configurator = CONTOUR_FRAME`。`Assembly.parameters.points` 是唯一参数化事实源，派生 PROFILE 只用于渲染/连接/制造。v0.57 允许点拖动、边长直接输入、边插点和点删除；所有修改均整框重建。`presetType` 可记录 L/U/STAIR 快捷来源，但不改变业务类型。 v0.58 增加 `parameters.simpleConstraints`；v0.59/v0.60 增加关系画布可视化与装配说明；v0.61 增加关系就地编辑，仍不新增持久化关系字段。关系类型仍为：`EQUAL_LENGTH / PARALLEL / ALIGN_POINTS`，仅作为玩家层轻量关系，不替代全局 Constraint。拓扑插点/删点时清空简单关系。

示例：

```json
{
  "simpleConstraints": [
    {"id":"REL-1","type":"EQUAL_LENGTH","edgeA":0,"edgeB":2},
    {"id":"REL-2","type":"PARALLEL","edgeA":1,"edgeB":3},
    {"id":"REL-3","type":"ALIGN_POINTS","pointA":0,"pointB":3,"axis":"z","mode":"HORIZONTAL"}
  ]
}
```




## 1.2 CAD 交互状态

v0.63 在 `editorState.cadInteraction` 中持久化基础交互偏好；这些字段只影响编辑器体验，不改变制造几何事实：

```json
{
  "transformSpace": "world",
  "workPlane": "XZ",
  "workPlaneVisible": true,
  "movementStepMm": 5,
  "rotationStepDeg": 15,
  "moveScope": "SINGLE"
}
```

`moveScope` 可取 `SINGLE / CONNECTED / ASSEMBLY`。CONNECTED 只根据 `connections[]` 派生跟随集合，不建立新的持久化关系。绿色 `CONTACT` 也是实时展示状态，不写入 Project；只有 `connections[]` 中的 Connection 才表示真正连接。

## 2. Part

`PROFILE` 是当前制造链最完整的 Part：

```text
id / name / type
dimensions.length
dimensions.sectionSize
designProfile.profileId
designProfile.faceClosures
manufacturingProfile = null | {...}
profilePath
machiningItems
endCuts
position / rotation
assemblyId
hidden / locked
```

### Profile Path

直线和圆弧路径均由业务数据定义。弯型材至少包含：

```text
profilePath.type = ARC
profilePath.radius
profilePath.angleDeg
profilePath.plane
```

v0.34 的 `PROFILE_RADIUS` 和 `PROFILE_ARC_ANGLE` 尺寸可以直接驱动这些参数。

## 3. Constraint

约束统一使用当前语义模型，例如：

```json
{
  "id": "CST-001",
  "type": "RIGID_MATE",
  "sourcePartId": "P-001",
  "targetPartId": "P-002",
  "mateKind": "SLIDER",
  "solverMode": "SEMANTIC",
  "solverVersion": 9,
  "offsetMm": 0,
  "angleDeg": 90,
  "flipped": false,
  "semantic": {
    "sourceFeature": {},
    "targetFeature": {},
    "autoAlign": true,
    "distanceMode": null
  },
  "enabled": true,
  "suppressed": false
}
```

不要为了历史工程重新引入旧约束结构。

## 4. Profile Feature

Feature 是几何语义，不保存 renderer-only world point：

```json
{
  "type": "PROFILE_SLOT",
  "partId": "P-001",
  "face": "RIGHT",
  "stationS": 320,
  "slotId": "RIGHT-S2",
  "slotIndex": 1,
  "slotOffset": 15
}
```

世界位置由 Part Transform + station/path frame + face/slot offset 动态恢复。

## 5. Slot Definition

```json
{
  "id": "LEFT-S1",
  "face": "LEFT",
  "index": 0,
  "offset": -15,
  "width": 8.2,
  "source": "CATALOG_STANDARD"
}
```

ProfileDefinition 保存 `slotDefinitions`；Snap、Connection、Machining reference 统一引用同一个 `slotId`。

## 6. Assembly

```json
{
  "id": "A-001",
  "name": "第一层总成",
  "parentId": null,
  "hidden": false,
  "locked": false,
  "installationStep": 1,
  "installationNote": "先装底框，再固定立柱",
  "explodeDirection": {"x": 0, "y": 1, "z": 0}
}
```

爆炸后的临时 offset 不持久化。

## 7. Connection · 设计 / 制造分层

设计阶段 Connection 只保存连接意图：

```json
{
  "id": "C-001",
  "designType": "ANGLE_BRACKET",
  "type": "ANGLE_BRACKET",
  "manufacturingRuleId": null,
  "sourceProfileId": "P-001",
  "targetProfileId": "P-002",
  "sourceEnd": "END",
  "targetFace": "LEFT",
  "orientationMode": "AUTO_INNER",
  "sourceSlot": {"slotId":"FRONT-S1","face":"FRONT","offset":0,"stationS":600},
  "targetSlot": {"slotId":"LEFT-S2","face":"LEFT","offset":15,"stationS":350}
}
```

制造配置完成后才绑定：

```text
manufacturingRuleId = ANGLE_BRACKET_30_M6
```

随后 `ConnectionManager.rebuild()` 才生成真实角码、T 螺母、螺钉以及连接派生加工。自动派生数据继续通过 `generatedByConnectionId` 追溯到 Connection。

合法 `designType`：

```text
ANGLE_BRACKET
INTERNAL_CONNECTOR
ANCHOR_CONNECTOR
CONNECTION_PLATE
END_SCREW
```

真实制造规则必须和 `designType` 同类型；制造规则变化不改变 Connection ID。

## 8. Machining Feature

普通面加工示例：

```json
{
  "id": "M-001",
  "type": "OBROUND_SLOT",
  "featureVersion": 1,
  "featureType": "OBROUND_SLOT",
  "face": "FRONT",
  "stationS": 120,
  "offset": 0,
  "length": 30,
  "width": 8,
  "orientation": "ALONG_PROFILE",
  "referenceDatum": "SLOT_CENTER",
  "reference": {
    "datum": "SLOT_CENTER",
    "face": "FRONT",
    "stationS": 120,
    "offset": 0,
    "slotId": "FRONT-S1"
  }
}
```

端面加工使用：

```text
end = START | END
offsetX
offsetY
```

复合孔通过 `featureGroupId` 聚合。

## 9. Dimension · v0.34

统一尺寸实体示例：

```json
{
  "id": "DIM-001",
  "type": "LINEAR",
  "anchorStart": {
    "type": "PART_BOUNDARY",
    "partId": "P-001",
    "axis": "Y",
    "side": "MAX"
  },
  "anchorEnd": {
    "type": "PART_BOUNDARY",
    "partId": "P-002",
    "axis": "Y",
    "side": "MIN"
  },
  "binding": {
    "type": "PART_CLEARANCE",
    "sourcePartId": "P-001",
    "targetPartId": "P-002",
    "axis": "Y"
  },
  "chain": {
    "id": "CHAIN-001",
    "mode": "CONTINUE",
    "order": 0,
    "axis": "Y",
    "datumPartId": "P-001",
    "clearance": true
  },
  "layout": {
    "auto": true,
    "axis": "Y",
    "lane": 0,
    "side": -1
  }
}
```

### Dimension Type

- `LINEAR`
- `ANGULAR`
- `RADIAL`
- `ORDINATE`

### Chain Mode

- `SINGLE`
- `BASELINE`
- `CONTINUE`
- `ORDINATE`

### Anchor

当前统一支持：

```text
WORLD
PART_ORIGIN
PART_BOUNDARY
PROFILE_END
PROFILE_ARC_CENTER
PROFILE_ARC_STATION
LOCAL_POINT
MACHINING_POINT
MACHINING_STATION_POINT
MACHINING_FACE_CENTER
PROFILE_SLOT_CENTER
```

### Binding

当前主要驱动类型：

```text
PROFILE_LENGTH
PROFILE_RADIUS
PROFILE_ARC_ANGLE
MACHINING_STATION
MACHINING_OFFSET
PART_AXIS_DISTANCE
PART_AXIS_COORDINATE
PART_CLEARANCE
SLOT_CENTER_DISTANCE
PROFILE_ANGLE
```

`MACHINING_STATION.datumEnd` 支持 `START/END`，因此同一个加工 Feature 可用 A 端或 B 端表达，不创建两个冲突驱动。

## 10. editorState

当前需要保留的系统版本/默认值包括：

```text
profileDrawToolVersion
featureSnapVersion
drawingDefaults
connectorSystemVersion
slotCatalogVersion
hardwareBomVersion
autoConnectorRecommendation
machiningFeatureSystemVersion
machiningReferenceVersion
machiningCollisionCheckVersion
machiningRectangularPatternVersion
dimensionSystemVersion = 2
engineeringDrawingSystemVersion = 1
profileGripEditingVersion = 1
profileGripDefaults.enabled / minLengthMm / gridSnap / gridStepMm / featureSnap / featureSnapDistanceMm
engineeringDrawing.projectName / revision / paper
```

`editorState` 用于编辑器行为与显示偏好，不应成为制造事实的唯一来源。


## 11. Engineering Drawing settings · v0.37

`editorState` 新增：

```json
{
  "engineeringDrawingSystemVersion": 2,
  "engineeringDrawingDxfVersion": 1,
  "engineeringDrawing": {
    "projectName": "未命名工程",
    "revision": "A",
    "paper": "A3",
    "sideView": "RIGHT"
  }
}
```

Drawing Model 本身当前不持久化到 Project JSON；它是由当前 Project Model 确定性生成的派生二维模型。Factory Package 会额外写出 `总装工程图_model.json` 便于审计；SVG/DXF 都由同一 Drawing Model/Layout 派生。


## 12. Profile Grip editorState · v0.36

Grip 本身是交互层，不持久化 3D Handle；只持久化编辑偏好：

```json
{
  "profileGripEditingVersion": 1,
  "profileGripDefaults": {
    "enabled": true,
    "minLengthMm": 10,
    "gridSnap": true,
    "gridStepMm": 10,
    "featureSnap": true,
    "featureSnapDistanceMm": 28,
    "axisSnapToleranceMm": 3
  }
}
```

长度编辑结果仍写入 Part：`profilePath.length`、`dimensions.length`、`position`。Grip Mesh、hover、typed buffer、drag snapshot 都是 renderer-only state，不得写入 Project JSON。

## 13. Engineering Drawing DXF · v0.37

工程 JSON 不持久化 DXF entity；只持久化当前项目业务模型和 drawing settings。DXF 是派生产物。

`editorState`：

```json
{
  "engineeringDrawingSystemVersion": 2,
  "engineeringDrawingDxfVersion": 1
}
```

总装/子装配 DXF 的数据源是 `EngineeringDrawingModel + EngineeringDrawingLayout`，不是 Scene/Mesh。

## 14. BOM / Manufacturing Reports · v0.38

BOM 与 CSV 是当前 Project Model 的派生产物，不持久化为新的 Project 根数组。

`editorState`：

```json
{
  "hardwareBomVersion": 2,
  "bomReportVersion": 1
}
```

`manufacturing` 仅允许：

```json
{
  "unit": "mm",
  "strictExport": true,
  "minimumEndDistanceMm": 8,
  "duplicatePositionToleranceMm": 0.05
}
```

当前合法 Part 类型仅 `PROFILE / SHAFT / PANEL / ACCESSORY`。Schema 57 不承载 stock length、kerf、offcut、inventory 等原料字段。

报表粒度：
- BOM：聚合语义；
- `cut-list.csv`：PROFILE 实例语义；
- `machining.csv`：MachiningFeature 实例语义。


## 15. Production Inspection · Schema 57

`manufacturing` 新增运行容差：

```json
{
  "collisionToleranceMm": 0.5,
  "contactToleranceMm": 1
}
```

Validation issue 可以携带 `partIds`、`assemblyId`、`details`、`category`，这些是报告/定位信息，不是新的 Part 类型。`editorState` 记录 `productionInspectionVersion=1`、`profileCollisionCheckVersion=1`、`connectionCompletenessCheckVersion=1`。

## 13. Database Profile Catalog

`profile_catalog` 是目录主数据，不是 Project Part。数据库记录经 REST 注册为 `ProfileDefinition`：

```text
id / nominal / variant / name
series / system
sectionSize
slotWidth / slotDefinitions
wallThicknessOptions / defaultWallThickness
alloy / crossSectionStyle / sourceFamily
section (optional real section JSON)
```

Part 仍保存 `profileSpec` 与自身 dimensions/path/machining，不直接持久化 JDBC 行对象。

## 16. CAD Interaction State · Schema 57

`editorState.cadInteractionVersion = 2`。仅持久化用户可恢复的编辑偏好：`transformSpace / workPlane / workPlaneVisible`。套索路径、hover Feature、循环选择索引等临时状态禁止进入 Project JSON。


## 17. Manufacturing Configuration · v0.50

`editorState.manufacturingConfigurationVersion = 1`。正式制造输出要求所有 PROFILE 已配置 `manufacturingProfile.profileId`，所有 Connection 已配置 `manufacturingRuleId`。制造型材更换后必须重新校验相关制造连接，槽宽不兼容时清除旧制造规则并回到待配置。


## 17. Manufacturing Identity · Schema 57

制造编号写入当前工程并由 `ManufacturingIdentityManager` 统一维护：

- `Pxxx`：型材；
- `Bxxx`：板材；
- `Sxxx`：光轴；
- `Axxx`：独立配件；
- `Hxxx`：连接自动派生五金；
- `Cxxx`：设计/制造连接；
- `Mxxx`：加工项；
- `Gxxx`：组件。

BOM、Tagged Drawing、装配步骤和制造包只能引用这套编号，禁止导出器临时生成第二套 Tag。


## 18. Parametric Contour Frame · Schema 57

轮廓框不新增 PartType。派生几何仍为普通 `PROFILE`，参数化事实保存在 Assembly：

```json
{
  "configurator": "CONTOUR_FRAME",
  "parameters": {
    "catalogId": "DESIGN-3030",
    "plane": "XZ",
    "orthogonal": true,
    "gridSnap": true,
    "gridStepMm": 10,
    "points": [{"x":0,"y":0,"z":0}],
    "edgeLengths": [1000]
  }
}
```

`points` 是唯一轮廓事实源。修改轮廓点或边长后，轮廓派生 PROFILE 和相关设计连接允许整体重建。
