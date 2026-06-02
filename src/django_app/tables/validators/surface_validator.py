from tables.exceptions import SurfaceValidationError

ALLOW_DENY_PAIRS = (
    ("allowed_python_tools", "disabled_python_tools"),
    ("allowed_mcp_tools", "disabled_mcp_tools"),
    ("allowed_knowledge_collections", "disabled_knowledge_collections"),
    ("allowed_storage_files", "disabled_storage_files"),
)


class SurfaceValidator:
    @staticmethod
    def validate_no_allow_deny_conflicts(attrs: dict) -> None:
        errors = {}

        for allowed_field, denied_field in ALLOW_DENY_PAIRS:
            if allowed_field not in attrs or denied_field not in attrs:
                continue

            allowed_pks = {instance.pk for instance in attrs[allowed_field]}
            denied_pks = {instance.pk for instance in attrs[denied_field]}
            conflict_pks = sorted(allowed_pks & denied_pks)

            if conflict_pks:
                errors[denied_field] = (
                    f"Items in both {allowed_field} and {denied_field}: {conflict_pks}"
                )

        if errors:
            raise SurfaceValidationError(detail=errors)
