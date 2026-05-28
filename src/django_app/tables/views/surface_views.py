from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from tables.constants.organization_constants import DEFAULT_ORGANIZATION_NAME
from tables.models.agent_models import Surface
from tables.models.rbac_models import Organization
from tables.serializers.model_serializers.surface_serializers import (
    CombineSurfacesSerializer,
    ResolvedSurfaceSerializer,
    SurfaceReadSerializer,
    SurfaceWriteSerializer,
)
from tables.services.surface_service import SURFACE_M2M_FIELDS, SurfaceService


class SurfaceViewSet(viewsets.ModelViewSet):
    queryset = Surface.objects.select_related("organization").prefetch_related(
        *SURFACE_M2M_FIELDS
    )

    def _get_organization(self):
        return Organization.objects.get(name=DEFAULT_ORGANIZATION_NAME)

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return SurfaceReadSerializer
        return SurfaceWriteSerializer

    def get_queryset(self):
        return super().get_queryset().filter(organization=self._get_organization())

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self._get_organization()
        return context

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        organization = self._get_organization()
        ctx = self.get_serializer_context()

        write_serializer = SurfaceWriteSerializer(data=request.data, context=ctx)
        write_serializer.is_valid(raise_exception=True)

        instance = SurfaceService.create_surface(
            organization=organization,
            validated_data=write_serializer.validated_data,
        )
        instance.refresh_from_db()

        return Response(
            SurfaceReadSerializer(instance, context=ctx).data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        ctx = self.get_serializer_context()

        write_serializer = SurfaceWriteSerializer(
            instance, data=request.data, partial=False, context=ctx
        )
        write_serializer.is_valid(raise_exception=True)

        instance = SurfaceService.update_surface(
            instance=instance,
            validated_data=write_serializer.validated_data,
            partial=False,
        )
        instance.refresh_from_db()

        return Response(
            SurfaceReadSerializer(instance, context=ctx).data, status=status.HTTP_200_OK
        )

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        ctx = self.get_serializer_context()

        write_serializer = SurfaceWriteSerializer(
            instance, data=request.data, partial=True, context=ctx
        )
        write_serializer.is_valid(raise_exception=True)

        instance = SurfaceService.update_surface(
            instance=instance,
            validated_data=write_serializer.validated_data,
            partial=True,
        )
        instance.refresh_from_db()

        return Response(
            SurfaceReadSerializer(instance, context=ctx).data, status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["get"], url_path="resolve")
    def resolve(self, request, pk=None):
        resolved = SurfaceService.resolve_surface(self.get_object())
        return Response(ResolvedSurfaceSerializer(resolved).data)

    @action(detail=False, methods=["post"], url_path="combine")
    def combine(self, request):
        input_serializer = CombineSurfacesSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        resolved = SurfaceService.combine_by_ids(
            organization=self._get_organization(),
            surface_ids=input_serializer.validated_data["surface_ids"],
        )

        return Response(ResolvedSurfaceSerializer(resolved).data)
