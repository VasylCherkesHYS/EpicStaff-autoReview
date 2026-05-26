from typing import TypedDict, Literal, Any

from .enums import VariableTypeName


__all__ = ["VariableDict"]


class VariableDict(TypedDict):
    """
    Schema of a single user-defined tool variable.
    """

    input_type: Literal["user_input", "agent_input", "mixed"]
    type: VariableTypeName
    name: str
    description: str
    default_value: Any
    required: bool
    properties: dict | None
    item_type: str | None
