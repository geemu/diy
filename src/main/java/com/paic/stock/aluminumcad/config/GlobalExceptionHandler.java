package com.paic.stock.aluminumcad.config;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Web 层统一异常处理。
 *
 * <p>业务参数错误统一映射为 400，避免各 Controller 重复 try/catch。后续新增领域异常时继续在这里
 * 做 HTTP 状态映射，而不是把协议处理逻辑下沉到 Service。</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> handleBadRequest(IllegalArgumentException exception) {
        return Map.of("message", exception.getMessage());
    }
}
