package com.paic.stock.aluminumcad.config.typehandler;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * MyBatis 数值数组 JSON 类型处理器。
 */
public class DoubleListJsonTypeHandler extends BaseTypeHandler<List<Double>> {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();
    private static final TypeReference<List<Double>> TYPE = new TypeReference<>() {
    };

    @Override
    public void setNonNullParameter(PreparedStatement preparedStatement, int index, List<Double> parameter, JdbcType jdbcType) throws SQLException {
        try {
            preparedStatement.setString(index, JSON_MAPPER.writeValueAsString(parameter));
        } catch (JacksonException exception) {
            throw new SQLException("数值列表无法序列化为 JSON", exception);
        }
    }

    @Override
    public List<Double> getNullableResult(ResultSet resultSet, String columnName) throws SQLException {
        return parse(resultSet.getString(columnName));
    }

    @Override
    public List<Double> getNullableResult(ResultSet resultSet, int columnIndex) throws SQLException {
        return parse(resultSet.getString(columnIndex));
    }

    @Override
    public List<Double> getNullableResult(CallableStatement callableStatement, int columnIndex) throws SQLException {
        return parse(callableStatement.getString(columnIndex));
    }

    private List<Double> parse(String text) throws SQLException {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        try {
            List<Double> values = JSON_MAPPER.readValue(text, TYPE);
            return values == null ? List.of() : values;
        } catch (JacksonException exception) {
            throw new SQLException("数据库数值数组 JSON 无法解析", exception);
        }
    }

}
