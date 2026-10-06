# 吸附、干涉与连接参考核对 — 2026-10-06 / v0.75.10

本文件为观察记录，不是外部源代码或运行素材副本。独立 Chrome 上下文，不读取用户主浏览器工程、不登录、不保存远程工程。未复制第三方源码。

## Lewan 公开编辑器

来源：[公开编辑器](https://www.lewandiy.com/editor)，页面显示 v2.0.0。

- 右库连接先选连接件类型，再选适用规格，再点击出料口。实际观察到 L 型角槽、角码、直角、重型、一字、滑块、多通、连接板、面板固定等分组；不是点击类别立即在固定坐标生成零件。
- 点击预览后变为“添加构件中 / 按 Esc 退出”，画布有 Tab 切方向提示。无可用宿主位置点击后明确显示未找到可连接型材，未当作成功安装。
- 型材放置在画布点击后出现长度输入和 Enter/确定提交。参考页初始化包含示例框架，不能将其误记为空白场景；本次观察没有保存该示例或用户草稿。
- 自动生成/清除连接件、快速搭建、抽屉和智能板材按钮有 PRO 会员限制说明。本次未绕过权限，不能宣称验证其自动连接内部算法。
- 公开 UI 行为不足以推断其干涉内核采用 AABB/OBB/实体布尔或具体容差；不把截图颜色当算法证据。

## skystmm/alu-studio

固定提交：[49ef07e0dd27cdd248404f31ef84b04a84c72f1f](https://github.com/skystmm/alu-studio/tree/49ef07e0dd27cdd248404f31ef84b04a84c72f1f)。

- [README](https://github.com/skystmm/alu-studio/blob/49ef07e0dd27cdd248404f31ef84b04a84c72f1f/README.md) 明确工程为设计原型，构件是简化几何；无零件几何吸附、约束求解、碰撞检测，拖动按 1 mm 量化。因此不能将它作为已有精确吸附/干涉算法来源。
- 只读检查 [part-drag.ts](https://github.com/skystmm/alu-studio/blob/49ef07e0dd27cdd248404f31ef84b04a84c72f1f/src/part-drag.ts)：拖动开始保存位置，移动只做预览，结束仅提交实际变化；取消恢复位置并清预览。可以参考一次手势一次提交、取消不落业务模型的交互原则。
- [model.ts](https://github.com/skystmm/alu-studio/blob/49ef07e0dd27cdd248404f31ef84b04a84c72f1f/src/model.ts) 用系列/槽宽兼容过滤，参数化横撑扣除立柱尺寸，板材/上层净空检查和尺寸关联重算。属于模板适配规则，不是自由空间几何吸附。
- GitHub repo API license=null；递归文件树未发现 LICENSE/COPYING/NOTICE。仅作功能/设计对照，不据公开可读复制代码；也不迁移其 React/TypeScript/Vite 技术栈。

## AustinXT/ALPDesigner

固定提交：[b940db4a7341055d4a1c4cb6b2b5dcd134a56942](https://github.com/AustinXT/ALPDesigner/tree/b940db4a7341055d4a1c4cb6b2b5dcd134a56942)。

- 当前递归文件树的 src 只有 [README.md](https://github.com/AustinXT/ALPDesigner/blob/b940db4a7341055d4a1c4cb6b2b5dcd134a56942/src/README.md)，为目录骨架建议。尚未看到可运行的 CAD/吸附/干涉源码，不能以顶层功能说明代替已实现能力。
- [产品规格](https://github.com/AustinXT/ALPDesigner/blob/b940db4a7341055d4a1c4cb6b2b5dcd134a56942/.42cog/pm/pr.spec.md) 描述接近元素的连接推荐、兼容校验、红色冲突反馈、人工确认/更换连接件；这些目前是规划文档，不是执行过的算法。
- [认知模型](https://github.com/AustinXT/ALPDesigner/blob/b940db4a7341055d4a1c4cb6b2b5dcd134a56942/.42cog/cog.md) 将接头、连接件及兼容关系分别建模，可以对照 DIY 已有 Part/Connection/Hardware 事实源，不需要引入第二套持久化结构。
- GitHub API license=null，递归树无 LICENSE/COPYING/NOTICE。未导入外部文件；Next/Bun/AI API/成本规划不属于本轮实现范围。

## DIY 本轮落地与边界

- 距离/方向正确不等于整根落位合法：候选先经现有干涉分类检查，第三件和随动范围也参与；提交重查，真实穿透仍回退，UI 清除旧吸附状态。
- 紫色上表面齐平、绿色候选接触、蓝色已接触、红色穿透各自表达不同状态。0.1 mm 齐平展示容差不覆盖已有碰撞/接触容差，也不证明连接件安装完成。
- 连接放置仍复用 ConnectionPlacementManager → ConnectionManager：hover 不写工程，单击提交，Esc 清 Ghost；真实宿主/槽位/兼容检查不被视觉效果代替。
- 现有 PROFILE OBB 与非 PROFILE 近似 AABB 判定仍有实体孔腔/凹槽精度边界，不宣称达到参考站所有几何实体或物理承重校验精度。
