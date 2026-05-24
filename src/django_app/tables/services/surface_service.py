from django.core import exceptions as dj_exceptions

from tables.exceptions import SurfaceValidationError
from tables.models.agent_models.surface_models import ResolvedSurface, Surface

SURFACE_M2M_FIELDS = (
    "allowed_agents",
    "tool_configs",
    "python_code_tool_configs",
    "mcp_tools",
    "knowledge_collections",
    "storage_files",
)


class SurfaceService:
    @staticmethod
    def combine(*surfaces: Surface) -> ResolvedSurface:
        """
        Resolve each surface (walking its own parent chain) then
        union the results. additional_instructions concatenated in
        argument order, separated by '\\n\\n'. Resources deduped by pk.
        """
        resolved = [surface.resolve() for surface in surfaces]

        instructions_parts = [
            r.additional_instructions for r in resolved if r.additional_instructions
        ]

        def _union_by_pk(lists):
            seen: dict[int, object] = {}

            for items in lists:
                for obj in items:
                    if obj.pk not in seen:
                        seen[obj.pk] = obj

            return list(seen.values())

        return ResolvedSurface(
            additional_instructions="\n\n".join(instructions_parts),
            tool_configs=_union_by_pk(r.tool_configs for r in resolved),
            python_code_tool_configs=_union_by_pk(
                r.python_code_tool_configs for r in resolved
            ),
            mcp_tools=_union_by_pk(r.mcp_tools for r in resolved),
            knowledge_collections=_union_by_pk(
                r.knowledge_collections for r in resolved
            ),
            storage_files=_union_by_pk(r.storage_files for r in resolved),
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
                parent=instance.parent,
            )
        else:
            candidate = Surface()

        for field_name in ("name", "description", "additional_instructions", "parent"):
            if field_name in attrs:
                setattr(candidate, field_name, attrs[field_name])

        candidate.organization = organization

        if (
            instance is not None
            and attrs.get("parent")
            and attrs["parent"].pk == instance.pk
        ):
            raise SurfaceValidationError(
                detail={"parent": ["Surface cannot be its own parent."]}
            )

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

    @staticmethod
    def list_children(surface):
        return Surface.objects.filter(parent=surface).select_related(
            "organization", "parent"
        )
