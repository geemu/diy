package com.paic.stock.aluminumcad.controller;

import com.paic.stock.aluminumcad.domain.entity.ProfileCatalogItem;
import com.paic.stock.aluminumcad.service.ProfileCatalogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 型材目录 REST 接口。
 */
@RestController
@RequestMapping("/api/profile-catalog")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProfileCatalogController {

    ProfileCatalogService profileCatalogService;

    /** 查询型材目录。 */
    @GetMapping
    public List<ProfileCatalogItem> list(@RequestParam(name = "includeDisabled", defaultValue = "true") boolean includeDisabled) {
        return profileCatalogService.list(includeDisabled);
    }

    /** 新增型材目录。 */
    @PostMapping
    public ProfileCatalogItem create(@RequestBody ProfileCatalogItem item) {
        return profileCatalogService.save(item);
    }

    /** 修改型材目录。 */
    @PutMapping("/{id}")
    public ProfileCatalogItem update(@PathVariable String id, @RequestBody ProfileCatalogItem item) {
        item.setId(id);
        return profileCatalogService.save(item);
    }

    /** 删除型材目录。 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        profileCatalogService.delete(id);
        return ResponseEntity.noContent().build();
    }

}
