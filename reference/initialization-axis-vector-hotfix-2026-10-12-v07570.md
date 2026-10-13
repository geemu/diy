# axisVector 重复声明初始化热修 — v0.75.70

## 用户请求与根因

用户报告页面初始化失败：Identifier 'axisVector' has already been declared，指向http://127.0.0.1:8080/js/core/Editor.js?v=0.75.70:3540，明确要求查看浏览器Console / Network。本轮只修复和验证初始化，不扩大为新功能或全回归。

实际隔离Chrome复现：主页、app和Editor请求200，页面显示同一错误，pageerror为同名声明；源码及服务Editor第16行新命名导入axisVector，第3540行已有同名顶层函数，ES模块解析时冲突。不是资源404、importmap失效或Three依赖缺失。Console还记录无关favicon.ico404，不当作此次模块解析根因。

## 最小修复与资源交付

仅从Editor的ProfileNeighbourDistances命名导入中删去axisVector，保留profileDistanceRelation。原axisVector及其既有XYZ尺寸绑定语义保持，新净距命令对合法XYZ复用同一原函数；ProfileNeighbourDistances及SelectedProfileDistanceManager的导出/使用不改。v0.75.70 / Schema62 / 134本地模块不变，无新依赖、Project字段或扩大改动。

2026-10-12 08:49:22（UTC+8）mvn -o process-resources -DskipTests成功，只复制1项配置 / 145项静态随附资源 / 4项本地Three vendor，未进入Java编译/测试或启动/重启。HTTP返回Editor200、内容与源相同，SHA-256均4b2319a0983a1621d8dafe55030e9b8efe49c3bb9019f0346756b0ed2b1c7a1a，仅原第3540行声明保留。

## Console / Network 运行检查

使用本机Chrome独立临时实例和新隔离上下文访问8080，不接管用户当前浏览器或导入其localStorage。监听Console warning/error、pageerror及Chrome DevTools Protocol Network响应/失败；完成Network idle后继续观察9秒，再普通刷新并同样观察9秒，超过boot脚本8秒初始化超时窗口。

| 项目 | 冷启动 | 普通刷新 |
| --- | --- | --- |
| 页面版本 / 初始化 | v0.75.70，Vue挂载 / boot移除 | v0.75.70，Vue挂载 / boot移除 |
| 初始化失败 / pageerror | 无 / 0 | 无 / 0 |
| Canvas / 临时距离层 | 3 / 1 | 3 / 1 |
| Network响应 / 本地JS响应 | 144 / 133 | 143 / 133 |
| 请求失败 | 0 | 0 |
| HTTP错误 / Console error | 仅favicon.ico404 / 1 | 0 / 0 |
| Console warning | 0 | 0 |

Editor、app、两个新距离模块与OrbitControls两次均200；普通刷新boot304为正常缓存重新验证。未拦截favicon或屏蔽它的错误，不能把冷启动说成所有Console/请求零错误。没有修复无关图标或更改初始化报错的显示/捕获逻辑来掩盖失败。

## 验收边界

本轮实际确认初始化及关键模块资源链正常，不是仅有资源复制。未运行Java编译、既有功能验证器、新增测试、距离编辑/Tab/箭头/约束/撤销事务或性能、制造/承载验收；未操作用户桌面原JSON、已有Chrome工程或实际草稿。原v70功能交付未浏览器验收记录保持，本热修另记录新证据，不能外推为全功能已验。详情见VALIDATION与ROADMAP。
