from tables.import_export.version_conversions.base import VersionConverter

_FIELD_TYPE_TO_VAR_TYPE = {
    "llm_config": "integer",
    "embedding_config": "integer",
    "string": "string",
    "boolean": "boolean",
    "any": "any",
    "integer": "integer",
    "float": "number",
}


@VersionConverter.register(from_version=1)
def v1_to_v2(data: dict) -> dict:
    """
    v1 → v2: replace args_schema + python_code_tool_config_fields on each
    PythonCodeTool entry with a single `variables` list, mirroring DB
    migration 0170_pythoncodetool_variables_drop_args_schema.

    agent_input variables come from args_schema.properties;
    user_input variables come from python_code_tool_config_fields records.
    Bundles that carry no PythonCodeTool key (e.g. graph-only snapshots)
    pass through unchanged.
    """
    for tool in data.get("PythonCodeTool", []):
        variables = []

        schema = tool.get("args_schema") or {}
        properties = schema.get("properties", {})
        required_names = set(schema.get("required", []))

        for name, prop in properties.items():
            var = {
                "name": name,
                "type": prop.get("type", "string"),
                "description": prop.get("description", ""),
                "default_value": prop.get("default", None),
                "input_type": "agent_input",
                "required": name in required_names,
            }

            if prop.get("properties"):
                var["properties"] = prop["properties"]

            if prop.get("required"):
                var["required_properties"] = prop["required"]

            if prop.get("items"):
                var["items"] = prop["items"]

            variables.append(var)

        for field in tool.get("python_code_tool_config_fields", []):
            variables.append(
                {
                    "name": field.get("name"),
                    "type": _FIELD_TYPE_TO_VAR_TYPE.get(
                        field.get("data_type"), "string"
                    ),
                    "description": field.get("description") or "",
                    "default_value": None,
                    "input_type": "user_input",
                    "required": field.get("required", True),
                }
            )

        tool["variables"] = variables
        tool.pop("args_schema", None)
        tool.pop("python_code_tool_config_fields", None)

    return data
