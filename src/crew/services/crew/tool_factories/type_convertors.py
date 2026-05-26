from typing import Any


__all__ = ["convert_to_number"]


def convert_to_number(value: Any) -> int | float:
    if type(value) is int or type(value) is float:
        return value

    try:
        if type(value) is bool:
            raise ValueError("Boolean type is not number.")
        n = float(value)
        return int(n) if n.is_integer() else n
    except ValueError:
        raise ValueError(f'"{value}" cannot convert to number.')
