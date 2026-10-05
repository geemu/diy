# Online Profile Designer — 产品与交互定义

## 产品主链路

```text
选型材
  ↓
画/拖入 3D
  ↓
端点/面/槽吸附
  ↓
约束/连接
  ↓
加工
  ↓
尺寸
  ↓
二维工程图
  ↓
DXF/CAD
```

## v0.30 绘制语义

### LINE
点击起点 → 点击终点 → 一根真实 PROFILE。

### POLYLINE
点击起点 → 终点 → 生成 PROFILE → B端继续作为下一起点。

### RECTANGLE
工作平面两点定义包围矩形 → 4 根 PROFILE。

### BOX
点击基准位置 + W/D/H → 标准 3D 框架。

## Feature 层

当前：
- EndPoint / EndFace 统一以 PROFILE_END 表达
- SideFace = PROFILE_FACE
- SlotCenter = PROFILE_SLOT

后续：
- Axis
- Edge
- Corner
- HoleAxis
- ImportedSectionSlot

## UX 原则

- 普通 DIY 用户优先“画”和“吸附”，不要求先理解约束矩阵。
- 专业约束仍保存在底层，交互可逐步自动化。
- 吸附必须显示明确反馈。
- 数值输入应始终能覆盖鼠标近似操作。
- 所有最终绘制结果必须是可制造业务对象，而不是 renderer 临时几何。


## v0.31 online assembly workflow

在线设计主流程现在增加：

`绘制/拖入型材 → 成组 → 子装配 → 安装顺序 → 锁定/隔离 → 爆炸检查 → 连接/加工`。

爆炸图是纯展示模式，用于理解安装关系；它不会改变设计尺寸或加工坐标。后续 v0.32 连接件系统应直接挂接到 Assembly/Feature，而不是创建独立于装配树的孤立五金模型。



## v0.32 online connection workflow

在线设计主流程进一步变为：

`绘制/拖入型材 → Feature Snap → 装配层级 → 自动推荐连接方式 → 槽位匹配 → 派生加工/五金 → 生产检查`。

连接件不再自己估算槽中心。目录型材提供稳定 `slotDefinitions`，`SlotMatcher` 负责从当前安装面和接触位置解析最近 `slotId`；T 螺母等槽内五金保存 `mountReference`。自动推荐只负责候选排序，最终仍必须通过 Connection 几何/系列/槽位校验。

当前内置槽位是标准目录模型，不等同于自定义 DXF 自动识别的完整真实截面。后续导入企业/外部来源截面时，应允许其元数据覆盖目录槽定义。
