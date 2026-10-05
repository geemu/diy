package com.paic.stock.aluminumcad.domain.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import tools.jackson.databind.JsonNode;

import java.util.List;

/**
 * 型材目录实体。
 *
 * <p>该对象同时承担当前 Profile Catalog REST 接口的 JSON 载体职责。字段名必须保持与前端
 * {@code ProfileCatalogApi.js} 的既有协议一致，避免 Java 分层重构影响浏览器端数据契约。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileCatalogItem {

    private String id;
    private String nominal;
    private String variant;
    private String code;
    private String name;
    private String series;
    private String system;
    private List<Double> sectionSize;
    private Double slotWidth;
    private JsonNode slotDefinitions;
    private List<Double> wallThicknessOptions;
    private Double defaultWallThickness;
    private String alloy;
    private String crossSectionStyle;
    private String sourceFamily;
    private String note;
    private JsonNode section;
    private Boolean custom;
    private Boolean enabled;
    private Integer sortOrder;
}
