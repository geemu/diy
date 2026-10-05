# Machining Feature System

## 目标

把“孔列表”升级为可扩展的制造 Feature 层，使连接派生加工、手工加工、阵列、镜像、工程图、DXF、BOM 和 FactoryValidator 共享同一业务语义。

## 支持的 Feature

### 面加工
- `THROUGH_HOLE`
- `COUNTERSINK`
- `COUNTERBORE`
- `BLIND_HOLE`
- `TAPPED_HOLE`
- `SLOT`
- `OBROUND_SLOT`
- `MILLING_REGION`

### 端面加工
- `END_TAP`
- `END_HOLE`
- `END_COUNTERBORE`
- `END_COUNTERSINK`

## 坐标与基准

制造主坐标：

```text
A端 ---- stationS ----> B端
加工面: FRONT/BACK/LEFT/RIGHT
面内横向: offset
```

设计基准 `referenceDatum`：
- `A_END`
- `B_END`
- `FACE_CENTER`
- `SLOT_CENTER`
- `END_FACE`

`referenceDatum` 不替代 stationS/offset，只说明该 Feature 的定义/标注参考。

## 复合孔

基础孔与沉头/沉孔共享 `featureGroupId`；secondary 同时保留 `linkedHoleId` 指向基础孔。

这样可以：
- UI 显示为一组。
- Drawing 生成一个 Hole Unit。
- Validator 不把同组重合误判为冲突。
- `linkedHoleId` 用于同一当前 Schema 内 secondary feature 指向基础孔。

## Pattern

### Linear

```json
{
  "patternSource": {
    "id": "...",
    "type": "LINEAR",
    "count": 4,
    "spacingMm": 50
  }
}
```

### Rectangular

```json
{
  "patternSource": {
    "id": "...",
    "type": "RECTANGULAR",
    "countS": 4,
    "spacingS": 50,
    "countOffset": 2,
    "spacingOffset": 15
  }
}
```

阵列成员仍是普通 Feature，保存 `pattern` 元数据。

## Mirror

- `FACE_OFFSET`：offset 取反。
- `OPPOSITE_FACE`：FRONT/BACK、LEFT/RIGHT 互换。
- `END`：普通加工 `stationS = L - stationS`；端面加工 START/END 互换。

## Validation

`featureFootprint()` 把面加工投影为制造面的 2D 占位：

```text
X = stationS
Y = offset
```

用于：
- 长度边界。
- 截面面宽边界。
- 特征间重叠。

这是保守 AABB/正交 footprint，不是最终任意轮廓布尔求交。

## Drawing / DXF

`MachiningUnitBuilder` 统一输出：
- `HOLE_UNIT`
- `SLOT_UNIT`
- `MILLING_UNIT`
- `END_FEATURE_UNIT`

DXF 新加工语义层包括：
- `SLOT`
- `OBROUND_SLOT`
- `MILLING`
- `HOLE`
- `THREAD`
- `COUNTERSINK`
- `COUNTERBORE`
- `CENTER`
- `DIMENSION`
- `TEXT`

## 扩展新 Feature 的固定步骤

新增任何加工类型时必须同步：
1. `MachiningFeatureCatalog` 类型与 normalize。
2. `MachiningManager` 创建 API。
3. 3D 加工标记。
4. `featureFootprint`/Validator。
5. `MachiningUnitBuilder`。
6. `DrawingGenerator`。
7. `DxfExporter`。
8. `BomExporter.detail()`。
9. UI 属性编辑。
10. 更新当前 `ProjectSchema` / 数据文档（不维护历史 migration）。
11. 专项回归。

禁止只在 UI 新增一个按钮而不补制造/导出语义。
