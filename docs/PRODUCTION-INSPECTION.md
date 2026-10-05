# Production Inspection · v0.39

## 1. 目标

生产检查不是单纯的“孔位校验”。它是 Factory Package 导出前的统一 Gate，当前覆盖：

```text
MachiningFeature
Connection
Constraint
BOM consistency
Assembly semantics
Straight-profile collision
Geometric contact without connection
```

`ERROR` 阻止正式 Factory Package；`WARNING` 允许用户人工确认后继续导出。

## 2. 直型材体积碰撞

实现：`js/validation/PartCollisionDetector.js`。

直型材被转换为制造包络 OBB：
- local X/Y = 截面宽高；
- local Z = 型材长度；
- center/rotation 直接来自业务 Part；
- 不读取 Three.js helper、加工标记或渲染包围盒。

两 OBB 使用完整 15 轴 SAT：
- A 的 3 个局部轴；
- B 的 3 个局部轴；
- 9 个交叉轴。

默认 `collisionToleranceMm = 0.5`。仅当体积穿透量大于容差时产生：

```text
PROFILE_VOLUME_COLLISION / ERROR
```

正常端面接触（penetration≈0）不算碰撞。

### 当前边界

v0.39 的精确生产碰撞只承诺**直型材包络 OBB**。弯型材、复杂附件、真实槽腔实体布尔、螺钉工具空间和夹具干涉尚未做精确实体判定。存在弯型材时报告会增加 `CURVED_PROFILE_COLLISION_SCOPE / INFO`，不得把这一项描述成“已经完成全实体碰撞”。

## 3. 连接完整性

实现：`js/validation/ConnectionCompletenessInspector.js`。

检查逻辑：
1. 获取每根直型材 A/B 端点世界坐标；
2. 判断端点是否在其他型材 OBB 某一表面附近；
3. 默认接触容差 `contactToleranceMm = 1`；
4. 若几何接触存在，但两个构件之间没有有效 Connection，也没有启用的 Constraint，则产生：

```text
GEOMETRIC_CONTACT_WITHOUT_CONNECTION / WARNING
```

这是 WARNING 而不是 ERROR，因为“几何接触但没有连接件”可能是设计者有意暂时保留的状态。

一旦补充 Connection 或启用 Constraint，相同构件对不会继续报告该项。

## 4. Assembly 诊断

`FactoryValidator` 会合并现有 `AssemblyInspector`：
- `DANGLING_CONNECTION`
- `DANGLING_CONSTRAINT`
- `EMPTY_ASSEMBLY`
- `DISCONNECTED_ASSEMBLY`

因此 UI 的“生产检查”是统一入口，不要求用户分别打开多个诊断窗口才能知道是否可生产。

## 5. 加工与 BOM

沿用并整合现有检查：
- 加工位置越界；
- 截面越界；
- 加工 Feature footprint 冲突；
- 端面加工深度/直径；
- 连接派生加工与五金完整性；
- slotId / T 螺母匹配；
- 约束冲突；
- BOM reconciliation。

## 6. 可定位问题

新的 collision / completeness / assembly issue 携带：

```json
{
  "partIds": ["...", "..."],
  "details": {}
}
```

校验窗口提供“定位模型”。调用 `Editor.focusDiagnosticIssue()` 后：
- 自动选中相关构件；
- 使用现有 selection highlight；
- camera frame 到问题区域。

不要把错误高亮实现成持久化 Part 颜色修改；它属于 editor presentation state。

## 7. Factory Package

v0.39 将统一报告改名为：

```text
生产检查报告.txt
生产检查报告.json
```

报告中的 `categories` 用于快速区分：

```text
MACHINING
CONNECTION
COLLISION
ASSEMBLY
BOM
CONSTRAINT
OTHER
```

## 8. 测试

专项：`tools/verify-production-v040.mjs`。

必须至少验证：
- 端面接触不算碰撞；
- 超过 0.5mm 的体积穿透可检出；
- 交叉直型材可检出；
- 几何接触但无 Connection/Constraint 有 WARNING；
- 建立 Connection 后该 WARNING 消失；
- `FactoryValidator` 能把碰撞升级为 Factory Gate ERROR；
- UI 有定位入口。
