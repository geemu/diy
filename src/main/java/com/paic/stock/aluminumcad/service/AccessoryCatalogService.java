package com.paic.stock.aluminumcad.service;

import com.paic.stock.aluminumcad.domain.entity.AccessoryCatalog;

import java.util.List;

/**
 * 标准配件目录服务。
 */
public interface AccessoryCatalogService {

    List<AccessoryCatalog> list(boolean includeDisabled);

    AccessoryCatalog get(Long id);

    AccessoryCatalog create(AccessoryCatalog input);

    AccessoryCatalog update(Long id, AccessoryCatalog input);

    void delete(Long id);

}
