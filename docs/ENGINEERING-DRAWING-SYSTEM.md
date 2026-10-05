# Engineering Drawing System · v0.37

## 1. 目标

v0.35 新增正式二维工程图中间层，不再把 Three.js Scene 直接当作二维 CAD 数据源。

统一链路：

```text
Project / Parts / Assembly
        ↓
EngineeringDrawingModel
        ↓
DrawingView primitives
        ↓
EngineeringDrawingLayout
        ↓
SVG / DXF
```

现有单根型材加工图 `DrawingGenerator` 继续负责加工详图；总装/子装配工程图由新 Engineering Drawing System 负责。

## 2. 关键文件

- `js/drawing/EngineeringDrawingModel.js`
- `js/drawing/EngineeringDrawingLayout.js`
- `js/drawing/EngineeringDrawingSvgExporter.js`
- `js/drawing/EngineeringDrawingDxfExporter.js`
- `js/drawing/EngineeringDrawingService.js`

## 3. Drawing Model

当前总装 Drawing Model 包含：

```text
modelVersion
drawingType = ASSEMBLY
scope
metadata
bounds3d
overall
views.FRONT
views.TOP
views.RIGHT
views.ISO
```

每个 `DrawingView` 包含：
- `entities`：构件二维轮廓。
- `centerLines`：中心线。
- `bounds`：视图二维范围。
- `dimensions`：总尺寸 + 正/侧视图自动层间链尺寸。

二维 Entity 不保存 Three.js Mesh 引用，只保存业务 `partId/displayId/type/name` 和二维几何。

## 4. 投影视图

已实现：
- FRONT 正视图
- BACK 后视图（模型层可用）
- TOP 俯视图
- BOTTOM 仰视图（模型层可用）
- LEFT 左视图（模型层可用）
- RIGHT 右视图
- LEFT 左视图
- ISO 等轴测示意

A3/A4 默认自动排版使用：TOP + FRONT + `RIGHT 或 LEFT` + ISO；工程设置可切换左右侧视图。

## 5. 页面布局

`EngineeringDrawingLayout`：
- A3 横向。
- A4 横向。
- 正/俯/右三视图使用统一比例。
- 自动选择标准工程比例，例如 `1:10 / 1:20 / 1:25 / 1:50`。
- ISO 独立 fit-to-cell。
- 下方保留标题栏。

## 6. 自动尺寸

v0.35 总装图已实现：
- 正视图总体 W/H。
- 俯视图总体 W/D。
- 右视图总体 D/H。
- 正/侧视图识别水平型材层位，并自动生成相邻层中心高度链。

这是工程图自动尺寸第一阶段。复杂 DimensionSystem 的永久尺寸完整投影、坐标尺寸、基准链复用将在后续继续增强。

## 7. SVG / DXF

`EngineeringDrawingSvgExporter` 与 `EngineeringDrawingDxfExporter` 共用 Model/Layout。SVG 输出：
- 外图框。
- 四视图。
- 可见轮廓。
- 中心线。
- 总尺寸/层间尺寸。
- 视图名称。
- A3/A4 标题栏。
- 项目名称、版本、比例、单位、总体尺寸、构件数。

复杂装配默认不强制显示每一个 Part ID，避免标签互相覆盖；BOM 气泡和自动引出线属于后续装配图专题。

## 8. Factory Package

v0.37 工厂包：

```text
装配工程图/
├─ 总装工程图_<A3|A4>.svg
├─ 总装工程图_<A3|A4>.dxf
├─ 总装工程图_model.json
├─ DXF图层说明.json
└─ 子装配/
   ├─ xxx.svg
   ├─ xxx.dxf
   └─ ...
```

`总装工程图_model.json` 用于调试/审计 Drawing Model；SVG/DXF 已同时由该模型生成。DXF 细节见 `DXF-CAD-EXPORT.md`。

## 9. 精度边界

当前总装轮廓采用 Part 业务尺寸 + Part Transform 推导二维投影。标准 LINE 型材、板材、光轴和规则附件可稳定表达。

弯型材总装轮廓当前按中心线采样 + 截面包络构建，用于装配图示意；精确弯型材加工仍使用专用弯曲加工图。

v0.37 当前尚未完成：
- 隐藏线消除。
- 真正剖视切割算法。
- 局部放大视图的交互创建。
- BOM 气泡/自动引出线。
- 复杂 DimensionSystem 所有语义尺寸到 Drawing 的完整映射。

这些能力不得通过直接 dump Three.js Scene 绕过 Drawing Model。
