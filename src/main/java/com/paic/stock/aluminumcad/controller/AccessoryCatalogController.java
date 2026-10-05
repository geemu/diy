package com.paic.stock.aluminumcad.controller;

import com.paic.stock.aluminumcad.domain.entity.AccessoryCatalog;
import com.paic.stock.aluminumcad.service.AccessoryCatalogService;
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
 * 标准配件目录接口。
 */
@RestController
@RequestMapping("/api/accessories")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AccessoryCatalogController {

    AccessoryCatalogService accessoryCatalogService;

    /** 查询配件目录。 */
    @GetMapping
    public List<AccessoryCatalog> list(@RequestParam(name = "includeDisabled", defaultValue = "false") boolean includeDisabled) {
        return accessoryCatalogService.list(includeDisabled);
    }

    /** 查询配件详情。 */
    @GetMapping("/{id}")
    public AccessoryCatalog get(@PathVariable Long id) {
        return accessoryCatalogService.get(id);
    }

    /** 新增配件。 */
    @PostMapping
    public AccessoryCatalog create(@RequestBody AccessoryCatalog item) {
        return accessoryCatalogService.create(item);
    }

    /** 修改配件。 */
    @PutMapping("/{id}")
    public AccessoryCatalog update(@PathVariable Long id, @RequestBody AccessoryCatalog item) {
        return accessoryCatalogService.update(id, item);
    }

    /** 删除配件。 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        accessoryCatalogService.delete(id);
        return ResponseEntity.noContent().build();
    }

}
