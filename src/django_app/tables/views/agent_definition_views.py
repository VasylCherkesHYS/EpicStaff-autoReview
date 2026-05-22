from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.response import Response

from tables.constants.organization_constants import DEFAULT_ORGANIZATION_NAME
from tables.models.agent_models import AgentDefinition
from tables.models.rbac_models import Organization
from tables.serializers.model_serializers.agent_definition_serializers import (
    AgentDefinitionReadSerializer,
    AgentDefinitionWriteSerializer,
)


class AgentDefinitionViewSet(viewsets.ModelViewSet):
    queryset = AgentDefinition.objects.select_related(
        "organization", "llm_config", "fcm_llm_config"
    )
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["llm_config", "fcm_llm_config"]

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return AgentDefinitionReadSerializer
        return AgentDefinitionWriteSerializer

    def get_queryset(self):
        organization = Organization.objects.get(name=DEFAULT_ORGANIZATION_NAME)
        return super().get_queryset().filter(organization=organization)

    def perform_create(self, serializer):
        organization = Organization.objects.get(name=DEFAULT_ORGANIZATION_NAME)
        serializer.save(organization=organization)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        self.perform_create(write_serializer)

        read_serializer = AgentDefinitionReadSerializer(
            write_serializer.instance, context=self.get_serializer_context()
        )
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        write_serializer = self.get_serializer(
            instance, data=request.data, partial=False
        )
        write_serializer.is_valid(raise_exception=True)
        self.perform_update(write_serializer)

        instance.refresh_from_db()
        read_serializer = AgentDefinitionReadSerializer(
            instance, context=self.get_serializer_context()
        )
        return Response(read_serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        write_serializer = self.get_serializer(
            instance, data=request.data, partial=True
        )
        write_serializer.is_valid(raise_exception=True)
        self.perform_update(write_serializer)

        instance.refresh_from_db()
        read_serializer = AgentDefinitionReadSerializer(
            instance, context=self.get_serializer_context()
        )
        return Response(read_serializer.data, status=status.HTTP_200_OK)
