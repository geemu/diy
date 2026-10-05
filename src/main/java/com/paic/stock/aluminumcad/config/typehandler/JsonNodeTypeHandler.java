package com.paic.stock.aluminumcad.config.typehandler;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * MyBatis JSON Tree 类型处理器。
 */
public class JsonNodeTypeHandler extends BaseTypeHandler<JsonNode> {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    @Override
    public void setNonNullParameter(PreparedStatement preparedStatement, int index, JsonNode parameter, JdbcType jdbcType) throws SQLException {
        preparedStatement.setString(index, parameter.toString());
    }

    @Override
    public JsonNode getNullableResult(ResultSet resultSet, String columnName) throws SQLException {
        return parse(resultSet.getString(columnName));
    }

    @Override
    public JsonNode getNullableResult(ResultSet resultSet, int columnIndex) throws SQLException {
        return parse(resultSet.getString(columnIndex));
    }

    @Override
    public JsonNode getNullableResult(CallableStatement callableStatement, int columnIndex) throws SQLException {
        return parse(callableStatement.getString(columnIndex));
    }

    private JsonNode parse(String text) throws SQLException {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return JSON_MAPPER.readTree(text);
        } catch (JacksonException exception) {
            throw new SQLException("数据库 JSON 数据无法解析", exception);
        }
    }

}
