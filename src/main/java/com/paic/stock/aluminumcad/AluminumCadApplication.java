package com.paic.stock.aluminumcad;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.Banner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Aluminum CAD Spring Boot 启动入口。
 */
@SpringBootApplication
@MapperScan("com.paic.stock.aluminumcad.mapper")
public class AluminumCadApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(AluminumCadApplication.class);
        app.setAllowBeanDefinitionOverriding(Boolean.FALSE);
        app.setAllowCircularReferences(Boolean.FALSE);
        app.setBannerMode(Banner.Mode.OFF);
        app.setWebApplicationType(WebApplicationType.SERVLET);
        app.run(args);
    }

}
