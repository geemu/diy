package com.paic.stock.aluminumcad.mapper;

import com.paic.stock.aluminumcad.domain.entity.AccessoryCatalog;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 配件目录 Mapper。
 *
 * <p>SQL 全部写在 AccessoryCatalogMapper.xml，不使用注解 SQL。</p>
 */
public interface AccessoryCatalogMapper {

    List<AccessoryCatalog> list(@Param("includeDisabled") boolean includeDisabled);

    AccessoryCatalog findById(@Param("id") Long id);

    AccessoryCatalog findByModel(@Param("model") String model);

    int insert(AccessoryCatalog item);

    int update(AccessoryCatalog item);

    int deleteById(@Param("id") Long id);

}
