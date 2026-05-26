from enum import StrEnum


__all__ = ["VariableTypeName"]


class VariableTypeName(StrEnum):
    """
    Name of type for tool variable, that a user can assign.
    """

    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
