# 快速搭建合并为通用框架 — v0.75.73 / 2026-10-12

## 已确认范围

用户询问鱼缸/龟缸、置物架等用途是否有不同生成规则，源码确认四个模板均LAYERED_RACK、主要默认差别为2/4/5/2层与0/1/1/1承托后，用户确认合并为通用框架、保持670×610×2000/五层一承托及所有结构选配，旧工程不重建。

本轮仅仓库源文件阅读/修改及资源交付，没有读取/改写桌面JSON、接管用户Chrome/草稿或参考网站采集；此前材料清单/导出的其他样例缺口不属于本次合并交付。

## 实施

- DiyTemplateCatalog新增DEFAULT_DIY_TEMPLATE_ID='GENERIC_FRAME'，公开DiyTemplateList只有通用框架。其createQuickFrameDefaults(5,1)与原用户鱼缸默认完全相同：670×610×2000、统一3030、柱3060原朝向、底3060平放、底承托3030、顶底侧梁FRAME、中间默认INSET、单格/自动层高/离地0，逐层数据深拷贝入表单。
- 原BASIC_FRAME/STORAGE_RACK/TURTLE_TANK_RACK/MACHINE_FRAME记录转私有，只让getDiyTemplate处理旧ID的直接调用与原鱼缸示例；默认新建不再由这些ID决定，未知ID仍拒绝。不是迁移旧Schema，也不在加载工程时根据名称重建。
- app去掉diyTemplates/diyTemplateId、CUSTOM状态、selectedDiyTemplate、selectDiyTemplate/diyPresetEdited；新建从同一默认读取并调用现有DiyGenerator，组件名通用框架。index去用途下拉，普通标题通用框架，整架回改仍框架参数，统一可读说明与承重边界。
- 仅用于改预设身份的input/change事件删除；v-model、层数watch（增减中间层/保持顶层）、表单深层watch（预览失效）及全部参数字段保持。diyStructureEdited仍只在明确结构选配时改当前layoutVersion；beginFrameEdit只去CUSTOM赋值，仍加载保存参数及原缺省，不将v1/v2旧架默认为v3。
- 不改LayeredRackModel、Editor.addLayeredRack或FrameParameterManager算法，旧组件名字/ID、用户手改、加工/约束/锁定/制造、板材插槽/轮廓和接头保护、预览/取消/一次历史保持。原鱼缸示例、抽屉、板材和异形画布工具不删除，不以用途命名表示承重已验算。

## 版本与待验

0.75.73 / Schema62 / 137模块，无新模块/依赖/持久字段。页面/importmap/pom/仓库样例与59份已有带版本verifier只同步身份；不新写测试或改断言逻辑。人工读到verify-diy-v045仍断言4模板、鱼缸公开项、app的DiyTemplateList/selectDiyTemplate等旧UI标记，与新约定不符，授权测试时必须同步，未运行、不声明通过。

只做人工源码/差异阅读，没有执行应用、语法检查、测试、Java编译、服务启动/重启、HTTP或浏览器；资源阶段详见docs/VALIDATION.md，不等于新模块初始化、UI输入/watch、真实数量/位置/接头、旧工程回改/撤销或GPU性能验收。原dirty/staged变更保留，无Git重置/暂存/提交，原桌面文件和真实浏览器存储未直接操作。后续实际验收见docs/ROADMAP.md，不外推v70初始化或早期功能验证。
