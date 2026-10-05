# Java / Spring Boot 代码规范

本项目继承 `reference/docs/global-development-instructions.txt` 的全局规范，用户当前最新要求优先。

## 1. 基线

- JDK 21
- Spring Boot 4.x
- Maven 单模块
- `groupId = com.paic.stock`
- 根包：`com.paic.stock.aluminumcad`
- Lombok
- Jackson 3 `tools.jackson.*`
- SQLite + MyBatis + XML SQL

## 2. 包结构

```text
com.paic.stock.aluminumcad
├── config
│   └── typehandler
├── controller
├── domain
│   └── entity
├── mapper
└── service
    └── impl
```

Service 接口必须放 `service`，实现必须放 `service.impl`。

## 3. Bean 注入

优先：

```java
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
```

不要字段注入 `@Autowired`。

## 4. MyBatis

数据库 SQL 必须写 XML，不使用：

- `@Select`
- `@Insert`
- `@Update`
- `@Delete`
- JdbcTemplate
- JPA/Hibernate
- MyBatis-Plus

公共数据库元信息集中在 `BaseMapper.xml`：

- 表名
- 完整字段列表
- 写入字段
- 公共更新片段
- 默认排序

业务 Mapper 通过 `<include>` 引用。禁止 `SELECT *`。

## 5. Java

- 禁止 `var`。
- 局部变量使用显式类型。
- 不为少几行代码滥用 Stream/Lambda。
- 简单对象默认 Setter；字段很多且 Builder 明显提升阅读性时再使用 `@Builder`。
- Controller 保持薄，只负责 HTTP 参数、基础校验、调用 Service、返回结果。
- 复杂业务规则放 Service。
- 不吞异常。

## 6. 注释

使用中文注释。注释重点解释：

- 为什么这样做
- 业务特殊规则
- 坐标系/单位/边界
- 容易被后续误改的地方

不要逐行翻译代码。

## 7. Spring Boot 4 / Jackson

业务代码只使用 Jackson 3：

```text
tools.jackson.*
```

禁止重新引入业务层 `com.fasterxml.jackson.databind.*`。
