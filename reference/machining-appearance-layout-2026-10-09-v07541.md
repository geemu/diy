# v0.75.41 加工外观与工作台伸缩依据

## 用户需求与本地事实

- 用户截图中的通孔/沉头/攻丝不易辨认，并要求两侧菜单伸缩。原MachiningManager使用黑色圆片和同平面的金属Ring，不能表达锥面或螺纹；左右布局已有宽度/浮动持久化但没有收起入口。
- MachiningFeature已有type、diameter、majorDiameter、angleDeg、depth、tappingSize及linkedHoleId；姿态由stationS/face/offset和端点/弯曲局部标架给出。本次沿用原事实，不给工程增螺距字段或实体布尔模型。

## 公开参照（只读HTML）

- [Three.js ShaderMaterial官方文档](https://archive.threejs.org/docs/api/en/materials/ShaderMaterial.html)：自定义Shader、内建矩阵与逐对象onBeforeRender/uniformsNeedUpdate。实际项目仍使用本地r155，不更新依赖，不从远程加载Shader或贴图。
- [MISUMI六角螺母技术参考](https://sg.misumi-ec.com/tech-info/categories/machine_design/md05/a0042.html)：其公制规格表给出M2/.4、M2.5/.45、M3/.5、M4/.7、M5/.8、M6/1、M8/1.25、M10/1.5、M12/1.75和M16/2粗牙螺距。本次只借此绘制已知规格牙形，不借螺母表认证型材攻丝材料、公差、盲孔深度或承载。
- 未阅读/下载本轮新PDF，不复制第三方CAD、专有源码或用户工程；Bossard介绍页未用于数值来源。

## 实现与近似边界

- 孔口圆面内按局部视线绘制虚拟负Z腔，直壁/锥面/台阶/闭底按类型区别；螺旋由深度与圆周角共同确定，金属明暗及遮蔽随视角变化。已有显式螺距/规格文字优先，未知不发明牙形；已有底孔优先，否则仅粗牙展示近似，不写回参数。
- 关联沉头用真实通孔小径和沉头角；独立沉头没有指定小孔时仅锥腔，不称贯穿。材质仍受真实构件遮挡，位于反馈/印字之后；它不是宿主材料切除，虚拟孔壁没有真正GPU深度或实体空腔/阴影，不能用展示结果验证碰撞、贯穿透视或制造公差。
- 菜单收起属于本机工作台偏好，沿用原布局键，实际轨道归零；不卸载表单、不取消工具、不进入Project/历史。左右互不影响，显式命令展开必要侧、普通选择不强迫展开，浮动坐标及宽度保留。

## 证据范围

- 已编辑源码/身份/交接文档，资源复制状态见docs/VALIDATION.md。未新增/运行测试、编译、启动/重启或浏览器验收；源代码接入不是实际Shader编译、视觉、性能、菜单交互或参考站全功能一致的证据。
