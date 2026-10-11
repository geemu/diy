# v0.75.52 具体连接件替换与板材避让记录

日期：2026-10-11；Schema：62；版本：0.75.52。

## 用户范围和原问题

- 用户截图选中一个已安装角码，指出90度直角连接件等也应可替换；旧右侧按ANGLE/END/ANCHOR/INTERNAL/PLATE分类，Manager类别默认只取CORNER_CUBE/HIDDEN_CORNER/FLAT_PLATE，遗漏其他已有安装映射的目录类型。
- 第二张截图是板材B-724与C011等四角安装包络冲突。原框口配置仅统一净尺寸间隙，PanelShapeModel虽有对称cross预设，但没有各连接件位置的独立缺口，不能只换展示或压掉红色提示。
- 用户确认实施两条操作链。没有本次截图对应的最新工程副本，截图不是实际实体穿透量/型号合法性/自动裁角数量证据；没有操作用户桌面JSON、真实localStorage或浏览器。
- 没有增加外部参考图纸/供应商数据/下载代码或依赖；复用项目已有本地目录及设计模型，采购/承载边界不变。

## 连接件类型 / 规格更换

- ConnectionManager.getCatalogSwitchChoices按源型材series过滤现有ConnectionComponentOptions与目录规格，仅纳入connectionDesignType已有映射。90度直角件ANGLE_BRACKET、L_BRACKET、CORNER_CUBE、HEAVY_CORNER，以及已映射板类和HIDDEN_CORNER沿原安装规则使用。
- 未映射INNER_BRACKET、多向件/铰链等仍不进入自动替换。END_SCREW/ANCHOR_CONNECTOR保留显式“设计方式”，不会把简化意图模型当成真实目录采购五金。
- ConnectionReplacementManager独立于原关系；begin保存工程签名，选择类型/规格调用designSwitchCandidate及Placement.evaluateCandidate，保持安装面、源局部锚点和当前ID，当前件自身可忽略占位，其他侧/实体仍占位。
- createDesignHelper的preview入口共用正式几何与姿态，不注册helper或写Connection；黄色实体替代当前helper的临时可见性，另一件和宿主不改。更新/取消释放预览并恢复原件高亮，Esc沿工作台取消链。
- confirm重新选择/检查，switchDesignType沿原重建及原记录回滚；只有成功才一次capture/emitProjectChanged。制造已配置先解除，不自动移除制造方案；切换不移动宿主、不放宽孔轴/槽位/站位、0.1mm贴合或完整腿支撑/第三方空间。

## 板材避让工作流

- 仅支持可编辑、无既有加工的矩形薄板；begin保存原mesh/可见性和工程签名，停用变换/握柄，不影响镜头观察。右侧显示间隙、重新计算/更新预览及确认/取消；手改缺口默认折叠。
- 默认间隙1mm，可改0~20mm；scan只看实际可见的目录连接设计helper及真实派生/自由目录连接Part。先板包络筛选，再取实体材料三角表面在板厚范围内裁切的局部XY投影，不用连接件整个世界AABB来整块缩板。
- 投影加间隙后若接近板边/角，转成矩形边缺口；自动宽深向外0.1mm取整，定位端从较近的端保存。中部障碍不自动挖孔/分板；未处理位置或残余碰撞给短提示，不能确认假避让。
- 已有缺口先原样预览；只有显式“按连接件计算”才以当前实体重新替换本次预览尺寸。手改边/定位端/离端距离/宽深或间隙使旧预览失效，需要更新或重新计算。
- 原板只在预览中隐藏，完整实体外尺寸/位置、连接件均不改；黄色是实际裁后轮廓，仍相交红色且确认禁用。智能填板原创建完成后默认进入裁角预览，裁角另一次明确确认；取消保留已创建但未裁的原板。
- confirm用fresh工程签名/材料检查，成功更新domain/rebuild/安装刷新/干涉，一次历史和工程提交；异常保存原领域图/历史游标再还原。没有把预览写入BOM、JSON或草稿。

