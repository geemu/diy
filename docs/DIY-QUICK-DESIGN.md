# DIY 快速设计

## 目标

DIY 快速设计面向不会 CAD 的玩家。用户先描述“我要做什么”和尺寸，再由模板生成标准工程构件；生成后仍可进入现有 CAD 工具继续编辑。

## 架构

```text
DiyTemplateCatalog
      ↓
DiyGenerator
      ↓
Editor.addFrame / Editor.addLayeredRack
      ↓
Project Part
      ↓
AutoConnectionResolver
      ↓
ConnectionManager
      ├─ Connector / Fastener
      └─ Machining
      ↓
Three.js / BOM / Drawing / Factory Package
```

禁止：

- DIY 模板直接 new Three.js Mesh；
- DIY 模板维护另一套 parts/connections 数组；
- 模板绕过 ConnectionManager 直接伪造连接件或加工；
- 根据模板名称写死 BOM。

## 当前模板

| 模板 | 生成器 | 默认用途 |
|---|---|---|
| BASIC_FRAME | FRAME | 最简单空间框 |
| STORAGE_RACK | LAYERED_RACK | 多层置物架 |
| TURTLE_TANK_RACK | LAYERED_RACK | 鱼缸/龟缸多层架 |
| MACHINE_FRAME | LAYERED_RACK | 设备机架 |

## 当前参数

- 型材型号；
- 宽度；
- 深度；
- 高度；
- 层数；
- 每层中间承托梁数量；
- 是否自动连接（默认开启）。

## v0.46 自动连接

模板完成结构生成后，会只扫描本次新建的 PROFILE：

1. `SnapManager.collectCandidates()` 识别端到面/槽的真实几何候选；
2. `AutoConnectionResolver` 合并 A→B / B→A 的同一物理接头，并限制同一源端只自动连接一次；
3. `ConnectionManager.recommendFor()` 选择第一个通过几何验证的规则；
4. `ConnectionManager.createConnection()` 统一生成 Connection、硬件和加工；
5. BOM、工程图和制造包继续读取原业务模型。

用户可以在 DIY 表单关闭“自动连接”，只生成裸框。自动连接失败不会阻止结构生成。

## 后续优先级

1. 层高支持逐层编辑，不只等距。
2. 可选脚杯、脚轮、端盖、层板、门板等组件。
3. 参数改动可重算已有模板实例，而不是只重新生成。
4. 模板预览图、收藏和本地模板库。
5. 自然语言只作为模板参数入口，不另建 AI 专属模型。
