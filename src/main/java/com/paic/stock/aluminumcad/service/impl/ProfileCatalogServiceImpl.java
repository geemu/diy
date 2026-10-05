package com.paic.stock.aluminumcad.service.impl;

import com.paic.stock.aluminumcad.domain.entity.ProfileCatalogItem;
import com.paic.stock.aluminumcad.mapper.ProfileCatalogMapper;
import com.paic.stock.aluminumcad.service.ProfileCatalogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 型材目录业务实现。
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProfileCatalogServiceImpl implements ProfileCatalogService {

    private static final String DEFAULT_ALLOY = "A6063-T5";
    private static final String DEFAULT_CROSS_SECTION_STYLE = "DATABASE_CUSTOM";
    private static final String DEFAULT_SOURCE_FAMILY = "DATABASE";
    private static final String DEFAULT_NOTE = "数据库自定义型材；如需生产级截面，请同时录入 section JSON 或自定义 DXF 截面。";

    ProfileCatalogMapper profileCatalogMapper;

    @Override
    public List<ProfileCatalogItem> list(boolean includeDisabled) {
        return profileCatalogMapper.list(includeDisabled);
    }

    @Override
    @Transactional
    public ProfileCatalogItem save(ProfileCatalogItem input) {
        ProfileCatalogItem item = normalize(input);
        profileCatalogMapper.save(item);
        return profileCatalogMapper.findById(item.getId());
    }

    @Override
    @Transactional
    public void delete(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("型材 id 不能为空");
        }
        profileCatalogMapper.deleteById(id);
    }

    private ProfileCatalogItem normalize(ProfileCatalogItem input) {
        if (input == null) {
            throw new IllegalArgumentException("型材数据不能为空");
        }

        String id = clean(input.getId());
        String nominal = clean(input.getNominal());
        String variant = clean(input.getVariant());
        if (id.isBlank() || nominal.isBlank() || variant.isBlank()) {
            throw new IllegalArgumentException("id / nominal / variant 不能为空");
        }
        if (input.getSectionSize() == null || input.getSectionSize().size() < 2) {
            throw new IllegalArgumentException("sectionSize 必须包含宽和高");
        }

        double width = positive(input.getSectionSize().get(0), "截面宽度");
        double height = positive(input.getSectionSize().get(1), "截面高度");
        double slotWidth = positive(input.getSlotWidth(), "槽宽");
        double defaultWallThickness = positive(input.getDefaultWallThickness(), "默认壁厚");
        List<Double> wallThicknessOptions = normalizeWallThicknessOptions(input.getWallThicknessOptions(), defaultWallThickness);
        ArrayNode slotDefinitions = normalizeSlotDefinitions(input);

        return ProfileCatalogItem.builder()
                .id(id)
                .nominal(nominal)
                .variant(variant)
                .code(variant)
                .name(blankDefault(input.getName(), "工业铝型材 " + variant))
                .series(blankDefault(input.getSeries(), nominal.replaceAll("[^0-9]", "")))
                .system(blankDefault(input.getSystem(), "自定义"))
                .sectionSize(List.of(width, height))
                .slotWidth(slotWidth)
                .slotDefinitions(slotDefinitions)
                .wallThicknessOptions(wallThicknessOptions)
                .defaultWallThickness(defaultWallThickness)
                .alloy(blankDefault(input.getAlloy(), DEFAULT_ALLOY))
                .crossSectionStyle(blankDefault(input.getCrossSectionStyle(), DEFAULT_CROSS_SECTION_STYLE))
                .sourceFamily(blankDefault(input.getSourceFamily(), DEFAULT_SOURCE_FAMILY))
                .note(blankDefault(input.getNote(), DEFAULT_NOTE))
                .section(input.getSection())
                .custom(true)
                .enabled(input.getEnabled() == null || input.getEnabled())
                .sortOrder(input.getSortOrder() == null ? 1000 : input.getSortOrder())
                .build();
    }

    private List<Double> normalizeWallThicknessOptions(List<Double> values, double defaultWallThickness) {
        if (values == null || values.isEmpty()) {
            return List.of(defaultWallThickness);
        }

        List<Double> result = new ArrayList<>();
        for (Double value : values) {
            double wallThickness = positive(value, "壁厚");
            if (!result.contains(wallThickness)) {
                result.add(wallThickness);
            }
        }
        Collections.sort(result);
        return List.copyOf(result);
    }

    private ArrayNode normalizeSlotDefinitions(ProfileCatalogItem input) {
        if (input.getSlotDefinitions() != null && input.getSlotDefinitions().isArray()) {
            return (ArrayNode) input.getSlotDefinitions();
        }
        return JsonNodeFactory.instance.arrayNode();
    }

    private double positive(Double value, String name) {
        double number = value == null ? 0 : value;
        if (!Double.isFinite(number) || number <= 0) {
            throw new IllegalArgumentException(name + "必须大于 0");
        }
        return number;
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String blankDefault(String value, String fallback) {
        String cleanedValue = clean(value);
        return cleanedValue.isEmpty() ? fallback : cleanedValue;
    }

}