## 轮廓事实与保存

- dimensions.edgeNotches最多32项，每项edge=LEFT/RIGHT/TOP/BOTTOM、anchor=START/END、offsetMm/widthMm/depthMm；LEFT/RIGHT沿局部Y，TOP/BOTTOM沿局部X，START为左/下、END为右/上。局部XY为切面，Z为厚度。
- PanelShapeModel.panelMaterialContours按原矩形减边矩形并集提取材料边界，重叠缺口共同处理；尺寸越界/切穿、零宽相接、多个正面积材料外环或切空明确拒绝，不伪造多块板的单Part。
- PanelShapeModel、ComponentGeometryFactory/PrimitiveGeometryFactory、EngineeringDrawingModel、ProjectSchema和FactoryValidator共用；三角剖分属于显示实现，不持久化mesh或世界坐标。
- 合法缺口随板平移/旋转/复制及工程保存。框口refit和FrameParameterManager保留边端宽深/离端，更新矩形尺寸参数；缩小造成越界拒绝，不暗删裁角。已有裁角门芯板不被门组件重建覆盖；尺寸变化后仍需查看真实碰撞，显式重算连接件避让。

## 干涉和输出

- PanelReliefGeometry宽阶段后以材料XY三角棱柱（厚度Z）裁切实际实体子网格三角面，并用子实体包含判断处理包围关系；实体子网格各自判断，避免重叠腿被整体奇偶抵消。轮廓/局部三角缓存只减少重复，姿态使用当前domain与world matrix。
- InterferenceFeedback的薄板相交和ConnectionPlacement对板材障碍共用此材料检查，已裁空部分不以原矩形误阻止；其他未适配/退化对象保守包络保持。没有裁断型材/加工碰撞或通用精确布尔的新承诺。
- 板材与连接件相交不能confirm；切掉包络空角后只取消该材料误报，不屏蔽真实剩余穿透，不移动框架/连接件。细化结果仍不标“精确”，三角显示模型及公差不能作为制造认证。
- 工程图SVG/DXF读domain材料rings，不从Scene导出ghost；材料BOM分组加入缺口签名，子装配BOM保留缺口备注，尺寸相同但裁法不同不合并。
- 制造包在原FactoryValidator门禁后增加“板材切割轮廓.json”（板编号、mm、宽高厚、局部材料环及缺口）与“板材缺口.csv”。它们是明确轮廓资料，不是CNC刀路或采购/加工公差证书。

## 交付与待验

- 新增ConnectionReplacementManager、PanelReliefManager、PanelReliefGeometry共3模块，本地模块125；Schema62不增历史迁移，无新依赖。版本/importmap/pom/样例及既有59份verify仅机械身份同步，旧断言/几何期望仍需授权审阅。
- 按用户规则未新增/运行测试、语法校验、Java编译、服务启动/重启/调用或浏览器验收。资源复制状态见docs/VALIDATION.md；阅读/修改源码与静态资源复制不代替真实鼠标/Vue/模型/碰撞/导出运行。
- 待验：所有实际可适配类型规格/偏置/内角/兄弟件占位/已制造拒绝、切回真实型号/单件ID与外形、预览更新/取消/失败恢复/历史草稿；智能填板四角和边、旋转/厚薄/带孔或多子实体投影、缺口交叠和残余碰撞。
- 待验：手改/重算/已有缺口保留、中部/越界/分裂拒绝、直接缩小/框口与整架回改、保存/导入/刷新/复制移转/撤销重做及几何/材料/3D拾取/SVG/DXF/两份新导出/BOM同源性；密集板/连接实体CPU/GPU成本、长期预览与资源释放。
- 当前不含任意曲线/中部开孔、已有加工迁移、专业B-Rep/CNC或全型号连接安装，也不宣称承载与供应商制造精度一致。
