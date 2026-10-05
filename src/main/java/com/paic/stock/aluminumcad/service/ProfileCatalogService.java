package com.paic.stock.aluminumcad.service;

import com.paic.stock.aluminumcad.domain.entity.ProfileCatalogItem;

import java.util.List;

/**
 * 型材目录业务服务。
 *
 * <p>Controller 只负责 HTTP 协议适配；型材参数校验、默认值补齐和持久化流程统一收口到这里。</p>
 */
public interface ProfileCatalogService {

    /**
     * 查询当前启用的型材目录。
     * @param includeDisabled 是否包含已停用目录项
     * @return 型材目录列表
     */
    List<ProfileCatalogItem> list(boolean includeDisabled);

    /**
     * 新增或更新一个型材目录项。
     * @param input 前端提交的型材目录数据
     * @return 持久化后的标准化型材数据
     */
    ProfileCatalogItem save(ProfileCatalogItem input);

    /**
     * 删除指定型材目录项。
     * @param id 型材目录主键
     */
    void delete(String id);
}
