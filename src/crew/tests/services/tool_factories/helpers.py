from typing import Any, Optional, Literal

from services.crew.tool_factories.annotates import VariableDict
from services.crew.tool_factories.enums import VariableTypeName


def make_var(
    name: str,
    input_type="agent_input",
    type=VariableTypeName.STRING,
    required=False,
    default_value: Any = None,
    description="",
    properties: Optional[dict] = None,
    item_type: Optional[Any] = None,
) -> VariableDict:
    return VariableDict(
        name=name,
        type=type,
        input_type=input_type,
        required=required,
        default_value=default_value,
        description=description,
        properties=properties,
        item_type=item_type,
    )
