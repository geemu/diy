package com.paic.stock.aluminumcad.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Three.js 本地静态资源映射配置。
 *
 * <p>Maven 正常构建时，Three.js 会被复制到 {@code classpath:/static/vendor/three/}。IDE 直接启动、
 * 尚未执行资源复制阶段时，则回退到应用 classpath 中的 Three.js WebJar。两种方式对浏览器都保持
 * {@code /vendor/three/**} 同一 URL，运行期不依赖 CDN。</p>
 */
@Configuration
public class StaticVendorResourceConfig implements WebMvcConfigurer {

    private final String threeVersion;

    public StaticVendorResourceConfig(@Value("${app.vendor.three-version:0.155.0}") String threeVersion) {
        this.threeVersion = threeVersion;
    }

    /**
     * 注册 Three.js 静态资源的双来源查找顺序。
     * @param registry Spring MVC 静态资源注册器
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/vendor/three/**")
                .addResourceLocations(
                        "classpath:/static/vendor/three/",
                        "classpath:/META-INF/resources/webjars/three/" + threeVersion + "/"
                );
    }
}
