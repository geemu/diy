package com.paic.stock.aluminumcad.domain.entity;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * 标准配件目录实体。
 */
@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AccessoryCatalog {

    Long id;
    String category;
    String model;
    String name;
    String geometryJson;
    String mountRuleJson;
    String bomRuleJson;
    Boolean enabled;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;

}
