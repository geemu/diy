# 制造菜单并入文件 — v0.75.75

日期：2026-10-12。Schema 62 / 139 本地模块，无新增依赖、模块或持久字段。

## 请求与范围

用户先问顶部制造菜单是否与文件重复，再明确要求“可以把制造去掉吗？都合并到文件里面？”。按确认迁移全部入口、删除重复导航，不删除制造功能或检查门禁；右上重复制造输出也移除，撤销/重做保持。

## 文件菜单

- 项目：新建、重命名、打开、保存、打开鱼缸架示例。
- 清单与装配：材料清单、配件清单、加工清单、装配步骤。
- 导出与制造：当前视图、导出/工程图、制造配置、制造检查、导出制造包。
- 本地草稿：恢复、导出草稿原文件、清除草稿。

共17动作，顶部独立制造details移除、主菜单8→7；文件中的材料清单和工程图只保留一份，不把原文件已有入口再复制一遍。每项仍直接用原newProject/importJson/exportJson、openEngineeringCenter/openManufacturingConfig、runFactoryValidation/exportFactoryPackage及草稿函数，无新代理或业务状态。

## 交互与边界

- 仅文件弹层加cad-file-menu，按视口限高并内滚动，所有子项不收缩，overscroll不传画布；其他顶栏/底栏弹层尺寸规则保持。
- 原hover/native details/点击及click后收起逻辑不变，不在pointerdown先隐藏。原快捷键、模态守卫与焦点逻辑复用。
- 工程中心/材料清单内部标签、选中连接的“去制造配置”等上下文操作保留；这些不是第二套顶级导航。
- ManufacturingConfigurator/FactoryValidator及exportFactoryPackage缺配置引导、阻断错误/警告确认完全原链。普通材料CSV/xlsx不要求正式制造配置的原语义保持，制造包不放宽Gate。
- 不改模型、工程、选择/历史/草稿或实际用户文件/Chrome存储，不改抽屉/通用框架/BOM；现有dirty/staged修改不回退。

## 交付状态

版本入口/importmap/pom/仓库样例和59份带版本既有verifier仅机械身份同步，无新测试或测试逻辑修改。当前verify-catalog-workbench-v069仍断言8菜单，与新7菜单不符；v73旧4用途预设断言也待授权测试工作更新，不把未运行脚本写成通过。

本轮仅人工源码/差异阅读和资源交付，没有测试/语法检查/Java编译、服务启动/重启、HTTP或浏览器。短视口滚动、全部菜单动作/正确标签、键盘/触屏/关闭时机、139模块初始化/Console/Network和制造流程仍待验；资源阶段另记docs/VALIDATION.md，不作实际菜单或导出已通过的证明。
