# UI Interaction & Profile Catalog · v0.40

## 1. 目标

v0.40 同时解决两个问题：

1. 在线 CAD 编辑器的交互与视觉反馈更接近正式产品，而不是 Three.js Demo。
2. 型材型号从纯前端硬编码扩展为“内置目录 + 数据库自定义目录”，每个型号有截面示意图。

## 2. 交互优化

### Hover / Pre-highlight

普通选择模式下，鼠标经过可选构件时：

- 使用独立 `BoxHelper` 预高亮；
- 显示 `displayId + name/variant` 浮动标签；
- 已选中构件不重复显示 hover helper；
- 绘制、特征选择、测量、永久尺寸、框选、Grip 拖动期间自动关闭普通 hover，避免模式冲突。

实现入口：

- `SceneManager.setHover()` / `clearHover()`
- `Editor.sceneManager.pointerMoveHandler`

### Camera transition

正视/俯视/侧视/等轴测/聚焦不再瞬移，而是通过 `SceneManager.cameraTween` 进行约 260ms ease-out 过渡。
用户 pointer down 时立即取消 tween，避免动画与手动 Orbit 操作争抢相机。

### 高频快捷键

- `W`：移动
- `R`：旋转
- `S`：吸附开关
- `G`：网格开关
- `Q`：透视/正交切换
- `F`：聚焦
- `I`：隔离当前选择
- `H`：隐藏选择
- `Shift+H`：全部显示
- `B`：框选
- `M`：测量
- `D`：永久尺寸
- `1/2/3`：等轴测/正视/俯视

### UI polish

v0.40 只做 CSS/DOM 层产品化，不引入新的前端构建链：

- topbar、rail、panel、型材卡片层级重新整理；
- 按钮 hover/active 微动效；
- Modal / Toast / ContextMenu 入场动画；
- 搜索框 focus feedback；
- 型材卡片 hover lift；
- 小屏宽度下左右面板自动收窄；
- 继续保持纯 Vue global + ES Modules + 本地 Three.js。

## 3. 型材截面示意图

所有型材卡片改为调用：

```text
ProfileDefinition
  -> ProfileSectionRegistry.getSectionDefinition()
  -> sectionToSvg()
  -> 卡片 SVG 缩略图
```

优先级：

1. Project 自定义 DXF 截面；
2. 数据库目录真实 `section_json`；
3. 内置参数化参考截面。

因此 3030A / 3030C / 3060 / 4080 等型号不再只显示“30×30”文字块。

注意：内置参考截面用于区分和建模预览，不代表实际生产级真实内腔。生产级精度应绑定用户自定义真实截面 JSON/DXF。

## 4. 数据库型材目录

### 当前数据库

v0.45.0 起固定使用 SQLite；仍不使用 H2/JdbcTemplate。

```text
Controller -> Service -> Mapper -> Mapper.xml -> SQLite
```

默认连接与初始化配置位于 `src/main/resources/application.yml`；每次启动执行：

```text
classpath:sql/schema.sql
classpath:sql/data.sql
```

公共表名和字段列表统一维护在 `mapper/BaseMapper.xml`，业务 Mapper 通过 `<include>` 引用。


## 5. 自定义型材 UI

左侧“型材”面板：

- `刷新数据库型材`
- `＋ 自定义`

自定义 Modal 可填写：

- ID / 型号 / 规格族 / 系列节距
- 截面宽高
- 槽宽
- 默认壁厚与可选壁厚
- 体系 / 合金 / 名称 / 备注
- 可选真实 `section JSON`

保存后走 REST API 写入数据库，无需重新编译前端。

数据库型材在列表中显示“自定义”徽标并支持删除。

## 6. 数据边界

数据库 Profile Catalog 是“目录/主数据”，不是 Three.js 模型。

```text
DB profile_catalog
    ↓ REST
ProfileCatalog runtime registry
    ↓
Editor.addProfile()
    ↓
Part.profileSpec + dimensions + profilePath
    ↓
Three.js render mesh
```

严禁直接用数据库行对象作为 Mesh 持久化对象。

## 7. 当前边界 / 下一步

v0.40 当时尚未做（v0.41 已补部分）：

- 数据库型材后台权限/RBAC；
- 自定义 DXF 自动上传后直接写 `section_json`；
- 型材目录版本审批；
- 企业多租户；
- 真正自由套索（当前已有框选）；
- feature-level hover pre-highlight（当前普通 Part hover 已完成）；
- Gizmo 视觉重绘。

这些应在后续版本按在线 CAD 体验优先级继续推进。

## 8. 直接 SQL 录入示例

```sql
insert into profile_catalog(
  id, nominal, variant, name, series, system,
  width_mm, height_mm, slot_width_mm,
  wall_thickness_options_json, default_wall_thickness_mm,
  alloy, cross_section_style, source_family,
  note, enabled, sort_order
) values (
  'DB-EU30-3030-HEAVY', '3030', '3030-HV', '企业重型3030', '30', '自定义',
  30, 30, 8.2,
  '[1.8,2.0,2.5]', 2.5,
  'A6063-T5', 'DATABASE_CUSTOM', 'DATABASE',
  '内部企业型材', true, 100
);
```

如果有真实截面，可额外写 `section_json`；没有则编辑器按宽高/槽宽/系列生成参数化参考截面示意图。
