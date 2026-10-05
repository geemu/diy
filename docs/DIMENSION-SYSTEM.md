# Dimension System — v0.34

## 1. 目标

把尺寸从“场景里画几条线”提升为可持久化、可驱动、可被工程图/DXF 消费的 CAD 语义实体。

核心原则：**Dimension 保存语义 Anchor/Binding，不保存偶然世界坐标作为主事实。**

## 2. Dimension Entity

```json
{
  "id": "D-...",
  "type": "LINEAR | ANGULAR | RADIAL | ORDINATE",
  "anchorStart": {},
  "anchorEnd": {},
  "binding": {},
  "drivingValue": 350,
  "chain": {},
  "layout": {},
  "semantic": "CLEARANCE",
  "offsetWorld": {"x":0,"y":0,"z":0},
  "labelOffsetPx": {"x":0,"y":-16},
  "text": null
}
```

`start/end` 仍可缓存最近解析结果，但 Anchor 才是关联事实。

## 3. Anchor

当前支持：
- WORLD
- PART_ORIGIN
- PART_BOUNDARY
- LOCAL_POINT
- PROFILE_END
- PROFILE_SLOT_CENTER
- PROFILE_ARC_CENTER
- PROFILE_ARC_STATION
- MACHINING_POINT
- MACHINING_STATION_POINT
- MACHINING_FACE_CENTER

### PART_BOUNDARY

用于正交框架的净间距。边界只使用构件自身 geometry bounding box，经 matrixWorld 转换；不把 machining helper 子对象算进边界。

## 4. Binding

### 参数驱动
- PROFILE_LENGTH
- PROFILE_RADIUS
- PROFILE_ARC_ANGLE
- MACHINING_STATION
- MACHINING_OFFSET

### 构件关系驱动
- PART_AXIS_DISTANCE
- PART_AXIS_COORDINATE
- PART_CLEARANCE
- SLOT_CENTER_DISTANCE
- PROFILE_ANGLE

## 5. 尺寸链

### BASELINE

统一 datum 到多个 target：

```text
Datum ─── P1
Datum ───────── P2
Datum ───────────── P3
```

### CONTINUE

连续相邻：

```text
P0 ─ P1 ─ P2 ─ P3
```

### ORDINATE

首构件为零基准：

```text
Y=120
Y=350
Y=700
```

### CLEARANCE

使用 PART_BOUNDARY 的 MAX -> MIN，不使用中心距，适合层间净尺寸。

## 6. A/B 端加工基准

`MACHINING_STATION.binding.datumEnd`：
- START：显示/驱动 A 端到 Feature 的距离。
- END：显示/驱动 B 端到 Feature 的距离。

制造事实仍存 `stationS`（A 端沿中心线累计）。B 端尺寸只是 `L - stationS` 的设计/标注表达。

## 7. 弯型材

### 半径

- type = RADIAL
- binding = PROFILE_RADIUS
- anchorStart = PROFILE_ARC_CENTER
- anchorEnd = PROFILE_ARC_STATION(0.5)

### 圆弧角

- type = ANGULAR
- binding = PROFILE_ARC_ANGLE
- SceneAnnotationManager 根据 arc center/start/end/plane 绘制角弧。

## 8. 自动排布

Dimension `layout`：

```json
{
  "auto": true,
  "axis": "Y",
  "lane": 2,
  "side": -1
}
```

SceneAnnotationManager 先做 3D lane 偏移，再做 DOM label 屏幕空间碰撞避让。用户手动拖文字后 `manualLabelOffset` 优先。

## 9. 后续给 v0.35 的接口

工程图不要重新推导尺寸语义。应直接把 Dimension entity 投影到 DrawingView：

```text
Dimension Anchor
  -> resolve in 3D
  -> project to DrawingView
  -> DrawingDimension primitive
  -> sheet layout / DXF DIMENSION/TEXT
```

后续新增局部坐标尺寸、工作平面 Ordinate 时，也应扩展 Anchor/Binding，而不是把二维结果写回 3D Project Model。
