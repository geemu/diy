package com.paic.stock.aluminumcad.mapper;

import com.paic.stock.aluminumcad.domain.entity.ProfileCatalogItem;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 型材目录 Mapper。
 *
 * <p>这里只声明数据库操作，SQL 全部位于 ProfileCatalogMapper.xml。</p>
 */
public interface ProfileCatalogMapper {

    List<ProfileCatalogItem> list(@Param("includeDisabled") boolean includeDisabled);

    ProfileCatalogItem findById(@Param("id") String id);

    int save(ProfileCatalogItem item);

    int deleteById(@Param("id") String id);

}
