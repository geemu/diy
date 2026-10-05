package com.paic.stock.aluminumcad.service.impl;

import com.paic.stock.aluminumcad.domain.entity.AccessoryCatalog;
import com.paic.stock.aluminumcad.mapper.AccessoryCatalogMapper;
import com.paic.stock.aluminumcad.service.AccessoryCatalogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * 标准配件目录业务实现。
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AccessoryCatalogServiceImpl implements AccessoryCatalogService {

    private static final Set<String> SUPPORTED_CATEGORIES = Set.of("END_CAP", "FOOT", "CASTER", "DRAWER_SLIDE");

    AccessoryCatalogMapper accessoryCatalogMapper;

    @Override
    public List<AccessoryCatalog> list(boolean includeDisabled) {
        return accessoryCatalogMapper.list(includeDisabled);
    }

    @Override
    public AccessoryCatalog get(Long id) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("配件 id 无效");
        }
        AccessoryCatalog item = accessoryCatalogMapper.findById(id);
        if (item == null) {
            throw new IllegalArgumentException("配件不存在：" + id);
        }
        return item;
    }

    @Override
    @Transactional
    public AccessoryCatalog create(AccessoryCatalog input) {
        AccessoryCatalog item = normalize(input);
        if (accessoryCatalogMapper.findByModel(item.getModel()) != null) {
            throw new IllegalArgumentException("配件型号已存在：" + item.getModel());
        }
        accessoryCatalogMapper.insert(item);
        return accessoryCatalogMapper.findById(item.getId());
    }

    @Override
    @Transactional
    public AccessoryCatalog update(Long id, AccessoryCatalog input) {
        AccessoryCatalog current = get(id);
        AccessoryCatalog item = normalize(input);
        item.setId(id);

        AccessoryCatalog sameModel = accessoryCatalogMapper.findByModel(item.getModel());
        if (sameModel != null && !sameModel.getId().equals(id)) {
            throw new IllegalArgumentException("配件型号已存在：" + item.getModel());
        }

        item.setCreatedAt(current.getCreatedAt());
        accessoryCatalogMapper.update(item);
        return accessoryCatalogMapper.findById(id);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        get(id);
        accessoryCatalogMapper.deleteById(id);
    }

    private AccessoryCatalog normalize(AccessoryCatalog input) {
        if (input == null) {
            throw new IllegalArgumentException("配件数据不能为空");
        }

        String category = clean(input.getCategory()).toUpperCase();
        String model = clean(input.getModel()).toUpperCase();
        String name = clean(input.getName());
        if (!SUPPORTED_CATEGORIES.contains(category)) {
            throw new IllegalArgumentException("暂不支持的配件分类：" + category);
        }
        if (model.isEmpty()) {
            throw new IllegalArgumentException("配件型号不能为空");
        }
        if (name.isEmpty()) {
            throw new IllegalArgumentException("配件名称不能为空");
        }

        AccessoryCatalog item = new AccessoryCatalog();
        item.setId(input.getId());
        item.setCategory(category);
        item.setModel(model);
        item.setName(name);
        item.setGeometryJson(jsonDefault(input.getGeometryJson()));
        item.setMountRuleJson(jsonDefault(input.getMountRuleJson()));
        item.setBomRuleJson(jsonDefault(input.getBomRuleJson()));
        item.setEnabled(input.getEnabled() == null || input.getEnabled());
        return item;
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String jsonDefault(String value) {
        String text = clean(value);
        return text.isEmpty() ? "{}" : text;
    }

}
