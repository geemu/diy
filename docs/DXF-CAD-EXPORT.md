# DXF / CAD Export · v0.37

## 1. 目标

v0.37 将 v0.35 建立的 `EngineeringDrawingModel + EngineeringDrawingLayout` 正式接入 DXF，形成统一二维工程图导出链：

```text
Project / Assembly
      ↓
EngineeringDrawingModel
      ↓
EngineeringDrawingLayout
      ├─ EngineeringDrawingSvgExporter
      └─ EngineeringDrawingDxfExporter
```

SVG 和 DXF **必须消费同一 Drawing Model/Layout**。禁止从 Three.js Scene 再写一套 DXF 投影逻辑。

## 2. DXF 类型

当前总装/子装配 DXF 是 **2D engineering drawing sheet DXF**：

- 单位：mm (`$INSUNITS = 4`)
- DXF 版本：AutoCAD 2000 / `AC1015`
- 坐标：A3/A4 图纸坐标，CAD Y 轴向上
- 正/俯/左或右/等轴测布局与 SVG 一致
- 正交视图使用工程图标准比例；ISO 独立 fit-to-cell

这不是 3D Mesh dump，也不是“将 Three.js 顶点直接写 DXF”。

## 3. 图层

固定图层合同：

| Layer | 用途 |
|---|---|
| `PROFILE` | 构件可见轮廓 |
| `CENTER` | 构件中心线 |
| `DIMENSION` | 尺寸线、界线、箭头、尺寸文字 |
| `TEXT` | 项目/构件/标题文字 |
| `TITLEBLOCK` | 外图框和标题栏 |
| `VIEW` | 视图名称/视图级标识 |
| `HIDDEN` | 预留隐藏线；当前尚未做真实 HLR |

`CENTER` 使用 CENTER linetype，`HIDDEN` 使用 DASHED linetype。

## 4. 可编辑实体

v0.37 总装 DXF 主要输出：

- `LINE`：轮廓、中心线、尺寸线、图框
- `TEXT`：标题、视图名、尺寸值
- `SOLID`：尺寸箭头

尺寸当前采用**显式几何 + TEXT**，而不是 AutoCAD associative `DIMENSION` object。原因：当前 Drawing Model 已提供稳定尺寸语义；显式实体在 AutoCAD/浩辰/LibreCAD 等环境兼容性更可控。后续如确认目标加工厂 CAD 版本，可再增加 associative DIMENSION writer。

## 5. Unicode

DXF 文本使用 Autodesk `\\U+XXXX` Unicode escape，避免旧加工 DXF 的 ASCII-only 清洗导致中文项目名/视图名丢失。

## 6. Factory Package

```text
装配工程图/
├─ 总装工程图_A3.svg
├─ 总装工程图_A3.dxf
├─ 总装工程图_model.json
├─ DXF图层说明.json
└─ 子装配/
   ├─ 01_xxx.svg
   ├─ 01_xxx.dxf
   └─ ...
```

单件加工 DXF、弯曲 DXF、斜切 DXF 仍由原制造图链输出。

## 7. 验证

`tools/verify-engineering-dxf.mjs` 验证：

- AC1015 / mm header
- 固定 7 图层
- LINE/TEXT/SOLID 实体
- DIMENSION/CENTER 图层实体
- Unicode escape
- UI / Service / Factory Package 接线

交付时还应将真实样例生成的 DXF 用独立 DXF parser/CAD 打开验证。v0.37 开发阶段使用 `ezdxf` 成功重新解析鱼缸架 A3 总装 DXF。

## 8. 当前边界 / 下一步

- `HIDDEN` 图层已固定，但真正 hidden-line removal 尚未实现。
- 尚未做剖视、局部放大、断裂视图。
- 尚未做 BOM 气泡/自动引出线。
- 当前总装 DXF 是图纸空间式二维版面，不是 1:1 多视图 model-space export。
- 单件加工 DXF 的 layer naming 还没有完全统一到本合同。
- 相同加工型材的组合/分组 DXF 仍待增强。
