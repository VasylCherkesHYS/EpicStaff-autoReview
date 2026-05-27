from django.core import exceptions as dj_exceptions

from tables.exceptions import SurfaceValidationError
from tables.models.agent_models.surface_models import ResolvedSurface, Surface

SURFACE_M2M_FIELDS = (
    "allowed_agents",
    "allowed_python_tools",
    "disabled_python_tools",
    "allowed_mcp_tools",
    "disabled_mcp_tools",
    "allowed_knowledge_collections",
    "disabled_knowledge_collections",
    "allowed_storage_files",
    "disabled_storage_files",
)


class SurfaceService:
    @staticmethod
    def combine(*surfaces: Surface) -> ResolvedSurface:
        """
        Apply deny-wins across ALL surfaces. For each resource type:
        allowed_union = union by pk from every surface's allowed_X;
        effective = objects whose pk is not in any surface's disabled_X.
        Instructions concatenated in argument order, separated by '\\n\\n'.
        """
        instructions_parts = [
            getattr(s, "additional_instructions", "") or ""
            for s in surfaces
            if getattr(s, "additional_instructions", "")
        ]

        def _cross_surface_effective(allowed_attr, disabled_attr):
            allowed_by_pk: dict[int, object] = {}

            for surface in surfaces:
                for obj in getattr(surface, allowed_attr).all():
                    if obj.pk not in allowed_by_pk:
                        allowed_by_pk[obj.pk] = obj

            disabled_pks: set[int] = set()

            for surface in surfaces:
                for obj in getattr(surface, disabled_attr).all():
                    disabled_pks.add(obj.pk)

            return [obj for pk, obj in allowed_by_pk.items() if pk not in disabled_pks]

        return ResolvedSurface(
            additional_instructions="\n\n".join(instructions_parts),
            python_code_tool_configs=_cross_surface_effective(
                "allowed_python_tools", "disabled_python_tools"
            ),
            mcp_tools=_cross_surface_effective(
                "allowed_mcp_tools", "disabled_mcp_tools"
            ),
            knowledge_collections=_cross_surface_effective(
                "allowed_knowledge_collections", "disabled_knowledge_collections"
            ),
            storage_files=_cross_surface_effective(
                "allowed_storage_files", "disabled_storage_files"
            ),
        )

    @staticmethod
    def validate_surface_data(*, instance, organization, attrs):
        if instance is not None:
            candidate = Surface(
                pk=instance.pk,
                organization_id=instance.organization_id,
                name=instance.name,
                description=instance.description,
                additional_instructions=instance.additional_instructions,
            )
        else:
            candidate = Surface()

        for field_name in ("name", "description", "additional_instructions"):
            if field_name in attrs:
                setattr(candidate, field_name, attrs[field_name])

        candidate.organization = organization

        try:
            candidate.full_clean(exclude=list(SURFACE_M2M_FIELDS) + ["organization"])
        except dj_exceptions.ValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise SurfaceValidationError(detail=exc.message_dict)
            raise SurfaceValidationError(detail=exc.messages)

        return attrs

    @staticmethod
    def create_surface(*, organization, validated_data):
        m2m_values = {
            name: validated_data.pop(name, None) for name in SURFACE_M2M_FIELDS
        }

        surface = Surface.objects.create(organization=organization, **validated_data)

        for m2m_name, value in m2m_values.items():
            if value is not None:
                getattr(surface, m2m_name).set(value)

        return surface

    @staticmethod
    def update_surface(*, instance, validated_data, partial):
        m2m_values = {
            name: validated_data.pop(name, None) for name in SURFACE_M2M_FIELDS
        }

        scalar_keys = list(validated_data.keys())

        for key, value in validated_data.items():
            setattr(instance, key, value)

        if partial:
            if scalar_keys:
                instance.save(update_fields=scalar_keys)
        else:
            instance.save()

        for m2m_name in SURFACE_M2M_FIELDS:
            value = m2m_values[m2m_name]

            if partial:
                if value is not None:
                    getattr(instance, m2m_name).set(value)
            else:
                getattr(instance, m2m_name).set(value if value is not None else [])

        if (
            partial
            and not scalar_keys
            and any(v is not None for v in m2m_values.values())
        ):
            instance.save(update_fields=["updated_at"])

        return instance

    @staticmethod
    def resolve_surface(surface):
        return surface.resolve()

    @staticmethod
    def combine_by_ids(*, organization, surface_ids):
        surfaces_by_id = {
            s.pk: s
            for s in Surface.objects.filter(
                organization=organization, id__in=surface_ids
            )
        }

        missing = set(surface_ids) - surfaces_by_id.keys()

        if missing:
            raise SurfaceValidationError(
                detail={"surface_ids": [f"Surfaces not found: {sorted(missing)}"]}
            )

        ordered = [surfaces_by_id[pk] for pk in surface_ids]

        return SurfaceService.combine(*ordered)
