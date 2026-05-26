import pytest

from services.crew.tool_factories.type_convertors import convert_to_number


class TestNumberConvertor:
    @pytest.mark.parametrize(
        "value,expected_value,expected_type",
        [
            (0, 0, int),
            (-5, -5, int),
            ("1", 1, int),
            ("-7", -7, int),
            (1.0, 1.0, float),
            (-6.9, -6.9, float),
            ("0.5", 0.5, float),
            ("-3.1", -3.1, float),
        ],
    )
    def test_correct_value_converted_to_numeric(
        self,
        value,
        expected_value,
        expected_type,
    ):
        result = convert_to_number(value)
        assert type(result) is expected_type
        assert result == expected_value

    @pytest.mark.parametrize(
        "value",
        ["abc", "1.2.3", "", " ", True, False],
    )
    def test_invalid_value_raised_error(self, value):
        with pytest.raises(ValueError, match="cannot convert to number"):
            convert_to_number(value)
