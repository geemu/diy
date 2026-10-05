# CAD Interaction 2.0 · v0.41

## 目标

让在线设计器从“能操作 Three.js 对象”进一步接近 CAD：复杂装配中可选中正确构件、鼠标经过能识别真实 Feature、移动/旋转可使用局部坐标、工作平面可见，并通过类型化右键菜单减少操作路径。

## 1. 自由套索

`SceneManager` 维护套索 pointer 状态机。套索与矩形框选互斥。结束套索后调用 `pickInScreenPolygon()`，将构件世界包围盒中心和角点投影到屏幕，通过点在多边形内判断交互命中。

该算法仅用于选择，不允许用于加工、碰撞或尺寸计算。

## 2. 穿透/循环选择

`SelectionCycleManager` 保存最近点击屏幕点、候选 ID 顺序、时间和当前索引。Alt + 单击时 `SceneManager.pickRoots()` 返回同一射线下按距离排序的业务根对象，重复 Alt + 单击在候选中循环。

这样不会为了选择后方构件而强迫用户旋转相机。

## 3. Feature 级预高亮

`FeatureHoverManager` 通过 `ProfileFeatureCatalog.resolveProfileFeature()` 解析：
- A/B 端点；
- LEFT/RIGHT/FRONT/BACK 侧面；
- 显式 `slotId` 槽中心。

槽中心不得在 Hover 层重新近似计算。Feature 高亮只产生展示图元，不写 Project JSON。

## 4. World / Local Gizmo

`Editor.setTransformSpace()` 委托 `SceneManager.setTransformSpace()`。`world` 使用工程全局 XYZ；`local` 跟随当前主选择构件自身旋转。

切换坐标空间不修改 Part rotation，也不改变 Project Coordinate System。

## 5. 工作平面

`WorkPlaneVisualizer` 显示 XY/XZ/YZ 半透明 Grid，并与 `ProfileDrawTool.options.plane` 同步。工作平面是交互提示，实际鼠标到平面的求交仍由 DrawTool/SceneManager 完成。

## 6. 右键菜单

Profile：精确 A/B 端拉伸、加工入口、连接/约束入口、复制/阵列/镜像、成组/锁定/隐藏/删除。

Accessory：属性入口 + 通用编辑操作。

后续如果 MachiningFeature / Dimension 变成统一可点选实体，再扩展对应菜单，不应在当前阶段伪造不存在的实体选择模型。

## 7. 中文注释与代码风格

本版本新增模块必须用中文解释：状态机为什么互斥、世界/局部坐标的边界、Feature 单一事实来源、presentation-only 数据不能持久化。避免逐行注释和无意义缩写。
