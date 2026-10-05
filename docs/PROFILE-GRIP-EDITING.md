# Profile Grip Editing · v0.36

## 1. 目标

提供在线型材 DIY 编辑器最常用的 CAD 式长度编辑：选中一根直型材后，直接拖 A/B 任一端改变真实长度，而不是对 Mesh 做缩放。

## 2. 坐标与端点语义

直型材局部 Z 为长度轴：

```text
A / START / local Z-  ─────────────  B / END / local Z+
```

拖 B：A 固定；拖 A：B 固定。

长度变化时新的构件中心为：

```text
center = fixedEnd + dragAxis * newLength / 2
```

因此 Grip 编辑同时修改：
- `profilePath.length`
- `dimensions.length`
- `part.position`

不修改 `scale`。

## 3. 关键文件

- `js/interaction/ProfileGripEditor.js`：Three.js Grip、指针交互、吸附、约束保护、提交/取消。
- `js/interaction/ProfileGripMath.js`：纯业务数学，加工 station 重映射等，可用 Node 回归。
- `js/geometry/ProfileGeometryFactory.js`：`rebuildLinearGroup()` 原地重建型材几何，保持 root Mesh/Group 身份稳定。
- `js/snap/SnapManager.js`：Grip Feature Snap，可排除当前型材。
- `js/core/Editor.js`：系统集成、当前项目导出、History、连接/约束刷新。

## 4. 交互

选中单根、未锁定、直线型材时显示 A/B Grip。

支持：
- 鼠标拖动。
- 网格长度吸附。
- 端点/型材面/槽中心 Feature Snap。
- 拖动时直接键入数字，Enter 提交。
- Esc 恢复拖动前状态。
- 双击 Grip 输入精确总长。
- Hover 预高亮。
- A/B 标签。

以下状态隐藏 Grip：
- 多选。
- 弯型材。
- 父级/自身锁定。
- 爆炸图状态。
- 在线绘制模式。
- 框选、测量、永久标注、Feature Selection 模式。

## 5. 连接/约束保护

如果当前型材作为约束/连接的 source，且该关系明确锚定被拖的 A/B 端，则对应 Grip 禁止直接拉伸。

若当前型材是其他约束的 target，则允许修改长度；提交后调用：

```text
ConstraintManager.solveForChangedParts
ConnectionManager.updateConnectionsForProfile
```

使依赖该型材的其他构件重新求解。

当前策略是保护已有连接语义，不允许用 Grip 绕过正式 Constraint/Connection 系统。

## 6. 加工 Feature 重映射

加工 `stationS` 仍以 A 端为内部主坐标，但 `referenceDatum` 决定拉伸时的保持语义。

### A_END

```text
old stationS = 100
new stationS = 100
```

无论拖 A/B，Feature 始终保持距当前 A 端 100mm。

### B_END

保存原来的 B 端距离：

```text
fromB = oldLength - oldStationS
newStationS = newLength - fromB
```

因此 Feature 始终保持距当前 B 端同样距离。

端面加工 `END_*` 不需要 station 重映射，继续依附 START/END。

## 7. History

拖动过程不创建大量历史快照。

```text
pointer down -> 保存原始状态
pointer move -> preview
pointer up / Enter -> capture 1 次
Esc -> 恢复原始状态，不新增 History
```

## 8. 当前边界

- v0.36 只对 `LINE` 型材提供端点 Grip；ARC 弯型材仍通过 R/角度尺寸编辑。
- Feature Snap 是沿型材轴的一维长度吸附，不允许仅通过长度变化产生横向位移。
- 复杂双端同时受全局约束时，Grip 不替代通用参数化求解；被明确 source-end 锁定的端点直接禁止拉伸。
- 缩短型材导致加工 Feature 超出可制造区时会夹到合法 station；FactoryValidator 仍是正式生产 Gate。
