from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.response import Response

from tables.constants.organization_constants import DEFAULT_ORGANIZATION_NAME
from tables.models.agent_models import InlineSurface
from tables.models.rbac_models import Organization
from tables.serializers.model_serializers.surface_serializers import (
    InlineSurfaceReadSerializer,
    InlineSurfaceWriteSerializer,
)

INLINE_SURFACE_M2M_FIELDS = (
    "tool_configs",
    "python_code_tool_configs",
    "mcp_tools",
    "knowledge_collections",
    "storage_files",
)


class InlineSurfaceViewSet(viewsets.ModelViewSet):
    queryset = InlineSurface.objects.select_related("organization").prefetch_related(
        *INLINE_SURFACE_M2M_FIELDS
    )

    def _get_organization(self):
        return Organization.objects.get(name=DEFAULT_ORGANIZATION_NAME)

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return InlineSurfaceReadSerializer
        return InlineSurfaceWriteSerializer

    def get_queryset(self):
        return super().get_queryset().filter(organization=self._get_organization())

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        organization = self._get_organization()
        write = InlineSurfaceWriteSerializer(data=request.data)
        write.is_valid(raise_exception=True)
        m2m = {k: write.validated_data.pop(k, None) for k in INLINE_SURFACE_M2M_FIELDS}
        instance = InlineSurface.objects.create(organization=organization)

        for name, value in m2m.items():
            if value is not None:
                getattr(instance, name).set(value)

        instance.refresh_from_db()
        return Response(
            InlineSurfaceReadSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return self._write(request, partial=False)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        return self._write(request, partial=True)

    def _write(self, request, partial):
        instance = self.get_object()
        write = InlineSurfaceWriteSerializer(
            instance, data=request.data, partial=partial
        )
        write.is_valid(raise_exception=True)
        m2m = {k: write.validated_data.pop(k, None) for k in INLINE_SURFACE_M2M_FIELDS}

        for name in INLINE_SURFACE_M2M_FIELDS:
            value = m2m[name]
            if partial:
                if value is not None:
                    getattr(instance, name).set(value)
            else:
                getattr(instance, name).set(value if value is not None else [])

        instance.save(update_fields=["updated_at"])
        instance.refresh_from_db()
        return Response(
            InlineSurfaceReadSerializer(instance).data, status=status.HTTP_200_OK
        )
