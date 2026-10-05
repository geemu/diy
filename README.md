# Aluminum CAD Spring Boot v0.63.0

浏览器端铝型材 DIY 3D 设计器，面向玩家、创客和不会传统 CAD 的用户。当前迭代优先把“选中、移动、吸附、贴合、连续搭框、右键修改”做成稳定的基础 DIY 工作流，再继续扩展高级制造能力。

## v0.63.0 重点

- Project Schema：**62**，current-only；当前版本即全新工程，不维护旧工程兼容。
- 三轴 TransformControls 正式接入移动步长：自由 / 1 / 5 / 10 / 50 mm；旋转保持独立步长，并在拖动时显示 XYZ 位移或旋转量。
- 几何吸附增加候选优先级与滞回锁定：端面、槽中心、端点候选不再因鼠标轻微抖动来回跳；按住 Ctrl 可临时绕过几何吸附。
- 拖动过程中实时区分 **绿色有效面接触 / 吸附** 与 **红色实体干涉**；发生真实穿透时默认阻止落位并恢复拖动前状态。
- 连续折线、矩形和参数化闭合轮廓改为真实端面-侧面搭接派生，避免用中心线角点直接生成实体导致“正常画框也干涉”。绘制预览本身也会在发生穿透时转红。
- 移动支持 **单个移动 / 保持连接移动 / 移动整个装配**；批量或跟随移动时吸附不会把本组中的另一根型材误当成外部目标。
- 顶部菜单按 CAD 高频操作重排为 文件 / 编辑 / 视图 / 显示 / 移动步长（吸附） / 模型库 / 制造。
- 右键菜单使用真实 DOM 尺寸做视口边界避让，页面底部/右侧也能点到；移动、复制、聚焦、删除放在第一屏。
- 连续绘制支持直接键入长度 + 回车、退格撤回上一段、Esc 结束；Ctrl 临时取消吸附、Shift 临时正交锁轴。
- 空白画布和构件右键彻底分流；型材长度可在右键菜单内直接输入，并选择固定 A 端或固定 B 端。
- 单个移动若把已有连接拉成无效几何，自动解除失效 Cxxx；“保持连接移动”继续使用既有连接图整体移动。
- 报价、单价、成本估算仍不实现。

## 产品模型

```text
玩家设计
  -> 设计型材（截面 / 槽 / 封边 / 长度）
  -> 点击 / 拖拽 / 吸附
  -> 设计连接（结构意图）
  -> 板材 / 门 / 配件

制造配置
  -> 真实制造型材
  -> 真实连接件 / 紧固件
  -> 连接派生加工

制造输出
  -> 材料清单 / 加工清单 / 工程图 / 制造包
```

设计阶段不要求用户决定欧标/国标、壁厚、米重、合金、供应商或真实采购料号。

## 连接交互

普通用户不拖动和旋转角码模型，也不要求先回左侧选择连接工具：

```text
鼠标靠近 / 右键接头
  -> 自动解析当前两根型材的端部与安装面
  -> 只显示当前几何可用的连接候选
  -> 点击候选直接安装
  -> 有歧义时退回既有“两点选择”
开放端部
  -> 直接显示匹配截面的端盖候选
  -> Ghost 预览 -> 单击确认
制造阶段
  -> 再选择真实角码、螺钉、螺母和加工规则
```

## 技术栈

- JDK 21
- Spring Boot 4.1.1
- Maven
- SQLite / SQLite JDBC 3.53.4.0
- MyBatis Spring Boot Starter 4.1.0 + XML SQL
- Lombok
- Jackson 3 `tools.jackson.*`
- Vue 3 Global Build + JavaScript ES Modules
- Three.js
- 浏览器运行期不依赖 CDN

## SQLite

默认连接：

```yaml
spring:
  datasource:
    url: jdbc:sqlite:./data/aluminum-cad.db
    driver-class-name: org.sqlite.JDBC
```

启动时执行 `src/main/resources/sql/schema.sql` 和 `data.sql`，基础目录使用 SQLite `ON CONFLICT ... DO UPDATE` 幂等初始化。

## 启动与验证

```bash
mvn clean test
mvn spring-boot:run
```

浏览器打开：`http://127.0.0.1:8080/`

前端回归：

```bash
find src/main/resources/static tools -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | xargs -0 -n1 node --check
for f in tools/verify-*.mjs; do node "$f"; done
```

## 重要文档

1. `AGENTS.md`
2. `IDEABUILDER_PARITY.md`
3. `docs/HANDOFF.md`
4. `docs/ROADMAP.md`
5. `docs/DATA-MODEL.md`
6. `docs/JAVA-CODE-STYLE.md`

## 明确不做

- 不维护历史 Project Schema migration chain。
- 暂不做报价、材料价格、成本估算。
- 不做供应商商城、订单、库存、采购闭环。
- 不做原料定尺排料、锯缝优化和余料库存。
- 不把 Three.js Scene 当业务事实源。
- 不因为“像 CAD”而把完整 B-Rep / Sketcher / FEM 作为当前主路线。

## 下一阶段

**v0.59：玩家式关系继续可视化 + 装配说明输出增强**

- 在轮廓边/点旁直接显示已有等长、平行、对齐关系；
- 增加关系点击定位与快速解除；
- 将连接安装示意并入可打印装配说明页；
- STEP 互操作继续后置评估。
