# BOM / Manufacturing Reports · v0.38

## 1. 目标

把在线设计模型转换成加工/装配可直接消费且可追溯的制造清单。v0.38 不承担原料库存或 cutting-stock 优化。

数据链：

```text
Project Parts / Assembly / Hardware / MachiningFeature
        ↓
BomExporter
        ├─ Project Summary
        ├─ Profile BOM
        ├─ Hardware BOM
        ├─ Machining BOM
        ├─ Subassembly BOM
        ├─ Cut List (instance-level)
        └─ Machining List (feature-level)
        ↓
Consistency Validation
        ↓
Factory Package
```

## 2. 两种粒度必须同时存在

### 汇总 BOM
回答“有多少”。

- 型材 BOM：相同规格/路径/端切聚合。
- 五金 BOM：按 SKU 聚合。
- 加工 BOM：按 Feature 语义和加工参数聚合，不按 S/offset 分组。
- 子装配 BOM：按 Assembly path 聚合。

### 实例清单
回答“具体加工哪一个”。

- `cut-list.csv`：每个 PROFILE 一行。
- `machining.csv`：每个 MachiningFeature 一行。

因此不能用聚合 BOM 替代逐件加工追溯。

## 3. cut-list.csv

主要列：
- 构件编号；
- 组件路径；
- 型材体系/名义尺寸/SKU；
- 路径类型；
- 切割/展开长度；
- 弯曲 R / Angle / Plane；
- A/B 端切；
- 是否需加工。

这里的“切割长度”是设计零件尺寸，不代表原料排料结果。

## 4. machining.csv

每个加工 Feature 一行：
- Part ID / displayId；
- Assembly path；
- 型材 SKU；
- Feature ID / type；
- face 或 A/B end；
- stationS；
- offset；
- referenceDatum；
- slotId；
- processStage；
- 参数化描述；
- generatedByConnectionId。

## 5. Assembly path

Part 只保存 leaf `assemblyId`。报表通过：

```text
AssemblyManager.ancestors(leaf)
  -> reverse root-to-leaf
  -> leaf
```

生成例如：

```text
总成 / 左侧框架 / 第二层
```

不要从 Three.js parent/child 关系推导。

## 6. BOM 一致性

`BomExporter.validateConsistency()` 当前检查：
- Part stable id；
- duplicate Part id；
- duplicate displayId（WARNING）；
- dangling assembly；
- 无效型材长度；
- Profile 分组数量与模型数量是否一致。

结果被 FactoryValidator 合并，因此 BOM ERROR 会阻止正式 Factory Package。

后续可继续增加：
- Connection 派生五金数量与规则期望值核对；
- Drawing balloon 与 BOM item id 对齐；
- 子装配汇总与项目总汇总双向 reconciliation。

## 7. Factory Package

v0.38 BOM 目录：

```text
BOM/
├─ 项目汇总.csv
├─ 型材BOM.csv
├─ 五金BOM.csv
├─ 加工BOM.csv
├─ 子装配BOM.csv
└─ 材料清单.csv
```

根目录另有：

```text
cut-list.csv
machining.csv
切割汇总.csv
加工分组.csv
BOM一致性报告.txt
BOM一致性报告.json
```

## 8. 明确禁止恢复的范围

除非用户未来明确改变范围，否则不要增加：
- StockCutOptimizer；
- 3m/4m/6m stock length；
- kerf nesting；
- offcut inventory；
- leftover reuse；
- stock purchase planning。

这些不属于当前在线型材设计器的产品目标。
