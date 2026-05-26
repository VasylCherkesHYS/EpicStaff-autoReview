import re

from types import MappingProxyType
from typing import Any, Collection, NamedTuple, Callable, Optional

from pydantic import BaseModel as PydanticModel, create_model, Field
from pydantic.fields import FieldInfo

from .annotates import VariableDict
from .enums import VariableTypeName
from .type_convertors import convert_to_number


__all__ = ["ArgsSchemaFactory"]


# TODO: Add support for object and array types


class TypeSpec[T](NamedTuple):
    python_type: T
    converter: Callable[[Any], T]


VARIABLE_TYPES_MAP = MappingProxyType(
    {
        VariableTypeName.STRING: TypeSpec(str, str),
        VariableTypeName.NUMBER: TypeSpec(int | float, convert_to_number),
        VariableTypeName.BOOLEAN: TypeSpec(bool, bool),
    }
)


class ArgsSchemaFactory:
    """
    Builds a Pydantic args_schema model dynamically from a variable list.
    """

    @classmethod
    def create(
        cls,
        tool_name: str,
        variables: Collection[VariableDict],
        resolved_variables: Optional[Collection[str]] = None,
    ) -> type[PydanticModel]:
        resolved_variables = resolved_variables or set()
        model_fields = cls._build_model_fields(variables, resolved_variables)
        tool_model_name = cls._normalize_model_name(tool_name)
        model_name = "ArgsSchemaOf" + tool_model_name
        return create_model(
            model_name,
            __doc__=f"Input schema for {tool_model_name}",
            __base__=PydanticModel,
            **model_fields,
        )

    @staticmethod
    def _normalize_model_name(value: str, *, pattern=re.compile(r"[A-Za-z]+")) -> str:
        return "".join(s.capitalize() for s in pattern.findall(value))

    @classmethod
    def _build_model_fields(
        cls,
        variables: Collection[VariableDict],
        resolved_variables: Collection[str],
    ) -> dict[str, tuple[type, FieldInfo]]:
        """Build the field mapping for `pydantic.create_model` from the variable list."""
        fields = {}
        for var in variables:
            if var["input_type"] not in ("agent_input", "mixed"):
                continue

            if var["name"] in resolved_variables:
                continue

            type_spec = cls._get_type_spec(var["type"])
            default = cls._get_default(
                var["default_value"],
                var["required"],
                type_spec.converter,
            )
            description = cls._compose_description(
                var["description"],
                var["default_value"],
            )

            fields[var["name"]] = (
                type_spec.python_type,
                Field(default=default, description=description),
            )
        return fields

    @staticmethod
    def _get_type_spec(type_name: str) -> TypeSpec:
        return VARIABLE_TYPES_MAP[VariableTypeName(str(type_name))]

    @staticmethod
    def _get_default(
        default_value: Any, required: bool, type_convertor: Callable
    ) -> Any:
        if default_value is None:
            if required:
                return ...
            else:
                return None

        return type_convertor(default_value)

    @staticmethod
    def _compose_description(description: str, default_value: Any):
        """Compose the agent-facing description for a single args_schema field."""
        if default_value is not None:
            if description:
                return (
                    f"{description} "
                    "If the instructions above cannot be applied, "
                    f"use {default_value} as the default value."
                )
            else:
                return f"Use the default value {default_value}"

        return description
